const fs = require("fs/promises");
const { chromium } = require("playwright");

const BASE_URL = "https://www.wikiloc.com/trails/hiking/bangladesh";
const START_PAGE = 1;
const END_PAGE = 70;
const OUTPUT_FILE = "trails.json";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function buildPageUrl(page) {
  return `${BASE_URL}?page=${page}`;
}

async function main() {
  const browser = await chromium.launch({
    headless: false, // keep false first time so you can see what happens
  });

  const page = await browser.newPage();

  const allTrails = [];

  for (let pageNumber = START_PAGE; pageNumber <= END_PAGE; pageNumber++) {
    const url = buildPageUrl(pageNumber);

    console.log(`Scraping page ${pageNumber}: ${url}`);

    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });

      await page.waitForTimeout(3000);

      const blockedText = await page.locator("body").innerText();

      if (
        blockedText.includes("403") ||
        blockedText.toLowerCase().includes("access denied") ||
        blockedText.toLowerCase().includes("forbidden")
      ) {
        console.log(`Page ${pageNumber} appears blocked. Skipping.`);
        continue;
      }

      await page.waitForSelector(".trail-card-with-description", {
        timeout: 20000,
      });

      const trails = await page.$$eval(
        ".trail-card-with-description",
        (cards, pageNumber) => {
          return cards
            .map((card) => {
              const titleEl = card.querySelector(
                ".trail-card-with-description__title a"
              );

              const name = titleEl?.innerText?.trim().replace(/\s+/g, " ") || null;
              const href = titleEl?.getAttribute("href") || null;

              let distance = null;
              let elevation = null;

              const statRows = card.querySelectorAll(
                ".trail-card-with-description__detail__stats > div"
              );

              statRows.forEach((row) => {
                const label = row
                  .querySelector(".trail-card-with-description__detail__stats__name")
                  ?.innerText?.trim();

                const value = row
                  .querySelector(".trail-card-with-description__detail__stats__value")
                  ?.innerText?.trim();

                if (label === "Distance") {
                  distance = value;
                }

                if (label && label.includes("Elevation")) {
                  elevation = value;
                }
              });

              if (!name) return null;

              return {
                name,
                distance,
                elevation,
                page: pageNumber,
                url: href ? `https://www.wikiloc.com${href}` : null,
              };
            })
            .filter(Boolean);
        },
        pageNumber
      );

      console.log(`Found ${trails.length} trails on page ${pageNumber}`);

      allTrails.push(...trails);

      await fs.writeFile(
        OUTPUT_FILE,
        JSON.stringify(allTrails, null, 2),
        "utf8"
      );

      await sleep(4000);
    } catch (error) {
      console.log(`Failed page ${pageNumber}: ${error.message}`);

      const html = await page.content();
      await fs.writeFile(`debug-page-${pageNumber}.html`, html, "utf8");
    }
  }

  await browser.close();

  console.log(`Done. Saved ${allTrails.length} trails to ${OUTPUT_FILE}`);
}

main();