"use client";

import { CheckCircledIcon, ReloadIcon } from "@radix-ui/react-icons";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "../ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from "@/components/ui/select";
import { useState, useEffect, useMemo } from "react";
import preloadCacheAction, { deleteCacheAction, getPreloadCacheList } from "@/actions/preloadCache";
import type { CacheType, FileType, CacheFileType, PreloadCachePayload, PreloaResponse } from "@/actions/preloadCache";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PreloadCacheProps {
  URL: string;
  setURL: (value: string) => void;
}

export default function PreloadCache({ URL, setURL }: PreloadCacheProps) {
  const [cacheType, setCacheType] = useState<CacheType>("option");
  const [cacheOption, setCacheOption] = useState<CacheFileType>(["script", "stylesheet", "image", "font"]);
  const [cacheRegx, setCacheRegx] = useState("");
  const [isPreLoading, setPreLoading] = useState(false);
  const [isDeleting, setDeleting] = useState(false);
  const [cacheList, setCacheList] = useState<PreloaResponse[]>([]);

  const preloadOptions = useMemo<{ name: string; key: FileType }[]>(
    () => [
      {
        name: "缓存 JavaScript 文件",
        key: "script",
      },
      {
        name: "缓存 CSS 文件",
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

  useEffect(() => {
    getPreloadCacheList().then((list) => {
      setCacheList(list);
    });
  }, []);

  /**
   * 预加载缓存
   */
  const handlePreloadCache = async () => {
    const payload: PreloadCachePayload = { cacheType, cacheOption, cacheRegx };

    try {
      setPreLoading(true);
      setCacheList([]);

      const result = await preloadCacheAction(URL, payload);
      setCacheList(result);
    } finally {
      setPreLoading(false);
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
  const handleCacheOptionChange = (value: boolean, key: FileType) => {
    if (value) setCacheOption([...cacheOption, key]);
    else setCacheOption(cacheOption.filter((item) => item !== key));
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-4xl font-bold">Preload Cache 控制</h1>
      <div className="flex items-center gap-5">
        <Input value={URL} onInput={(event) => setURL(event.currentTarget.value)} className="w-96" placeholder="输入目标 URL" />
        <Select value={cacheType} onValueChange={(value: CacheType) => setCacheType(value)}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="缓存行为" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {/* <SelectItem value="all">全部缓存</SelectItem> */}
              <SelectItem value="option">预设缓存</SelectItem>
              <SelectItem value="regx" disabled>正则匹配</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        {cacheType === "option" && (
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
        )}
        {cacheType === "regx" && (
          <div className="flex items-center gap-6">
            <Input value={cacheRegx} onInput={(event) => setCacheRegx(event.currentTarget.value)} placeholder="输入正则表达式" />
          </div>
        )}
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
      <ScrollArea data-hasvalue={cacheList.length !== 0} className="data-[hasvalue=false]:h-14 h-80 w-full">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>文件名称</TableHead>
              <TableHead>文件类型</TableHead>
              <TableHead className="text-right">文件大小</TableHead>
              {/* <TableHead className="text-right">命中缓存</TableHead> */}
            </TableRow>
          </TableHeader>
          <TableBody>
            {cacheList.map((mapItem) => (
              <TableRow key={mapItem.index}>
                <TableCell>{mapItem.fileName}</TableCell>
                <TableCell>{mapItem.resourceType}</TableCell>
                <TableCell className="text-right">{(mapItem.size / 1024).toFixed(1)} KB</TableCell>
                {/* <TableCell className="flex justify-end">
                  <CheckCircledIcon />
                </TableCell> */}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}
