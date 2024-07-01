"use client";

import PreloadCache from "@/components/PreloadCache";
import Network from "@/components/Network";
import type { NetworkConfig, SetConfigType } from "@/components/Network";
import Iterations from "@/components/Iterations";
import { useState } from "react";

export default function Home() {
  const [URL, setURL] = useState("https://baidu.com");
  const [networkControl, setNetworkControl] = useState(true);
  const [networkConfig, setNetworkConfig] = useState<NetworkConfig>({
    offline: false,
    downloadThroughput: (500 * 1024) / 8,
    uploadThroughput: (500 * 1024) / 8,
    latency: 400,
  });

  return (
    <main className="flex min-h-screen flex-col p-24 gap-14">
      <Network
        control={networkControl}
        setControl={setNetworkControl}
        config={networkConfig}
        setConfig={setNetworkConfig as SetConfigType}
      />
      <PreloadCache URL={URL} setURL={setURL} networkControl={networkControl} networkConfig={networkConfig} />
      <Iterations URL={URL} networkControl={networkControl} networkConfig={networkConfig} />
    </main>
  );
}
