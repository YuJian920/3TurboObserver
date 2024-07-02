import React, { useRef, useEffect, useState } from "react";
import type { AnalyzeResponse } from "@/actions/analyzeCache";

interface TimelineChartProps {
  data: AnalyzeResponse[];
  handleClick: (fileData: AnalyzeResponse) => void;
  selected: AnalyzeResponse[] | null;
}

const TimelineChart = ({ data, handleClick, selected }: TimelineChartProps) => {
  const svgRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoveredResource, setHoveredResource] = useState<AnalyzeResponse | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const barHeight = 30;
  const margin = { top: 20, right: 30, bottom: 30, left: 50 };
  const tooltipWidth = 300;
  const tooltipHeight = 280;

  useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        setDimensions({ width, height });
      }
    });

    if (svgRef.current) resizeObserver.observe(svgRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  if (!data || data.length === 0) {
    return (
      <div ref={svgRef} className="w-full h-full flex items-center justify-center bg-gray-100">
        <p className="text-gray-500">No data available</p>
      </div>
    );
  }

  // 归一化时间轴
  const minStartTime = Math.min(...data.map((item) => item.startTime));
  const maxEndTime = Math.max(...data.map((item) => item.endTime || 0));
  const totalDuration = maxEndTime - minStartTime;

  /**
   * 归一化时间轴
   * @param time
   * @returns
   */
  const normalizeTime = (time: number) => (time - minStartTime) / totalDuration;

  /**
   * 获取X轴坐标
   * @param time
   * @returns
   */
  const getX = (time: number) => normalizeTime(time) * (dimensions.width - margin.left - margin.right) + margin.left;

  const chartHeight = Math.max(data.length * (barHeight + 10) + margin.top + margin.bottom, dimensions.height);

  /**
   * 格式化时间
   * @param time
   * @returns
   */
  const formatTime = (time: number) => `${time.toFixed(2)}ms`;

  /**
   * 格式化时间为秒
   * @param time
   * @returns
   */
  const formatTimeToSecond = (time: number) => `${(time / 1000).toFixed(2)}s`;

  /**
   * 安全时间差
   * @param end
   * @param start
   * @returns
   */
  const safeTimeDiff = (end: any, start: any) => {
    if (typeof end === "number" && typeof start === "number") {
      return end - start;
    }
    if (typeof end === "string" && typeof start === "string") {
      return Number(end) - Number(start);
    }

    return 0;
  };

  /**
   * 鼠标进入事件
   * @param event
   * @param resource
   */
  const handleMouseEnter = (event: React.MouseEvent<SVGGElement, MouseEvent>, resource: AnalyzeResponse) => {
    setHoveredResource(resource);
    updateTooltipPosition(event);
  };

  /**
   * 鼠标离开事件
   */
  const handleMouseLeave = () => {
    setHoveredResource(null);
  };

  /**
   * 鼠标移动事件
   * @param event
   */
  const handleMouseMove = (event: React.MouseEvent<SVGGElement, MouseEvent>) => {
    if (hoveredResource) {
      updateTooltipPosition(event);
    }
  };

  /**
   * 更新提示框位置
   * @param event
   */
  const updateTooltipPosition = (event: React.MouseEvent<SVGGElement, MouseEvent>) => {
    if (svgRef.current) {
      const svgRect = svgRef.current.getBoundingClientRect();
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

      let x = event.pageX - svgRect.left - scrollLeft + 10;
      let y = event.pageY - svgRect.top - scrollTop + 10;

      if (x + tooltipWidth > svgRect.width) {
        x = svgRect.width - tooltipWidth - 10;
      }

      if (y + tooltipHeight > svgRect.height) {
        y = svgRect.height - tooltipHeight - 10;
      }

      x = Math.max(0, x);
      y = Math.max(0, y);

      setTooltipPosition({ x, y });
    }
  };

  // Generate more tick values for X-axis and grid lines
  const xAxisTicks = [];
  const tickCount = 20; // Increased number of ticks
  for (let i = 0; i <= tickCount; i++) {
    xAxisTicks.push((totalDuration / tickCount) * i);
  }

  return (
    <div className="relative w-full h-full overflow-hidden" ref={svgRef}>
      <svg width="100%" height="100%" viewBox={`0 0 ${dimensions.width} ${chartHeight}`}>
        {/* Vertical grid lines */}
        {xAxisTicks.map((tick) => (
          <line
            key={tick}
            x1={getX(minStartTime + tick)}
            y1={margin.top}
            x2={getX(minStartTime + tick)}
            y2={chartHeight - margin.bottom}
            stroke="#e5e7eb"
            strokeWidth="1"
            strokeDasharray="4,4" // This creates the dashed line effect
          />
        ))}

        {data.map((item, index) => (
          <g
            key={item.url}
            transform={`translate(0, ${index * (barHeight + 10) + margin.top})`}
            onMouseEnter={(e) => handleMouseEnter(e, item)}
            onMouseLeave={handleMouseLeave}
            onMouseMove={handleMouseMove}
            onClick={() => handleClick(item)}
          >
            <rect
              x={margin.left}
              y="0"
              width={dimensions.width - margin.left - margin.right}
              height={barHeight}
              fill="#f3f4f6"
              // opacity={hoveredResource === item ? 0.5 : 0}
              opacity={selected?.includes(item) ? 0.5 : hoveredResource === item ? 0.5 : 0}
            />
            <rect
              x={getX(item.startTime)}
              y="0"
              width={getX(item.endTime) - getX(item.startTime)}
              height={barHeight}
              style={{ fill: "hsl(var(--foreground))", opacity: 0.9 }}
              rx="5"
              ry="5"
              opacity={0.8}
            />
            <text x={getX(item.endTime) + 5} y={barHeight / 2} dy=".35em" className="text-sm">
              {formatTime(safeTimeDiff(item.duration, 0))}
            </text>
          </g>
        ))}

        <line
          x1={margin.left}
          y1={chartHeight - margin.bottom}
          x2={dimensions.width - margin.right}
          y2={chartHeight - margin.bottom}
          stroke="black"
        />
        {xAxisTicks.map((tick) => (
          <g key={tick} transform={`translate(${getX(minStartTime + tick)}, ${chartHeight - margin.bottom})`}>
            <line y2="5" stroke="black" />
            <text y="20" textAnchor="middle" className="text-sm">
              {formatTimeToSecond(safeTimeDiff(tick, 0))}
            </text>
          </g>
        ))}
      </svg>
      {hoveredResource && (
        <div
          className="absolute bg-white border border-gray-300 p-2 rounded shadow-lg text-sm"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            width: `${tooltipWidth}px`,
            maxHeight: `${tooltipHeight}px`,
            overflowY: "auto",
          }}
        >
          <div>
            <strong>URL:</strong> <span className="break-all">{hoveredResource.url}</span>
          </div>
          <p>
            <strong>Start Time:</strong> {formatTime(safeTimeDiff(hoveredResource.startTime - minStartTime, 0))}
          </p>
          <p>
            <strong>End Time:</strong> {formatTime(safeTimeDiff(hoveredResource.endTime - minStartTime, 0))}
          </p>
          <p>
            <strong>Duration:</strong> {formatTime(safeTimeDiff(hoveredResource.duration, 0))}
          </p>
          <p>
            <strong>Response Received:</strong> {formatTime(safeTimeDiff(hoveredResource.responseReceived - minStartTime, 0))}
          </p>
          <p>
            <strong>DNS Lookup:</strong>
            {formatTime(safeTimeDiff(hoveredResource.responseTiming?.dnsEnd, hoveredResource.responseTiming?.dnsStart))}
          </p>
          <p>
            <strong>Initial Connection:</strong>
            {formatTime(safeTimeDiff(hoveredResource.responseTiming?.connectEnd, hoveredResource.responseTiming?.connectStart))}
          </p>
          <p>
            <strong>SSL:</strong>{" "}
            {formatTime(safeTimeDiff(hoveredResource.responseTiming?.sslEnd, hoveredResource.responseTiming?.sslStart))}
          </p>
          <p>
            <strong>Request Sent:</strong>
            {formatTime(safeTimeDiff(hoveredResource.responseTiming?.sendEnd, hoveredResource.responseTiming?.sendStart))}
          </p>
          <p>
            <strong>Waiting (TTFB):</strong>
            {formatTime(safeTimeDiff(hoveredResource.responseTiming?.receiveHeadersEnd, hoveredResource.responseTiming?.sendEnd))}
          </p>
          <p>
            <strong>Content Download:</strong> {formatTime(safeTimeDiff(0, hoveredResource.endTime - hoveredResource.responseReceived))}
          </p>
        </div>
      )}
    </div>
  );
};

export default TimelineChart;
