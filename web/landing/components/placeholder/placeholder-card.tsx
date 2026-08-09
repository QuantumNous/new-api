"use client";

import { useReducedMotion } from "motion/react";

import { ScrollVelocity } from "@/components/placeholder/scroll-velocity";

const placeholderText = "下面这部分开发者也不知道放点啥了喵";

export function PlaceholderCard() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      aria-labelledby="placeholder-card-title"
      className="mx-auto w-full max-w-[1600px] px-3 pb-3 sm:px-4 sm:pb-4 lg:px-5 lg:pb-5"
    >
      <h2 id="placeholder-card-title" className="sr-only">
        {placeholderText}
      </h2>

      <div className="relative flex min-h-[32rem] items-center overflow-hidden rounded-[2rem] border border-black/[0.06] bg-neutral-50 sm:min-h-[38rem] lg:min-h-[46rem]">
        <p
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-9xl leading-[0.82] font-bold tracking-[-0.065em] text-neutral-200/75 select-none sm:px-8"
        >
          下面这部分开发者
          <br />
          <br />
          也不知道放点啥了喵
        </p>

        <div
          aria-hidden="true"
          className="relative z-10 w-full border-y border-black/[0.06] bg-white py-7 sm:py-10 lg:py-14"
        >
          <ScrollVelocity
            texts={[placeholderText]}
            velocity={shouldReduceMotion ? 0 : 70}
            numCopies={4}
            damping={50}
            stiffness={400}
            className="px-5 text-2xl leading-none font-bold tracking-[-0.05em] text-neutral-950 sm:px-8 sm:text-5xl"
            parallaxClassName="py-1 sm:py-2"
            scrollerClassName="items-center will-change-transform"
          />
        </div>
      </div>
    </section>
  );
}
