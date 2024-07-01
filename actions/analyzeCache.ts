"use server";

import fs from "node:fs";
import path from "node:path";
import { cwd } from "node:process";
import puppeteer, { type ResourceType } from "puppeteer";

// 配置资源缓存目录
const cacheDir = path.join(cwd(), "cache");
if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir);

export interface AnalyzeResponse {
  url: string;
  startTime: number;
  responseReceived: number;
  responseTiming: Record<string, number>;
  endTime: number;
  duration: number;
}

interface AnalyzeCacheProps {
  (url: string, payload: { cacheOption: ResourceType[] }): Promise<AnalyzeResponse[]>;
}

/**
 * 预加载缓存
 * @param url 预加载的 URL
 * @param payload 预加载的配置
 */
const analyzeCache: AnalyzeCacheProps = async (url, payload) => {
  if (!url) return [];

  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();

  // await page.setRequestInterception(true);
  const networkRequests = new Map();

  page.on("request", async (request) => {
    const resourceType = request.resourceType();

    if (payload.cacheOption.includes(resourceType)) {
      networkRequests.set(request.url(), { url: request.url(), startTime: performance.now() });
    } else request.continue();
  });

  page.on("response", async (response) => {
    const request = networkRequests.get(response.url());
    const responseTiming = response.timing();

    if (request) {
      request.responseReceived = performance.now();
      request.responseTiming = responseTiming;
    }
  });

  page.on("requestfinished", (request) => {
    const requestDetails = networkRequests.get(request.url());

    if (requestDetails) {
      requestDetails.endTime = performance.now();
      requestDetails.duration = requestDetails.endTime - requestDetails.startTime;
    }
  });

  await page.goto(url, { waitUntil: "networkidle2" });
  const earliestStartTime = Math.min(...Array.from(networkRequests.values()).map((req) => req.startTime));

  const requestDetailsArray = Array.from(networkRequests.values()).map((req) => {
    return {
      ...req,
      startTime: req.startTime - earliestStartTime,
      responseReceived: req.responseReceived - earliestStartTime,
      endTime: req.endTime - earliestStartTime,
    };
  });

  await browser.close();
  return requestDetailsArray;
};

export default analyzeCache;
