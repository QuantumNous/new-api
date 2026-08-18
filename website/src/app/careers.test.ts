import { describe, expect, test } from "bun:test";
import { metadata as englishCareersMetadata } from "./(en)/careers/page";
import { generateMetadata as generateLocalizedCareersMetadata } from "./[locale]/careers/page";

describe("careers metadata", () => {
  test("only advertises the supported en and zh alternates", async () => {
    const expectedKeys = ["en-US", "x-default", "zh-CN"].sort();

    expect(Object.keys(englishCareersMetadata.alternates?.languages ?? {}).sort()).toEqual(expectedKeys);
    expect(englishCareersMetadata.alternates?.languages).toMatchObject({
      "en-US": "https://flatkey.ai/careers",
      "zh-CN": "https://flatkey.ai/zh/careers",
      "x-default": "https://flatkey.ai/careers",
    });

    const zhMetadata = await generateLocalizedCareersMetadata({ params: Promise.resolve({ locale: "zh" }) });
    expect(Object.keys(zhMetadata.alternates?.languages ?? {}).sort()).toEqual(expectedKeys);
    expect(zhMetadata.alternates?.languages).toMatchObject({
      "en-US": "https://flatkey.ai/careers",
      "zh-CN": "https://flatkey.ai/zh/careers",
      "x-default": "https://flatkey.ai/careers",
    });
  });
});
