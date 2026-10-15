const axios = require("axios");

const client = axios.create({
  timeout: 20000,
  maxRedirects: 5,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9"
  }
});

function absoluteUrl(value, base) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const input = value.trim();

  if (
    input === "undefined" ||
    input === "null" ||
    input.includes("/undefined")
  ) {
    return null;
  }

  try {
    const url = new URL(input, base);

    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

async function getHtml(url) {
  const response = await client.get(url, {
    responseType: "text"
  });

  if (typeof response.data !== "string") {
    throw new Error("The website did not return HTML.");
  }

  return response.data;
}

function formatViews(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function formatDuration(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

module.exports = {
  client,
  getHtml,
  absoluteUrl,
  formatViews,
  formatDuration
};
