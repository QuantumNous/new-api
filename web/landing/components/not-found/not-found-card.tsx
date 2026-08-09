"use client";

import PixelBlast from "@/components/PixelBlast";

export function NotFoundCard() {
  return (
    <section
      aria-labelledby="not-found-title"
      className="relative flex min-h-80 min-w-0 overflow-hidden rounded-3xl bg-neutral-950 p-6 text-white sm:min-h-96 sm:p-8 lg:min-h-0 lg:rounded-[2rem] lg:p-10 xl:p-12"
    >
      <div aria-hidden="true" className="absolute inset-0">
        <PixelBlast
          variant="square"
          pixelSize={3}
          color="#2563eb"
          patternScale={5}
          patternDensity={0.7}
          enableRipples
          rippleSpeed={0.4}
          rippleThickness={0.05}
          rippleIntensityScale={2}
          speed={1}
          transparent
          edgeFade={0}
        />
      </div>

      <h1
        id="not-found-title"
        className="relative z-10 mt-auto text-xl leading-[1.08] font-bold tracking-normal sm:text-2xl"
      >
        <span className="block">404 NotFound</span>
        <span className="mt-1 block">页面不存在</span>
      </h1>
    </section>
  );
}
