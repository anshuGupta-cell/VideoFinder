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

  // Diagnose preview-related data in the actual response.
  for (const keyword of [
    "data-webm",
    "data-mp4",
    "previewUrl",
    "mediaDefinitions",
    "videoUrl"
  ]) {
    console.log(
      `[Pornhub] ${keyword}:`,
      html.indexOf(keyword)
    );
  }

  // Extract video information from search results.
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

    // Find the video card containing the thumbnail.
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

    // Thumbnail.
    const image = card.find("img").first();

    const thumbnail = absoluteUrl(
      image.attr("data-src") ||
        image.attr("data-original") ||
        image.attr("data-thumb_url") ||
        image.attr("data-poster") ||
        image.attr("src"),
      BASE
    );

    // Preview URL: inspect anchors and video elements.
    const previewLink = card
      .find("a[data-webm], a[data-mp4], a[data-preview]")
      .first();

    const videoElement = card.find("video").first();

    const previewSource = videoElement
      .find("source")
      .first();

    const preview = absoluteUrl(
      previewLink.attr("data-webm") ||
        previewLink.attr("data-mp4") ||
        previewLink.attr("data-preview") ||
        videoElement.attr("data-webm") ||
        videoElement.attr("data-src") ||
        videoElement.attr("src") ||
        previewSource.attr("src"),
      BASE
    );

    // Preview poster.
    const previewThumbnail = absoluteUrl(
      previewLink.attr("data-poster") ||
        videoElement.attr("poster") ||
        image.attr("data-poster") ||
        image.attr("data-src") ||
        image.attr("src"),
      BASE
    );

    // Duration.
    const duration = (
      card.find(".duration, [class*='duration']").first().text() || ""
    )
      .replace(/\s+/g, " ")
      .trim();

    // Views.
    const views = (
      card.find(".videoViews, [class*='views']").first().text() || ""
    )
      .replace(/\s+/g, " ")
      .trim();

    // Log HTML for the first result to identify the real markup.
    if (results.length === 0) {
      console.log("[Pornhub] First title:", title);
      console.log(
        "[Pornhub] First title ancestor HTML:",
        titleLink.parent().parent().parent().html()?.slice(0, 6000)
      );

      console.log(
        "[Pornhub] First card preview attributes:",
        card.find("[data-webm], [data-mp4], [data-preview]").length
      );
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
    results.filter(item => item.preview).length
  );

  return {
    results,
    hasMore: results.length > 0,
    status: results.length ? "success" : "no_results"
  };
}

module.exports = { search };
