"use server";

import { UserAgent } from "@/lib/utils";
import fs from "node:fs";
import path from "node:path";
import { cwd } from "node:process";
import puppeteer, { type ResourceType } from "puppeteer";

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
  const { resourceList = [] } = payload;

  await deleteCacheAction();

  const responsePayload: PreloaResponseV2[] = [];
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  page.setUserAgent(UserAgent);

  page.on("response", async (response) => {
    const requestUrl = response.url();
    const fileName = new URL(requestUrl).pathname.split("/").pop();

    if (!fileName) return;

    if (resourceList.some((item) => item.url === requestUrl)) {
      const buffer = await response.buffer();
      const cacheFilePath = path.join(cacheDir, fileName);
      fs.writeFileSync(cacheFilePath, buffer);
      responsePayload.push({
        url: requestUrl,
        fileName,
        size: buffer.length,
        isCached: true,
      });
    }
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
