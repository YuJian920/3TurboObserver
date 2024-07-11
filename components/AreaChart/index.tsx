"use client";

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ResourceLoadTime } from "../Iterations";

const chartConfig = {
  withCache: {
    label: "withCache",
    color: "hsl(var(--chart-1))",
  },
  withoutCache: {
    label: "withoutCache",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

interface TimeAreaChartProps {
  date: ResourceLoadTime[];
}

export function TimeAreaChart({ date }: TimeAreaChartProps) {
  if (date.length === 0) return <></>;
  return (
    <ChartContainer config={chartConfig} style={{ height: "100%", width: "100%" }}>
      <AreaChart accessibilityLayer data={date} margin={{ left: 12, right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="url" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => value.split("/").pop()} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <defs>
          <linearGradient id="fillDesktop" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-withCache)" stopOpacity={0.8} />
            <stop offset="95%" stopColor="var(--color-withCache)" stopOpacity={0.1} />
          </linearGradient>
          <linearGradient id="fillMobile" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-withoutCache)" stopOpacity={0.8} />
            <stop offset="95%" stopColor="var(--color-withoutCache)" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <Area dataKey="withCache" type="natural" fill="url(#fillDesktop)" fillOpacity={0.4} stroke="var(--color-withCache)" stackId="a" />
        <Area
          dataKey="withoutCache"
          type="natural"
          fill="url(#fillMobile)"
          fillOpacity={0.4}
          stroke="var(--color-withoutCache)"
          stackId="a"
        />
      </AreaChart>
    </ChartContainer>
  );
}
