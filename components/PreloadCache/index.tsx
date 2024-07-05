"use client";

import analyzeCache, { type AnalyzeResponse } from "@/actions/analyzeCache";
import preloadCacheAction, { type PreloaResponseV2, deleteCacheAction } from "@/actions/preloadCache";
import Timeline from "@/components/Timeline";
import TreeMap from "@/components/TreeMap";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChartIcon, PieChartIcon, ReloadIcon, CheckCircledIcon, QuestionMarkCircledIcon, TransformIcon } from "@radix-ui/react-icons";
import type { ResourceType } from "puppeteer";
import { useMemo, useState } from "react";
import type { NetworkConfig } from "../Network";

interface PreloadCacheProps {
  URL: string;
  setURL: (value: string) => void;
  networkControl: boolean;
  networkConfig: NetworkConfig;
}

export default function PreloadCache({ URL, setURL, networkControl, networkConfig }: PreloadCacheProps) {
  const [cacheOption, setCacheOption] = useState<ResourceType[]>(["script", "stylesheet", "image", "font"]);
  const [isPreLoading, setPreLoading] = useState(false);
  const [isAnalyzeLoading, setAnalyzeLoading] = useState(false);
  const [isDeleting, setDeleting] = useState(false);
  const [cacheList, setCacheList] = useState<PreloaResponseV2[]>([]);
  const [analyzeList, setAnalyzeList] = useState<AnalyzeResponse[]>([]);

  const preloadOptions = useMemo<{ name: string; key: ResourceType }[]>(
    () => [
      {
        name: "缓存 JavaScript",
        key: "script",
      },
      {
        name: "缓存 CSS",
        key: "stylesheet",
      },
      {
        name: "缓存图片",
        key: "image",
      },
      {
        name: "缓存字体",
        key: "font",
      },
    ],
    []
  );

  const addPreloadCache = async (fileData: AnalyzeResponse) => {
    const index = cacheList.findIndex((item) => item.url === fileData.url);
    if (index !== -1) {
      setCacheList((prev) => {
        const next = [...prev];
        next.splice(index, 1);
        return next;
      });
    } else {
      setCacheList((prev) => [
        ...prev,
        { url: fileData.url, fileName: fileData.url.split("/").pop() || "", size: fileData.size, duration: fileData.duration },
      ]);
    }
  };

  /**
   * 预加载缓存
   */
  const handlePreloadCache = async () => {
    try {
      setPreLoading(true);
      const result = await preloadCacheAction(URL, { resourceList: cacheList });

      // 将 result 和 cacheList 进行对比，缓存成功则在 cacheList 对应的项中添加 isCached 标记
      setCacheList((prev) =>
        prev.map((item) => {
          const index = result.findIndex((resultItem) => resultItem.url === item.url);
          if (index !== -1) return { ...item, isCached: true };
          return item;
        })
      );
    } finally {
      setPreLoading(false);
    }
  };

  /**
   * 分析缓存
   */
  const handleAnalyzeloadCache = async () => {
    try {
      setAnalyzeLoading(true);
      const result = await analyzeCache(URL, { cacheOption, networkConfig: networkControl ? networkConfig : undefined });
      setAnalyzeList(result);
    } finally {
      setAnalyzeLoading(false);
    }
  };

  /**
   * 删除缓存
   */
  const handleDeleteCache = async () => {
    try {
      setDeleting(true);
      await deleteCacheAction();
      setCacheList([]);
    } finally {
      setDeleting(false);
    }
  };

  /**
   * 缓存选项变更
   * @param value
   * @param key
   */
  const handleCacheOptionChange = (value: boolean, key: ResourceType) => {
    if (value) setCacheOption([...cacheOption, key]);
    else setCacheOption(cacheOption.filter((item) => item !== key));
  };

  /**
   * 全选
   */
  const handleAllSelect = () => {
    if (cacheList.length === analyzeList.length) {
      setCacheList([]);
    } else {
      setCacheList(
        analyzeList.map((item) => ({ url: item.url, fileName: item.url.split("/").pop() || "", size: item.size, duration: item.duration }))
      );
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-4xl font-bold">Preload Cache 控制</h1>
      <div className="flex items-center gap-5">
        <Input value={URL} onInput={(event) => setURL(event.currentTarget.value)} className="w-96" placeholder="输入目标 URL" />
        <div className="flex items-center gap-6">
          {preloadOptions.map((mapItem) => {
            return (
              <div key={mapItem.key} className="flex items-center gap-2">
                <Checkbox
                  checked={cacheOption.includes(mapItem.key)}
                  onCheckedChange={(value: boolean) => {
                    handleCacheOptionChange(value, mapItem.key);
                  }}
                />
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  {mapItem.name}
                </label>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4">
          <Button onClick={handleAnalyzeloadCache} disabled={isAnalyzeLoading}>
            {isAnalyzeLoading && <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />}
            Analyze Cache
          </Button>
          <Button onClick={handleDeleteCache} variant="destructive" disabled={isDeleting}>
            {isDeleting && <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />}
            删除缓存
          </Button>
        </div>
      </div>
      {analyzeList.length > 0 && (
        <>
          <div className="flex gap-4">
            <Drawer>
              <DrawerTrigger asChild>
                <Button className="w-20 h-20" variant="outline">
                  <BarChartIcon width="3rem" height="3rem" />
                </Button>
              </DrawerTrigger>
              <DrawerContent>
                <DrawerHeader>
                  <div className="flex justify-between">
                    <div>
                      <DrawerTitle>Resource Download Timeline</DrawerTitle>
                      <DrawerDescription>选择需要缓存的静态资源后点击 Preload Cache 按钮即可开始缓存</DrawerDescription>
                    </div>
                    <div className="flex gap-4">
                      <Button onClick={handleAllSelect} variant="ghost">
                        <TransformIcon className="h-4 w-4" />
                      </Button>
                      <Button onClick={handlePreloadCache} disabled={isPreLoading} className="gap-2">
                        {isPreLoading && <ReloadIcon className="h-4 w-4 animate-spin" />}
                        Preload Cache
                      </Button>
                      <Button onClick={handleDeleteCache} variant="destructive" disabled={isDeleting} className="gap-2">
                        {isDeleting && <ReloadIcon className="h-4 w-4 animate-spin" />}
                        删除缓存
                      </Button>
                    </div>
                  </div>
                </DrawerHeader>
                <ScrollArea className="h-[80vh] w-full">
                  <Timeline data={analyzeList} handleClick={addPreloadCache} selected={cacheList} />
                </ScrollArea>
              </DrawerContent>
            </Drawer>
            <Drawer>
              <DrawerTrigger asChild>
                <Button className="w-20 h-20" variant="outline">
                  <PieChartIcon width="3rem" height="3rem" />
                </Button>
              </DrawerTrigger>
              <DrawerContent>
                <DrawerHeader>
                  <div className="flex justify-between">
                    <div>
                      <DrawerTitle>Resource Download TreeMap</DrawerTitle>
                      <DrawerDescription>选择需要缓存的静态资源后点击 Preload Cache 按钮即可开始缓存</DrawerDescription>
                    </div>
                    <div className="flex gap-4">
                      <Button onClick={handlePreloadCache} disabled={isPreLoading}>
                        {isPreLoading && <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />}
                        Preload Cache
                      </Button>
                      <Button onClick={handleDeleteCache} variant="destructive" disabled={isDeleting}>
                        {isDeleting && <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />}
                        删除缓存
                      </Button>
                    </div>
                  </div>
                </DrawerHeader>
                <div className="h-[80vh] w-full">
                  <TreeMap data={analyzeList} />
                </div>
              </DrawerContent>
            </Drawer>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>文件名称</TableHead>
                <TableHead>请求时长</TableHead>
                <TableHead>文件大小</TableHead>
                <TableHead className="text-right">已缓存</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cacheList.map((mapItem) => (
                <TableRow key={mapItem.url}>
                  <TableCell className="max-w-[200px]">{mapItem.url.split("/").pop()}</TableCell>
                  <TableCell>{mapItem.duration?.toFixed(2) || 0} ms</TableCell>
                  <TableCell>{(mapItem.size / 1024).toFixed(1)} KB</TableCell>
                  <TableCell className="flex justify-end">
                    <div>{mapItem.isCached ? <CheckCircledIcon /> : <QuestionMarkCircledIcon />}</div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  );
}
