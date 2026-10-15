const cheerio = require("cheerio");
const { getHtml, absoluteUrl } = require("./base");

const BASE = "https://www.pornhub.com";

async function search({ q, page = 1 }) {
  const searchUrl = new URL("/video/search", BASE);
  searchUrl.searchParams.set("search", q);

  if (page > 1) {
    searchUrl.searchParams.set("page", String(page));
  }

  console.log("[Pornhub] Requesting:", searchUrl.href);

  const html = await getHtml(searchUrl.href);
  const $ = cheerio.load(html);

  const results = [];
  const seen = new Set();

  $("a.thumbnailTitle").each((_, element) => {
    const titleLink = $(element);
    const title = titleLink.text().replace(/\s+/g, " ").trim();
    const videoUrl = absoluteUrl(titleLink.attr("href"), BASE);

    if (!title || !videoUrl || seen.has(videoUrl)) {
      return;
    }

    // Find the nearest ancestor containing the thumbnail.
    let card = titleLink;

    for (let i = 0; i < 8; i++) {
      if (!card.parent().length) break;

      card = card.parent();

      if (
        card.find("img").length &&
        card.find("a[href]").length >= 2
      ) {
        break;
      }
    }

    // Thumbnail
    const image = card.find("img").first();

    const thumbnail = absoluteUrl(
      image.attr("data-src") ||
        image.attr("data-original") ||
        image.attr("src") ||
        image.attr("data-thumb_url"),
      BASE
    );

    // Preview video URL
    const previewLink = card
      .find("a[data-webm], a[data-mp4], a[data-video-preview], a[data-preview]")
      .first();

    const previewImage = card
      .find("img[data-webm], img[data-mp4], img[data-video-preview], img[data-preview]")
      .first();

    const previewElement = card.find("video").first();

    const preview = absoluteUrl(
      previewLink.attr("data-webm") ||
        previewLink.attr("data-mp4") ||
        previewLink.attr("data-video-preview") ||
        previewLink.attr("data-preview") ||
        previewImage.attr("data-webm") ||
        previewImage.attr("data-mp4") ||
        previewImage.attr("data-video-preview") ||
        previewImage.attr("data-preview") ||
        previewElement.attr("data-src") ||
        previewElement.attr("src") ||
        previewElement.find("source").first().attr("src"),
      BASE
    );

    // Duration
    const duration = (
      card.find(".duration, [class*='duration']").first().text() || ""
    ).replace(/\s+/g, " ").trim();

    // Views
    const views = (
      card.find(".videoViews, [class*='views']").first().text() || ""
    ).replace(/\s+/g, " ").trim();

    seen.add(videoUrl);

    results.push({
      title,
      videoUrl,
      thumbnail,
      preview: preview || null,
      previewThumbnail: thumbnail,
      duration,
      views,
      source: "pornhub"
    });
  });

  console.log("[Pornhub] Title links:", $("a.thumbnailTitle").length);
  console.log("[Pornhub] Extracted results:", results.length);
  console.log(
    "[Pornhub] Results with previews:",
    results.filter((item) => item.preview).length
  );

  return {
    results,
    hasMore: results.length > 0,
    status: results.length ? "success" : "no_results"
  };
}

module.exports = { search };
