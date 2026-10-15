const { getHtml } = require("./base");
const cheerio = require("cheerio");

const BASE = "https://www.pornhub.com";

function getAbsoluteUrl(value) {
  if (
    !value ||
    typeof value !== "string" ||
    value.trim() === "undefined" ||
    value.trim() === "null"
  ) {
    return null;
  }

  try {
    const url = new URL(value.trim(), BASE);

    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

async function search({ q, page = 1 }) {
  const url =
    `${BASE}/video/search?search=${encodeURIComponent(q)}` +
    (page > 1 ? `&page=${page}` : "");

  const html = await getHtml(url);
  const $ = cheerio.load(html);
  const results = [];

  $('li[class*="videoSearchList_"]').each((_, element) => {
    const card = $(element);
    const imageLink = card.find("a.imageLink").first();
    const titleLink = card.find("a.thumbnailTitle").first();

    const title = titleLink.text().trim();
    const videoUrl = getAbsoluteUrl(titleLink.attr("href"));

    if (!title || !videoUrl) return;

    const thumbnail = getAbsoluteUrl(
      imageLink.find("img.videoThumb").attr("src") ||
      imageLink.attr("data-poster")
    );

    const preview = getAbsoluteUrl(
      imageLink.attr("data-webm")
    );

    const duration =
      card.find(".duration .time").first().text().trim();

    const views =
      card.find(".videoViews").first().text().trim();

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

  // Remove duplicate video URLs.
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
