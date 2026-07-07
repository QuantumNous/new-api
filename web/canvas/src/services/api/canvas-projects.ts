// BUILTIN_MODE: 画布项目服务端持久化(new-api /api/canvas/projects)。
// 服务端为准,本地 IndexedDB/localforage 仅作缓存/草稿;所有请求带 New-Api-User 头。

import { builtinHeaders } from "@/lib/builtin-auth";
import type { CanvasProject } from "@/app/(user)/canvas/stores/use-canvas-store";

export type ServerCanvasProject = {
    project_id: string;
    title: string;
    data: string;
    version: number;
    created_at: number;
    updated_at: number;
};

export class CanvasProjectConflictError extends Error {
    server: ServerCanvasProject | null;

    constructor(server: ServerCanvasProject | null) {
        super("画布项目存在更新的服务端版本");
        this.server = server;
    }
}

function apiHeaders(json = false): Record<string, string> {
    return { ...builtinHeaders(), ...(json ? { "Content-Type": "application/json" } : {}) };
}

async function readApiError(response: Response, fallback: string) {
    try {
        const payload = (await response.json()) as { message?: string };
        return payload.message || fallback;
    } catch {
        return fallback;
    }
}

type ApiEnvelope<T> = { success: boolean; message?: string; data?: T };

async function unwrap<T>(response: Response, fallback: string): Promise<T> {
    if (!response.ok) throw new Error(await readApiError(response, `${fallback}（${response.status}）`));
    const payload = (await response.json()) as ApiEnvelope<T>;
    if (!payload.success) throw new Error(payload.message || fallback);
    return payload.data as T;
}

export async function listServerProjects(): Promise<ServerCanvasProject[]> {
    const response = await fetch("/api/canvas/projects", { headers: apiHeaders() });
    return (await unwrap<ServerCanvasProject[]>(response, "获取画布项目失败")) || [];
}

export async function putServerProject(project: CanvasProject, version: number): Promise<ServerCanvasProject> {
    const response = await fetch(`/api/canvas/projects/${encodeURIComponent(project.id)}`, {
        method: "PUT",
        headers: apiHeaders(true),
        body: JSON.stringify({
            title: project.title,
            data: JSON.stringify(project),
            version,
            updated_at: Date.parse(project.updatedAt) || Date.now(),
        }),
    });
    if (response.status === 409) {
        const payload = (await response.json().catch(() => null)) as ApiEnvelope<ServerCanvasProject> | null;
        throw new CanvasProjectConflictError(payload?.data || null);
    }
    return unwrap<ServerCanvasProject>(response, "保存画布项目失败");
}

export async function deleteServerProject(projectId: string): Promise<void> {
    const response = await fetch(`/api/canvas/projects/${encodeURIComponent(projectId)}`, {
        method: "DELETE",
        headers: apiHeaders(),
    });
    if (!response.ok) throw new Error(await readApiError(response, `删除画布项目失败（${response.status}）`));
}

export function parseServerProject(server: ServerCanvasProject): CanvasProject | null {
    try {
        const parsed = JSON.parse(server.data) as CanvasProject;
        if (!parsed || typeof parsed !== "object" || !parsed.id) return null;
        return { ...parsed, id: server.project_id, title: server.title || parsed.title };
    } catch {
        return null;
    }
}
