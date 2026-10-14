import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPct(value: number, digits = 0): string {
  return `${Math.round(value * 10 ** digits) / 10 ** digits}%`;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function shortId(id: string): string {
  const parts = id.split("_");
  if (parts.length >= 2 && parts[0].length <= 4) {
    const tail = parts.slice(1).join("_");
    return tail.length > 22 ? `${parts[0].toUpperCase()}-${tail.slice(0, 8)}` : id;
  }
  return id.length > 16 ? `${id.slice(0, 8)}…` : id;
}
