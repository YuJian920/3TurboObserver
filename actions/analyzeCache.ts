"use server";

import { NetworkConfig } from "@/components/Network";
import { UserAgent } from "@/lib/utils";
import fs from "node:fs";
import path from "node:path";
import { cwd } from "node:process";
import puppeteer, { Protocol, type ResourceType } from "puppeteer";
import PuppeteerHar from "puppeteer-har";

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
  size: number;
  gzipSize?: number;
}

interface AnalyzeCacheProps {
  (url: string, payload: { cacheOption: ResourceType[]; networkConfig?: NetworkConfig }): Promise<AnalyzeResponse[]>;
}

/**
 * 预加载缓存
 * @param url 预加载的 URL
 * @param payload 预加载的配置
 */
const analyzeCache: AnalyzeCacheProps = async (url, payload) => {
  if (!url) return [];
  const { cacheOption, networkConfig = {} } = payload;

  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  page.setUserAgent(UserAgent);

  // 切换语言
  // await page.evaluateOnNewDocument(() => {
  //   Object.defineProperty(navigator, "language", {
  //     get: function () {
  //       return "id-ID";
  //     },
  //   });
  //   Object.defineProperty(navigator, "languages", {
  //     get: function () {
  //       return ["id-ID", "id"];
  //     },
  //   });
  // });

  const client = await page.target().createCDPSession();
  if (Object.keys(networkConfig).length !== 0) {
    await client.send("Network.emulateNetworkConditions", networkConfig as Protocol.Network.EmulateNetworkConditionsRequest);
  }

  const networkRequests = new Map();

  // await page.setRequestInterception(true);
  page.on("request", async (request) => {
    const resourceType = request.resourceType();

    if (cacheOption.includes(resourceType)) {
      if (request.url().startsWith("data:")) return request.continue();
      networkRequests.set(request.url(), { url: request.url(), startTime: performance.now() });
    } else request.continue();
  });

  page.on("response", async (response) => {
    const request = networkRequests.get(response.url());
    const responseTiming = response.timing();

    if (request) {
      const buffer = await response.buffer();
      request.size = buffer.length; // 添加资源大小
      request.responseTiming = responseTiming;
      request.responseReceived = performance.now();
    }
  });

  page.on("requestfinished", async (request) => {
    const requestDetails = networkRequests.get(request.url());

    if (requestDetails) {
      requestDetails.endTime = performance.now();
      requestDetails.duration = requestDetails.endTime - requestDetails.startTime;

      const response = await request.response();
      const headers = response?.headers() || {};
      if (headers["content-encoding"] === "gzip") requestDetails.gzipSize = +headers["content-length"];
    }
  });

  const har = new PuppeteerHar(page);
  await har.start({ path: path.join(cacheDir, "cache.har") });

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

  await har.stop();
  await browser.close();

  return requestDetailsArray;
};

export default analyzeCache;
