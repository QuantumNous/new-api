"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { HomeTerminalCopy } from "@/lib/copy";
import { ROUTER_ORIGIN } from "@/lib/origins";
import { cn } from "@/lib/utils";

type AccentTone = "emerald" | "amber" | "blue" | "violet";

interface ApiDemoConfig {
  id: string;
  label: string;
  method: "POST" | "GET";
  endpoint: string;
  headers: string[];
  request: string[];
  response: string[];
  tokens: number;
  latency: number;
  accent: AccentTone;
}

const ACCENT_CLASSES: Record<AccentTone, { activeText: string; activeBorder: string; badge: string }> = {
  emerald: {
    activeText: "text-violet-600",
    activeBorder: "border-violet-500",
    badge: "bg-violet-500/10 text-violet-600",
  },
  amber: {
    activeText: "text-fuchsia-600",
    activeBorder: "border-fuchsia-500",
    badge: "bg-fuchsia-500/10 text-fuchsia-600",
  },
  blue: {
    activeText: "text-indigo-600",
    activeBorder: "border-indigo-500",
    badge: "bg-indigo-500/10 text-indigo-600",
  },
  violet: {
    activeText: "text-violet-600",
    activeBorder: "border-violet-500",
    badge: "bg-violet-500/10 text-violet-600",
  },
};

export const API_DEMOS: ApiDemoConfig[] = [
  {
    id: "gpt-chat",
    label: "Chat",
    method: "POST",
    endpoint: `${ROUTER_ORIGIN}/v1/chat/completions`,
    headers: ['"Authorization: Bearer sk-fk-••••"', '"Content-Type: application/json"'],
    request: ['"model": "your-model",', '"messages": [', '  { "role": "user", "content": "..." }', "]"],
    response: ["{", '  "choices": [{ "message": { "content": <text> } }],', '  "usage": { "total_tokens": <tokens> }', "}"],
    tokens: 27,
    latency: 142,
    accent: "emerald",
  },
  {
    id: "responses",
    label: "Responses",
    method: "POST",
    endpoint: `${ROUTER_ORIGIN}/v1/responses`,
    headers: ['"Authorization: Bearer sk-fk-••••"', '"Content-Type: application/json"'],
    request: ['"model": "your-model",', '"input": "..."'],
    response: ["{", '  "output": [{ "type": "output_text", "text": <text> }],', '  "usage": { "total_tokens": <tokens> }', "}"],
    tokens: 31,
    latency: 168,
    accent: "amber",
  },
  {
    id: "claude",
    label: "Claude",
    method: "POST",
    endpoint: `${ROUTER_ORIGIN}/v1/messages`,
    headers: ['"x-api-key: sk-fk-••••"', '"anthropic-version: 2023-06-01"', '"Content-Type: application/json"'],
    request: ['"model": "your-model",', '"max_tokens": 1024,', '"messages": [', '  { "role": "user", "content": "..." }', "]"],
    response: ["{", '  "content": [{ "type": "text", "text": <text> }],', '  "usage": { "input_tokens": <in>, "output_tokens": <out> }', "}"],
    tokens: 29,
    latency: 156,
    accent: "blue",
  },
  {
    id: "gemini",
    label: "Gemini",
    method: "POST",
    endpoint: `${ROUTER_ORIGIN}/v1beta/models/{model}:generateContent`,
    headers: ['"x-goog-api-key: sk-fk-••••"', '"Content-Type: application/json"'],
    request: ['"contents": [', '  { "role": "user",', '    "parts": [{ "text": "..." }] }', "]"],
    response: ["{", '  "candidates": [{ "content": { "parts": [{ "text": <text> }] } }],', '  "usageMetadata": { "totalTokenCount": <tokens> }', "}"],
    tokens: 25,
    latency: 93,
    accent: "violet",
  },
];

const CYCLE_INTERVAL = 4500;
const TRANSITION_MS = 220;
const STRING_RE = /"[^"]*"/g;
const PLACEHOLDER_RE = /<[a-z]+>/gi;

export function HeroTerminalDemo(props: { className?: string; copy: HomeTerminalCopy }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;
    intervalRef.current = setInterval(() => {
      setTransitioning(true);
      timeoutRef.current = setTimeout(() => {
        setActiveIndex((prev) => (prev + 1) % API_DEMOS.length);
        setTransitioning(false);
      }, TRANSITION_MS);
    }, CYCLE_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleSelect = (index: number) => {
    if (index === activeIndex) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setTransitioning(true);
    timeoutRef.current = setTimeout(() => {
      setActiveIndex(index);
      setTransitioning(false);
    }, TRANSITION_MS);
  };

  const demo = API_DEMOS[activeIndex];
  const accent = ACCENT_CLASSES[demo.accent];

  return (
    <div className={cn("mx-auto w-full max-w-2xl", props.className)}>
      <div className="overflow-hidden rounded-2xl border border-violet-500/15 bg-white/90 shadow-[0_28px_80px_-48px_rgba(91,33,182,0.65)] backdrop-blur-sm">
        <div className="flex items-center gap-1 border-b border-violet-500/10 bg-white/55 px-2 sm:gap-1.5 sm:px-3">
          {API_DEMOS.map((item, index) => {
            const tone = ACCENT_CLASSES[item.accent];
            const isActive = index === activeIndex;
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(index)}
                className={cn(
                  "relative -mb-px flex items-center gap-1.5 border-b-2 px-2.5 py-2.5 text-[11px] font-medium tracking-wide transition-colors sm:px-3 sm:text-xs",
                  isActive ? `${tone.activeBorder} ${tone.activeText}` : "border-transparent text-foreground/40 hover:text-foreground/70"
                )}
              >
                {item.label}
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-2 pr-2 sm:pr-3">
            <span className="inline-block size-1.5 rounded-full bg-violet-500 shadow-[0_0_10px_rgba(124,58,237,0.65)]" />
            <span className="text-foreground/45 font-mono text-[10px] tracking-wider uppercase">200 ok</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 border-b border-violet-500/10 bg-violet-500/[0.025] px-5 py-3">
          <span className={cn("rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider", accent.badge)}>
            {demo.method}
          </span>
          <code className={cn("text-foreground/75 truncate font-mono text-[12.5px] transition-opacity duration-200", transitioning ? "opacity-0" : "opacity-100")}>
            {demo.endpoint}
          </code>
        </div>

        <div className="grid h-[400px] grid-rows-[235px_minmax(0,1fr)] font-mono text-[12.5px] leading-[1.55]">
          <RequestBlock demo={demo} transitioning={transitioning} label={props.copy.request} />
          <ResponseBlock demo={demo} transitioning={transitioning} copy={props.copy} />
        </div>

        <div className="flex items-center justify-between border-t border-violet-500/10 bg-violet-500/[0.035] px-5 py-2.5">
          <div className="text-foreground/40 flex items-center gap-3 text-[10px] tabular-nums">
            <span className="flex items-center gap-1"><span className="font-mono">{demo.latency}</span><span className="tracking-wider uppercase">{props.copy.ms}</span></span>
            <span className="bg-foreground/15 size-1 rounded-full" />
            <span className="flex items-center gap-1"><span className="font-mono">{demo.tokens}</span><span className="tracking-wider uppercase">{props.copy.tokens}</span></span>
            <span className="bg-foreground/15 size-1 rounded-full" />
            <span className="flex items-center gap-1"><span className="tracking-wider uppercase">{props.copy.cost}</span><span className="font-mono">${(demo.tokens * 0.00003).toFixed(5)}</span></span>
          </div>
          <span className="text-foreground/30 font-mono text-[10px] tracking-wider uppercase">stream · sse</span>
        </div>
      </div>
    </div>
  );
}

function RequestBlock(props: { demo: ApiDemoConfig; transitioning: boolean; label: string }) {
  return (
    <div className="relative px-5 py-4">
      <SectionLabel>{props.label}</SectionLabel>
      <div className={cn("mt-2 transition-opacity duration-200", props.transitioning ? "opacity-0" : "opacity-100")}>
        <CodeLine><Command>curl</Command> <Flag>-X</Flag> <Flag>POST</Flag> <StringText>&quot;{props.demo.endpoint}&quot;</StringText> <Muted>{"\\"}</Muted></CodeLine>
        {props.demo.headers.map((header) => (
          <CodeLine key={header} indent={2}><Flag>-H</Flag> <StringText>{header}</StringText> <Muted>{"\\"}</Muted></CodeLine>
        ))}
        <CodeLine indent={2}><Flag>-d</Flag> <StringText>&apos;{"{"}</StringText></CodeLine>
        {props.demo.request.map((line, i) => <CodeLine key={i} indent={4}>{tokenize(line)}</CodeLine>)}
        <CodeLine indent={2}><StringText>{"}"}&apos;</StringText></CodeLine>
      </div>
    </div>
  );
}

function ResponseBlock(props: { demo: ApiDemoConfig; transitioning: boolean; copy: HomeTerminalCopy }) {
  return (
    <div className="relative border-t border-violet-500/10 bg-violet-500/[0.025] px-5 py-4">
      <SectionLabel>{props.copy.response}</SectionLabel>
      <div className={cn("mt-2 transition-opacity duration-200", props.transitioning ? "opacity-0" : "opacity-100")}>
        {props.demo.response.map((line, i) => <CodeLine key={i}>{renderResponseLine(line, props.demo, props.copy)}</CodeLine>)}
      </div>
    </div>
  );
}

function SectionLabel(props: { children: ReactNode }) {
  return <span className="text-foreground/30 font-sans text-[10px] font-semibold tracking-[0.18em] uppercase">{props.children}</span>;
}

function renderResponseLine(line: string, demo: ApiDemoConfig, copy: HomeTerminalCopy): ReactNode {
  const segments: ReactNode[] = [];
  let cursor = 0;
  const matches = [...line.matchAll(PLACEHOLDER_RE)];
  if (matches.length === 0) return tokenize(line);
  matches.forEach((match, idx) => {
    const start = match.index ?? 0;
    if (start > cursor) segments.push(<span key={`pre-${idx}`}>{tokenize(line.slice(cursor, start))}</span>);
    const placeholder = match[0];
    if (placeholder === "<text>") segments.push(<Accent key={`ph-${idx}`} accent={demo.accent}>{`"${copy.responses[demo.id] ?? "..."}"`}</Accent>);
    else if (placeholder === "<tokens>") segments.push(<NumberText key={`ph-${idx}`}>{demo.tokens}</NumberText>);
    else if (placeholder === "<in>") segments.push(<NumberText key={`ph-${idx}`}>{Math.floor(demo.tokens * 0.4)}</NumberText>);
    else if (placeholder === "<out>") segments.push(<NumberText key={`ph-${idx}`}>{Math.ceil(demo.tokens * 0.6)}</NumberText>);
    else segments.push(<Muted key={`ph-${idx}`}>{placeholder}</Muted>);
    cursor = start + placeholder.length;
  });
  if (cursor < line.length) segments.push(<span key="tail">{tokenize(line.slice(cursor))}</span>);
  return segments;
}

function tokenize(input: string): ReactNode {
  const segments: ReactNode[] = [];
  let cursor = 0;
  const matches = [...input.matchAll(STRING_RE)];
  matches.forEach((match, idx) => {
    const start = match.index ?? 0;
    if (start > cursor) segments.push(<Muted key={`m-${idx}`}>{input.slice(cursor, start)}</Muted>);
    const text = match[0];
    const after = input.slice(start + text.length).trimStart();
    segments.push(after.startsWith(":") ? <Key key={`k-${idx}`}>{text}</Key> : <StringText key={`s-${idx}`}>{text}</StringText>);
    cursor = start + text.length;
  });
  if (cursor < input.length) segments.push(<Muted key="tail">{input.slice(cursor)}</Muted>);
  return segments;
}

function CodeLine(props: { children: ReactNode; indent?: number }) {
  return (
    <div className="break-words whitespace-pre-wrap">
      {props.indent ? <span aria-hidden className="inline-block" style={{ width: `${props.indent}ch` }} /> : null}
      {props.children}
    </div>
  );
}

function Command(props: { children: ReactNode }) {
  return <span className="font-medium text-violet-600 dark:text-fuchsia-200">{props.children}</span>;
}
function Flag(props: { children: ReactNode }) {
  return <span className="text-indigo-600 dark:text-indigo-300">{props.children}</span>;
}
function Key(props: { children: ReactNode }) {
  return <span className="text-violet-700 dark:text-fuchsia-200">{props.children}</span>;
}
function StringText(props: { children: ReactNode }) {
  return <span className="text-fuchsia-700 dark:text-fuchsia-200">{props.children}</span>;
}
function NumberText(props: { children: ReactNode }) {
  return <span className="font-medium text-violet-600 dark:text-fuchsia-200">{props.children}</span>;
}
function Muted(props: { children: ReactNode }) {
  return <span className="text-foreground/55">{props.children}</span>;
}
function Accent(props: { children: ReactNode; accent: AccentTone }) {
  return <span className={cn("font-medium", ACCENT_CLASSES[props.accent].activeText)}>{props.children}</span>;
}
