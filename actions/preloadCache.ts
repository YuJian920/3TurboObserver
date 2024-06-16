"use server";

import fs from "node:fs";
import path from "node:path";
import { cwd } from "node:process";
import puppeteer, { HTTPRequest } from "puppeteer";

// 配置资源缓存目录
const cacheDir = path.join(cwd(), "cache");
if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir);

interface PreloadCacheProps {
  (url: string, payload: PreloadCachePayload): Promise<PreloaResponse[]>;
}

export interface PreloaResponse {
  index: number;
  fileName: string;
  resourceType: FileType;
  size: number;
}

export type CacheType = "all" | "option" | "regx";
export type FileType = "script" | "stylesheet" | "image" | "font";
export type CacheFileType = FileType[];

type CacheAll = { cacheType: "all" };
type CacheOption = { cacheType: "option"; cacheOption: CacheFileType };
type CacheRegx = { cacheType: "regx"; cacheRegx: string };
export type PreloadCachePayload = CacheAll | CacheOption | CacheRegx;

/**
 * 预加载缓存
 * @param url 预加载的 URL
 * @param payload 预加载的配置
 */
const preloadCacheAction: PreloadCacheProps = async (url, payload) => {
  if (!url) return [];

  const { cacheType } = payload;

  await deleteCacheAction();
  const responsePayload: PreloaResponse[] = [];
  const cacheOption: any[] = [];

  if (cacheType === "option") cacheOption.push(...payload.cacheOption);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.setRequestInterception(true);

  const loadCache = async (req: HTTPRequest, cacheFilePath: string, fileName: string, resourceType: any, index: number) => {
    const response = await fetch(req.url());
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(cacheFilePath, buffer);
    responsePayload.push({ index: ++index, fileName: fileName as string, resourceType: resourceType as FileType, size: buffer.length });
    req.respond({ status: 200, body: buffer });
  };

  let index = 0;
  page.on("request", async (request) => {
    const url = new URL(request.url());
    const fileName = url.pathname.split("/").pop();
    const resourceType = request.resourceType();
    const cacheFilePath = path.join(cacheDir, fileName!);

    if (cacheType === "all") loadCache(request, cacheFilePath, fileName as string, resourceType, index);
    else if (cacheType === "option") {
      if (cacheOption.includes(resourceType)) loadCache(request, cacheFilePath, fileName as string, resourceType, index);
      else request.continue();
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
    const resourceType = fileName.split(".").pop() as FileType;
    return { index, fileName, resourceType, size: buffer.length };
  });
};

export default preloadCacheAction;
