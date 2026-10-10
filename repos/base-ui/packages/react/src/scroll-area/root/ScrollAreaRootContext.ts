'use client';
import * as React from 'react';
import type {
  Coords,
  HiddenState,
  OverflowEdges,
  Size,
  ScrollAreaRootState,
} from './ScrollAreaRoot';

export interface ScrollAreaRootContext {
  cornerSize: Size;
  setCornerSize: React.Dispatch<React.SetStateAction<Size>>;
  thumbSize: Size;
  setThumbSize: React.Dispatch<React.SetStateAction<Size>>;
  hasMeasuredScrollbar: boolean;
  setHasMeasuredScrollbar: React.Dispatch<React.SetStateAction<boolean>>;
  touchModality: boolean;
  hovering: boolean;
  setHovering: React.Dispatch<React.SetStateAction<boolean>>;
  scrollingX: boolean;
  setScrollingX: React.Dispatch<React.SetStateAction<boolean>>;
  scrollingY: boolean;
  setScrollingY: React.Dispatch<React.SetStateAction<boolean>>;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  rootRef: React.RefObject<HTMLDivElement | null>;
  scrollbarYRef: React.RefObject<HTMLDivElement | null>;
  thumbYRef: React.RefObject<HTMLDivElement | null>;
  scrollbarXRef: React.RefObject<HTMLDivElement | null>;
  thumbXRef: React.RefObject<HTMLDivElement | null>;
  cornerRef: React.RefObject<HTMLDivElement | null>;
  handlePointerDown: (event: React.PointerEvent) => void;
  handlePointerMove: (event: React.PointerEvent) => void;
  handlePointerUp: (event: React.PointerEvent) => void;
  handleScroll: (scrollPosition: Coords) => void;
  rootId: string | undefined;
  hiddenState: HiddenState;
  setHiddenState: React.Dispatch<React.SetStateAction<HiddenState>>;
  overflowEdges: OverflowEdges;
  setOverflowEdges: React.Dispatch<React.SetStateAction<OverflowEdges>>;
  viewportState: ScrollAreaRootState;
  overflowEdgeThreshold: {
    xStart: number;
    xEnd: number;
    yStart: number;
    yEnd: number;
  };
}

export const ScrollAreaRootContext = React.createContext<ScrollAreaRootContext | undefined>(
  undefined,
);

export function useScrollAreaRootContext() {
  const context = React.useContext(ScrollAreaRootContext);
  if (context === undefined) {
    throw new Error(
      'Base UI: ScrollAreaRootContext is missing. ScrollArea parts must be placed within <ScrollArea.Root>.',
    );
  }
  return context;
}
