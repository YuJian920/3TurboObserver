"use server";

import puppeteer from "puppeteer";
import path from "node:path";
import { UserAgent } from "@/lib/utils";
import fs from "node:fs";
import { cwd } from "node:process";

const cacheDir = path.join(cwd(), "cache");
if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir);

async function measureLoadTime(url: string, networkConfig: any, useCache: boolean) {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setUserAgent(UserAgent);

  const client = await page.target().createCDPSession();
  await client.send("Network.enable");
  await client.send("Performance.enable");

  if (Object.keys(networkConfig).length !== 0) {
    await client.send("Network.emulateNetworkConditions", networkConfig);
  }

  const cachedResourceTimes: { [url: string]: { startTime?: number; endTime?: number } } = {};

  await page.setRequestInterception(true);
  page.on("request", async (request) => {
    const requestUrl = new URL(request.url());
    const fileName = requestUrl.pathname.split("/").pop();
    const cacheFilePath = path.join(cacheDir, fileName ?? "");

    if (fileName && fs.existsSync(cacheFilePath)) {
      if (useCache) {
        const fileContent = fs.readFileSync(cacheFilePath);
        await request.respond({ status: 200, body: fileContent });
      } else {
        await request.continue();
      }
      const metrics = await client.send("Performance.getMetrics");
      cachedResourceTimes[request.url()] = { startTime: metrics.metrics.find((m) => m.name === "Timestamp")!.value * 1000 };
    } else {
      await request.continue();
    }
  });

  client.on("Network.loadingFinished", async (event) => {
    const metrics = await client.send("Performance.getMetrics");
    const timestamp = metrics.metrics.find((m) => m.name === "Timestamp")!.value * 1000;

    const requestUrl = Object.keys(cachedResourceTimes).find(
      (url) => cachedResourceTimes[url].startTime && !cachedResourceTimes[url].endTime
    );

    if (requestUrl) {
      cachedResourceTimes[requestUrl].endTime = timestamp;
    }
  });

  const navigationStart = await page.evaluate(() => performance.timeOrigin);
  await page.goto(url, { waitUntil: "networkidle2" });

  const loadEventEnd = await page.evaluate(() => performance.timing.loadEventEnd);

  await browser.close();

  const loadTimes: { [key: string]: number } = {};
  Object.entries(cachedResourceTimes).forEach(([url, times]) => {
    if (times.startTime && times.endTime) {
      loadTimes[url] = times.endTime - times.startTime;
    }
  });

  const pageLoadTime = loadEventEnd - navigationStart;

  return {
    pageLoadTime,
    cachedResourceLoadTimes: loadTimes,
  };
}

export default measureLoadTime;
