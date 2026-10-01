"use client";

import { InkeepModalSearchAndChat, type InkeepModalSearchAndChatProps } from "@inkeep/cxkit-react";
import type { SharedProps } from "fumadocs-ui/components/dialog/search";
import { useEffect, useState } from "react";

export default function InkeepSearchBox(props: SharedProps) {
  const [syncTarget, setSyncTarget] = useState<HTMLElement | null>(null);
  const { open, onOpenChange } = props;
  // We do this because document is not available in the server
  useEffect(() => {
    setSyncTarget(document.documentElement);
  }, []);

  // if(!syncTarget) return null;

  const config: InkeepModalSearchAndChatProps = {
    baseSettings: {
      apiKey: process.env.NEXT_PUBLIC_INKEEP_KEY, // required
      primaryBrandColor: "#EE63C0", // your brand color, widget color scheme is derived from this
      organizationDisplayName: "Zod",
      // ...optional settings
      colorMode: {
        sync: {
          target: syncTarget!,
          attributes: ["class"],
          isDarkMode: (attributes) => !!attributes.class?.includes("dark"),
        },
      },
    },
    modalSettings: {
      isOpen: open,
      onOpenChange,
      // optional settings
    },
    // searchSettings: {
    //   // optional settings
    // },
    // aiChatSettings: {
    //   // optional settings
    //   aiAssistantAvatar: "https://mydomain.com/mylogo", // use your own ai assistant avatar
    //   exampleQuestions: ["Example question 1?", "Example question 2?", "Example question 3?"],
    // },
  };
  return <InkeepModalSearchAndChat {...config} />;
}
