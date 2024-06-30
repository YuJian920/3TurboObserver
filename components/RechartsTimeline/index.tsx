import { AnalyzeResponse } from "@/actions/analyzeCache";
import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";

interface RechartsTimelineChartProps {
  data: AnalyzeResponse[];
}

const RechartsTimeline = ({ data }: RechartsTimelineChartProps) => {
  const { chartData, minStartTime, totalDuration } = useMemo(() => {
    if (!data || data.length === 0) {
      return { chartData: [], minStartTime: 0, totalDuration: 0 };
    }
    const minStart = Math.min(...data.map((item) => item.startTime));
    const maxEnd = Math.max(...data.map((item) => item.endTime));
    const total = maxEnd - minStart;

    const processed = data.map((item, index) => ({
      ...item,
      resource: item.url.split("/").pop(),
      normalizedStartTime: item.startTime - minStart,
      normalizedEndTime: item.endTime - minStart,
      index,
    }));

    return { chartData: processed, minStartTime: minStart, totalDuration: total };
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  const formatTime = (time: number) => `${time.toFixed(2)}ms`;

  const formatTimeToSecond = (time: number) => `${(time / 1000).toFixed(2)}s`;

  const safeTimeDiff = (end: any, start: any) => {
    if (typeof end === "number" && typeof start === "number" && end >= start) {
      return end - start;
    }
    return 0;
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const resource = payload[0].payload;
      const { responseTiming } = resource;
      return (
        <div className="bg-white border border-gray-300 p-2 rounded shadow-lg text-sm">
          <p>
            <strong>File:</strong> {resource.resource}
          </p>
          <p>
            <strong>URL:</strong> <span className="break-all">{resource.url}</span>
          </p>
          <p>
            <strong>Start Time:</strong> {formatTime(resource.startTime)}
          </p>
          <p>
            <strong>End Time:</strong> {formatTime(resource.endTime)}
          </p>
          <p>
            <strong>Duration:</strong> {formatTime(resource.duration)}
          </p>
          <p>
            <strong>Response Received:</strong> {formatTime(resource.responseReceived)}
          </p>
          <p>
            <strong>DNS Lookup:</strong> {formatTime(safeTimeDiff(responseTiming.dnsEnd, responseTiming.dnsStart))}
          </p>
          <p>
            <strong>Initial Connection:</strong> {formatTime(safeTimeDiff(responseTiming.connectEnd, responseTiming.connectStart))}
          </p>
          <p>
            <strong>SSL:</strong> {formatTime(safeTimeDiff(responseTiming.sslEnd, responseTiming.sslStart))}
          </p>
          <p>
            <strong>Request Sent:</strong> {formatTime(safeTimeDiff(responseTiming.sendEnd, responseTiming.sendStart))}
          </p>
          <p>
            <strong>Waiting (TTFB):</strong> {formatTime(safeTimeDiff(responseTiming.receiveHeadersEnd, responseTiming.sendEnd))}
          </p>
          <p>
            <strong>Content Download:</strong> {formatTime(safeTimeDiff(resource.endTime, resource.responseReceived))}
          </p>
        </div>
      );
    }
    return null;
  };

  // Calculate tick values for X-axis
  const xAxisTicks = [];
  const tickCount = 20; // Increased to 20 for more ticks
  for (let i = 0; i <= tickCount; i++) {
    xAxisTicks.push((totalDuration / tickCount) * i);
  }

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={false} />
          <XAxis
            type="number"
            domain={[0, totalDuration]}
            tickFormatter={(value) => formatTime(value + minStartTime)}
            ticks={xAxisTicks}
            interval={0} // Force all ticks to be rendered
          />
          <YAxis type="category" dataKey="index" hide />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="normalizedEndTime"
            fill="#3b82f6"
            shape={(props) => {
              const { x, y, width, height, normalizedStartTime, normalizedEndTime } = props;
              const barWidth = ((normalizedEndTime - normalizedStartTime) / totalDuration) * width;
              const barX = x + (normalizedStartTime / totalDuration) * width;
              return <rect x={barX} y={y} width={barWidth} height={height} fill="#3b82f6" />;
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RechartsTimeline;
