"use client";

import { MotionConfig } from "motion/react";

import { AnimatedBeam } from "@/components/hero/animated-beam";
import {
  heroCardDescriptionTypographyClassName,
  HeroCards,
  heroCardTitleTypographyClassName,
  type HeroCardConfig,
} from "@/components/hero/hero-cards";
import { MorphingText } from "@/components/ui/morphing-text";

interface HeroProps {
  topCard: HeroCardConfig;
  bottomCard: HeroCardConfig;
  topRatio: number;
  bottomRatio: number;
}

const modelNames = ["GPT-5.5", "GPT-5.6 Sol", "Claude Opus 4.8", "Claude Fable 5", "Grok 4.5"];

export function Hero({ topCard, bottomCard, topRatio, bottomRatio }: HeroProps) {
  return (
    <MotionConfig reducedMotion="user">
      <section className="mx-auto grid w-full max-w-[1600px] gap-3 p-3 sm:gap-4 sm:p-4 lg:h-[min(44rem,100svh)] lg:min-h-[38rem] lg:grid-cols-[minmax(0,1.75fr)_minmax(20rem,0.75fr)] lg:gap-5 lg:p-5">
        <div className="flex min-h-[27rem] min-w-0 flex-col p-1 sm:min-h-[30rem] sm:p-2 lg:min-h-0 lg:overflow-hidden lg:rounded-[2rem] lg:border lg:border-black/[0.06] lg:bg-white lg:p-7 xl:p-8">
          <header className="flex flex-[0.65] items-center py-5 sm:py-7 lg:py-2">
            <div className="w-full">
              <div className={heroCardTitleTypographyClassName}>
                <h1>使用 HelloCoder</h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-[0.2em] gap-y-1 sm:mt-3">
                  <span className="whitespace-nowrap">一个接口，连接</span>
                  <MorphingText
                    texts={modelNames}
                    className="!mx-0 !h-[1.15em] !w-[8.8em] !max-w-full shrink-0 self-center !text-left !text-lg !leading-[1.15] text-blue-600 sm:!text-xl lg:!h-[1.08em] lg:!text-2xl lg:!leading-[1.08]"
                  />
                </div>
                <p
                  className={`mt-4 tracking-normal text-neutral-500 sm:mt-5 ${heroCardDescriptionTypographyClassName}`}
                >
                  简单、方便、按量计费。
                </p>
              </div>
            </div>
          </header>
          <div className="min-h-[17rem] flex-[1.35] sm:min-h-[18rem] lg:min-h-0">
            <AnimatedBeam />
          </div>
        </div>
        <HeroCards
          top={topCard}
          bottom={bottomCard}
          topRatio={topRatio}
          bottomRatio={bottomRatio}
        />
      </section>
    </MotionConfig>
  );
}
