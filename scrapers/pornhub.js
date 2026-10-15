const cheerio = require("cheerio");
const { getHtml, absoluteUrl } = require("./base");

const BASE = "https://www.pornhub.com";

function extractPreviewMap($) {
  const previewMap = new Map();

  $("[data-webm], [data-mp4]").each((_, element) => {
    const el = $(element);

    const preview =
      el.attr("data-webm") ||
      el.attr("data-mp4");

    // Look for an ID on this element or one of its ancestors.
    const videoId =
      el.attr("data-video-id") ||
      el.closest("[data-video-id]").attr("data-video-id");

    if (videoId && preview) {
      if (!previewMap.has(videoId)) {
        previewMap.set(videoId, preview);
      }
    }
  });

  return previewMap;
}

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

  // Build a map of video IDs to preview URLs.
  const previewMap = extractPreviewMap($);

  console.log(
    "[Pornhub] data-webm occurrences:",
    (html.match(/data-webm/g) || []).length
  );

  console.log(
    "[Pornhub] data-mp4 occurrences:",
    (html.match(/data-mp4/g) || []).length
  );

  console.log(
    "[Pornhub] Preview URLs discovered:",
    previewMap.size
  );

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

    // Extract the thumbnail.
    const image = card.find("img").first();

    const thumbnail = absoluteUrl(
      image.attr("data-src") ||
        image.attr("data-original") ||
        image.attr("data-thumb_url") ||
        image.attr("data-poster") ||
        image.attr("src"),
      BASE
    );

    // Extract the video ID from the video URL.
    const viewKeyMatch = videoUrl.match(/[?&]viewkey=([^&]+)/);

    const videoId =
      card.attr("data-video-id") ||
      card.find("[data-video-id]").first().attr("data-video-id") ||
      titleLink.attr("data-video-id");

    // Try matching the video's ID first.
    let preview = videoId
      ? previewMap.get(videoId)
      : null;

    // If IDs differ, inspect the title's surrounding HTML.
    if (!preview) {
      const ancestorHtml =
        titleLink.parent().parent().parent().html() || "";

      const webmMatch = ancestorHtml.match(
        /data-webm=["']([^"']+)["']/
      );

      const mp4Match = ancestorHtml.match(
        /data-mp4=["']([^"']+)["']/
      );

      preview = webmMatch?.[1] || mp4Match?.[1] || null;
    }

    // Decode common HTML entities and escaped slashes.
    if (preview) {
      preview = preview
        .replace(/&amp;/g, "&")
        .replace(/&#38;/g, "&")
        .replace(/\\\//g, "/")
        .replace(/&quot;/g, '"');
    }

    preview = absoluteUrl(preview, BASE);

    // Extract poster image.
    const previewLink = card
      .find("a[data-poster]")
      .first();

    const previewThumbnail = absoluteUrl(
      previewLink.attr("data-poster") ||
        image.attr("data-poster") ||
        image.attr("data-src") ||
        image.attr("src"),
      BASE
    );

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

    if (results.length === 0) {
      console.log("[Pornhub] First result:", title);
      console.log("[Pornhub] First result video ID:", videoId);
      console.log("[Pornhub] First result view key:", viewKeyMatch?.[1] || null);
      console.log("[Pornhub] First result preview found:", Boolean(preview));
    }

    seen.add(videoUrl);

    results.push({
      title,
      videoUrl,
      thumbnail: thumbnail || null,
      preview: preview || null,
      previewThumbnail: previewThumbnail || thumbnail || null,
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
