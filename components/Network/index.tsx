import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { sumThroughput } from "@/lib/utils";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import type { SetStateAction, Dispatch } from "react";

export interface NetworkConfig {
  offline: boolean;
  downloadThroughput: number;
  uploadThroughput: number;
  latency: number;
}

interface NetworkProps {
  control: boolean;
  setControl: (value: boolean) => void;
  config: NetworkConfig;
  setConfig: Dispatch<SetStateAction<NetworkConfig>>;
}

export default function Network({ control, setControl, config, setConfig }: NetworkProps) {
  /**
   * Handle the change of network configuration
   * @param key
   * @param value
   */
  const handleConfigChange = (key: keyof NetworkConfig, value: number | boolean) => {
    setConfig((prevConfig) => ({ ...prevConfig, [key]: value }));
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-4xl font-bold">Network 控制</h1>
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <InfoCircledIcon />
                </TooltipTrigger>
                <TooltipContent>
                  <span>Network 会控制全局的网络配置</span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Label>网络限制</Label>
          </div>
          <Switch checked={control} onCheckedChange={(value) => setControl(value)} />
        </div>
        {control && (
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <Label>上传限制</Label>
              <Input
                type="number"
                min={0}
                className="w-20"
                placeholder="500"
                value={(config.uploadThroughput / 1024) * 8}
                onInput={(event) => handleConfigChange("uploadThroughput", sumThroughput(+event.currentTarget.value))}
              />
              <span>kbps</span>
            </div>
            <div className="flex items-center gap-2">
              <Label>下载限制</Label>
              <Input
                type="number"
                min={0}
                className="w-20"
                placeholder="500"
                value={(config.downloadThroughput / 1024) * 8}
                onInput={(event) => handleConfigChange("downloadThroughput", sumThroughput(+event.currentTarget.value))}
              />
              <span>kbps</span>
            </div>
            <div className="flex items-center gap-2">
              <Label>网络延迟</Label>
              <Input
                type="number"
                min={0}
                className="w-20"
                placeholder="400"
                value={config.latency}
                onInput={(event) => handleConfigChange("latency", +event.currentTarget.value)}
              />
              <span>ms</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
