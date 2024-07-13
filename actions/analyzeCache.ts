"use server";

import { NetworkConfig } from "@/components/Network";
import { UserAgent } from "@/lib/utils";
import fs from "node:fs";
import path from "node:path";
import { cwd } from "node:process";
import puppeteer, { type Protocol, Browser, Page } from "puppeteer";
import puppeteerHar from "puppeteer-har";

const cacheDir = path.join(cwd(), "cache");
if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir);

export interface AnalyzeResponse {
  url: string;
  startTime: number;
  responseReceived: number;
  responseTiming: Protocol.Network.ResourceTiming | undefined;
  endTime: number;
  duration: number;
  size: number;
  isContentLength: boolean;
}

interface AnalyzeCacheProps {
  (url: string, payload: { cacheOption: Protocol.Network.ResourceType[]; networkConfig?: NetworkConfig }): Promise<AnalyzeResponse[]>;
}

const analyzeCache: AnalyzeCacheProps = async (url, payload) => {
  if (!url) throw new Error("URL is required");
  if (!isValidUrl(url)) throw new Error("Invalid URL provided");

  const { cacheOption, networkConfig = {} } = payload;
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
    page = await browser.newPage();
    await page.setUserAgent(UserAgent);

    const har = new puppeteerHar(page);
    await har.start({ path: path.join(cacheDir, "trace.har") });

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
    await client.send("Network.enable");
    await client.send("Performance.enable");

    if (Object.keys(networkConfig).length !== 0) {
      await client.send("Network.emulateNetworkConditions", networkConfig as Protocol.Network.EmulateNetworkConditionsRequest);
    }

    const networkRequests = new Map<string, Partial<AnalyzeResponse>>();

    client.on("Network.requestWillBeSent", async (event) => {
      if (event.type && cacheOption.includes(event.type)) {
        if (event.request.url.startsWith("data:") || event.request.url.startsWith("blob:")) return;
        const metrics = await client.send("Performance.getMetrics");
        const startTime = metrics.metrics.find((m) => m.name === "Timestamp")?.value ?? 0;
        networkRequests.set(event.requestId, { url: event.request.url, startTime: startTime * 1000 });
      }
    });

    client.on("Network.responseReceived", async (event) => {
      const request = networkRequests.get(event.requestId);
      if (request) {
        const metrics = await client.send("Performance.getMetrics");
        const responseReceived = metrics.metrics.find((m) => m.name === "Timestamp")?.value ?? 0;
        request.responseReceived = responseReceived * 1000;
        request.responseTiming = event.response.timing;

        request.size = event.response.headers["Content-Length"] ? parseInt(event.response.headers["Content-Length"]) : 0;
      }
    });

    client.on("Network.loadingFinished", async (event) => {
      const request = networkRequests.get(event.requestId);
      if (request) {
        const metrics = await client.send("Performance.getMetrics");
        const endTime = metrics.metrics.find((m) => m.name === "Timestamp")?.value ?? 0;
        request.endTime = endTime * 1000;
        request.duration = request.endTime - (request.startTime ?? 0);

        if (request.size === undefined || request.size <= 0) {
          request.size = event.encodedDataLength;
          request.isContentLength = false;
        }
      }
    });

    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    const requestDetailsArray = Array.from(networkRequests.values());
    const earliestStartTime = Math.min(...requestDetailsArray.map((req) => req.startTime ?? Infinity));

    const normalizedRequestDetails = requestDetailsArray.map((req) => ({
      ...req,
      startTime: (req.startTime ?? 0) - earliestStartTime,
      responseReceived: (req.responseReceived ?? 0) - earliestStartTime,
      endTime: (req.endTime ?? 0) - earliestStartTime,
    })) as AnalyzeResponse[];

    await har.stop();

    return normalizedRequestDetails;
  } catch (error) {
    console.error("Error in analyzeCache:", error);
    throw error;
  } finally {
    if (page) await page.close();
    if (browser) await browser.close();
  }
};

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export default analyzeCache;
