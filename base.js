const axios = require('axios');
const cheerio = require('cheerio');
const client = axios.create({ timeout: 12000, maxRedirects: 5, headers: {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9'
}});
function url(value, base) {
  try { const u = new URL(value, base); return ['http:', 'https:'].includes(u.protocol) ? u.href : null; }
  catch { return null; }
}
function duration(v) {
  if (v == null || v === '') return '';
  if (!/^\d+$/.test(String(v))) return String(v);
  let s = Number(v); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = Math.floor(s % 60);
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`;
}
function views(v) {
  if (v == null || v === '') return '';
  const n = Number(v); if (!Number.isFinite(n)) return String(v);
  return n >= 1e6 ? `${(n/1e6).toFixed(1).replace(/\.0$/,'')}M views` : n >= 1000 ? `${(n/1000).toFixed(1).replace(/\.0$/,'')}K views` : `${n} views`;
}
function collect(value, out = []) {
  if (!value || typeof value !== 'object') return out;
  if (Array.isArray(value)) { value.forEach(v => collect(v, out)); return out; }
  if ((value.pageURL || value.videoUrl || value.url) && (value.title || value.name) && (value.thumbURL || value.thumbnail || value.imageURL || value.poster)) out.push(value);
  Object.values(value).forEach(v => { if (v && typeof v === 'object') collect(v, out); });
  return out;
}
function parse(html, source, base) {
  const $ = cheerio.load(html), raw = [];
  $('script[type="application/ld+json"]').each((_, el) => { try { raw.push(...collect(JSON.parse($(el).text()))); } catch {} });
  $('script:not([src])').each((_, el) => {
    const text = $(el).text(); if (!text || text.length > 8000000 || !/videoThumbProps|pageURL|videoUrl/i.test(text)) return;
    const match = text.match(/(?:window\.)?videoThumbProps\s*=\s*(\[[\s\S]*?\])\s*;?/);
    if (match) { try { raw.push(...collect(JSON.parse(match[1]))); } catch {} }
    const t = text.trim(); if (t.startsWith('{') || t.startsWith('[')) { try { raw.push(...collect(JSON.parse(t))); } catch {} }
  });
  $("[data-video-url], a[href*='/videos/'], a[href*='/view_video.php']").each((_, el) => {
    const a = $(el), img = a.find('img');
    const href = a.attr('data-video-url') || a.attr('href');
    const title = a.attr('title') || img.attr('alt') || a.text().trim();
    const thumbURL = img.attr('data-src') || img.attr('src') || a.attr('data-thumb');
    if (href && title && thumbURL) raw.push({ pageURL: href, title, thumbURL });
  });
  const seen = new Set();
  return raw.map(v => {
    const videoUrl = url(v.videoUrl || v.pageURL || v.url, base);
    if (!videoUrl || !v.title || seen.has(videoUrl)) return null;
    seen.add(videoUrl);
    return { title: String(v.title).trim(), videoUrl,
      thumbnail: url(v.thumbnail || v.thumbURL || v.imageURL || v.poster, base),
      preview: url(v.preview || v.trailerURL || v.trailerFallbackUrl, base),
      previewThumbnail: url(v.previewThumbnail || v.previewThumbURL, base),
      duration: duration(v.duration || v.length || v.durationText),
      views: views(v.views || v.viewCount), source };
  }).filter(Boolean);
}
async function fetchPage(pageUrl, source, base) {
  const response = await client.get(pageUrl);
  return { results: parse(String(response.data), source, base), status: 'success', hasMore: true };
}
module.exports = { fetchPage };
