"use server";

import puppeteer from "puppeteer";
import path from "node:path";
import { UserAgent } from "@/lib/utils";
import fs from "node:fs";
import { cwd } from "node:process";

// 配置资源缓存目录
const cacheDir = path.join(cwd(), "cache");
if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir);

async function measureLoadTime(url: string, networkConfig: any, useCache: boolean) {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  page.setUserAgent(UserAgent);

  const cachedResourceTimes: { [url: string]: [number, number?] } = {};

  if (Object.keys(networkConfig).length !== 0) {
    const client = await page.target().createCDPSession();
    await client.send("Network.emulateNetworkConditions", networkConfig);
  }

  await page.setRequestInterception(true);
  page.on("request", async (request) => {
    const url = new URL(request.url());
    const fileName = url.pathname.split("/").pop();
    const cacheFilePath = path.join(cacheDir, fileName ?? "");

    if (fileName && fs.existsSync(cacheFilePath)) {
      if (useCache) {
        const fileContent = fs.readFileSync(cacheFilePath);
        request.respond({ status: 200, body: fileContent });
      } else request.continue();
      cachedResourceTimes[request.url()] = [performance.now()];
    } else request.continue();
  });

  page.on("response", (response) => {
    const times = cachedResourceTimes[response.url()];
    if (times) {
      times[1] = performance.now();
    }
  });

  // 访问页面并等待网络空闲
  await page.goto(url, { waitUntil: "networkidle2" });

  // 使用 Performance API 获取页面加载时间
  const metrics = await page.evaluate(() =>
    JSON.stringify({
      navigationStart: performance.timing.navigationStart,
      loadEventEnd: performance.timing.loadEventEnd,
    })
  );

  await browser.close();

  // 计算缓存资源的加载时间
  const loadTimes: { [key: string]: number } = {};
  Object.keys(cachedResourceTimes).forEach((url) => {
    const times = cachedResourceTimes[url];
    if (times && times[1]) loadTimes[url] = times[1] - times[0];
  });

  const timings = JSON.parse(metrics);
  const pageLoadTime = timings.loadEventEnd - timings.navigationStart;

  return {
    pageLoadTime,
    cachedResourceLoadTimes: loadTimes,
  };
}

export default measureLoadTime;
