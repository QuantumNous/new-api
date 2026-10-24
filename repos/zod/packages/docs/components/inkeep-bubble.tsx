"use client";

import { InkeepChatButton, type InkeepChatButtonProps } from "@inkeep/cxkit-react";
import { useEffect, useState } from "react";

export function InkeepBubble() {
  // color mode sync target
  const [syncTarget, setSyncTarget] = useState<HTMLElement | null>(null);

  // document is not available in the server
  useEffect(() => {
    setSyncTarget(document.documentElement);
  }, []);

  const config = {
    baseSettings: {
      apiKey: process.env.NEXT_PUBLIC_INKEEP_KEY!, // required
      primaryBrandColor: "#EE63C0", // your brand color, widget color scheme is derived from this
      organizationDisplayName: "Zod",
      // ...optional settings
      colorMode: {
        sync: {
          target: syncTarget!,
          attributes: ["class"],
          isDarkMode: (attributes: any) => !!attributes.class?.includes("dark"),
        },
      },
      theme: {
        styles: [
          {
            key: "custom-theme",
            type: "style",

            value: `
             .ikp-chat-button__container {
                z-index: var(--ikp-z-index-overlay);
            }`,
          },
        ],
      },
    },
    searchSettings: {
      // optional settings
    },
    aiChatSettings: {
      // optional settings

      aiAssistantAvatar: "https://zod.dev/logo/logo.png", // use your own ai assistant avatar
      exampleQuestions: [
        "How do I convert a Zod schema to a JSON Schema?",
        "How do I define a cyclical object type?",
        "How do I globally customize errors?",
      ],
    },
  } satisfies InkeepChatButtonProps;

  return <InkeepChatButton {...config} />;
}
