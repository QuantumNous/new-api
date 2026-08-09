"use client";

import { useState } from "react";
import { AnimatePresence, motion, MotionConfig, type Variants } from "motion/react";

import OptionWheel from "@/components/pricing/option-wheel";
import type { PricingModel } from "@/components/pricing/pricing";

interface PricingModelWheelProps {
  models: PricingModel[];
}

const contentVariants: Variants = {
  initial: {
    opacity: 0,
    filter: "blur(3px)",
    scale: 0.99,
    y: 4,
  },
  animate: {
    opacity: 1,
    filter: "blur(0px)",
    scale: 1,
    y: 0,
    transition: {
      duration: 0.34,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  exit: {
    opacity: 0,
    filter: "blur(2px)",
    scale: 1.006,
    y: -3,
    transition: {
      duration: 0.18,
      ease: [0.4, 0, 1, 1],
    },
  },
};

export function PricingModelWheel({ models }: PricingModelWheelProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedModel = models[selectedIndex] ?? models[0];

  if (!selectedModel) return null;

  return (
    <MotionConfig reducedMotion="user">
      <div className="grid min-h-[34rem] grid-cols-[minmax(8rem,0.7fr)_minmax(0,1.3fr)] items-stretch sm:min-h-[32rem] sm:grid-cols-[minmax(10rem,0.8fr)_minmax(20rem,1.2fr)] lg:h-full lg:min-h-0 lg:grid-cols-[minmax(15rem,0.8fr)_minmax(24rem,1.2fr)]">
        <OptionWheel
          items={models.map((model) => model.name)}
          itemIcons={models.map((model) => model.logoSrc)}
          selectionIconDelay={100}
          defaultSelected={0}
          onChange={setSelectedIndex}
          textColor="#a3a3a3"
          activeColor="#171717"
          fontSize={2}
          spacing={1.6}
          curve={0.75}
          tilt={10}
          blur={1.5}
          fade={0.28}
          minOpacity={0.08}
          smoothing={180}
          inset={48}
          soundUrl="/click.mp3"
          soundVolume={1}
          loop
          draggable
          className="max-lg:overflow-visible! focus-visible:ring-2 focus-visible:ring-blue-600/30"
        />

        <div className="flex min-w-0 items-start py-8 pr-5 pl-1 sm:pr-8 sm:pl-0 lg:pt-10 lg:pr-10 lg:pb-8">
          <div className="grid w-full grid-cols-1 justify-items-end gap-4 lg:grid-cols-[minmax(8rem,0.9fr)_minmax(9rem,1.1fr)] lg:justify-items-stretch lg:gap-10">
            <div className="w-full max-w-52 lg:max-w-none">
              <h3 className="text-right text-sm font-semibold text-neutral-500 sm:text-base lg:text-left">
                倍率
              </h3>
              <div className="relative mt-4 lg:min-h-40">
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.dl
                    key={selectedModel.name}
                    aria-label={`${selectedModel.name} 倍率`}
                    variants={contentVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="relative ml-auto w-fit origin-top-right space-y-3 will-change-[transform,opacity,filter] lg:absolute lg:inset-x-0 lg:top-0 lg:ml-0 lg:w-auto lg:origin-top-left"
                  >
                    {selectedModel.rates.map((rate) => (
                      <div
                        key={`${selectedModel.name}-${rate.label}`}
                        className="grid grid-cols-[5.25rem_auto] items-baseline gap-3 lg:grid-cols-[6rem_minmax(0,1fr)] lg:gap-2"
                      >
                        <dt className="text-right text-sm leading-snug font-normal text-neutral-600 sm:text-base lg:text-left">
                          {rate.label}
                        </dt>
                        <dd className="shrink-0 text-right font-mono text-sm leading-snug font-bold text-blue-600 sm:text-base lg:text-left">
                          {rate.multiplier}
                        </dd>
                      </div>
                    ))}
                  </motion.dl>
                </AnimatePresence>
              </div>
            </div>

            <div className="w-full max-w-52 lg:max-w-none">
              <h3 className="text-right text-sm font-semibold text-neutral-500 sm:text-base lg:text-left">
                可用模型
              </h3>
              <div className="relative mt-4 lg:min-h-28">
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.ul
                    key={selectedModel.name}
                    aria-label={`${selectedModel.name} 可用模型`}
                    variants={contentVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="relative origin-top-right list-none space-y-3 will-change-[transform,opacity,filter] lg:absolute lg:inset-x-0 lg:top-0 lg:origin-top-left"
                  >
                    {selectedModel.availableModels.map((model) => (
                      <li
                        key={`${selectedModel.name}-${model}`}
                        className="text-right text-sm leading-snug font-normal text-neutral-600 sm:text-base lg:text-left"
                      >
                        {model}
                      </li>
                    ))}
                  </motion.ul>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
