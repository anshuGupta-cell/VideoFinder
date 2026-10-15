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

  console.log("[Pornhub] HTML length:", html.length);
  console.log("[Pornhub] Page title:", 
    cheerio.load(html)("title").text().trim()
  );

  const $ = cheerio.load(html);

  const checks = {
    videoSearchList: $('li[class*="videoSearchList_"]').length,
    thumbnailTitle: $("a.thumbnailTitle").length,
    imageLink: $("a.imageLink").length,
    videoThumb: $("img.videoThumb").length,
    videoList: $("#videoListSearchResults").length
  };

  console.log("[Pornhub] Selector counts:", JSON.stringify(checks));
  console.log("[Pornhub] HTML preview:", html.slice(0, 350));

  const results = [];

  $('li[class*="videoSearchList_"]').each((_, element) => {
    const card = $(element);
    const imageLink = card.find("a.imageLink").first();
    const titleLink = card.find("a.thumbnailTitle").first();

    const title = titleLink.text().trim();
    const videoUrl = absoluteUrl(titleLink.attr("href"), BASE);

    if (!title || !videoUrl) return;

    const thumbnail = absoluteUrl(
      imageLink.find("img.videoThumb").attr("src") ||
        imageLink.attr("data-poster"),
      BASE
    );

    results.push({
      id: card.attr("data-video-id") || null,
      title,
      videoUrl,
      thumbnail,
      preview: absoluteUrl(imageLink.attr("data-webm"), BASE),
      duration: card.find(".duration .time").first().text().trim(),
      views: card.find(".videoViews").first().text().trim(),
      source: "pornhub"
    });
  });

  console.log("[Pornhub] Extracted results:", results.length);

  return {
    results,
    hasMore: results.length > 0,
    status: results.length ? "success" : "no_results"
  };
}

module.exports = { search };
