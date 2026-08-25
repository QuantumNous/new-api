import * as React from "react";
import { describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

let capturedGenerateUrl = "";

mock.module("react", () => {
  const actual = React;
  let stateCall = 0;

  return {
    ...actual,
    useEffect: () => undefined,
    useMemo: (factory: () => unknown) => {
      const value = factory();
      if (typeof value === "string") {
        capturedGenerateUrl = value;
      }
      return value;
    },
    useState: <T,>(initialState: T | (() => T)) => {
      stateCall += 1;
      if (stateCall === 3) return [true, () => undefined] as const;
      const value = typeof initialState === "function" ? (initialState as () => T)() : initialState;
      return [value, () => undefined] as const;
    },
  };
});

mock.module("react-dom", () => ({
  createPortal: (node: React.ReactNode) => node,
}));

mock.module("@base-ui/react/select", () => {
  const passthrough = (tag: keyof React.JSX.IntrinsicElements) =>
    function MockSelectPart(props: React.PropsWithChildren<Record<string, unknown>>) {
      return React.createElement(tag, null, props.children);
    };

  return {
    Select: {
      Icon: passthrough("span"),
      Item: passthrough("div"),
      ItemIndicator: passthrough("span"),
      ItemText: passthrough("span"),
      List: passthrough("div"),
      Portal: passthrough("div"),
      Positioner: passthrough("div"),
      Popup: passthrough("div"),
      Root: passthrough("div"),
      Trigger: passthrough("button"),
      Value: passthrough("span"),
    },
  };
});

describe("CliPromptActionPanel", () => {
  test("keeps Seedance selected for a seedance-2.5 video item and propagates it into the generated URL", async () => {
    (globalThis as typeof globalThis & { document?: { body: unknown } }).document = { body: {} };
    const { CliPromptActionPanel } = await import("./cli-prompt-action-panel");
    const html = renderToStaticMarkup(
      <CliPromptActionPanel
        defaultPrompt="Generate an astronaut cat video."
        generateUrl="https://console.flatkey.ai/playground"
        kind="video"
        locale="en"
        model="seedance-2.5"
        ratio="16:9"
        title="Prompt"
      />,
    );

    const urlMatch = html.match(/https:\/\/console\.flatkey\.ai\/playground[^"]*/);
    if (urlMatch) capturedGenerateUrl = urlMatch[0];

    expect(html).toContain("Generate an astronaut cat video.");
    expect(html).toContain("seedance-2.5");
    expect(capturedGenerateUrl).toContain("model=seedance-2.5");
  });
});
