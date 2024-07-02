"use server";

import { NetworkConfig } from "@/components/Network";
import { UserAgent } from "@/lib/utils";
import fs from "node:fs";
import path from "node:path";
import { cwd } from "node:process";
import puppeteer, { type Protocol, type ResourceType } from "puppeteer";

// 配置资源缓存目录
const cacheDir = path.join(cwd(), "cache");
if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir);

export interface PreloaResponse {
  index: number;
  fileName: string;
  resourceType: ResourceType;
  size: number;
}

export interface PreloaResponseV2 {
  url: string;
  fileName: string;
  duration?: number;
  size: number;
  isCached?: boolean;
}

interface PreloadCachePayload {
  networkConfig?: NetworkConfig;
  resourceList: PreloaResponseV2[];
}

interface PreloadCacheProps {
  (url: string, payload: PreloadCachePayload): Promise<PreloaResponseV2[]>;
}

/**
 * 预加载缓存
 * @param url 预加载的 URL
 * @param payload 预加载的配置
 */
const preloadCacheAction: PreloadCacheProps = async (url, payload) => {
  if (!url) return [];
  const { networkConfig = {}, resourceList = [] } = payload;

  await deleteCacheAction();

  const responsePayload: PreloaResponseV2[] = [];
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  page.setUserAgent(UserAgent);

  if (Object.keys(networkConfig).length !== 0) {
    const client = await page.target().createCDPSession();
    await client.send("Network.emulateNetworkConditions", networkConfig as Protocol.Network.EmulateNetworkConditionsRequest);
  }

  await page.setRequestInterception(true);

  page.on("request", async (request) => {
    const url = new URL(request.url());
    const fileName = url.pathname.split("/").pop();

    if (!fileName) {
      request.continue();
      return;
    }

    const cacheFilePath = path.join(cacheDir, fileName);

    if (resourceList.some((item) => item.url === request.url())) {
      const response = await fetch(request.url());
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(cacheFilePath, buffer);
      responsePayload.push({ fileName, url: request.url(), size: buffer.length });
      request.respond({ status: 200, body: buffer });
    } else request.continue();
  });

  await page.goto(url, { waitUntil: "networkidle2" });
  await browser.close();

  return responsePayload;
};

/**
 * 删除缓存
 */
export const deleteCacheAction = async () => {
  fs.rmdirSync(cacheDir, { recursive: true });
  fs.mkdirSync(cacheDir);
};

/**
 * 获取预加载缓存列表
 * @returns
 */
export const getPreloadCacheList = async () => {
  const files = fs.readdirSync(cacheDir);
  return files.map((fileName, index) => {
    const filePath = path.join(cacheDir, fileName);
    const buffer = fs.readFileSync(filePath);
    const resourceType = fileName.split(".").pop();
    return { index, fileName, resourceType, size: buffer.length } as PreloaResponse;
  });
};

export default preloadCacheAction;
