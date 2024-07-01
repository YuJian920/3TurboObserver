import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Calculate the throughput in kbps
 * @param size
 * @param seconds
 * @returns
 */
export const calculateKbps = (size: number, seconds: number): number => {
  let bits = size * 8;
  let bps = bits / seconds;
  let kbps = bps / 1000;
  return kbps;
};

/**
 * Sum the throughput in kbps
 * @param throughput
 * @returns
 */
export const sumThroughput = (throughput: number) => (throughput * 1024) / 8;

export const UserAgent =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0";
