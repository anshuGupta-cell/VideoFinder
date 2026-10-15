const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const YT_DLP_COMMAND = "python3";

async function extractVideo(url) {
  if (!url || typeof url !== "string") {
    throw new Error("A video page URL is required.");
  }

  let parsed;

  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid video URL.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are supported.");
  }

  // Avoid allowing arbitrary local or private-network URLs.
  const hostname = parsed.hostname.toLowerCase();

  if (
    hostname === "localhost" ||
    hostname === "::1" ||
    hostname.endsWith(".local") ||
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^169\.254\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  ) {
    throw new Error("Local and private-network URLs are not allowed.");
  }

  console.log("[VideoExtractor] Extracting:", parsed.href);

  const { stdout } = await execFileAsync(
    YT_DLP_COMMAND,
    [
      "--dump-single-json",
      "--no-warnings",
      "--no-playlist",
      "--skip-download",
      "--format",
      "best",
      parsed.href
    ],
    {
      timeout: 60000,
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true
    }
  );

  const data = JSON.parse(stdout);

  const formats = (data.formats || [])
    .filter((format) => format.url)
    .map((format) => ({
      url: format.url,
      formatId: format.format_id || null,
      extension: format.ext || null,
      quality: format.format_note || format.resolution || null,
      width: format.width || null,
      height: format.height || null,
      protocol: format.protocol || null,
      hasAudio: format.acodec
        ? format.acodec !== "none"
        : null,
      hasVideo: format.vcodec
        ? format.vcodec !== "none"
        : null
    }));

  // Prefer a combined audio/video stream for direct playback.
  const selectedFormat =
    formats.find(
      (format) => format.hasVideo && format.hasAudio
    ) ||
    formats.find((format) => format.hasVideo) ||
    null;

  const result = {
    pageUrl: data.webpage_url || parsed.href,
    title: data.title || null,
    videoUrl: selectedFormat?.url || data.url || null,
    thumbnail: data.thumbnail || null,
    duration: data.duration ?? null,
    description: data.description || null,
    source: data.extractor_key || data.extractor || parsed.hostname,
    formats
  };

  console.log(
    "[VideoExtractor] Direct URL found:",
    Boolean(result.videoUrl)
  );

  console.log(
    "[VideoExtractor] Available formats:",
    result.formats.length
  );

  return result;
}

module.exports = { extractVideo };
