"use client";

import { preload } from "react-dom";

const LOADING_TRANSITION_IMAGE_PRELOADS = ["/flatkey-mark.svg"] as const;

export function LoadingTransitionPreloads() {
  for (const href of LOADING_TRANSITION_IMAGE_PRELOADS) {
    preload(href, { as: "image", type: "image/svg+xml" });
  }

  return null;
}
