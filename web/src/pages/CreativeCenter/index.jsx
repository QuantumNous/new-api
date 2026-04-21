import React, { useContext, useMemo, useRef, useState, useEffect } from 'react';
import { SSE } from 'sse.js';
import {
  ArrowUp,
  Check,
  CheckSquare,
  ChevronDown,
  Clock,
  Copy,
  Eye,
  History,
  Image as ImageIcon,
  Layers,
  Loader2,
  MessageSquare,
  Plus,
  Square,
  Video,
  Download,
  Trash2,
  User,
  Sparkles,
  Send,
  X,
  ImagePlus,
  Wallet
} from 'lucide-react';
import {
  API,
  buildApiPayload,
  buildMessageContent,
  getChannelIcon,
  getLobeHubIcon,
  getUserIdFromLocalStorage,
  processGroupsData,
  processThinkTags,
  showWarning,
} from '../../helpers';
import { API_ENDPOINTS } from '../../constants/playground.constants';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';

const tabs = [
  { id: 'chat', label: '对话', icon: MessageSquare },
  { id: 'image', label: '图片', icon: ImageIcon },
  { id: 'video', label: '视频', icon: Video, badge: 'HOT' },
];

const GROK_IMAGINE_IMAGE_MODELS = new Set([
  'grok-imagine-1.0',
  'grok-imagine-1.0-fast',
  'grok-imagine-1.0-edit',
]);
const GROK_IMAGE_EDIT_MODELS = new Set(['grok-imagine-1.0-edit']);
const GROK_IMAGE_GENERATION_MODELS = new Set([
  'grok-imagine-1.0',
  'grok-imagine-1.0-fast',
]);
const ADOBE_IMAGE_MODELS = new Set([
  'nano-banana',
  'nano-banana2',
  'nano-banana-pro',
]);
const ADOBE_CHAT_IMAGE_MODELS = new Set([
  'nano-banana2',
  'nano-banana-pro',
]);
const ADOBE_VIDEO_MODELS = new Set([
  'sora2',
  'sora2-pro',
  'veo31',
  'veo31-ref',
  'veo31-fast',
]);
const CREATIVE_CENTER_IMAGE_UPLOAD_LIMITS = {
  'grok-imagine-1.0-edit': 3,
  'grok-imagine-1.0-video': 7,
  'nano-banana': 4,
  'nano-banana2': 6,
  'nano-banana-pro': 6,
  'sora2': 1,
  'sora2-pro': 1,
  'veo31-fast': 2,
  'veo31-ref': 3,
};

const GROK_IMAGE_SIZE_OPTIONS = [
  { label: '3:2', value: '1792x1024' },
  { label: '2:3', value: '1024x1792' },
  { label: '16:9', value: '1280x720' },
  { label: '9:16', value: '720x1280' },
  { label: '1:1', value: '1024x1024' },
];
const DEFAULT_ADOBE_IMAGE_ASPECT_RATIO_OPTIONS = [
  { label: 'Auto', value: 'auto' },
  { label: '1:1', value: '1:1' },
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' },
  { label: '4:3', value: '4:3' },
  { label: '3:4', value: '3:4' },
];
const CHAT_ADOBE_IMAGE_ASPECT_RATIO_OPTIONS = [
  { label: '1:1', value: '1:1' },
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' },
  { label: '4:3', value: '4:3' },
  { label: '3:4', value: '3:4' },
];
const ADOBE_AUTO_IMAGE_SIZE_OPTIONS = [
  { label: '1024x1024', value: '1024x1024' },
  { label: '1792x1024', value: '1792x1024' },
  { label: '1024x1792', value: '1024x1792' },
  { label: '2048x1536', value: '2048x1536' },
  { label: '1536x2048', value: '1536x2048' },
];
const ADOBE_OUTPUT_RESOLUTION_OPTIONS = [
  { label: '1K', value: '1K' },
  { label: '2K', value: '2K' },
  { label: '4K', value: '4K' },
];
const GENERIC_VIDEO_SIZE_OPTIONS = [
  { label: '3:2', value: '1792x1024' },
  { label: '2:3', value: '1024x1792' },
  { label: '16:9', value: '1280x720' },
  { label: '9:16', value: '720x1280' },
  { label: '1:1', value: '1024x1024' },
];
const GENERIC_VIDEO_SECONDS_OPTIONS = [6, 8, 10, 12, 15, 20, 25, 30].map(
  (value) => ({ label: `${value}s`, value: String(value) }),
);
const GROK_IMAGINE_VIDEO_SECONDS_OPTIONS = [6, 8, 10].map((value) => ({
  label: `${value}s`,
  value: String(value),
}));
const GENERIC_VIDEO_QUALITY_OPTIONS = [
  { label: '480p', value: '480p' },
  { label: '720p', value: '720p' },
];
const GROK_VIDEO_PRESET_OPTIONS = [
  { label: 'Normal', value: 'normal' },
  { label: 'Fun', value: 'fun' },
  { label: 'Spicy', value: 'spicy' },
  { label: 'Custom', value: 'custom' },
];
const ADOBE_VIDEO_DURATION_OPTIONS = {
  sora: [4, 8, 12].map((value) => ({ label: `${value}s`, value: String(value) })),
  veo: [4, 6, 8].map((value) => ({ label: `${value}s`, value: String(value) })),
};
const ADOBE_VIDEO_ASPECT_RATIO_OPTIONS = [
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' },
];
const getAdobeVideoDurationOptions = (modelName) => {
  if (modelName === 'veo31-ref') {
    return ADOBE_VIDEO_DURATION_OPTIONS.veo.filter((option) => option.value === '8');
  }
  if (modelName === 'sora2' || modelName === 'sora2-pro') {
    return ADOBE_VIDEO_DURATION_OPTIONS.sora;
  }
  return ADOBE_VIDEO_DURATION_OPTIONS.veo;
};
const getAdobeVideoAspectRatioOptions = (modelName) => {
  if (modelName === 'veo31-ref') {
    return ADOBE_VIDEO_ASPECT_RATIO_OPTIONS.filter(
      (option) => option.value === '16:9',
    );
  }
  return ADOBE_VIDEO_ASPECT_RATIO_OPTIONS;
};
const getAdobeVideoDefaultDuration = (modelName) =>
  getAdobeVideoDurationOptions(modelName)[0]?.value || '4';
const getAdobeVideoDefaultAspectRatio = (modelName) =>
  getAdobeVideoAspectRatioOptions(modelName)[0]?.value || '16:9';
const ADOBE_VIDEO_RESOLUTION_OPTIONS = [
  { label: '1080p', value: '1080p' },
  { label: '720p', value: '720p' },
];
const ADOBE_REFERENCE_MODE_OPTIONS = [
  { label: 'Frame', value: 'frame' },
  { label: 'Image', value: 'image' },
];
const GENERATION_COUNT_OPTIONS = Array.from({ length: 10 }, (_, index) => ({
  label: `${index + 1}条`,
  value: String(index + 1),
}));
const PARAMETER_TOGGLES_DISABLED = {
  temperature: false,
  top_p: false,
  max_tokens: false,
  frequency_penalty: false,
  presence_penalty: false,
  seed: false,
};
const EMPTY_HISTORY_SNAPSHOTS = {
  chat: null,
  image: null,
  video: null,
};
const ACTIVE_VIDEO_POLL_STATUSES = new Set([
  'submitted',
  'queued',
  'generating',
  'processing',
  'in_progress',
]);
const CREATIVE_CENTER_VIDEO_TASK_ACTIONS = new Set([
  'generate',
  'textGenerate',
  'firstTailGenerate',
  'referenceGenerate',
  'remixGenerate',
]);
const UNIFORM_CREATIVE_VIDEO_CARD_MODELS = new Set([
  'grok-imagine-1.0-video',
  'veo31-fast',
  'veo31-ref',
]);
const CREATIVE_CENTER_IMAGE_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const CREATIVE_CENTER_IMAGE_UPLOAD_CONCURRENCY = 2;
const CREATIVE_CENTER_STARTUP_VIDEO_RECOVERY_MAX_TASKS = 20;
const CREATIVE_CENTER_STARTUP_VIDEO_RECOVERY_CONCURRENCY = 4;
const CREATIVE_CENTER_IMAGE_POLL_INTERVAL_MS = 6000;
const CREATIVE_CENTER_IMAGE_POLL_CONCURRENCY = 2;
const CREATIVE_CENTER_IMAGE_POLL_429_BACKOFF_MS = 15000;
const CREATIVE_CENTER_VIDEO_POLL_INTERVAL_MS = 6000;
const CREATIVE_CENTER_VIDEO_POLL_CONCURRENCY = 2;
const CREATIVE_CENTER_VIDEO_POLL_429_BACKOFF_MS = 15000;
const CREATIVE_CENTER_VIDEO_PENDING_TO_GENERATING_MS = 10000;
const CREATIVE_CENTER_HISTORY_PERSIST_DEBOUNCE_MS = 2000;
const CREATIVE_CENTER_VIDEO_HISTORY_PERSIST_DEBOUNCE_MS = 6000;
const CREATIVE_CENTER_HISTORY_PERSIST_429_BACKOFF_MS = 15000;
const CREATIVE_BATCH_REQUEST_SPACING_MS = 300;
const ESTIMATED_PROGRESS_TICK_MS = 500;
const ESTIMATED_PROGRESS_FINALIZING_MS = 1400;

const clampProgress = (value) => Math.min(Math.max(value, 0), 100);
const createBatchSeedBase = () =>
  Math.floor(Date.now() % 1000000000) + Math.floor(Math.random() * 1000000);
const createTaskSeed = (batchSeedBase, index) => batchSeedBase + index * 9973;
const createTaskRequestUser = (batchSeedBase, index) =>
  `creative-center-${batchSeedBase}-${index + 1}`;
const createTaskRequestId = (batchSeedBase, index) =>
  `creative-request-${batchSeedBase}-${index + 1}`;
const waitForMs = (ms) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, Math.max(0, ms));
  });

const parseProgressValue = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return clampProgress(Math.round(value));
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim().replace(/%$/, '');
    const parsedValue = Number(normalizedValue);
    if (Number.isFinite(parsedValue)) {
      return clampProgress(Math.round(parsedValue));
    }
  }

  return null;
};

const parseTimestampValue = (value, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue) && numericValue > 0) {
      return numericValue;
    }

    const parsedDate = Date.parse(value);
    if (Number.isFinite(parsedDate) && parsedDate > 0) {
      return parsedDate;
    }
  }

  return fallback;
};

const shouldUseEstimatedImageProgress = (modelName) => Boolean(modelName);
const shouldUseEstimatedVideoProgress = (modelName) => Boolean(modelName);
const shouldUseCreativeCenterChatStream = (modelName) => {
  const normalizedModelName =
    typeof modelName === 'string' ? modelName.trim().toLowerCase() : '';
  return normalizedModelName.includes('gpt');
};

const getEstimatedImageDurationMs = (params = {}) => {
  switch (params?.outputResolution) {
    case '4K':
      return 36000;
    case '1K':
      return 16000;
    case '2K':
    default:
      return 24000;
  }
};

const getEstimatedVeoDurationMs = (params = {}) => {
  const durationMap = {
    '4': 45000,
    '6': 65000,
    '8': 85000,
  };
  const baseDuration =
    durationMap[String(params?.videoDuration || params?.duration || '4')] || 65000;
  const resolutionOffset = params?.videoResolution === '1080p' ? 8000 : 0;
  return baseDuration + resolutionOffset;
};

const getEstimatedTaskProgress = ({
  task,
  modelName,
  params,
  taskType,
  now = Date.now(),
}) => {
  const isEstimatedModel =
    taskType === 'image'
      ? shouldUseEstimatedImageProgress(modelName)
      : shouldUseEstimatedVideoProgress(modelName);
  const actualProgress = parseProgressValue(task?.progress);
  const normalizedStatus = normalizeVideoTaskStatus(task?.status || 'submitted');

  if (!isEstimatedModel) {
    if (typeof actualProgress === 'number' && actualProgress > 0) {
      return {
        progress: actualProgress,
        progressText: `${actualProgress}%`,
        statusText: '实时生成中',
        indeterminate: false,
      };
    }

    if (['completed', 'failed'].includes(normalizedStatus)) {
      const completedProgress = actualProgress ?? 100;
      return {
        progress: completedProgress,
        progressText: `${completedProgress}%`,
        statusText: normalizedStatus === 'failed' ? '任务失败' : '已完成',
        indeterminate: false,
      };
    }

    return {
      progress: 0,
      progressText: '生成中',
      statusText: '实时生成中',
      indeterminate: true,
    };
  }

  if (normalizedStatus === 'completed') {
    return {
      progress: 100,
      progressText: '100%',
      statusText: '已完成',
      indeterminate: false,
    };
  }

  if (normalizedStatus === 'failed') {
    const failedProgress = actualProgress ?? 100;
    return {
      progress: failedProgress,
      progressText: `${failedProgress}%`,
      statusText: '任务失败',
      indeterminate: false,
    };
  }

  const estimateStartAt = parseTimestampValue(
    task?.estimateStartAt || task?.estimate_start_at,
    parseTimestampValue(task?.submittedAt || task?.submitted_at, now),
  );
  const finalizingAt = parseTimestampValue(
    task?.finalizingAt || task?.finalizing_at,
    0,
  );

  if (normalizedStatus === 'finalizing' || finalizingAt > 0) {
    const finalizingElapsed = Math.max(0, now - (finalizingAt || now));
    const finalizingRatio = Math.min(
      finalizingElapsed / ESTIMATED_PROGRESS_FINALIZING_MS,
      1,
    );
    const estimatedProgress = clampProgress(
      Math.round(90 + finalizingRatio * 9),
    );
    const mergedProgress = Math.max(actualProgress ?? 0, estimatedProgress);
    return {
      progress: mergedProgress,
      progressText: `${mergedProgress}%`,
      statusText: '整理结果中',
      indeterminate: false,
    };
  }

  if (now < estimateStartAt) {
    return {
      progress: Math.max(actualProgress ?? 0, 3),
      progressText: `${Math.max(actualProgress ?? 0, 3)}%`,
      statusText: '提交成功',
      indeterminate: false,
    };
  }

  const estimatedDurationMs =
    taskType === 'image'
      ? getEstimatedImageDurationMs(params)
      : getEstimatedVeoDurationMs(params);
  const activeElapsed = Math.max(0, now - estimateStartAt);
  const activeRatio = Math.min(activeElapsed / estimatedDurationMs, 1);
  const estimatedProgress = clampProgress(Math.round(5 + activeRatio * 80));
  const mergedProgress = Math.max(actualProgress ?? 0, estimatedProgress);

  return {
    progress: mergedProgress,
    progressText: `${mergedProgress}%`,
    statusText: '预计进度',
    indeterminate: false,
  };
};

const normalizeVideoTaskStatus = (status) => {
  const normalizedStatus = String(status || '').trim().toLowerCase();

  if (
    ['completed', 'complete', 'succeeded', 'success'].includes(normalizedStatus)
  ) {
    return 'completed';
  }

  if (['failed', 'failure', 'error', 'cancelled', 'canceled'].includes(normalizedStatus)) {
    return 'failed';
  }

  if (['queued', 'queueing'].includes(normalizedStatus)) {
    return 'queued';
  }

  if (['submitted', 'pending'].includes(normalizedStatus)) {
    return 'submitted';
  }

  if (['finalizing', 'finalising'].includes(normalizedStatus)) {
    return 'finalizing';
  }

  if (['processing', 'generating', 'in_progress', 'running'].includes(normalizedStatus)) {
    return 'generating';
  }

  return normalizedStatus || 'submitted';
};

const createPersistedImageTaskItem = (item, index = 0) => {
  const requestId = typeof item?.requestId === 'string' ? item.requestId.trim() : '';
  const submittedAt = parseTimestampValue(
    item?.submittedAt || item?.submitted_at,
    0,
  );
  const mediaUrl = getImageTaskMediaUrl(item);
  const taskId = String(item?.taskId || item?.task_id || '').trim();
  const normalizedStatus = normalizeVideoTaskStatus(
    item?.status || (mediaUrl ? 'completed' : 'submitted'),
  );
  return {
    id: item?.id || createCreativeRecordId(`image-task-${index}`),
    requestId,
    taskId,
    submittedAt,
    status: mediaUrl ? 'completed' : normalizedStatus,
    ...(mediaUrl ? { resultUrl: mediaUrl } : {}),
  };
};

const normalizeCreativeSourceImageItem = (item, index = 0) => {
  const rawUrl =
    typeof item === 'string'
      ? item
      : typeof item?.url === 'string'
        ? item.url
        : '';
  const url = rawUrl.trim();
  if (!url) {
    return null;
  }

  const fallbackName =
    getCreativeCenterFilenameFromUrl(url) || `image-${index + 1}.png`;
  const rawFileName =
    typeof item?.fileName === 'string'
      ? item.fileName
      : typeof item?.file_name === 'string'
        ? item.file_name
        : fallbackName;
  const fileName = rawFileName.trim() || fallbackName;
  const rawName =
    typeof item?.name === 'string' ? item.name : fileName || fallbackName;
  const name = rawName.trim() || fileName || fallbackName;

  return {
    id: item?.id || createCreativeRecordId(`source-image-${index}`),
    name,
    url,
    fileName,
    previewUrl:
      typeof item?.previewUrl === 'string' && item.previewUrl.trim()
        ? item.previewUrl.trim()
        : '',
    status: item?.status === 'uploading' ? 'uploading' : 'uploaded',
  };
};

const createPersistedSourceImageItem = (item, index = 0) => {
  const normalizedItem = normalizeCreativeSourceImageItem(item, index);
  if (!normalizedItem) {
    return null;
  }

  return {
    name: normalizedItem.name,
    url: normalizedItem.url,
    fileName: normalizedItem.fileName,
  };
};

const createPersistedVideoTaskItem = (item, index = 0) => {
  const requestId = typeof item?.requestId === 'string' ? item.requestId.trim() : '';
  const taskId = String(item?.taskId || item?.task_id || '').trim();
  const submittedAt = parseTimestampValue(
    item?.submittedAt || item?.submitted_at,
    0,
  );
  const mediaUrl = getVideoTaskMediaUrl(item);
  const normalizedStatus = normalizeVideoTaskStatus(
    item?.status || (mediaUrl ? 'completed' : 'submitted'),
  );
  const resolvedStatus =
    mediaUrl
      ? 'completed'
      : normalizedStatus === 'completed'
        ? 'failed'
        : normalizedStatus;
  return {
    id: item?.id || createCreativeRecordId(`video-task-${index}`),
    requestId,
    taskId,
    submittedAt,
    status: resolvedStatus,
    ...(resolvedStatus === 'failed'
      ? {
          error:
            item?.error ||
            item?.content ||
            '任务生成失败',
        }
      : {}),
    ...(mediaUrl ? { resultUrl: mediaUrl } : {}),
  };
};

const createPersistedImageRecord = (record, index = 0) => ({
  id: record?.id || createCreativeRecordId(`image-history-${index}`),
  prompt: record?.prompt || '',
  modelName: record?.modelName || '',
  params: record?.params && typeof record.params === 'object' ? record.params : {},
  sourceImages: Array.isArray(record?.sourceImages)
    ? record.sourceImages
        .map((item, sourceImageIndex) =>
          createPersistedSourceImageItem(item, sourceImageIndex),
        )
        .filter(Boolean)
    : [],
  group: record?.group || '',
  createdAt: parseTimestampValue(
    record?.createdAt || record?.created_at,
    Date.now(),
  ),
  updatedAt: parseTimestampValue(
    record?.updatedAt || record?.updated_at,
    Date.now(),
  ),
  images: Array.isArray(record?.images)
    ? record.images.map((item, imageIndex) =>
        createPersistedImageTaskItem(item, imageIndex),
      )
    : [],
});

const createPersistedVideoRecord = (record, index = 0) => ({
  id: record?.id || createCreativeRecordId(`video-history-${index}`),
  prompt: record?.prompt || '',
  modelName: record?.modelName || '',
  params: record?.params && typeof record.params === 'object' ? record.params : {},
  sourceImages: Array.isArray(record?.sourceImages)
    ? record.sourceImages
        .map((item, sourceImageIndex) =>
          createPersistedSourceImageItem(item, sourceImageIndex),
        )
        .filter(Boolean)
    : [],
  group: record?.group || '',
  createdAt: parseTimestampValue(
    record?.createdAt || record?.created_at,
    Date.now(),
  ),
  updatedAt: parseTimestampValue(
    record?.updatedAt || record?.updated_at,
    Date.now(),
  ),
  tasks: Array.isArray(record?.tasks)
    ? record.tasks.map((item, taskIndex) =>
        createPersistedVideoTaskItem(item, taskIndex),
      )
    : [],
});

const buildPersistableCreativeSessionPayload = (tabKey, payload) => {
  const normalizedPayload =
    payload && typeof payload === 'object' ? payload : {};

  if (tabKey === 'chat') {
    return normalizedPayload;
  }

  const normalizedSessions = Array.isArray(normalizedPayload.sessions)
    ? normalizedPayload.sessions
    : [];

  return {
    current_session_id:
      typeof normalizedPayload.current_session_id === 'string'
        ? normalizedPayload.current_session_id
        : '',
    sessions: normalizedSessions.map((session, index) => {
      const normalizedSession = normalizeCreativeSessionSnapshot(
        tabKey,
        session,
        null,
        index,
      );
      const records =
        tabKey === 'image'
          ? normalizeImageHistoryRecords(normalizedSession).map((record, recordIndex) =>
              createPersistedImageRecord(record, recordIndex),
            )
          : normalizeVideoHistoryRecords(normalizedSession).map((record, recordIndex) =>
              createPersistedVideoRecord(record, recordIndex),
            );

      return {
        id: normalizedSession.id,
        name: normalizedSession.name,
        model_name: normalizedSession.model_name,
        group: normalizedSession.group,
        prompt: normalizedSession.prompt,
        created_at: normalizedSession.created_at,
        updated_at: normalizedSession.updated_at,
        payload: {
          entries: records,
          params:
            normalizedSession?.payload?.params &&
            typeof normalizedSession.payload.params === 'object'
              ? normalizedSession.payload.params
              : {},
        },
      };
    }),
  };
};

const summarizeImageTasks = (images) => {
  const completedCount = images.filter((item) =>
    ['completed', 'failed'].includes(item.status),
  ).length;
  const successCount = images.filter((item) => item.status === 'completed').length;
  const hasActiveTask = images.some(
    (item) => !['completed', 'failed'].includes(item.status),
  );

  return {
    completedCount,
    successCount,
    status: hasActiveTask
      ? 'generating'
      : successCount > 0
        ? 'completed'
        : 'failed',
  };
};

const summarizeVideoTasks = (tasks) => {
  const completedCount = tasks.filter((item) =>
    ['completed', 'failed'].includes(item.status),
  ).length;
  const successCount = tasks.filter((item) => item.status === 'completed').length;
  const hasActiveTask = tasks.some(
    (item) => !['completed', 'failed'].includes(item.status),
  );

  return {
    completedCount,
    successCount,
    status: hasActiveTask
      ? 'generating'
      : successCount > 0
        ? 'completed'
        : 'failed',
  };
};

const normalizeGrokImageSize = (size) => {
  if (size === '1536x1024') {
    return '1792x1024';
  }
  if (size === '1024x1536') {
    return '1024x1792';
  }
  return size;
};

const getOptionLabel = (options, value) =>
  options.find((option) => option.value === value)?.label || value;

const extractVideoUrlFromMessage = (content) => {
  if (typeof content !== 'string') {
    return '';
  }

  const htmlMatch = content.match(/<video[^>]+src=['"]([^'"]+)['"]/i);
  if (htmlMatch?.[1]) {
    return htmlMatch[1];
  }

  const markdownMatch = content.match(/\((https?:\/\/[^)\s]+)\)/i);
  if (markdownMatch?.[1]) {
    return markdownMatch[1];
  }

  const plainUrlMatch = content.match(/https?:\/\/[^\s'"]+/i);
  return plainUrlMatch?.[0] || '';
};

const extractImageUrlsFromMessage = (content) => {
  if (typeof content !== 'string' || !content.trim()) {
    return [];
  }

  const matches = [
    ...content.matchAll(/!\[[^\]]*]\((https?:\/\/[^)\s]+)\)/gi),
    ...content.matchAll(/\[[^\]]*]\((https?:\/\/[^)\s]+)\)/gi),
    ...content.matchAll(/(https?:\/\/[^\s'"]+\.(?:png|jpe?g|webp|gif)(?:\?[^\s'"]*)?)/gi),
  ];

  return [...new Set(matches.map((match) => match[1]).filter(Boolean))];
};

const extractImageUrlsFromCreativeResponse = (data) => {
  const directUrls = Array.isArray(data?.data)
    ? data.data
        .map((item) => (typeof item?.url === 'string' ? item.url.trim() : ''))
        .filter(Boolean)
    : [];
  if (directUrls.length > 0) {
    return directUrls;
  }

  const messageContent = data?.choices?.[0]?.message?.content;
  if (typeof messageContent === 'string') {
    return extractImageUrlsFromMessage(messageContent);
  }

  if (Array.isArray(messageContent)) {
    return messageContent
      .filter((item) => item?.type === 'image_url')
      .map((item) =>
        typeof item?.image_url === 'string'
          ? item.image_url.trim()
          : item?.image_url?.url?.trim?.() || '',
      )
      .filter(Boolean);
  }

  return [];
};

const CREATIVE_CENTER_TEXT_FRAGMENT_KEYS = [
  'text',
  'output_text',
  'summary_text',
  'generated_text',
  'generation',
  'completion',
  'content',
  'message',
  'response',
  'result',
  'answer',
  'value',
  'refusal',
  'transcript',
  'markdown',
  'outputText',
  'responseText',
  'content_text',
  'text_content',
];

const CREATIVE_CENTER_NESTED_RESPONSE_KEYS = [
  'data',
  'payload',
  'body',
  'choice',
  'message',
  'output',
  'outputs',
  'choices',
  'candidates',
  'parts',
  'segments',
  'items',
  'messages',
  'delta',
];

const CREATIVE_CENTER_DIAGNOSTIC_MESSAGE_PREFIXES = [
  '模型已返回响应',
  '请求失败',
];
const CREATIVE_CENTER_RAW_RESPONSE_PREVIEW_LIMIT = 4000;

const isCreativeCenterDiagnosticAssistantMessage = (message) => {
  if (!message || message.role !== 'assistant' || typeof message.content !== 'string') {
    return false;
  }

  const content = message.content.trim();
  return CREATIVE_CENTER_DIAGNOSTIC_MESSAGE_PREFIXES.some((prefix) =>
    content.startsWith(prefix),
  );
};

const buildCreativeCenterChatRequestMessages = (messages) => {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages.filter((message) => {
    if (!message || !message.role) {
      return false;
    }
    if (message.role !== 'assistant') {
      return true;
    }
    if (isCreativeCenterDiagnosticAssistantMessage(message)) {
      return false;
    }
    if (typeof message.content === 'string' && !message.content.trim()) {
      return false;
    }
    return true;
  });
};

const collectCreativeCenterTextFragments = (value, visited = new WeakSet()) => {
  if (typeof value === 'string') {
    return value.trim() ? [value] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) =>
      collectCreativeCenterTextFragments(item, visited),
    );
  }

  if (!value || typeof value !== 'object') {
    return [];
  }
  if (visited.has(value)) {
    return [];
  }
  visited.add(value);

  const fragments = [];
  const append = (nextValue) => {
    collectCreativeCenterTextFragments(nextValue, visited).forEach((fragment) => {
      if (fragment.trim()) {
        fragments.push(fragment);
      }
    });
  };

  CREATIVE_CENTER_TEXT_FRAGMENT_KEYS.forEach((key) => {
    if (value[key] !== undefined && value[key] !== null) {
      append(value[key]);
    }
  });

  CREATIVE_CENTER_NESTED_RESPONSE_KEYS.forEach((key) => {
    if (
      value[key] &&
      typeof value[key] === 'object' &&
      !CREATIVE_CENTER_TEXT_FRAGMENT_KEYS.includes(key)
    ) {
      append(value[key]);
    }
  });

  return [...new Set(fragments)];
};

const formatCreativeCenterRawResponsePreview = (payload) => {
  const formatTextPreview = (value) => {
    const trimmedValue = typeof value === 'string' ? value.trim() : '';
    return trimmedValue.length > CREATIVE_CENTER_RAW_RESPONSE_PREVIEW_LIMIT
      ? `${trimmedValue.slice(0, CREATIVE_CENTER_RAW_RESPONSE_PREVIEW_LIMIT)}\n...`
      : trimmedValue;
  };

  if (payload === undefined || payload === null) {
    return '';
  }
  if (typeof payload === 'string') {
    return formatTextPreview(payload);
  }
  try {
    const serialized = JSON.stringify(payload, null, 2);
    return formatTextPreview(serialized);
  } catch {
    return '';
  }
};

const extractCreativeCenterChatResponse = (payload) => {
  const rootPayload =
    payload && typeof payload === 'object' && payload.data && typeof payload.data === 'object'
      ? payload.data
      : payload;
  const choice = rootPayload?.choices?.[0];
  const message = choice?.message || {};
  const candidate = rootPayload?.candidates?.[0];
  const outputItems = Array.isArray(rootPayload?.output)
    ? rootPayload.output
    : [];

  const reasoningFragments = [
    message.reasoning_content,
    message.reasoning,
    choice?.reasoning_content,
    choice?.reasoning,
    rootPayload?.reasoning_content,
    rootPayload?.reasoning,
  ]
    .flatMap((value) => collectCreativeCenterTextFragments(value))
    .filter(Boolean);

  const contentFragments = [
    choice,
    message,
    message.content,
    choice?.text,
    choice?.delta?.content,
    rootPayload?.output_text,
    rootPayload?.text,
    rootPayload?.content,
    rootPayload?.message,
    rootPayload?.response,
    rootPayload?.result,
    rootPayload?.answer,
    rootPayload?.data,
    rootPayload?.payload,
    rootPayload?.body,
    candidate?.content?.parts,
    outputItems,
  ]
    .flatMap((value) => collectCreativeCenterTextFragments(value))
    .filter(Boolean);

  const content = [...new Set(contentFragments)].join('\n\n').trim();
  const reasoningContent = [...new Set(reasoningFragments)].join('\n\n').trim();
  const rawResponsePreview =
    !content && !reasoningContent
      ? formatCreativeCenterRawResponsePreview(rootPayload || payload)
      : '';

  return {
    content,
    reasoningContent,
    rawResponsePreview,
  };
};

const buildCreativeCenterImageDisplayUrl = (url) => {
  if (typeof url !== 'string') {
    return '';
  }

  const trimmedURL = url.trim();
  if (!trimmedURL) {
    return '';
  }

  if (!/^https?:\/\//i.test(trimmedURL)) {
    return trimmedURL;
  }

  return `${API_ENDPOINTS.CREATIVE_CENTER_IMAGE_PROXY}?url=${encodeURIComponent(trimmedURL)}`;
};

const buildCreativeCenterImageBedUploadUrl = (
  uploadUrl,
  returnType = 'full',
  autoRetry = true,
) => {
  const trimmedUploadUrl = typeof uploadUrl === 'string' ? uploadUrl.trim() : '';
  if (!trimmedUploadUrl) {
    return '';
  }

  const requestUrl = new URL(`${trimmedUploadUrl.replace(/\/+$/, '')}/upload`);
  requestUrl.searchParams.set('returnFormat', returnType || 'full');
  if (autoRetry) {
    requestUrl.searchParams.set('autoRetry', 'true');
  }
  return requestUrl.toString();
};

const normalizeCreativeCenterDirectImageUrl = (uploadUrl, src) => {
  const trimmedSrc = typeof src === 'string' ? src.trim() : '';
  if (!trimmedSrc) {
    return '';
  }

  try {
    return new URL(trimmedSrc, `${uploadUrl.replace(/\/+$/, '')}/upload`).toString();
  } catch (error) {
    console.error('Failed to normalize creative center direct image url:', error);
    return '';
  }
};

const parseCreativeCenterDirectUploadImageUrl = (uploadUrl, payload) => {
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : [];

  const firstSrc = items[0]?.src;
  return normalizeCreativeCenterDirectImageUrl(uploadUrl, firstSrc);
};

const getCreativeCenterFilenameFromUrl = (url) => {
  if (typeof url !== 'string' || !url.trim()) {
    return '';
  }

  try {
    const parsedUrl = new URL(url);
    const pathnameParts = parsedUrl.pathname.split('/').filter(Boolean);
    return pathnameParts[pathnameParts.length - 1] || '';
  } catch (error) {
    return '';
  }
};

const revokeCreativeCenterPreviewURL = (previewUrl) => {
  if (typeof previewUrl === 'string' && previewUrl.startsWith('blob:')) {
    URL.revokeObjectURL(previewUrl);
  }
};

const getAdobeImageAspectRatioOptions = (modelName) =>
  ADOBE_CHAT_IMAGE_MODELS.has(modelName)
    ? CHAT_ADOBE_IMAGE_ASPECT_RATIO_OPTIONS
    : DEFAULT_ADOBE_IMAGE_ASPECT_RATIO_OPTIONS;

const supportsAdobeAutoImageSize = (modelName) =>
  getAdobeImageAspectRatioOptions(modelName).some(
    (option) => option.value === 'auto',
  );

const getCreativeCenterImageUploadLimit = (modelName) => {
  const normalizedModelName = typeof modelName === 'string' ? modelName.trim() : '';
  if (!normalizedModelName) {
    return null;
  }
  return CREATIVE_CENTER_IMAGE_UPLOAD_LIMITS[normalizedModelName] ?? null;
};

const isCreativeCenterImageUploadEnabled = (tabKey, modelName) => {
  if (tabKey === 'chat') {
    return true;
  }
  return getCreativeCenterImageUploadLimit(modelName) !== null;
};

const resolveCreativeCenterDisplayCurrency = (quotaDisplayType = 'USD') =>
  quotaDisplayType === 'CNY' || quotaDisplayType === 'CUSTOM'
    ? quotaDisplayType
    : 'USD';

const getCreativeCenterCurrencySymbol = (
  currency = 'USD',
  customCurrencySymbol = '¤',
) => {
  if (currency === 'CNY') {
    return '¥';
  }
  if (currency === 'CUSTOM') {
    return customCurrencySymbol || '¤';
  }
  return '$';
};

const convertCreativeCenterUsdPrice = (
  usdAmount,
  currency = 'USD',
  options = {},
) => {
  const safeAmount = Number(usdAmount);
  if (!Number.isFinite(safeAmount)) {
    return null;
  }

  if (currency === 'CNY') {
    return safeAmount * Number(options.usdExchangeRate || 1);
  }

  if (currency === 'CUSTOM') {
    return safeAmount * Number(options.customExchangeRate || 1);
  }

  return safeAmount;
};

const formatCreativeCenterPriceNumber = (amount) => {
  const safeAmount = Number(amount);
  if (!Number.isFinite(safeAmount)) {
    return '';
  }

  const absAmount = Math.abs(safeAmount);
  let maximumFractionDigits = 3;
  if (absAmount >= 100) {
    maximumFractionDigits = 2;
  } else if (absAmount >= 1) {
    maximumFractionDigits = 3;
  } else if (absAmount >= 0.01) {
    maximumFractionDigits = 4;
  } else {
    maximumFractionDigits = 6;
  }

  return safeAmount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
};

const resolveCreativeCenterGroupRatio = (
  pricingModel,
  activeGroup,
  groupRatioMap,
) => {
  const enableGroups = Array.isArray(pricingModel?.enable_groups)
    ? pricingModel.enable_groups
    : [];

  if (
    activeGroup &&
    enableGroups.includes(activeGroup) &&
    Number.isFinite(Number(groupRatioMap?.[activeGroup]))
  ) {
    return Number(groupRatioMap[activeGroup]);
  }

  let minRatio = Number.POSITIVE_INFINITY;
  enableGroups.forEach((group) => {
    const ratio = Number(groupRatioMap?.[group]);
    if (Number.isFinite(ratio) && ratio < minRatio) {
      minRatio = ratio;
    }
  });

  return Number.isFinite(minRatio) ? minRatio : 1;
};

const buildCreativeCenterModelPriceLabel = (
  pricingModel,
  activeGroup,
  groupRatioMap,
  currencyOptions = {},
) => {
  if (!pricingModel || typeof pricingModel !== 'object') {
    return '';
  }

  const displayCurrency = resolveCreativeCenterDisplayCurrency(
    currencyOptions.quotaDisplayType,
  );
  const groupRatio = resolveCreativeCenterGroupRatio(
    pricingModel,
    activeGroup,
    groupRatioMap,
  );
  const activePricingGroup =
    activeGroup &&
    Array.isArray(pricingModel.enable_groups) &&
    pricingModel.enable_groups.includes(activeGroup)
      ? activeGroup
      : null;
  const prices = [];
  const appendPrice = (value) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      return;
    }

    const convertedValue = convertCreativeCenterUsdPrice(
      numericValue,
      displayCurrency,
      currencyOptions,
    );
    if (Number.isFinite(convertedValue)) {
      prices.push(convertedValue);
    }
  };

  if (pricingModel.quota_type === 0) {
    const inputPrice = Number(pricingModel.model_ratio) * 2 * groupRatio;
    appendPrice(inputPrice);
    appendPrice(inputPrice * Number(pricingModel.completion_ratio));
    appendPrice(inputPrice * Number(pricingModel.cache_ratio));
    appendPrice(inputPrice * Number(pricingModel.create_cache_ratio));
    appendPrice(inputPrice * Number(pricingModel.image_ratio));
    appendPrice(inputPrice * Number(pricingModel.audio_ratio));
    appendPrice(
      inputPrice *
        Number(pricingModel.audio_ratio) *
        Number(pricingModel.audio_completion_ratio),
    );
  } else if (pricingModel.quota_type === 1) {
    const groupModelPrice =
      activePricingGroup && pricingModel.group_model_price?.[activePricingGroup] !== undefined
        ? Number(pricingModel.group_model_price[activePricingGroup])
        : null;
    appendPrice(
      groupModelPrice !== null
        ? groupModelPrice
        : Number(pricingModel.model_price) * groupRatio,
    );
  } else if (pricingModel.quota_type === 2) {
    const groupSecondsPriceMap = activePricingGroup
      ? pricingModel.group_model_price_by_seconds?.[activePricingGroup]
      : null;
    Object.values(groupSecondsPriceMap || pricingModel.model_price_by_seconds || {}).forEach(
      (value) => {
        appendPrice(Number(value) * (groupSecondsPriceMap ? 1 : groupRatio));
      },
    );
  } else if (pricingModel.quota_type === 3) {
    const groupResolutionPriceMap = activePricingGroup
      ? pricingModel.group_model_price_by_resolution?.[activePricingGroup]
      : null;
    Object.values(groupResolutionPriceMap || pricingModel.model_price_by_resolution || {}).forEach(
      (value) => {
        appendPrice(Number(value) * (groupResolutionPriceMap ? 1 : groupRatio));
      },
    );
  }

  if (prices.length === 0) {
    return '';
  }

  const sortedPrices = [...new Set(prices.map((value) => Number(value.toFixed(8))))].sort(
    (left, right) => left - right,
  );
  const minPrice = sortedPrices[0];
  const maxPrice = sortedPrices[sortedPrices.length - 1];
  const symbol = getCreativeCenterCurrencySymbol(
    displayCurrency,
    currencyOptions.customCurrencySymbol,
  );

  if (!Number.isFinite(minPrice)) {
    return '';
  }

  if (!Number.isFinite(maxPrice) || Math.abs(maxPrice - minPrice) < 0.000001) {
    return `${symbol}${formatCreativeCenterPriceNumber(minPrice)}`;
  }

  return `${symbol}${formatCreativeCenterPriceNumber(minPrice)}~${symbol}${formatCreativeCenterPriceNumber(maxPrice)}`;
};

const triggerDownload = (url, filename) => {
  if (!url) {
    return;
  }

  const trimmedURL = String(url).trim();
  const downloadUrl = trimmedURL.startsWith('data:')
    ? trimmedURL
    : `${API_ENDPOINTS.CREATIVE_CENTER_MEDIA_DOWNLOAD}?url=${encodeURIComponent(trimmedURL)}&filename=${encodeURIComponent(filename || '')}`;
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.rel = 'noopener noreferrer';
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const escapePreviewHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const openVideoPreviewInNewWindow = (
  url,
  title = '视频预览',
  promptText = '',
) => {
  if (!url) {
    return;
  }

  const previewWindow = window.open('', '_blank');
  if (!previewWindow) {
    return;
  }

  const safeUrl = escapePreviewHtml(url);
  const safeTitle = escapePreviewHtml(title);
  const safePromptText = escapePreviewHtml(promptText || '未填写提示词');
  previewWindow.opener = null;
  previewWindow.document.open();
  previewWindow.document.write(`<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <style>
      :root {
        color-scheme: dark;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        background: radial-gradient(circle at top, #1e293b, #020617 58%);
        color: #e2e8f0;
        font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      }
      .page {
        flex: 1;
        display: flex;
        flex-direction: column;
        padding: 20px;
        gap: 16px;
      }
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }
      .title {
        font-size: 16px;
        font-weight: 600;
        line-height: 1.5;
        word-break: break-word;
      }
      .hint {
        font-size: 13px;
        color: #94a3b8;
        line-height: 1.6;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .share-bar {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
      }
      .share-input {
        flex: 1;
        min-width: 280px;
        border: 1px solid rgba(148, 163, 184, 0.24);
        border-radius: 14px;
        background: rgba(15, 23, 42, 0.78);
        color: #e2e8f0;
        padding: 12px 14px;
        font-size: 13px;
      }
      .share-button {
        border: 0;
        border-radius: 14px;
        background: linear-gradient(135deg, #3b82f6, #2563eb);
        color: white;
        padding: 12px 16px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
      }
      .share-button:hover {
        filter: brightness(1.06);
      }
      .player-shell {
        flex: 1;
        min-height: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 24px;
        background: rgba(15, 23, 42, 0.86);
        box-shadow: 0 24px 80px rgba(15, 23, 42, 0.45);
        overflow: hidden;
      }
      video {
        width: 100%;
        height: 100%;
        max-height: calc(100vh - 140px);
        background: #020617;
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="header">
        <div>
          <div class="title">${safeTitle}</div>
          <div class="hint">${safePromptText}</div>
        </div>
      </div>
      <div class="share-bar">
        <input
          id="video-url"
          class="share-input"
          type="text"
          readonly
          value="${safeUrl}"
          title="${safeUrl}"
        />
        <button id="copy-url" class="share-button" type="button">复制视频链接</button>
      </div>
      <div class="player-shell">
        <video src="${safeUrl}" controls autoplay playsinline></video>
      </div>
    </div>
    <script>
      const copyButton = document.getElementById('copy-url');
      const urlInput = document.getElementById('video-url');
      if (copyButton && urlInput) {
        copyButton.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(urlInput.value);
            copyButton.textContent = '已复制链接';
            window.setTimeout(() => {
              copyButton.textContent = '复制视频链接';
            }, 1500);
          } catch (error) {
            urlInput.focus();
            urlInput.select();
            copyButton.textContent = '请手动复制';
            window.setTimeout(() => {
              copyButton.textContent = '复制视频链接';
            }, 1500);
          }
        });
      }
    </script>
  </body>
</html>`);
  previewWindow.document.close();
};

const normalizeVideoMediaUrl = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmedValue = value.trim();
  if (
    /^(https?:\/\/|blob:|data:video\/|\/(?!\/))/i.test(trimmedValue)
  ) {
    return trimmedValue;
  }

  return '';
};

const getVideoTaskMediaUrl = (task) => {
  const directUrl = normalizeVideoMediaUrl(task?.url);
  if (directUrl) {
    return directUrl;
  }

  const resultUrl =
    normalizeVideoMediaUrl(task?.resultUrl) ||
    normalizeVideoMediaUrl(task?.result_url);
  if (resultUrl) {
    return resultUrl;
  }

  return '';
};

const formatCreativeRecordTime = (timestamp) => {
  const date = new Date(Number(timestamp) || 0);
  if (Number.isNaN(date.getTime()) || date.getTime() <= 0) {
    return '';
  }
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}年${pad(date.getMonth() + 1)}月${pad(date.getDate())}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const buildCreativePersistSignature = (records, taskType) =>
  JSON.stringify(
    (records || []).map((record) => ({
      id: record?.id || '',
      prompt: record?.prompt || '',
      modelName: record?.modelName || '',
      group: record?.group || '',
      params: record?.params || {},
      sourceImages: Array.isArray(record?.sourceImages)
        ? record.sourceImages
            .map((item, sourceImageIndex) =>
              createPersistedSourceImageItem(item, sourceImageIndex),
            )
            .filter(Boolean)
        : [],
      items:
        taskType === 'video'
          ? (record?.tasks || []).map((item) => ({
              ...createPersistedVideoTaskItem(item),
            }))
          : (record?.images || []).map((item) => ({
              ...createPersistedImageTaskItem(item),
            })),
    })),
  );

const buildCreativeReconcileSignature = (sessionId, records, taskType) =>
  `${sessionId || 'no-session'}:${buildCreativePersistSignature(records, taskType)}`;

const createCreativeRecordId = (prefix) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const getImageTaskMediaUrl = (item) => {
  if (typeof item?.url === 'string' && item.url.trim()) {
    return item.url.trim();
  }
  if (typeof item?.resultUrl === 'string' && item.resultUrl.trim()) {
    return item.resultUrl.trim();
  }
  if (typeof item?.result_url === 'string' && item.result_url.trim()) {
    return item.result_url.trim();
  }
  return '';
};

const getRecoverableVideoTaskId = (task) => {
  const rawTaskId = String(task?.taskId || task?.task_id || '').trim();
  if (rawTaskId.startsWith('task_')) {
    return rawTaskId;
  }

  const fallbackId = String(task?.id || '').trim();
  if (fallbackId.startsWith('task_')) {
    return fallbackId;
  }

  return '';
};

const getRecoverableImageTaskId = (task) => {
  const rawTaskId = String(task?.taskId || task?.task_id || '').trim();
  if (rawTaskId.startsWith('task_')) {
    return rawTaskId;
  }
  return '';
};

const normalizeCreativeTimestampToSeconds = (value) => {
  const numericValue = Number(value) || 0;
  if (numericValue <= 0) {
    return 0;
  }
  return numericValue > 9999999999
    ? Math.floor(numericValue / 1000)
    : Math.floor(numericValue);
};

const getTaskDtoResultUrl = (task) => {
  if (typeof task?.result_url === 'string' && task.result_url.trim()) {
    return task.result_url.trim();
  }

  if (typeof task?.resultUrl === 'string' && task.resultUrl.trim()) {
    return task.resultUrl.trim();
  }

  return '';
};

const getTaskDtoRequestId = (task) => {
  if (typeof task?.request_id === 'string' && task.request_id.trim()) {
    return task.request_id.trim();
  }
  if (typeof task?.requestId === 'string' && task.requestId.trim()) {
    return task.requestId.trim();
  }
  return '';
};

const getTaskDtoModelName = (task) => {
  const properties = task?.properties;
  if (properties && typeof properties === 'object') {
    const candidate = String(
      properties.origin_model_name ||
        properties.originModelName ||
        properties.upstream_model_name ||
        properties.upstreamModelName ||
        '',
    ).trim();
    if (candidate) {
      return candidate;
    }
  }

  const data = task?.data;
  if (data && typeof data === 'object') {
    const candidate = String(data.model || '').trim();
    if (candidate) {
      return candidate;
    }
  }

  return '';
};

const normalizeTaskDtoDataPayload = (task) => {
  const rawData = task?.data;
  if (!rawData) {
    return null;
  }
  if (typeof rawData === 'string') {
    try {
      return JSON.parse(rawData);
    } catch (error) {
      return null;
    }
  }
  if (typeof rawData === 'object') {
    return rawData;
  }
  return null;
};

const parseTaskDtoVideoState = (task) => {
  const taskId = String(task?.task_id || task?.taskId || '').trim();
  const url = normalizeVideoMediaUrl(getTaskDtoResultUrl(task));
  const normalizedStatus = normalizeVideoTaskStatus(task?.status || '');
  const completedWithoutVideo = !url && normalizedStatus === 'completed';
  const isFailed = normalizedStatus === 'failed' || completedWithoutVideo;
  const isCompleted = Boolean(url) && !isFailed;
  const progress =
    parseProgressValue(task?.progress) ?? (isCompleted || isFailed ? 100 : 0);
  const submitTime = normalizeCreativeTimestampToSeconds(
    task?.submit_time || task?.submitTime || task?.created_at || task?.createdAt,
  );
  const shouldPromotePendingToGenerating =
    !isCompleted &&
    !isFailed &&
    ['submitted', 'queued'].includes(normalizedStatus) &&
    submitTime > 0 &&
    Date.now() - submitTime * 1000 >= CREATIVE_CENTER_VIDEO_PENDING_TO_GENERATING_MS;
  const resolvedStatus = isCompleted
    ? 'completed'
    : isFailed
      ? 'failed'
      : shouldPromotePendingToGenerating
        ? 'generating'
        : normalizedStatus;

  return {
    taskId,
    status: resolvedStatus,
    progress,
    url,
    content: '',
    error:
      completedWithoutVideo
        ? '任务生成失败'
        : typeof task?.fail_reason === 'string'
        ? task.fail_reason
        : typeof task?.failReason === 'string'
          ? task.failReason
          : '',
  };
};

const isTerminalVideoTaskStatus = (status) => {
  const normalizedStatus = normalizeVideoTaskStatus(status);
  return normalizedStatus === 'completed' || normalizedStatus === 'failed';
};

const isTerminalImageTaskStatus = (status) => {
  const normalizedStatus = String(status || '').trim().toLowerCase();
  return normalizedStatus === 'completed' || normalizedStatus === 'failed';
};

const parseImageFetchPayload = (rawResponse) => {
  const rootPayload =
    rawResponse?.data &&
    (rawResponse?.headers || typeof rawResponse?.status === 'number')
      ? rawResponse.data
      : rawResponse;
  const dataPayload =
    rootPayload && typeof rootPayload === 'object' && rootPayload.data && typeof rootPayload.data === 'object'
      ? rootPayload.data
      : rootPayload;

  if (!dataPayload || typeof dataPayload !== 'object') {
    return {
      status: 'submitted',
      progress: null,
      url: '',
      error: '',
    };
  }

  const status = String(
    dataPayload.status ||
      dataPayload.task_status ||
      dataPayload.state ||
      rootPayload?.status ||
      'submitted',
  )
    .trim()
    .toLowerCase();
  const progress =
    parseProgressValue(dataPayload.progress) ??
    parseProgressValue(rootPayload?.progress);
  const imageUrls = extractImageUrlsFromCreativeResponse(dataPayload);
  const rootImageUrls =
    dataPayload === rootPayload ? [] : extractImageUrlsFromCreativeResponse(rootPayload);
  const url =
    imageUrls[0] ||
    rootImageUrls[0] ||
    dataPayload.result_url ||
    dataPayload.resultUrl ||
    rootPayload?.result_url ||
    rootPayload?.resultUrl ||
    '';
  const error =
    dataPayload.error?.message ||
    dataPayload.fail_reason ||
    rootPayload?.error?.message ||
    '';

  return {
    status,
    progress,
    url: typeof url === 'string' ? url.trim() : '',
    error,
  };
};

const buildResolvedImageTaskPatch = (queryTaskId, nextTaskState) => (currentTask) => {
  const normalizedStatus = String(
    nextTaskState?.status || currentTask?.status || 'submitted',
  )
    .trim()
    .toLowerCase();
  const resolvedUrl =
    (typeof nextTaskState?.url === 'string' ? nextTaskState.url.trim() : '') ||
    getImageTaskMediaUrl(currentTask);
  const isFailed = normalizedStatus === 'failed';
  const isCompleted = Boolean(resolvedUrl) && !isFailed;

  return {
    taskId: queryTaskId || currentTask?.taskId || '',
    status: isCompleted ? 'completed' : isFailed ? 'failed' : normalizedStatus,
    progress:
      isCompleted || isFailed
        ? 100
        : nextTaskState?.progress ?? currentTask?.progress ?? 0,
    url: isCompleted ? resolvedUrl : currentTask?.url || '',
    resultUrl: isCompleted ? resolvedUrl : currentTask?.resultUrl || '',
    error: isFailed
      ? nextTaskState?.error || currentTask?.error || '图片生成失败'
      : '',
    finalizingAt: 0,
    progressUnavailable: false,
    requestPollable: Boolean(queryTaskId || currentTask?.taskId) && !isTerminalImageTaskStatus(isCompleted ? 'completed' : normalizedStatus),
  };
};

const buildResolvedVideoTaskPatch = (queryTaskId, nextTaskState) => (currentTask) => {
  const normalizedStatus = normalizeVideoTaskStatus(
    nextTaskState?.status || currentTask?.status || '',
  );
  const resolvedUrl = normalizeVideoMediaUrl(nextTaskState?.url);
  const currentMediaUrl = getVideoTaskMediaUrl(currentTask);
  const currentTaskId = getRecoverableVideoTaskId(currentTask);
  const canReuseCurrentMediaUrl =
    Boolean(currentMediaUrl) &&
    (!queryTaskId || currentTaskId === queryTaskId);
  const safeFinalUrl = resolvedUrl || (canReuseCurrentMediaUrl ? currentMediaUrl : '');
  const completedWithoutVideo = normalizedStatus === 'completed' && !safeFinalUrl;
  const isFailed = normalizedStatus === 'failed' || completedWithoutVideo;
  const isCompleted = Boolean(safeFinalUrl) && !isFailed;
  const nextStatus = isCompleted
    ? 'completed'
    : isFailed
      ? 'failed'
      : normalizedStatus;
  const nextUrl = isFailed ? '' : safeFinalUrl;

  return {
    taskId: queryTaskId || currentTask?.taskId || '',
    status: nextStatus,
    progress:
      isCompleted || isFailed
        ? 100
        : nextTaskState?.progress ?? currentTask?.progress ?? 0,
    url: nextUrl,
    resultUrl: nextUrl,
    content:
      typeof nextTaskState?.content === 'string'
        ? nextTaskState.content
        : currentTask?.content || '',
    error: isFailed
      ? nextTaskState?.error || currentTask?.error || '任务生成失败'
      : '',
    finalizingAt: 0,
    requestPollable: false,
    pollable: Boolean(queryTaskId || currentTask?.taskId) && !isTerminalVideoTaskStatus(nextStatus),
  };
};

const buildResolvedVideoTaskIdPatch = (queryTaskId) => (currentTask) => ({
  taskId: queryTaskId || currentTask?.taskId || '',
  requestPollable: false,
  pollable:
    Boolean(queryTaskId || currentTask?.taskId) &&
    !isTerminalVideoTaskStatus(currentTask?.status) &&
    !Boolean(getVideoTaskMediaUrl(currentTask)),
});

const getTaskDtoImageUrls = (task) => {
  const dataPayload = normalizeTaskDtoDataPayload(task);
  const urls = [];
  const appendUniqueUrl = (candidate) => {
    if (typeof candidate !== 'string') {
      return;
    }
    const trimmedCandidate = candidate.trim();
    if (!trimmedCandidate || urls.includes(trimmedCandidate)) {
      return;
    }
    urls.push(trimmedCandidate);
  };

  appendUniqueUrl(getTaskDtoResultUrl(task));

  const items = Array.isArray(dataPayload?.data)
    ? dataPayload.data
    : Array.isArray(dataPayload)
      ? dataPayload
      : [];

  items.forEach((item) => {
    if (typeof item?.url === 'string' && item.url.trim()) {
      appendUniqueUrl(item.url.trim());
    }
    if (typeof item?.b64_json === 'string' && item.b64_json.trim()) {
      appendUniqueUrl(`data:image/png;base64,${item.b64_json.trim()}`);
    }
    if (typeof item?.b64Json === 'string' && item.b64Json.trim()) {
      appendUniqueUrl(`data:image/png;base64,${item.b64Json.trim()}`);
    }
  });

  const messageContent = dataPayload?.choices?.[0]?.message?.content;
  if (typeof messageContent === 'string') {
    extractImageUrlsFromMessage(messageContent).forEach(appendUniqueUrl);
  } else if (Array.isArray(messageContent)) {
    messageContent.forEach((item) => {
      if (item?.type === 'image_url') {
        if (typeof item?.image_url === 'string' && item.image_url.trim()) {
          appendUniqueUrl(item.image_url.trim());
        } else if (typeof item?.image_url?.url === 'string' && item.image_url.url.trim()) {
          appendUniqueUrl(item.image_url.url.trim());
        }
        return;
      }

      const textContent =
        typeof item?.text === 'string'
          ? item.text
          : (typeof item?.content === 'string' ? item.content : '');
      extractImageUrlsFromMessage(textContent).forEach(appendUniqueUrl);
    });
  }

  return urls;
};

const getCreativeRequestErrorMessage = (error) => {
  const responseData = error?.response?.data;

  if (
    typeof responseData?.error?.message === 'string' &&
    responseData.error.message.trim()
  ) {
    return responseData.error.message.trim();
  }

  if (typeof responseData?.message === 'string' && responseData.message.trim()) {
    return responseData.message.trim();
  }

  if (typeof responseData === 'string' && responseData.trim()) {
    return responseData.trim();
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }

  return '请稍后再试。';
};

const shouldTreatCreativeRequestErrorAsRecoverable = (error) => {
  const statusCode = Number(error?.response?.status) || 0;
  const responseData = error?.response?.data;
  const errorCode = String(
    responseData?.error?.code || responseData?.code || '',
  )
    .trim()
    .toLowerCase();
  const errorType = String(
    responseData?.error?.type || responseData?.type || '',
  )
    .trim()
    .toLowerCase();
  const errorMessage = getCreativeRequestErrorMessage(error).toLowerCase();

  if (
    errorCode === 'insufficient_user_quota' ||
    errorCode === 'pre_consume_token_quota_failed' ||
    errorType === 'insufficient_quota' ||
    errorType === 'insufficient_user_quota' ||
    errorMessage.includes('用户额度不足') ||
    errorMessage.includes('订阅额度不足') ||
    errorMessage.includes('额度不足') ||
    errorMessage.includes('subscription quota insufficient') ||
    errorMessage.includes('user quota is not enough') ||
    errorMessage.includes('token quota is not enough') ||
    errorMessage.includes('insufficient quota')
  ) {
    return false;
  }

  if (!statusCode) {
    return true;
  }

  if ([408, 409, 425, 429].includes(statusCode)) {
    return true;
  }

  if (statusCode >= 500) {
    return true;
  }

  return false;
};

const buildRecoverableImageCandidateKey = (candidate) =>
  `${candidate.sessionId}:${candidate.recordId}:${candidate.imageId}`;

const normalizeImageTaskItem = (item, index = 0) => {
  if (typeof item === 'string') {
    return {
      id: createCreativeRecordId(`image-task-${index}`),
      url: item,
      status: 'completed',
      progress: 100,
      error: '',
    };
  }

  const resolvedImageUrl = getImageTaskMediaUrl(item);
  const progress =
    parseProgressValue(item?.progress) ?? (resolvedImageUrl ? 100 : 0);
  const normalizedStatus =
    item?.status || (resolvedImageUrl ? 'completed' : 'pending');

  return {
    id: item?.id || createCreativeRecordId(`image-task-${index}`),
    taskId: item?.taskId || item?.task_id || '',
    url: resolvedImageUrl,
    status: resolvedImageUrl ? 'completed' : normalizedStatus,
    progress,
    error: item?.error || '',
    resultUrl:
      typeof item?.resultUrl === 'string'
        ? item.resultUrl
        : (typeof item?.result_url === 'string' ? item.result_url : ''),
    requestId: typeof item?.requestId === 'string' ? item.requestId : '',
    submittedAt: parseTimestampValue(
      item?.submittedAt || item?.submitted_at,
      0,
    ),
    estimateStartAt: parseTimestampValue(
      item?.estimateStartAt || item?.estimate_start_at,
      0,
    ),
    finalizingAt: parseTimestampValue(
      item?.finalizingAt || item?.finalizing_at,
      0,
    ),
    requestPollable:
      typeof item?.requestPollable === 'boolean'
        ? item.requestPollable
        : !resolvedImageUrl &&
          !['completed', 'failed'].includes(normalizedStatus),
  };
};

const normalizeVideoTaskItem = (item, index = 0) => {
  const resolvedVideoUrl = getVideoTaskMediaUrl(item);
  const normalizedStatus = normalizeVideoTaskStatus(
    item?.status || (resolvedVideoUrl ? 'completed' : 'submitted'),
  );
  const completedWithoutVideo =
    !resolvedVideoUrl && normalizedStatus === 'completed';
  const recoveredTaskId = getRecoverableVideoTaskId(item);
  const progress =
    parseProgressValue(item?.progress) ??
    ((resolvedVideoUrl || completedWithoutVideo || normalizedStatus === 'failed')
      ? 100
      : 0);
  const resolvedStatus = resolvedVideoUrl
    ? 'completed'
    : completedWithoutVideo
      ? 'failed'
      : normalizedStatus;

  return {
    id: item?.id || createCreativeRecordId(`video-task-${index}`),
    taskId: item?.taskId || item?.task_id || item?.id || '',
    status: resolvedStatus,
    url: resolvedVideoUrl,
    content: item?.content || '',
    progress,
    error:
      item?.error ||
      (completedWithoutVideo ? '任务生成失败' : ''),
    resultUrl: item?.resultUrl || '',
    resultContent: item?.resultContent || '',
    requestId: item?.requestId || '',
    submittedAt: parseTimestampValue(
      item?.submittedAt || item?.submitted_at,
      0,
    ),
    estimateStartAt: parseTimestampValue(
      item?.estimateStartAt || item?.estimate_start_at,
      0,
    ),
    finalizingAt: parseTimestampValue(
      item?.finalizingAt || item?.finalizing_at,
      0,
    ),
    requestPollable:
      typeof item?.requestPollable === 'boolean'
        ? item.requestPollable
        : !resolvedVideoUrl &&
          !recoveredTaskId &&
          Boolean(String(item?.requestId || '').trim()) &&
          ACTIVE_VIDEO_POLL_STATUSES.has(normalizedStatus),
    pollable:
      typeof item?.pollable === 'boolean'
        ? (resolvedVideoUrl ? false : item.pollable)
        : !resolvedVideoUrl && ACTIVE_VIDEO_POLL_STATUSES.has(normalizedStatus),
  };
};

const getTaskStatusLabel = (status) => {
  switch (status) {
    case 'completed':
      return '已完成';
    case 'failed':
      return '失败';
    case 'queued':
      return '排队中';
    case 'submitted':
      return '已提交';
    case 'finalizing':
      return '整理结果中';
    case 'generating':
    case 'processing':
    case 'in_progress':
    case 'pending':
    default:
      return '生成中';
  }
};

const normalizeImageHistoryRecords = (snapshot) => {
  const payload = snapshot?.payload || {};

  if (Array.isArray(payload?.entries)) {
    return payload.entries.map((entry, index) => {
      const images = Array.isArray(entry?.images)
        ? entry.images
            .filter(Boolean)
            .map((item, imageIndex) => normalizeImageTaskItem(item, imageIndex))
        : [];
      const summary = summarizeImageTasks(images);

      return {
      id: entry?.id || createCreativeRecordId(`image-history-${index}`),
      prompt: entry?.prompt || '',
      modelName: entry?.modelName || entry?.model_name || snapshot?.model_name || '',
      params: entry?.params && typeof entry.params === 'object' ? entry.params : {},
      sourceImages: Array.isArray(entry?.sourceImages || entry?.source_images)
        ? (entry?.sourceImages || entry?.source_images)
            .map((item, sourceImageIndex) =>
              normalizeCreativeSourceImageItem(item, sourceImageIndex),
            )
            .filter(Boolean)
        : [],
      group: entry?.group || snapshot?.group || '',
      status: summary.status,
      images,
      error: entry?.error || '',
      total: Number(entry?.total) || images.length,
      completedCount: summary.completedCount,
      successCount: summary.successCount,
      createdAt: entry?.createdAt || entry?.created_at || snapshot?.updated_at || Date.now(),
      updatedAt: entry?.updatedAt || entry?.updated_at || snapshot?.updated_at || Date.now(),
      };
    });
  }

  if (Array.isArray(payload?.images) && payload.images.length > 0) {
    return [
      {
        id: createCreativeRecordId('image-history'),
        prompt: snapshot?.prompt || '',
        modelName: snapshot?.model_name || '',
        params: payload?.params && typeof payload.params === 'object' ? payload.params : {},
        sourceImages: Array.isArray(payload?.sourceImages || payload?.source_images)
          ? (payload?.sourceImages || payload?.source_images)
              .map((item, sourceImageIndex) =>
                normalizeCreativeSourceImageItem(item, sourceImageIndex),
              )
              .filter(Boolean)
          : [],
        group: snapshot?.group || '',
        status: 'completed',
        images: payload.images
          .filter(Boolean)
          .map((item, imageIndex) => normalizeImageTaskItem(item, imageIndex)),
        error: '',
        total: payload.images.length,
        completedCount: payload.images.length,
        successCount: payload.images.length,
        createdAt: snapshot?.updated_at || Date.now(),
        updatedAt: snapshot?.updated_at || Date.now(),
      },
    ];
  }

  return [];
};

const normalizeVideoHistoryRecords = (snapshot) => {
  const payload = snapshot?.payload || {};

  if (Array.isArray(payload?.entries)) {
    return payload.entries.map((entry, index) => {
      const tasks = Array.isArray(entry?.tasks)
        ? entry.tasks.map((item, taskIndex) => normalizeVideoTaskItem(item, taskIndex))
        : [];
      const summary = summarizeVideoTasks(tasks);

      return {
      id: entry?.id || createCreativeRecordId(`video-history-${index}`),
      prompt: entry?.prompt || '',
      modelName: entry?.modelName || entry?.model_name || snapshot?.model_name || '',
      params: entry?.params && typeof entry.params === 'object' ? entry.params : {},
      sourceImages: Array.isArray(entry?.sourceImages || entry?.source_images)
        ? (entry?.sourceImages || entry?.source_images)
            .map((item, sourceImageIndex) =>
              normalizeCreativeSourceImageItem(item, sourceImageIndex),
            )
            .filter(Boolean)
        : [],
      group: entry?.group || snapshot?.group || '',
      status: summary.status,
      tasks,
      error: entry?.error || '',
      total: Number(entry?.total) || tasks.length,
      completedCount: summary.completedCount,
      successCount: summary.successCount,
      createdAt: entry?.createdAt || entry?.created_at || snapshot?.updated_at || Date.now(),
      updatedAt: entry?.updatedAt || entry?.updated_at || snapshot?.updated_at || Date.now(),
      };
    });
  }

  if (Array.isArray(payload?.tasks) && payload.tasks.length > 0) {
    const tasks = payload.tasks.map((item, taskIndex) =>
      normalizeVideoTaskItem(item, taskIndex),
    );
    const summary = summarizeVideoTasks(tasks);
    return [
      {
        id: createCreativeRecordId('video-history'),
        prompt: snapshot?.prompt || '',
        modelName: snapshot?.model_name || '',
        params: payload?.params && typeof payload.params === 'object' ? payload.params : {},
        sourceImages: Array.isArray(payload?.sourceImages || payload?.source_images)
          ? (payload?.sourceImages || payload?.source_images)
              .map((item, sourceImageIndex) =>
                normalizeCreativeSourceImageItem(item, sourceImageIndex),
              )
              .filter(Boolean)
          : [],
        status: summary.status,
        tasks,
        error:
          summary.completedCount === tasks.length && summary.successCount === 0
            ? '全部视频任务都生成失败了，请稍后重试。'
            : '',
        total: payload.tasks.length,
        completedCount: summary.completedCount,
        successCount: summary.successCount,
        createdAt: snapshot?.updated_at || Date.now(),
        updatedAt: snapshot?.updated_at || Date.now(),
      },
    ];
  }

  return [];
};

const applyVideoTaskPatchToRecords = (records, recordId, taskId, taskPatch) => {
  let recordsChanged = false;

  const nextRecords = (records || []).map((record) => {
    if (record.id !== recordId) {
      return record;
    }

    let hasChanged = false;
    const nextTasks = record.tasks.map((task) => {
      if (task.id !== taskId) {
        return task;
      }

      hasChanged = true;
      const nextTask = {
        ...task,
        ...(typeof taskPatch === 'function' ? taskPatch(task) : taskPatch),
      };
      return {
        ...nextTask,
        status: normalizeVideoTaskStatus(nextTask.status),
      };
    });

    if (!hasChanged) {
      return record;
    }

    recordsChanged = true;
    const summary = summarizeVideoTasks(nextTasks);
    return {
      ...record,
      tasks: nextTasks,
      ...summary,
      error:
        summary.completedCount === record.total && summary.successCount === 0
          ? '全部视频任务都生成失败了，请稍后重试。'
          : '',
      updatedAt: Date.now(),
    };
  });

  return {
    nextRecords: recordsChanged ? nextRecords : records,
    hasChanged: recordsChanged,
  };
};

const applyImageTaskPatchToRecords = (records, recordId, imageId, taskPatch) => {
  let recordsChanged = false;

  const nextRecords = (records || []).map((record) => {
    if (record.id !== recordId) {
      return record;
    }

    let hasChanged = false;
    const nextImages = record.images.map((image) => {
      if (image.id !== imageId) {
        return image;
      }

      hasChanged = true;
      return {
        ...image,
        ...(typeof taskPatch === 'function' ? taskPatch(image) : taskPatch),
      };
    });

    if (!hasChanged) {
      return record;
    }

    recordsChanged = true;
    const summary = summarizeImageTasks(nextImages);
    return {
      ...record,
      images: nextImages,
      ...summary,
      error:
        summary.completedCount === record.total && summary.successCount === 0
          ? '全部图片任务都生成失败了，请稍后重试。'
          : '',
      updatedAt: Date.now(),
    };
  });

  return {
    nextRecords: recordsChanged ? nextRecords : records,
    hasChanged: recordsChanged,
  };
};

const collectRecoverableImageCandidatesFromSnapshot = (snapshot) => {
  const normalizedSnapshot = normalizeCreativeHistorySnapshot('image', snapshot);
  const sessions = normalizedSnapshot?.payload?.sessions || [];

  return sessions
    .flatMap((session) => {
      const records = normalizeImageHistoryRecords(session);
      return records.flatMap((record) =>
        record.images.map((image, imageIndex) => ({
          sessionId: session.id,
          recordId: record.id,
          imageId: image.id,
          itemIndex: imageIndex,
          queryTaskId: getRecoverableImageTaskId(image),
          requestId: String(image?.requestId || '').trim(),
          hasMedia: Boolean(getImageTaskMediaUrl(image)),
          status: String(image?.status || '').trim().toLowerCase(),
          recordModelName: String(record?.modelName || '').trim(),
          recordCreatedAt: Number(record?.createdAt) || 0,
          recordUpdatedAt: Number(record?.updatedAt) || 0,
          sortTimestamp:
            Number(image?.submittedAt) ||
            Number(record?.updatedAt) ||
            Number(record?.createdAt) ||
            Number(session?.updated_at) ||
            0,
        })),
      );
    })
    .filter(
      (item) =>
        !item.hasMedia &&
        !isTerminalImageTaskStatus(item.status) &&
        Boolean(item.queryTaskId || item.requestId),
    )
    .sort((left, right) => right.sortTimestamp - left.sortTimestamp);
};

const patchImageTaskInHistorySnapshot = (snapshot, candidate, taskPatch) => {
  const normalizedSnapshot = normalizeCreativeHistorySnapshot('image', snapshot);
  let snapshotChanged = false;

  const nextSessions = normalizedSnapshot.payload.sessions.map((session) => {
    if (session.id !== candidate.sessionId) {
      return session;
    }

    const sessionRecords = normalizeImageHistoryRecords(session);
    const { nextRecords, hasChanged } = applyImageTaskPatchToRecords(
      sessionRecords,
      candidate.recordId,
      candidate.imageId,
      taskPatch,
    );

    if (!hasChanged) {
      return session;
    }

    snapshotChanged = true;
    return {
      ...session,
      updated_at: Date.now(),
      payload: {
        ...buildCreativeSessionPayload('image', session.payload),
        entries: nextRecords,
      },
    };
  });

  return {
    snapshot: snapshotChanged
      ? {
          ...normalizedSnapshot,
          updated_at: Date.now(),
          payload: {
            ...normalizedSnapshot.payload,
            sessions: nextSessions,
          },
        }
      : normalizedSnapshot,
    hasChanged: snapshotChanged,
  };
};

const collectRecoverableVideoCandidatesFromSnapshot = (snapshot) => {
  const normalizedSnapshot = normalizeCreativeHistorySnapshot('video', snapshot);
  const sessions = normalizedSnapshot?.payload?.sessions || [];

  return sessions
    .flatMap((session) => {
      const records = normalizeVideoHistoryRecords(session);
      return records.flatMap((record) =>
        record.tasks.map((task, taskIndex) => ({
          sessionId: session.id,
          recordId: record.id,
          taskId: task.id,
          itemIndex: taskIndex,
          queryTaskId: getRecoverableVideoTaskId(task),
          requestId: String(task?.requestId || '').trim(),
          hasMedia: Boolean(getVideoTaskMediaUrl(task)),
          status: normalizeVideoTaskStatus(task.status),
          recordModelName: String(record?.modelName || '').trim(),
          recordCreatedAt: Number(record?.createdAt) || 0,
          recordUpdatedAt: Number(record?.updatedAt) || 0,
          sortTimestamp:
            Number(task?.submittedAt) ||
            Number(record?.updatedAt) ||
            Number(record?.createdAt) ||
            Number(session?.updated_at) ||
            0,
        })),
      );
    })
    .filter(
      (task) =>
        !task.hasMedia &&
        !isTerminalVideoTaskStatus(task.status) &&
        Boolean(
          task.queryTaskId ||
            task.requestId ||
            task.sortTimestamp ||
            task.recordCreatedAt ||
            task.recordUpdatedAt,
        ),
    )
    .sort((left, right) => right.sortTimestamp - left.sortTimestamp);
};

const patchVideoTaskInHistorySnapshot = (snapshot, candidate, taskPatch) => {
  const normalizedSnapshot = normalizeCreativeHistorySnapshot('video', snapshot);
  let snapshotChanged = false;

  const nextSessions = normalizedSnapshot.payload.sessions.map((session) => {
    if (session.id !== candidate.sessionId) {
      return session;
    }

    const sessionRecords = normalizeVideoHistoryRecords(session);
    const { nextRecords, hasChanged } = applyVideoTaskPatchToRecords(
      sessionRecords,
      candidate.recordId,
      candidate.taskId,
      taskPatch,
    );

    if (!hasChanged) {
      return session;
    }

    snapshotChanged = true;
    return {
      ...session,
      updated_at: Date.now(),
      payload: {
        ...buildCreativeSessionPayload('video', session.payload),
        entries: nextRecords,
      },
    };
  });

  return {
    snapshot: snapshotChanged
      ? {
          ...normalizedSnapshot,
          updated_at: Date.now(),
          payload: {
            ...normalizedSnapshot.payload,
            sessions: nextSessions,
          },
        }
      : normalizedSnapshot,
    hasChanged: snapshotChanged,
  };
};

const getEmptyCreativeSessionPayload = (tabKey) => {
  if (tabKey === 'chat') {
    return { messages: [] };
  }
  return {
    entries: [],
    params: {},
  };
};

const getDefaultCreativeSessionName = (tabKey, index = 1) => {
  const tabLabelMap = {
    chat: '对话',
    image: '图片',
    video: '视频',
  };
  return `${tabLabelMap[tabKey] || '创作'}会话 ${index}`;
};

const hasCreativeSessionContent = (tabKey, payload) => {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  if (tabKey === 'chat') {
    return Array.isArray(payload.messages) && payload.messages.length > 0;
  }

  return Array.isArray(payload.entries) && payload.entries.length > 0;
};

const createCreativeSessionSnapshot = (tabKey, overrides = {}) => {
  const now = Date.now();
  return {
    id: overrides.id || createCreativeRecordId(`${tabKey}-session`),
    name: overrides.name || getDefaultCreativeSessionName(tabKey),
    model_name: overrides.model_name || overrides.modelName || '',
    group: overrides.group || '',
    prompt: overrides.prompt || '',
    payload:
      overrides.payload && typeof overrides.payload === 'object'
        ? overrides.payload
        : getEmptyCreativeSessionPayload(tabKey),
    created_at: overrides.created_at || overrides.createdAt || now,
    updated_at: overrides.updated_at || overrides.updatedAt || now,
  };
};

const normalizeCreativeSessionSnapshot = (
  tabKey,
  session,
  fallbackSnapshot = null,
  index = 0,
) =>
  createCreativeSessionSnapshot(tabKey, {
    id: session?.id,
    name:
      session?.name ||
      session?.title ||
      getDefaultCreativeSessionName(tabKey, index + 1),
    model_name:
      session?.model_name ||
      session?.modelName ||
      fallbackSnapshot?.model_name ||
      '',
    group: session?.group || fallbackSnapshot?.group || '',
    prompt: session?.prompt || fallbackSnapshot?.prompt || '',
    payload:
      session?.payload && typeof session.payload === 'object'
        ? session.payload
        : getEmptyCreativeSessionPayload(tabKey),
    created_at:
      session?.created_at ||
      session?.createdAt ||
      fallbackSnapshot?.created_at ||
      fallbackSnapshot?.updated_at ||
      Date.now(),
    updated_at:
      session?.updated_at ||
      session?.updatedAt ||
      fallbackSnapshot?.updated_at ||
      Date.now(),
  });

const normalizeCreativeHistorySnapshot = (tabKey, snapshot) => {
  const rawPayload =
    snapshot?.payload && typeof snapshot.payload === 'object'
      ? snapshot.payload
      : {};

  let sessions = Array.isArray(rawPayload?.sessions)
    ? rawPayload.sessions
        .filter(Boolean)
        .map((session, index) =>
          normalizeCreativeSessionSnapshot(tabKey, session, snapshot, index),
        )
    : [];

  if (sessions.length === 0) {
    const legacyPayload =
      snapshot?.payload && typeof snapshot.payload === 'object'
        ? snapshot.payload
        : getEmptyCreativeSessionPayload(tabKey);

    if (
      snapshot ||
      hasCreativeSessionContent(tabKey, legacyPayload) ||
      snapshot?.model_name ||
      snapshot?.prompt
    ) {
      sessions = [
        normalizeCreativeSessionSnapshot(
          tabKey,
          {
            name: getDefaultCreativeSessionName(tabKey, 1),
            model_name: snapshot?.model_name || '',
            group: snapshot?.group || '',
            prompt: snapshot?.prompt || '',
            payload: legacyPayload,
            created_at: snapshot?.created_at,
            updated_at: snapshot?.updated_at,
          },
          snapshot,
          0,
        ),
      ];
    }
  }

  if (sessions.length === 0) {
    sessions = [createCreativeSessionSnapshot(tabKey, { name: getDefaultCreativeSessionName(tabKey, 1) })];
  }

  const requestedCurrentSessionId =
    typeof rawPayload?.current_session_id === 'string'
      ? rawPayload.current_session_id
      : '';
  const currentSessionId = sessions.some(
    (session) => session.id === requestedCurrentSessionId,
  )
    ? requestedCurrentSessionId
    : sessions[0]?.id || '';
  const currentSession =
    sessions.find((session) => session.id === currentSessionId) || sessions[0] || null;

  return {
    id: snapshot?.id || null,
    tab: tabKey,
    model_name: currentSession?.model_name || snapshot?.model_name || '',
    group: currentSession?.group || snapshot?.group || '',
    prompt: currentSession?.prompt || snapshot?.prompt || '',
    payload: {
      current_session_id: currentSessionId,
      sessions,
    },
    created_at:
      snapshot?.created_at || currentSession?.created_at || Date.now(),
    updated_at:
      snapshot?.updated_at || currentSession?.updated_at || Date.now(),
  };
};

const getCreativeHistorySessions = (snapshot, tabKey) =>
  normalizeCreativeHistorySnapshot(tabKey, snapshot)?.payload?.sessions || [];

const getCreativeCurrentSessionSnapshot = (snapshot, tabKey) => {
  const normalizedSnapshot = normalizeCreativeHistorySnapshot(tabKey, snapshot);
  return (
    normalizedSnapshot.payload.sessions.find(
      (session) => session.id === normalizedSnapshot.payload.current_session_id,
    ) ||
    normalizedSnapshot.payload.sessions[0] ||
    null
  );
};

const buildCreativeSessionPayload = (tabKey, payload) =>
  payload && typeof payload === 'object'
    ? payload
    : getEmptyCreativeSessionPayload(tabKey);

const formatCreativeSessionMeta = (tabKey, session) => {
  const payload = buildCreativeSessionPayload(tabKey, session?.payload);

  if (tabKey === 'chat') {
    const messageCount = Array.isArray(payload.messages) ? payload.messages.length : 0;
    return `${messageCount} 条消息`;
  }

  const entryCount = Array.isArray(payload.entries) ? payload.entries.length : 0;
  return `${entryCount} 条记录`;
};

const renderCreativeModelIcon = (
  channelType,
  iconName,
  fallbackTab,
  vendorIconName = '',
) => {
  if (iconName) {
    return <div className='scale-[1.35]'>{getLobeHubIcon(iconName, 20)}</div>;
  }

  if (vendorIconName) {
    return (
      <div className='scale-[1.35]'>{getLobeHubIcon(vendorIconName, 20)}</div>
    );
  }

  const channelIcon = channelType ? getChannelIcon(channelType) : null;
  if (channelIcon) {
    return <div className='scale-[1.7] text-current'>{channelIcon}</div>;
  }

  if (fallbackTab === 'image') {
    return <span className='font-bold text-blue-600'>IM</span>;
  }

  if (fallbackTab === 'video') {
    return <GrokIcon size={20} className='text-blue-600' />;
  }

  return <GPTIcon size={20} className='text-blue-600' />;
};

const GPTIcon = ({ size = 24, className = '' }) => (
  <svg width={size} height={size} viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg' className={className}>
    <path d='M22.2819 9.8211a5.9847 5.9847 0 0 0-.5153-4.9066 6.0462 6.0462 0 0 0-3.9471-3.1358 6.0417 6.0417 0 0 0-5.1923 1.0689 6.0222 6.0222 0 0 0-4.385-1.9231 6.0464 6.0464 0 0 0-5.4604 3.4456 6.0536 6.0536 0 0 0-.8101 4.8906 6.0538 6.0538 0 0 0 3.1467 3.9573 6.0585 6.0585 0 0 0-1.065 5.2124 6.0545 6.0545 0 0 0 1.9292 4.3941 6.0513 6.0513 0 0 0 4.0011 1.6379 6.0106 6.0106 0 0 0 4.3389-1.8964 6.0562 6.0562 0 0 0 5.4628-3.4481 6.0519 6.0519 0 0 0 .8175-4.9088 6.0483 6.0483 0 0 0-3.1463-3.9429 6.0548 6.0548 0 0 0 1.0254-4.8882Z' fill='currentColor' />
  </svg>
);

const GrokIcon = ({ size = 24, className = '' }) => (
  <svg width={size} height={size} viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' className={className}>
    <circle cx='12' cy='12' r='9' />
    <line x1='6' y1='18' x2='18' y2='6' />
    <circle cx='18' cy='6' r='2.5' fill='currentColor' />
  </svg>
);

const DropButton = ({ icon, label, open, onClick, children }) => (
  <div className='relative shrink-0'>
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2 text-[12px] font-bold shadow-sm backdrop-blur-md transition-all duration-300 sm:gap-2 sm:px-4 sm:py-2.5 sm:text-[13px] ${
        open 
          ? 'border-blue-200 bg-blue-50 text-blue-700' 
          : 'border-slate-200/50 bg-white/60 text-slate-600 hover:bg-white hover:border-blue-200 hover:text-blue-600'
      }`}
    >
      {icon}
      {label}
      <ChevronDown size={14} className={`text-slate-400 transition-transform duration-300 ${open ? 'rotate-180 text-blue-300' : ''}`} />
    </button>
    {children}
  </div>
);

const DropSelectButton = ({
  menuKey,
  icon,
  label,
  value,
  options,
  openMenu,
  setOpenMenu,
  onSelect,
  widthClass = 'w-40',
}) => (
  <DropButton
    icon={icon}
    label={label}
    open={openMenu === menuKey}
    onClick={() => setOpenMenu(openMenu === menuKey ? null : menuKey)}
  >
    {openMenu === menuKey && (
      <div className={`absolute bottom-[110%] left-0 z-20 mb-2 ${widthClass} rounded-[1.25rem] border border-blue-100/50 bg-white/95 backdrop-blur-3xl p-1.5 shadow-[0_12px_40px_-10px_rgba(59,130,246,0.15)] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200`}>
        <div className='relative flex flex-col'>
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onSelect(option.value);
                setOpenMenu(null);
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-[13px] font-bold transition-all duration-200 ${
                value === option.value
                  ? 'bg-blue-50 text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-blue-500'
              }`}
            >
              <span>{option.label}</span>
              {value === option.value && <Check size={14} className="text-blue-500" />}
            </button>
          ))}
        </div>
      </div>
    )}
  </DropButton>
);

export default function App() {
  const [userState] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);
  const [activeTab, setActiveTab] = useState('chat');
  const [activeModel, setActiveModel] = useState('chat1');
  const [hoveredSidebarModelId, setHoveredSidebarModelId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [imageRecords, setImageRecords] = useState([]);
  const [videoRecords, setVideoRecords] = useState([]);
  const [activeGroup, setActiveGroup] = useState('');
  const [modelsHydrated, setModelsHydrated] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const [params, setParams] = useState({
    generationCount: '1',
    imageSize: '1024x1024',
    aspectRatio: '1:1',
    autoImageSize: '1024x1024',
    outputResolution: '2K',
    videoSize: '1280x720',
    videoSeconds: '10',
    videoQuality: '480p',
    videoPreset: 'normal',
    videoDuration: '4',
    videoResolution: '1080p',
    referenceMode: 'frame',
  });

  const textareaRef = useRef(null);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const imagePollingTimerRef = useRef(null);
  const imagePollingInFlightRef = useRef(new Set());
  const videoPollingTimerRef = useRef(null);
  const videoPollingInFlightRef = useRef(new Set());
  const chatMessagesRef = useRef([]);
  const imageRecordsRef = useRef([]);
  const videoRecordsRef = useRef([]);
  const uploadedImagesRef = useRef([]);
  const creativeCenterUploadConfigRef = useRef(null);
  const historyHydratedRef = useRef(false);
  const lastPersistedImageSignatureRef = useRef('');
  const lastPersistedVideoSignatureRef = useRef('');
  const startupImageRecoveryRunRef = useRef(false);
  const startupVideoRecoveryRunRef = useRef(false);
  const creativeHistoryPersistWarningAtRef = useRef(0);
  const creativeHistoryPersistBlockedUntilRef = useRef(0);
  const lastActiveImageReconcileSignatureRef = useRef('');
  const lastActiveVideoReconcileSignatureRef = useRef('');
  const creativeImagePollingBlockedUntilRef = useRef(0);
  const creativeVideoPollingBlockedUntilRef = useRef(0);
  const isLoggedIn = Boolean(userState?.user);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [uploadImageNotice, setUploadImageNotice] = useState('');
  const [isUploadDragActive, setIsUploadDragActive] = useState(false);
  const isUploadingImage = uploadedImages.some((item) => item?.status === 'uploading');

  useEffect(() => {
    chatMessagesRef.current = chatMessages;
  }, [chatMessages]);

  useEffect(() => {
    imageRecordsRef.current = imageRecords;
  }, [imageRecords]);

  useEffect(() => {
    videoRecordsRef.current = videoRecords;
  }, [videoRecords]);

  const syncImageRecordsState = (nextRecords) => {
    imageRecordsRef.current = nextRecords;
    setImageRecords(nextRecords);
  };

  const syncVideoRecordsState = (nextRecords) => {
    videoRecordsRef.current = nextRecords;
    setVideoRecords(nextRecords);
  };

  useEffect(() => {
    uploadedImagesRef.current = uploadedImages;
  }, [uploadedImages]);

  useEffect(() => {
    creativeCenterUploadConfigRef.current = null;
  }, [isLoggedIn]);

  useEffect(() => {
    creativeHistoryPersistBlockedUntilRef.current = 0;
    creativeImagePollingBlockedUntilRef.current = 0;
    creativeVideoPollingBlockedUntilRef.current = 0;
  }, [isLoggedIn]);

  const notifyCreativeHistoryPersistFailure = (tabKey) => {
    const now = Date.now();
    if (now - creativeHistoryPersistWarningAtRef.current < 5000) {
      return;
    }
    creativeHistoryPersistWarningAtRef.current = now;
    showWarning(
      tabKey === 'chat'
        ? '对话记录保存失败，请稍后重试。'
        : '创作中心记录保存失败，刷新后可能看不到最新结果。',
    );
  };

  useEffect(() => {
    startupImageRecoveryRunRef.current = false;
  }, [isLoggedIn]);

  useEffect(() => {
    startupVideoRecoveryRunRef.current = false;
  }, [isLoggedIn]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeTab, chatMessages, imageRecords, videoRecords, isGenerating]);

  useEffect(() => {
    return () => {
      if (imagePollingTimerRef.current) {
        window.clearTimeout(imagePollingTimerRef.current);
      }
      if (videoPollingTimerRef.current) {
        window.clearTimeout(videoPollingTimerRef.current);
      }
      imagePollingTimerRef.current = null;
      videoPollingTimerRef.current = null;
      imagePollingInFlightRef.current.clear();
      videoPollingInFlightRef.current.clear();
      uploadedImagesRef.current.forEach((item) => {
        if (item?.previewUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, []);
  const fallbackModels = useMemo(
    () => ({
      chat: [
        {
          id: 'chat1',
          name: 'GPT-4o',
          desc: '通用旗舰模型，适合对话问答、写作整理与多场景创作。',
          icon: renderCreativeModelIcon(1, '', 'chat'),
        },
      ],
      image: [
        {
          id: 'img1',
          name: 'FLUX',
          desc: '高质量图片生成模型，适合海报、插画与视觉概念创作。',
          icon: renderCreativeModelIcon(0, '', 'image'),
        },
      ],
      video: [
        {
          id: 'v1',
          name: 'grok-video-3-plus',
          desc: '视频生成模型，适合生成短片分镜、动态概念与创意演示。',
          icon: renderCreativeModelIcon(48, '', 'video'),
        },
      ],
    }),
    [],
  );

  const [syncedModels, setSyncedModels] = useState({
    chat: [],
    image: [],
    video: [],
  });
  const [pricingGroupRatio, setPricingGroupRatio] = useState({});
  const [historySnapshots, setHistorySnapshots] = useState(EMPTY_HISTORY_SNAPSHOTS);
  const [isSessionPanelOpen, setIsSessionPanelOpen] = useState(false);
  const [collapsedImageRecordIds, setCollapsedImageRecordIds] = useState({});
  const [selectedImageTaskIds, setSelectedImageTaskIds] = useState({});
  const [previewImage, setPreviewImage] = useState(null);
  const [collapsedVideoRecordIds, setCollapsedVideoRecordIds] = useState({});
  const [selectedVideoTaskIds, setSelectedVideoTaskIds] = useState({});
  const [progressClock, setProgressClock] = useState(() => Date.now());
  const creativeCenterCurrencyOptions = useMemo(
    () => ({
      quotaDisplayType: statusState?.status?.quota_display_type || 'USD',
      usdExchangeRate:
        statusState?.status?.usd_exchange_rate ??
        statusState?.status?.price ??
        1,
      customExchangeRate:
        statusState?.status?.custom_currency_exchange_rate ?? 1,
      customCurrencySymbol:
        statusState?.status?.custom_currency_symbol ?? '¤',
    }),
    [statusState],
  );
  const imagePersistSignature = useMemo(
    () => buildCreativePersistSignature(imageRecords, 'image'),
    [imageRecords],
  );
  const videoPersistSignature = useMemo(
    () => buildCreativePersistSignature(videoRecords, 'video'),
    [videoRecords],
  );
  const hasActiveEstimatedTasks = useMemo(() => {
    if (activeTab === 'image') {
      return imageRecords.some(
        (record) =>
          shouldUseEstimatedImageProgress(record.modelName) &&
          record.images.some(
            (task) => !['completed', 'failed'].includes(task.status || 'pending'),
          ),
      );
    }

    if (activeTab === 'video') {
      return videoRecords.some(
        (record) =>
          shouldUseEstimatedVideoProgress(record.modelName) &&
          record.tasks.some(
            (task) => !['completed', 'failed'].includes(task.status || 'submitted'),
          ),
      );
    }

    return false;
  }, [activeTab, imageRecords, videoRecords]);

  useEffect(() => {
    if (!hasActiveEstimatedTasks) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setProgressClock(Date.now());
    }, ESTIMATED_PROGRESS_TICK_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [hasActiveEstimatedTasks]);

  useEffect(() => {
    let mounted = true;
    setModelsHydrated(false);

    const tabTagMap = {
      chat: ['文本', '对话', '聊天'],
      image: ['图片'],
      video: ['视频'],
    };

    const inferTabsFromModelName = (modelName) => {
      const normalizedName = String(modelName || '').toLowerCase();
      const videoKeywords = [
        'video',
        'veo',
        'sora',
        'kling',
        'runway',
        'pixverse',
        'hailuo',
        'wanx',
        'mov',
      ];
      const imageKeywords = [
        'image',
        'img',
        'imagen',
        'imagine',
        'flux',
        'stable-diffusion',
        'sdxl',
        'midjourney',
        'mj',
        'banana',
      ];

      if (videoKeywords.some((keyword) => normalizedName.includes(keyword))) {
        return ['video'];
      }

      if (imageKeywords.some((keyword) => normalizedName.includes(keyword))) {
        return ['image'];
      }

      return ['chat'];
    };

    const resolveTabsForModel = (modelName, model) => {
      const tags = String(model?.tags || '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
      const endpointTypes = Array.isArray(model?.supported_endpoint_types)
        ? model.supported_endpoint_types
        : [];
      const normalizedEndpoints = endpointTypes.map((type) =>
        String(type || '').toLowerCase(),
      );

      const matchedTabs = Object.entries(tabTagMap)
        .filter(([, aliases]) => aliases.some((alias) => tags.includes(alias)))
        .map(([tabKey]) => tabKey);

      if (matchedTabs.length > 0) {
        return matchedTabs;
      }

      if (normalizedEndpoints.some((endpoint) => endpoint.includes('video'))) {
        return ['video'];
      }

      if (
        normalizedEndpoints.some(
          (endpoint) =>
            endpoint.includes('image') || endpoint.includes('images'),
        )
      ) {
        return ['image'];
      }

      return inferTabsFromModelName(modelName);
    };

    const createModelCard = (model, tabKey, modelName, vendorMap) => {
      const tags = String(model?.tags || '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
      const resolvedModelName = model?.model_name || model?.name || modelName || '未命名模型';
      const vendor =
        model?.vendor_id && vendorMap[model.vendor_id]
          ? vendorMap[model.vendor_id]
          : null;
      const resolvedDescription =
        model?.description ||
        vendor?.description ||
        (tags.length > 0 ? `标签：${tags.join('、')}` : '来自模型管理');

      return {
        id: `${tabKey}:${resolvedModelName}`,
        value: resolvedModelName,
        name: resolvedModelName,
        desc: resolvedDescription,
        fullDesc: resolvedDescription,
        pricingModel: model,
        icon: renderCreativeModelIcon(
          Number(model?.channel_type || 0),
          model?.icon,
          tabKey,
          vendor?.icon,
        ),
      };
    };

    const loadManagedModels = async () => {
      try {
        const [pricingResult, userModelsResult, userGroupsResult] =
          await Promise.allSettled([
            API.get('/api/pricing', { skipErrorHandler: true }),
            isLoggedIn
              ? API.get(API_ENDPOINTS.USER_MODELS, { skipErrorHandler: true })
              : Promise.resolve({ data: { success: false, data: [] } }),
            isLoggedIn
              ? API.get(API_ENDPOINTS.USER_GROUPS, { skipErrorHandler: true })
              : Promise.resolve({ data: { success: false, data: {} } }),
          ]);

        const pricingModels =
          pricingResult.status === 'fulfilled' && pricingResult.value?.data?.success
            ? (Array.isArray(pricingResult.value.data.data)
                ? pricingResult.value.data.data
                : [])
            : [];
        const pricingVendors =
          pricingResult.status === 'fulfilled' && pricingResult.value?.data?.success
            ? (Array.isArray(pricingResult.value.data.vendors)
                ? pricingResult.value.data.vendors
                : [])
            : [];

        const userModels =
          userModelsResult.status === 'fulfilled' && userModelsResult.value?.data?.success
            ? (Array.isArray(userModelsResult.value.data.data)
                ? userModelsResult.value.data.data
                : [])
            : [];

        const pricingModelMap = new Map();
        pricingModels.forEach((item) => {
          const modelName = item?.model_name || item?.name;
          if (modelName) {
            pricingModelMap.set(modelName, item);
          }
        });

        const pricingVendorMap = pricingVendors.reduce((map, vendor) => {
          if (vendor?.id) {
            map[vendor.id] = vendor;
          }
          return map;
        }, {});

        const visibleModelNames =
          isLoggedIn && userModels.length > 0
            ? userModels
            : pricingModels
                .map((item) => item?.model_name || item?.name || '')
                .filter(Boolean);

        const nextModels = { chat: [], image: [], video: [] };
        visibleModelNames.forEach((modelName) => {
          const pricingModel = pricingModelMap.get(modelName);
          const tabsForModel = resolveTabsForModel(modelName, pricingModel);

          tabsForModel.forEach((tabKey) => {
            nextModels[tabKey].push(
              createModelCard(
                pricingModel || { model_name: modelName },
                tabKey,
                modelName,
                pricingVendorMap,
              ),
            );
          });
        });

        const dedupedModels = Object.fromEntries(
          Object.entries(nextModels).map(([tabKey, list]) => [
            tabKey,
            list.filter(
              (model, index, array) =>
                array.findIndex((item) => item.value === model.value) === index,
            ),
          ]),
        );

        let resolvedGroup = '';
        const localUserGroup = (() => {
          try {
            return JSON.parse(localStorage.getItem('user') || '{}')?.group || '';
          } catch {
            return '';
          }
        })();

        if (
          isLoggedIn &&
          userGroupsResult.status === 'fulfilled' &&
          userGroupsResult.value?.data?.success
        ) {
          const groupOptions = processGroupsData(
            userGroupsResult.value.data.data || {},
            localUserGroup,
          );
          resolvedGroup =
            groupOptions.find((group) => group.value === localUserGroup)?.value ||
            groupOptions[0]?.value ||
            localUserGroup;
        } else {
          resolvedGroup = localUserGroup;
        }

        if (mounted) {
          setSyncedModels(dedupedModels);
          setPricingGroupRatio(
            pricingResult.status === 'fulfilled' &&
              pricingResult.value?.data?.success &&
              pricingResult.value?.data?.group_ratio &&
              typeof pricingResult.value.data.group_ratio === 'object'
              ? pricingResult.value.data.group_ratio
              : {},
          );
          setActiveGroup(resolvedGroup);
        }
      } catch (error) {
        console.error('Failed to sync creative center models:', error);
      } finally {
        if (mounted) {
          setModelsHydrated(true);
        }
      }
    };

    loadManagedModels();

    return () => {
      mounted = false;
    };
  }, [isLoggedIn]);

  const modelPools = useMemo(
    () => ({
      chat:
        syncedModels.chat.length > 0
          ? syncedModels.chat.map((model) => ({
              ...model,
              priceLabel: buildCreativeCenterModelPriceLabel(
                model.pricingModel,
                activeGroup,
                pricingGroupRatio,
                creativeCenterCurrencyOptions,
              ),
            }))
          : fallbackModels.chat,
      image:
        syncedModels.image.length > 0
          ? syncedModels.image.map((model) => ({
              ...model,
              priceLabel: buildCreativeCenterModelPriceLabel(
                model.pricingModel,
                activeGroup,
                pricingGroupRatio,
                creativeCenterCurrencyOptions,
              ),
            }))
          : fallbackModels.image,
      video:
        syncedModels.video.length > 0
          ? syncedModels.video.map((model) => ({
              ...model,
              priceLabel: buildCreativeCenterModelPriceLabel(
                model.pricingModel,
                activeGroup,
                pricingGroupRatio,
                creativeCenterCurrencyOptions,
              ),
            }))
          : fallbackModels.video,
    }),
    [
      activeGroup,
      creativeCenterCurrencyOptions,
      fallbackModels,
      pricingGroupRatio,
      syncedModels,
    ],
  );

  const currentDisplayModels = modelPools[activeTab] || [];
  const hoveredSidebarModel =
    currentDisplayModels.find((model) => model.id === hoveredSidebarModelId) || null;
  const currentTabHistorySnapshot = useMemo(
    () =>
      historySnapshots[activeTab]
        ? normalizeCreativeHistorySnapshot(activeTab, historySnapshots[activeTab])
        : null,
    [activeTab, historySnapshots],
  );
  const currentTabSessions = currentTabHistorySnapshot?.payload?.sessions || [];
  const activeHistorySnapshot = useMemo(
    () =>
      currentTabHistorySnapshot
        ? getCreativeCurrentSessionSnapshot(currentTabHistorySnapshot, activeTab)
        : null,
    [activeTab, currentTabHistorySnapshot],
  );
  const findModelCard = (tabKey, modelName) =>
    (modelPools[tabKey] || []).find(
      (model) => model.value === modelName || model.name === modelName,
    ) || null;
  const selectedModel =
    currentDisplayModels.find((model) => model.id === activeModel) ||
    currentDisplayModels[0] ||
    null;
  const isCreativeCenterBootstrapping = !modelsHydrated || !historyLoaded;
  const currentModelName = selectedModel?.value || selectedModel?.name || '';
  const isGrokImagineImageModel =
    GROK_IMAGINE_IMAGE_MODELS.has(currentModelName);
  const isGrokImageEditModel = GROK_IMAGE_EDIT_MODELS.has(currentModelName);
  const isGrokImageGenerationModel =
    GROK_IMAGE_GENERATION_MODELS.has(currentModelName);
  const isAdobeImageModel = ADOBE_IMAGE_MODELS.has(currentModelName);
  const isAdobeVideoModel = ADOBE_VIDEO_MODELS.has(currentModelName);
  const isAdobeSoraModel =
    currentModelName === 'sora2' || currentModelName === 'sora2-pro';
  const isAdobeVeoModel =
    currentModelName === 'veo31' ||
    currentModelName === 'veo31-ref' ||
    currentModelName === 'veo31-fast';
  const isChatCompletionVideoModel = false;
  const isChatTab = activeTab === 'chat';
  const isSubmitPending = (isChatTab && isGenerating) || isUploadingImage;
  const isVideoModel =
    typeof currentModelName === 'string' && currentModelName.includes('video');
  const isGrokImagineVideoModel = currentModelName === 'grok-imagine-1.0-video';
  const currentVideoSecondsOptions = isGrokImagineVideoModel
    ? GROK_IMAGINE_VIDEO_SECONDS_OPTIONS
    : GENERIC_VIDEO_SECONDS_OPTIONS;
  const currentImageUploadLimit = getCreativeCenterImageUploadLimit(currentModelName);
  const currentAdobeImageAspectRatioOptions =
    getAdobeImageAspectRatioOptions(currentModelName);
  const currentAdobeSupportsAutoImageSize =
    supportsAdobeAutoImageSize(currentModelName);
  const isCurrentModelImageUploadEnabled = isCreativeCenterImageUploadEnabled(
    activeTab,
    currentModelName,
  );
  useEffect(() => {
    if (!currentImageUploadLimit || uploadedImages.length <= currentImageUploadLimit) {
      return;
    }

    setUploadedImages((prev) => {
      if (prev.length <= currentImageUploadLimit) {
        return prev;
      }
      const removedItems = prev.slice(currentImageUploadLimit);
      removedItems.forEach((item) => {
        revokeCreativeCenterPreviewURL(item.previewUrl);
      });
      return prev.slice(0, currentImageUploadLimit);
    });
    setUploadImageNotice(`当前模型最多上传 ${currentImageUploadLimit} 张图片，已自动保留前 ${currentImageUploadLimit} 张`);
    showWarning(`当前模型最多上传 ${currentImageUploadLimit} 张图片`);
  }, [currentImageUploadLimit, uploadedImages.length]);
  useEffect(() => {
    if (isCurrentModelImageUploadEnabled || uploadedImages.length === 0) {
      return;
    }

    setIsUploadDragActive(false);
    setUploadedImages((prev) => {
      prev.forEach((item) => {
        revokeCreativeCenterPreviewURL(item.previewUrl);
      });
      return [];
    });
    setUploadImageNotice('当前模型不支持上传图片，已清空已选图片');
    showWarning('当前模型不支持上传图片');
  }, [isCurrentModelImageUploadEnabled, uploadedImages.length]);
  const renderPendingTaskProgress = ({
    task,
    taskIndex,
    modelName,
    params: taskParams,
    taskType,
    detailText = '',
    detailClassName = 'text-slate-400',
  }) => {
    const progressMeta = getEstimatedTaskProgress({
      task,
      modelName,
      params: taskParams,
      taskType,
      now: progressClock,
    });
    const progressBarClass =
      task.status === 'failed' ? 'bg-red-400' : 'bg-blue-500';

    return (
      <div>
        <div className='mb-2 flex items-center justify-between text-[11px] text-slate-400'>
          <span>任务 {taskIndex + 1}</span>
          <span>{progressMeta.progressText}</span>
        </div>
        <div className='h-2 overflow-hidden rounded-full bg-slate-200'>
          {progressMeta.indeterminate ? (
            <div className='h-full w-2/5 rounded-full bg-blue-500 animate-pulse' />
          ) : (
            <div
              className={`h-full rounded-full transition-all ${progressBarClass}`}
              style={{ width: `${progressMeta.progress}%` }}
            />
          )}
        </div>
        <p className={`mt-3 text-[11px] leading-5 ${detailText ? detailClassName : 'text-slate-400'}`}>
          {detailText || progressMeta.statusText}
        </p>
      </div>
    );
  };
  const createEffectiveParamsSnapshot = (
    tabKey = activeTab,
    modelName = currentModelName,
    sourceParams = params,
  ) => {
    const snapshot = {
      generationCount: sourceParams.generationCount,
    };
    const isCurrentGrokImagineImageModel =
      GROK_IMAGINE_IMAGE_MODELS.has(modelName);
    const isCurrentGrokImageEditModel = GROK_IMAGE_EDIT_MODELS.has(modelName);
    const isCurrentAdobeImageModel = ADOBE_IMAGE_MODELS.has(modelName);
    const isCurrentAdobeVideoModel = ADOBE_VIDEO_MODELS.has(modelName);
    const isCurrentAdobeSoraModel =
      modelName === 'sora2' || modelName === 'sora2-pro';
    const isCurrentAdobeVeoModel =
      modelName === 'veo31' ||
      modelName === 'veo31-ref' ||
      modelName === 'veo31-fast';
    const isCurrentVideoModel =
      typeof modelName === 'string' && modelName.includes('video');
    const isCurrentGrokImagineVideoModel = modelName === 'grok-imagine-1.0-video';

    if (tabKey === 'image') {
      if (isCurrentGrokImagineImageModel && !isCurrentGrokImageEditModel) {
        snapshot.imageSize = normalizeGrokImageSize(sourceParams.imageSize);
      }

      if (isCurrentAdobeImageModel) {
        const adobeAspectRatioOptions = getAdobeImageAspectRatioOptions(modelName);
        const defaultAdobeAspectRatio =
          adobeAspectRatioOptions[0]?.value || '1:1';
        snapshot.aspectRatio = sourceParams.aspectRatio || defaultAdobeAspectRatio;
        if (
          supportsAdobeAutoImageSize(modelName) &&
          snapshot.aspectRatio === 'auto'
        ) {
          snapshot.autoImageSize = sourceParams.autoImageSize;
        }
        snapshot.outputResolution = sourceParams.outputResolution || '2K';
      }
    }

    if (tabKey === 'video') {
      if (isCurrentVideoModel && !isCurrentAdobeVideoModel) {
        snapshot.videoSize = sourceParams.videoSize;
        snapshot.videoSeconds = sourceParams.videoSeconds;
        snapshot.videoQuality = sourceParams.videoQuality;
        if (isCurrentGrokImagineVideoModel) {
          snapshot.videoPreset = sourceParams.videoPreset;
        }
      }

      if (isCurrentAdobeVideoModel) {
        snapshot.videoDuration =
          sourceParams.videoDuration || getAdobeVideoDefaultDuration(modelName);
        snapshot.aspectRatio =
          sourceParams.aspectRatio || getAdobeVideoDefaultAspectRatio(modelName);
        if (isCurrentAdobeVeoModel) {
          snapshot.videoResolution = sourceParams.videoResolution || '1080p';
        }
        if (modelName === 'veo31') {
          snapshot.referenceMode = sourceParams.referenceMode || 'frame';
        }
      }
    }

    return snapshot;
  };
  const formatImageRecordSummary = (record) => {
    const summary = [];
    const recordParams = record?.params || {};

    if (recordParams.aspectRatio && recordParams.aspectRatio !== 'auto') {
      summary.push(recordParams.aspectRatio);
    }
    if (recordParams.imageSize) {
      summary.push(getOptionLabel(GROK_IMAGE_SIZE_OPTIONS, recordParams.imageSize));
    }
    if (recordParams.outputResolution) {
      summary.push(recordParams.outputResolution);
    }
    if (Array.isArray(record?.images) && record.images.length > 0) {
      summary.push(
        `${record.images.filter((item) => item?.status === 'completed' && item?.url).length}张`,
      );
    }

    return summary.join(' · ');
  };

  const formatVideoRecordSummary = (record) => {
    const summary = [];
    const recordParams = record?.params || {};

    if (recordParams.videoDuration) {
      summary.push(`${recordParams.videoDuration}s`);
    } else if (recordParams.videoSeconds) {
      summary.push(`${recordParams.videoSeconds}s`);
    }

    if (recordParams.aspectRatio && recordParams.aspectRatio !== 'auto') {
      summary.push(recordParams.aspectRatio);
    } else if (recordParams.videoSize) {
      summary.push(getOptionLabel(GENERIC_VIDEO_SIZE_OPTIONS, recordParams.videoSize));
    }

    if (recordParams.videoResolution) {
      summary.push(recordParams.videoResolution);
    } else if (recordParams.videoQuality) {
      summary.push(recordParams.videoQuality);
    }

    if (Array.isArray(record?.tasks) && record.tasks.length > 0) {
      summary.push(
        `${record.tasks.filter((item) => item?.status !== 'failed').length}条`,
      );
    }

    return summary.join(' · ');
  };

const resolveCreativeAspectRatio = (ratio, fallback = '3 / 4') => {
  if (!ratio || ratio === 'auto' || typeof ratio !== 'string') {
    return fallback;
  }
    const normalized = ratio.trim();
    if (!normalized.includes(':')) {
      return fallback;
    }
    const [width, height] = normalized.split(':').map((item) => item.trim());
    if (!width || !height) {
      return fallback;
  }
  return `${width} / ${height}`;
};

const getCreativeVideoCardAspectRatio = (record) => {
  if (UNIFORM_CREATIVE_VIDEO_CARD_MODELS.has(record?.modelName || '')) {
    return '9 / 16';
  }
  return resolveCreativeAspectRatio(record?.params?.aspectRatio, '9 / 16');
};

const getCreativeVideoCardObjectFitClass = (record) =>
  UNIFORM_CREATIVE_VIDEO_CARD_MODELS.has(record?.modelName || '')
    ? 'object-contain'
    : 'object-cover';

  useEffect(() => {
    if (!currentDisplayModels.some((model) => model.id === activeModel)) {
      setActiveModel(currentDisplayModels[0]?.id || '');
    }
  }, [activeModel, currentDisplayModels]);

  useEffect(() => {
    if (!currentDisplayModels.some((model) => model.id === hoveredSidebarModelId)) {
      setHoveredSidebarModelId('');
    }
  }, [currentDisplayModels, hoveredSidebarModelId]);

  useEffect(() => {
    setIsSessionPanelOpen(false);
  }, [activeTab]);

  useEffect(() => {
    const savedModelName = activeHistorySnapshot?.model_name;
    if (!savedModelName || currentDisplayModels.length === 0) {
      return;
    }

    const matchedModel = currentDisplayModels.find(
      (model) =>
        model.value === savedModelName ||
        model.name === savedModelName,
    );
    if (matchedModel && matchedModel.id !== activeModel) {
      setActiveModel(matchedModel.id);
    }
  }, [activeHistorySnapshot, activeTab, currentDisplayModels]);

  useEffect(() => {
    const savedParams = activeHistorySnapshot?.payload?.params;
    if (savedParams && typeof savedParams === 'object') {
      setParams((prev) => ({
        ...prev,
        ...savedParams,
      }));
    }
  }, [activeHistorySnapshot, activeTab]);

  useEffect(() => {
    setParams((prev) => {
      const next = { ...prev };

      if (
        isGrokImagineImageModel &&
        !GROK_IMAGE_SIZE_OPTIONS.some((option) => option.value === next.imageSize)
      ) {
        next.imageSize = '1024x1024';
      }

      if (isAdobeImageModel) {
        const adobeAspectRatioOptions =
          getAdobeImageAspectRatioOptions(currentModelName);
        const defaultAdobeAspectRatio =
          adobeAspectRatioOptions[0]?.value || '1:1';
        if (
          !adobeAspectRatioOptions.some(
            (option) => option.value === next.aspectRatio,
          )
        ) {
          next.aspectRatio = defaultAdobeAspectRatio;
        }
        if (
          supportsAdobeAutoImageSize(currentModelName) &&
          !ADOBE_AUTO_IMAGE_SIZE_OPTIONS.some(
            (option) => option.value === next.autoImageSize,
          )
        ) {
          next.autoImageSize = '1024x1024';
        }
        if (
          !ADOBE_OUTPUT_RESOLUTION_OPTIONS.some(
            (option) => option.value === next.outputResolution,
          )
        ) {
          next.outputResolution = '2K';
        }
      }

      if (isVideoModel && !isAdobeVideoModel) {
        if (
          !GENERIC_VIDEO_SIZE_OPTIONS.some(
            (option) => option.value === next.videoSize,
          )
        ) {
          next.videoSize = '1280x720';
        }
        if (
          !currentVideoSecondsOptions.some(
            (option) => option.value === next.videoSeconds,
          )
        ) {
          next.videoSeconds = currentVideoSecondsOptions[0]?.value || '10';
        }
        if (
          !GENERIC_VIDEO_QUALITY_OPTIONS.some(
            (option) => option.value === next.videoQuality,
          )
        ) {
          next.videoQuality = '480p';
        }
        if (
          !GROK_VIDEO_PRESET_OPTIONS.some(
            (option) => option.value === next.videoPreset,
          )
        ) {
          next.videoPreset = 'normal';
        }
      }

      if (isAdobeVideoModel) {
        const durationOptions = getAdobeVideoDurationOptions(currentModelName);
        const aspectRatioOptions = getAdobeVideoAspectRatioOptions(currentModelName);
        if (
          !durationOptions.some((option) => option.value === next.videoDuration)
        ) {
          next.videoDuration = getAdobeVideoDefaultDuration(currentModelName);
        }
        if (
          !aspectRatioOptions.some((option) => option.value === next.aspectRatio)
        ) {
          next.aspectRatio = getAdobeVideoDefaultAspectRatio(currentModelName);
        }
        if (
          isAdobeVeoModel &&
          !ADOBE_VIDEO_RESOLUTION_OPTIONS.some(
            (option) => option.value === next.videoResolution,
          )
        ) {
          next.videoResolution = '1080p';
        }
        if (
          currentModelName === 'veo31' &&
          !ADOBE_REFERENCE_MODE_OPTIONS.some(
            (option) => option.value === next.referenceMode,
          )
        ) {
          next.referenceMode = 'frame';
        }
      }

      return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
    });
  }, [
    currentModelName,
    isAdobeImageModel,
    isAdobeVeoModel,
    isAdobeVideoModel,
    isGrokImagineImageModel,
    isVideoModel,
  ]);

  const createCreativeInputs = (
    baseParams = params,
    modelName = currentModelName,
    tabKey = activeTab,
  ) => {
    const effectiveParams = createEffectiveParamsSnapshot(
      tabKey,
      modelName,
      baseParams,
    );

    return {
      model: modelName,
      group: activeGroup,
      stream: false,
      imageSize: effectiveParams.imageSize,
      aspectRatio: effectiveParams.aspectRatio,
      autoImageSize: effectiveParams.autoImageSize,
      outputResolution: effectiveParams.outputResolution,
      videoSize: effectiveParams.videoSize,
      videoSeconds: effectiveParams.videoSeconds,
      videoQuality: effectiveParams.videoQuality,
      videoPreset: effectiveParams.videoPreset,
      videoDuration: effectiveParams.videoDuration,
      videoResolution: effectiveParams.videoResolution,
      referenceMode: effectiveParams.referenceMode,
    };
  };

  const applyCreativeSessionToView = (tabKey, sessionSnapshot) => {
    clearUploadedImages();
    setUploadImageNotice('');
    setPrompt('');

    if (tabKey === 'chat') {
      setChatMessages(
        Array.isArray(sessionSnapshot?.payload?.messages)
          ? sessionSnapshot.payload.messages
          : [],
      );
      return;
    }

    if (tabKey === 'image') {
      const nextImageRecords = normalizeImageHistoryRecords(sessionSnapshot);
      setImageRecords(nextImageRecords);
      setCollapsedImageRecordIds(
        Object.fromEntries(nextImageRecords.map((record) => [record.id, true])),
      );
      setSelectedImageTaskIds({});
      lastPersistedImageSignatureRef.current = buildCreativePersistSignature(
        nextImageRecords,
        'image',
      );
      return;
    }

    const nextVideoRecords = normalizeVideoHistoryRecords(sessionSnapshot);
    setVideoRecords(nextVideoRecords);
    setCollapsedVideoRecordIds(
      Object.fromEntries(nextVideoRecords.map((record) => [record.id, true])),
    );
    setSelectedVideoTaskIds({});
    lastPersistedVideoSignatureRef.current = buildCreativePersistSignature(
      nextVideoRecords,
      'video',
    );
  };

  const commitCreativeHistorySnapshot = (tabKey, nextSnapshot, options = {}) => {
    const normalizedSnapshot = normalizeCreativeHistorySnapshot(tabKey, nextSnapshot);
    const activeSession = getCreativeCurrentSessionSnapshot(
      normalizedSnapshot,
      tabKey,
    );

    setHistorySnapshots((prev) => ({
      ...prev,
      [tabKey]: normalizedSnapshot,
    }));

    if (options.applySessionState) {
      applyCreativeSessionToView(tabKey, activeSession);
    }

    return {
      normalizedSnapshot,
      activeSession,
    };
  };

  const persistCreativeHistorySnapshot = async (tabKey, nextSnapshot, options = {}) => {
    const { normalizedSnapshot, activeSession } = commitCreativeHistorySnapshot(
      tabKey,
      nextSnapshot,
      options,
    );

    if (!isLoggedIn) {
      return normalizedSnapshot;
    }

    if (Date.now() < creativeHistoryPersistBlockedUntilRef.current) {
      return normalizedSnapshot;
    }

    try {
      const persistedPayload = buildPersistableCreativeSessionPayload(
        tabKey,
        normalizedSnapshot.payload,
      );
      await API.put(
        API_ENDPOINTS.CREATIVE_CENTER_HISTORY,
        {
          tab: tabKey,
          model_name: activeSession?.model_name || '',
          group: activeSession?.group || '',
          prompt: activeSession?.prompt || '',
          payload: persistedPayload,
        },
        {
          headers: {
            'New-API-User': getUserIdFromLocalStorage(),
          },
          skipErrorHandler: true,
        },
      );
    } catch (error) {
      if (error?.response?.status === 429) {
        creativeHistoryPersistBlockedUntilRef.current =
          Date.now() + CREATIVE_CENTER_HISTORY_PERSIST_429_BACKOFF_MS;
      }
      console.error('Failed to save creative center history:', error);
      notifyCreativeHistoryPersistFailure(tabKey);
    }

    return normalizedSnapshot;
  };

  const buildNextSessionName = (tabKey, sessions) => {
    const existingNames = new Set(
      (sessions || []).map((session) => String(session?.name || '').trim()).filter(Boolean),
    );
    let nextIndex = (sessions || []).length + 1;
    let nextName = getDefaultCreativeSessionName(tabKey, nextIndex);

    while (existingNames.has(nextName)) {
      nextIndex += 1;
      nextName = getDefaultCreativeSessionName(tabKey, nextIndex);
    }

    return nextName;
  };

  const createNextBlankSessionSnapshot = (tabKey, baseSnapshot = null) => {
    const normalizedBaseSnapshot = normalizeCreativeHistorySnapshot(
      tabKey,
      baseSnapshot || historySnapshots[tabKey],
    );
    return createCreativeSessionSnapshot(tabKey, {
      name: buildNextSessionName(
        tabKey,
        normalizedBaseSnapshot?.payload?.sessions || [],
      ),
      model_name: currentModelName,
      group: activeGroup,
      payload: getEmptyCreativeSessionPayload(tabKey),
    });
  };

  const openCreativeSession = async (tabKey, sessionId) => {
    const baseSnapshot = normalizeCreativeHistorySnapshot(
      tabKey,
      historySnapshots[tabKey],
    );
    if (!baseSnapshot.payload.sessions.some((session) => session.id === sessionId)) {
      return;
    }

    const nextSnapshot = {
      ...baseSnapshot,
      payload: {
        ...baseSnapshot.payload,
        current_session_id: sessionId,
      },
      updated_at: Date.now(),
    };

    await persistCreativeHistorySnapshot(tabKey, nextSnapshot, {
      applySessionState: true,
    });
    setIsSessionPanelOpen(false);
  };

  const createCreativeSession = async (tabKey) => {
    const baseSnapshot = normalizeCreativeHistorySnapshot(
      tabKey,
      historySnapshots[tabKey],
    );
    const newSession = createNextBlankSessionSnapshot(tabKey, baseSnapshot);
    const nextSnapshot = {
      ...baseSnapshot,
      model_name: newSession.model_name,
      group: newSession.group,
      prompt: '',
      updated_at: newSession.updated_at,
      payload: {
        current_session_id: newSession.id,
        sessions: [...baseSnapshot.payload.sessions, newSession],
      },
    };

    await persistCreativeHistorySnapshot(tabKey, nextSnapshot, {
      applySessionState: true,
    });
    setIsSessionPanelOpen(false);
  };

  const renameCreativeSession = async (tabKey, sessionId) => {
    const baseSnapshot = normalizeCreativeHistorySnapshot(
      tabKey,
      historySnapshots[tabKey],
    );
    const targetSession = baseSnapshot.payload.sessions.find(
      (session) => session.id === sessionId,
    );
    if (!targetSession) {
      return;
    }

    const nextName = window.prompt('重命名会话', targetSession.name || '');
    if (nextName === null) {
      return;
    }

    const trimmedName = nextName.trim();
    if (!trimmedName) {
      showWarning('会话名称不能为空');
      return;
    }

    const nextSnapshot = {
      ...baseSnapshot,
      updated_at: Date.now(),
      payload: {
        ...baseSnapshot.payload,
        sessions: baseSnapshot.payload.sessions.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                name: trimmedName,
                updated_at: Date.now(),
              }
            : session,
        ),
      },
    };

    await persistCreativeHistorySnapshot(tabKey, nextSnapshot);
  };

  const deleteCreativeSession = async (
    tabKey,
    sessionId,
    options = { createFallback: true },
  ) => {
    const baseSnapshot = normalizeCreativeHistorySnapshot(
      tabKey,
      historySnapshots[tabKey],
    );
    const targetSession = baseSnapshot.payload.sessions.find(
      (session) => session.id === sessionId,
    );
    if (!targetSession) {
      return;
    }

    const shouldDelete = window.confirm(
      `确认删除“${targetSession.name || '当前会话'}”吗？只删除会话，图片视频资源仍保留。`,
    );
    if (!shouldDelete) {
      return;
    }

    let nextSessions = baseSnapshot.payload.sessions.filter(
      (session) => session.id !== sessionId,
    );
    if (nextSessions.length === 0 && options.createFallback !== false) {
      nextSessions = [createNextBlankSessionSnapshot(tabKey, baseSnapshot)];
    }

    const nextCurrentSessionId =
      baseSnapshot.payload.current_session_id === sessionId
        ? nextSessions[0]?.id || ''
        : baseSnapshot.payload.current_session_id;

    const nextSnapshot = {
      ...baseSnapshot,
      updated_at: Date.now(),
      payload: {
        current_session_id: nextCurrentSessionId,
        sessions: nextSessions,
      },
    };

    await persistCreativeHistorySnapshot(tabKey, nextSnapshot, {
      applySessionState: baseSnapshot.payload.current_session_id === sessionId,
    });
    setIsSessionPanelOpen(false);
  };

  const updateCurrentCreativeSessionSnapshot = (tabKey, sessionPatch) => {
    const baseSnapshot = normalizeCreativeHistorySnapshot(
      tabKey,
      historySnapshots[tabKey],
    );
    const currentSessionId = baseSnapshot.payload.current_session_id;
    const nextSessions = baseSnapshot.payload.sessions.map((session) =>
      session.id === currentSessionId
        ? {
            ...session,
            ...sessionPatch,
            payload: buildCreativeSessionPayload(
              tabKey,
              sessionPatch?.payload ?? session.payload,
            ),
            updated_at: sessionPatch?.updated_at || Date.now(),
          }
        : session,
    );

    return {
      ...baseSnapshot,
      model_name: sessionPatch?.model_name ?? baseSnapshot.model_name,
      group: sessionPatch?.group ?? baseSnapshot.group,
      prompt: sessionPatch?.prompt ?? baseSnapshot.prompt,
      updated_at: sessionPatch?.updated_at || Date.now(),
      payload: {
        ...baseSnapshot.payload,
        sessions: nextSessions,
      },
    };
  };

  const saveCreativeHistory = async (
    tabKey,
    payload,
    options = {},
  ) => {
    if (!isLoggedIn) {
      return;
    }

    const requestBody = {
      tab: tabKey,
      model_name: options.modelName || currentModelName,
      group: options.group ?? activeGroup,
      prompt: options.prompt ?? '',
      payload: buildPersistableCreativeSessionPayload(tabKey, payload),
    };

    if (Date.now() < creativeHistoryPersistBlockedUntilRef.current) {
      return;
    }

    try {
      await API.put(API_ENDPOINTS.CREATIVE_CENTER_HISTORY, requestBody, {
        headers: {
          'New-API-User': getUserIdFromLocalStorage(),
        },
        skipErrorHandler: true,
      });

      const nextSnapshot = normalizeCreativeHistorySnapshot(tabKey, {
        ...(historySnapshots[tabKey] || {}),
        tab: tabKey,
        model_name: requestBody.model_name,
        group: requestBody.group,
        prompt: requestBody.prompt,
        payload,
      });
      setHistorySnapshots((prev) => ({
        ...prev,
        [tabKey]: nextSnapshot,
      }));
    } catch (error) {
      if (error?.response?.status === 429) {
        creativeHistoryPersistBlockedUntilRef.current =
          Date.now() + CREATIVE_CENTER_HISTORY_PERSIST_429_BACKOFF_MS;
      }
      console.error('Failed to save creative center history:', error);
      notifyCreativeHistoryPersistFailure(tabKey);
    }
  };

  const deleteCreativeHistory = async (tabKey) => {
    if (!isLoggedIn) {
      return;
    }

    try {
      await API.delete(`${API_ENDPOINTS.CREATIVE_CENTER_HISTORY}/${tabKey}`, {
        headers: {
          'New-API-User': getUserIdFromLocalStorage(),
        },
      });

      setHistorySnapshots((prev) => ({
        ...prev,
        [tabKey]: normalizeCreativeHistorySnapshot(tabKey, null),
      }));
    } catch (error) {
      console.error('Failed to delete creative center history:', error);
    }
  };

  const createBasePayload = (
    currentPrompt,
    baseParams = params,
    modelName = currentModelName,
    tabKey = activeTab,
    imageUrls = [],
  ) => {
    return buildApiPayload(
      [
        {
          role: 'user',
          content: buildMessageContent(currentPrompt, imageUrls, imageUrls.length > 0),
        },
      ],
      '',
      createCreativeInputs(baseParams, modelName, tabKey),
      PARAMETER_TOGGLES_DISABLED,
    );
  };

  const postCreativeRequest = async (endpoint, payload, requestHeaders = {}) => {
    const response = await API.post(endpoint, payload, {
      headers: {
        'New-API-User': getUserIdFromLocalStorage(),
        ...requestHeaders,
      },
    });
    return response.data;
  };

  const buildCreativeTaskStatusRequestConfig = (config = {}) => ({
    ...config,
    skipErrorHandler: true,
    disableStaleCache: true,
    disableDuplicate: true,
    headers: {
      'New-API-User': getUserIdFromLocalStorage(),
      ...(config.headers || {}),
    },
  });

  const postCreativeChatStreamRequest = (payload) =>
    new Promise((resolve, reject) => {
      const source = new SSE(API_ENDPOINTS.CHAT_COMPLETIONS, {
        headers: {
          'Content-Type': 'application/json',
          'New-API-User': getUserIdFromLocalStorage(),
        },
        method: 'POST',
        payload: JSON.stringify({
          ...payload,
          stream: true,
        }),
      });

      let settled = false;
      const contentFragments = [];
      const reasoningFragments = [];
      const rawFragments = [];
      const cleanup = () => {
        try {
          source.close();
        } catch {
          // ignore close errors from already-closed SSE connections
        }
      };
      const finish = () => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        resolve({
          content: contentFragments.join('').trim(),
          reasoningContent: reasoningFragments.join('').trim(),
          rawResponsePreview: formatCreativeCenterRawResponsePreview(
            rawFragments.join('\n'),
          ),
        });
      };
      const fail = (error) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        reject(error);
      };

      source.addEventListener('message', (event) => {
        if (event.data === '[DONE]') {
          finish();
          return;
        }

        rawFragments.push(event.data);
        try {
          const chunk = JSON.parse(event.data);
          const chunkResponse = extractCreativeCenterChatResponse(chunk);
          if (chunkResponse.reasoningContent) {
            reasoningFragments.push(chunkResponse.reasoningContent);
          }
          if (chunkResponse.content) {
            contentFragments.push(chunkResponse.content);
          }
        } catch (error) {
          fail(error);
        }
      });

      source.addEventListener('error', (event) => {
        fail(new Error(event?.data || 'SSE request failed'));
      });

      try {
        source.stream();
      } catch (error) {
        fail(error);
      }
    });

  const persistImageRecords = async (records, options = {}) => {
    lastPersistedImageSignatureRef.current = buildCreativePersistSignature(records, 'image');
    const nextSnapshot = updateCurrentCreativeSessionSnapshot('image', {
      model_name:
        options.modelName || records[records.length - 1]?.modelName || currentModelName,
      group: options.group ?? activeGroup,
      prompt: options.prompt || records[records.length - 1]?.prompt || '',
      payload: {
        entries: records,
        params: options.params || records[records.length - 1]?.params || params,
      },
      updated_at: Date.now(),
    });
    await persistCreativeHistorySnapshot('image', nextSnapshot);
  };

  const persistVideoRecords = async (records, options = {}) => {
    lastPersistedVideoSignatureRef.current = buildCreativePersistSignature(records, 'video');
    const nextSnapshot = updateCurrentCreativeSessionSnapshot('video', {
      model_name:
        options.modelName || records[records.length - 1]?.modelName || currentModelName,
      group: options.group ?? activeGroup,
      prompt: options.prompt || records[records.length - 1]?.prompt || '',
      payload: {
        entries: records,
        params: options.params || records[records.length - 1]?.params || params,
      },
      updated_at: Date.now(),
    });
    await persistCreativeHistorySnapshot('video', nextSnapshot);
  };

  const buildImageDownloadFilename = (record, recordIndex, imageIndex) =>
    `${record.modelName || 'creative-image'}-${recordIndex + 1}-${imageIndex + 1}.png`;

  const getCompletedImageItems = (record) =>
    Array.isArray(record?.images) ? record.images.filter((item) => Boolean(item?.url)) : [];

  const getSelectedImageItems = (record) => {
    const selectedIds = new Set(selectedImageTaskIds[record.id] || []);
    return Array.isArray(record?.images)
      ? record.images.filter((item) => item?.url && selectedIds.has(item.id))
      : [];
  };

  const toggleImageTaskSelection = (recordId, imageId) => {
    setSelectedImageTaskIds((prev) => {
      const current = new Set(prev[recordId] || []);
      if (current.has(imageId)) {
        current.delete(imageId);
      } else {
        current.add(imageId);
      }

      if (current.size === 0) {
        const next = { ...prev };
        delete next[recordId];
        return next;
      }

      return {
        ...prev,
        [recordId]: Array.from(current),
      };
    });
  };

  const clearImageTaskSelection = (recordId) => {
    setSelectedImageTaskIds((prev) => {
      if (!prev[recordId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[recordId];
      return next;
    });
  };

  const selectAllCompletedImageTasks = (record) => {
    const completedItems = getCompletedImageItems(record);
    if (completedItems.length === 0) {
      return;
    }

    setSelectedImageTaskIds((prev) => ({
      ...prev,
      [record.id]: completedItems.map((item) => item.id),
    }));
  };

  const downloadImageItems = (record, recordIndex, imageItems) => {
    imageItems.forEach((item, selectionIndex) => {
      const originalIndex = record.images.findIndex((candidate) => candidate.id === item.id);
      window.setTimeout(() => {
        triggerDownload(
          item.url,
          buildImageDownloadFilename(
            record,
            recordIndex,
            originalIndex >= 0 ? originalIndex : selectionIndex,
          ),
        );
      }, selectionIndex * 120);
    });
  };

  const buildVideoDownloadFilename = (record, recordIndex, taskIndex) =>
    `${record.modelName || 'creative-video'}-${recordIndex + 1}-${taskIndex + 1}.mp4`;

  const getCompletedVideoTasks = (record) =>
    Array.isArray(record?.tasks)
      ? record.tasks.filter((item) => Boolean(getVideoTaskMediaUrl(item)))
      : [];

  const getSelectedVideoTasks = (record) => {
    const selectedIds = new Set(selectedVideoTaskIds[record.id] || []);
    return Array.isArray(record?.tasks)
      ? record.tasks.filter(
          (item) => getVideoTaskMediaUrl(item) && selectedIds.has(item.id),
        )
      : [];
  };

  const toggleVideoTaskSelection = (recordId, taskId) => {
    setSelectedVideoTaskIds((prev) => {
      const current = new Set(prev[recordId] || []);
      if (current.has(taskId)) {
        current.delete(taskId);
      } else {
        current.add(taskId);
      }

      if (current.size === 0) {
        const next = { ...prev };
        delete next[recordId];
        return next;
      }

      return {
        ...prev,
        [recordId]: Array.from(current),
      };
    });
  };

  const clearVideoTaskSelection = (recordId) => {
    setSelectedVideoTaskIds((prev) => {
      if (!prev[recordId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[recordId];
      return next;
    });
  };

  const selectAllCompletedVideoTasks = (record) => {
    const completedTasks = getCompletedVideoTasks(record);
    if (completedTasks.length === 0) {
      return;
    }

    setSelectedVideoTaskIds((prev) => ({
      ...prev,
      [record.id]: completedTasks.map((item) => item.id),
    }));
  };

  const downloadVideoTasks = (record, recordIndex, tasks) => {
    tasks.forEach((task, selectionIndex) => {
      const originalIndex = record.tasks.findIndex((candidate) => candidate.id === task.id);
      window.setTimeout(() => {
        triggerDownload(
          getVideoTaskMediaUrl(task),
          buildVideoDownloadFilename(
            record,
            recordIndex,
            originalIndex >= 0 ? originalIndex : selectionIndex,
          ),
        );
      }, selectionIndex * 120);
    });
  };

  const patchImageTask = (recordId, taskId, taskPatch) => {
    const { nextRecords, hasChanged } = applyImageTaskPatchToRecords(
      imageRecordsRef.current,
      recordId,
      taskId,
      taskPatch,
    );

    if (!hasChanged) {
      return;
    }

    syncImageRecordsState(nextRecords);
  };

  const patchVideoTask = (recordId, taskId, taskPatch) => {
    const { nextRecords, hasChanged } = applyVideoTaskPatchToRecords(
      videoRecordsRef.current,
      recordId,
      taskId,
      taskPatch,
    );

    if (!hasChanged) {
      return;
    }

    syncVideoRecordsState(nextRecords);
  };

  const fetchCreativeVideoTasksByIdentifiers = async (candidates) => {
    const safeCandidates = Array.isArray(candidates) ? candidates : [];
    const requestIds = [...new Set(
      safeCandidates
        .map((candidate) => String(candidate?.requestId || '').trim())
        .filter(Boolean),
    )];
    const taskIds = [...new Set(
      safeCandidates
        .map((candidate) => String(candidate?.queryTaskId || candidate?.taskId || '').trim())
        .filter((value) => value.startsWith('task_')),
    )];

    if (requestIds.length === 0 && taskIds.length === 0) {
      return [];
    }

    const candidateTimes = safeCandidates
      .map((candidate) =>
        normalizeCreativeTimestampToSeconds(
          candidate?.sortTimestamp ||
            candidate?.recordUpdatedAt ||
            candidate?.recordCreatedAt,
        ),
      )
      .filter((value) => value > 0);
    const baseStartTimestamp =
      candidateTimes.length > 0 ? Math.min(...candidateTimes) : 0;
    const baseEndTimestamp =
      candidateTimes.length > 0 ? Math.max(...candidateTimes) : baseStartTimestamp;
    const startTimestamp = Math.max(0, baseStartTimestamp - 120);
    const endTimestamp = Math.max(startTimestamp + 1, baseEndTimestamp + 1800);

    const response = await API.post('/api/task/self/resolve', {
      task_ids: taskIds,
      request_ids: requestIds,
      media_type: 'video',
      start_timestamp: startTimestamp,
      end_timestamp: endTimestamp,
      limit: Math.max(300, safeCandidates.length * 20),
    }, {
      skipErrorHandler: true,
      headers: {
        'New-API-User': getUserIdFromLocalStorage(),
      },
    });

    const items = Array.isArray(response?.data?.data?.items)
      ? response.data.data.items
      : [];
    const requestIdSet = new Set(requestIds);
    const taskIdSet = new Set(taskIds);
    return items.filter((item) => {
      const requestId = getTaskDtoRequestId(item);
      const taskId = String(item?.task_id || item?.taskId || '').trim();
      return requestIdSet.has(requestId) || taskIdSet.has(taskId);
    });
  };

  const fetchCreativeVideoTasksAroundCandidates = async (candidates) => {
    const safeCandidates = Array.isArray(candidates) ? candidates : [];
    const candidateTimes = safeCandidates
      .map((candidate) =>
        normalizeCreativeTimestampToSeconds(
          candidate?.sortTimestamp ||
            candidate?.recordUpdatedAt ||
            candidate?.recordCreatedAt,
        ),
      )
      .filter((value) => value > 0);

    if (candidateTimes.length === 0) {
      return [];
    }

    const baseStartTimestamp = Math.min(...candidateTimes);
    const baseEndTimestamp = Math.max(...candidateTimes);
    const startTimestamp = Math.max(0, baseStartTimestamp - 120);
    const endTimestamp = Math.max(startTimestamp + 1, baseEndTimestamp + 1800);

    const response = await API.get(
      '/api/task/self',
      buildCreativeTaskStatusRequestConfig({
        params: {
          p: 1,
          page_size: Math.max(100, Math.min(300, safeCandidates.length * 20)),
          media_type: 'video',
          start_timestamp: startTimestamp,
          end_timestamp: endTimestamp,
        },
      }),
    );

    const items = Array.isArray(response?.data?.data?.items)
      ? response.data.data.items
      : [];
    return items.filter((item) =>
      CREATIVE_CENTER_VIDEO_TASK_ACTIONS.has(String(item?.action || '').trim()),
    );
  };

  const getCreativeVideoTaskDtoId = (task) =>
    String(task?.task_id || task?.taskId || '').trim();

  const getCreativeVideoCandidateKey = (candidate) =>
    String(candidate?.taskId || candidate?.localTaskId || '').trim();

  const getCreativeVideoTaskMatchKey = (task) => {
    const taskId = getCreativeVideoTaskDtoId(task);
    if (taskId) {
      return `task:${taskId}`;
    }

    const requestId = getTaskDtoRequestId(task);
    if (requestId) {
      return `request:${requestId}`;
    }

    const resultUrl = normalizeVideoMediaUrl(getTaskDtoResultUrl(task));
    if (resultUrl) {
      return `url:${resultUrl}`;
    }

    const id = String(task?.id || '').trim();
    return id ? `id:${id}` : '';
  };

  const mergeCreativeTaskDtoLists = (...lists) => {
    const taskByKey = new Map();
    const anonymousTasks = [];

    lists.flat().forEach((task) => {
      if (!task) {
        return;
      }
      const matchKey = getCreativeVideoTaskMatchKey(task);
      if (matchKey) {
        taskByKey.set(matchKey, task);
        return;
      }
      anonymousTasks.push(task);
    });

    return [...taskByKey.values(), ...anonymousTasks];
  };

  const matchCreativeVideoTasksToCandidates = (candidates, tasks) => {
    const safeCandidates = Array.isArray(candidates) ? candidates : [];
    const videoTasks = (Array.isArray(tasks) ? tasks : [])
      .filter((task) =>
        CREATIVE_CENTER_VIDEO_TASK_ACTIONS.has(String(task?.action || '').trim()),
      )
      .sort(
        (left, right) =>
          normalizeCreativeTimestampToSeconds(left?.submit_time || left?.submitTime) -
          normalizeCreativeTimestampToSeconds(right?.submit_time || right?.submitTime),
      );
    const matches = new Map();
    const usedTaskKeys = new Set();

    const isTaskAlreadyUsed = (task) => {
      const taskKey = getCreativeVideoTaskMatchKey(task);
      return Boolean(taskKey && usedTaskKeys.has(taskKey));
    };

    const rememberMatch = (candidate, task) => {
      const candidateKey = getCreativeVideoCandidateKey(candidate);
      if (!candidateKey || !task || isTaskAlreadyUsed(task)) {
        return;
      }
      matches.set(candidateKey, task);
      const taskKey = getCreativeVideoTaskMatchKey(task);
      if (taskKey) {
        usedTaskKeys.add(taskKey);
      }
    };

    safeCandidates.forEach((candidate) => {
      const queryTaskId = String(candidate?.queryTaskId || '').trim();
      if (!queryTaskId) {
        return;
      }
      const matchedTask = videoTasks.find(
        (task) =>
          !isTaskAlreadyUsed(task) &&
          getCreativeVideoTaskDtoId(task) === queryTaskId,
      );
      if (matchedTask) {
        rememberMatch(candidate, matchedTask);
      }
    });

    safeCandidates.forEach((candidate) => {
      if (matches.has(getCreativeVideoCandidateKey(candidate))) {
        return;
      }
      const requestId = String(candidate?.requestId || '').trim();
      if (!requestId) {
        return;
      }
      const matchedTask = videoTasks.find(
        (task) =>
          !isTaskAlreadyUsed(task) &&
          getTaskDtoRequestId(task) === requestId,
      );
      if (matchedTask) {
        rememberMatch(candidate, matchedTask);
      }
    });

    const groupedCandidates = Array.from(
      safeCandidates.reduce((map, candidate) => {
        if (matches.has(getCreativeVideoCandidateKey(candidate))) {
          return map;
        }
        if (String(candidate?.queryTaskId || '').trim()) {
          return map;
        }
        const key = candidate.recordId || 'default';
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key).push(candidate);
        return map;
      }, new Map()),
    );

    groupedCandidates.forEach(([, group]) => {
      const recordModelName = String(
        group[0]?.recordModelName || group[0]?.modelName || '',
      )
        .trim()
        .toLowerCase();
      const recordTimes = group
        .map((candidate) =>
          normalizeCreativeTimestampToSeconds(
            candidate.sortTimestamp ||
              candidate.recordUpdatedAt ||
              candidate.recordCreatedAt,
          ),
        )
        .filter((value) => value > 0);
      const recordStart = recordTimes.length > 0 ? Math.min(...recordTimes) - 120 : 0;
      const recordEnd = recordTimes.length > 0 ? Math.max(...recordTimes) + 1800 : 0;

      const matchedTasks = videoTasks.filter((task) => {
        if (isTaskAlreadyUsed(task)) {
          return false;
        }
        const taskModelName = getTaskDtoModelName(task).toLowerCase();
        if (recordModelName && taskModelName && taskModelName !== recordModelName) {
          return false;
        }
        const submitTime = normalizeCreativeTimestampToSeconds(
          task?.submit_time || task?.submitTime,
        );
        if (recordStart > 0 && submitTime > 0 && submitTime < recordStart) {
          return false;
        }
        if (recordEnd > 0 && submitTime > 0 && submitTime > recordEnd) {
          return false;
        }
        return true;
      });

      [...group]
        .sort((left, right) => (left.sortTimestamp || 0) - (right.sortTimestamp || 0))
        .forEach((candidate, index) => {
          const matchedTask = matchedTasks[index];
          if (matchedTask) {
            rememberMatch(candidate, matchedTask);
          }
        });
    });

    return matches;
  };

  const parseVideoFetchPayload = (rawResponse) => {
    const rootPayload = rawResponse?.data;
    const dataPayload =
      rootPayload && typeof rootPayload === 'object' && rootPayload.data && typeof rootPayload.data === 'object'
        ? rootPayload.data
        : rootPayload;

    if (!dataPayload || typeof dataPayload !== 'object') {
      return {
        status: 'submitted',
        progress: null,
        url: '',
        content: '',
        error: '',
      };
    }

    const status = normalizeVideoTaskStatus(
      dataPayload.status ||
        dataPayload.task_status ||
        dataPayload.state ||
        rootPayload?.status,
    );
    const progress =
      parseProgressValue(dataPayload.progress) ??
      parseProgressValue(rootPayload?.progress);
    const rawUrl =
      dataPayload.url ||
      dataPayload.presignedUrl ||
      dataPayload.presigned_url ||
      dataPayload.result_url ||
      dataPayload.resultUrl ||
      dataPayload.video_url ||
      dataPayload.output_url ||
      dataPayload?.data?.[0]?.url ||
      dataPayload?.data?.[0]?.video_url ||
      dataPayload?.metadata?.url ||
      dataPayload?.metadata?.remote_url ||
      rootPayload?.url ||
      rootPayload?.presignedUrl ||
      rootPayload?.presigned_url ||
      rootPayload?.result_url ||
      rootPayload?.resultUrl ||
      rootPayload?.video_url ||
      rootPayload?.output_url ||
      rootPayload?.data?.[0]?.url ||
      rootPayload?.data?.[0]?.video_url ||
      rootPayload?.metadata?.url ||
      rootPayload?.metadata?.remote_url ||
      '';
    const url = normalizeVideoMediaUrl(rawUrl);
    const content =
      dataPayload.content ||
      dataPayload.message ||
      rootPayload?.message ||
      '';
    const error =
      dataPayload.error?.message ||
      dataPayload.fail_reason ||
      rootPayload?.error?.message ||
      '';
    const completedWithoutVideo = status === 'completed' && !url;

    return {
      status: completedWithoutVideo ? 'failed' : status,
      progress,
      url,
      content,
      error: completedWithoutVideo ? error || 'video generation failed' : error,
    };
  };

  const getMessageText = (content) => {
    if (typeof content === 'string') {
      return content;
    }

    if (!Array.isArray(content)) {
      return '';
    }

    return content
      .filter((item) => item?.type === 'text')
      .map((item) => item?.text || '')
      .filter(Boolean)
      .join('\n');
  };

  const getMessageImages = (content) => {
    if (!Array.isArray(content)) {
      return [];
    }

    return content
      .filter((item) => item?.type === 'image_url')
      .map((item) =>
        typeof item?.image_url === 'string'
          ? item.image_url
          : item?.image_url?.url || '',
      )
      .filter(Boolean);
  };

  const removeUploadedImage = (imageId) => {
    setUploadedImages((prev) => {
      const target = prev.find((item) => item.id === imageId);
      if (target) {
        revokeCreativeCenterPreviewURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== imageId);
    });
  };

  const clearUploadedImages = () => {
    setUploadedImages((prev) => {
      prev.forEach((item) => {
        revokeCreativeCenterPreviewURL(item.previewUrl);
      });
      return [];
    });
    setUploadImageNotice('');
  };

  const handleUploadButtonClick = () => {
    if (!isCurrentModelImageUploadEnabled) {
      setUploadImageNotice('当前模型不支持上传图片');
      showWarning('当前模型不支持上传图片');
      return;
    }
    fileInputRef.current?.click();
  };

  const getCreativeCenterImageUploadConfig = async () => {
    if (creativeCenterUploadConfigRef.current) {
      return creativeCenterUploadConfigRef.current;
    }

    try {
      const response = await API.get(
        API_ENDPOINTS.CREATIVE_CENTER_IMAGE_UPLOAD_CONFIG,
        {
          skipErrorHandler: true,
          headers: {
            'New-API-User': getUserIdFromLocalStorage(),
          },
        },
      );

      const { success, data, message } = response?.data || {};
      if (!success) {
        throw new Error(message || '获取图片上传配置失败');
      }

      const nextConfig =
        data?.mode === 'direct' && data?.upload_url && data?.api_key
          ? data
          : { mode: 'backend' };
      creativeCenterUploadConfigRef.current = nextConfig;
      return nextConfig;
    } catch (error) {
      creativeCenterUploadConfigRef.current = { mode: 'backend' };
      return creativeCenterUploadConfigRef.current;
    }
  };

  const uploadCreativeCenterImageViaBackend = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await API.post(
      API_ENDPOINTS.CREATIVE_CENTER_IMAGE_UPLOAD,
      formData,
      {
        skipErrorHandler: true,
        headers: {
          'Content-Type': 'multipart/form-data',
          'New-API-User': getUserIdFromLocalStorage(),
        },
      },
    );

    const { success, data, message } = response?.data || {};
    if (!success || !data?.url) {
      throw new Error(message || '图片上传失败，请稍后重试');
    }

    return data;
  };

  const uploadCreativeCenterImageDirectly = async (file, uploadConfig) => {
    const requestUrl = buildCreativeCenterImageBedUploadUrl(
      uploadConfig?.upload_url,
      uploadConfig?.return_type,
      uploadConfig?.auto_retry !== false,
    );
    if (!requestUrl) {
      throw new Error('图床配置无效，请检查系统设置');
    }

    const formData = new FormData();
    formData.append('file', file);

    let response;
    try {
      response = await window.fetch(requestUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${uploadConfig.api_key}`,
        },
        body: formData,
        cache: 'no-store',
      });
    } catch (error) {
      throw new Error('浏览器直连图床失败，请检查图床 CORS 配置或网络状态');
    }

    const responseText = await response.text();
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        creativeCenterUploadConfigRef.current = null;
      }
      throw new Error(
        `图床上传失败，状态码 ${response.status}${
          responseText.trim() ? `：${responseText.trim()}` : ''
        }`,
      );
    }

    let payload = null;
    if (responseText.trim()) {
      try {
        payload = JSON.parse(responseText);
      } catch (error) {
        throw new Error('图床上传成功，但返回内容不是有效 JSON');
      }
    }

    const imageUrl = parseCreativeCenterDirectUploadImageUrl(
      uploadConfig.upload_url,
      payload,
    );
    if (!imageUrl) {
      throw new Error('图床上传成功但未返回可用图片链接');
    }

    return {
      url: imageUrl,
      name: file.name,
      filename: getCreativeCenterFilenameFromUrl(imageUrl),
      size: file.size,
    };
  };

  const uploadCreativeCenterImage = async (file) => {
    const uploadConfig = await getCreativeCenterImageUploadConfig();
    if (uploadConfig?.mode === 'direct') {
      return uploadCreativeCenterImageDirectly(file, uploadConfig);
    }
    return uploadCreativeCenterImageViaBackend(file);
  };

  const handleCreativeCenterImageFiles = async (files) => {
    setIsUploadDragActive(false);
    if (files.length === 0) {
      return;
    }

    if (!isCurrentModelImageUploadEnabled) {
      setUploadImageNotice('当前模型不支持上传图片');
      showWarning('当前模型不支持上传图片');
      return;
    }

    if (!isLoggedIn) {
      showWarning('请先登录后再上传图片');
      return;
    }

    const rawImageFiles = files.filter((file) => file.type.startsWith('image/'));
    if (rawImageFiles.length !== files.length) {
      showWarning('请上传图片文件');
    }
    if (rawImageFiles.length === 0) {
      return;
    }

    const imageFiles = rawImageFiles.filter(
      (file) => file.size <= CREATIVE_CENTER_IMAGE_UPLOAD_MAX_BYTES,
    );
    if (imageFiles.length !== rawImageFiles.length) {
      showWarning('图片大小不能超过 10MB');
    }
    if (imageFiles.length === 0) {
      setUploadImageNotice('上传失败，请重新上传不大于 10MB 的图片');
      return;
    }

    const remainingSlots =
      typeof currentImageUploadLimit === 'number'
        ? currentImageUploadLimit - uploadedImages.length
        : null;
    if (remainingSlots !== null && remainingSlots <= 0) {
      const message = `当前模型最多上传 ${currentImageUploadLimit} 张图片`;
      setUploadImageNotice(message);
      showWarning(message);
      return;
    }

    const acceptedFiles =
      remainingSlots !== null ? imageFiles.slice(0, remainingSlots) : imageFiles;
    let limitNotice = '';
    if (acceptedFiles.length < imageFiles.length && currentImageUploadLimit) {
      limitNotice = `当前模型最多上传 ${currentImageUploadLimit} 张图片，本次仅保留前 ${acceptedFiles.length} 张`;
      showWarning(limitNotice);
    }
    if (acceptedFiles.length === 0) {
      return;
    }

    setUploadImageNotice(limitNotice);
    const pendingItems = acceptedFiles.map((file) => ({
      id: createCreativeRecordId('hosted-image'),
      name: file.name,
      url: '',
      fileName: '',
      previewUrl: URL.createObjectURL(file),
      status: 'uploading',
    }));

    setUploadedImages((prev) => [...prev, ...pendingItems]);

    for (
      let batchStartIndex = 0;
      batchStartIndex < acceptedFiles.length;
      batchStartIndex += CREATIVE_CENTER_IMAGE_UPLOAD_CONCURRENCY
    ) {
      const fileBatch = acceptedFiles.slice(
        batchStartIndex,
        batchStartIndex + CREATIVE_CENTER_IMAGE_UPLOAD_CONCURRENCY,
      );

      await Promise.all(
        fileBatch.map(async (file, offset) => {
          const index = batchStartIndex + offset;
          const pendingItem = pendingItems[index];

          try {
            const uploaded = await uploadCreativeCenterImage(file);
            setUploadedImages((prev) =>
              prev.map((item) =>
                item.id === pendingItem.id
                  ? {
                      ...item,
                      name: uploaded.name || file.name,
                      url: uploaded.url,
                      fileName: uploaded.filename || '',
                      status: 'uploaded',
                    }
                  : item,
              ),
            );
          } catch (error) {
            console.error('Failed to upload creative center image:', error);
            revokeCreativeCenterPreviewURL(pendingItem.previewUrl);
            setUploadedImages((prev) =>
              prev.filter((item) => item.id !== pendingItem.id),
            );
            setUploadImageNotice('上传失败，请重新上传');
          }
        }),
      );
    }
  };

  const handleImageFileChange = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    await handleCreativeCenterImageFiles(files);
  };

  const handleUploadDragEnter = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isCurrentModelImageUploadEnabled) {
      return;
    }
    setIsUploadDragActive(true);
  };

  const handleUploadDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isCurrentModelImageUploadEnabled) {
      return;
    }
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    setIsUploadDragActive(true);
  };

  const handleUploadDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const relatedTarget = event.relatedTarget;
    if (
      relatedTarget instanceof Node &&
      event.currentTarget instanceof Node &&
      event.currentTarget.contains(relatedTarget)
    ) {
      return;
    }
    setIsUploadDragActive(false);
  };

  const handleUploadDrop = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsUploadDragActive(false);
    const files = Array.from(event.dataTransfer?.files || []);
    await handleCreativeCenterImageFiles(files);
  };

  useEffect(() => {
    const collectPendingImageTasks = () =>
      imageRecordsRef.current.flatMap((record) =>
        record.images
          .filter((image) => {
            const queryTaskId = getRecoverableImageTaskId(image);
            return (
              Boolean(queryTaskId) &&
              image.requestPollable !== false &&
              !getImageTaskMediaUrl(image) &&
              !isTerminalImageTaskStatus(image.status)
            );
          })
          .map((image) => ({
            recordId: record.id,
            modelName: record.modelName,
            localTaskId: image.id,
            queryTaskId: getRecoverableImageTaskId(image),
          })),
      );

    const clearImagePollingTimer = () => {
      if (imagePollingTimerRef.current) {
        window.clearTimeout(imagePollingTimerRef.current);
        imagePollingTimerRef.current = null;
      }
    };

    const scheduleImagePollingCycle = (delay = 0) => {
      if (imagePollingTimerRef.current) {
        return;
      }

      imagePollingTimerRef.current = window.setTimeout(async () => {
        imagePollingTimerRef.current = null;

        const now = Date.now();
        if (creativeImagePollingBlockedUntilRef.current > now) {
          scheduleImagePollingCycle(
            creativeImagePollingBlockedUntilRef.current - now,
          );
          return;
        }

        const pendingTasks = collectPendingImageTasks();
        if (pendingTasks.length === 0) {
          imagePollingInFlightRef.current.clear();
          return;
        }

        const activeTaskIds = new Set(
          pendingTasks.map((task) => task.localTaskId),
        );
        imagePollingInFlightRef.current.forEach((taskId) => {
          if (!activeTaskIds.has(taskId)) {
            imagePollingInFlightRef.current.delete(taskId);
          }
        });

        const tasksToPoll = pendingTasks
          .filter(
            (task) => !imagePollingInFlightRef.current.has(task.localTaskId),
          )
          .slice(0, CREATIVE_CENTER_IMAGE_POLL_CONCURRENCY);

        if (tasksToPoll.length === 0) {
          scheduleImagePollingCycle(CREATIVE_CENTER_IMAGE_POLL_INTERVAL_MS);
          return;
        }

        await Promise.all(
          tasksToPoll.map(async (task) => {
            imagePollingInFlightRef.current.add(task.localTaskId);
            try {
              const response = await API.get(
                `${API_ENDPOINTS.IMAGE_ASYNC_GENERATIONS}/${encodeURIComponent(task.queryTaskId)}`,
                buildCreativeTaskStatusRequestConfig(),
              );
              const nextTaskState = parseImageFetchPayload(response);
              patchImageTask(
                task.recordId,
                task.localTaskId,
                buildResolvedImageTaskPatch(task.queryTaskId, nextTaskState),
              );
            } catch (error) {
              if (error?.response?.status === 429) {
                creativeImagePollingBlockedUntilRef.current = Math.max(
                  creativeImagePollingBlockedUntilRef.current,
                  Date.now() + CREATIVE_CENTER_IMAGE_POLL_429_BACKOFF_MS,
                );
                return;
              }
              console.error('Failed to poll creative center image task:', error);
            } finally {
              imagePollingInFlightRef.current.delete(task.localTaskId);
            }
          }),
        );

        if (collectPendingImageTasks().length > 0) {
          scheduleImagePollingCycle(CREATIVE_CENTER_IMAGE_POLL_INTERVAL_MS);
        }
      }, delay);
    };

    const pendingTasks = collectPendingImageTasks();
    const activeTaskIds = new Set(pendingTasks.map((task) => task.localTaskId));
    imagePollingInFlightRef.current.forEach((taskId) => {
      if (!activeTaskIds.has(taskId)) {
        imagePollingInFlightRef.current.delete(taskId);
      }
    });

    if (pendingTasks.length === 0) {
      clearImagePollingTimer();
      return;
    }

    scheduleImagePollingCycle(0);
  }, [imageRecords]);

  useEffect(() => {
    const collectPendingVideoTasks = () =>
      videoRecordsRef.current.flatMap((record) =>
        record.tasks
          .filter((task) => {
            const queryTaskId = getRecoverableVideoTaskId(task);
            const requestId = String(task?.requestId || '').trim();
            const canPollByRequestId =
              Boolean(requestId) &&
              !queryTaskId &&
              task.requestPollable !== false;
            return (
              Boolean(queryTaskId || canPollByRequestId) &&
              (queryTaskId ? task.pollable !== false : canPollByRequestId) &&
              ACTIVE_VIDEO_POLL_STATUSES.has(normalizeVideoTaskStatus(task.status))
            );
          })
          .map((task) => ({
            recordId: record.id,
            modelName: record.modelName,
            recordModelName: String(record?.modelName || '').trim().toLowerCase(),
            localTaskId: task.id,
            queryTaskId: getRecoverableVideoTaskId(task),
            requestId: typeof task?.requestId === 'string' ? task.requestId.trim() : '',
            recordCreatedAt: Number(record?.createdAt) || 0,
            recordUpdatedAt: Number(record?.updatedAt) || 0,
            sortTimestamp:
              Number(task?.submittedAt) ||
              Number(record?.updatedAt) ||
              Number(record?.createdAt) ||
              0,
          })),
      );

    const clearVideoPollingTimer = () => {
      if (videoPollingTimerRef.current) {
        window.clearTimeout(videoPollingTimerRef.current);
        videoPollingTimerRef.current = null;
      }
    };

    const scheduleVideoPollingCycle = (delay = 0) => {
      if (videoPollingTimerRef.current) {
        return;
      }

      videoPollingTimerRef.current = window.setTimeout(async () => {
        videoPollingTimerRef.current = null;

        const now = Date.now();
        if (creativeVideoPollingBlockedUntilRef.current > now) {
          scheduleVideoPollingCycle(
            creativeVideoPollingBlockedUntilRef.current - now,
          );
          return;
        }

        const pendingTasks = collectPendingVideoTasks();
        if (pendingTasks.length === 0) {
          videoPollingInFlightRef.current.clear();
          return;
        }

        const activeTaskIds = new Set(
          pendingTasks.map((task) => task.localTaskId),
        );
        videoPollingInFlightRef.current.forEach((taskId) => {
          if (!activeTaskIds.has(taskId)) {
            videoPollingInFlightRef.current.delete(taskId);
          }
        });

        const tasksToPoll = pendingTasks
          .filter(
            (task) => !videoPollingInFlightRef.current.has(task.localTaskId),
          )
          .slice(0, CREATIVE_CENTER_VIDEO_POLL_CONCURRENCY);

        if (tasksToPoll.length === 0) {
          scheduleVideoPollingCycle(CREATIVE_CENTER_VIDEO_POLL_INTERVAL_MS);
          return;
        }

        let exactTaskByRequestId = new Map();
        let exactTaskByTaskId = new Map();
        let fallbackTaskMatches = new Map();
        try {
          const exactTasks = await fetchCreativeVideoTasksByIdentifiers(
            tasksToPoll,
          );
          exactTaskByRequestId = new Map();
          exactTaskByTaskId = new Map();
          exactTasks.forEach((task) => {
            const requestId = getTaskDtoRequestId(task);
            if (requestId) {
              exactTaskByRequestId.set(requestId, task);
            }
            const taskId = String(task?.task_id || task?.taskId || '').trim();
            if (taskId) {
              exactTaskByTaskId.set(taskId, task);
            }
          });

          const unresolvedTasks = tasksToPoll.filter(
            (task) =>
              !task.queryTaskId &&
              !(
                task.requestId &&
                exactTaskByRequestId.has(task.requestId)
              ),
          );
          if (unresolvedTasks.length > 0) {
            const nearbyTasks = await fetchCreativeVideoTasksAroundCandidates(
              unresolvedTasks,
            );
            fallbackTaskMatches = matchCreativeVideoTasksToCandidates(
              unresolvedTasks,
              mergeCreativeTaskDtoLists(exactTasks, nearbyTasks),
            );
          }
        } catch (error) {
          console.error('Failed to fetch exact creative center video task states:', error);
        }

        await Promise.all(
          tasksToPoll.map(async (task) => {
            videoPollingInFlightRef.current.add(task.localTaskId);
            try {
              let queryTaskId = task.queryTaskId;
              const exactTaskByRequest = exactTaskByRequestId.get(task.requestId);
              if (!queryTaskId && exactTaskByRequest) {
                const exactTaskState = parseTaskDtoVideoState(exactTaskByRequest);
                queryTaskId = exactTaskState.taskId;
                patchVideoTask(
                  task.recordId,
                  task.localTaskId,
                  buildResolvedVideoTaskPatch(queryTaskId, exactTaskState),
                );
                return;
              }

              const fallbackTask = fallbackTaskMatches.get(task.localTaskId);
              if (fallbackTask) {
                const fallbackTaskState = parseTaskDtoVideoState(fallbackTask);
                queryTaskId = fallbackTaskState.taskId || queryTaskId;
                patchVideoTask(
                  task.recordId,
                  task.localTaskId,
                  buildResolvedVideoTaskPatch(queryTaskId, fallbackTaskState),
                );
                return;
              }

              if (!queryTaskId) {
                return;
              }

              const exactTaskById = exactTaskByTaskId.get(queryTaskId);
              if (exactTaskById) {
                const exactTaskState = parseTaskDtoVideoState(exactTaskById);
                patchVideoTask(
                  task.recordId,
                  task.localTaskId,
                  buildResolvedVideoTaskPatch(queryTaskId, exactTaskState),
                );
                return;
              }

              patchVideoTask(
                task.recordId,
                task.localTaskId,
                buildResolvedVideoTaskIdPatch(queryTaskId),
              );

              const response = await API.get(
                `${API_ENDPOINTS.VIDEO_ASYNC_GENERATIONS}/${encodeURIComponent(queryTaskId)}`,
                buildCreativeTaskStatusRequestConfig(),
              );

              const nextTaskState = parseVideoFetchPayload(response);
              const nextStatus = normalizeVideoTaskStatus(nextTaskState.status);
              const isFailed = nextStatus === 'failed';
              const isCompleted =
                !isFailed && (nextStatus === 'completed' || Boolean(nextTaskState.url));

              if (
                isCompleted &&
                shouldUseEstimatedVideoProgress(task.modelName)
              ) {
                patchVideoTask(task.recordId, task.localTaskId, (currentTask) => ({
                  status: 'finalizing',
                  progress: 96,
                  url: '',
                  resultUrl:
                    nextTaskState.url ||
                    currentTask.resultUrl ||
                    currentTask.url,
                  content: nextTaskState.content || currentTask.content,
                  error: '',
                  finalizingAt: Date.now(),
                  pollable: false,
                }));
                window.setTimeout(() => {
                  patchVideoTask(task.recordId, task.localTaskId, (currentTask) => ({
                    status: 'completed',
                    progress: 100,
                    url:
                      nextTaskState.url ||
                      currentTask.resultUrl ||
                      currentTask.url,
                    content: nextTaskState.content || currentTask.content,
                    error: '',
                    finalizingAt: 0,
                    pollable: false,
                  }));
                }, 180);
              } else {
                patchVideoTask(task.recordId, task.localTaskId, (currentTask) => ({
                  taskId: queryTaskId,
                  status: isCompleted
                    ? 'completed'
                    : isFailed
                      ? 'failed'
                      : nextStatus,
                  progress: isCompleted
                    ? 100
                    : nextTaskState.progress ?? currentTask.progress ?? 0,
                  url: isCompleted
                    ? nextTaskState.url || currentTask.url
                    : currentTask.url,
                  content: nextTaskState.content || currentTask.content,
                  error: isFailed
                    ? nextTaskState.error ||
                      currentTask.error ||
                      '任务生成失败'
                    : '',
                  finalizingAt: 0,
                  pollable: !(isCompleted || isFailed),
                }));
              }
            } catch (error) {
              if (error?.response?.status === 429) {
                creativeVideoPollingBlockedUntilRef.current = Math.max(
                  creativeVideoPollingBlockedUntilRef.current,
                  Date.now() + CREATIVE_CENTER_VIDEO_POLL_429_BACKOFF_MS,
                );
                return;
              }
              console.error('Failed to poll creative center video task:', error);
            } finally {
              videoPollingInFlightRef.current.delete(task.localTaskId);
            }
          }),
        );

        if (collectPendingVideoTasks().length > 0) {
          scheduleVideoPollingCycle(CREATIVE_CENTER_VIDEO_POLL_INTERVAL_MS);
        }
      }, delay);
    };

    const pendingTasks = collectPendingVideoTasks();
    const activeTaskIds = new Set(pendingTasks.map((task) => task.localTaskId));
    videoPollingInFlightRef.current.forEach((taskId) => {
      if (!activeTaskIds.has(taskId)) {
        videoPollingInFlightRef.current.delete(taskId);
      }
    });

    if (pendingTasks.length === 0) {
      clearVideoPollingTimer();
      return;
    }

    scheduleVideoPollingCycle(0);
  }, [videoRecords]);

  const applyReusedUploadedImages = (sourceImages = []) => {
    const nextImages = (Array.isArray(sourceImages) ? sourceImages : [])
      .map((item, index) => normalizeCreativeSourceImageItem(item, index))
      .filter(Boolean)
      .map((item, index) => ({
        ...item,
        id: createCreativeRecordId(`reused-image-${index + 1}`),
        previewUrl: '',
        status: 'uploaded',
      }));

    setUploadedImages((prev) => {
      prev.forEach((item) => {
        revokeCreativeCenterPreviewURL(item.previewUrl);
      });
      return nextImages;
    });
    setUploadImageNotice('');
  };

  const handleReuseRecord = (record) => {
    if (!record) {
      return;
    }

    applyReusedUploadedImages(record.sourceImages || []);
    if (record.prompt) {
      setPrompt(record.prompt);
    }
    if (record.params && typeof record.params === 'object') {
      setParams((prev) => ({
        ...prev,
        ...record.params,
      }));
    }
    textareaRef.current?.focus();
  };

  const handleClearCurrentSession = async () => {
    const activeSessionId = currentTabHistorySnapshot?.payload?.current_session_id;
    if (!activeSessionId) {
      return;
    }
    await deleteCreativeSession(activeTab, activeSessionId, {
      createFallback: true,
    });
  };

  const handleRemoveImageRecord = async (recordId) => {
    const nextRecords = imageRecords.filter((record) => record.id !== recordId);
    setImageRecords(nextRecords);
    setCollapsedImageRecordIds((prev) => {
      const next = { ...prev };
      delete next[recordId];
      return next;
    });
    await persistImageRecords(nextRecords);
  };

  const handleRemoveVideoRecord = async (recordId) => {
    const nextRecords = videoRecords.filter((record) => record.id !== recordId);
    setVideoRecords(nextRecords);
    setCollapsedVideoRecordIds((prev) => {
      const next = { ...prev };
      delete next[recordId];
      return next;
    });
    await persistVideoRecords(nextRecords);
  };

  const toggleImageRecordCollapsed = (recordId) => {
    setCollapsedImageRecordIds((prev) => ({
      ...prev,
      [recordId]: !(prev[recordId] ?? false),
    }));
  };

  const toggleVideoRecordCollapsed = (recordId) => {
    setCollapsedVideoRecordIds((prev) => ({
      ...prev,
      [recordId]: !(prev[recordId] ?? false),
    }));
  };

  useEffect(() => {
    let mounted = true;
    setHistoryLoaded(false);

    const loadCreativeHistory = async () => {
      if (!isLoggedIn) {
        if (!mounted) {
          return;
        }
        historyHydratedRef.current = true;
        const emptySnapshots = {
          chat: normalizeCreativeHistorySnapshot('chat', null),
          image: normalizeCreativeHistorySnapshot('image', null),
          video: normalizeCreativeHistorySnapshot('video', null),
        };
        setHistorySnapshots(emptySnapshots);
        setChatMessages([]);
        setImageRecords([]);
        setVideoRecords([]);
        setCollapsedImageRecordIds({});
        setCollapsedVideoRecordIds({});
        setSelectedImageTaskIds({});
        setSelectedVideoTaskIds({});
        setHistoryLoaded(true);
        return;
      }

      try {
        const response = await API.get(API_ENDPOINTS.CREATIVE_CENTER_HISTORY, {
          skipErrorHandler: true,
          headers: {
            'New-API-User': getUserIdFromLocalStorage(),
          },
        });
        if (!mounted || !response?.data?.success) {
          return;
        }

        const nextSnapshots = {
          chat: normalizeCreativeHistorySnapshot('chat', response.data.data?.chat || null),
          image: normalizeCreativeHistorySnapshot('image', response.data.data?.image || null),
          video: normalizeCreativeHistorySnapshot('video', response.data.data?.video || null),
        };
        const nextChatSession = getCreativeCurrentSessionSnapshot(nextSnapshots.chat, 'chat');
        const nextImageSession = getCreativeCurrentSessionSnapshot(
          nextSnapshots.image,
          'image',
        );
        const nextVideoSession = getCreativeCurrentSessionSnapshot(
          nextSnapshots.video,
          'video',
        );
        const nextImageRecords = normalizeImageHistoryRecords(nextImageSession);
        const nextVideoRecords = normalizeVideoHistoryRecords(nextVideoSession);
        setHistorySnapshots(nextSnapshots);
        setChatMessages(
          Array.isArray(nextChatSession?.payload?.messages)
            ? nextChatSession.payload.messages
            : [],
        );
        setImageRecords(nextImageRecords);
        setVideoRecords(nextVideoRecords);
        setCollapsedImageRecordIds(
          Object.fromEntries(nextImageRecords.map((record) => [record.id, true])),
        );
        setCollapsedVideoRecordIds(
          Object.fromEntries(nextVideoRecords.map((record) => [record.id, true])),
        );
        setSelectedImageTaskIds({});
        setSelectedVideoTaskIds({});
        lastPersistedImageSignatureRef.current = buildCreativePersistSignature(
          nextImageRecords,
          'image',
        );
        lastPersistedVideoSignatureRef.current = buildCreativePersistSignature(
          nextVideoRecords,
          'video',
        );
        historyHydratedRef.current = true;
        setHistoryLoaded(true);
      } catch (error) {
        console.error('Failed to load creative center history:', error);
        historyHydratedRef.current = true;
        if (mounted) {
          setHistoryLoaded(true);
        }
      }
    };

    loadCreativeHistory();

    return () => {
      mounted = false;
    };
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn || !historyHydratedRef.current) {
      return undefined;
    }
    if (imagePersistSignature === lastPersistedImageSignatureRef.current) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      persistImageRecords(imageRecordsRef.current).catch((error) => {
        console.error('Failed to persist creative center image records:', error);
      });
    }, CREATIVE_CENTER_HISTORY_PERSIST_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [imagePersistSignature, isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn || !historyHydratedRef.current) {
      return undefined;
    }
    if (videoPersistSignature === lastPersistedVideoSignatureRef.current) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      persistVideoRecords(videoRecordsRef.current).catch((error) => {
        console.error('Failed to persist creative center video records:', error);
      });
    }, CREATIVE_CENTER_VIDEO_HISTORY_PERSIST_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [videoPersistSignature, isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn || !historyHydratedRef.current || startupImageRecoveryRunRef.current) {
      return undefined;
    }

    startupImageRecoveryRunRef.current = true;

    const candidates = collectRecoverableImageCandidatesFromSnapshot(
      historySnapshots.image,
    );
    const limitedCandidates = candidates.slice(
      0,
      CREATIVE_CENTER_STARTUP_VIDEO_RECOVERY_MAX_TASKS,
    );

    if (limitedCandidates.length === 0) {
      return undefined;
    }

    let cancelled = false;

    const fetchCompletedImageTasksForRecord = async (recordCandidates) => {
      if (!Array.isArray(recordCandidates) || recordCandidates.length === 0) {
        return [];
      }

      const modelName = String(recordCandidates[0]?.recordModelName || '').trim().toLowerCase();
      const candidateTimes = recordCandidates
        .map((candidate) =>
          normalizeCreativeTimestampToSeconds(
            candidate.sortTimestamp ||
              candidate.recordUpdatedAt ||
              candidate.recordCreatedAt,
          ),
        )
        .filter((value) => value > 0);
      const baseStartTimestamp =
        candidateTimes.length > 0 ? Math.min(...candidateTimes) : 0;
      const baseEndTimestamp =
        candidateTimes.length > 0 ? Math.max(...candidateTimes) : baseStartTimestamp;
      const startTimestamp = Math.max(0, baseStartTimestamp - 120);
      const endTimestamp = Math.max(startTimestamp + 1, baseEndTimestamp + 1800);

      try {
        const response = await API.get(
          '/api/task/self',
          buildCreativeTaskStatusRequestConfig({
            params: {
              p: 1,
              page_size: 100,
              status: 'SUCCESS',
              start_timestamp: startTimestamp,
              end_timestamp: endTimestamp,
            },
          }),
        );

        const items = Array.isArray(response?.data?.data?.items)
          ? response.data.data.items
          : [];

        return items
          .filter((item) => {
            const action = String(item?.action || '').trim();
            if (
              action !== 'imageGenerate' &&
              action !== 'imageEdit'
            ) {
              return false;
            }

            const imageUrls = getTaskDtoImageUrls(item);
            if (imageUrls.length === 0) {
              return false;
            }

            const taskModelName = getTaskDtoModelName(item).toLowerCase();
            if (modelName && taskModelName && taskModelName !== modelName) {
              return false;
            }

            const submitTime = normalizeCreativeTimestampToSeconds(item?.submit_time);
            if (submitTime > 0 && (submitTime < startTimestamp || submitTime > endTimestamp)) {
              return false;
            }

            return true;
          })
          .sort(
            (left, right) =>
              normalizeCreativeTimestampToSeconds(left?.submit_time) -
              normalizeCreativeTimestampToSeconds(right?.submit_time),
          );
      } catch (error) {
        console.error('Failed to recover creative center image tasks from task list:', error);
        return [];
      }
    };

    const buildFallbackImageMatchMap = async (recordCandidateGroups) => {
      const fallbackMatches = new Map();

      for (const group of recordCandidateGroups) {
        if (cancelled || group.length === 0) {
          break;
        }

        const matchedTasks = await fetchCompletedImageTasksForRecord(group);
        if (matchedTasks.length === 0) {
          continue;
        }

        const sortedCandidates = [...group].sort(
          (left, right) =>
            normalizeCreativeTimestampToSeconds(left.sortTimestamp) -
            normalizeCreativeTimestampToSeconds(right.sortTimestamp),
        );

        sortedCandidates.forEach((candidate, index) => {
          const matchedTask = matchedTasks[index];
          if (!matchedTask) {
            return;
          }
          fallbackMatches.set(
            buildRecoverableImageCandidateKey(candidate),
            matchedTask,
          );
        });
      }

      return fallbackMatches;
    };

    const recoverStartupImageTasks = async () => {
      let recoveredSnapshot = normalizeCreativeHistorySnapshot(
        'image',
        historySnapshots.image,
      );
      let hasRecoveredChanges = false;

      try {
        const groupedCandidates = Array.from(
          limitedCandidates.reduce((map, candidate) => {
            const key = `${candidate.sessionId}:${candidate.recordId}`;
            if (!map.has(key)) {
              map.set(key, []);
            }
            map.get(key).push(candidate);
            return map;
          }, new Map()),
        ).map(([, group]) => group);
        const fallbackTaskMatches = await buildFallbackImageMatchMap(groupedCandidates);

        for (
          let startIndex = 0;
          startIndex < limitedCandidates.length && !cancelled;
          startIndex += CREATIVE_CENTER_STARTUP_VIDEO_RECOVERY_CONCURRENCY
        ) {
          const currentBatch = limitedCandidates.slice(
            startIndex,
            startIndex + CREATIVE_CENTER_STARTUP_VIDEO_RECOVERY_CONCURRENCY,
          );

          currentBatch.forEach((candidate) => {
            const matchedTask = fallbackTaskMatches.get(
              buildRecoverableImageCandidateKey(candidate),
            );
            if (!matchedTask || cancelled) {
              return;
            }

            const imageUrls = getTaskDtoImageUrls(matchedTask);
            const primaryImageUrl = imageUrls[0] || '';
            if (!primaryImageUrl) {
              return;
            }

            const taskPatch = patchImageTaskInHistorySnapshot(
              recoveredSnapshot,
              candidate,
              {
                url: primaryImageUrl,
                resultUrl: primaryImageUrl,
                status: 'completed',
                progress: 100,
                error: '',
                finalizingAt: 0,
                progressUnavailable: false,
                requestPollable: false,
              },
            );
            if (taskPatch.hasChanged) {
              recoveredSnapshot = taskPatch.snapshot;
              hasRecoveredChanges = true;
            }
          });
        }

        if (!cancelled && hasRecoveredChanges) {
          await persistCreativeHistorySnapshot('image', recoveredSnapshot, {
            applySessionState: true,
          });
        }
      } catch (error) {
        console.error('Failed to finish startup recovery for creative center image tasks:', error);
      }
    };

    recoverStartupImageTasks();

    return () => {
      cancelled = true;
    };
  }, [historySnapshots.image, isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn || !historyHydratedRef.current || startupVideoRecoveryRunRef.current) {
      return undefined;
    }

    startupVideoRecoveryRunRef.current = true;

    const candidates = collectRecoverableVideoCandidatesFromSnapshot(
      historySnapshots.video,
    );
    const limitedCandidates = candidates.slice(
      0,
      CREATIVE_CENTER_STARTUP_VIDEO_RECOVERY_MAX_TASKS,
    );

    if (limitedCandidates.length === 0) {
      return undefined;
    }

    let cancelled = false;

    const recoverStartupVideoTasks = async () => {
      let recoveredSnapshot = normalizeCreativeHistorySnapshot(
        'video',
        historySnapshots.video,
      );
      let hasRecoveredChanges = false;

      try {
        const exactTasks = await fetchCreativeVideoTasksByIdentifiers(
          limitedCandidates,
        );
        const nearbyTasks = await fetchCreativeVideoTasksAroundCandidates(
          limitedCandidates,
        );
        const taskMatches = matchCreativeVideoTasksToCandidates(
          limitedCandidates,
          mergeCreativeTaskDtoLists(exactTasks, nearbyTasks),
        );
        const exactTaskByRequestId = new Map();
        const exactTaskByTaskId = new Map();
        exactTasks.forEach((task) => {
          const requestId = getTaskDtoRequestId(task);
          if (requestId) {
            exactTaskByRequestId.set(requestId, task);
          }
          const taskId = String(task?.task_id || task?.taskId || '').trim();
          if (taskId) {
            exactTaskByTaskId.set(taskId, task);
          }
        });

        for (
          let startIndex = 0;
          startIndex < limitedCandidates.length && !cancelled;
          startIndex += CREATIVE_CENTER_STARTUP_VIDEO_RECOVERY_CONCURRENCY
        ) {
          const currentBatch = limitedCandidates.slice(
            startIndex,
            startIndex + CREATIVE_CENTER_STARTUP_VIDEO_RECOVERY_CONCURRENCY,
          );

          const batchResults = await Promise.allSettled(
            currentBatch.map(async (candidate) => {
              let queryTaskId = candidate.queryTaskId;
              const matchedTask = taskMatches.get(candidate.taskId);
              if (matchedTask) {
                const matchedTaskState = parseTaskDtoVideoState(matchedTask);
                queryTaskId = matchedTaskState.taskId || queryTaskId;
                if (queryTaskId || ['completed', 'failed'].includes(matchedTaskState.status)) {
                  return {
                    candidate,
                    queryTaskId,
                    nextTaskState: matchedTaskState,
                  };
                }
              }

              const exactTask = exactTaskByRequestId.get(candidate.requestId);

              if (!queryTaskId && exactTask) {
                const exactTaskState = parseTaskDtoVideoState(exactTask);
                queryTaskId = exactTaskState.taskId;
                if (queryTaskId) {
                  return {
                    candidate,
                    queryTaskId,
                    nextTaskState: exactTaskState,
                  };
                }
              }

              if (!queryTaskId || cancelled) {
                return null;
              }

              const exactTaskById = exactTaskByTaskId.get(queryTaskId);
              if (exactTaskById) {
                return {
                  candidate,
                  queryTaskId,
                  nextTaskState: parseTaskDtoVideoState(exactTaskById),
                };
              }

              try {
                const response = await API.get(
                  `${API_ENDPOINTS.VIDEO_ASYNC_GENERATIONS}/${encodeURIComponent(queryTaskId)}`,
                  buildCreativeTaskStatusRequestConfig(),
                );

                if (cancelled) {
                  return null;
                }

                return {
                  candidate,
                  queryTaskId,
                  nextTaskState: parseVideoFetchPayload(response),
                };
              } catch (error) {
                console.error('Failed to recover creative center video task from history:', error);
                return {
                  candidate,
                  queryTaskId,
                  nextTaskState: null,
                };
              }
            }),
          );

          batchResults.forEach((result) => {
            if (result.status !== 'fulfilled' || !result.value || cancelled) {
              return;
            }

            const { candidate, queryTaskId, nextTaskState } = result.value;
            if (!queryTaskId) {
              return;
            }

            const taskIdPatch = patchVideoTaskInHistorySnapshot(
              recoveredSnapshot,
              candidate,
              buildResolvedVideoTaskIdPatch(queryTaskId),
            );
            if (taskIdPatch.hasChanged) {
              recoveredSnapshot = taskIdPatch.snapshot;
              hasRecoveredChanges = true;
            }

            if (!nextTaskState) {
              return;
            }

            const taskStatePatch = patchVideoTaskInHistorySnapshot(
              recoveredSnapshot,
              candidate,
              buildResolvedVideoTaskPatch(queryTaskId, nextTaskState),
              /*
                  ? (nextTaskState.error || currentTask.error || '任务生成失败')
                  : '',
                resultUrl: isCompleted
                  ? (resolvedURL || currentTask.resultUrl || currentTask.url)
                  : (currentTask.resultUrl || resolvedURL),
                finalizingAt: 0,
                pollable: Boolean(queryTaskId) && !(isCompleted || isFailed),
              }),
              */
            );
            if (taskStatePatch.hasChanged) {
              recoveredSnapshot = taskStatePatch.snapshot;
              hasRecoveredChanges = true;
            }
          });
        }

        if (!cancelled && hasRecoveredChanges) {
          await persistCreativeHistorySnapshot('video', recoveredSnapshot, {
            applySessionState: true,
          });
        }
      } catch (error) {
        console.error('Failed to finish startup recovery for creative center video tasks:', error);
      }
    };

    recoverStartupVideoTasks();

    return () => {
      cancelled = true;
    };
  }, [historySnapshots.video, isLoggedIn]);

  useEffect(() => {
    if (
      !isLoggedIn ||
      !historyHydratedRef.current ||
      activeTab !== 'image' ||
      !activeHistorySnapshot
    ) {
      return undefined;
    }

    const reconcileSignature = buildCreativeReconcileSignature(
      activeHistorySnapshot.id,
      imageRecords,
      'image',
    );
    if (reconcileSignature === lastActiveImageReconcileSignatureRef.current) {
      return undefined;
    }
    lastActiveImageReconcileSignatureRef.current = reconcileSignature;

    const sessionRecords = normalizeImageHistoryRecords(activeHistorySnapshot);
    const candidates = sessionRecords
      .flatMap((record) =>
        record.images.map((image, imageIndex) => ({
          recordId: record.id,
          imageId: image.id,
          itemIndex: imageIndex,
          queryTaskId: getRecoverableImageTaskId(image),
          requestId: String(image?.requestId || '').trim(),
          hasMedia: Boolean(getImageTaskMediaUrl(image)),
          status: String(image?.status || '').trim().toLowerCase(),
          recordModelName: String(record?.modelName || '').trim().toLowerCase(),
          recordCreatedAt: Number(record?.createdAt) || 0,
          recordUpdatedAt: Number(record?.updatedAt) || 0,
          sortTimestamp:
            Number(image?.submittedAt) ||
            Number(record?.updatedAt) ||
            Number(record?.createdAt) ||
            0,
        })),
      )
      .filter(
        (candidate) =>
          !candidate.hasMedia &&
          !isTerminalImageTaskStatus(candidate.status) &&
          Boolean(candidate.queryTaskId || candidate.requestId),
      );

    if (candidates.length === 0) {
      return undefined;
    }

    let cancelled = false;

    const reconcileActiveImageSession = async () => {
      let recoveredSnapshot = normalizeCreativeHistorySnapshot(
        'image',
        historySnapshots.image,
      );
      let hasRecoveredChanges = false;

      const candidateTimes = candidates
        .map((candidate) =>
          normalizeCreativeTimestampToSeconds(
            candidate.sortTimestamp ||
              candidate.recordUpdatedAt ||
              candidate.recordCreatedAt,
          ),
        )
        .filter((value) => value > 0);
      const baseStartTimestamp =
        candidateTimes.length > 0 ? Math.min(...candidateTimes) : 0;
      const baseEndTimestamp =
        candidateTimes.length > 0 ? Math.max(...candidateTimes) : baseStartTimestamp;
      const startTimestamp = Math.max(0, baseStartTimestamp - 120);
      const endTimestamp = Math.max(startTimestamp + 1, baseEndTimestamp + 1800);

      try {
        const response = await API.get(
          '/api/task/self',
          buildCreativeTaskStatusRequestConfig({
            params: {
              p: 1,
              page_size: 100,
              status: 'SUCCESS',
              start_timestamp: startTimestamp,
              end_timestamp: endTimestamp,
            },
          }),
        );

        if (cancelled) {
          return;
        }

        const items = Array.isArray(response?.data?.data?.items)
          ? response.data.data.items
          : [];
        const imageTasks = items
          .filter((item) => {
            const action = String(item?.action || '').trim();
            if (action !== 'imageGenerate' && action !== 'imageEdit') {
              return false;
            }
            return getTaskDtoImageUrls(item).length > 0;
          })
          .sort(
            (left, right) =>
              normalizeCreativeTimestampToSeconds(left?.submit_time) -
              normalizeCreativeTimestampToSeconds(right?.submit_time),
          );

        if (imageTasks.length === 0) {
          return;
        }

        const usedTaskIds = new Set();
        const taskMatches = new Map();

        candidates.forEach((candidate) => {
          if (!candidate.queryTaskId) {
            return;
          }
          const matchedTask = imageTasks.find(
            (item) => String(item?.task_id || '').trim() === candidate.queryTaskId,
          );
          if (!matchedTask) {
            return;
          }
          taskMatches.set(candidate.imageId, matchedTask);
          usedTaskIds.add(candidate.queryTaskId);
        });

        const groupedCandidates = Array.from(
          candidates.reduce((map, candidate) => {
            if (taskMatches.has(candidate.imageId)) {
              return map;
            }
            const key = candidate.recordId;
            if (!map.has(key)) {
              map.set(key, []);
            }
            map.get(key).push(candidate);
            return map;
          }, new Map()),
        );

        groupedCandidates.forEach(([, group]) => {
          const recordModelName = String(group[0]?.recordModelName || '').trim();
          const recordTimes = group
            .map((candidate) =>
              normalizeCreativeTimestampToSeconds(
                candidate.sortTimestamp ||
                  candidate.recordUpdatedAt ||
                  candidate.recordCreatedAt,
              ),
            )
            .filter((value) => value > 0);
          const recordStart = recordTimes.length > 0 ? Math.min(...recordTimes) - 120 : 0;
          const recordEnd = recordTimes.length > 0 ? Math.max(...recordTimes) + 1800 : 0;

          const matchedTasks = imageTasks.filter((item) => {
            const taskId = String(item?.task_id || '').trim();
            if (!taskId || usedTaskIds.has(taskId)) {
              return false;
            }
            const taskModelName = getTaskDtoModelName(item).toLowerCase();
            if (recordModelName && taskModelName && taskModelName !== recordModelName) {
              return false;
            }
            const submitTime = normalizeCreativeTimestampToSeconds(item?.submit_time);
            if (recordStart > 0 && submitTime > 0 && submitTime < recordStart) {
              return false;
            }
            if (recordEnd > 0 && submitTime > 0 && submitTime > recordEnd) {
              return false;
            }
            return true;
          });

          const sortedCandidates = [...group].sort(
            (left, right) => left.sortTimestamp - right.sortTimestamp,
          );

          sortedCandidates.forEach((candidate, index) => {
            const matchedTask = matchedTasks[index];
            if (!matchedTask) {
              return;
            }
            const taskId = String(matchedTask?.task_id || '').trim();
            if (taskId) {
              usedTaskIds.add(taskId);
            }
            taskMatches.set(candidate.imageId, matchedTask);
          });
        });

        for (const candidate of candidates) {
          if (cancelled) {
            break;
          }

          const matchedTask = taskMatches.get(candidate.imageId);
          if (!matchedTask) {
            continue;
          }
          const imageUrls = getTaskDtoImageUrls(matchedTask);
          const primaryImageUrl = imageUrls[0] || '';
          if (!primaryImageUrl) {
            continue;
          }

          const taskPatch = patchImageTaskInHistorySnapshot(
            recoveredSnapshot,
            candidate,
            {
              taskId: String(matchedTask?.task_id || '').trim(),
              url: primaryImageUrl,
              resultUrl: primaryImageUrl,
              status: 'completed',
              progress: 100,
              error: '',
              finalizingAt: 0,
              progressUnavailable: false,
              requestPollable: false,
            },
          );
          if (taskPatch.hasChanged) {
            recoveredSnapshot = taskPatch.snapshot;
            hasRecoveredChanges = true;
          }
        }

        if (!cancelled && hasRecoveredChanges) {
          await persistCreativeHistorySnapshot('image', recoveredSnapshot, {
            applySessionState: true,
          });
        }
      } catch (error) {
        console.error('Failed to reconcile active creative center image session:', error);
      }
    };

    reconcileActiveImageSession();

    return () => {
      cancelled = true;
    };
  }, [activeHistorySnapshot, activeTab, historySnapshots.image, imageRecords, isLoggedIn]);

  useEffect(() => {
    if (
      !isLoggedIn ||
      !historyHydratedRef.current ||
      activeTab !== 'video' ||
      !activeHistorySnapshot
    ) {
      return undefined;
    }

    const reconcileSignature = buildCreativeReconcileSignature(
      activeHistorySnapshot.id,
      videoRecords,
      'video',
    );
    if (reconcileSignature === lastActiveVideoReconcileSignatureRef.current) {
      return undefined;
    }
    lastActiveVideoReconcileSignatureRef.current = reconcileSignature;

    const sessionRecords = normalizeVideoHistoryRecords(activeHistorySnapshot);
    const candidates = sessionRecords
      .flatMap((record) =>
        record.tasks.map((task, taskIndex) => ({
          recordId: record.id,
          taskId: task.id,
          itemIndex: taskIndex,
          queryTaskId: getRecoverableVideoTaskId(task),
          requestId: String(task?.requestId || '').trim(),
          hasMedia: Boolean(getVideoTaskMediaUrl(task)),
          status: normalizeVideoTaskStatus(task.status),
          recordModelName: String(record?.modelName || '').trim().toLowerCase(),
          recordCreatedAt: Number(record?.createdAt) || 0,
          recordUpdatedAt: Number(record?.updatedAt) || 0,
          sortTimestamp:
            Number(task?.submittedAt) ||
            Number(record?.updatedAt) ||
            Number(record?.createdAt) ||
            0,
        })),
      )
      .filter(
        (candidate) =>
          !candidate.hasMedia &&
          !isTerminalVideoTaskStatus(candidate.status) &&
          Boolean(
            candidate.requestId ||
              candidate.queryTaskId ||
              candidate.sortTimestamp ||
              candidate.recordCreatedAt ||
              candidate.recordUpdatedAt,
          ),
      );

    if (candidates.length === 0) {
      return undefined;
    }

    let cancelled = false;

    const reconcileActiveVideoSession = async () => {
      let recoveredSnapshot = normalizeCreativeHistorySnapshot(
        'video',
        historySnapshots.video,
      );
      let hasRecoveredChanges = false;

      try {
        const exactTasks = await fetchCreativeVideoTasksByIdentifiers(candidates);

        if (cancelled) {
          return;
        }

        const nearbyTasks = await fetchCreativeVideoTasksAroundCandidates(candidates);
        const taskMatches = matchCreativeVideoTasksToCandidates(
          candidates,
          mergeCreativeTaskDtoLists(exactTasks, nearbyTasks),
        );

        for (const candidate of candidates) {
          if (cancelled) {
            break;
          }

          let queryTaskId = candidate.queryTaskId;
          const matchedTask = taskMatches.get(candidate.taskId);
          if (matchedTask) {
            const matchedTaskState = parseTaskDtoVideoState(matchedTask);
            queryTaskId = matchedTaskState.taskId || queryTaskId;
            const taskPatch = patchVideoTaskInHistorySnapshot(
              recoveredSnapshot,
              candidate,
              buildResolvedVideoTaskPatch(queryTaskId, matchedTaskState),
            );
            if (taskPatch.hasChanged) {
              recoveredSnapshot = taskPatch.snapshot;
              hasRecoveredChanges = true;
            }
            if (['completed', 'failed'].includes(matchedTaskState.status)) {
              continue;
            }
          }

          if (queryTaskId) {
            const taskIdPatch = patchVideoTaskInHistorySnapshot(
              recoveredSnapshot,
              candidate,
              buildResolvedVideoTaskIdPatch(queryTaskId),
            );
            if (taskIdPatch.hasChanged) {
              recoveredSnapshot = taskIdPatch.snapshot;
              hasRecoveredChanges = true;
            }

            try {
              const response = await API.get(
                `${API_ENDPOINTS.VIDEO_ASYNC_GENERATIONS}/${encodeURIComponent(queryTaskId)}`,
                buildCreativeTaskStatusRequestConfig(),
              );

              if (cancelled) {
                break;
              }

              const nextTaskState = parseVideoFetchPayload(response);
              const nextStatus = normalizeVideoTaskStatus(nextTaskState.status);
              const resolvedURL = nextTaskState.url || '';
              const isFailed = nextStatus === 'failed';
              const isCompleted =
                !isFailed && (nextStatus === 'completed' || Boolean(resolvedURL));

              const taskPatch = patchVideoTaskInHistorySnapshot(
                recoveredSnapshot,
                candidate,
                {
                  taskId: queryTaskId,
                  status: isCompleted ? 'completed' : isFailed ? 'failed' : nextStatus,
                  progress: isCompleted ? 100 : nextTaskState.progress ?? 0,
                  url: isCompleted ? resolvedURL : '',
                  resultUrl: isCompleted ? resolvedURL : '',
                  content: nextTaskState.content || '',
                  error: isFailed ? (nextTaskState.error || '') : '',
                  finalizingAt: 0,
                  requestPollable: false,
                  pollable: Boolean(queryTaskId) && !(isCompleted || isFailed),
                },
              );
              if (taskPatch.hasChanged) {
                recoveredSnapshot = taskPatch.snapshot;
                hasRecoveredChanges = true;
              }
              continue;
            } catch (error) {
              console.error('Failed to reconcile active creative center video task from history:', error);
            }
          }
        }

        if (!cancelled && hasRecoveredChanges) {
          await persistCreativeHistorySnapshot('video', recoveredSnapshot, {
            applySessionState: true,
          });
        }
      } catch (error) {
        console.error('Failed to reconcile active creative center video session:', error);
      }
    };

    reconcileActiveVideoSession();

    return () => {
      cancelled = true;
    };
  }, [activeHistorySnapshot, activeTab, historySnapshots.video, isLoggedIn, videoRecords]);

  const handleSubmit = async () => {
    const currentUploadedImageItems = uploadedImages
      .filter((item) => item?.status === 'uploaded' && item?.url)
      .map((item, index) => normalizeCreativeSourceImageItem(item, index))
      .filter(Boolean)
      .map((item) => ({
        ...item,
        previewUrl: '',
        status: 'uploaded',
      }));
    const uploadedImageUrls = currentUploadedImageItems.map((item) => item.url);
    if ((!prompt.trim() && uploadedImageUrls.length === 0) || (isChatTab && isGenerating)) return;
    if (!isLoggedIn) {
      showWarning('\u8bf7\u5148\u767b\u5f55\u540e\u518d\u4f7f\u7528\u521b\u4f5c\u4e2d\u5fc3');
      window.setTimeout(() => {
        window.location.href = '/login';
      }, 250);
      return;
    }
    const currentPrompt = prompt;
    const currentUploadedImageUrls = uploadedImageUrls;
    const currentUploadedImageSources = currentUploadedImageItems;
    setPrompt('');
    clearUploadedImages();
    if (isChatTab) {
      setIsGenerating(true);
    }

    if (activeTab === 'chat') {
      const userMsg = {
        role: 'user',
        content: buildMessageContent(
          currentPrompt,
          currentUploadedImageUrls,
          currentUploadedImageUrls.length > 0,
        ),
        id: Date.now(),
      };
      const currentChatHistory = Array.isArray(chatMessagesRef.current)
        ? chatMessagesRef.current
        : [];
      const nextUserMessages = [...currentChatHistory, userMsg];
      setChatMessages(nextUserMessages);
      try {
        const requestMessages =
          buildCreativeCenterChatRequestMessages(nextUserMessages);
        const payload = buildApiPayload(
          requestMessages,
          '',
          createCreativeInputs(params, currentModelName, 'chat'),
          PARAMETER_TOGGLES_DISABLED,
        );
        const chatResponse = shouldUseCreativeCenterChatStream(currentModelName)
          ? await postCreativeChatStreamRequest(payload)
          : extractCreativeCenterChatResponse(
              await postCreativeRequest(API_ENDPOINTS.CHAT_COMPLETIONS, payload),
            );
        const processed = processThinkTags(
          chatResponse.content,
          chatResponse.reasoningContent,
        );
        const content =
          [processed.reasoningContent, processed.content].filter(Boolean).join('\n\n') ||
          (chatResponse.rawResponsePreview
            ? `模型已返回响应，但格式未识别，以下是原始响应摘要：\n\n\`\`\`json\n${chatResponse.rawResponsePreview}\n\`\`\``
            : '模型已返回响应，但未解析到可展示内容。');
        const assistantMsg = {
          role: 'assistant',
          content,
          id: Date.now() + 1,
        };
        const nextMessages = [...nextUserMessages, assistantMsg];
        setChatMessages(nextMessages);
        await persistCreativeHistorySnapshot(
          'chat',
          updateCurrentCreativeSessionSnapshot('chat', {
            model_name: currentModelName,
            group: activeGroup,
            prompt: currentPrompt,
            payload: {
              messages: nextMessages,
            },
            updated_at: Date.now(),
          }),
        );
      } catch (error) {
        console.error('Creative center chat error:', error);
        const errorMsg = {
          role: 'assistant',
          content: `请求失败：${error.message || '请稍后再试。'}`,
          id: Date.now() + 1,
        };
        const nextMessages = [...nextUserMessages, errorMsg];
        setChatMessages(nextMessages);
        await persistCreativeHistorySnapshot(
          'chat',
          updateCurrentCreativeSessionSnapshot('chat', {
            model_name: currentModelName,
            group: activeGroup,
            prompt: currentPrompt,
            payload: {
              messages: nextMessages,
            },
            updated_at: Date.now(),
          }),
        );
      }
    } else if (activeTab === 'image') {
      const currentParamsSnapshot = createEffectiveParamsSnapshot(
        'image',
        currentModelName,
        params,
      );
      const useEstimatedImageProgress =
        shouldUseEstimatedImageProgress(currentModelName);
      const generationCount = Number(params.generationCount) || 1;
      const batchSeedBase = createBatchSeedBase();
      const taskRequestMetas = Array.from({ length: generationCount }, (_, index) => ({
        requestSeed: createTaskSeed(batchSeedBase, index),
        requestUser: createTaskRequestUser(batchSeedBase, index),
        requestId: createTaskRequestId(batchSeedBase, index),
      }));
      const recordId = createCreativeRecordId('image');
      const pendingRecord = {
        id: recordId,
        prompt: currentPrompt,
        modelName: currentModelName,
        group: activeGroup,
        params: currentParamsSnapshot,
        sourceImages: currentUploadedImageSources,
        images: Array.from({ length: generationCount }, (_, index) => ({
          id: createCreativeRecordId(`image-task-${index + 1}`),
          taskId: '',
          url: '',
          status: useEstimatedImageProgress ? 'submitted' : 'generating',
          progress: useEstimatedImageProgress ? 3 : 0,
          error: '',
          resultUrl: '',
          requestId: taskRequestMetas[index]?.requestId || '',
          submittedAt: 0,
          estimateStartAt: 0,
          finalizingAt: 0,
          progressUnavailable: false,
          requestPollable: false,
        })),
        status: 'generating',
        error: '',
        total: generationCount,
        completedCount: 0,
        successCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const pendingRecords = [...imageRecordsRef.current, pendingRecord];
      syncImageRecordsState(pendingRecords);
      setCollapsedImageRecordIds((prev) => ({
        ...prev,
        [recordId]: false,
      }));
      persistImageRecords(pendingRecords, {
        modelName: currentModelName,
        prompt: currentPrompt,
        params: pendingRecord.params,
      }).catch((error) => {
        console.error('Failed to persist initial creative center image record:', error);
      });

      try {
        const imageTasks = Array.from({ length: generationCount }, (_, index) =>
          (async () => {
            const taskId = pendingRecord.images[index].id;
            const requestSeed = taskRequestMetas[index]?.requestSeed;
            const requestUser = taskRequestMetas[index]?.requestUser;
            const requestId = taskRequestMetas[index]?.requestId;
            const submittedAt = Date.now();
            const estimateStartAt = submittedAt + index * CREATIVE_BATCH_REQUEST_SPACING_MS;
            const basePayload = createBasePayload(
              currentPrompt,
              currentParamsSnapshot,
              currentModelName,
              'image',
              currentUploadedImageUrls,
            );
            const shouldUseImageEditEndpoint =
              !isAdobeImageModel &&
              (isGrokImageEditModel || currentUploadedImageUrls.length > 0);
            const payload = isAdobeImageModel
              ? {
                  model: currentModelName,
                  group: activeGroup,
                  prompt:
                    currentPrompt ||
                    (currentUploadedImageUrls.length > 0
                      ? 'Edit the provided media.'
                      : ''),
                  output_resolution:
                    basePayload.output_resolution ||
                    currentParamsSnapshot.outputResolution ||
                    '2K',
                  request_id: requestId,
                  seed: requestSeed,
                  seeds: [requestSeed],
                  user: requestUser,
                }
              : {
                  model: currentModelName,
                  group: activeGroup,
                  prompt:
                    shouldUseImageEditEndpoint && !currentPrompt
                      ? 'Edit the provided media.'
                      : currentPrompt,
                  n: 1,
                  response_format: 'url',
                  request_id: requestId,
                  seed: requestSeed,
                  seeds: [requestSeed],
                  user: requestUser,
                };

            if (isAdobeImageModel) {
              if (basePayload.aspect_ratio) {
                payload.aspect_ratio = basePayload.aspect_ratio;
              } else if (basePayload.size) {
                payload.size = basePayload.size;
              }
              if (currentUploadedImageUrls.length > 0) {
                payload.image_urls = currentUploadedImageUrls;
              }
            } else {
              if (!isGrokImageEditModel && basePayload.size) {
                payload.size = basePayload.size;
              }
              if (shouldUseImageEditEndpoint) {
                if (currentUploadedImageUrls.length === 1) {
                  payload.image = currentUploadedImageUrls[0];
                } else if (currentUploadedImageUrls.length > 1) {
                  payload.image = currentUploadedImageUrls;
                }
              } else {
                if (currentUploadedImageUrls[0]) {
                  payload.image = currentUploadedImageUrls[0];
                }
              }
              if (basePayload.extra_body) {
                payload.extra_body = basePayload.extra_body;
              }
              if (basePayload.aspect_ratio) {
                payload.aspect_ratio = basePayload.aspect_ratio;
              }
              if (basePayload.output_resolution) {
                payload.output_resolution = basePayload.output_resolution;
              }
            }

            patchImageTask(recordId, taskId, {
              requestId,
              requestPollable: true,
              submittedAt,
              estimateStartAt,
              finalizingAt: 0,
              status: useEstimatedImageProgress ? 'submitted' : 'generating',
              progress: useEstimatedImageProgress ? 3 : 0,
            });
            await waitForMs(index * CREATIVE_BATCH_REQUEST_SPACING_MS);
            if (useEstimatedImageProgress) {
              patchImageTask(recordId, taskId, {
                status: 'generating',
                progress: 5,
              });
            }
            const imageSubmitEndpoint = isAdobeImageModel
              ? API_ENDPOINTS.IMAGE_ASYNC_GENERATIONS
              : shouldUseImageEditEndpoint
                ? API_ENDPOINTS.IMAGE_ASYNC_EDITS
                : API_ENDPOINTS.IMAGE_ASYNC_GENERATIONS;
            const data = await postCreativeRequest(
              imageSubmitEndpoint,
              payload,
              {
                'X-Request-Id': requestId,
              },
            );
            const remoteTaskId = data?.task_id || data?.id || '';
            const nextTaskState = parseImageFetchPayload(data);
            const imageUrl = nextTaskState.url || '';
            const isSubmitFailed = nextTaskState.status === 'failed';
            const imageUrls = imageUrl ? [imageUrl] : [];

            if (useEstimatedImageProgress && imageUrls[0]) {
              patchImageTask(recordId, taskId, {
                status: 'finalizing',
                progress: 96,
                resultUrl: imageUrls[0],
                finalizingAt: Date.now(),
                error: '',
                requestPollable: false,
              });
              await waitForMs(180);
            }
            patchImageTask(recordId, taskId, {
              taskId: remoteTaskId,
              url: imageUrls[0] || '',
              status: imageUrls[0]
                ? 'completed'
                : isSubmitFailed
                  ? 'failed'
                  : normalizeVideoTaskStatus(nextTaskState.status),
              progress:
                imageUrls[0] || isSubmitFailed
                  ? 100
                  : nextTaskState.progress ?? (useEstimatedImageProgress ? 5 : 0),
              error: isSubmitFailed ? nextTaskState.error || 'image generation failed' : '',
              resultUrl: imageUrls[0] || '',
              finalizingAt: 0,
              progressUnavailable: false,
              requestPollable: Boolean(remoteTaskId) && !(imageUrls[0] || isSubmitFailed),
            });
          })()
            .catch((requestError) => {
              const requestErrorMessage =
                getCreativeRequestErrorMessage(requestError);
              const isRecoverableRequestError =
                shouldTreatCreativeRequestErrorAsRecoverable(requestError);
              patchImageTask(recordId, pendingRecord.images[index].id, {
                status: isRecoverableRequestError ? 'submitted' : 'failed',
                progress: isRecoverableRequestError ? 0 : 100,
                finalizingAt: 0,
                error: requestErrorMessage,
                progressUnavailable: false,
                requestPollable: isRecoverableRequestError,
              });
            }),
        );
        await Promise.allSettled(imageTasks);

        await persistImageRecords(imageRecordsRef.current, {
          modelName: currentModelName,
          prompt: currentPrompt,
          params: pendingRecord.params,
        });
      } catch (error) {
        console.error('Creative center image error:', error);
        const failedRecord = {
          ...pendingRecord,
          status: 'failed',
          error: `生成失败：${error.message || '请稍后再试。'}`,
          updatedAt: Date.now(),
        };
        const failedRecords = pendingRecords.map((record) =>
          record.id === recordId ? failedRecord : record,
        );
        setImageRecords(failedRecords);
        await persistImageRecords(failedRecords, {
          modelName: currentModelName,
          prompt: currentPrompt,
          params: failedRecord.params,
        });
      }
    } else if (activeTab === 'video') {
      const currentParamsSnapshot = createEffectiveParamsSnapshot(
        'video',
        currentModelName,
        params,
      );
      const useEstimatedVideoProgress =
        shouldUseEstimatedVideoProgress(currentModelName);
      const generationCount = Number(params.generationCount) || 1;
      const batchSeedBase = createBatchSeedBase();
      const taskRequestMetas = Array.from({ length: generationCount }, (_, index) => ({
        requestSeed: createTaskSeed(batchSeedBase, index),
        requestUser: createTaskRequestUser(batchSeedBase, index),
        requestId: createTaskRequestId(batchSeedBase, index),
      }));
      const recordId = createCreativeRecordId('video');
      const pendingRecord = {
        id: recordId,
        prompt: currentPrompt,
        modelName: currentModelName,
        group: activeGroup,
        params: currentParamsSnapshot,
        sourceImages: currentUploadedImageSources,
        tasks: Array.from({ length: generationCount }, (_, index) => ({
          id: createCreativeRecordId(`video-task-${index + 1}`),
          taskId: '',
          status: useEstimatedVideoProgress ? 'submitted' : 'generating',
          url: '',
          content: '',
          progress: useEstimatedVideoProgress ? 3 : 0,
          error: '',
          resultUrl: '',
          resultContent: '',
          requestId: taskRequestMetas[index]?.requestId || '',
          submittedAt: 0,
          estimateStartAt: 0,
          finalizingAt: 0,
          progressUnavailable: false,
          requestPollable: false,
          pollable: false,
        })),
        status: 'generating',
        error: '',
        total: generationCount,
        completedCount: 0,
        successCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const pendingRecords = [...videoRecordsRef.current, pendingRecord];
      syncVideoRecordsState(pendingRecords);
      setCollapsedVideoRecordIds((prev) => ({
        ...prev,
        [recordId]: false,
      }));
      persistVideoRecords(pendingRecords, {
        modelName: currentModelName,
        prompt: currentPrompt,
        params: pendingRecord.params,
      }).catch((error) => {
        console.error('Failed to persist initial creative center video record:', error);
      });

      try {
        const videoRequests = Array.from({ length: generationCount }, (_, index) =>
          (async () => {
            const localTaskId = pendingRecord.tasks[index].id;
            const requestSeed = taskRequestMetas[index]?.requestSeed;
            const requestUser = taskRequestMetas[index]?.requestUser;
            const requestId = taskRequestMetas[index]?.requestId;
            const submittedAt = Date.now();
            const estimateStartAt = submittedAt + index * CREATIVE_BATCH_REQUEST_SPACING_MS;
            const basePayload = createBasePayload(
              currentPrompt,
              currentParamsSnapshot,
              currentModelName,
              'video',
              currentUploadedImageUrls,
            );
            let data;

            if (isChatCompletionVideoModel) {
              basePayload.seed = requestSeed;
              basePayload.seeds = [requestSeed];
              basePayload.user = requestUser;
              basePayload.request_id = requestId;
              basePayload.metadata = {
                creative_request_id: requestUser,
                creative_seed: requestSeed,
                creative_index: index + 1,
              };
              patchVideoTask(recordId, localTaskId, {
                requestId,
                requestPollable: true,
                submittedAt,
                estimateStartAt,
                finalizingAt: 0,
                status: useEstimatedVideoProgress ? 'submitted' : 'generating',
                progress: useEstimatedVideoProgress ? 3 : 0,
              });
              await waitForMs(index * CREATIVE_BATCH_REQUEST_SPACING_MS);
              if (useEstimatedVideoProgress) {
                patchVideoTask(recordId, localTaskId, {
                  status: 'generating',
                  progress: 5,
                });
              }
              data = await postCreativeRequest(
                API_ENDPOINTS.CHAT_COMPLETIONS,
                basePayload,
                {
                  'X-Request-Id': requestId,
                },
              );
              const content = data?.choices?.[0]?.message?.content || '';
              const videoUrl = extractVideoUrlFromMessage(content);
              if (useEstimatedVideoProgress && videoUrl) {
                patchVideoTask(recordId, localTaskId, {
                  taskId: data?.id || '',
                  status: 'finalizing',
                  content: '',
                  progress: 96,
                  error: '',
                  resultUrl: videoUrl,
                  resultContent: content,
                  requestId,
                  finalizingAt: Date.now(),
                  progressUnavailable: false,
                  requestPollable: false,
                  pollable: false,
                });
                await waitForMs(180);
              }
              patchVideoTask(recordId, localTaskId, {
                taskId: data?.id || '',
                status: videoUrl ? 'completed' : 'failed',
                url: videoUrl || '',
                content: videoUrl ? '' : content,
                progress: 100,
                error: videoUrl ? '' : '未获取到视频结果',
                resultUrl: videoUrl || '',
                resultContent: content,
                requestId,
                finalizingAt: 0,
                progressUnavailable: false,
                requestPollable: false,
                pollable: false,
              });
              return;
            }

            const payload = isAdobeSoraModel
              ? {
                  model: currentModelName,
                  prompt: currentPrompt,
                  async: true,
                  request_id: requestId,
                  seed: requestSeed,
                  seeds: [requestSeed],
                  user: requestUser,
                  metadata: {
                    creative_request_id: requestUser,
                    creative_seed: requestSeed,
                    creative_index: index + 1,
                  },
                }
              : {
                  model: currentModelName,
                  group: activeGroup,
                  prompt: currentPrompt,
                  request_id: requestId,
                  seed: requestSeed,
                  seeds: [requestSeed],
                  user: requestUser,
                  metadata: {
                    creative_request_id: requestUser,
                    creative_seed: requestSeed,
                    creative_index: index + 1,
                  },
                };
            [
              'size',
              'seconds',
              'quality',
              'preset',
              'resolution_name',
              'video_config',
              'duration',
              'aspect_ratio',
              'resolution',
              'reference_mode',
            ].forEach((key) => {
              if (basePayload[key] !== undefined) {
                payload[key] = basePayload[key];
              }
            });
            if (isAdobeSoraModel && currentUploadedImageUrls[0]) {
              payload.image_url = currentUploadedImageUrls[0];
            } else if (
              currentModelName === 'grok-imagine-1.0-video' &&
              currentUploadedImageUrls.length > 0
            ) {
              payload.image_reference = currentUploadedImageUrls;
            } else if (currentUploadedImageUrls[0]) {
              payload.image = currentUploadedImageUrls[0];
            }
            patchVideoTask(recordId, localTaskId, {
              requestId,
              requestPollable: true,
              submittedAt,
              estimateStartAt,
              finalizingAt: 0,
              status: useEstimatedVideoProgress ? 'submitted' : 'generating',
              progress: useEstimatedVideoProgress ? 3 : 0,
            });
            await waitForMs(index * CREATIVE_BATCH_REQUEST_SPACING_MS);
            if (useEstimatedVideoProgress) {
              patchVideoTask(recordId, localTaskId, {
                status: 'generating',
                progress: 5,
              });
            }
            data = await postCreativeRequest(API_ENDPOINTS.VIDEO_ASYNC_GENERATIONS, payload, {
              'X-Request-Id': requestId,
            });
            const submitPayload =
              data?.data && typeof data.data === 'object' ? data.data : data;
            const immediateResultUrl =
              normalizeVideoMediaUrl(submitPayload?.url) ||
              normalizeVideoMediaUrl(submitPayload?.video_url) ||
              normalizeVideoMediaUrl(submitPayload?.data?.[0]?.url) ||
              normalizeVideoMediaUrl(submitPayload?.data?.[0]?.video_url) ||
              normalizeVideoMediaUrl(submitPayload?.result_url);
            const normalizedStatus = normalizeVideoTaskStatus(
              submitPayload?.status ||
                (immediateResultUrl ? 'completed' : 'submitted'),
            );
            const isImmediateFailed = normalizedStatus === 'failed';
            const isImmediateCompleted = !isImmediateFailed && Boolean(immediateResultUrl);
            if (useEstimatedVideoProgress && isImmediateCompleted) {
              patchVideoTask(recordId, localTaskId, {
                taskId: submitPayload?.task_id || submitPayload?.id || '',
                status: 'finalizing',
                url: '',
                content: submitPayload?.message || '',
                progress: 96,
                error: '',
                resultUrl: immediateResultUrl || '',
                requestId,
                finalizingAt: Date.now(),
                progressUnavailable: false,
                requestPollable: false,
                pollable: false,
              });
              await waitForMs(180);
            }
            patchVideoTask(recordId, localTaskId, {
              taskId: submitPayload?.task_id || submitPayload?.id || '',
              status: isImmediateCompleted ? 'completed' : normalizedStatus,
              url: isImmediateCompleted ? immediateResultUrl : '',
              content: submitPayload?.message || '',
              progress:
                isImmediateCompleted || isImmediateFailed
                  ? 100
                  : parseProgressValue(submitPayload?.progress) ?? 0,
              error: isImmediateFailed
                ? submitPayload?.error?.message ||
                  submitPayload?.fail_reason ||
                  submitPayload?.message ||
                  '浠诲姟鐢熸垚澶辫触'
                : '',
              resultUrl: isImmediateCompleted ? immediateResultUrl : '',
              requestId,
              finalizingAt: 0,
              progressUnavailable: false,
              requestPollable:
                !isImmediateCompleted &&
                !isImmediateFailed &&
                !Boolean(submitPayload?.task_id || submitPayload?.id) &&
                Boolean(requestId),
              pollable:
                !isImmediateCompleted &&
                !isImmediateFailed &&
                Boolean(
                  submitPayload?.task_id || submitPayload?.id || requestId,
                ),
            });
          })()
            .catch((requestError) => {
              const requestErrorMessage =
                getCreativeRequestErrorMessage(requestError);
              const isRecoverableRequestError =
                shouldTreatCreativeRequestErrorAsRecoverable(requestError);
              patchVideoTask(recordId, pendingRecord.tasks[index].id, {
                status: isRecoverableRequestError ? 'submitted' : 'failed',
                url: '',
                progress: isRecoverableRequestError ? 0 : 100,
                finalizingAt: 0,
                progressUnavailable: false,
                requestPollable: isRecoverableRequestError,
                content: requestErrorMessage,
                error: requestErrorMessage,
                pollable: isRecoverableRequestError,
              });
            }),
        );

        await Promise.allSettled(videoRequests);

        await persistVideoRecords(videoRecordsRef.current, {
          modelName: currentModelName,
          prompt: currentPrompt,
          params: pendingRecord.params,
        });
      } catch (error) {
        console.error('Creative center video error:', error);
        const failedRecord = {
          ...pendingRecord,
          status: 'failed',
          error: `生成失败：${error.message || '请稍后再试。'}`,
          updatedAt: Date.now(),
        };
        const failedRecords = pendingRecords.map((record) =>
          record.id === recordId ? failedRecord : record,
        );
        setVideoRecords(failedRecords);
        await persistVideoRecords(failedRecords, {
          modelName: currentModelName,
          prompt: currentPrompt,
          params: failedRecord.params,
        });
      }
    }
    if (isChatTab) {
      setIsGenerating(false);
    }
  };

  if (isCreativeCenterBootstrapping) {
    return (
      <div className='relative mt-16 flex h-[calc(100svh-64px)] min-h-[calc(100svh-64px)] w-full flex-col overflow-hidden bg-[#f0f5ff] bg-gradient-to-br from-[#eaf2ff] via-white to-[#f0f5ff] lg:h-[calc(100vh-64px)] lg:min-h-[calc(100vh-64px)] lg:flex-row'>
        <div className='absolute inset-0 z-0 overflow-hidden pointer-events-none'>
          <div className='absolute -top-[20%] -left-[10%] h-[50%] w-[50%] rounded-full bg-blue-400/10 blur-[120px]' />
          <div className='absolute top-[40%] -right-[10%] h-[60%] w-[40%] rounded-full bg-sky-300/10 blur-[150px]' />
        </div>

        <aside className='relative z-10 flex w-full shrink-0 flex-col border-b border-slate-200/50 bg-white/70 backdrop-blur-3xl shadow-[0_4px_24px_-18px_rgba(0,0,0,0.16)] lg:h-full lg:w-[320px] lg:border-b-0 lg:border-r lg:shadow-[4px_0_24px_-16px_rgba(0,0,0,0.05)]'>
          <div className='space-y-4 p-4 lg:space-y-5 lg:p-7 lg:pt-9'>
            <div className='h-8 w-36 animate-pulse rounded-2xl bg-blue-100/80 lg:h-10 lg:w-44' />
            <div className='flex gap-3 lg:gap-4'>
              <div className='h-20 flex-1 animate-pulse rounded-[1.5rem] bg-white/80' />
              <div className='h-20 flex-1 animate-pulse rounded-[1.5rem] bg-white/70' />
            </div>
          </div>
          <div className='flex gap-3 overflow-hidden px-4 py-3 lg:block lg:space-y-4 lg:px-5 lg:py-6'>
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className='h-20 w-48 shrink-0 animate-pulse rounded-[1.5rem] border border-slate-200/50 bg-white/65 lg:h-24 lg:w-full'
              />
            ))}
          </div>
          <div className='hidden p-5 lg:mt-auto lg:block'>
            <div className='h-14 animate-pulse rounded-[1.25rem] bg-blue-200/70' />
          </div>
        </aside>

        <div className='relative z-10 flex min-w-0 flex-1 flex-col'>
          <div className='flex-1 px-8 py-10'>
            <div className='mx-auto max-w-4xl space-y-6'>
              <div className='h-28 animate-pulse rounded-[2rem] bg-white/70 shadow-[0_20px_60px_rgba(59,130,246,0.08)]' />
              <div className='h-[420px] animate-pulse rounded-[2.5rem] bg-white/55 shadow-[0_20px_60px_rgba(59,130,246,0.06)]' />
            </div>
          </div>
          <div className='px-4 pb-8 pt-6 md:px-8'>
            <div className='mx-auto max-w-4xl'>
              <div className='h-44 animate-pulse rounded-[2.5rem] bg-white/60 shadow-[0_20px_40px_-5px_rgba(0,0,0,0.05)]' />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='relative mt-16 flex h-[calc(100svh-64px)] min-h-[calc(100svh-64px)] w-full flex-col overflow-hidden bg-[#f0f5ff] bg-gradient-to-br from-[#eaf2ff] via-white to-[#f0f5ff] font-sans text-slate-800 selection:bg-blue-500/20 selection:text-blue-900 lg:h-[calc(100vh-64px)] lg:min-h-[calc(100vh-64px)] lg:flex-row'>
      {/* 动态背景光效 */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-400/10 blur-[120px]" />
        <div className="absolute top-[40%] -right-[10%] w-[40%] h-[60%] rounded-full bg-sky-300/10 blur-[150px]" />
      </div>
      <aside className='relative z-10 flex w-full shrink-0 flex-col border-b border-slate-200/50 bg-white/75 shadow-[0_4px_24px_-18px_rgba(0,0,0,0.18)] backdrop-blur-3xl lg:h-full lg:w-[320px] lg:border-b-0 lg:border-r lg:shadow-[4px_0_24px_-16px_rgba(0,0,0,0.05)]'>
        <div className='hidden shrink-0 items-center justify-center p-7 pb-6 pt-9 lg:flex'>
          <h1 className='bg-gradient-to-br from-blue-700 via-sky-500 to-blue-500 bg-clip-text text-[28px] font-black tracking-[0.2em] text-transparent drop-shadow-md'>
            释放你的创造力
          </h1>
        </div>

        <nav className='flex shrink-0 gap-1 border-b border-slate-200/50 px-2 py-2 lg:justify-around lg:gap-0 lg:px-5 lg:pb-5 lg:pt-0'>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setOpenMenu(null);
                }}
                className={`group relative flex min-w-0 flex-1 flex-row items-center justify-center gap-1.5 rounded-full px-2 py-1.5 transition-all duration-500 lg:flex-col lg:gap-2.5 lg:rounded-none lg:px-0 lg:py-0 ${active ? 'scale-[1.02] bg-white/85 text-slate-900 shadow-sm lg:scale-105 lg:bg-transparent lg:shadow-none' : 'text-slate-500 hover:bg-white/55 hover:text-slate-700 lg:hover:-translate-y-0.5 lg:hover:bg-transparent'}`}
              >
                <div className={`rounded-[0.8rem] p-1.5 transition-all duration-500 lg:rounded-[1rem] lg:p-3 ${active ? 'bg-gradient-to-br from-blue-500 to-sky-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.4)] ring-1 ring-black/5' : 'bg-white/40 text-slate-500 group-hover:bg-white/80 group-hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)]'}`}>
                  <Icon size={22} className='h-[18px] w-[18px] lg:h-[22px] lg:w-[22px]' strokeWidth={active ? 2.5 : 2} />
                </div>
                <span className={`text-[12px] font-bold transition-all ${active ? 'text-indigo-700' : 'text-slate-500'}`}>{tab.label}</span>
                {tab.badge && <span className='absolute -right-1 -top-1 rounded-full border border-white/20 bg-gradient-to-r from-orange-500 to-pink-500 px-1.5 py-0.5 text-[8px] font-black text-white shadow-lg shadow-orange-500/30 lg:-right-2 lg:-top-1.5 lg:px-2 lg:text-[9px]'>{tab.badge}</span>}
                {active && <div className="absolute -bottom-5 hidden h-[3px] w-1/2 rounded-t-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] lg:block" />}
              </button>
            );
          })}
        </nav>

        <div className='shrink-0 border-b border-slate-200/50 px-2 py-2 lg:px-6 lg:py-5'>
          <div className='relative flex flex-nowrap items-center gap-2 lg:flex-wrap lg:gap-3'>
            <button
              type='button'
              onClick={() => setIsSessionPanelOpen((prev) => !prev)}
              disabled={isSubmitPending}
              className={
                'inline-flex min-w-0 flex-1 justify-center items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/60 backdrop-blur-md px-2.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all duration-300 hover:border-blue-400/50 hover:bg-blue-50 hover:text-blue-600 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm lg:gap-2 lg:rounded-2xl lg:px-4 lg:py-2.5 ' +
                (isSessionPanelOpen ? 'bg-blue-50 border-blue-300 text-indigo-700' : '')
              }
            >
              <History size={16} />
              历史会话
            </button>
            <button
              type='button'
              onClick={() => createCreativeSession(activeTab)}
              disabled={isSubmitPending}
              className='inline-flex min-w-0 flex-1 justify-center items-center gap-1.5 rounded-xl border border-slate-200/80 bg-gradient-to-b from-white/90 to-white/60 px-2.5 py-2 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur-md transition-all duration-300 hover:border-purple-300 hover:from-purple-50 hover:to-white/80 hover:text-purple-700 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm lg:gap-2 lg:rounded-2xl lg:px-4 lg:py-2.5 group'
            >
              <Plus size={16} className="transition-transform duration-300 group-hover:rotate-90" />
              新建会话
            </button>

            {isSessionPanelOpen && (
              <div className='absolute left-0 right-0 top-[2.75rem] z-30 overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white/95 p-3 shadow-xl backdrop-blur-3xl lg:top-[3.5rem] lg:rounded-[1.75rem] lg:p-4'>
                <div className='absolute inset-0 bg-gradient-to-b from-blue-50/50 to-transparent pointer-events-none' />
                <div className='relative mb-4 px-2'>
                  <div className='text-sm font-black text-slate-900'>历史会话</div>
                  <div className='text-[11px] text-slate-500 mt-0.5'>仅删除会话，图片视频资源仍保留</div>
                </div>
                <div className='relative max-h-[min(420px,48svh)] space-y-2 overflow-y-auto pr-1 custom-scrollbar'>
                  {currentTabSessions
                    .slice()
                    .sort(
                      (left, right) =>
                        Number(right?.updated_at || 0) - Number(left?.updated_at || 0),
                    )
                    .map((session) => {
                      const isCurrentSession =
                        session.id === currentTabHistorySnapshot?.payload?.current_session_id;
                      const sessionTime = formatCreativeRecordTime(session.updated_at);
                      return (
                        <div
                          key={session.id}
                          className={`group rounded-2xl border px-4 py-3.5 transition-all duration-300 ${
                            isCurrentSession
                              ? 'border-blue-300 bg-blue-50/80 shadow-sm'
                              : 'border-slate-200/50 bg-white/40 hover:bg-white/80 hover:border-slate-300'
                          }`}
                        >
                          <button
                            type='button'
                            onClick={() => openCreativeSession(activeTab, session.id)}
                            disabled={isSubmitPending}
                            className='min-w-0 w-full text-left disabled:cursor-not-allowed'
                          >
                            <div className={`truncate text-[15px] font-bold ${isCurrentSession ? 'text-indigo-700' : 'text-slate-800'}`}>
                              {session.name || '未命名会话'}
                            </div>
                            <div className='mt-1.5 truncate text-[11px] text-slate-500'>
                              {formatCreativeSessionMeta(activeTab, session)}
                              {sessionTime ? <span className='text-slate-400'> · {sessionTime}</span> : ''}
                            </div>
                          </button>
                          <div className='mt-4 flex items-center justify-end gap-2'>
                            <button
                              type='button'
                              onClick={() => renameCreativeSession(activeTab, session.id)}
                              disabled={isSubmitPending}
                              className='rounded-full border border-slate-200 px-3.5 py-1.5 text-[11px] font-bold text-slate-500 transition-all hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50'
                            >
                              重命名
                            </button>
                            <div className="group/del relative">
                              <button
                                type='button'
                                onClick={() => deleteCreativeSession(activeTab, session.id)}
                                disabled={isSubmitPending}
                                className='rounded-full border border-slate-200 p-1.5 text-slate-500 transition-all hover:border-red-300 hover:bg-red-50 hover:text-red-500'
                              >
                                <Trash2 size={14} />
                              </button>
                              <div className='pointer-events-none absolute bottom-[110%] right-0 mb-1 hidden w-max rounded-lg border border-white/40 bg-white/95 px-2 py-1 text-[10px] font-bold text-slate-700 shadow-lg backdrop-blur-xl group-hover/del:block animate-in fade-in slide-in-from-bottom-0.5'>
                                只保留资源不删会话
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

        </div>

        <div className='relative flex shrink-0 gap-2 overflow-x-auto px-2 py-2 custom-scrollbar custom-dark-scrollbar lg:block lg:min-h-0 lg:flex-1 lg:space-y-3 lg:overflow-y-auto lg:px-5 lg:py-6'>
          <div className='hidden px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600/80 lg:mb-4 lg:flex lg:items-center lg:gap-2'>
            <div className="h-[1px] w-4 bg-blue-500/30"></div>
            核心创作模型
          </div>
          {currentDisplayModels.map((model) => (
            <button
              key={model.id}
              onClick={() => setActiveModel(model.id)}
              onMouseEnter={() => setHoveredSidebarModelId(model.id)}
              onMouseLeave={() => setHoveredSidebarModelId((currentId) => (currentId === model.id ? '' : currentId))}
              className={`relative flex w-[176px] shrink-0 items-center gap-2 rounded-[1rem] border p-2 text-left transition-all duration-500 backdrop-blur-sm lg:w-full lg:items-start lg:gap-4 lg:rounded-[1.25rem] lg:p-4 ${
                activeModel === model.id ? 'border-blue-400/50 bg-blue-50/60 shadow-[0_0_20px_rgba(59,130,246,0.1)] ring-1 ring-blue-300 lg:translate-x-1' : 'border-slate-200/50 bg-white/40 hover:bg-white/80 hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] transition-all duration-500 lg:mt-0.5 lg:h-11 lg:w-11 lg:rounded-[14px] ${activeModel === model.id ? 'bg-gradient-to-br from-blue-500 to-sky-500 shadow-sm text-white lg:rotate-3 lg:scale-110' : 'bg-slate-100 text-slate-500 border border-slate-200 group-hover:bg-white/80 group-hover:text-blue-600 group-hover:border-blue-300 lg:group-hover:-rotate-3 group-hover:shadow-sm'}`}>
                {model.icon}
              </div>
              <div className='flex min-w-0 flex-1 flex-col items-start pr-1 lg:pr-2'>
                <div className={`w-full truncate text-[13px] font-black transition-colors lg:text-[14px] ${activeModel === model.id ? 'text-slate-900' : 'text-slate-700 group-hover:text-slate-900'}`}>{model.name}</div>
                <p className={`hidden text-[11px] leading-relaxed transition-colors lg:mt-0.5 lg:line-clamp-1 lg:block ${activeModel === model.id ? 'text-indigo-700/80' : 'text-slate-500 group-hover:text-slate-600'}`}>{model.desc}</p>
                {model.priceLabel ? (
                  <div
                    className={`mt-1 shrink-0 rounded-[6px] px-1.5 py-0.5 text-[9px] font-black tracking-wide transition-all lg:mt-1.5 lg:px-2 lg:text-[10px] ${
                      activeModel === model.id
                        ? 'bg-gradient-to-r from-blue-100 to-blue-50 text-blue-700 border border-blue-200/50 shadow-sm'
                        : 'bg-white/80 text-slate-500 border border-slate-200/80 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-200'
                    }`}
                  >
                    {model.priceLabel}
                  </div>
                ) : null}
              </div>
            </button>
          ))}

        </div>
        
        <div className='mt-auto hidden shrink-0 border-t border-slate-200/50 bg-white/40 p-5 backdrop-blur-md lg:block'>
          <button 
            onClick={() => window.location.href = '/console/assets'} 
            className="flex w-full items-center justify-center gap-3 rounded-[1.25rem] bg-gradient-to-br from-blue-500 to-sky-500 px-4 py-3.5 text-[14px] font-black tracking-[0.15em] text-white shadow-[0_8px_20px_rgba(59,130,246,0.2)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_12px_25px_rgba(59,130,246,0.3)] hover:brightness-110 active:scale-[0.98]"
          >
            <Wallet size={18} />
            查看资产库
          </button>
        </div>

        {hoveredSidebarModel ? (
          <div className='pointer-events-none absolute left-[105%] top-32 z-[100] hidden min-w-[340px] max-w-[450px] lg:block animate-in fade-in slide-in-from-left-4 duration-500 zoom-in-95'>
            <div className='relative overflow-hidden rounded-[2.5rem] border border-blue-100 bg-white/95 p-7 shadow-[0_40px_100px_-20px_rgba(59,130,246,0.25)] backdrop-blur-3xl'>
              <div className='absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_at_top_left,rgba(59,130,246,0.15),transparent_75%)]' />
              <div className='relative'>
                <div className='mb-6 flex items-center gap-5'>
                  <div className='flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.25rem] bg-gradient-to-br from-blue-500 to-sky-400 text-white shadow-xl shadow-blue-500/30 ring-1 ring-blue-400/50'>
                    {hoveredSidebarModel.icon}
                  </div>
                  <div className='text-[20px] font-black tracking-tight text-slate-900 drop-shadow-sm leading-tight whitespace-nowrap shrink-0'>
                    {hoveredSidebarModel.name}
                  </div>
                </div>
                <div className='relative rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50/30 to-white/60 p-6 text-[14.5px] font-medium leading-loose text-slate-600 shadow-inner'>
                  {hoveredSidebarModel.fullDesc || hoveredSidebarModel.desc || '暂无详细简介'}
                </div>
              </div>
            </div>
          </div>
        ) : null}

      </aside>

      <main className='relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-100/40 backdrop-blur-xl'>
        {activeTab === 'chat' && (
          <div className='flex flex-1 min-h-0 flex-col overflow-hidden'>
            <div
              ref={scrollRef}
              className='min-h-0 flex-1 overflow-y-auto px-3 pb-6 pt-4 sm:px-4 md:px-8 md:pb-10 md:pt-6 xl:px-12 custom-scrollbar'
            >
              <div className='mx-auto flex w-full max-w-[1180px] flex-col gap-6'>
              {chatMessages.length === 0 && !isGenerating && (
                <div className='flex min-h-full items-center justify-center py-5 sm:py-8'>
                  <div className='relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-blue-100/50 bg-white/70 px-6 py-9 text-center shadow-[0_0_50px_rgba(59,130,246,0.05)] backdrop-blur-3xl transition-all hover:bg-white/90 hover:shadow-[0_20px_80px_rgba(59,130,246,0.1)] sm:rounded-[3rem] sm:px-12 sm:py-16'>
                    <div className='absolute inset-0 bg-gradient-to-b from-blue-50/50 to-transparent pointer-events-none' />
                    <div className='relative mx-auto mb-6 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[1.5rem] bg-gradient-to-br from-blue-500 to-blue-400 text-white shadow-xl shadow-blue-500/20 ring-1 ring-blue-400 sm:mb-8 sm:h-24 sm:w-24 sm:rounded-[1.75rem]'>
                      {selectedModel?.icon || <MessageSquare size={40} />}
                    </div>
                    <div className='relative text-[11px] font-black uppercase tracking-[0.3em] text-blue-500 flex items-center justify-center gap-3'>
                      <div className="h-[2px] w-6 rounded-full bg-blue-500/30" />
                      当前模型
                      <div className="h-[2px] w-6 rounded-full bg-blue-500/30" />
                    </div>
                    <h3 className='relative mt-5 text-2xl font-black tracking-tight text-slate-900 drop-shadow-sm sm:mt-6 sm:text-4xl'>
                      {selectedModel?.name || '对话模型'}
                    </h3>
                    <p className='relative mt-6 text-[15px] leading-relaxed text-slate-500 font-medium'>
                      {selectedModel?.desc || '这里会显示当前对话模型的介绍，帮助你在开始前快速了解它适合做什么。'}
                    </p>
                  </div>
                </div>
              )}
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex w-full ${
                    msg.role === 'user'
                      ? 'justify-end md:pl-20 lg:pl-32'
                      : 'justify-start md:pr-20 lg:pr-32'
                  }`}
                >
                  <div className={`rounded-[1.75rem] px-6 py-4 shadow-sm transition-all border ${
                    msg.role === 'user'
                      ? 'w-auto max-w-[440px] md:max-w-[520px] bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-tr-sm border-blue-400/30 shadow-blue-500/10 text-[15px]'
                      : 'w-full max-w-[720px] xl:max-w-[780px] bg-white border-slate-200/50 text-slate-800 rounded-tl-sm shadow-black/5 text-[15px]'
                  }`}>
                    {getMessageImages(msg.content).length > 0 && (
                      <div className='mb-3 grid grid-cols-1 gap-2'>
                        {getMessageImages(msg.content).map((imageUrl, index) => (
                          <img
                            key={`${msg.id}-image-${index}`}
                            src={imageUrl}
                            alt={`uploaded-${index + 1}`}
                            className='max-h-56 rounded-2xl border border-slate-200 object-cover'
                          />
                        ))}
                      </div>
                    )}
                    {getMessageText(msg.content) ? (
                      <p className='text-[15px] leading-relaxed whitespace-pre-wrap'>
                        {getMessageText(msg.content)}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
              {isGenerating && (
                <div className='flex w-full justify-start md:pr-20 lg:pr-32 animate-in slide-in-from-bottom-4 duration-500'>
                  <div className='bg-white border border-slate-200/50 rounded-[1.75rem] rounded-tl-sm px-6 py-4 flex gap-4 items-center text-slate-500 shadow-sm shadow-black/5'>
                    <Loader2 size={20} className='animate-spin text-blue-500' />
                    <span className='text-[13px] font-black tracking-[0.1em] uppercase text-blue-500'>正在深度思考...</span>
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
        )}

        {activeTab !== 'chat' && (
          <div ref={scrollRef} className='relative min-h-0 flex-1 overflow-y-auto px-3 pb-6 pt-3 sm:px-5 lg:px-10 lg:pb-10 lg:pt-4 custom-scrollbar'>
            {activeTab === 'image' && imageRecords.length > 0 ? (
              <div className='mx-auto flex w-full max-w-6xl flex-col gap-8'>
                <div className='space-y-10'>
                  {imageRecords.map((record, recordIndex) => {
                    const recordModel = findModelCard('image', record.modelName);
                    const metaSummary = formatImageRecordSummary(record);
                    const completedImageItems = getCompletedImageItems(record);
                    const selectedImageItems = getSelectedImageItems(record);
                    const selectedImageIdSet = new Set(selectedImageTaskIds[record.id] || []);
                    const isImageRecordCollapsed = collapsedImageRecordIds[record.id] ?? false;
                    const recordTime = formatCreativeRecordTime(
                      record.updatedAt || record.createdAt,
                    );

                    return (
                      <article
                        key={record.id || `image-record-${recordIndex}`}
                        className='space-y-4'
                        style={{ contentVisibility: 'auto', containIntrinsicSize: '960px' }}
                      >
                        <div className='flex items-start gap-3 sm:gap-4'>
                          <div className='hidden h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] border border-blue-200 bg-blue-50 text-blue-600 shadow-sm backdrop-blur-sm sm:flex'>
                            {recordModel?.icon || <ImageIcon size={22} />}
                          </div>
                          <div className='min-w-0 flex-1 group'>
                            <div className='rounded-[1.35rem] border border-slate-200/50 bg-white/60 px-4 py-3.5 shadow-sm backdrop-blur-xl transition-all duration-300 group-hover:border-slate-200 group-hover:bg-white/90 group-hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] sm:rounded-[1.75rem] sm:px-5 sm:py-4'>
                              <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4'>
                                <button
                                  onClick={() => toggleImageRecordCollapsed(record.id)}
                                  className='min-w-0 flex-1 text-left'
                                >
                                  <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4'>
                                    <div className='min-w-0'>
                                      <p className='text-[15px] font-bold leading-7 text-slate-800 whitespace-pre-wrap transition-colors group-hover:text-slate-900'>
                                        {record.prompt || '未填写提示词'}
                                      </p>
                                      <div className='mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500'>
                                        <span>{record.modelName || '图片模型'}</span>
                                        {metaSummary ? <span>{metaSummary}</span> : null}
                                        {record.total > 0 ? (
                                          <span>
                                            {record.completedCount || 0} / {record.total} 已完成
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>
                                    <div className='flex shrink-0 items-center gap-3 text-xs text-slate-500 sm:pl-3'>
                                      {recordTime ? <span>{recordTime}</span> : null}
                                      <ChevronDown
                                        size={16}
                                        className={`transition-transform ${isImageRecordCollapsed ? '-rotate-90' : 'rotate-0'}`}
                                      />
                                    </div>
                                  </div>
                                </button>
                                <button
                                  onClick={() => handleRemoveImageRecord(record.id)}
                                  className='rounded-full border border-slate-200 p-2 text-slate-400 transition hover:border-red-200 hover:text-red-500'
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            </div>

                            {!isImageRecordCollapsed && (record.status === 'generating' ? (
                              <div className='mt-4 space-y-4 rounded-[1.75rem] border border-blue-100 bg-blue-50/70 px-5 py-4 text-blue-700'>
                                <div className='space-y-3'>
                                  <div className='flex items-center gap-3'>
                                    <Loader2 size={18} className='animate-spin' />
                                    <span className='text-sm font-semibold'>
                                      正在生成图片，已完成 {record.completedCount || 0} / {record.total || 0}
                                    </span>
                                  </div>
                                  <div className='h-2 overflow-hidden rounded-full bg-white/70'>
                                    <div
                                      className='h-full rounded-full bg-blue-500 transition-all'
                                      style={{
                                        width: `${record.total ? ((record.completedCount || 0) / record.total) * 100 : 0}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                                {record.images.length > 0 ? (
                                  <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'>
                                    {record.images.map((imageItem, imageIndex) => (
                                      <div
                                        key={imageItem.id || `${record.id}-loading-${imageIndex}`}
                                        className='group relative overflow-hidden rounded-[1.5rem] border border-blue-100 bg-white shadow-sm'
                                      >
                                        {imageItem.url ? (
                                          <>
                                            <img
                                              src={buildCreativeCenterImageDisplayUrl(imageItem.url)}
                                              alt={`Generating Art ${imageIndex + 1}`}
                                              loading='lazy'
                                              decoding='async'
                                              className='aspect-[3/4] h-full w-full object-cover'
                                            />
                                            <div className='absolute right-3 top-3 z-10 flex items-center gap-2'>
                                              <button
                                                onClick={() =>
                                                  toggleImageTaskSelection(record.id, imageItem.id)
                                                }
                                                className='rounded-full bg-white/95 p-2 text-slate-700 shadow-lg transition hover:scale-105'
                                                title={
                                                  selectedImageIdSet.has(imageItem.id)
                                                    ? '取消选择'
                                                    : '选择下载'
                                                }
                                              >
                                                {selectedImageIdSet.has(imageItem.id) ? (
                                                  <CheckSquare size={16} />
                                                ) : (
                                                  <Square size={16} />
                                                )}
                                              </button>
                                              <button
                                                onClick={() =>
                                                  setPreviewImage({
                                                    url: imageItem.url,
                                                    title: `${record.prompt || '图片预览'} · 第 ${imageIndex + 1} 张`,
                                                  })
                                                }
                                                className='rounded-full bg-white/95 p-2 text-slate-700 shadow-lg transition hover:scale-105'
                                                title='预览'
                                              >
                                                <Eye size={16} />
                                              </button>
                                              <button
                                                onClick={() =>
                                                  triggerDownload(
                                                    imageItem.url,
                                                    buildImageDownloadFilename(record, recordIndex, imageIndex),
                                                  )
                                                }
                                                className='rounded-full bg-white/95 p-2 text-slate-700 shadow-lg transition hover:scale-105'
                                                title='下载'
                                              >
                                                <Download size={16} />
                                              </button>
                                            </div>
                                            <div className='absolute left-3 top-3 rounded-full bg-emerald-500/90 px-3 py-1 text-[11px] font-bold text-white shadow-sm'>
                                              已完成
                                            </div>
                                          </>
                                        ) : (
                                          <div className='aspect-[3/4] h-full w-full bg-slate-100 p-4 flex flex-col justify-between'>
                                            <div className='flex items-center gap-2 text-slate-500'>
                                              {imageItem.status === 'failed' ? (
                                                <X size={14} className='text-red-500' />
                                              ) : (
                                                <Loader2 size={14} className='animate-spin text-blue-500' />
                                              )}
                                              <span className='text-xs font-semibold'>
                                                {getTaskStatusLabel(imageItem.status)}
                                              </span>
                                            </div>
                                            {renderPendingTaskProgress({
                                              task: imageItem,
                                              taskIndex: imageIndex,
                                              modelName: record.modelName,
                                              params: record.params,
                                              taskType: 'image',
                                              detailText: imageItem.error || '',
                                              detailClassName: 'text-red-500',
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ) : record.status === 'failed' ? (
                              <div className='mt-4 rounded-[1.75rem] border border-red-100 bg-red-50 px-5 py-4 text-sm leading-7 text-red-600'>
                                {record.error || '本次图片生成失败，请稍后重试。'}
                              </div>
                            ) : (
                              <div className='mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'>
                                {record.images.map((imageItem, imageIndex) => (
                                  <div
                                    key={imageItem.id || `${record.id}-${imageIndex}`}
                                    className='group relative overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-lg shadow-slate-200/50'
                                  >
                                    {imageItem.url ? (
                                      <>
                                        <img
                                          src={buildCreativeCenterImageDisplayUrl(imageItem.url)}
                                          alt={`Generated Art ${imageIndex + 1}`}
                                          loading='lazy'
                                          decoding='async'
                                          className='aspect-[3/4] h-full w-full object-cover'
                                        />
                                        <div className='absolute right-3 top-3 z-10 flex items-center gap-2'>
                                          <button
                                            onClick={() =>
                                              toggleImageTaskSelection(record.id, imageItem.id)
                                            }
                                            className='rounded-full bg-white/95 p-2 text-slate-700 shadow-lg transition hover:scale-105'
                                            title={
                                              selectedImageIdSet.has(imageItem.id)
                                                ? '取消选择'
                                                : '选择下载'
                                            }
                                          >
                                            {selectedImageIdSet.has(imageItem.id) ? (
                                              <CheckSquare size={16} />
                                            ) : (
                                              <Square size={16} />
                                            )}
                                          </button>
                                          <button
                                            onClick={() =>
                                              setPreviewImage({
                                                url: imageItem.url,
                                                title: `${record.prompt || '图片预览'} · 第 ${imageIndex + 1} 张`,
                                              })
                                            }
                                            className='rounded-full bg-white/95 p-2 text-slate-700 shadow-lg transition hover:scale-105'
                                            title='预览'
                                          >
                                            <Eye size={16} />
                                          </button>
                                          <button
                                            onClick={() =>
                                              triggerDownload(
                                                imageItem.url,
                                                buildImageDownloadFilename(record, recordIndex, imageIndex),
                                              )
                                            }
                                            className='rounded-full bg-white/95 p-2 text-slate-700 shadow-lg transition hover:scale-105'
                                            title='下载'
                                          >
                                            <Download size={16} />
                                          </button>
                                        </div>
                                      </>
                                    ) : (
                                      <div className='aspect-[3/4] h-full w-full bg-slate-50 p-4 flex flex-col justify-between'>
                                        <div className='flex items-center gap-2 text-slate-500'>
                                          {imageItem.status === 'failed' ? (
                                            <X size={14} className='text-red-500' />
                                          ) : (
                                            <Loader2 size={14} className='animate-spin text-blue-500' />
                                          )}
                                          <span className='text-xs font-semibold'>
                                            {getTaskStatusLabel(imageItem.status)}
                                          </span>
                                        </div>
                                        {renderPendingTaskProgress({
                                          task: imageItem,
                                          taskIndex: imageIndex,
                                          modelName: record.modelName,
                                          params: record.params,
                                          taskType: 'image',
                                          detailText: imageItem.error || '',
                                          detailClassName: 'text-red-500',
                                        })}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ))}

                            {!isImageRecordCollapsed ? (
                            <div className='mt-3 flex flex-wrap items-center gap-2'>
                              {completedImageItems.length > 0 ? (
                                <>
                                  <button
                                    onClick={() => selectAllCompletedImageTasks(record)}
                                    className='rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'
                                  >
                                    全选已完成
                                  </button>
                                  {selectedImageItems.length > 0 ? (
                                    <>
                                      <button
                                        onClick={() =>
                                          downloadImageItems(
                                            record,
                                            recordIndex,
                                            selectedImageItems,
                                          )
                                        }
                                        className='rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100'
                                      >
                                        下载已选 {selectedImageItems.length} 张
                                      </button>
                                      <button
                                        onClick={() => clearImageTaskSelection(record.id)}
                                        className='rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600'
                                      >
                                        清空选择
                                      </button>
                                    </>
                                  ) : null}
                                </>
                              ) : null}
                              <button
                                onClick={() => handleReuseRecord(record)}
                                className='rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'
                              >
                                再次生成
                              </button>
                            </div>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ) : activeTab === 'video' && videoRecords.length > 0 ? (
              <div className='mx-auto flex w-full max-w-6xl flex-col gap-8'>
                <div className='space-y-10'>
                  {videoRecords.map((record, recordIndex) => {
                    const recordModel = findModelCard('video', record.modelName);
                    const metaSummary = formatVideoRecordSummary(record);
                    const completedVideoTasks = getCompletedVideoTasks(record);
                    const selectedVideoTasks = getSelectedVideoTasks(record);
                    const selectedVideoIdSet = new Set(selectedVideoTaskIds[record.id] || []);
                    const isVideoRecordCollapsed = collapsedVideoRecordIds[record.id] ?? false;
                    const recordTime = formatCreativeRecordTime(
                      record.updatedAt || record.createdAt,
                    );
                    const videoCardAspectRatio = getCreativeVideoCardAspectRatio(record);
                    const videoCardObjectFitClass = getCreativeVideoCardObjectFitClass(record);

                    return (
                      <article
                        key={record.id || `video-record-${recordIndex}`}
                        className='space-y-4'
                        style={{ contentVisibility: 'auto', containIntrinsicSize: '960px' }}
                      >
                        <div className='flex items-start gap-3 sm:gap-4'>
                          <div className='hidden h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] border border-blue-200 bg-blue-50 text-blue-600 shadow-sm backdrop-blur-sm sm:flex'>
                            {recordModel?.icon || <Video size={22} />}
                          </div>
                          <div className='min-w-0 flex-1 group'>
                            <div className='rounded-[1.35rem] border border-slate-200/50 bg-white/60 px-4 py-3.5 shadow-sm backdrop-blur-xl transition-all duration-300 group-hover:border-slate-200 group-hover:bg-white/90 group-hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] sm:rounded-[1.75rem] sm:px-5 sm:py-4'>
                              <div className='flex items-start justify-between gap-4'>
                                <button
                                  onClick={() => toggleVideoRecordCollapsed(record.id)}
                                  className='min-w-0 flex-1 text-left'
                                >
                                  <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4'>
                                    <div className='min-w-0'>
                                      <p className='text-[15px] font-bold leading-7 text-slate-800 whitespace-pre-wrap transition-colors group-hover:text-slate-900'>
                                        {record.prompt || '未填写提示词'}
                                      </p>
                                      <div className='mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500'>
                                        <span>{record.modelName || '视频模型'}</span>
                                        {metaSummary ? <span>{metaSummary}</span> : null}
                                        {record.total > 0 ? (
                                          <span>
                                            {record.completedCount || 0} / {record.total} 已完成
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>
                                    <div className='flex shrink-0 items-center gap-3 text-xs text-slate-500 sm:pl-3'>
                                      {recordTime ? <span>{recordTime}</span> : null}
                                      <ChevronDown
                                        size={16}
                                        className={`transition-transform ${isVideoRecordCollapsed ? '-rotate-90' : 'rotate-0'}`}
                                      />
                                    </div>
                                  </div>
                                </button>
                                <button
                                  onClick={() => handleRemoveVideoRecord(record.id)}
                                  className='rounded-full border border-slate-200 p-2 text-slate-400 transition hover:border-red-200 hover:text-red-500'
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            </div>

                            {!isVideoRecordCollapsed && (record.status === 'generating' ? (
                              <div className='mt-4 space-y-4 rounded-[1.75rem] border border-blue-100 bg-blue-50/70 px-5 py-4 text-blue-700'>
                                <div className='space-y-3'>
                                  <div className='flex items-center gap-3'>
                                    <Loader2 size={18} className='animate-spin' />
                                    <span className='text-sm font-semibold'>
                                      正在提交视频任务，已完成 {record.completedCount || 0} / {record.total || 0}
                                    </span>
                                  </div>
                                  <div className='h-2 overflow-hidden rounded-full bg-white/70'>
                                    <div
                                      className='h-full rounded-full bg-blue-500 transition-all'
                                      style={{
                                        width: `${record.total ? ((record.completedCount || 0) / record.total) * 100 : 0}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                                {record.tasks.length > 0 ? (
                                  <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'>
                                    {record.tasks.map((task, taskIndex) => (
                                      <div
                                        key={`${record.id}-loading-task-${task.id || taskIndex}`}
                                        className='group relative overflow-hidden rounded-[1.5rem] border border-blue-100 bg-white shadow-sm'
                                      >
                                        {getVideoTaskMediaUrl(task) ? (
                                          <div
                                            className='relative h-full w-full overflow-hidden bg-slate-950'
                                            style={{ aspectRatio: videoCardAspectRatio }}
                                          >
                                            <video
                                              muted
                                              playsInline
                                              preload='metadata'
                                              className={`absolute inset-0 z-0 h-full w-full ${videoCardObjectFitClass}`}
                                              src={getVideoTaskMediaUrl(task)}
                                            />
                                            <button
                                              onClick={() =>
                                                openVideoPreviewInNewWindow(
                                                  getVideoTaskMediaUrl(task),
                                                  `${record.modelName || '视频'} ${taskIndex + 1}`,
                                                  record.prompt || '',
                                                )
                                              }
                                              className='absolute inset-0 z-10 flex h-full w-full items-start justify-start bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.18),_transparent_40%),linear-gradient(180deg,rgba(15,23,42,0.12),rgba(2,6,23,0.28))] p-4 text-left text-white transition hover:scale-[1.01]'
                                              title='预览'
                                            >
                                              <div className='w-fit whitespace-nowrap rounded-full bg-emerald-500/90 px-3 py-1 text-[11px] font-bold leading-none text-white shadow-sm'>
                                                已完成
                                              </div>
                                              <div className='absolute bottom-4 left-4 inline-flex items-center gap-3 whitespace-nowrap rounded-[1.1rem] bg-slate-950/60 px-4 py-2.5 text-white shadow-lg backdrop-blur-sm'>
                                                <div className='inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/10 text-white'>
                                                  <Video size={20} />
                                                </div>
                                                <span className='text-sm font-semibold leading-none'>
                                                  点击预览视频
                                                </span>
                                              </div>
                                            </button>
                                            <div className='absolute right-3 top-3 z-10 flex items-center gap-2'>
                                              <button
                                                onClick={() =>
                                                  toggleVideoTaskSelection(record.id, task.id)
                                                }
                                                className='rounded-full bg-white/95 p-2 text-slate-700 shadow-lg transition hover:scale-105'
                                                title={
                                                  selectedVideoIdSet.has(task.id)
                                                    ? '取消选择'
                                                    : '选择下载'
                                                }
                                              >
                                                {selectedVideoIdSet.has(task.id) ? (
                                                  <CheckSquare size={16} />
                                                ) : (
                                                  <Square size={16} />
                                                )}
                                              </button>
                                              <button
                                                onClick={() =>
                                                  triggerDownload(
                                                    getVideoTaskMediaUrl(task),
                                                    buildVideoDownloadFilename(
                                                      record,
                                                      recordIndex,
                                                      taskIndex,
                                                    ),
                                                  )
                                                }
                                                className='rounded-full bg-white/95 p-2 text-slate-700 shadow-lg transition hover:scale-105'
                                                title='下载'
                                              >
                                                <Download size={16} />
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div
                                            className='h-full w-full bg-slate-100 p-4 flex flex-col justify-between'
                                            style={{ aspectRatio: videoCardAspectRatio }}
                                          >
                                            <div className='flex items-center gap-2 text-slate-500'>
                                              {task.status === 'failed' ? (
                                                <X size={14} className='text-red-500' />
                                              ) : (
                                                <Loader2
                                                  size={14}
                                                  className='animate-spin text-blue-500'
                                                />
                                              )}
                                              <span className='text-xs font-semibold'>
                                                {getTaskStatusLabel(task.status)}
                                              </span>
                                            </div>
                                            {renderPendingTaskProgress({
                                              task,
                                              taskIndex,
                                              modelName: record.modelName,
                                              params: record.params,
                                              taskType: 'video',
                                              detailText:
                                                task.content ||
                                                task.error ||
                                                '',
                                              detailClassName:
                                                task.status === 'failed'
                                                  ? 'text-red-500'
                                                  : 'text-slate-500',
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ) : record.status === 'failed' ? (
                              <div className='mt-4 rounded-[1.75rem] border border-red-100 bg-red-50 px-5 py-4 text-sm leading-7 text-red-600'>
                                {record.error || '本次视频生成失败，请稍后重试。'}
                              </div>
                            ) : (
                              <div className='mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'>
                                {record.tasks.map((task, taskIndex) => (
                                  <div
                                    key={`${record.id}-${task.id || taskIndex}`}
                                    className='group relative overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-lg shadow-slate-200/50'
                                  >
                                    {getVideoTaskMediaUrl(task) ? (
                                      <div
                                        className='relative h-full w-full overflow-hidden bg-slate-950'
                                        style={{ aspectRatio: videoCardAspectRatio }}
                                      >
                                        <video
                                          muted
                                          playsInline
                                          preload='metadata'
                                          className={`absolute inset-0 z-0 h-full w-full ${videoCardObjectFitClass}`}
                                          src={getVideoTaskMediaUrl(task)}
                                        />
                                        <button
                                          onClick={() =>
                                            openVideoPreviewInNewWindow(
                                              getVideoTaskMediaUrl(task),
                                              `${record.modelName || '视频'} ${taskIndex + 1}`,
                                              record.prompt || '',
                                            )
                                          }
                                          className='absolute inset-0 z-10 flex h-full w-full items-start justify-start bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.18),_transparent_40%),linear-gradient(180deg,rgba(15,23,42,0.12),rgba(2,6,23,0.28))] p-4 text-left text-white transition hover:scale-[1.01]'
                                          title='预览'
                                        >
                                          <div className='w-fit whitespace-nowrap rounded-full bg-emerald-500/90 px-3 py-1 text-[11px] font-bold leading-none text-white shadow-sm'>
                                            已完成
                                          </div>
                                          <div className='absolute bottom-4 left-4 inline-flex items-center gap-3 whitespace-nowrap rounded-[1.1rem] bg-slate-950/60 px-4 py-2.5 text-white shadow-lg backdrop-blur-sm'>
                                            <div className='inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/10 text-white'>
                                              <Video size={20} />
                                            </div>
                                            <span className='text-sm font-semibold leading-none'>
                                              点击预览视频
                                            </span>
                                          </div>
                                        </button>
                                        <div className='absolute right-3 top-3 z-10 flex items-center gap-2'>
                                          <button
                                            onClick={() =>
                                              toggleVideoTaskSelection(record.id, task.id)
                                            }
                                            className='rounded-full bg-white/95 p-2 text-slate-700 shadow-lg transition hover:scale-105'
                                            title={
                                              selectedVideoIdSet.has(task.id)
                                                ? '取消选择'
                                                : '选择下载'
                                            }
                                          >
                                            {selectedVideoIdSet.has(task.id) ? (
                                              <CheckSquare size={16} />
                                            ) : (
                                              <Square size={16} />
                                            )}
                                          </button>
                                          <button
                                            onClick={() =>
                                              triggerDownload(
                                                getVideoTaskMediaUrl(task),
                                                buildVideoDownloadFilename(
                                                  record,
                                                  recordIndex,
                                                  taskIndex,
                                                ),
                                              )
                                            }
                                            className='rounded-full bg-white/95 p-2 text-slate-700 shadow-lg transition hover:scale-105'
                                            title='下载'
                                          >
                                            <Download size={16} />
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div
                                        className='h-full w-full bg-slate-50 p-4 flex flex-col justify-between'
                                        style={{ aspectRatio: videoCardAspectRatio }}
                                      >
                                        <div className='flex items-center gap-2 text-slate-500'>
                                          {task.status === 'failed' ? (
                                            <X size={14} className='text-red-500' />
                                          ) : (
                                            <Loader2
                                              size={14}
                                              className='animate-spin text-blue-500'
                                            />
                                          )}
                                          <span className='text-xs font-semibold'>
                                            {getTaskStatusLabel(task.status)}
                                          </span>
                                        </div>
                                        {renderPendingTaskProgress({
                                          task,
                                          taskIndex,
                                          modelName: record.modelName,
                                          params: record.params,
                                          taskType: 'video',
                                          detailText:
                                            task.content ||
                                            task.error ||
                                            '',
                                          detailClassName:
                                            task.status === 'failed'
                                              ? 'text-red-500'
                                              : 'text-slate-500',
                                        })}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ))}

                            {!isVideoRecordCollapsed ? (
                            <div className='mt-3 flex flex-wrap items-center gap-2'>
                              {completedVideoTasks.length > 0 ? (
                                <>
                                  <button
                                    onClick={() => selectAllCompletedVideoTasks(record)}
                                    className='rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'
                                  >
                                    全选已完成
                                  </button>
                                  {selectedVideoTasks.length > 0 ? (
                                    <>
                                      <button
                                        onClick={() =>
                                          downloadVideoTasks(
                                            record,
                                            recordIndex,
                                            selectedVideoTasks,
                                          )
                                        }
                                        className='rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100'
                                      >
                                        下载已选 {selectedVideoTasks.length} 条
                                      </button>
                                      <button
                                        onClick={() => clearVideoTaskSelection(record.id)}
                                        className='rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600'
                                      >
                                        清空选择
                                      </button>
                                    </>
                                  ) : null}
                                </>
                              ) : null}
                              <button
                                onClick={() => handleReuseRecord(record)}
                                className='rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'
                              >
                                再次生成
                              </button>
                            </div>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className='flex min-h-full items-center justify-center py-5'>
                <div className='w-full max-w-xl rounded-[2rem] border border-blue-100/50 bg-white/70 px-6 py-9 text-center shadow-[0_20px_80px_rgba(59,130,246,0.08)] backdrop-blur-2xl transition-all hover:bg-white/90 hover:shadow-[0_20px_80px_rgba(59,130,246,0.12)] sm:rounded-[2.5rem] sm:px-10 sm:py-12'>
                  <div className='mx-auto mb-5 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[1.5rem] border border-blue-100 bg-gradient-to-br from-white to-blue-50 text-blue-600 shadow-xl shadow-blue-500/10 sm:mb-6 sm:h-24 sm:w-24 sm:rounded-[1.75rem]'>
                    {selectedModel?.icon || (activeTab === 'image' ? <ImageIcon size={40} /> : <Video size={40} />)}
                  </div>
                  <div className='flex items-center justify-center gap-3 text-[11px] font-black uppercase tracking-[0.25em] text-blue-500'>
                    <div className="h-[2px] w-6 rounded-full bg-blue-500/30"></div>
                    当前模型
                    <div className="h-[2px] w-6 rounded-full bg-blue-500/30"></div>
                  </div>
                  <h3 className='mt-5 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl'>
                    {selectedModel?.name || (activeTab === 'image' ? '图片模型' : '视频模型')}
                  </h3>
                  <p className='mt-4 text-[15px] font-medium leading-relaxed text-slate-500'>
                    {selectedModel?.desc || '这里会显示当前模型的介绍，帮助你在开始创作前快速了解它更擅长生成什么内容。'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className='bg-gradient-to-t from-slate-50 via-slate-50/80 to-transparent px-2 pb-2 pt-2 backdrop-blur-md sm:px-4 sm:pb-3 sm:pt-3 md:px-8 lg:pb-8 lg:pt-6'>
          <div className={`mx-auto relative ${activeTab === 'chat' ? 'max-w-[1180px]' : 'max-w-4xl'}`}>
            <div className='absolute -inset-0.5 rounded-[1.5rem] bg-gradient-to-r from-blue-500 via-blue-500 to-blue-500 pb-4 opacity-[0.12] blur-lg transition-all duration-500 animate-pulse group-focus-within:opacity-[0.22] sm:-inset-1 sm:rounded-[3rem] sm:blur-xl'></div>
            <div className='relative flex flex-col rounded-[1.35rem] border border-white/60 bg-white/75 p-2.5 shadow-[0_20px_40px_-5px_rgba(0,0,0,0.05)] backdrop-blur-2xl transition-all duration-500 focus-within:border-white focus-within:bg-white/90 sm:rounded-[2.5rem] sm:p-5 group'>
              <input
                ref={fileInputRef}
                type='file'
                accept='image/*'
                multiple
                className='hidden'
                onChange={handleImageFileChange}
              />
              <div className='flex items-end gap-2 px-0 sm:gap-5 sm:px-3'>
                {isCurrentModelImageUploadEnabled ? (
                  <div className='shrink-0'>
                    <div
                      onDragEnter={handleUploadDragEnter}
                      onDragOver={handleUploadDragOver}
                      onDragLeave={handleUploadDragLeave}
                      onDrop={handleUploadDrop}
                      className={`relative rounded-[1.75rem] transition-all duration-300 ${
                        isUploadDragActive ? 'scale-[1.03]' : ''
                      }`}
                    >
                    <button
                      type='button'
                      onClick={handleUploadButtonClick}
                      className={`flex h-12 w-12 items-center justify-center rounded-[1rem] border border-dashed bg-white/50 text-slate-500 transition-all duration-300 hover:shadow-sm sm:h-24 sm:w-24 sm:rounded-[1.75rem] ${
                        isUploadDragActive
                          ? 'border-blue-500 bg-blue-50 text-blue-600 shadow-[0_12px_35px_-12px_rgba(58,117,246,0.45)]'
                          : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600'
                      }`}
                    >
                      <div className='flex flex-col items-center gap-1 sm:gap-2'>
                        {isUploadingImage ? (
                          <Loader2 size={20} className='animate-spin text-blue-400 sm:h-6 sm:w-6' />
                        ) : (
                          <ImagePlus size={20} className='sm:h-6 sm:w-6' />
                        )}
                        <span className='hidden text-[11px] font-bold tracking-wide sm:block sm:whitespace-nowrap'>
                          {uploadedImages.length > 0 ? '继续上传' : '上传图片'}
                        </span>
                      </div>
                    </button>
                    </div>
                  </div>
                ) : null}
                <textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSubmit())}
                  placeholder={!isLoggedIn ? "登录后即可开始对话、图片或视频创作..." : activeTab === 'chat' ? "发送消息..." : "描述你想要的画面，越详细越好..."}
                  className='max-h-32 min-h-[48px] min-w-0 flex-1 resize-none bg-transparent px-1 py-1.5 text-[16px] font-medium leading-relaxed text-slate-800 outline-none placeholder:text-slate-400 sm:max-h-60 sm:min-h-[70px] sm:px-0 sm:py-3 custom-scrollbar'
                />
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitPending || (!prompt.trim() && uploadedImages.every((item) => !(item?.status === 'uploaded' && item?.url)))}
                  className='group/btn flex h-12 w-12 shrink-0 items-center justify-center self-end rounded-[1rem] bg-[#3A75F6] text-white shadow-[0_6px_20px_-6px_rgba(58,117,246,0.5)] transition-all duration-300 hover:scale-[1.05] hover:bg-[#346AE0] hover:shadow-[0_8px_25px_-6px_rgba(58,117,246,0.6)] active:scale-95 disabled:border-transparent disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:transform-none sm:h-14 sm:w-14 sm:rounded-[1.25rem]'
                >
                  {isSubmitPending ? <Loader2 size={26} className='animate-spin' /> : <ArrowUp size={26} strokeWidth={2.5} className='transition-transform group-hover/btn:-translate-y-0.5' />}
                </button>
              </div>

              {uploadedImages.length > 0 ? (
                <div className='mt-3 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200/50 bg-slate-50/50 px-2.5 py-2.5 sm:mt-5 sm:flex-wrap sm:gap-4 sm:px-5 sm:py-4 custom-scrollbar'>
                  {uploadedImages.map((imageItem) => (
                    <div key={imageItem.id} className='w-16 shrink-0 sm:w-24 group/img'>
                      <div className='relative h-16 w-16 overflow-hidden rounded-[1rem] border border-slate-200 bg-slate-100 shadow-sm transition-transform duration-300 group-hover/img:scale-105 group-hover/img:border-blue-300 sm:h-24 sm:w-24 sm:rounded-[1.5rem]'>
                        <img
                          src={imageItem.previewUrl || buildCreativeCenterImageDisplayUrl(imageItem.url)}
                          alt={imageItem.name}
                          className='h-full w-full object-cover opacity-90 transition-opacity group-hover/img:opacity-100'
                        />
                        <button
                          onClick={() => removeUploadedImage(imageItem.id)}
                          className='absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/40 p-1 text-white opacity-0 backdrop-blur-md transition-all duration-300 hover:bg-red-500 group-hover/img:opacity-100'
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <div className='mt-2.5 truncate text-center text-[11px] font-medium text-slate-500'>
                        {imageItem.status === 'uploading' ? (
                          <span className="flex items-center justify-center gap-1 text-blue-500"><Loader2 size={10} className="animate-spin"/> 上传中</span>
                        ) : imageItem.name}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {uploadImageNotice ? (
                <div className='mt-4 px-3 text-xs font-bold text-red-500 flex items-center gap-2'>
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                  {uploadImageNotice}
                </div>
              ) : null}
              {currentImageUploadLimit ? (
                <div className='mt-3 px-3 text-[11px] text-slate-500 font-medium'>
                  当前模型最多可上传 <span className="text-blue-600 font-bold">{currentImageUploadLimit}</span> 张图片（建议不大于5M/张）
                </div>
              ) : !isCurrentModelImageUploadEnabled ? (
                <div className='mt-3 px-3 text-[11px] text-slate-400 flex items-center gap-1.5'>
                  <X size={12} /> 当前模型暂不支持上传图片
                </div>
              ) : null}

              {!isLoggedIn && (
                <div className='mt-5 flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 text-sm text-indigo-800 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5'>
                  <div className='flex items-center gap-2 font-bold'>
                    <Sparkles size={16} className="text-blue-500" />
                    {'\u5f53\u524d\u4ec5\u5f00\u653e\u6d4f\u89c8\uff0c\u53d1\u9001\u5185\u5bb9\u524d\u9700\u8981\u5148\u767b\u5f55\u8d26\u53f7\u3002'}
                  </div>
                  <button
                    onClick={() => {
                      window.location.href = '/login';
                    }}
                    className='shrink-0 rounded-[0.85rem] bg-[#3A75F6] px-6 py-2.5 text-xs font-bold tracking-wide text-white shadow-[0_4px_15px_rgba(58,117,246,0.3)] transition-all hover:bg-[#346AE0] hover:shadow-[0_6px_20px_rgba(58,117,246,0.4)]'
                  >
                    去登录
                  </button>
                </div>
              )}
              {activeTab !== 'chat' && (
                <div className='mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200/50 px-0 pt-3 sm:mt-6 sm:gap-3 sm:px-3 sm:pt-5'>
                  <DropSelectButton
                    menuKey='generationCount'
                    icon={<Layers size={14} />}
                    label={`生成 ${params.generationCount}条`}
                    value={params.generationCount}
                    options={GENERATION_COUNT_OPTIONS}
                    openMenu={openMenu}
                    setOpenMenu={setOpenMenu}
                    onSelect={(value) =>
                      setParams((prev) => ({ ...prev, generationCount: value }))
                    }
                    widthClass='w-28'
                  />

                  {activeTab === 'image' && isGrokImageGenerationModel && (
                    <DropSelectButton
                      menuKey='imageSize'
                      icon={<Copy size={14} />}
                      label={`比例 ${getOptionLabel(
                        GROK_IMAGE_SIZE_OPTIONS,
                        normalizeGrokImageSize(params.imageSize),
                      )}`}
                      value={params.imageSize}
                      options={GROK_IMAGE_SIZE_OPTIONS}
                      openMenu={openMenu}
                      setOpenMenu={setOpenMenu}
                      onSelect={(value) =>
                        setParams((prev) => ({ ...prev, imageSize: value }))
                      }
                    />
                  )}
                  {activeTab === 'image' && isGrokImageEditModel && (
                    <div className='rounded-full border border-slate-200 bg-white/50 backdrop-blur-md px-4 py-2 text-[13px] font-bold text-slate-600'>
                      比例 跟随图一
                    </div>
                  )}

                  {activeTab === 'image' && isAdobeImageModel && (
                    <>
                      <DropSelectButton
                        menuKey='aspectRatio'
                        icon={<Copy size={14} />}
                        label={`比例 ${getOptionLabel(
                          currentAdobeImageAspectRatioOptions,
                          params.aspectRatio,
                        )}`}
                        value={params.aspectRatio}
                        options={currentAdobeImageAspectRatioOptions}
                        openMenu={openMenu}
                        setOpenMenu={setOpenMenu}
                        onSelect={(value) =>
                          setParams((prev) => ({ ...prev, aspectRatio: value }))
                        }
                      />

                      <DropSelectButton
                        menuKey='outputResolution'
                        icon={<ImageIcon size={14} />}
                        label={`分辨率 ${params.outputResolution}`}
                        value={params.outputResolution}
                        options={ADOBE_OUTPUT_RESOLUTION_OPTIONS}
                        openMenu={openMenu}
                        setOpenMenu={setOpenMenu}
                        onSelect={(value) =>
                          setParams((prev) => ({
                            ...prev,
                            outputResolution: value,
                          }))
                        }
                        widthClass='w-32'
                      />
                    </>
                  )}

                  {activeTab === 'video' && isVideoModel && !isAdobeVideoModel && (
                    <>
                      <DropSelectButton
                        menuKey='videoSize'
                        icon={<Copy size={14} />}
                        label={`比例 ${getOptionLabel(
                          GENERIC_VIDEO_SIZE_OPTIONS,
                          params.videoSize,
                        )}`}
                        value={params.videoSize}
                        options={GENERIC_VIDEO_SIZE_OPTIONS}
                        openMenu={openMenu}
                        setOpenMenu={setOpenMenu}
                        onSelect={(value) =>
                          setParams((prev) => ({ ...prev, videoSize: value }))
                        }
                      />

                      <DropSelectButton
                        menuKey='videoSeconds'
                        icon={<Clock size={14} />}
                        label={`时长 ${getOptionLabel(
                          currentVideoSecondsOptions,
                          params.videoSeconds,
                        )}`}
                        value={params.videoSeconds}
                        options={currentVideoSecondsOptions}
                        openMenu={openMenu}
                        setOpenMenu={setOpenMenu}
                        onSelect={(value) =>
                          setParams((prev) => ({ ...prev, videoSeconds: value }))
                        }
                        widthClass='w-32'
                      />

                      <DropSelectButton
                        menuKey='videoQuality'
                        icon={<Video size={14} />}
                        label={`分辨率 ${params.videoQuality}`}
                        value={params.videoQuality}
                        options={GENERIC_VIDEO_QUALITY_OPTIONS}
                        openMenu={openMenu}
                        setOpenMenu={setOpenMenu}
                        onSelect={(value) =>
                          setParams((prev) => ({ ...prev, videoQuality: value }))
                        }
                        widthClass='w-32'
                      />

                      {isGrokImagineVideoModel && (
                        <DropSelectButton
                          menuKey='videoPreset'
                          icon={<Layers size={14} />}
                          label={`风格预设 ${getOptionLabel(
                            GROK_VIDEO_PRESET_OPTIONS,
                            params.videoPreset,
                          )}`}
                          value={params.videoPreset}
                          options={GROK_VIDEO_PRESET_OPTIONS}
                          openMenu={openMenu}
                          setOpenMenu={setOpenMenu}
                          onSelect={(value) =>
                            setParams((prev) => ({ ...prev, videoPreset: value }))
                          }
                          widthClass='w-36'
                        />
                      )}
                    </>
                  )}

                  {activeTab === 'video' && isAdobeVideoModel && (
                    <>
                      <DropSelectButton
                        menuKey='videoDuration'
                        icon={<Clock size={14} />}
                        label={`时长 ${getOptionLabel(
                          getAdobeVideoDurationOptions(currentModelName),
                          params.videoDuration,
                        )}`}
                        value={params.videoDuration}
                        options={getAdobeVideoDurationOptions(currentModelName)}
                        openMenu={openMenu}
                        setOpenMenu={setOpenMenu}
                        onSelect={(value) =>
                          setParams((prev) => ({ ...prev, videoDuration: value }))
                        }
                        widthClass='w-32'
                      />

                      <DropSelectButton
                        menuKey='videoAspectRatio'
                        icon={<Copy size={14} />}
                        label={`比例 ${params.aspectRatio}`}
                        value={params.aspectRatio}
                        options={getAdobeVideoAspectRatioOptions(currentModelName)}
                        openMenu={openMenu}
                        setOpenMenu={setOpenMenu}
                        onSelect={(value) =>
                          setParams((prev) => ({ ...prev, aspectRatio: value }))
                        }
                        widthClass='w-32'
                      />

                      {isAdobeVeoModel && (
                        <DropSelectButton
                          menuKey='adobeVideoResolution'
                          icon={<Video size={14} />}
                          label={`分辨率 ${params.videoResolution}`}
                          value={params.videoResolution}
                          options={ADOBE_VIDEO_RESOLUTION_OPTIONS}
                          openMenu={openMenu}
                          setOpenMenu={setOpenMenu}
                          onSelect={(value) =>
                            setParams((prev) => ({
                              ...prev,
                              videoResolution: value,
                            }))
                          }
                          widthClass='w-32'
                        />
                      )}

                      {currentModelName === 'veo31' && (
                        <DropSelectButton
                          menuKey='referenceMode'
                          icon={<Layers size={14} />}
                          label={`参考 ${getOptionLabel(
                            ADOBE_REFERENCE_MODE_OPTIONS,
                            params.referenceMode,
                          )}`}
                          value={params.referenceMode}
                          options={ADOBE_REFERENCE_MODE_OPTIONS}
                          openMenu={openMenu}
                          setOpenMenu={setOpenMenu}
                          onSelect={(value) =>
                            setParams((prev) => ({ ...prev, referenceMode: value }))
                          }
                          widthClass='w-36'
                        />
                      )}
                    </>
                  )}

                  <div className='ml-auto hidden text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 sm:block'>Enter 发送</div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className='pointer-events-none absolute bottom-8 right-8 z-20 hidden flex-col items-end sm:flex group'>
          <div className='pointer-events-none mb-3 hidden w-max rounded-xl border border-white/50 bg-white/95 px-4 py-2 text-[12px] font-bold text-slate-700 shadow-[0_10px_30px_rgba(0,0,0,0.1)] backdrop-blur-3xl transition-all duration-300 group-hover:block animate-in fade-in slide-in-from-bottom-1'>
            只删除会话，图片视频资源仍保留
            <div className="absolute -bottom-1.5 right-6 h-3 w-3 rotate-45 border-b border-r border-white/50 bg-white/95"></div>
          </div>
          <button
            type='button'
            onClick={handleClearCurrentSession}
            disabled={isSubmitPending}
            className='pointer-events-auto inline-flex items-center gap-2 rounded-[1.25rem] border border-blue-100 bg-white/80 px-5 py-3 text-[13px] font-bold text-slate-600 shadow-[0_8px_30px_rgba(59,130,246,0.08)] backdrop-blur-xl transition-all duration-300 hover:scale-105 hover:border-red-200 hover:bg-red-50 hover:text-red-500 hover:shadow-[0_8px_30px_rgba(239,68,68,0.15)] disabled:cursor-not-allowed disabled:border-slate-200/50 disabled:bg-white/50 disabled:text-slate-400 disabled:transform-none'
          >
            <Trash2 size={16} />
            清除会话
          </button>
        </div>
      </main>

      {previewImage ? (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-6 backdrop-blur-sm'>
          <div className='relative w-full max-w-5xl rounded-[2rem] bg-white p-4 shadow-2xl'>
            <button
              onClick={() => setPreviewImage(null)}
              className='absolute right-4 top-4 z-10 rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-red-200 hover:text-red-500'
            >
              <X size={18} />
            </button>
            <div className='mb-4 px-2 pr-12 text-sm font-semibold text-slate-600'>
              {previewImage.title || '图片预览'}
            </div>
            <div className='overflow-hidden rounded-[1.5rem] bg-slate-100'>
              <img
                src={buildCreativeCenterImageDisplayUrl(previewImage.url)}
                alt={previewImage.title || 'Preview'}
                className='max-h-[80vh] w-full object-contain'
              />
            </div>
          </div>
        </div>
      ) : null}

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 20px; }
      `}} />
    </div>
  );
}
