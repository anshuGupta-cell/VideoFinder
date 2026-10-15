const cheerio = require("cheerio");

const {
  getHtml,
  absoluteUrl,
  formatViews,
  formatDuration
} = require("./base");

const BASE = "https://xhamster.com";

function firstText($, element, selectors) {
  for (const selector of selectors) {
    const value = $(element)
      .find(selector)
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim();

    if (value) return value;
  }

  return "";
}

function firstAttribute($, element, selectors, attribute) {
  for (const selector of selectors) {
    const value = $(element)
      .find(selector)
      .first()
      .attr(attribute);

    if (value) return value;
  }

  return null;
}

async function search({ q, page = 1 }) {
  const searchUrl = new URL("/search", BASE);

  searchUrl.searchParams.set("q", q);

  if (page > 1) {
    searchUrl.searchParams.set("page", String(page));
  }

  const html = await getHtml(searchUrl.href);
  const $ = cheerio.load(html);
  const results = [];
  const seen = new Set();

  const selectors = [
    ".thumb-list__item",
    ".video-thumb",
    ".thumb-list .thumb",
    "article",
    "[data-video-id]"
  ];

  let cards = $();

  for (const selector of selectors) {
    const found = $(selector);

    if (found.length) {
      cards = found;
      break;
    }
  }

  cards.each((_, element) => {
    const card = $(element);

    const titleLink = card
      .find('a[href*="/videos/"], a[href*="/video/"]')
      .first();

    const image = card.find("img").first();

    const title =
      titleLink.attr("title") ||
      image.attr("alt") ||
      firstText($, element, [
        ".thumb-title",
        ".title",
        "[class*='title']"
      ]);

    const videoUrl = absoluteUrl(
      titleLink.attr("href"),
      BASE
    );

    if (!title || !videoUrl || seen.has(videoUrl)) {
      return;
    }

    seen.add(videoUrl);

    const thumbnail = absoluteUrl(
      image.attr("data-src") ||
        image.attr("data-original") ||
        image.attr("src") ||
        image.attr("data-preview"),
      BASE
    );

    const preview = absoluteUrl(
      firstAttribute(
        $,
        element,
        [
          "video",
          "[data-preview]",
          "[data-preview-url]",
          "[data-video-preview]"
        ],
        "src"
      ) ||
        card.find("video").attr("data-src") ||
        card.attr("data-preview") ||
        card.attr("data-preview-url") ||
        card.attr("data-video-preview"),
      BASE
    );

    const duration = formatDuration(
      firstText($, element, [
        ".thumb-image-container__duration",
        ".duration",
        "[class*='duration']"
      ])
    );

    const views = formatViews(
      firstText($, element, [
        ".thumb-views",
        ".views",
        "[class*='views']"
      ])
    );

    results.push({
      id: card.attr("data-video-id") || null,
      title,
      videoUrl,
      thumbnail,
      preview,
      previewThumbnail: thumbnail,
      duration,
      views,
      source: "xhamster"
    });
  });

  return {
    results,
    hasMore: results.length > 0,
    status: results.length ? "success" : "no_results"
  };
}

module.exports = { search };
