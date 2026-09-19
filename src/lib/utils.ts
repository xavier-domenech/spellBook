import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeDate(date: string) {
  const formatter = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  const elapsed = new Date(date).getTime() - Date.now();
  const minute = 60_000;
  const hour = minute * 60;
  const day = hour * 24;

  if (Math.abs(elapsed) < hour) {
    return formatter.format(Math.round(elapsed / minute), "minute");
  }

  if (Math.abs(elapsed) < day) {
    return formatter.format(Math.round(elapsed / hour), "hour");
  }

  return formatter.format(Math.round(elapsed / day), "day");
}
