const form = document.getElementById("searchForm");
const queryInput = document.getElementById("query");
const siteSelect = document.getElementById("site");
const searchButton = document.getElementById("searchButton");
const resultsContainer = document.getElementById("results");
const statusElement = document.getElementById("status");
const loadMoreButton = document.getElementById("loadMore");
const dataSaver = document.getElementById("dataSaver");

let currentPage = 1;
let currentQuery = "";
let currentSite = "all";
let loading = false;
let hasMore = false;
let requestController = null;
let observer = null;

const seenUrls = new Set();

function setStatus(message) {
  statusElement.textContent = message;
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;

  return element;
}

function validHttpUrl(value) {
  if (!value || typeof value !== "string") return null;

  try {
    const url = new URL(value);

    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

function stopPreview(video) {
  video.pause();
  video.removeAttribute("src");
  video.load();
}

function createCard(item) {
  const card = makeElement("article", "video-card");
  const previewBox = makeElement("div", "preview-box");
  const info = makeElement("div", "video-info");

  const thumbnailUrl = validHttpUrl(item.thumbnail);
  const previewUrl = validHttpUrl(item.preview);
  const videoUrl = validHttpUrl(item.videoUrl);

  if (thumbnailUrl) {
    const image = makeElement("img");

    image.src = thumbnailUrl;
    image.alt = item.title || "Video thumbnail";
    image.loading = "lazy";
    image.decoding = "async";

    image.addEventListener("error", () => {
      image.hidden = true;
    });

    previewBox.appendChild(image);
  }

  if (item.duration) {
    previewBox.appendChild(
      makeElement("span", "duration", item.duration)
    );
  }

  let previewVideo = null;

  if (previewUrl) {
    const playButton = makeElement(
      "button",
      "play-preview",
      "▶ Preview"
    );

    playButton.type = "button";
    playButton.setAttribute("aria-label", "Play video preview");

    playButton.addEventListener("click", () => {
      if (previewVideo && !previewVideo.paused) {
        stopPreview(previewVideo);
        previewVideo = null;
        playButton.textContent = "▶ Preview";
        return;
      }

      const video = document.createElement("video");

      video.controls = true;
      video.playsInline = true;
      video.preload = "none";
      video.src = previewUrl;

      if (thumbnailUrl) {
        video.poster = thumbnailUrl;
      }

      previewBox.querySelector("img")?.remove();
      previewBox.querySelector("video")?.remove();

      previewBox.prepend(video);
      previewVideo = video;

      video.addEventListener("ended", () => {
        video.remove();
        previewVideo = null;
        playButton.textContent = "▶ Preview";
      });

      video.addEventListener("error", () => {
        playButton.textContent = "Preview unavailable";
        playButton.disabled = true;
      });

      playButton.textContent = "■ Stop";

      video.play().catch(() => {
        playButton.textContent = "Preview unavailable";
        playButton.disabled = true;
      });
    });

    previewBox.appendChild(playButton);
  }

  if (videoUrl) {
    const title = makeElement(
      "a",
      "video-title",
      item.title || "Untitled video"
    );

    title.href = videoUrl;
    title.target = "_blank";
    title.rel = "noopener noreferrer";

    info.appendChild(title);
  } else {
    info.appendChild(
      makeElement("div", "video-title", item.title || "Untitled video")
    );
  }

  const metadata = makeElement("div", "metadata");

  if (item.views) {
    metadata.appendChild(makeElement("span", "", item.views));
  }

  if (item.duration) {
    metadata.appendChild(makeElement("span", "", item.duration));
  }

  info.appendChild(metadata);

  info.appendChild(
    makeElement(
      "span",
      "source",
      String(item.source || "unknown").toUpperCase()
    )
  );

  card.append(previewBox, info);

  return card;
}

function resetResults() {
  resultsContainer.replaceChildren();
  seenUrls.clear();

  if (observer) {
    observer.disconnect();
    observer = null;
  }

  currentPage = 1;
  hasMore = false;
  loadMoreButton.hidden = true;
}

async function fetchResults(append = false) {
  if (loading) return;

  loading = true;
  searchButton.disabled = true;
  loadMoreButton.disabled = true;

  if (requestController) {
    requestController.abort();
  }

  requestController = new AbortController();

  setStatus(append ? "Loading more results..." : "Searching...");

  try {
    const params = new URLSearchParams({
      q: currentQuery,
      site: currentSite,
      page: String(currentPage)
    });

    const response = await fetch(`/api/search?${params}`, {
      signal: requestController.signal
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Search failed.");
    }

    const results = Array.isArray(data.results) ? data.results : [];
    let added = 0;

    for (const item of results) {
      const url = validHttpUrl(item.videoUrl);

      if (!url || seenUrls.has(url)) continue;

      seenUrls.add(url);
      resultsContainer.appendChild(createCard(item));
      added++;
    }

    hasMore = Boolean(data.hasMore);
    loadMoreButton.hidden = !hasMore;

    if (data.errors?.length) {
      setStatus(
        `${added} result(s) loaded. Some sites failed: ${data.errors.join("; ")}`
      );
    } else if (resultsContainer.children.length === 0) {
      setStatus(
        "No results found. The website may block automated requests or use a different page structure."
      );
    } else {
      setStatus(`${resultsContainer.children.length} result(s) found.`);
    }

    if (added === 0 && hasMore && append) {
      loadMoreButton.hidden = false;
      setStatus("No new results on this page. You can try loading again.");
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      setStatus(`Error: ${error.message}`);
    }
  } finally {
    loading = false;
    searchButton.disabled = false;
    loadMoreButton.disabled = false;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  currentQuery = queryInput.value.trim();
  currentSite = siteSelect.value;

  if (!currentQuery) {
    setStatus("Enter a search query.");
    return;
  }

  resetResults();
  currentPage = 1;

  await fetchResults(false);
});

loadMoreButton.addEventListener("click", async () => {
  if (!hasMore || loading) return;

  currentPage++;
  await fetchResults(true);
});

// Data Saver is enabled by default. Preview videos load only when
// the user explicitly presses the Preview button.
dataSaver.checked = true;
