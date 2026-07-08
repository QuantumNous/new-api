// BUILTIN_MODE: 画布项目「服务端为准、本地为缓存」同步引擎。
// 启动时拉服务端列表合并本地缓存;之后订阅 store 变更,按项目 debounce 推送;
// 409 冲突不静默覆盖,提示用户选择覆盖服务端或加载服务端版本(v1 用 confirm 简化)。

import { useCanvasStore, type CanvasProject } from "@/app/(user)/canvas/stores/use-canvas-store";
import { CanvasProjectConflictError, deleteServerProject, listServerProjects, parseServerProject, putServerProject, type ServerCanvasProject } from "@/services/api/canvas-projects";

const BUILTIN = process.env.NEXT_PUBLIC_BUILTIN_MODE === "1";
const SAVE_DEBOUNCE_MS = 1200;

let started = false;
const serverVersions = new Map<string, number>();
const lastSyncedUpdatedAt = new Map<string, string>();
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function initCanvasServerSync() {
    if (!BUILTIN || started || typeof window === "undefined") return;
    started = true;
    void bootstrap();
}

async function bootstrap() {
    await waitForLocalHydration();
    let serverProjects: ServerCanvasProject[];
    try {
        serverProjects = await listServerProjects();
    } catch (error) {
        console.warn("[canvas-sync] 拉取服务端画布项目失败,暂用本地缓存:", error);
        subscribeStore();
        return;
    }

    const local = useCanvasStore.getState().projects;
    const localById = new Map(local.map((project) => [project.id, project]));
    const merged: CanvasProject[] = [];
    const seen = new Set<string>();

    for (const server of serverProjects) {
        serverVersions.set(server.project_id, server.version);
        const parsed = parseServerProject(server);
        const localProject = localById.get(server.project_id);
        seen.add(server.project_id);
        if (!parsed) {
            if (localProject) merged.push(localProject);
            continue;
        }
        if (localProject && Date.parse(localProject.updatedAt) > server.updated_at) {
            // 本地草稿更新,保留并稍后推送
            merged.push(localProject);
            scheduleSave(localProject.id);
        } else {
            merged.push(parsed);
            lastSyncedUpdatedAt.set(parsed.id, parsed.updatedAt);
        }
    }
    // 本地独有(未同步草稿)→ 保留并推送
    for (const project of local) {
        if (seen.has(project.id)) continue;
        merged.push(project);
        scheduleSave(project.id);
    }

    merged.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    useCanvasStore.getState().replaceProjects(merged);
    subscribeStore();
}

function waitForLocalHydration(): Promise<void> {
    return new Promise((resolve) => {
        if (useCanvasStore.getState().hydrated) {
            resolve();
            return;
        }
        const unsubscribe = useCanvasStore.subscribe((state) => {
            if (state.hydrated) {
                unsubscribe();
                resolve();
            }
        });
    });
}

function subscribeStore() {
    let previous = useCanvasStore.getState().projects;
    useCanvasStore.subscribe((state) => {
        const current = state.projects;
        if (current === previous) return;
        const previousById = new Map(previous.map((project) => [project.id, project]));
        for (const project of current) {
            const before = previousById.get(project.id);
            if (!before || before.updatedAt !== project.updatedAt || before.title !== project.title) {
                scheduleSave(project.id);
            }
            previousById.delete(project.id);
        }
        // 本地删除 → 同步删除服务端
        for (const removedId of previousById.keys()) {
            cancelSave(removedId);
            void deleteServerProject(removedId).catch((error) => {
                console.warn(`[canvas-sync] 删除服务端项目 ${removedId} 失败:`, error);
            });
            serverVersions.delete(removedId);
            lastSyncedUpdatedAt.delete(removedId);
        }
        previous = current;
    });
}

function cancelSave(projectId: string) {
    const timer = saveTimers.get(projectId);
    if (timer) {
        clearTimeout(timer);
        saveTimers.delete(projectId);
    }
}

function scheduleSave(projectId: string) {
    cancelSave(projectId);
    saveTimers.set(
        projectId,
        setTimeout(() => {
            saveTimers.delete(projectId);
            void saveProject(projectId);
        }, SAVE_DEBOUNCE_MS),
    );
}

async function saveProject(projectId: string) {
    const project = useCanvasStore.getState().projects.find((item) => item.id === projectId);
    if (!project) return;
    if (lastSyncedUpdatedAt.get(projectId) === project.updatedAt) return;
    try {
        const saved = await putServerProject(project, serverVersions.get(projectId) || 0);
        serverVersions.set(projectId, saved.version);
        lastSyncedUpdatedAt.set(projectId, project.updatedAt);
    } catch (error) {
        if (error instanceof CanvasProjectConflictError) {
            resolveConflict(project, error.server);
            return;
        }
        console.warn(`[canvas-sync] 保存项目 ${projectId} 失败,稍后重试:`, error);
        scheduleSave(projectId);
    }
}

function resolveConflict(local: CanvasProject, server: ServerCanvasProject | null) {
    const parsed = server ? parseServerProject(server) : null;
    if (!parsed || !server) {
        // 读不到服务端版本,保守起见提升本地版本重试覆盖
        serverVersions.set(local.id, (serverVersions.get(local.id) || 0) + 1);
        scheduleSave(local.id);
        return;
    }
    const overwrite = window.confirm(`画布「${local.title}」在其他设备/浏览器上有更新版本。\n\n确定=用当前本地版本覆盖服务端\n取消=加载服务端版本(本地未同步修改将丢失)`);
    serverVersions.set(local.id, server.version);
    if (overwrite) {
        scheduleSave(local.id);
    } else {
        lastSyncedUpdatedAt.set(local.id, parsed.updatedAt);
        const projects = useCanvasStore.getState().projects.map((item) => (item.id === local.id ? parsed : item));
        useCanvasStore.getState().replaceProjects(projects);
    }
}
