"use client";

import Image from "next/image";
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

type Side = "left" | "right";

export interface OptionWheelProps {
  items?: string[];
  itemIcons?: string[];
  selectionIconDelay?: number;
  defaultSelected?: number;
  onChange?: (index: number, item: string) => void;
  textColor?: string;
  activeColor?: string;
  side?: Side;
  fontSize?: number;
  spacing?: number;
  curve?: number;
  tilt?: number;
  blur?: number;
  fade?: number;
  minOpacity?: number;
  smoothing?: number;
  inset?: number;
  loop?: boolean;
  draggable?: boolean;
  soundUrl?: string;
  soundVolume?: number;
  className?: string;
}

interface WheelConfig {
  count: number;
  items: string[];
  rowH: number;
  curve: number;
  tilt: number;
  blur: number;
  fade: number;
  minOpacity: number;
  side: Side;
  loop: boolean;
  smoothing: number;
  draggable: boolean;
  soundUrl: string;
  soundVolume: number;
}

const DEFAULT_ITEMS = [
  "Ambient",
  "House",
  "Techno",
  "Jazz",
  "Lo-Fi",
  "Synthwave",
  "Trance",
  "Funk",
  "Disco",
  "Hip-Hop",
  "Chillwave",
  "Drum & Bass",
];

function getInitialItemStyle({
  index,
  selectedIndex,
  fontSize,
  spacing,
  curve,
  tilt,
  blur,
  fade,
  minOpacity,
  side,
}: {
  index: number;
  selectedIndex: number;
  fontSize: number;
  spacing: number;
  curve: number;
  tilt: number;
  blur: number;
  fade: number;
  minOpacity: number;
  side: Side;
}): CSSProperties {
  const distanceFromSelection = index - selectedIndex;
  const distance = Math.abs(distanceFromSelection);
  const rowHeight = fontSize * spacing;
  const tiltRadians = (tilt * Math.PI) / 180;
  const radius = tiltRadians > 0.0005 ? rowHeight / tiltRadians : 0;
  const mirror = side === "right" ? -1 : 1;
  let x = 0;
  let y = distanceFromSelection * rowHeight;
  let rotation = 0;

  if (radius > 0) {
    const angle = Math.max(
      -Math.PI / 2,
      Math.min(Math.PI / 2, distanceFromSelection * tiltRadians),
    );
    y = radius * Math.sin(angle);
    x = -mirror * radius * (1 - Math.cos(angle)) * curve;
    rotation = (mirror * angle * 180) / Math.PI;
  }

  return {
    transform: `translate(${x.toFixed(3)}rem, calc(${y.toFixed(3)}rem - 50%)) rotate(${rotation.toFixed(3)}deg)`,
    opacity: Math.max(minOpacity, 1 - distance * fade),
    filter: blur > 0 ? `blur(${(distance * blur).toFixed(2)}px)` : "none",
    "--ow-p": Math.max(0, 1 - Math.min(distance, 1)).toFixed(4),
  } as CSSProperties;
}

const OptionWheel = ({
  items = DEFAULT_ITEMS,
  itemIcons = [],
  selectionIconDelay = 300,
  defaultSelected = 3,
  onChange,
  textColor = "#a6a6a6",
  activeColor = "#ffffff",
  side = "left",
  fontSize = 3,
  spacing = 1.4,
  curve = 1,
  tilt = 6,
  blur = 2,
  fade = 0.25,
  minOpacity = 0.05,
  smoothing = 200,
  inset = 80,
  loop = false,
  draggable = true,
  soundUrl = "",
  soundVolume = 0.5,
  className = "",
}: OptionWheelProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const posRef = useRef(defaultSelected);
  const targetRef = useRef(defaultSelected);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const cfgRef = useRef<WheelConfig>({} as WheelConfig);
  const onChangeRef = useRef(onChange);
  const selectedRef = useRef(defaultSelected);
  const wheelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iconTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef<{ y: number; start: number; id: number } | null>(null);
  const dragMovedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef("");
  const lastTickRef = useRef(0);
  const [selectedIndex, setSelectedIndex] = useState(defaultSelected);
  const [visibleIconIndex, setVisibleIconIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const remPx =
    typeof window !== "undefined"
      ? parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      : 16;

  onChangeRef.current = onChange;
  cfgRef.current = {
    count: items.length,
    items,
    rowH: Math.max(fontSize * spacing * remPx, 1),
    curve,
    tilt,
    blur,
    fade,
    minOpacity,
    side,
    loop,
    smoothing,
    draggable,
    soundUrl,
    soundVolume,
  };

  const runFrame = useCallback(
    (now: number) => {
      const dt = Math.min((now - lastRef.current) / 1000, 0.05);
      lastRef.current = now;
      const cfg = cfgRef.current;
      const tau = Math.max(cfg.smoothing, 1) / 1000;
      const k = 1 - Math.exp(-dt / tau);

      const target = targetRef.current;
      const cur = posRef.current;
      let next = cur + (target - cur) * k;
      const settled = Math.abs(target - next) < 0.001;
      if (settled) next = target;
      posRef.current = next;

      const els = itemRefs.current;
      const n = cfg.count;
      const mirror = cfg.side === "right" ? -1 : 1;
      const tiltRad = (cfg.tilt * Math.PI) / 180;
      const radius = tiltRad > 0.0005 ? cfg.rowH / tiltRad : 0;

      for (let index = 0; index < n; index += 1) {
        const element = els[index];
        if (!element) continue;

        let distanceFromSelection = index - next;
        if (cfg.loop && n > 1) {
          distanceFromSelection = ((distanceFromSelection % n) + n) % n;
          if (distanceFromSelection > n / 2) distanceFromSelection -= n;
        }

        const distance = Math.abs(distanceFromSelection);
        let x = 0;
        let y = distanceFromSelection * cfg.rowH;
        let rotation = 0;

        if (radius > 0) {
          const angle = Math.max(
            -Math.PI / 2,
            Math.min(Math.PI / 2, distanceFromSelection * tiltRad),
          );
          y = radius * Math.sin(angle);
          x = -mirror * radius * (1 - Math.cos(angle)) * cfg.curve;
          rotation = (mirror * angle * 180) / Math.PI;
        }

        element.style.transform = `translate(${x.toFixed(2)}px, calc(${y.toFixed(2)}px - 50%)) rotate(${rotation.toFixed(3)}deg)`;
        element.style.opacity = String(Math.max(cfg.minOpacity, 1 - distance * cfg.fade));
        element.style.filter =
          cfg.blur > 0 ? `blur(${(distance * cfg.blur).toFixed(2)}px)` : "none";
        element.style.setProperty("--ow-p", Math.max(0, 1 - Math.min(distance, 1)).toFixed(4));
      }

      if (settled) {
        rafRef.current = null;
        if (iconTimerRef.current) clearTimeout(iconTimerRef.current);
        iconTimerRef.current = setTimeout(
          () => {
            iconTimerRef.current = null;
            setVisibleIconIndex(selectedRef.current);
          },
          Math.max(selectionIconDelay, 0),
        );
      } else {
        rafRef.current = requestAnimationFrame(runFrame);
      }
    },
    [selectionIconDelay],
  );

  const startLoop = useCallback(() => {
    if (rafRef.current != null) return;
    lastRef.current = performance.now();
    rafRef.current = requestAnimationFrame(runFrame);
  }, [runFrame]);

  const playTick = useCallback(() => {
    const { soundUrl: url, soundVolume: volume } = cfgRef.current;
    if (!url) return;

    const now = performance.now();
    if (now - lastTickRef.current < 70) return;
    lastTickRef.current = now;

    if (!audioRef.current || audioUrlRef.current !== url) {
      audioRef.current = new Audio(url);
      audioRef.current.preload = "auto";
      audioUrlRef.current = url;
    }

    const audio = audioRef.current;
    audio.volume = Math.min(Math.max(volume, 0), 1);
    audio.currentTime = 0;
    audio.play()?.catch(() => {});
  }, []);

  const applyTarget = useCallback(
    (value: number, snap: boolean) => {
      if (iconTimerRef.current) {
        clearTimeout(iconTimerRef.current);
        iconTimerRef.current = null;
      }
      setVisibleIconIndex(null);

      const cfg = cfgRef.current;
      let nextValue = value;
      if (!cfg.loop) {
        nextValue = Math.min(Math.max(nextValue, 0), Math.max(cfg.count - 1, 0));
      }
      if (snap) nextValue = Math.round(nextValue);
      targetRef.current = nextValue;

      const index = ((Math.round(nextValue) % cfg.count) + cfg.count) % cfg.count;
      if (index !== selectedRef.current) {
        selectedRef.current = index;
        setSelectedIndex(index);
        onChangeRef.current?.(index, cfg.items[index]);
        playTick();
      }
      startLoop();
    },
    [playTick, startLoop],
  );

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const cfg = cfgRef.current;
      const delta = event.deltaMode === 1 ? event.deltaY * 24 : event.deltaY;
      const step = Math.max(-1, Math.min(1, delta / cfg.rowH));
      applyTarget(targetRef.current + step, false);

      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
      wheelTimerRef.current = setTimeout(() => applyTarget(targetRef.current, true), 140);
    };

    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      element.removeEventListener("wheel", handleWheel);
      if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
    };
  }, [applyTarget]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!cfgRef.current.draggable) return;
    dragRef.current = {
      y: event.clientY,
      start: targetRef.current,
      id: event.pointerId,
    };
    dragMovedRef.current = false;
    setIsDragging(true);
  }, []);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;

      const deltaY = event.clientY - drag.y;
      if (!dragMovedRef.current && Math.abs(deltaY) > 4) {
        dragMovedRef.current = true;
        rootRef.current?.setPointerCapture(drag.id);
      }
      if (dragMovedRef.current) {
        applyTarget(drag.start - deltaY / cfgRef.current.rowH, false);
      }
    },
    [applyTarget],
  );

  const handlePointerEnd = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setIsDragging(false);
    if (dragMovedRef.current) applyTarget(targetRef.current, true);
  }, [applyTarget]);

  const handleItemClick = useCallback(
    (index: number) => {
      if (dragMovedRef.current) return;
      const cfg = cfgRef.current;
      const current = targetRef.current;
      let distance = index - (((current % cfg.count) + cfg.count) % cfg.count);

      if (cfg.loop && cfg.count > 1) {
        if (distance > cfg.count / 2) distance -= cfg.count;
        else if (distance < -cfg.count / 2) distance += cfg.count;
      }
      applyTarget(current + distance, true);
    },
    [applyTarget],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      let delta: number | null = null;
      if (event.key === "ArrowUp" || event.key === "ArrowLeft") delta = -1;
      else if (event.key === "ArrowDown" || event.key === "ArrowRight") delta = 1;
      if (delta == null) return;

      event.preventDefault();
      applyTarget(Math.round(targetRef.current) + delta, true);
    },
    [applyTarget],
  );

  useEffect(() => {
    const now = performance.now();
    lastRef.current = now;
    runFrame(now);
    applyTarget(targetRef.current, false);
  }, [
    items,
    fontSize,
    spacing,
    curve,
    tilt,
    blur,
    fade,
    minOpacity,
    side,
    loop,
    smoothing,
    applyTarget,
    runFrame,
  ]);

  useEffect(
    () => () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (iconTimerRef.current) {
        clearTimeout(iconTimerRef.current);
        iconTimerRef.current = null;
      }
      audioRef.current?.pause();
    },
    [],
  );

  return (
    <div
      ref={rootRef}
      role="listbox"
      tabIndex={0}
      aria-label="Option wheel"
      className={`relative h-full w-full touch-none select-none overflow-hidden outline-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}${className ? ` ${className}` : ""}`}
      style={
        {
          "--ow-text-color": textColor,
          "--ow-active-color": activeColor,
          "--ow-font-size": `${fontSize}rem`,
          "--ow-inset": `${inset}px`,
        } as CSSProperties
      }
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onKeyDown={handleKeyDown}
    >
      {items.map((label, index) => (
        <div
          key={`${label}-${index}`}
          ref={(element) => {
            itemRefs.current[index] = element;
          }}
          role="option"
          aria-selected={selectedIndex === index}
          style={getInitialItemStyle({
            index,
            selectedIndex: defaultSelected,
            fontSize,
            spacing,
            curve,
            tilt,
            blur,
            fade,
            minOpacity,
            side,
          })}
          className={`absolute top-1/2 cursor-pointer whitespace-nowrap leading-none will-change-[transform,opacity,filter] [font-size:var(--ow-font-size)] [color:color-mix(in_srgb,var(--ow-active-color)_calc(var(--ow-p,0)*100%),var(--ow-text-color))] ${side === "right" ? "right-[var(--ow-inset)] origin-right" : "left-[var(--ow-inset)] origin-left"} ${selectedIndex === index ? "font-medium" : "font-extralight"}`}
          onClick={() => handleItemClick(index)}
        >
          <span className="inline-flex items-center gap-2.5">
            <span>{label}</span>
            <AnimatePresence initial={false}>
              {visibleIconIndex === index && itemIcons[index] ? (
                <motion.span
                  key={itemIcons[index]}
                  initial={{ opacity: 0, x: -5, scale: 0.86, filter: "blur(2px)" }}
                  animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, x: -3, scale: 0.92, filter: "blur(1px)" }}
                  transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                  className="inline-flex shrink-0"
                >
                  <Image src={itemIcons[index]} alt="" width={24} height={24} className="size-6" />
                </motion.span>
              ) : null}
            </AnimatePresence>
          </span>
        </div>
      ))}
    </div>
  );
};

export default OptionWheel;
