const fs = require("fs/promises");
const cheerio = require("cheerio");

const BASE_URL = "https://www.wikiloc.com/trails/hiking/bangladesh/chittagong";
const START_PAGE = 1;
const END_PAGE = 52;
const OUTPUT_FILE = "trails.json";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function buildPageUrl(page) {
  return `${BASE_URL}?page=${page}`;
}

async function fetchHtml(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
        
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
          Accept: "text/html",
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      return await res.text();
    } catch (error) {
      console.log(`Attempt ${attempt} failed for ${url}: ${error.message}`);

      if (attempt === retries) {
        throw error;
      }

      await sleep(2000);
    }
  }
}

function extractTrails(html, page) {
  const $ = cheerio.load(html);
  const trails = [];

  $(".trail-card-with-description").each((_, element) => {
    const card = $(element);

    const name = card
      .find(".trail-card-with-description__title a")
      .text()
      .trim()
      .replace(/\s+/g, " ");

    const relativeUrl = card
      .find(".trail-card-with-description__title a")
      .attr("href");

    let distance = null;
    let elevation = null;

    card.find(".trail-card-with-description__detail__stats > div").each((_, stat) => {
      const label = $(stat)
        .find(".trail-card-with-description__detail__stats__name")
        .text()
        .trim();

      const value = $(stat)
        .find(".trail-card-with-description__detail__stats__value")
        .text()
        .trim();

      if (label === "Distance") {
        distance = value;
      }

      if (label.includes("Elevation")) {
        elevation = value;
      }
    });

    if (name) {
      trails.push({
        name,
        distance,
        elevation,
        page,
        url: relativeUrl ? `https://www.wikiloc.com${relativeUrl}` : null,
      });
    }
  });

  return trails;
}

async function main() {
  const allTrails = [];

  for (let page = START_PAGE; page <= END_PAGE; page++) {
    const url = buildPageUrl(page);
    console.log(`Scraping page ${page}: ${url}`);

    try {
      const html = await fetchHtml(url);
      const trails = extractTrails(html, page);

      console.log(`Found ${trails.length} trails on page ${page}`);
      allTrails.push(...trails);

      // Be polite. Do not hit the website too fast.
      await sleep(1500);
    } catch (error) {
      console.error(`Failed to scrape page ${page}: ${error.message}`);
    }
  }

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(allTrails, null, 2), "utf8");

  console.log(`Done. Saved ${allTrails.length} trails to ${OUTPUT_FILE}`);
}

main();