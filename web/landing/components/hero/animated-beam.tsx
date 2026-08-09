"use client";

import { useEffect, useMemo, useRef, useState, type Ref, type RefObject } from "react";
import Image from "next/image";

import { AnimatedBeam as Beam, type AnimatedBeamProps } from "@/components/ui/animated-beam";
import { cn } from "@/lib/utils";

interface PillNodeProps {
  ref?: Ref<HTMLAnchorElement>;
  href: string;
  iconSrc: string;
  label: string;
  iconPosition: "left" | "right";
}

type BeamVisualProps = Omit<AnimatedBeamProps, "pathD" | "width" | "height">;

interface BeamDefinition {
  id: string;
  fromRef: RefObject<HTMLAnchorElement | null>;
  toRef: RefObject<HTMLAnchorElement | null>;
  curvature: number;
  visual: BeamVisualProps;
}

interface BeamLayout {
  width: number;
  height: number;
  paths: Record<string, string>;
}

const emptyLayout: BeamLayout = { width: 0, height: 0, paths: {} };

function createBeamVisual(pathOpacity: number, delay: number, duration: number): BeamVisualProps {
  return {
    pathColor: "#cbd5e1",
    pathOpacity,
    gradientStartColor: "#2563eb",
    gradientStopColor: "#22d3ee",
    delay,
    duration,
    pathWidth: 1.4,
  };
}

function pathsAreEqual(current: Record<string, string>, next: Record<string, string>) {
  const currentKeys = Object.keys(current);
  const nextKeys = Object.keys(next);
  return (
    currentKeys.length === nextKeys.length && nextKeys.every((key) => current[key] === next[key])
  );
}

function PillNode({ ref, href, iconSrc, label, iconPosition }: PillNodeProps) {
  const icon = (
    <Image
      src={iconSrc}
      alt=""
      width={24}
      height={24}
      loading="eager"
      unoptimized
      className="size-4 shrink-0 object-contain sm:size-5"
    />
  );

  return (
    <a
      ref={ref}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "relative z-10 flex h-8 w-[7.25rem] select-none items-center gap-1 rounded-full border border-black/10 bg-white px-1.5 no-underline shadow-[0_12px_30px_-16px_rgba(0,0,0,0.35)] transition-[border-color,box-shadow] duration-200 hover:border-black/20 hover:shadow-[0_14px_34px_-16px_rgba(0,0,0,0.45)] focus-visible:ring-3 focus-visible:ring-blue-600/25 focus-visible:outline-none sm:h-10 sm:w-44 sm:gap-2.5 sm:px-3",
        iconPosition === "right" && "justify-between",
      )}
    >
      {iconPosition === "left" ? icon : null}
      <span
        translate="no"
        className="text-2xs truncate py-px leading-[1.25] font-semibold tracking-[-0.015em] text-neutral-800 sm:text-xs"
      >
        {label}
      </span>
      {iconPosition === "right" ? icon : null}
    </a>
  );
}

export function AnimatedBeam() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gptSolRef = useRef<HTMLAnchorElement>(null);
  const claudeFableRef = useRef<HTMLAnchorElement>(null);
  const geminiFlashRef = useRef<HTMLAnchorElement>(null);
  const grokRef = useRef<HTMLAnchorElement>(null);
  const deepSeekRef = useRef<HTMLAnchorElement>(null);
  const helloCoderRef = useRef<HTMLAnchorElement>(null);
  const chatGptRef = useRef<HTMLAnchorElement>(null);
  const codexRef = useRef<HTMLAnchorElement>(null);
  const claudeAppRef = useRef<HTMLAnchorElement>(null);
  const claudeCodeRef = useRef<HTMLAnchorElement>(null);
  const cherryStudioRef = useRef<HTMLAnchorElement>(null);
  const [layout, setLayout] = useState<BeamLayout>(emptyLayout);

  const definitions = useMemo<BeamDefinition[]>(
    () => [
      {
        id: "gpt-sol-to-hicoder",
        fromRef: gptSolRef,
        toRef: helloCoderRef,
        curvature: 44,
        visual: createBeamVisual(0.5, 0, 3),
      },
      {
        id: "claude-fable-to-hicoder",
        fromRef: claudeFableRef,
        toRef: helloCoderRef,
        curvature: 22,
        visual: createBeamVisual(0.5, 0.12, 3.13),
      },
      {
        id: "gemini-flash-to-hicoder",
        fromRef: geminiFlashRef,
        toRef: helloCoderRef,
        curvature: 0,
        visual: createBeamVisual(0.5, 0.24, 3.26),
      },
      {
        id: "grok-to-hicoder",
        fromRef: grokRef,
        toRef: helloCoderRef,
        curvature: -22,
        visual: createBeamVisual(0.5, 0.36, 3.39),
      },
      {
        id: "deepseek-to-hicoder",
        fromRef: deepSeekRef,
        toRef: helloCoderRef,
        curvature: -44,
        visual: createBeamVisual(0.5, 0.48, 3.52),
      },
      {
        id: "hicoder-to-chatgpt",
        fromRef: helloCoderRef,
        toRef: chatGptRef,
        curvature: 44,
        visual: createBeamVisual(0.65, 0.6, 3),
      },
      {
        id: "hicoder-to-codex",
        fromRef: helloCoderRef,
        toRef: codexRef,
        curvature: 22,
        visual: createBeamVisual(0.65, 0.72, 3.13),
      },
      {
        id: "hicoder-to-claude-app",
        fromRef: helloCoderRef,
        toRef: claudeAppRef,
        curvature: 0,
        visual: createBeamVisual(0.65, 0.84, 3.26),
      },
      {
        id: "hicoder-to-claude-code",
        fromRef: helloCoderRef,
        toRef: claudeCodeRef,
        curvature: -22,
        visual: createBeamVisual(0.65, 0.96, 3.39),
      },
      {
        id: "hicoder-to-cherry-studio",
        fromRef: helloCoderRef,
        toRef: cherryStudioRef,
        curvature: -44,
        visual: createBeamVisual(0.65, 1.08, 3.52),
      },
    ],
    [
      chatGptRef,
      cherryStudioRef,
      claudeAppRef,
      claudeCodeRef,
      claudeFableRef,
      codexRef,
      deepSeekRef,
      geminiFlashRef,
      gptSolRef,
      grokRef,
      helloCoderRef,
    ],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measuredContainer: HTMLDivElement = container;

    let animationFrameId = 0;

    function measure() {
      const containerRect = measuredContainer.getBoundingClientRect();
      const rects = new Map<HTMLElement, DOMRect>();

      for (const definition of definitions) {
        const from = definition.fromRef.current;
        const to = definition.toRef.current;
        if (from && !rects.has(from)) rects.set(from, from.getBoundingClientRect());
        if (to && !rects.has(to)) rects.set(to, to.getBoundingClientRect());
      }

      const paths: Record<string, string> = {};
      for (const definition of definitions) {
        const from = definition.fromRef.current;
        const to = definition.toRef.current;
        if (!from || !to) continue;

        const fromRect = rects.get(from);
        const toRect = rects.get(to);
        if (!fromRect || !toRect) continue;

        const startX = fromRect.left - containerRect.left + fromRect.width / 2;
        const startY = fromRect.top - containerRect.top + fromRect.height / 2;
        const endX = toRect.left - containerRect.left + toRect.width / 2;
        const endY = toRect.top - containerRect.top + toRect.height / 2;
        const controlY = startY - definition.curvature;

        paths[definition.id] =
          `M ${startX},${startY} Q ${(startX + endX) / 2},${controlY} ${endX},${endY}`;
      }

      setLayout((current) => {
        if (
          current.width === containerRect.width &&
          current.height === containerRect.height &&
          pathsAreEqual(current.paths, paths)
        ) {
          return current;
        }

        return { width: containerRect.width, height: containerRect.height, paths };
      });
    }

    function scheduleMeasurement() {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(measure);
    }

    const resizeObserver = new ResizeObserver(scheduleMeasurement);
    resizeObserver.observe(measuredContainer);

    const observedNodes = new Set<HTMLElement>();
    for (const definition of definitions) {
      const from = definition.fromRef.current;
      const to = definition.toRef.current;
      if (from && !observedNodes.has(from)) {
        observedNodes.add(from);
        resizeObserver.observe(from);
      }
      if (to && !observedNodes.has(to)) {
        observedNodes.add(to);
        resizeObserver.observe(to);
      }
    }

    scheduleMeasurement();
    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, [definitions]);

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label="五个模型通过 HelloCoder 连接到五个 Agent 应用"
      className="relative isolate flex h-full min-h-[17rem] w-full items-center overflow-hidden rounded-[1.75rem] border border-black/[0.06] bg-neutral-50 px-2 py-4 sm:min-h-[18rem] sm:px-7 sm:py-5 lg:min-h-0 lg:px-9"
    >
      <div className="grid size-full grid-cols-[auto_minmax(0,1fr)_auto] items-center">
        <div className="flex shrink-0 flex-col justify-center gap-3">
          <PillNode
            ref={gptSolRef}
            href="https://openai.com/zh-Hans-CN/api/"
            label="gpt-5.6-sol"
            iconSrc="/logo/chatgpt.svg"
            iconPosition="left"
          />
          <PillNode
            ref={claudeFableRef}
            href="https://platform.claude.com/"
            label="claude-fable-5"
            iconSrc="/logo/claude.svg"
            iconPosition="left"
          />
          <PillNode
            ref={geminiFlashRef}
            href="https://ai.google.dev/gemini-api/docs"
            label="gemini-3.6-flash"
            iconSrc="/logo/gemini.svg"
            iconPosition="left"
          />
          <PillNode
            ref={grokRef}
            href="https://docs.x.ai/"
            label="grok-4.5"
            iconSrc="/logo/grok.svg"
            iconPosition="left"
          />
          <PillNode
            ref={deepSeekRef}
            href="https://platform.deepseek.com/"
            label="deepseek-v4-flash"
            iconSrc="/logo/deepseek.svg"
            iconPosition="left"
          />
        </div>

        <div className="flex min-w-0 items-center justify-center">
          <a
            ref={helloCoderRef}
            href="/sign-in"
            aria-label="访问 HelloCoder 控制台"
            className="relative z-10 flex size-16 flex-col items-center justify-center gap-1 rounded-2xl border border-blue-600/15 bg-blue-50 p-1.5 text-center text-blue-700 shadow-[0_16px_40px_-22px_rgba(37,99,235,0.45)] focus-visible:ring-3 focus-visible:ring-blue-600/35 focus-visible:outline-none sm:size-20 sm:gap-1.5 sm:p-2.5"
          >
            <Image
              src="/favicon.ico"
              alt=""
              width={40}
              height={40}
              loading="eager"
              unoptimized
              className="size-6 object-contain sm:size-9"
            />
            <span
              translate="no"
              className="text-2xs leading-none font-bold tracking-[-0.02em] sm:text-xs"
            >
              HelloCoder
            </span>
          </a>
        </div>

        <div className="flex shrink-0 flex-col justify-center gap-3">
          <PillNode
            ref={chatGptRef}
            href="https://openai.com/zh-Hans-CN/codex/"
            label="ChatGPT Work"
            iconSrc="/logo/chatgpt.svg"
            iconPosition="right"
          />
          <PillNode
            ref={codexRef}
            href="https://openai.com/zh-Hans-CN/codex/"
            label="Codex"
            iconSrc="/logo/codex.svg"
            iconPosition="right"
          />
          <PillNode
            ref={claudeAppRef}
            href="https://claude.com/download"
            label="Claude App"
            iconSrc="/logo/claude.svg"
            iconPosition="right"
          />
          <PillNode
            ref={claudeCodeRef}
            href="https://code.claude.com/docs/en/overview"
            label="Claude Code"
            iconSrc="/logo/claudecode.svg"
            iconPosition="right"
          />
          <PillNode
            ref={cherryStudioRef}
            href="https://cherryai.com.cn/"
            label="Cherry Studio"
            iconSrc="/logo/cherrystudio.svg"
            iconPosition="right"
          />
        </div>
      </div>

      {definitions.map((definition) => (
        <Beam
          key={definition.id}
          pathD={layout.paths[definition.id] ?? ""}
          width={layout.width}
          height={layout.height}
          {...definition.visual}
        />
      ))}
    </div>
  );
}
