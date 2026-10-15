const cheerio = require("cheerio");
const { getHtml, absoluteUrl } = require("./base");

const BASE = "https://xhamster46.desi";

function extractJsonArray(html, propertyName) {
  const patterns = [
    `"${propertyName}"`,
    `\\u0022${propertyName}\\u0022`
  ];

  let propertyIndex = -1;

  for (const pattern of patterns) {
    propertyIndex = html.indexOf(pattern);
    if (propertyIndex !== -1) break;
  }

  if (propertyIndex === -1) return null;

  const start = html.indexOf("[", propertyIndex);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < html.length; i++) {
    const char = html[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === "[") {
      depth++;
    } else if (char === "]") {
      depth--;

      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

function formatDuration(seconds) {
  if (seconds == null || !Number.isFinite(Number(seconds))) {
    return null;
  }

  const total = Math.max(0, Math.floor(Number(seconds)));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const pad = (n) => String(n).padStart(2, "0");

  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(secs)}`
    : `${pad(minutes)}:${pad(secs)}`;
}

function formatViews(views) {
  if (views == null || !Number.isFinite(Number(views))) {
    return null;
  }

  return `${Number(views).toLocaleString("en-US")} views`;
}

function firstValue(...values) {
  return values.find(
    (value) =>
      typeof value === "string" &&
      value.trim() !== ""
  ) || null;
}

function normalizeVideo(video) {
  const preview = firstValue(
    video.trailerURL,
    video.trailerFallbackUrl,
    video.trailerUrl,
    video.previewURL,
    video.previewUrl,
    video.previewVideoURL,
    video.previewVideoUrl,
    video.videoPreviewURL,
    video.videoPreviewUrl
  );

  const thumbnail = firstValue(
    video.thumbURL,
    video.imageURL,
    video.thumbUrl,
    video.imageUrl
  );

  const previewThumbnail = firstValue(
    video.previewThumbURL,
    video.previewThumbnail,
    video.previewThumbUrl,
    thumbnail
  );

  return {
    title: video.title || "",
    videoUrl: absoluteUrl(video.pageURL || video.url),
    thumbnail: absoluteUrl(thumbnail),
    preview: absoluteUrl(preview),
    previewThumbnail: absoluteUrl(previewThumbnail),
    duration: formatDuration(video.duration),
    views: formatViews(video.views),
    source: "xhamster"
  };
}

function extractCardPreview(card) {
  const video = card.find("video").first();
  const source = card.find("video source").first();

  return firstValue(
    source.attr("src"),
    source.attr("data-src"),
    video.attr("src"),
    video.attr("data-src"),
    video.attr("data-preview"),
    video.attr("data-preview-url"),
    video.attr("data-trailer"),
    video.attr("data-trailer-url"),
    card.find("[data-preview-url]").first().attr("data-preview-url"),
    card.find("[data-trailer-url]").first().attr("data-trailer-url")
  );
}

async function search({ q, page = 1 }) {
  const searchUrl = new URL(
    "/search/" + encodeURIComponent(q).replace(/%20/g, "+"),
    BASE
  );

  if (page > 1) {
    searchUrl.searchParams.set("page", String(page));
  }

  console.log("[xHamster] Requesting:", searchUrl.href);

  try {
    const html = await getHtml(searchUrl.href);

    // Primary method: extract video data embedded in the HTML.
    const videoThumbProps = extractJsonArray(
      html,
      "videoThumbProps"
    );

    if (Array.isArray(videoThumbProps)) {
      const results = videoThumbProps
        .filter(
          (video) =>
            video &&
            video.videoType === "video"
        )
        .map(normalizeVideo)
        .filter(
          (video) =>
            video.title &&
            video.videoUrl
        );

      console.log(
        "[xHamster] Embedded results:",
        results.length
      );

      console.log(
        "[xHamster] Results with previews:",
        results.filter((video) => video.preview).length
      );

      return {
        results,
        hasMore: results.length > 0,
        status: results.length ? "success" : "no_results"
      };
    }

    // Fallback method: parse video cards from HTML.
    const $ = cheerio.load(html);
    const results = [];
    const seen = new Set();

    $('a[href*="/videos/"]').each((_, element) => {
      const anchor = $(element);
      const videoUrl = absoluteUrl(anchor.attr("href"));

      if (!videoUrl || seen.has(videoUrl)) {
        return;
      }

      let pathname;

      try {
        pathname = new URL(videoUrl).pathname;
      } catch {
        return;
      }

      if (!/^\/videos\/[^/]+\/?$/i.test(pathname)) {
        return;
      }

      const card = anchor.closest(
        "article, .thumb-list__item, .video-thumb, .thumb"
      );

      const title =
        anchor.attr("title") ||
        anchor.attr("aria-label") ||
        card.find("[class*='title']").first().text().trim() ||
        anchor.text().trim();

      if (!title) {
        return;
      }

      const image = card.find("img").first();

      const thumbnail = absoluteUrl(
        image.attr("data-src") ||
        image.attr("data-original") ||
        image.attr("data-lazy-src") ||
        image.attr("src")
      );

      const preview = absoluteUrl(
        extractCardPreview(card)
      );

      const durationText = card
        .find("[class*='duration']")
        .first()
        .text()
        .trim();

      const viewsText = card
        .find("[class*='views']")
        .first()
        .text()
        .trim();

      seen.add(videoUrl);

      results.push({
        title,
        videoUrl,
        thumbnail,
        preview,
        previewThumbnail: thumbnail,
        duration: durationText || null,
        views: viewsText || null,
        source: "xhamster"
      });
    });

    console.log(
      "[xHamster] Fallback results:",
      results.length
    );

    console.log(
      "[xHamster] Results with previews:",
      results.filter((video) => video.preview).length
    );

    return {
      results,
      hasMore: results.length > 0,
      status: results.length ? "success" : "no_results"
    };
  } catch (error) {
    console.error(
      "[xHamster] Scraping error:",
      error.message
    );

    throw error;
  }
}

module.exports = { search };
