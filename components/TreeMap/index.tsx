import React from "react";
import { ResponsiveContainer, Treemap, Tooltip } from "recharts";
import { scaleSequential } from "d3-scale";
import { interpolateViridis } from "d3-scale-chromatic";
import { AnalyzeResponse } from "@/actions/analyzeCache";

// Custom content component for Treemap with additional checks
const CustomContent = (props: any) => {
  const { x, y, width, height, depth, index, root, payload } = props;

  const nodeData = payload && payload.name ? payload : root && root.children && root.children[index];

  if (!nodeData) {
    console.warn("No data available for CustomContent at index:", index);
    return null;
  }

  const { name, color } = nodeData;
  const fontSize = Math.min(width / 8, height / 4, 12);

  if (width < 1 || height < 1) return null;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={Math.max(width, 1)}
        height={Math.max(height, 1)}
        style={{
          fill: color,
          stroke: "#fff",
          strokeWidth: 2 / (depth + 1e-10),
          strokeOpacity: 1 / (depth + 1e-10),
        }}
      />
      {width > 20 && height > 20 && (
        <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={fontSize}>
          {name}
        </text>
      )}
    </g>
  );
};

interface TreeMapProps {
  data: AnalyzeResponse[];
}

const TreeMap = ({ data }: TreeMapProps) => {
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <p className="text-gray-500">No valid data available</p>
      </div>
    );
  }

  const formatSize = (size: any) => {
    if (typeof size !== "number" || isNaN(size)) return "Unknown";
    if (size < 1024) return `${size.toFixed(2)} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatTime = (time: any) => {
    if (typeof time !== "number" || isNaN(time)) return "Unknown";
    return `${time.toFixed(2)}ms`;
  };

  const extractFileName = (url: any) => {
    if (typeof url !== "string") return "Unknown";
    try {
      const parsedUrl = new URL(url);
      const pathSegments = parsedUrl.pathname.split("/");
      return pathSegments[pathSegments.length - 1] || parsedUrl.hostname;
    } catch (error) {
      console.warn(`Invalid URL: ${url}`);
      return "Invalid URL";
    }
  };

  const validData = data.filter((item) => typeof item.size === "number" && !isNaN(item.size) && item.size > 0);

  if (validData.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <p className="text-gray-500">No valid size data available</p>
      </div>
    );
  }

  const minSize = Math.min(...validData.map((item) => item.size));
  const maxSize = Math.max(...validData.map((item) => item.size));

  // Custom scaling function
  const customScale = (size: number) => Math.pow(size, 0.4); // Adjust the power as needed

  const colorScale = scaleSequential(interpolateViridis).domain([Math.log(minSize), Math.log(maxSize)]);

  const treeMapData = validData.map((item) => {
    const scaledSize = customScale(item.size);
    return {
      name: extractFileName(item.url),
      fullUrl: item.url,
      size: scaledSize,
      originalSize: item.size,
      startTime: item.startTime,
      endTime: item.endTime,
      duration: item.duration,
      responseReceived: item.responseReceived,
      color: colorScale(Math.log(item.size)),
    };
  });

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white border border-gray-300 p-2 rounded shadow-lg text-sm">
          <p>
            <strong>File:</strong> {data.name}
          </p>
          <p>
            <strong>URL:</strong> <span className="break-all">{data.fullUrl}</span>
          </p>
          <p>
            <strong>Size:</strong> {formatSize(data.originalSize)}
          </p>
          <p>
            <strong>Start Time:</strong> {formatTime(data.startTime)}
          </p>
          <p>
            <strong>End Time:</strong> {formatTime(data.endTime)}
          </p>
          <p>
            <strong>Duration:</strong> {formatTime(data.duration)}
          </p>
          <p>
            <strong>Response Received:</strong> {formatTime(data.responseReceived)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <Treemap data={treeMapData} dataKey="size" aspectRatio={4 / 3} stroke="#fff" fill="#8884d8" content={<CustomContent />}>
          <Tooltip content={<CustomTooltip />} />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
};

export default TreeMap;
