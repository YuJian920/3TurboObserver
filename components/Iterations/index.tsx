"use client";

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import type { NetworkConfig } from "@/components/Network";
import { ReloadIcon, InfoCircledIcon, PieChartIcon } from "@radix-ui/react-icons";
import measureLoadTime from "@/actions/measureLoadTime";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { TimeAreaChart } from "@/components/AreaChart";

interface IterationsProps {
  URL: string;
  networkControl: boolean;
  networkConfig: NetworkConfig;
}

interface LoadTimeWithCache {
  index: number;
  loadTimeWithCache: number;
  loadTimeWithoutCache: number;
}

export interface ResourceLoadTime {
  url: string;
  withCache: number | undefined;
  withoutCache: number | undefined;
}

export default function Iterations({ URL, networkControl, networkConfig }: IterationsProps) {
  const [iterationsWithoutCache, setIterationsWithoutCache] = useState(true);
  const [iterations, setIterations] = useState("1");
  const [isIterating, setIsIterating] = useState(false);
  const [loadTimeData, setLoadTimeData] = useState<LoadTimeWithCache[]>([]);
  const [mergedResults, setMergedResults] = useState<ResourceLoadTime[]>([]);

  const mergeLoadTimes = (
    loadTimeWithCache: { [key: string]: number },
    loadTimeWithoutCache: { [key: string]: number }
  ): ResourceLoadTime[] => {
    // 创建一个新的映射，以统一处理有缓存和无缓存的情况
    const mergedResults: { [key: string]: ResourceLoadTime } = {};

    // 遍历有缓存的加载时间
    Object.keys(loadTimeWithCache).forEach((url) => {
      if (!mergedResults[url]) {
        mergedResults[url] = { url, withCache: undefined, withoutCache: undefined };
      }
      mergedResults[url].withCache = loadTimeWithCache[url];
    });

    // 遍历无缓存的加载时间
    Object.keys(loadTimeWithoutCache).forEach((url) => {
      if (!mergedResults[url]) {
        mergedResults[url] = { url, withCache: undefined, withoutCache: undefined };
      }
      mergedResults[url].withoutCache = loadTimeWithoutCache[url];
    });

    // 将结果转换为数组形式
    return Object.values(mergedResults);
  };

  /**
   * 开始迭代
   */
  const handleStartIterations = async () => {
    try {
      setIsIterating(true);

      const _loadTimeData = [];

      for (let i = 0; i < Number(iterations); i++) {
        const [loadTimeWithCache, loadTimeWithoutCache] = await Promise.all([
          measureLoadTime(URL, networkControl ? networkConfig : {}, true),
          iterationsWithoutCache ? measureLoadTime(URL, networkControl ? networkConfig : {}, false) : Promise.resolve(null),
        ]);

        const mergedResults = mergeLoadTimes(
          loadTimeWithCache.cachedResourceLoadTimes ?? {},
          loadTimeWithoutCache?.cachedResourceLoadTimes ?? {}
        );

        console.log("mergedResults", mergedResults);
        console.log("loadTimeWithCache", loadTimeWithCache);
        console.log("loadTimeWithoutCache", loadTimeWithoutCache);

        _loadTimeData.push({
          index: i + 1,
          loadTimeWithCache: loadTimeWithCache.pageLoadTime,
          loadTimeWithoutCache: loadTimeWithoutCache?.pageLoadTime ?? null,
        } as LoadTimeWithCache);
        setLoadTimeData([..._loadTimeData]);
        setMergedResults(mergedResults);
      }
    } finally {
      setIsIterating(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-4xl font-bold">Puppeteer 控制</h1>
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-3">
          <Label>迭代次数</Label>
          <Select value={iterations} onValueChange={(value: string) => setIterations(value)}>
            <SelectTrigger className="w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="6">6</SelectItem>
                <SelectItem value="7">7</SelectItem>
                <SelectItem value="8">9</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <InfoCircledIcon />
                </TooltipTrigger>
                <TooltipContent>
                  <p>默认情况下会根据 Preload Cache 控制中的已缓存列表来进行静态资源重定向，</p>
                  <p>勾选同时迭代无缓存会同时进行完全不使用缓存的网页请求流程。</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            同时迭代无缓存
          </Label>
          <Switch checked={iterationsWithoutCache} onCheckedChange={(value) => setIterationsWithoutCache(value)} />
        </div>
        <Button onClick={handleStartIterations} disabled={isIterating}>
          {isIterating && <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />}
          开始迭代
        </Button>
      </div>
      <div className="flex space-x-28">
        <Table>
          <TableCaption>有缓存迭代结果</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>迭代次数</TableHead>
              <TableHead>有缓存网络延迟</TableHead>
              <TableHead>无缓存网络延迟</TableHead>
              <TableHead>优化效率</TableHead>
              <TableHead className="text-right">优化图表</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadTimeData.map((mapItem) => (
              <TableRow key={mapItem.index}>
                <TableCell>第 {mapItem.index} 次</TableCell>
                <TableCell>{mapItem.loadTimeWithCache} ms</TableCell>
                <TableCell>{mapItem.loadTimeWithoutCache} ms</TableCell>
                <TableCell>
                  {(((mapItem.loadTimeWithoutCache - mapItem.loadTimeWithCache) / mapItem.loadTimeWithoutCache) * 100).toFixed(2)} %
                </TableCell>
                <TableCell className="text-right">
                  <Drawer>
                    <DrawerTrigger asChild>
                      <Button variant="outline" size="sm">
                        <PieChartIcon />
                      </Button>
                    </DrawerTrigger>
                    <DrawerContent>
                      <DrawerHeader>
                        <div className="flex justify-between">
                          <div>
                            <DrawerTitle>Resource Optimize Charts</DrawerTitle>
                            <DrawerDescription>用于可视化的观察各个静态资源的缓存优化情况</DrawerDescription>
                          </div>
                        </div>
                      </DrawerHeader>
                      <div className="h-[80vh] w-full">
                        <TimeAreaChart date={mergedResults} />
                      </div>
                    </DrawerContent>
                  </Drawer>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
