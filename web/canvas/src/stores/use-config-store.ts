"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";

export type ApiCallFormat = "openai" | "gemini";

export type ModelChannel = {
    id: string;
    name: string;
    baseUrl: string;
    apiKey: string;
    apiFormat: ApiCallFormat;
    models: string[];
};

export type AiConfig = {
    channelMode: "remote" | "local";
    baseUrl: string;
    apiKey: string;
    apiFormat: ApiCallFormat;
    channels: ModelChannel[];
    model: string;
    imageModel: string;
    videoModel: string;
    textModel: string;
    audioModel: string;
    audioVoice: string;
    audioFormat: string;
    audioSpeed: string;
    audioInstructions: string;
    videoSeconds: string;
    vquality: string;
    videoGenerateAudio: string;
    videoWatermark: string;
    systemPrompt: string;
    models: string[];
    imageModels: string[];
    videoModels: string[];
    textModels: string[];
    audioModels: string[];
    quality: string;
    size: string;
    count: string;
    canvasImageCount: string;
    modelEndpointTypes: Record<string, string[]>;
};

export type WebdavSyncConfig = {
    proxyMode: "direct" | "nextjs";
    url: string;
    username: string;
    password: string;
    directory: string;
    lastSyncedAt: string;
};

export const CONFIG_STORE_KEY = "infinite-canvas:ai_config_store";
export type ModelCapability = "image" | "video" | "text" | "audio";
const CHANNEL_MODEL_SEPARATOR = "::";
const OPENAI_BASE_URL = "https://api.openai.com";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";

// BUILTIN_MODE: new-api 内置模式。锁定唯一「站内」渠道(baseUrl=/pg,免 API key),
// 禁止外部渠道与 BYO key;模型能力按 new-api /pg/models 返回的 supported_endpoint_types 分类。
export const BUILTIN_MODE = process.env.NEXT_PUBLIC_BUILTIN_MODE === "1";
export const BUILTIN_CHANNEL_ID = "newapi-builtin";

export function createBuiltinChannel(models: string[] = []): ModelChannel {
    return { id: BUILTIN_CHANNEL_ID, name: "站内", baseUrl: "/pg", apiKey: "", apiFormat: "openai", models };
}

export function isBuiltinChannelId(channelId: string | undefined) {
    return BUILTIN_MODE && channelId === BUILTIN_CHANNEL_ID;
}

// 内置模式下站内渠道是唯一渠道且 apiKey 恒为空,以此识别经 resolve 后的请求配置
export function isBuiltinRequestConfig(config: Pick<AiConfig, "apiKey">) {
    return BUILTIN_MODE && !config.apiKey.trim();
}

// BUILTIN_MODE: 模型 -> supported_endpoint_types 元数据(来自 /pg/models),
// persist 存于 AiConfig.modelEndpointTypes;模块级镜像供无 config 上下文的能力判断函数使用。
let builtinEndpointTypesMirror: Record<string, string[]> = {};

export function setBuiltinEndpointTypesMirror(map: Record<string, string[]> | undefined) {
    builtinEndpointTypesMirror = map || {};
}

function builtinEndpointTypes(model: string): string[] | null {
    const types = builtinEndpointTypesMirror[modelOptionName(model)];
    return Array.isArray(types) && types.length ? types : null;
}

function builtinModelMatchesCapability(model: string, capability: ModelCapability) {
    const types = builtinEndpointTypes(model);
    if (!types) {
        // 无元数据(如用户手输的模型名)时回退关键词推断
        if (capability === "image") return isImageModelName(model);
        if (capability === "video") return isVideoModelName(model);
        if (capability === "audio") return isAudioModelName(model);
        return isTextModelName(model);
    }
    if (capability === "image") return types.includes("image-generation");
    if (capability === "video") return types.includes("openai-video");
    if (capability === "audio") return types.includes("audio-speech");
    // text/助手:responses 优先;仅 openai 的模型排除纯图片/视频/音频模型
    return types.includes("openai-response") || (types.includes("openai") && !types.includes("image-generation") && !types.includes("openai-video") && !types.includes("audio-speech"));
}

export const defaultConfig: AiConfig = {
    channelMode: "local",
    baseUrl: OPENAI_BASE_URL,
    apiKey: "",
    apiFormat: "openai",
    channels: [
        {
            id: "default",
            name: "默认渠道",
            baseUrl: OPENAI_BASE_URL,
            apiKey: "",
            apiFormat: "openai",
            models: ["gpt-image-2", "grok-imagine-video", "gpt-5.5", "gpt-4o-mini-tts"],
        },
    ],
    model: "default::gpt-image-2",
    imageModel: "default::gpt-image-2",
    videoModel: "default::grok-imagine-video",
    textModel: "default::gpt-5.5",
    audioModel: "default::gpt-4o-mini-tts",
    audioVoice: "alloy",
    audioFormat: "mp3",
    audioSpeed: "1",
    audioInstructions: "",
    videoSeconds: "6",
    vquality: "720",
    videoGenerateAudio: "true",
    videoWatermark: "false",
    systemPrompt: "",
    models: ["default::gpt-image-2", "default::grok-imagine-video", "default::gpt-5.5", "default::gpt-4o-mini-tts"],
    imageModels: ["default::gpt-image-2"],
    videoModels: ["default::grok-imagine-video"],
    textModels: ["default::gpt-5.5"],
    audioModels: ["default::gpt-4o-mini-tts"],
    quality: "auto",
    size: "1:1",
    count: "1",
    canvasImageCount: "3",
    modelEndpointTypes: {},
};

if (BUILTIN_MODE) {
    // 内置模式:唯一「站内」渠道,模型列表由 /pg/models 拉取,无预置模型
    defaultConfig.channels = [createBuiltinChannel()];
    defaultConfig.model = "";
    defaultConfig.imageModel = "";
    defaultConfig.videoModel = "";
    defaultConfig.textModel = "";
    defaultConfig.audioModel = "";
    defaultConfig.models = [];
    defaultConfig.imageModels = [];
    defaultConfig.videoModels = [];
    defaultConfig.textModels = [];
    defaultConfig.audioModels = [];
}

export const defaultWebdavSyncConfig: WebdavSyncConfig = {
    proxyMode: "direct",
    url: "",
    username: "",
    password: "",
    directory: "infinite-canvas",
    lastSyncedAt: "",
};

type ConfigStore = {
    config: AiConfig;
    webdav: WebdavSyncConfig;
    isConfigOpen: boolean;
    shouldPromptContinue: boolean;
    updateConfig: <K extends keyof AiConfig>(key: K, value: AiConfig[K]) => void;
    updateWebdavConfig: <K extends keyof WebdavSyncConfig>(key: K, value: WebdavSyncConfig[K]) => void;
    isAiConfigReady: (config: AiConfig, model: string) => boolean;
    openConfigDialog: (shouldPromptContinue?: boolean) => void;
    setConfigDialogOpen: (isOpen: boolean) => void;
    clearPromptContinue: () => void;
};

function isVideoModelName(model: string) {
    const value = modelOptionName(model).toLowerCase();
    return value.includes("seedance") || value.includes("video") || value.includes("sora") || value.includes("veo") || value.includes("kling") || value.includes("wan") || value.includes("hailuo");
}

function isImageModelName(model: string) {
    const value = modelOptionName(model).toLowerCase();
    return !isVideoModelName(model) && !isAudioModelName(model) && (value.includes("seedream") || value.includes("gpt-image") || value.includes("image") || value.includes("dall-e") || value.includes("dalle") || value.includes("imagen") || value.includes("flux") || value.includes("sdxl") || value.includes("stable-diffusion") || value.includes("midjourney"));
}

function isAudioModelName(model: string) {
    const value = modelOptionName(model).toLowerCase();
    return value.includes("audio") || value.includes("tts") || value.includes("speech") || value.includes("voice") || value.includes("music") || value.includes("sound");
}

function isTextModelName(model: string) {
    return !isImageModelName(model) && !isVideoModelName(model) && !isAudioModelName(model);
}

export function modelMatchesCapability(model: string, capability?: ModelCapability) {
    if (!capability) return true;
    if (BUILTIN_MODE) return builtinModelMatchesCapability(model, capability);
    if (capability === "image") return isImageModelName(model);
    if (capability === "video") return isVideoModelName(model);
    if (capability === "audio") return isAudioModelName(model);
    return isTextModelName(model);
}

export function filterModelsByCapability(models: string[], capability?: ModelCapability) {
    return capability ? models.filter((model) => modelMatchesCapability(model, capability)) : models;
}

export function selectableModelsByCapability(config: AiConfig, capability?: ModelCapability) {
    if (!capability) return config.models;
    return config[modelListKey(capability)];
}

function modelListKey(capability: ModelCapability) {
    return `${capability}Models` as "imageModels" | "videoModels" | "textModels" | "audioModels";
}

function isAiConfigReady(config: AiConfig, model: string) {
    const channel = resolveModelChannel(config, model);
    // BUILTIN_MODE: 站内渠道走 session 鉴权,无需 API key
    const apiKeyReady = isBuiltinChannelId(channel.id) || Boolean(channel.apiKey.trim());
    return Boolean(model.trim() && channel.baseUrl.trim() && apiKeyReady);
}

export const useConfigStore = create<ConfigStore>()(
    persist(
        (set, get) => ({
            config: defaultConfig,
            webdav: defaultWebdavSyncConfig,
            isConfigOpen: false,
            shouldPromptContinue: false,
            updateConfig: (key, value) =>
                set((state) => {
                    // BUILTIN_MODE: 渠道结构锁定,仅允许更新站内渠道的模型列表
                    if (BUILTIN_MODE && key === "channels") {
                        value = sanitizeBuiltinChannels(value as ModelChannel[]) as AiConfig[typeof key];
                    }
                    if (BUILTIN_MODE && key === "modelEndpointTypes") {
                        setBuiltinEndpointTypesMirror(value as Record<string, string[]>);
                    }
                    return {
                        config: {
                            ...state.config,
                            [key]: value,
                        },
                    };
                }),
            updateWebdavConfig: (key, value) =>
                set((state) => ({
                    webdav: {
                        ...state.webdav,
                        [key]: value,
                    },
                })),
            isAiConfigReady: (config, model) => isAiConfigReady(config, model),
            openConfigDialog: (shouldPromptContinue = false) => set({ isConfigOpen: true, shouldPromptContinue }),
            setConfigDialogOpen: (isConfigOpen) => set({ isConfigOpen }),
            clearPromptContinue: () => set({ shouldPromptContinue: false }),
        }),
        {
            name: CONFIG_STORE_KEY,
            partialize: (state) => ({ config: state.config, webdav: state.webdav }),
            merge: (persisted, current) => {
                const persistedState = (persisted || {}) as Partial<ConfigStore>;
                const persistedConfig = (persistedState.config || {}) as Partial<AiConfig>;
                const persistedWebdav = (persistedState.webdav || {}) as Partial<WebdavSyncConfig>;
                const config = { ...defaultConfig, ...persistedConfig };
                if (!Array.isArray(persistedConfig.channels)) config.channels = [];
                if (BUILTIN_MODE) {
                    // 强制重播种:只保留站内渠道并锁定其 baseUrl/apiKey/apiFormat,
                    // 丢弃所有持久化的外部渠道与 BYO key;保留已拉取的模型列表与能力元数据
                    config.channels = sanitizeBuiltinChannels(config.channels);
                    config.modelEndpointTypes = persistedConfig.modelEndpointTypes && typeof persistedConfig.modelEndpointTypes === "object" ? persistedConfig.modelEndpointTypes : {};
                    setBuiltinEndpointTypesMirror(config.modelEndpointTypes);
                }
                const channels = normalizeChannels(config);
                const models = modelOptionsFromChannels(channels);
                return {
                    ...current,
                    webdav: { ...defaultWebdavSyncConfig, ...persistedWebdav },
                    config: {
                        ...config,
                        channelMode: "local",
                        apiFormat: normalizeApiFormat(config.apiFormat),
                        channels,
                        models,
                        imageModel: normalizeModelOptionValue(config.imageModel || config.model, channels),
                        videoModel: normalizeModelOptionValue(config.videoModel || "grok-imagine-video", channels),
                        textModel: normalizeModelOptionValue(config.textModel || config.model, channels),
                        audioModel: normalizeModelOptionValue(config.audioModel || defaultConfig.audioModel, channels),
                        audioVoice: config.audioVoice || defaultConfig.audioVoice,
                        audioFormat: config.audioFormat || defaultConfig.audioFormat,
                        audioSpeed: config.audioSpeed || defaultConfig.audioSpeed,
                        audioInstructions: config.audioInstructions || "",
                        videoSeconds: config.videoSeconds || "6",
                        vquality: config.vquality || "720",
                        videoGenerateAudio: config.videoGenerateAudio || "true",
                        videoWatermark: config.videoWatermark || "false",
                        canvasImageCount: config.canvasImageCount || "3",
                        imageModels: Array.isArray(persistedConfig.imageModels) ? mergeCapabilityModels(config.imageModels, channels, "image") : filterModelsByCapability(models, "image"),
                        videoModels: Array.isArray(persistedConfig.videoModels) ? mergeCapabilityModels(config.videoModels, channels, "video") : filterModelsByCapability(models, "video"),
                        textModels: Array.isArray(persistedConfig.textModels) ? mergeCapabilityModels(config.textModels, channels, "text") : filterModelsByCapability(models, "text"),
                        audioModels: Array.isArray(persistedConfig.audioModels) ? mergeCapabilityModels(config.audioModels, channels, "audio") : filterModelsByCapability(models, "audio"),
                    },
                };
            },
        },
    ),
);

// BUILTIN_MODE: 持久化的能力列表也要按 supported_endpoint_types 重新过滤,
// 防止旧 localStorage 中按关键词分类的结果绕过端点类型分类
function mergeCapabilityModels(models: string[], channels: ModelChannel[], capability: ModelCapability) {
    const normalized = normalizeModelList(models, channels);
    return BUILTIN_MODE ? filterModelsByCapability(normalized, capability) : normalized;
}

// BUILTIN_MODE: 渠道列表清洗——只保留站内渠道且锁定其连接字段,仅模型列表可变
function sanitizeBuiltinChannels(channels: ModelChannel[] | undefined) {
    const builtin = (Array.isArray(channels) ? channels : []).find((channel) => channel && channel.id === BUILTIN_CHANNEL_ID);
    return [createBuiltinChannel(uniqueRawModels(builtin?.models || []))];
}

function normalizeModelList(models: string[], channels: ModelChannel[]) {
    const allModelOptions = channels.flatMap((channel) => channel.models.map((model) => encodeChannelModel(channel.id, model)));
    return Array.from(new Set((models || []).map((model) => model.trim()).filter(Boolean)))
        .map((model) => normalizeModelOptionValue(model, channels))
        .filter((model) => !allModelOptions.length || allModelOptions.includes(model) || !isChannelModelValue(model));
}

export function useEffectiveConfig() {
    const config = useConfigStore((state) => state.config);
    return useMemo(() => ({ ...config, channelMode: "local" as const }), [config]);
}

export function createModelChannel(channel?: Partial<ModelChannel>): ModelChannel {
    const apiFormat = normalizeApiFormat(channel?.apiFormat);
    return {
        id: channel?.id?.trim() || nanoid(),
        name: channel?.name?.trim() || "新渠道",
        baseUrl: channel?.baseUrl?.trim() || defaultBaseUrlForApiFormat(apiFormat),
        apiKey: channel?.apiKey || "",
        apiFormat,
        models: uniqueRawModels(channel?.models || []),
    };
}

export function encodeChannelModel(channelId: string, model: string) {
    return `${channelId}${CHANNEL_MODEL_SEPARATOR}${model.trim()}`;
}

export function isChannelModelValue(value: string) {
    return value.includes(CHANNEL_MODEL_SEPARATOR);
}

export function decodeChannelModel(value: string) {
    const index = value.indexOf(CHANNEL_MODEL_SEPARATOR);
    if (index < 0) return null;
    return { channelId: value.slice(0, index), model: value.slice(index + CHANNEL_MODEL_SEPARATOR.length) };
}

export function modelOptionName(value: string) {
    return decodeChannelModel(value)?.model || value;
}

export function modelOptionLabel(config: AiConfig, value: string) {
    const decoded = decodeChannelModel(value);
    if (!decoded) return value;
    const channel = config.channels.find((item) => item.id === decoded.channelId);
    return channel ? `${decoded.model}（${channel.name}）` : decoded.model;
}

export function modelOptionsFromChannels(channels: ModelChannel[]) {
    return uniqueModelOptions(channels.flatMap((channel) => channel.models.map((model) => encodeChannelModel(channel.id, model))));
}

export function normalizeModelOptionValue(value: string | undefined, channels: ModelChannel[]) {
    const model = (value || "").trim();
    if (!model) return "";
    const decoded = decodeChannelModel(model);
    if (decoded) {
        const channel = channels.find((item) => item.id === decoded.channelId);
        return channel && channel.models.includes(decoded.model) ? model : "";
    }
    const channel = channels.find((item) => item.models.includes(decoded?.model || model)) || channels[0];
    return channel && channel.models.includes(decoded?.model || model) ? encodeChannelModel(channel.id, decoded?.model || model) : model;
}

export function resolveModelChannel(config: AiConfig, value: string) {
    const decoded = decodeChannelModel(value);
    const model = decoded?.model || value;
    const matched = decoded ? config.channels.find((channel) => channel.id === decoded.channelId) : config.channels.find((channel) => channel.models.includes(model));
    return matched || config.channels[0] || createModelChannel({ id: "default", name: "默认渠道", baseUrl: config.baseUrl, apiKey: config.apiKey, apiFormat: config.apiFormat, models: config.models.map(modelOptionName) });
}

export function resolveModelRequestConfig(config: AiConfig, value: string) {
    const channel = resolveModelChannel(config, value);
    return {
        ...config,
        model: modelOptionName(value || config.model),
        baseUrl: channel.baseUrl,
        apiKey: channel.apiKey,
        apiFormat: channel.apiFormat,
        channelId: channel.id,
    };
}

function normalizeChannels(config: AiConfig) {
    const persistedChannels = Array.isArray(config.channels) ? config.channels : [];
    const channels = persistedChannels.map((channel, index) =>
        createModelChannel({
            ...channel,
            id: channel.id || (index === 0 ? "default" : `channel-${index + 1}`),
            name: channel.name || (index === 0 ? "默认渠道" : `渠道 ${index + 1}`),
            models: uniqueRawModels(channel.models || []),
        }),
    );
    if (!channels.length) {
        channels.push(
            createModelChannel({
                id: "default",
                name: "默认渠道",
                baseUrl: config.baseUrl || defaultConfig.baseUrl,
                apiKey: config.apiKey || "",
                apiFormat: config.apiFormat || defaultConfig.apiFormat,
                models: uniqueRawModels([
                    ...(config.models || []),
                    config.model,
                    config.imageModel,
                    config.videoModel,
                    config.textModel,
                    config.audioModel,
                ]),
            }),
        );
    }
    return channels.map((channel) => ({ ...channel, models: uniqueRawModels(channel.models) }));
}

export function defaultBaseUrlForApiFormat(apiFormat: ApiCallFormat) {
    return apiFormat === "gemini" ? GEMINI_BASE_URL : OPENAI_BASE_URL;
}

function normalizeApiFormat(apiFormat: unknown): ApiCallFormat {
    return apiFormat === "gemini" ? "gemini" : "openai";
}

function uniqueRawModels(models: string[]) {
    return Array.from(new Set((models || []).map((model) => modelOptionName(model).trim()).filter(Boolean)));
}

function uniqueModelOptions(models: string[]) {
    return Array.from(new Set((models || []).map((model) => model.trim()).filter(Boolean)));
}

export function buildApiUrl(baseUrl: string, path: string) {
    let normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "");
    normalizedBaseUrl = normalizeArkPlanBaseUrl(normalizedBaseUrl);
    const lowerBaseUrl = normalizedBaseUrl.toLowerCase();
    const apiBaseUrl = lowerBaseUrl.endsWith("/v1") || lowerBaseUrl.endsWith("/api/v3") || lowerBaseUrl.endsWith("/api/plan/v3") || lowerBaseUrl.endsWith("/pg") ? normalizedBaseUrl : `${normalizedBaseUrl}/v1`;
    return `${apiBaseUrl}${path}`;
}

function normalizeArkPlanBaseUrl(baseUrl: string) {
    try {
        const url = new URL(baseUrl);
        const path = url.pathname.replace(/\/+$/, "");
        const lowerPath = path.toLowerCase();
        const arkPlanIndex = lowerPath.indexOf("/api/plan/v3");
        if (arkPlanIndex < 0) return baseUrl;
        const end = arkPlanIndex + "/api/plan/v3".length;
        if (lowerPath.length !== end && lowerPath[end] !== "/") return baseUrl;
        url.pathname = path.slice(0, end);
        url.search = "";
        url.hash = "";
        return url.toString().replace(/\/+$/, "");
    } catch {
        return baseUrl;
    }
}
