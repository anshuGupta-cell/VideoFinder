const axios = require("axios");
const cheerio = require("cheerio");

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
    "AppleWebKit/537.36 (KHTML, like Gecko) " +
    "Chrome/131.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9"
};

function absoluteUrl(value, baseUrl) {
  if (!value || typeof value !== "string") return null;

  try {
    return new URL(value, baseUrl).href;
  } catch {
    return null;
  }
}

function firstValue(...values) {
  return (
    values.find(
      (value) =>
        typeof value === "string" &&
        value.trim() !== ""
    ) || null
  );
}

function getMeta($, ...names) {
  for (const name of names) {
    const value =
      $(`meta[property="${name}"]`).attr("content") ||
      $(`meta[name="${name}"]`).attr("content");

    if (value) return value;
  }

  return null;
}

function extractJsonObjects(html) {
  const results = [];
  const patterns = [
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  ];

  for (const pattern of patterns) {
    let match;

    while ((match = pattern.exec(html)) !== null) {
      try {
        const parsed = JSON.parse(match[1].trim());

        if (Array.isArray(parsed)) {
          results.push(...parsed);
        } else {
          results.push(parsed);
        }
      } catch {
        // Ignore invalid JSON-LD blocks.
      }
    }
  }

  return results;
}

function findVideoObjects(objects) {
  const videos = [];

  function visit(object) {
    if (!object || typeof object !== "object") return;

    if (Array.isArray(object)) {
      object.forEach(visit);
      return;
    }

    const type = object["@type"];

    if (
      type === "VideoObject" ||
      (Array.isArray(type) && type.includes("VideoObject"))
    ) {
      videos.push(object);
    }

    if (object["@graph"]) visit(object["@graph"]);
    if (object.mainEntity) visit(object.mainEntity);
    if (object.video) visit(object.video);
  }

  objects.forEach(visit);

  return videos;
}

function formatDuration(seconds) {
  if (seconds == null || seconds === "") return null;

  const number = Number(seconds);

  if (!Number.isFinite(number)) return String(seconds);

  const total = Math.max(0, Math.floor(number));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const pad = (n) => String(n).padStart(2, "0");

  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(secs)}`
    : `${pad(minutes)}:${pad(secs)}`;
}

function extractFromPage(html, pageUrl) {
  const $ = cheerio.load(html);

  const jsonObjects = extractJsonObjects(html);
  const videoObjects = findVideoObjects(jsonObjects);
  const videoObject = videoObjects[0] || {};

  // Metadata
  const title = firstValue(
    videoObject.name,
    getMeta($, "og:title", "twitter:title"),
    $("h1").first().text().trim(),
    $("title").text().trim()
  );

  const thumbnail = absoluteUrl(
    firstValue(
      videoObject.thumbnailUrl,
      getMeta($, "og:image", "twitter:image"),
      $("video").first().attr("poster")
    ),
    pageUrl
  );

  // Video URLs from JSON-LD and video elements.
  const videoElement = $("video").first();
  const sourceElement = $("video source").first();

  const videoUrl = absoluteUrl(
    firstValue(
      videoObject.contentUrl,
      videoObject.embedUrl,
      sourceElement.attr("src"),
      sourceElement.attr("data-src"),
      videoElement.attr("src"),
      videoElement.attr("data-src"),
      getMeta($, "og:video", "og:video:url", "twitter:player:stream")
    ),
    pageUrl
  );

  // Common trailer/preview attributes.
  const previewElement = $(
    "video[data-preview], video[data-trailer], " +
    "[data-preview-url], [data-trailer-url]"
  ).first();

  const preview = absoluteUrl(
    firstValue(
      previewElement.attr("data-preview"),
      previewElement.attr("data-preview-url"),
      previewElement.attr("data-trailer"),
      previewElement.attr("data-trailer-url")
    ),
    pageUrl
  );

  const duration = firstValue(
    formatDuration(videoObject.duration),
    videoElement.attr("duration"),
    getMeta($, "video:duration")
  );

  const description = firstValue(
    videoObject.description,
    getMeta($, "og:description", "description")
  );

  return {
    pageUrl,
    title,
    videoUrl,
    thumbnail,
    preview,
    duration,
    description,
    source: new URL(pageUrl).hostname
  };
}

async function extractVideo(url) {
  if (!url || typeof url !== "string") {
    throw new Error("A video page URL is required.");
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("Invalid URL.");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are supported.");
  }

  console.log("[VideoExtractor] Extracting:", parsedUrl.href);

  const response = await axios.get(parsedUrl.href, {
    headers: HEADERS,
    timeout: 20000,
    maxRedirects: 5,
    responseType: "text",
    maxContentLength: 5 * 1024 * 1024
  });

  const result = extractFromPage(
    response.data,
    response.request?.res?.responseUrl || parsedUrl.href
  );

  console.log("[VideoExtractor] Title:", result.title);
  console.log("[VideoExtractor] Video URL found:", Boolean(result.videoUrl));
  console.log("[VideoExtractor] Preview found:", Boolean(result.preview));

  return result;
}

module.exports = {
  extractVideo
};
