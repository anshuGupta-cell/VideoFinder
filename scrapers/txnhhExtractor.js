const { spawn } = require("child_process");

const ALLOWED_HOSTS = new Set([
  "txnhh.com",
  "www.txnhh.com"
]);

function extractVideo(url) {
  return new Promise((resolve, reject) => {
    let parsed;

    try {
      parsed = new URL(url);
    } catch {
      return reject(new Error("Invalid URL"));
    }

    if (
      parsed.protocol !== "https:" ||
      !ALLOWED_HOSTS.has(parsed.hostname) ||
      !parsed.pathname.startsWith("/video-")
    ) {
      return reject(new Error("Invalid TXNHH video URL"));
    }

    const child = spawn(
      process.env.YTDLP_PYTHON || "python3",
      [
        "-m",
        "yt_dlp",
        "--dump-single-json",
        "--no-warnings",
        "--no-playlist",
        "--skip-download",
        url
      ],
      {
        stdio: ["ignore", "pipe", "pipe"]
      }
    );

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      finish(new Error("yt-dlp extraction timed out"));
    }, 60000);

    function finish(error, result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (error) reject(error);
      else resolve(result);
    }

    child.stdout.on("data", chunk => {
      stdout += chunk.toString();

      if (stdout.length > 5 * 1024 * 1024) {
        child.kill("SIGTERM");
        finish(new Error("yt-dlp output exceeded the limit"));
      }
    });

    child.stderr.on("data", chunk => {
      stderr += chunk.toString();

      // Avoid unbounded error output.
      if (stderr.length > 10000) {
        stderr = stderr.slice(-10000);
      }
    });

    child.on("error", error => finish(error));

    child.on("close", code => {
      if (settled) return;

      if (code !== 0) {
        return finish(
          new Error(stderr.trim() || `yt-dlp exited with code ${code}`)
        );
      }

      try {
        const info = JSON.parse(stdout);

        const formats = (info.formats || [])
          .filter(format => format.url)
          .map(format => ({
            formatId: format.format_id,
            quality: format.format_note || null,
            extension: format.ext || null,
            width: format.width || null,
            height: format.height || null,
            filesize: format.filesize || format.filesize_approx || null,
            videoCodec: format.vcodec || null,
            audioCodec: format.acodec || null,
            url: format.url
          }));

        finish(null, {
          pageUrl: info.webpage_url || url,
          title: info.title || null,
          thumbnail: info.thumbnail || null,
          duration: info.duration || null,
          formats,
          source: "txnhh",
          extractor: info.extractor_key || info.extractor || null
        });
      } catch {
        finish(new Error("Failed to parse yt-dlp JSON output"));
      }
    });
  });
}

module.exports = { extractVideo };
