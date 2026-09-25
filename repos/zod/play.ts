import { z } from "zod";

const formDate = z.iso
  .datetime({ offset: true })
  .or(z.literal(""))
  .transform((v) => (v === "" ? null : v));

console.log("empty:", formDate.safeParse(""));
console.log("valid:", formDate.safeParse("2024-01-15T10:30:00.000Z"));
console.log("invalid:", formDate.safeParse("not-a-date"));
