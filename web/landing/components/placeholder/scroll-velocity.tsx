"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from "motion/react";

import { cn } from "@/lib/utils";

interface VelocityMapping {
  input: [number, number];
  output: [number, number];
}

interface ScrollVelocityProps {
  scrollContainerRef?: React.RefObject<HTMLElement>;
  texts: ReactNode[];
  velocity?: number;
  className?: string;
  damping?: number;
  stiffness?: number;
  numCopies?: number;
  velocityMapping?: VelocityMapping;
  parallaxClassName?: string;
  scrollerClassName?: string;
  parallaxStyle?: CSSProperties;
  scrollerStyle?: CSSProperties;
}

interface VelocityTextProps {
  children: ReactNode;
  baseVelocity: number;
  scrollContainerRef?: React.RefObject<HTMLElement>;
  className?: string;
  damping: number;
  stiffness: number;
  numCopies: number;
  velocityMapping: VelocityMapping;
  parallaxClassName?: string;
  scrollerClassName?: string;
  parallaxStyle?: CSSProperties;
  scrollerStyle?: CSSProperties;
}

const defaultVelocityMapping: VelocityMapping = {
  input: [0, 1000],
  output: [0, 5],
};

function useElementWidth<T extends HTMLElement>(ref: React.RefObject<T | null>): number {
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });

    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, [ref]);

  return width;
}

function wrap(min: number, max: number, value: number): number {
  const range = max - min;
  return ((((value - min) % range) + range) % range) + min;
}

function TextCopies({
  children,
  className,
  numCopies,
  copyRef,
}: {
  children: ReactNode;
  className?: string;
  numCopies: number;
  copyRef?: React.RefObject<HTMLSpanElement | null>;
}) {
  return Array.from({ length: numCopies }, (_, index) => (
    <span
      key={index}
      ref={index === 0 ? copyRef : undefined}
      aria-hidden={index === 0 ? undefined : "true"}
      className={cn("shrink-0", className)}
    >
      {children}&nbsp;
    </span>
  ));
}

function StaticVelocityText({
  children,
  className,
  numCopies,
  parallaxClassName,
  scrollerClassName,
  parallaxStyle,
  scrollerStyle,
}: VelocityTextProps) {
  return (
    <div className={cn("relative overflow-hidden", parallaxClassName)} style={parallaxStyle}>
      <div
        className={cn(
          "flex items-center whitespace-nowrap text-center font-sans text-3xl font-bold tracking-[-0.02em] drop-shadow md:text-5xl",
          scrollerClassName,
        )}
        style={scrollerStyle}
      >
        <TextCopies className={className} numCopies={numCopies}>
          {children}
        </TextCopies>
      </div>
    </div>
  );
}

function AnimatedVelocityText({
  children,
  baseVelocity,
  scrollContainerRef,
  className,
  damping,
  stiffness,
  numCopies,
  velocityMapping,
  parallaxClassName,
  scrollerClassName,
  parallaxStyle,
  scrollerStyle,
}: VelocityTextProps) {
  const baseX = useMotionValue(0);
  const { scrollY } = useScroll(scrollContainerRef ? { container: scrollContainerRef } : undefined);
  const scrollVelocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(scrollVelocity, { damping, stiffness });
  const velocityFactor = useTransform(
    smoothVelocity,
    velocityMapping.input,
    velocityMapping.output,
    { clamp: false },
  );
  const copyRef = useRef<HTMLSpanElement>(null);
  const copyWidth = useElementWidth(copyRef);
  const directionFactor = useRef(1);

  const x = useTransform(baseX, (value) => {
    if (copyWidth === 0) return "0px";
    return `${wrap(-copyWidth, 0, value)}px`;
  });

  useAnimationFrame((_time, delta) => {
    const velocity = velocityFactor.get();
    if (velocity < 0) directionFactor.current = -1;
    else if (velocity > 0) directionFactor.current = 1;

    const baseMove = directionFactor.current * baseVelocity * (delta / 1000);
    baseX.set(baseX.get() + baseMove + directionFactor.current * baseMove * velocity);
  });

  return (
    <div className={cn("relative overflow-hidden", parallaxClassName)} style={parallaxStyle}>
      <motion.div
        className={cn(
          "flex items-center whitespace-nowrap text-center font-sans text-3xl font-bold tracking-[-0.02em] drop-shadow md:text-5xl",
          scrollerClassName,
        )}
        style={{ x, ...scrollerStyle }}
      >
        <TextCopies copyRef={copyRef} className={className} numCopies={numCopies}>
          {children}
        </TextCopies>
      </motion.div>
    </div>
  );
}

export function ScrollVelocity({
  scrollContainerRef,
  texts,
  velocity = 100,
  className,
  damping = 50,
  stiffness = 400,
  numCopies = 6,
  velocityMapping = defaultVelocityMapping,
  parallaxClassName,
  scrollerClassName,
  parallaxStyle,
  scrollerStyle,
}: ScrollVelocityProps) {
  return (
    <div>
      {texts.map((text, index) => {
        const props: VelocityTextProps = {
          baseVelocity: index % 2 === 0 ? velocity : -velocity,
          children: text,
          className,
          damping,
          numCopies,
          parallaxClassName,
          parallaxStyle,
          scrollContainerRef,
          scrollerClassName,
          scrollerStyle,
          stiffness,
          velocityMapping,
        };

        return velocity === 0 ? (
          <StaticVelocityText key={index} {...props} />
        ) : (
          <AnimatedVelocityText key={index} {...props} />
        );
      })}
    </div>
  );
}
