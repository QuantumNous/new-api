import { describe, expect, it } from "vitest";
import type { Provider } from "@/types";
import {
  filterConnectProviders,
  isConnectManagedProvider,
} from "./connectProviderPolicy";

const base = (
  partial: Partial<Provider> & Pick<Provider, "id" | "name">,
): Provider => ({
  settingsConfig: {},
  ...partial,
});

describe("connectProviderPolicy", () => {
  it("keeps official and BoxAI providers only", () => {
    expect(
      isConnectManagedProvider(
        base({
          id: "claude-official",
          name: "Claude Official",
          category: "official",
        }),
      ),
    ).toBe(true);
    expect(
      isConnectManagedProvider(
        base({
          id: "boxai-claude",
          name: "BoxAI",
          category: "third_party",
        }),
      ),
    ).toBe(true);
    expect(
      isConnectManagedProvider(
        base({ id: "custom-1", name: "BYOK", category: "custom" }),
      ),
    ).toBe(false);
    expect(
      isConnectManagedProvider(
        base({ id: "proxy-openai", name: "GPT", category: "third_party" }),
      ),
    ).toBe(false);
  });

  const providerMap = () => ({
    "claude-official": base({
      id: "claude-official",
      name: "Official",
      category: "official",
    }),
    "boxai-claude": base({
      id: "boxai-claude",
      name: "BoxAI",
      category: "third_party",
    }),
    "my-key": base({ id: "my-key", name: "Mine", category: "custom" }),
  });

  it("filters a curated client down to the managed surface", () => {
    const filtered = filterConnectProviders(providerMap(), "claude");
    expect(Object.keys(filtered).sort()).toEqual([
      "boxai-claude",
      "claude-official",
    ]);
  });

  it("leaves a client Connect does not curate untouched", () => {
    // Connect seeds nothing into Claude Desktop, so filtering it would hide
    // the providers the user added there and leave an empty panel.
    const filtered = filterConnectProviders(providerMap(), "claude-desktop");
    expect(Object.keys(filtered).sort()).toEqual([
      "boxai-claude",
      "claude-official",
      "my-key",
    ]);
  });
});
