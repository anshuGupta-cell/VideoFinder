const cheerio = require("cheerio");

const {
  getHtml,
  absoluteUrl,
  formatViews,
  formatDuration
} = require("./base");

const BASE = "https://www.pornhub.com";

async function search({ q, page = 1 }) {
  const searchUrl = new URL("/video/search", BASE);

  searchUrl.searchParams.set("search", q);

  if (page > 1) {
    searchUrl.searchParams.set("page", String(page));
  }

  const html = await getHtml(searchUrl.href);
  const $ = cheerio.load(html);
  const results = [];

  $('li[class*="videoSearchList_"]').each((_, element) => {
    const card = $(element);

    const imageLink = card.find("a.imageLink").first();
    const titleLink = card.find("a.thumbnailTitle").first();

    const title = titleLink.text().replace(/\s+/g, " ").trim();

    const videoUrl = absoluteUrl(
      titleLink.attr("href"),
      BASE
    );

    if (!title || !videoUrl) {
      return;
    }

    const thumbnail = absoluteUrl(
      imageLink.find("img.videoThumb").attr("src") ||
        imageLink.attr("data-poster"),
      BASE
    );

    const preview = absoluteUrl(
      imageLink.attr("data-webm"),
      BASE
    );

    const duration = formatDuration(
      card.find(".duration .time").first().text()
    );

    const views = formatViews(
      card.find(".videoViews").first().text()
    );

    results.push({
      id: card.attr("data-video-id") || null,
      videoKey: card.attr("data-video-vkey") || null,
      title,
      videoUrl,
      thumbnail,
      preview,
      previewThumbnail: thumbnail,
      duration,
      views,
      source: "pornhub"
    });
  });

  const unique = [
    ...new Map(
      results.map((video) => [video.videoUrl, video])
    ).values()
  ];

  return {
    results: unique,
    hasMore: unique.length > 0,
    status: unique.length ? "success" : "no_results"
  };
}

module.exports = { search };
