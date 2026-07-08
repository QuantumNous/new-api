"use client";

import type { WebdavSyncConfig } from "@/stores/use-config-store";

export const WEBDAV_MANIFEST_FILE_NAME = "manifest.json";
const WEBDAV_REQUEST_TIMEOUT_MS = 120000;
const ensuredDirectories = new Set<string>();


// BUILTIN_MODE: 内置模式不支持 WebDAV 同步(UI 已隐藏,此处双保险)
function assertWebdavAllowed() {
    if (process.env.NEXT_PUBLIC_BUILTIN_MODE === "1") {
        throw new Error("内置模式不支持 WebDAV 同步");
    }
}

export async function testWebdavConnection(config: WebdavSyncConfig) {
    assertWebdavAllowed();
    await ensureWebdavDirectory(config);
    const response = await webdavFetch(config, "", { method: "PROPFIND", headers: { Depth: "0" } });
    if (response.ok || response.status === 207) return;
    await throwWebdavError(response, "WebDAV 连接测试失败");
}

export async function downloadWebdavSyncFile(config: WebdavSyncConfig) {
    assertWebdavAllowed();
    return downloadWebdavFile(config, WEBDAV_MANIFEST_FILE_NAME);
}

export async function downloadWebdavFile(config: WebdavSyncConfig, path: string) {
    assertWebdavAllowed();
    await ensureWebdavDirectory(config);
    const response = await webdavFetch(config, path, { method: "GET" });
    if (response.status === 404) return null;
    if (!response.ok) await throwWebdavError(response, "读取 WebDAV 同步文件失败");
    const file = await withTimeout(response.blob(), "读取 WebDAV 同步文件超时");
    return file.size ? file : null;
}

export async function uploadWebdavSyncFile(config: WebdavSyncConfig, file: Blob) {
    assertWebdavAllowed();
    return uploadWebdavFile(config, WEBDAV_MANIFEST_FILE_NAME, file, "application/json");
}

export async function uploadWebdavFile(config: WebdavSyncConfig, path: string, file: Blob, contentType = "application/octet-stream") {
    assertWebdavAllowed();
    if (!file.size) throw new Error("上传文件为空，已取消上传");
    await ensureWebdavDirectory(config);
    await ensureWebdavSubdirectory(config, path);
    const response = await webdavFetch(config, path, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
    });
    if (!response.ok) await throwWebdavError(response, "上传 WebDAV 同步文件失败");
}

async function ensureWebdavDirectory(config: WebdavSyncConfig) {
    assertWebdavConfig(config);
    await ensureWebdavDirectoryPath(config, config.directory);
}

async function ensureWebdavSubdirectory(config: WebdavSyncConfig, path: string) {
    const directory = normalizePath(path).split("/").slice(0, -1).join("/");
    if (!directory) return;
    await ensureWebdavDirectoryPath(config, [config.directory, directory].filter(Boolean).join("/"));
}

async function ensureWebdavDirectoryPath(config: WebdavSyncConfig, directory: string) {
    const parts = normalizePath(directory).split("/").filter(Boolean);
    const cacheKey = `${config.proxyMode}:${config.url}:${parts.join("/")}`;
    if (ensuredDirectories.has(cacheKey)) return;
    let path = "";
    for (const part of parts) {
        path = path ? `${path}/${part}` : part;
        const response = await webdavFetch({ ...config, directory: "" }, path, { method: "MKCOL" });
        if (response.ok || ((response.status === 405 || response.status === 423) && (await webdavDirectoryExists(config, path)))) continue;
        await throwWebdavError(response, "创建 WebDAV 远程目录失败");
    }
    ensuredDirectories.add(cacheKey);
}

async function webdavDirectoryExists(config: WebdavSyncConfig, path: string) {
    const response = await webdavFetch({ ...config, directory: "" }, path, { method: "PROPFIND", headers: { Depth: "0" } });
    return response.ok || response.status === 207;
}

async function webdavFetch(config: WebdavSyncConfig, path: string, init: RequestInit) {
    const headers = new Headers(init.headers);
    if (config.username || config.password) headers.set("Authorization", `Basic ${encodeBasicAuth(`${config.username}:${config.password}`)}`);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), WEBDAV_REQUEST_TIMEOUT_MS);
    try {
        const url = buildWebdavUrl(config, path);
        if (config.proxyMode === "nextjs") return await fetch("/webdav-proxy", { method: "POST", headers: proxyHeaders(url, init.method || "GET", headers), body: proxyBody(init), signal: controller.signal });
        return await fetch(url, { ...init, headers, signal: controller.signal });
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") throw new Error("WebDAV 请求超时，请检查网络、代理或远端服务状态");
        if (error instanceof TypeError) throw new Error("无法连接 WebDAV，请检查地址、HTTPS 证书、CORS 或网络状态");
        throw error;
    } finally {
        window.clearTimeout(timer);
    }
}

function proxyHeaders(target: string, method: string, headers: Headers) {
    const proxyHeaders = new Headers({
        "x-webdav-target": target,
        "x-webdav-method": method,
    });
    copyProxyHeader(headers, proxyHeaders, "Authorization", "x-webdav-authorization");
    copyProxyHeader(headers, proxyHeaders, "Depth", "x-webdav-depth");
    copyProxyHeader(headers, proxyHeaders, "Destination", "x-webdav-destination");
    copyProxyHeader(headers, proxyHeaders, "Overwrite", "x-webdav-overwrite");
    copyProxyHeader(headers, proxyHeaders, "Content-Type", "x-webdav-content-type");
    const contentType = headers.get("Content-Type");
    if (contentType) proxyHeaders.set("Content-Type", contentType);
    return proxyHeaders;
}

function copyProxyHeader(from: Headers, to: Headers, source: string, target: string) {
    const value = from.get(source);
    if (value) to.set(target, value);
}

function proxyBody(init: RequestInit) {
    const method = (init.method || "GET").toUpperCase();
    if (method === "GET" || method === "HEAD") return undefined;
    return init.body || undefined;
}

function buildWebdavUrl(config: WebdavSyncConfig, path: string) {
    const baseUrl = config.url.trim().replace(/\/+$/, "");
    const remotePath = [normalizePath(config.directory), normalizePath(path)].filter(Boolean).join("/");
    if (!remotePath) return baseUrl;
    return `${baseUrl}/${remotePath.split("/").map(encodeURIComponent).join("/")}`;
}

function normalizePath(path: string) {
    return path.trim().replace(/^\/+|\/+$/g, "");
}

function assertWebdavConfig(config: WebdavSyncConfig) {
    if (!config.url.trim()) throw new Error("请先填写 WebDAV 地址");
}

async function throwWebdavError(response: Response, fallback: string): Promise<never> {
    const detail = await response.text().catch(() => "");
    if (response.status === 401 || response.status === 403) throw new Error("WebDAV 认证失败，请检查用户名、密码或应用密码");
    if (response.status === 404) throw new Error("WebDAV 路径不存在，请检查地址和远程目录");
    throw new Error(`${fallback}：${response.status}${detail ? ` ${detail.slice(0, 120)}` : ""}`);
}

function encodeBasicAuth(value: string) {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary);
}

function withTimeout<T>(promise: Promise<T>, message: string) {
    return new Promise<T>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error(message)), WEBDAV_REQUEST_TIMEOUT_MS);
        promise.then(resolve, reject).finally(() => window.clearTimeout(timer));
    });
}
