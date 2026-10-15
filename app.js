const $ = id => document.getElementById(id);
const form = $('searchForm'), input = $('searchInput'), searchButton = $('searchButton');
const siteSelect = $('siteSelect'), resultsEl = $('results'), statusEl = $('status');
const countEl = $('resultCount'), moreButton = $('loadMoreButton'), sentinel = $('scrollSentinel');
const dataSaver = $('dataSaver');
let page = 0, loading = false, hasMore = false, controller = null, activeVideo = null;
const seen = new Set();
function httpUrl(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?u.href:null}catch{return null}}
function text(tag, cls, value){const e=document.createElement(tag);if(cls)e.className=cls;e.textContent=value||'';return e}
function stopPreview(){if(!activeVideo)return;const v=activeVideo;v.pause();v.hidden=true;v.removeAttribute('src');v.load();const img=v.parentElement.querySelector('img');if(img)img.hidden=false;const b=v.parentElement.querySelector('.preview-button');if(b)b.textContent='Preview';activeVideo=null}
function makeCard(item){
 const card=text('article','video-card',''), media=text('div','media','');
 const img=document.createElement('img');img.loading='lazy';img.alt=item.title||'Video thumbnail';img.src=httpUrl(item.thumbnail)||'';img.onerror=()=>{img.hidden=true};
 const src=httpUrl(item.preview), video=document.createElement('video');video.hidden=true;video.preload='none';video.playsInline=true;video.controls=true;
 video.addEventListener('ended',()=>{if(activeVideo===video)stopPreview()});
 const preview=text('button','preview-button',src?'Preview':'No preview');preview.type='button';preview.disabled=!src;
 preview.addEventListener('click',async()=>{if(!src)return;if(activeVideo===video){stopPreview();return}stopPreview();activeVideo=video;img.hidden=true;video.hidden=false;video.src=src;preview.textContent='Stop preview';try{await video.play()}catch{if(activeVideo===video)stopPreview();statusEl.textContent='Preview could not play. Open the original page instead.'}});
 media.append(img,video,preview);if(item.duration)media.append(text('span','duration',item.duration));
 const info=text('div','video-info','');info.append(text('h2','video-title',item.title||'Untitled video'));
 const meta=text('div','video-meta','');if(item.views)meta.append(text('span','',item.views));if(item.duration)meta.append(text('span','',`Duration: ${item.duration}`));info.append(meta,text('span','source',`Source: ${item.source||'unknown'}`));
 const actions=text('div','actions',''), original=httpUrl(item.videoUrl);
 if(original){const a=text('a','primary','Open original');a.href=original;a.target='_blank';a.rel='noopener noreferrer';actions.append(a)}
 if(src){const b=text('button','','Play preview');b.type='button';b.addEventListener('click',()=>preview.click());actions.append(b)}
 info.append(actions);card.append(media,info);return card;
}
function render(items,reset){if(reset){stopPreview();resultsEl.replaceChildren();seen.clear()}let added=0;for(const item of items){if(!item.videoUrl||seen.has(item.videoUrl))continue;seen.add(item.videoUrl);resultsEl.append(makeCard(item));added++}if(reset&&!added)resultsEl.append(text('div','empty','No results found. The site may block automated requests or use a page structure the scraper does not recognize.'));countEl.textContent=`${seen.size} result${seen.size===1?'':'s'}`}
async function load(reset=false){if(loading&&!reset)return;if(reset){if(controller)controller.abort();controller=null;loading=false;page=0;hasMore=false;seen.clear();resultsEl.replaceChildren();countEl.textContent='0 results'}if(loading)return;const q=input.value.trim();if(!q){statusEl.textContent='Enter a search query.';return}loading=true;searchButton.disabled=true;moreButton.disabled=true;moreButton.hidden=true;const next=page+1, localController=new AbortController();controller=localController;statusEl.textContent=reset?'Searching supported websites…':'Loading more results…';try{const params=new URLSearchParams({q,site:siteSelect.value,page:String(next)});const response=await fetch(`/api/search?${params}`,{signal:localController.signal});const data=await response.json();if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);if(controller!==localController)return;page=next;hasMore=Boolean(data.hasMore);render(Array.isArray(data.results)?data.results:[],reset);statusEl.textContent=Object.entries(data.sources||{}).map(([s,v])=>`${s}: ${v}`).join(' · ')||'Search complete.';moreButton.hidden=!hasMore}catch(e){if(e.name==='AbortError')return;statusEl.textContent=e.message||'Search failed.';if(reset)resultsEl.append(text('div','empty','Search failed. Please try again later.'))}finally{if(controller===localController){loading=false;controller=null;searchButton.disabled=false;moreButton.disabled=false}}}
form.addEventListener('submit',e=>{e.preventDefault();load(true)});siteSelect.addEventListener('change',()=>{if(input.value.trim())load(true)});moreButton.addEventListener('click',()=>load(false));
if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)&&hasMore&&!loading)load(false)},{rootMargin:'500px'});observer.observe(sentinel)}
// Data Saver is enabled by default. This version never autoplays previews; preview buttons remain usable.
dataSaver.addEventListener('change',()=>{statusEl.textContent=dataSaver.checked?'Data Saver is on. Previews play only when requested.':'Data Saver is off. Previews still require a manual click.'});
