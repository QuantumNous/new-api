import { IconBook2, IconHome } from "@tabler/icons-react";

import { HeroCards } from "@/components/hero/hero-cards";
import { NotFoundCard } from "@/components/not-found/not-found-card";

export default function NotFound() {
  return (
    <main id="main-content" className="flex min-h-svh w-full flex-col p-3 sm:p-4 lg:p-5">
      <div className="mx-auto my-auto grid w-full max-w-[1600px] gap-3 sm:gap-4 lg:h-[min(50rem,calc(100svh-2.5rem))] lg:min-h-[36rem] lg:grid-cols-[minmax(0,1.75fr)_minmax(20rem,0.75fr)] lg:gap-5">
        <NotFoundCard />

        <HeroCards
          top={{
            href: "/",
            icon: <IconHome stroke={1.7} />,
            title: "返回首页",
            description: "回到 HelloCoder 首页",
            backgroundColor: "oklch(54.6% 0.245 262.881)",
          }}
          bottom={{
            href: "/docs",
            icon: <IconBook2 stroke={1.7} />,
            title: "查看文档",
            description: "浏览使用指南与接口文档",
            backgroundColor: "oklch(77.7% 0.152 181.912)",
          }}
          topRatio={0.5}
          bottomRatio={0.5}
          stackOnMobile
        />
      </div>
    </main>
  );
}
