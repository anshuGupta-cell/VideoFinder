const axios = require("axios");
const cheerio = require("cheerio");

const BASE_URL = "https://www.txnhh.com";

const client = axios.create({
timeout: 20000,
maxRedirects: 5,
headers: {
"User-Agent":
"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
"(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
"Accept-Language": "en-US,en;q=0.9"
}
});

function absoluteUrl(value, base = BASE_URL) {
if (!value) return null;

try {
return new URL(value, base).href;
} catch {
return null;
}
}

async function fetchHtml(url) {
const response = await client.get(url);
return response.data;
}

function parseDuration(text) {
const match = text.match(/\b(?:(\d+)\sh\s)?(\d+)\s*min\b/i);

if (!match) return null;

return (Number(match[1] || 0) * 60 + Number(match[2])) * 60;
}

function parseSearchResults(html) {
const $ = cheerio.load(html);
const results = [];
const seen = new Set();

$('a[href*="/video-"]').each((_, element) => {
const anchor = $(element);
const href = anchor.attr("href");
const videoUrl = absoluteUrl(href);

if (!videoUrl || seen.has(videoUrl)) return;

const title =
  anchor.attr("title") ||
  anchor.find("img").attr("alt") ||
  anchor.text().trim();

if (!title) return;

// Search results commonly display metadata near the title.
const card = anchor.closest(
  ".thumb-block, .thumb, .mozaique, article, li"
);

const context = card.length
  ? card.text().replace(/\s+/g, " ").trim()
  : anchor.parent().text().replace(/\s+/g, " ").trim();

const image = anchor.find("img").first();

results.push({
  title: title.replace(/\s+/g, " ").trim(),
  videoUrl,
  thumbnail: absoluteUrl(
    image.attr("data-src") ||
    image.attr("data-original") ||
    image.attr("src")
  ),
  duration: parseDuration(context),
  quality: (context.match(/\b\d{3,4}p\b/i) || [])[0] || null,
  source: "txnhh"
});

seen.add(videoUrl);

});

return results;
}

async function search(query, page = 1) {
if (!query || typeof query !== "string") {
throw new Error("A search query is required.");
}

const pageNumber = Math.max(1, Number(page) || 1);

const url = new URL(
"/search/${encodeURIComponent(query.trim()).replace(/%20/g, "+")}",
BASE_URL
);

if (pageNumber > 1) {
url.searchParams.set("p", String(pageNumber));
}

const html = await fetchHtml(url.href);
const results = parseSearchResults(html);

return {
query: query.trim(),
page: pageNumber,
count: results.length,
results
};
}

async function extractVideo(videoUrl) {
const parsed = new URL(videoUrl);

if (
parsed.protocol !== "https:" ||
!["txnhh.com", "www.txnhh.com"].includes(parsed.hostname)
) {
throw new Error("Provide an HTTPS TXNHH video URL.");
}

if (!parsed.pathname.includes("/video-")) {
throw new Error("The URL does not look like a TXNHH video page.");
}

const html = await fetchHtml(parsed.href);
const $ = cheerio.load(html);

const title =
$('meta[property="og:title"]').attr("content") ||
$("h1").first().text().trim() ||
$("title").text().trim() ||
null;

const thumbnail =
$('meta[property="og:image"]').attr("content") ||
$("video").attr("poster") ||
null;

const description =
$('meta[property="og:description"]').attr("content") ||
$('meta[name="description"]').attr("content") ||
null;

const links = [];

$("a[href]").each((_, element) => {
const anchor = $(element);
const label = anchor.text().replace(/\s+/g, " ").trim();
const href = absoluteUrl(anchor.attr("href"), parsed.href);

if (!href) return;

if (/view\s+low\s+qual/i.test(label)) {
  links.push({
    quality: "low",
    url: href
  });
} else if (/view\s+high\s+qual/i.test(label)) {
  links.push({
    quality: "high",
    url: href
  });
}

});

const uniqueLinks = [
...new Map(links.map(item => [item.quality, item])).values()
];

return {
pageUrl: parsed.href,
title,
thumbnail: absoluteUrl(thumbnail, parsed.href),
description,
videoLinks: uniqueLinks,
source: "txnhh"
};
}

module.exports = {
search,
extractVideo
};
