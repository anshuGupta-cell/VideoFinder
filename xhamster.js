const { fetchPage } = require('./base');
const BASE = 'https://xhamster46.desi';
async function search(q, page = 1) {
  const url = `${BASE}/search/${encodeURIComponent(q)}${page > 1 ? `?page=${page}` : ''}`;
  const result = await fetchPage(url, 'xhamster', BASE);
  result.hasMore = result.results.length > 0;
  if (!result.results.length) result.status = 'no_results';
  return result;
}
module.exports = { search };
