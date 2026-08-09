"use client";

import { type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { IconArrowUpRight } from "@tabler/icons-react";
import { motion, MotionConfig, type Variants } from "motion/react";

import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

interface HeroDrawerLinkConfig {
  href: string;
  title: string;
  description: string;
}

interface HeroDrawerQuickLinkConfig {
  href: string;
  label: string;
}

export interface HeroCardConfig {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
  backgroundColor: string;
  drawerLinks?: readonly [HeroDrawerLinkConfig, HeroDrawerLinkConfig];
  drawerQuickLinks?: readonly HeroDrawerQuickLinkConfig[];
}

interface HeroCardsProps {
  top: HeroCardConfig;
  bottom: HeroCardConfig;
  topRatio: number;
  bottomRatio: number;
  stackOnMobile?: boolean;
}

const ratioTolerance = 0.000001;
const MotionLink = motion.create(Link);
const cardClassName =
  "group relative flex min-h-0 w-full overflow-hidden rounded-3xl p-5 text-white focus-visible:ring-4 focus-visible:ring-white/80 focus-visible:ring-inset focus-visible:outline-none sm:p-6 lg:rounded-[2rem] lg:p-7 xl:p-8";

export const heroCardTitleTypographyClassName =
  "text-lg leading-[1.15] font-bold tracking-[-0.025em] sm:text-xl lg:text-2xl lg:leading-[1.08] lg:tracking-[-0.035em]";
export const heroCardDescriptionTypographyClassName =
  "text-xs leading-relaxed font-medium sm:text-sm lg:text-base";

const baseTitleVariants: Variants = {
  rest: {
    opacity: 1,
    filter: "blur(0px)",
    transition: { delay: 0.04, duration: 0.2, ease: [0.16, 1, 0.3, 1] },
  },
  hover: {
    opacity: 0,
    filter: "blur(3px)",
    transition: { duration: 0.16, ease: [0.4, 0, 1, 1] },
  },
};

const enlargedTitleVariants: Variants = {
  rest: {
    y: 5,
    opacity: 0,
    filter: "blur(4px)",
    transition: { duration: 0.16, ease: [0.4, 0, 1, 1] },
  },
  hover: {
    y: 0,
    opacity: 1,
    filter: "blur(0px)",
    transition: { delay: 0.04, duration: 0.28, ease: [0.16, 1, 0.3, 1] },
  },
};

const outgoingArrowVariants: Variants = {
  rest: { x: 0, y: 0, opacity: 1, filter: "blur(0px)" },
  hover: {
    x: 20,
    y: -20,
    opacity: 0,
    filter: "blur(6px)",
    transition: { duration: 0.28, ease: [0.4, 0, 1, 1] },
  },
};

const incomingArrowVariants: Variants = {
  rest: { x: -18, y: 18, opacity: 0, filter: "blur(6px)" },
  hover: {
    x: 0,
    y: 0,
    opacity: 1,
    filter: "blur(0px)",
    transition: { delay: 0.06, duration: 0.36, ease: [0.16, 1, 0.3, 1] },
  },
};

function validateRatios(topRatio: number, bottomRatio: number) {
  const total = topRatio + bottomRatio;

  if (
    !Number.isFinite(topRatio) ||
    !Number.isFinite(bottomRatio) ||
    topRatio <= 0 ||
    bottomRatio <= 0 ||
    Math.abs(total - 1) > ratioTolerance
  ) {
    throw new Error(
      `Hero card ratios must be positive and add up to 1. Received ${topRatio} + ${bottomRatio} = ${total}.`,
    );
  }
}

function HeroCardContent({
  config,
  showIcon = true,
}: {
  config: Pick<HeroCardConfig, "icon" | "title" | "description">;
  showIcon?: boolean;
}) {
  const titleClassName = `whitespace-nowrap ${heroCardTitleTypographyClassName}`;

  return (
    <div className="flex size-full flex-col justify-between">
      <div className={cn("flex items-start gap-4", showIcon ? "justify-between" : "justify-end")}>
        {showIcon ? (
          <span
            aria-hidden="true"
            className="[&_svg]:size-7 sm:[&_svg]:size-8 lg:[&_svg]:size-10 xl:[&_svg]:size-11"
          >
            {config.icon}
          </span>
        ) : null}
        <span className="relative hidden size-9 lg:block xl:size-10">
          <motion.span variants={outgoingArrowVariants} className="absolute inset-0 block">
            <IconArrowUpRight aria-hidden="true" stroke={1.7} className="size-full" />
          </motion.span>
          <motion.span variants={incomingArrowVariants} className="absolute inset-0 block">
            <IconArrowUpRight aria-hidden="true" stroke={1.7} className="size-full" />
          </motion.span>
        </span>
      </div>

      <div className="flex flex-col items-start gap-1.5 pt-5 text-left lg:gap-2 lg:pt-6">
        <span className="relative inline-grid">
          <motion.span variants={baseTitleVariants} className={titleClassName}>
            {config.title}
          </motion.span>
          <motion.span
            aria-hidden="true"
            variants={enlargedTitleVariants}
            style={{ scale: 1.6, transformOrigin: "left bottom" }}
            className={`${titleClassName} pointer-events-none absolute bottom-0 left-0`}
          >
            {config.title}
          </motion.span>
        </span>
        <span className={`max-w-80 text-white/80 ${heroCardDescriptionTypographyClassName}`}>
          {config.description}
        </span>
      </div>
    </div>
  );
}

function InternalHeroCard({ config }: { config: HeroCardConfig }) {
  return (
    <MotionLink
      href={config.href}
      aria-label={`${config.title}，${config.description}`}
      initial="rest"
      whileHover="hover"
      whileFocus="hover"
      className={cardClassName}
      style={{ backgroundColor: config.backgroundColor }}
    >
      <HeroCardContent config={config} />
    </MotionLink>
  );
}

function ExternalHeroCard({ config }: { config: HeroCardConfig }) {
  return (
    <motion.a
      href={config.href}
      aria-label={`${config.title}，${config.description}`}
      initial="rest"
      whileHover="hover"
      whileFocus="hover"
      className={cardClassName}
      style={{ backgroundColor: config.backgroundColor }}
    >
      <HeroCardContent config={config} />
    </motion.a>
  );
}

function DrawerLinkCard({
  config,
  backgroundColor,
}: {
  config: HeroDrawerLinkConfig;
  backgroundColor: string;
}) {
  return (
    <motion.a
      href={config.href}
      aria-label={`${config.title}，${config.description}`}
      initial="rest"
      whileHover="hover"
      whileFocus="hover"
      className={cn(cardClassName, "min-h-44 sm:min-h-52")}
      style={{ backgroundColor }}
    >
      <HeroCardContent config={{ ...config, icon: null }} showIcon={false} />
    </motion.a>
  );
}

function DrawerQuickLinks({ links }: { links: readonly HeroDrawerQuickLinkConfig[] }) {
  return (
    <nav aria-label="快捷访问" className="overflow-hidden rounded-2xl border border-black/[0.06]">
      <ul className="divide-y divide-black/[0.06]">
        {links.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              className="group/quick-link flex items-center justify-between gap-4 bg-white px-4 py-3.5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset focus-visible:outline-none sm:px-5 sm:py-4 sm:text-base"
            >
              <span>{link.label}</span>
              <IconArrowUpRight
                aria-hidden="true"
                className="size-4 shrink-0 text-neutral-400 transition-transform duration-200 group-hover/quick-link:translate-x-0.5 group-hover/quick-link:-translate-y-0.5 sm:size-5"
                stroke={1.7}
              />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function StartHeroCard({
  config,
  drawerColors,
}: {
  config: HeroCardConfig;
  drawerColors: readonly [string, string];
}) {
  const drawerLinks = config.drawerLinks;

  if (!drawerLinks) {
    return <ExternalHeroCard config={config} />;
  }

  return (
    <Drawer showSwipeHandle swipeDirection="down">
      <DrawerTrigger
        render={
          <motion.button
            type="button"
            aria-label={`${config.title}，${config.description}，打开开始使用选项`}
            initial="rest"
            whileHover="hover"
            whileFocus="hover"
            className={cardClassName}
            style={{ backgroundColor: config.backgroundColor }}
          >
            <HeroCardContent config={config} />
          </motion.button>
        }
      />
      <DrawerContent className="mx-auto w-[calc(100%-1rem)] max-w-3xl sm:[--drawer-inset:2rem]">
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            <DrawerLinkCard config={drawerLinks[0]} backgroundColor={drawerColors[0]} />
            <DrawerLinkCard config={drawerLinks[1]} backgroundColor={drawerColors[1]} />
          </div>
          {config.drawerQuickLinks ? (
            <div className="mt-3 sm:mt-4">
              <DrawerQuickLinks links={config.drawerQuickLinks} />
            </div>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function HeroCard({
  config,
  drawerColors,
}: {
  config: HeroCardConfig;
  drawerColors: readonly [string, string];
}) {
  if (config.drawerLinks) {
    return <StartHeroCard config={config} drawerColors={drawerColors} />;
  }

  return config.href.startsWith("/") ? (
    <InternalHeroCard config={config} />
  ) : (
    <ExternalHeroCard config={config} />
  );
}

export function HeroCards({
  top,
  bottom,
  topRatio,
  bottomRatio,
  stackOnMobile = false,
}: HeroCardsProps) {
  validateRatios(topRatio, bottomRatio);

  return (
    <MotionConfig reducedMotion="user">
      <nav
        aria-label="快捷入口"
        className={cn(
          "grid gap-3 sm:gap-4 lg:h-auto lg:min-h-0 lg:grid-cols-1 lg:gap-5 lg:[grid-template-rows:var(--hero-card-rows)]",
          stackOnMobile
            ? "h-auto grid-cols-1 grid-rows-2 [&>a]:min-h-44 sm:h-auto sm:grid-cols-1 sm:grid-rows-2 sm:[&>a]:min-h-48 lg:[&>a]:min-h-0"
            : "h-44 grid-cols-2 grid-rows-1 sm:h-48",
        )}
        style={{ "--hero-card-rows": `${topRatio}fr ${bottomRatio}fr` } as CSSProperties}
      >
        <HeroCard config={top} drawerColors={[top.backgroundColor, bottom.backgroundColor]} />
        <HeroCard config={bottom} drawerColors={[top.backgroundColor, bottom.backgroundColor]} />
      </nav>
    </MotionConfig>
  );
}
