"use client";

import Image from "next/image";
import { motion, MotionConfig, type Variants } from "motion/react";

export interface VoucherImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

interface VoucherArtworkProps {
  images: VoucherImage[];
}

const topVoucherVariants: Variants = {
  rest: { x: 0, y: 0, rotate: -5, scale: 1 },
  hover: { x: -7, y: -13, rotate: -2, scale: 1.02 },
};

const bottomVoucherVariants: Variants = {
  rest: { x: 0, y: 0, rotate: 4, scale: 1 },
  hover: { x: 8, y: 15, rotate: 1.5, scale: 1.02 },
};

const springTransition = {
  type: "spring" as const,
  stiffness: 260,
  damping: 18,
  mass: 0.8,
};

const placements = [
  {
    className:
      "absolute top-[9%] left-[1%] z-20 w-[96%] will-change-transform sm:top-[12%] lg:top-[18%]",
    variants: topVoucherVariants,
  },
  {
    className:
      "absolute top-[39%] right-[1%] z-10 w-[94%] will-change-transform sm:top-[43%] lg:top-[47%]",
    variants: bottomVoucherVariants,
  },
];

export function VoucherArtwork({ images }: VoucherArtworkProps) {
  return (
    <MotionConfig reducedMotion="user" transition={springTransition}>
      <motion.div
        initial="rest"
        whileHover="hover"
        className="relative h-full min-h-56 w-full overflow-visible sm:min-h-64 lg:min-h-0"
      >
        {images.map((image, index) => {
          const placement = placements[index % placements.length];

          return (
            <motion.div
              key={image.src}
              variants={placement.variants}
              className={placement.className}
            >
              <Image
                src={image.src}
                alt={image.alt}
                width={image.width}
                height={image.height}
                loading="eager"
                sizes="(min-width: 1024px) 34vw, (min-width: 640px) 70vw, 92vw"
                className="h-auto w-full select-none"
              />
            </motion.div>
          );
        })}
      </motion.div>
    </MotionConfig>
  );
}
