"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowRight } from "lucide-react";
import type { DirectoryCopy } from "@/lib/model-directory-copy";
import type { FeaturedSlide } from "@/lib/model-directory-featured";
import { localizePath, type Locale } from "@/lib/locales";
import { modelPublicPath } from "@/lib/model-public";
import { cn } from "@/lib/utils";

// Featured models carousel. Auto-advances, pausing while the pointer is over it
// or focus is inside it, and stops entirely when the visitor has asked for
// reduced motion — an auto-playing banner is exactly the motion that setting is
// meant to suppress.

const SLIDE_INTERVAL_MS = 7000;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Subscribes to the reduced-motion preference. useSyncExternalStore rather than
 * an effect: the value is external state React should read, not state to push
 * into on mount. Returns false during SSR so the markup matches a fresh client.
 */
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== "function") return () => {};
      const query = window.matchMedia(REDUCED_MOTION_QUERY);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => (typeof window.matchMedia === "function" ? window.matchMedia(REDUCED_MOTION_QUERY).matches : false),
    () => false
  );
}

type Props = {
  slides: FeaturedSlide[];
  copy: DirectoryCopy;
  locale: Locale;
};

export function ModelsFeaturedCarousel(props: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useReducedMotion();
  const count = props.slides.length;

  const go = useCallback((next: number) => setIndex((current) => (count === 0 ? 0 : (next + count) % count)), [count]);

  useEffect(() => {
    if (paused || reducedMotion || count <= 1) return;
    const timer = setInterval(() => setIndex((current) => (current + 1) % count), SLIDE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [paused, reducedMotion, count]);

  if (count === 0) return null;
  const slide = props.slides[Math.min(index, count - 1)];

  return (
    <section
      aria-label={props.copy.featuredLabel}
      aria-roledescription="carousel"
      className="relative mb-4 overflow-hidden rounded-2xl border border-[#E7E4EC] bg-[#0B0B0F] shadow-[0_1px_2px_rgba(24,14,38,0.04),0_18px_46px_-30px_rgba(24,14,38,0.35)] dark:border-white/10"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="relative aspect-[24/9] max-h-[360px] min-h-[260px] w-full">
        <SlideMedia slide={slide} reducedMotion={reducedMotion} />

        {/* Scrim: the copy sits left, so the gradient is weighted that way. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.94)_0%,rgba(2,6,23,0.78)_38%,rgba(2,6,23,0.25)_68%,rgba(2,6,23,0.05)_100%)]"
        />

        <div className="absolute inset-y-0 left-0 flex max-w-[min(560px,64%)] flex-col justify-center gap-3 p-6 pb-16 sm:p-10 sm:pb-16">
          <div className="flex flex-wrap gap-1.5">
            {(slide.tags[props.locale] ?? slide.tags.en).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-sm"
              >
                {tag}
              </span>
            ))}
          </div>

          <h2 className="text-[clamp(1.75rem,3.6vw,2.75rem)] leading-tight font-black tracking-tight text-white">
            {slide.displayName}
          </h2>

          <p className="line-clamp-3 max-w-lg text-sm leading-relaxed text-white/75 sm:text-[15px]">
            {slide.blurb[props.locale] ?? slide.blurb.en}
          </p>

          <Link
            href={localizePath(modelPublicPath(slide.modelName), props.locale)}
            className="group/cta mt-1 inline-flex w-fit items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-[#0B0B0F] transition-all duration-200 hover:-translate-y-px hover:bg-[#F8F4FF] hover:text-[#4C1D95] hover:shadow-[0_10px_24px_-14px_rgba(255,255,255,0.6)]"
          >
            {props.copy.learnMore}
            <ArrowRight className="size-4 transition-transform duration-200 group-hover/cta:translate-x-0.5" aria-hidden="true" />
          </Link>
        </div>

        {count > 1 ? (
          /* Dots only: they navigate and show position, and keeping the corner
             free of arrows leaves the slide artwork unobstructed. */
          <div
            role="tablist"
            aria-label={props.copy.chooseSlide}
            className="absolute right-5 bottom-4 flex items-center gap-1.5 sm:right-6 sm:bottom-5"
          >
            {props.slides.map((item, slideIndex) => (
              <button
                key={item.modelName}
                type="button"
                role="tab"
                aria-selected={slideIndex === index}
                aria-label={item.displayName}
                onClick={() => go(slideIndex)}
                className={cn(
                  "h-1 rounded-full transition-all duration-300",
                  slideIndex === index ? "w-7 bg-white" : "w-4 bg-white/35 hover:bg-white/60"
                )}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Video slides autoplay muted and loop; muted is required or browsers refuse to
 * start them without a user gesture. Under reduced motion the poster still is
 * shown instead, and the clip is never fetched.
 */
function SlideMedia(props: { slide: FeaturedSlide; reducedMotion: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { slide, reducedMotion } = props;

  useEffect(() => {
    // Re-triggers playback when the slide changes and the element is reused.
    videoRef.current?.play().catch(() => {});
  }, [slide.modelName]);

  if (slide.video && !reducedMotion) {
    return (
      <video
        ref={videoRef}
        key={slide.video}
        className="absolute inset-0 size-full object-cover"
        src={slide.video}
        poster={slide.image}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        aria-hidden="true"
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={slide.image} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
  );
}
