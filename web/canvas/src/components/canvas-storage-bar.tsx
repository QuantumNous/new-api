"use client";

// BUILTIN_MODE: 素材库容量条。展示当前用户 OBS 素材占用与配额,
// 数据来自 new-api /api/canvas/storage;非内置模式不渲染。

import { useEffect, useState } from "react";
import { Progress, Tooltip } from "antd";
import { HardDrive } from "lucide-react";

import { formatBytes } from "@/lib/image-utils";
import { fetchCanvasStorage, type CanvasStorageInfo } from "@/services/api/canvas-assets";

const BUILTIN = process.env.NEXT_PUBLIC_BUILTIN_MODE === "1";

export function CanvasStorageBar({ refreshToken = 0 }: { refreshToken?: number }) {
    const [storage, setStorage] = useState<CanvasStorageInfo | null>(null);

    useEffect(() => {
        if (!BUILTIN) return;
        let cancelled = false;
        fetchCanvasStorage()
            .then((info) => {
                if (!cancelled) setStorage(info);
            })
            .catch(() => {
                if (!cancelled) setStorage(null);
            });
        return () => {
            cancelled = true;
        };
    }, [refreshToken]);

    if (!BUILTIN || !storage) return null;

    const unlimited = storage.limit_bytes < 0;
    const percent = unlimited || storage.limit_bytes === 0 ? 0 : Math.min(100, Math.round((storage.used_bytes / storage.limit_bytes) * 100));
    const status = percent >= 95 ? "exception" : percent >= 80 ? "active" : "normal";
    const label = unlimited ? `${formatBytes(storage.used_bytes)} / 不限` : `${formatBytes(storage.used_bytes)} / ${formatBytes(storage.limit_bytes)}`;

    return (
        <Tooltip title={`素材库云端存储:已用 ${label},共 ${storage.asset_count} 个素材${unlimited ? "" : `,剩余 ${formatBytes(storage.remaining_bytes)}`}`}>
            <div className="mx-auto mt-4 flex w-full max-w-2xl items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                <HardDrive className="size-3.5 shrink-0" />
                <span className="shrink-0">{label}</span>
                {!unlimited && <Progress className="mb-0 flex-1" percent={percent} size="small" status={status} showInfo={false} />}
            </div>
        </Tooltip>
    );
}
