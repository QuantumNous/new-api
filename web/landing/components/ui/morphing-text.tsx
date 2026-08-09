"use client";

import { useCallback, useEffect, useId, useRef } from "react";
import { useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

const morphTime = 1.5;
const cooldownTime = 0.5;

function useMorphingText(texts: string[], shouldReduceMotion: boolean | null) {
  const textIndexRef = useRef(0);
  const renderedTextIndexRef = useRef(-1);
  const morphRef = useRef(0);
  const cooldownRef = useRef(0);
  const timeRef = useRef(0);

  const text1Ref = useRef<HTMLSpanElement>(null);
  const text2Ref = useRef<HTMLSpanElement>(null);

  const setStyles = useCallback(
    (fraction: number) => {
      const current1 = text1Ref.current;
      const current2 = text2Ref.current;
      if (!current1 || !current2 || texts.length === 0) return;

      const currentTextIndex = textIndexRef.current % texts.length;
      if (renderedTextIndexRef.current !== currentTextIndex) {
        current1.textContent = texts[currentTextIndex];
        current2.textContent = texts[(currentTextIndex + 1) % texts.length];
        renderedTextIndexRef.current = currentTextIndex;
      }

      const invertedFraction = 1 - fraction;
      current2.style.filter = `blur(${Math.min(8 / fraction - 8, 100)}px)`;
      current2.style.opacity = `${Math.pow(fraction, 0.4) * 100}%`;
      current1.style.filter = `blur(${Math.min(8 / invertedFraction - 8, 100)}px)`;
      current1.style.opacity = `${Math.pow(invertedFraction, 0.4) * 100}%`;
    },
    [texts],
  );

  const doMorph = useCallback(() => {
    morphRef.current -= cooldownRef.current;
    cooldownRef.current = 0;

    let fraction = morphRef.current / morphTime;
    if (fraction > 1) {
      cooldownRef.current = cooldownTime;
      fraction = 1;
    }

    setStyles(fraction);
    if (fraction === 1) textIndexRef.current++;
  }, [setStyles]);

  const doCooldown = useCallback(() => {
    morphRef.current = 0;
    const current1 = text1Ref.current;
    const current2 = text2Ref.current;
    if (!current1 || !current2) return;

    current2.style.filter = "none";
    current2.style.opacity = "100%";
    current1.style.filter = "none";
    current1.style.opacity = "0%";
  }, []);

  useEffect(() => {
    const current1 = text1Ref.current;
    const current2 = text2Ref.current;
    if (!current1 || !current2 || texts.length === 0) return;

    textIndexRef.current = 0;
    renderedTextIndexRef.current = -1;
    morphRef.current = 0;
    cooldownRef.current = 0;

    if (shouldReduceMotion) {
      current1.textContent = texts[0];
      current1.style.filter = "none";
      current1.style.opacity = "100%";
      current2.textContent = "";
      current2.style.filter = "none";
      current2.style.opacity = "0%";
      return;
    }

    let animationFrameId = 0;
    timeRef.current = performance.now();

    const animate = (now: number) => {
      const deltaSeconds = (now - timeRef.current) / 1000;
      timeRef.current = now;
      cooldownRef.current -= deltaSeconds;

      if (cooldownRef.current <= 0) doMorph();
      else doCooldown();

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [doCooldown, doMorph, shouldReduceMotion, texts]);

  return { text1Ref, text2Ref };
}

interface MorphingTextProps {
  className?: string;
  texts: string[];
}

function Texts({ texts }: Pick<MorphingTextProps, "texts">) {
  const shouldReduceMotion = useReducedMotion();
  const { text1Ref, text2Ref } = useMorphingText(texts, shouldReduceMotion);

  return (
    <>
      <span
        ref={text1Ref}
        aria-hidden="true"
        className="absolute inset-x-0 top-0 m-auto inline-block w-full"
      >
        {texts[0] ?? ""}
      </span>
      <span
        ref={text2Ref}
        aria-hidden="true"
        className="absolute inset-x-0 top-0 m-auto inline-block w-full opacity-0"
      >
        {texts[1] ?? ""}
      </span>
    </>
  );
}

function SvgFilters({ id }: { id: string }) {
  return (
    <svg aria-hidden="true" focusable="false" className="fixed h-0 w-0">
      <defs>
        <filter id={id}>
          <feColorMatrix
            in="SourceGraphic"
            type="matrix"
            values="1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    0 0 0 255 -140"
          />
        </filter>
      </defs>
    </svg>
  );
}

export function MorphingText({ texts, className }: MorphingTextProps) {
  const filterId = useId();

  if (texts.length === 0) return null;

  return (
    <div
      className={cn(
        "relative mx-auto h-16 w-full max-w-3xl text-center font-sans text-4xl leading-none font-bold md:h-24 lg:text-6xl",
        className,
      )}
      style={{ filter: `url(#${filterId}) blur(0.6px)` }}
    >
      <span className="sr-only">{texts.join("、")}</span>
      <Texts texts={texts} />
      <SvgFilters id={filterId} />
    </div>
  );
}
