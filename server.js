const express = require('express');
const path = require('path');
const { searchSites, sites } = require('./scrapers');
const app = express();
const PORT = process.env.PORT || 3000;
app.disable('x-powered-by');
app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/sites', (_req, res) => res.json({ sites }));
app.get('/api/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const site = String(req.query.site || 'all').toLowerCase();
  const page = Math.max(1, Math.min(1000, Number.parseInt(req.query.page || '1', 10) || 1));
  if (!q) return res.status(400).json({ error: 'Enter a search query.' });
  if (q.length > 150) return res.status(400).json({ error: 'Search query is too long.' });
  if (site !== 'all' && !sites.some(s => s.id === site)) return res.status(400).json({ error: 'Unsupported site.' });
  try { res.json({ query: q, page, ...(await searchSites(q, site, page)) }); }
  catch (e) { console.error(e.message); res.status(500).json({ error: 'Search failed.' }); }
});
app.listen(PORT, () => console.log(`VideoFinder: http://localhost:${PORT}`));
