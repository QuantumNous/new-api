import { source } from "@/loaders/source";
import { createFromSource } from "fumadocs-core/search/server";

export const { GET } = createFromSource(source);
