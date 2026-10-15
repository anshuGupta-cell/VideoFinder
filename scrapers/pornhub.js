const cheerio = require("cheerio");
const { getHtml, absoluteUrl } = require("./base");

const BASE = "https://www.pornhub.org";

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

    const title = titleLink
      .text()
      .replace(/\s+/g, " ")
      .trim();

    const videoUrl = absoluteUrl(
      titleLink.attr("href"),
      BASE
    );

    if (!title || !videoUrl || seen.has(videoUrl)) {
      return;
    }

    // Find the video card.
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

    // Extract thumbnail.
    const image = card.find("img").first();

    const thumbnail = absoluteUrl(
      image.attr("data-src") ||
        image.attr("data-original") ||
        image.attr("data-thumb_url") ||
        image.attr("data-poster") ||
        image.attr("src"),
      BASE
    );

    // Preview intentionally disabled.
    const preview = null;

    // Extract duration.
    const duration = (
      card.find(".duration, [class*='duration']").first().text() || ""
    )
      .replace(/\s+/g, " ")
      .trim();

    // Extract views.
    const views = (
      card.find(".videoViews, .views, [class*='views']").first().text() || ""
    )
      .replace(/\s+/g, " ")
      .trim();

    seen.add(videoUrl);

    results.push({
      title,
      videoUrl,
      thumbnail: thumbnail || null,
      preview,
      previewThumbnail: thumbnail || null,
      duration,
      views,
      source: "pornhub"
    });
  });

  console.log(
    "[Pornhub] Title links:",
    $("a.thumbnailTitle").length
  );

  console.log(
    "[Pornhub] Extracted results:",
    results.length
  );

  return {
    results,
    hasMore: results.length > 0,
    status: results.length ? "success" : "no_results"
  };
}

module.exports = { search };
