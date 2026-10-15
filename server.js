const express = require("express");
const path = require("path");

const { searchVideos, sites } = require("./scrapers");

const app = express();
const PORT = process.env.PORT || 3000;

app.disable("x-powered-by");

app.use(express.json({ limit: "100kb" }));

app.use(
  express.static(path.join(__dirname, "public"), {
    maxAge: process.env.NODE_ENV === "production" ? "1h" : 0
  })
);

app.get("/api/sites", (req, res) => {
  res.json({
    sites: [
      { id: "all", name: "All sites" },
      ...sites.map((site) => ({
        id: site,
        name: site === "xhamster" ? "xHamster" : "Pornhub"
      }))
    ]
  });
});

app.get("/api/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  const site = String(req.query.site || "all").toLowerCase();
  const page = Number.parseInt(req.query.page || "1", 10);

  if (!q) {
    return res.status(400).json({
      status: "error",
      message: "Please enter a search query.",
      results: []
    });
  }

  if (q.length > 200) {
    return res.status(400).json({
      status: "error",
      message: "Search query is too long.",
      results: []
    });
  }

  if (!Number.isInteger(page) || page < 1 || page > 100) {
    return res.status(400).json({
      status: "error",
      message: "Page must be between 1 and 100.",
      results: []
    });
  }

  try {
    const data = await searchVideos({ q, site, page });

    if (!data.results.length && data.errors.length) {
      return res.status(502).json({
        status: "error",
        message: "All selected scrapers failed.",
        results: [],
        errors: data.errors
      });
    }

    return res.json(data);
  } catch (error) {
    console.error("Search error:", error.message);

    return res.status(500).json({
      status: "error",
      message: "Search failed.",
      results: []
    });
  }
});

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return next();
  }

  res.sendFile(
    path.join(__dirname, "public", "index.html"),
    (err) => {
      if (err) next(err);
    }
  );
});

// Express 5-compatible fallback error handler.
app.use((error, req, res, next) => {
  console.error(error.message);

  res.status(500).json({
    status: "error",
    message: "Internal server error."
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`VideoFinder listening on port ${PORT}`);
});
