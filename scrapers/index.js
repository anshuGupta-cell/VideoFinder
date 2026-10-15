const xhamster = require('./xhamster');
const pornhub = require('./pornhub');
const scrapers = { xhamster, pornhub };
const sites = [
  { id: 'all', name: 'All supported sites' },
  { id: 'xhamster', name: 'xHamster' },
  { id: 'pornhub', name: 'Pornhub' }
];
async function searchSites(q, site, page) {
  const names = site === 'all' ? Object.keys(scrapers) : [site];
  const settled = await Promise.allSettled(names.map(async name => ({ name, data: await scrapers[name].search(q, page) })));
  const results = [], sources = {};
  let hasMore = false;
  settled.forEach((item, i) => {
    const name = names[i];
    if (item.status === 'fulfilled') {
      results.push(...item.value.data.results);
      sources[name] = item.value.data.status;
      hasMore ||= item.value.data.hasMore;
    } else {
      sources[name] = 'unavailable';
      console.warn(`${name}: ${item.reason?.message || item.reason}`);
    }
  });
  const seen = new Set();
  return {
    results: results.filter(v => v.videoUrl && !seen.has(v.videoUrl) && seen.add(v.videoUrl)),
    hasMore, sources, supportedSites: sites
  };
}
module.exports = { searchSites, sites };
