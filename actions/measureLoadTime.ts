"use server";

import fs from "node:fs";
import path from "node:path";
import { cwd } from "node:process";
import puppeteer from "puppeteer";

// 配置资源缓存目录
const cacheDir = path.join(cwd(), "cache");
if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir);

// 函数：测量页面加载时间
async function measureLoadTime(url: string, networkConfig: any, useCache: boolean) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  if (Object.keys(networkConfig).length !== 0) {
    const client = await page.target().createCDPSession();
    await client.send("Network.emulateNetworkConditions", networkConfig);
  }

  if (useCache) {
    await page.setRequestInterception(true);

    page.on("request", async (request) => {
      const url = new URL(request.url());
      const fileName = url.pathname.split("/").pop();
      const resourceType = request.resourceType();
      const cacheFilePath = path.join(cacheDir, fileName!);

      if (["script", "stylesheet", "image", "font"].includes(resourceType)) {
        if (fs.existsSync(cacheFilePath)) {
          const fileContent = fs.readFileSync(cacheFilePath);
          request.respond({
            status: 200,
            body: fileContent,
          });
        } else request.continue();
      } else {
        request.continue();
      }
    });
  }

  const startTime = Date.now();
  await page.goto(url, { waitUntil: "networkidle2" });
  const endTime = Date.now();

  await browser.close();

  return endTime - startTime;
}

export default measureLoadTime;
