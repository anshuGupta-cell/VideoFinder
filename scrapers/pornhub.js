const { getHtml } = require("./base");

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

  // Return the raw HTML for debugging
  return {
    status: "html_debug",
    url: searchUrl.href,
    htmlLength: html.length,
    html
  };
}

module.exports = { search };
