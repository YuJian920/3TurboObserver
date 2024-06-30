"use server";

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

interface PreloadCacheProps {
  (url: string, payload: { cacheOption: ResourceType[] }): Promise<PreloaResponse[]>;
}

/**
 * 预加载缓存
 * @param url 预加载的 URL
 * @param payload 预加载的配置
 */
const preloadCacheAction: PreloadCacheProps = async (url, payload) => {
  if (!url) return [];

  await deleteCacheAction();

  const responsePayload: PreloaResponse[] = [];
  const browser = await puppeteer.launch({ headless: false, args: ["--no-sandbox"] });
  const page = await browser.newPage();

  await page.setRequestInterception(true);

  let index = 0;
  page.on("request", async (request) => {
    const url = new URL(request.url());
    const fileName = url.pathname.split("/").pop();

    if (!fileName) {
      request.continue();
      return;
    }

    const resourceType = request.resourceType();
    const cacheFilePath = path.join(cacheDir, fileName);

    if (payload.cacheOption.includes(resourceType)) {
      const response = await fetch(request.url());
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(cacheFilePath, buffer);
      responsePayload.push({ index: ++index, fileName, resourceType, size: buffer.length });
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
