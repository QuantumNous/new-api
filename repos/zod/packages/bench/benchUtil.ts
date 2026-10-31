import * as zod3 from "zod3";
import * as zod4 from "zod4";
import * as zodNext from "../zod/src/index.js";

export { zod3, zod4, zodNext };
export function makeSchema<T>(factory: (z: typeof zod4) => T) {
  return {
    zod3: factory(zod3 as any) as T,
    zod4: factory(zod4 as any) as T,
    // zod4Ts: factory(zodNewTs as any),
  };
}

export function randomString(length: number): string {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

export function randomPick(options: any[]): any {
  return options[Math.floor(Math.random() * options.length)];
}

export function makeData(count: number, factory: object | (() => any)): any[] {
  return Array.from({ length: count }, () => {
    // clone non primitive data
    if (typeof factory === "object") return { ...factory };
    if (typeof factory === "function") return factory();
    throw new Error("Invalid factory");
  });
}

export function formatNumber(val: number): string {
  if (val >= 1e12) {
    return `${toFixed(val / 1e12)}T`;
  }
  if (val >= 1e9) {
    return `${toFixed(val / 1e9)}B`;
  }
  if (val >= 1e6) {
    return `${toFixed(val / 1e6)}M`;
  }
  if (val >= 1e3) {
    return `${toFixed(val / 1e3)}k`;
  }
  if (val >= 1) {
    return val.toString();
  }
  if (val >= 1e-3) {
    return `${toFixed(val * 1e3)}m`;
  }
  if (val >= 1e-6) {
    return `${toFixed(val * 1e6)}µ`;
  }
  if (val >= 1e-9) {
    return `${toFixed(val * 1e9)}n`;
  }
  if (val >= 1e-12) {
    return `${toFixed(val * 1e12)}p`;
  }
  return val.toString();
}

function toFixed(val: number) {
  return val.toPrecision(3);
}
