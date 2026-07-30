import { describe, expect, it } from "vitest";
import { addTurnUsage, emptyUsage, formatTokens, totalTokens, usageFromMessages } from "./usage";

const turn = (over: Record<string, unknown> = {}) => ({
  model: "anthropic:claude-fable-5",
  input: 100,
  output: 20,
  cache_read: 50,
  cache_write: 10,
  ...over,
});

describe("addTurnUsage", () => {
  it("accumulates per model and tracks the latest prompt-side total as context", () => {
    let u = addTurnUsage(emptyUsage(), turn());
    u = addTurnUsage(u, turn({ input: 40, output: 5, cache_read: 200, cache_write: 0 }));
    const m = u.byModel["anthropic:claude-fable-5"];
    expect(m).toEqual({
      model: "anthropic:claude-fable-5",
      input: 140,
      output: 25,
      cache_read: 250,
      cache_write: 10,
    });
    // context = LAST turn's input + cache_read + cache_write, not a sum.
    expect(u.context).toBe(240);
  });

  it("keys separate models separately (mid-session switch)", () => {
    let u = addTurnUsage(emptyUsage(), turn());
    u = addTurnUsage(u, turn({ model: "gpt-5.5", input: 7 }));
    expect(Object.keys(u.byModel).sort()).toEqual(["anthropic:claude-fable-5", "gpt-5.5"]);
  });

  it("ignores malformed payloads and clamps negatives", () => {
    expect(addTurnUsage(emptyUsage(), null)).toEqual(emptyUsage());
    expect(addTurnUsage(emptyUsage(), "x")).toEqual(emptyUsage());
    const u = addTurnUsage(emptyUsage(), turn({ input: -5, output: "9" }));
    expect(u.byModel["anthropic:claude-fable-5"].input).toBe(0);
    expect(u.byModel["anthropic:claude-fable-5"].output).toBe(9);
  });

  it("buckets a missing model id under 'unknown'", () => {
    const u = addTurnUsage(emptyUsage(), turn({ model: undefined }));
    expect(u.byModel["unknown"].input).toBe(100);
  });
});

describe("usageFromMessages", () => {
  it("folds assistant usage sidecars and ignores everything else", () => {
    const u = usageFromMessages([
      { role: "user", content: "hi" },
      { role: "assistant", content: "a", usage: turn() as any },
      { role: "tool", content: "r", usage: turn() as any }, // wrong role — ignored
      { role: "assistant", content: "b" }, // no sidecar (older server) — ignored
      { role: "assistant", content: "c", usage: turn({ input: 300 }) as any },
    ]);
    expect(u.byModel["anthropic:claude-fable-5"].input).toBe(400);
    expect(u.context).toBe(360);
  });
});

describe("totalTokens / formatTokens", () => {
  it("totals across models and directions", () => {
    let u = addTurnUsage(emptyUsage(), turn());
    u = addTurnUsage(u, turn({ model: "gpt-5.5" }));
    expect(totalTokens(u)).toBe(360);
  });

  it("formats humane numbers", () => {
    expect(formatTokens(0)).toBe("0");
    expect(formatTokens(980)).toBe("980");
    expect(formatTokens(12_400)).toBe("12.4k");
    expect(formatTokens(982_000)).toBe("982k");
    expect(formatTokens(1_240_000)).toBe("1.24M");
    expect(formatTokens(NaN)).toBe("0");
  });
});
