"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import { CanvasNodeType, type CanvasNodeData, type ViewportTransform } from "../types";

export function Minimap({ nodes, viewport, viewportSize, onViewportChange }: { nodes: CanvasNodeData[]; viewport: ViewportTransform; viewportSize: { width: number; height: number }; onViewportChange: (viewport: ViewportTransform) => void }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const width = 240;
    const height = 160;

    const { worldBounds, scale, offset } = useMemo(() => {
        if (!nodes.length) {
            return { worldBounds: { x: -500, y: -500, w: 1000, h: 1000 }, scale: 0.16, offset: { x: 40, y: 0 } };
        }

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        nodes.forEach((node) => {
            minX = Math.min(minX, node.position.x);
            minY = Math.min(minY, node.position.y);
            maxX = Math.max(maxX, node.position.x + node.width);
            maxY = Math.max(maxY, node.position.y + node.height);
        });

        minX -= 500;
        minY -= 500;
        maxX += 500;
        maxY += 500;

        const boundsWidth = maxX - minX;
        const boundsHeight = maxY - minY;
        const nextScale = Math.min(width / boundsWidth, height / boundsHeight);
        const mapContentW = boundsWidth * nextScale;
        const mapContentH = boundsHeight * nextScale;

        return {
            worldBounds: { x: minX, y: minY, w: boundsWidth, h: boundsHeight },
            scale: nextScale,
            offset: { x: (width - mapContentW) / 2, y: (height - mapContentH) / 2 },
        };
    }, [nodes]);

    const toMinimap = useCallback(
        (worldX: number, worldY: number) => {
            return {
                x: (worldX - worldBounds.x) * scale + offset.x,
                y: (worldY - worldBounds.y) * scale + offset.y,
            };
        },
        [offset.x, offset.y, scale, worldBounds.x, worldBounds.y],
    );

    const toWorld = useCallback(
        (minimapX: number, minimapY: number) => {
            return {
                x: (minimapX - offset.x) / scale + worldBounds.x,
                y: (minimapY - offset.y) / scale + worldBounds.y,
            };
        },
        [offset.x, offset.y, scale, worldBounds.x, worldBounds.y],
    );

    const viewportRect = useMemo(() => {
        const vx = -viewport.x / viewport.k;
        const vy = -viewport.y / viewport.k;
        const vw = viewportSize.width / viewport.k;
        const vh = viewportSize.height / viewport.k;
        const p1 = toMinimap(vx, vy);
        const p2 = toMinimap(vx + vw, vy + vh);

        return {
            x: p1.x,
            y: p1.y,
            w: Math.max(p2.x - p1.x, 4),
            h: Math.max(p2.y - p1.y, 4),
        };
    }, [toMinimap, viewport.k, viewport.x, viewport.y, viewportSize.height, viewportSize.width]);

    const updateViewportFromEvent = (event: React.PointerEvent) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const world = toWorld(event.clientX - rect.left, event.clientY - rect.top);
        onViewportChange({
            x: viewportSize.width / 2 - world.x * viewport.k,
            y: viewportSize.height / 2 - world.y * viewport.k,
            k: viewport.k,
        });
    };

    return (
        <div className="absolute bottom-24 left-6 z-50 overflow-hidden rounded-lg border shadow-2xl backdrop-blur-sm" style={{ width, height, background: theme.toolbar.panel, borderColor: theme.toolbar.border }}>
            <div
                ref={containerRef}
                className="relative h-full w-full cursor-crosshair"
                onPointerDown={(event) => {
                    event.preventDefault();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setIsDragging(true);
                    updateViewportFromEvent(event);
                }}
                onPointerMove={(event) => {
                    if (isDragging) updateViewportFromEvent(event);
                }}
                onPointerUp={() => setIsDragging(false)}
                onPointerLeave={() => setIsDragging(false)}
            >
                {nodes.map((node) => {
                    const pos = toMinimap(node.position.x, node.position.y);
                    const color = node.type === CanvasNodeType.Image ? "#10b981" : node.type === CanvasNodeType.Video ? "#f97316" : node.type === CanvasNodeType.Audio ? "#a855f7" : node.type === CanvasNodeType.Config ? "#60a5fa" : theme.node.muted;
                    return (
                        <div
                            key={node.id}
                            className="absolute rounded-[1px]"
                            style={{
                                left: pos.x,
                                top: pos.y,
                                width: Math.max(node.width * scale, 2),
                                height: Math.max(node.height * scale, 2),
                                backgroundColor: color,
                                opacity: 0.8,
                            }}
                        />
                    );
                })}
                <div className="pointer-events-none absolute border" style={{ left: viewportRect.x, top: viewportRect.y, width: viewportRect.w, height: viewportRect.h, borderColor: theme.node.activeStroke, background: `${theme.node.activeStroke}18` }} />
            </div>
        </div>
    );
}
