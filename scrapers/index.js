const pornhub = require("./pornhub");
const xhamster = require("./xhamster");

const scrapers = {
  pornhub,
  xhamster
};

async function searchVideos({ q, site = "all", page = 1 }) {
  const query = String(q || "").trim();
  const pageNumber = Math.max(1, Number.parseInt(page, 10) || 1);

  if (!query) {
    return {
      results: [],
      hasMore: false,
      status: "empty_query"
    };
  }

  const selectedSites =
    site === "all"
      ? Object.keys(scrapers)
      : scrapers[site]
        ? [site]
        : [];

  if (!selectedSites.length) {
    throw new Error(`Unsupported site: ${site}`);
  }

  const outcomes = await Promise.allSettled(
    selectedSites.map(async (siteName) => {
      const data = await scrapers[siteName].search({
        q: query,
        page: pageNumber
      });

      return {
        site: siteName,
        ...data
      };
    })
  );

  const results = [];
  const errors = [];

  for (const outcome of outcomes) {
    if (outcome.status === "rejected") {
      errors.push(outcome.reason?.message || "Scraper failed");
      continue;
    }

    results.push(...outcome.value.results);
  }

  const unique = [
    ...new Map(
      results
        .filter((video) => video.videoUrl)
        .map((video) => [video.videoUrl, video])
    ).values()
  ];

  return {
    results: unique,
    hasMore: unique.length > 0,
    status: unique.length ? "success" : "no_results",
    errors
  };
}

module.exports = {
  searchVideos,
  sites: Object.keys(scrapers)
};
