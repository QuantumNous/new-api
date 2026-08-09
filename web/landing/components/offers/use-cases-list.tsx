"use client";

import { type ReactNode } from "react";
import { motion, MotionConfig, type Variants } from "motion/react";

import { Tooltip } from "@/components/ui/tooltip-card";

export interface UseCaseItem {
  label: string;
  icon: ReactNode;
  color: string;
  recommendedModels: string[];
}

interface UseCasesListProps {
  items: UseCaseItem[];
  recommendationLabel: string;
}

const iconVariants: Variants = {
  rest: { color: "rgb(163 163 163)" },
  hover: (color: string) => ({ color }),
};

const labelVariants = {
  rest: { color: "rgb(163 163 163)" },
  hover: (color: string) => ({ color }),
} as Variants;

const itemTransition = {
  type: "spring" as const,
  stiffness: 220,
  damping: 24,
  mass: 0.8,
};

function Recommendation({ label, models }: { label: string; models: string[] }) {
  return (
    <div className="space-y-2">
      <p className="font-bold text-neutral-950">{label}</p>
      <ul className="flex flex-wrap gap-1.5">
        {models.map((model) => (
          <li
            key={model}
            className="rounded-full bg-neutral-100 px-2.5 py-1 font-semibold whitespace-nowrap text-neutral-700"
          >
            {model}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function UseCasesList({ items, recommendationLabel }: UseCasesListProps) {
  return (
    <MotionConfig reducedMotion="user" transition={itemTransition}>
      <ul className="mt-8 grid grid-cols-2 gap-x-1 gap-y-5 sm:mt-10 sm:gap-5 lg:mt-auto lg:grid-cols-1 lg:gap-4 lg:pt-10">
        {items.map((item) => (
          <li key={item.label} className="min-w-0">
            <Tooltip
              containerClassName="block w-full"
              content={
                <Recommendation label={recommendationLabel} models={item.recommendedModels} />
              }
            >
              <motion.div
                initial="rest"
                animate="rest"
                whileHover="hover"
                className="flex min-w-0 items-center gap-1 sm:gap-3 lg:gap-4"
              >
                <motion.span
                  aria-hidden="true"
                  custom={item.color}
                  variants={iconVariants}
                  className="shrink-0 [&_svg]:size-6 lg:[&_svg]:size-7"
                >
                  {item.icon}
                </motion.span>
                <motion.span
                  custom={item.color}
                  variants={labelVariants}
                  style={{ fontFamily: 'Arial, "Microsoft YaHei", sans-serif' }}
                  className="min-w-0 text-base leading-[1.15] font-bold tracking-normal whitespace-nowrap sm:text-xl lg:text-2xl lg:leading-[1.08]"
                >
                  {item.label}
                </motion.span>
              </motion.div>
            </Tooltip>
          </li>
        ))}
      </ul>
    </MotionConfig>
  );
}
