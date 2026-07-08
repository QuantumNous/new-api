// BUILTIN_MODE: 画布素材库服务端 API(new-api /api/canvas/assets)。
// 素材二进制存 OBS,storageKey 采用 `ca:<asset_id>` 前缀;本地 IndexedDB 仅作缓存,
// 换设备/清缓存后通过短期签名 URL 恢复。所有请求带 New-Api-User 头。

import { builtinHeaders } from "@/lib/builtin-auth";

export const SERVER_ASSET_PREFIX = "ca:";

export type ServerCanvasAsset = {
    asset_id: string;
    name: string;
    media_type: string;
    mime_type: string;
    size_bytes: number;
    created_at: number;
};

export type CanvasStorageInfo = {
    used_bytes: number;
    limit_bytes: number;
    remaining_bytes: number;
    asset_count: number;
};

type ApiEnvelope<T> = { success: boolean; message?: string; data?: T };

export function isServerAssetKey(storageKey: string | undefined): boolean {
    return Boolean(storageKey && storageKey.startsWith(SERVER_ASSET_PREFIX));
}

export function serverAssetId(storageKey: string): string {
    return storageKey.slice(SERVER_ASSET_PREFIX.length);
}

async function unwrap<T>(response: Response, fallback: string): Promise<T> {
    let payload: ApiEnvelope<T> | null = null;
    try {
        payload = (await response.json()) as ApiEnvelope<T>;
    } catch {
        // ignore
    }
    if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || `${fallback}（${response.status}）`);
    }
    return payload.data as T;
}

export async function uploadAssetToServer(blob: Blob, name = "", projectId = ""): Promise<ServerCanvasAsset> {
    const formData = new FormData();
    const fileName = name || `asset.${(blob.type.split("/")[1] || "bin").split(";")[0]}`;
    formData.set("file", new File([blob], fileName, { type: blob.type }));
    if (projectId) formData.set("project_id", projectId);
    const response = await fetch("/api/canvas/assets/upload", {
        method: "POST",
        headers: builtinHeaders(),
        body: formData,
    });
    return unwrap<ServerCanvasAsset>(response, "上传素材失败");
}

// 签名 URL 会话内缓存(服务端默认 7 天有效,缓存 1 小时足够安全)
const signedUrlCache = new Map<string, { url: string; fetchedAt: number }>();
const SIGNED_URL_CACHE_TTL = 60 * 60 * 1000;

export async function fetchServerAssetUrl(assetId: string): Promise<string> {
    const cached = signedUrlCache.get(assetId);
    if (cached && Date.now() - cached.fetchedAt < SIGNED_URL_CACHE_TTL) return cached.url;
    const response = await fetch(`/api/canvas/assets/${encodeURIComponent(assetId)}/url`, { headers: builtinHeaders() });
    const data = await unwrap<{ url: string }>(response, "获取素材链接失败");
    signedUrlCache.set(assetId, { url: data.url, fetchedAt: Date.now() });
    return data.url;
}

export async function deleteServerAsset(assetId: string): Promise<void> {
    const response = await fetch(`/api/canvas/assets/${encodeURIComponent(assetId)}`, {
        method: "DELETE",
        headers: builtinHeaders(),
    });
    if (!response.ok && response.status !== 404) {
        await unwrap(response, "删除素材失败");
    }
    signedUrlCache.delete(assetId);
}

export async function fetchCanvasStorage(): Promise<CanvasStorageInfo> {
    const response = await fetch("/api/canvas/storage", { headers: builtinHeaders() });
    return unwrap<CanvasStorageInfo>(response, "获取素材库容量失败");
}
