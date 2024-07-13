"use server";

import { NetworkConfig } from "@/components/Network";
import { UserAgent } from "@/lib/utils";
import fs from "node:fs";
import path from "node:path";
import { cwd } from "node:process";
import puppeteer, { type Protocol } from "puppeteer";

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
}

interface AnalyzeCacheProps {
  (url: string, payload: { cacheOption: Protocol.Network.ResourceType[]; networkConfig?: NetworkConfig }): Promise<AnalyzeResponse[]>;
}

const analyzeCache: AnalyzeCacheProps = async (url, payload) => {
  if (!url) return [];
  const { cacheOption, networkConfig = {} } = payload;

  const browser = await puppeteer.launch({ headless: false, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setUserAgent(UserAgent);

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

  const networkRequests = new Map();

  client.on("Network.requestWillBeSent", async (event) => {
    if (event.type && cacheOption.includes(event.type)) {
      if (event.request.url.startsWith("data:")) return;
      const metrics = await client.send("Performance.getMetrics");
      const startTime = metrics.metrics.find((m) => m.name === "Timestamp")!.value * 1000;
      networkRequests.set(event.requestId, { url: event.request.url, startTime });
    }
  });

  client.on("Network.responseReceived", async (event) => {
    const request = networkRequests.get(event.requestId);
    if (request) {
      const metrics = await client.send("Performance.getMetrics");
      const responseReceived = metrics.metrics.find((m) => m.name === "Timestamp")!.value * 1000;
      request.responseReceived = responseReceived;
      request.responseTiming = event.response.timing;
    }
  });

  client.on("Network.loadingFinished", async (event) => {
    const request = networkRequests.get(event.requestId);
    if (request) {
      const metrics = await client.send("Performance.getMetrics");
      const endTime = metrics.metrics.find((m) => m.name === "Timestamp")!.value * 1000;
      request.endTime = endTime;
      request.duration = request.endTime - request.startTime;
      request.size = event.encodedDataLength;
    }
  });

  await page.goto(url, { waitUntil: "networkidle2" });

  const requestDetailsArray = Array.from(networkRequests.values());
  const earliestStartTime = Math.min(...requestDetailsArray.map((req) => req.startTime));

  const normalizedRequestDetails = requestDetailsArray.map((req) => ({
    ...req,
    startTime: req.startTime - earliestStartTime,
    responseReceived: req.responseReceived - earliestStartTime,
    endTime: req.endTime - earliestStartTime,
  }));

  await browser.close();
  return normalizedRequestDetails;
};

export default analyzeCache;
