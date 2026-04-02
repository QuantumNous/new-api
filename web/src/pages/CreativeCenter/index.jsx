import React, { useContext, useMemo, useRef, useState, useEffect } from 'react';
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
  ImagePlus
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
const ADOBE_CHAT_IMAGE_EDIT_MODELS = new Set([
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
  'nano-banana2': 14,
  'nano-banana-pro': 14,
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
const ADOBE_IMAGE_ASPECT_RATIO_OPTIONS = [
  { label: 'Auto', value: 'auto' },
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
const UNIFORM_CREATIVE_VIDEO_CARD_MODELS = new Set([
  'grok-imagine-1.0-video',
  'veo31-fast',
  'veo31-ref',
]);
const CREATIVE_CENTER_IMAGE_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const CREATIVE_CENTER_IMAGE_UPLOAD_CONCURRENCY = 2;
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

const getCreativeCenterImageUploadLimit = (modelName) => {
  const normalizedModelName = typeof modelName === 'string' ? modelName.trim() : '';
  if (!normalizedModelName) {
    return null;
  }
  return CREATIVE_CENTER_IMAGE_UPLOAD_LIMITS[normalizedModelName] ?? null;
};

const triggerDownload = (url, filename) => {
  if (!url) {
    return;
  }

  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
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

const getVideoTaskMediaUrl = (task) => {
  if (typeof task?.url === 'string' && task.url.trim()) {
    return task.url.trim();
  }
  if (typeof task?.resultUrl === 'string' && task.resultUrl.trim()) {
    return task.resultUrl.trim();
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
      status: record?.status || '',
      error: record?.error || '',
      total: Number(record?.total) || 0,
      params: record?.params || {},
      items:
        taskType === 'video'
          ? (record?.tasks || []).map((item) => ({
              id: item?.id || '',
              taskId: item?.taskId || item?.task_id || '',
              status: item?.status || '',
              url: getVideoTaskMediaUrl(item),
              error: item?.error || '',
              resultUrl: item?.resultUrl || '',
            }))
          : (record?.images || []).map((item) => ({
              id: item?.id || '',
              status: item?.status || '',
              url: item?.url || item?.resultUrl || '',
              error: item?.error || '',
            })),
    })),
  );

const createCreativeRecordId = (prefix) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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

  const progress =
    parseProgressValue(item?.progress) ?? (item?.url ? 100 : 0);

  return {
    id: item?.id || createCreativeRecordId(`image-task-${index}`),
    url: typeof item?.url === 'string' ? item.url : '',
    status: item?.status || (item?.url ? 'completed' : 'pending'),
    progress,
    error: item?.error || '',
    resultUrl: typeof item?.resultUrl === 'string' ? item.resultUrl : '',
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
        : !item?.url && !['completed', 'failed'].includes(item?.status || 'pending'),
  };
};

const normalizeVideoTaskItem = (item, index = 0) => {
  const normalizedStatus = normalizeVideoTaskStatus(
    item?.status || (item?.url ? 'completed' : 'submitted'),
  );
  const progress =
    parseProgressValue(item?.progress) ??
    ((item?.url || normalizedStatus === 'completed') ? 100 : 0);

  return {
    id: item?.id || createCreativeRecordId(`video-task-${index}`),
    taskId: item?.taskId || item?.task_id || item?.id || '',
    status: normalizedStatus,
    url: getVideoTaskMediaUrl(item),
    content: item?.content || '',
    progress,
    error: item?.error || '',
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
        : false,
    pollable:
      typeof item?.pollable === 'boolean'
        ? item.pollable
        : !item?.url && ACTIVE_VIDEO_POLL_STATUSES.has(normalizedStatus),
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
    return payload.entries.map((entry, index) => ({
      id: entry?.id || createCreativeRecordId(`image-history-${index}`),
      prompt: entry?.prompt || '',
      modelName: entry?.modelName || entry?.model_name || snapshot?.model_name || '',
      params: entry?.params && typeof entry.params === 'object' ? entry.params : {},
      group: entry?.group || snapshot?.group || '',
      status: entry?.status || 'completed',
      images: Array.isArray(entry?.images)
        ? entry.images
            .filter(Boolean)
            .map((item, imageIndex) => normalizeImageTaskItem(item, imageIndex))
        : [],
      error: entry?.error || '',
      total: Number(entry?.total) || (Array.isArray(entry?.images) ? entry.images.length : 0),
      completedCount:
        Number(entry?.completedCount) ||
        Number(entry?.completed_count) ||
        (Array.isArray(entry?.images) ? entry.images.length : 0),
      successCount:
        Number(entry?.successCount) ||
        Number(entry?.success_count) ||
        (Array.isArray(entry?.images) ? entry.images.length : 0),
      createdAt: entry?.createdAt || entry?.created_at || snapshot?.updated_at || Date.now(),
      updatedAt: entry?.updatedAt || entry?.updated_at || snapshot?.updated_at || Date.now(),
    }));
  }

  if (Array.isArray(payload?.images) && payload.images.length > 0) {
    return [
      {
        id: createCreativeRecordId('image-history'),
        prompt: snapshot?.prompt || '',
        modelName: snapshot?.model_name || '',
        params: payload?.params && typeof payload.params === 'object' ? payload.params : {},
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
    return payload.entries.map((entry, index) => ({
      id: entry?.id || createCreativeRecordId(`video-history-${index}`),
      prompt: entry?.prompt || '',
      modelName: entry?.modelName || entry?.model_name || snapshot?.model_name || '',
      params: entry?.params && typeof entry.params === 'object' ? entry.params : {},
      group: entry?.group || snapshot?.group || '',
      status: entry?.status || 'completed',
      tasks: Array.isArray(entry?.tasks)
        ? entry.tasks.map((item, taskIndex) => normalizeVideoTaskItem(item, taskIndex))
        : [],
      error: entry?.error || '',
      total: Number(entry?.total) || (Array.isArray(entry?.tasks) ? entry.tasks.length : 0),
      completedCount:
        Number(entry?.completedCount) ||
        Number(entry?.completed_count) ||
        (Array.isArray(entry?.tasks) ? entry.tasks.length : 0),
      successCount:
        Number(entry?.successCount) ||
        Number(entry?.success_count) ||
        (Array.isArray(entry?.tasks) ? entry.tasks.length : 0),
      createdAt: entry?.createdAt || entry?.created_at || snapshot?.updated_at || Date.now(),
      updatedAt: entry?.updatedAt || entry?.updated_at || snapshot?.updated_at || Date.now(),
    }));
  }

  if (Array.isArray(payload?.tasks) && payload.tasks.length > 0) {
    return [
      {
        id: createCreativeRecordId('video-history'),
        prompt: snapshot?.prompt || '',
        modelName: snapshot?.model_name || '',
        params: payload?.params && typeof payload.params === 'object' ? payload.params : {},
        status: 'completed',
        tasks: payload.tasks.map((item, taskIndex) => normalizeVideoTaskItem(item, taskIndex)),
        error: '',
        total: payload.tasks.length,
        completedCount: payload.tasks.length,
        successCount: payload.tasks.length,
        createdAt: snapshot?.updated_at || Date.now(),
        updatedAt: snapshot?.updated_at || Date.now(),
      },
    ];
  }

  return [];
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

const renderCreativeModelIcon = (channelType, iconName, fallbackTab) => {
  const channelIcon = channelType ? getChannelIcon(channelType) : null;
  if (channelIcon) {
    return <div className='scale-[1.7] text-current'>{channelIcon}</div>;
  }

  if (iconName) {
    return <div className='scale-[1.35]'>{getLobeHubIcon(iconName, 20)}</div>;
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
  <div className='relative'>
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all ${
        open ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
      }`}
    >
      {icon}
      {label}
      <ChevronDown size={12} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
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
      <div
        className={`absolute bottom-12 left-0 z-20 ${widthClass} rounded-2xl border border-slate-200 bg-white p-2 shadow-xl`}
      >
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => {
              onSelect(option.value);
              setOpenMenu(null);
            }}
            className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition ${
              value === option.value
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>{option.label}</span>
            {value === option.value ? <Check size={14} /> : null}
          </button>
        ))}
      </div>
    )}
  </DropButton>
);

export default function App() {
  const [userState] = useContext(UserContext);
  const [activeTab, setActiveTab] = useState('chat');
  const [activeModel, setActiveModel] = useState('chat1');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [imageRecords, setImageRecords] = useState([]);
  const [videoRecords, setVideoRecords] = useState([]);
  const [activeGroup, setActiveGroup] = useState('');
  const [openMenu, setOpenMenu] = useState(null);
  const [params, setParams] = useState({
    generationCount: '1',
    imageSize: '1024x1024',
    aspectRatio: 'auto',
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
  const videoPollersRef = useRef(new Map());
  const imageRecordsRef = useRef([]);
  const videoRecordsRef = useRef([]);
  const uploadedImagesRef = useRef([]);
  const creativeCenterUploadConfigRef = useRef(null);
  const historyHydratedRef = useRef(false);
  const lastPersistedImageSignatureRef = useRef('');
  const lastPersistedVideoSignatureRef = useRef('');
  const isLoggedIn = Boolean(userState?.user);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [uploadImageNotice, setUploadImageNotice] = useState('');
  const isUploadingImage = uploadedImages.some((item) => item?.status === 'uploading');

  useEffect(() => {
    imageRecordsRef.current = imageRecords;
  }, [imageRecords]);

  useEffect(() => {
    videoRecordsRef.current = videoRecords;
  }, [videoRecords]);

  useEffect(() => {
    uploadedImagesRef.current = uploadedImages;
  }, [uploadedImages]);

  useEffect(() => {
    creativeCenterUploadConfigRef.current = null;
  }, [isLoggedIn]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeTab, chatMessages, imageRecords, videoRecords, isGenerating]);

  useEffect(() => {
    return () => {
      videoPollersRef.current.forEach((controller) => {
        controller.active = false;
        if (controller.timer) {
          window.clearTimeout(controller.timer);
        }
      });
      videoPollersRef.current.clear();
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
  const [historySnapshots, setHistorySnapshots] = useState(EMPTY_HISTORY_SNAPSHOTS);
  const [isSessionPanelOpen, setIsSessionPanelOpen] = useState(false);
  const [collapsedImageRecordIds, setCollapsedImageRecordIds] = useState({});
  const [selectedImageTaskIds, setSelectedImageTaskIds] = useState({});
  const [previewImage, setPreviewImage] = useState(null);
  const [collapsedVideoRecordIds, setCollapsedVideoRecordIds] = useState({});
  const [selectedVideoTaskIds, setSelectedVideoTaskIds] = useState({});
  const [progressClock, setProgressClock] = useState(() => Date.now());
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

    const createModelCard = (model, tabKey, modelName) => {
      const tags = String(model?.tags || '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
      const resolvedModelName = model?.model_name || model?.name || modelName || '未命名模型';

      return {
        id: `${tabKey}:${resolvedModelName}`,
        value: resolvedModelName,
        name: resolvedModelName,
        desc:
          model?.description ||
          (tags.length > 0 ? `标签：${tags.join('、')}` : '来自模型管理'),
        icon: renderCreativeModelIcon(
          Number(model?.channel_type || 0),
          model?.icon,
          tabKey,
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
          setActiveGroup(resolvedGroup);
        }
      } catch (error) {
        console.error('Failed to sync creative center models:', error);
      }
    };

    loadManagedModels();

    return () => {
      mounted = false;
    };
  }, [isLoggedIn]);

  const modelPools = useMemo(
    () => ({
      chat: syncedModels.chat.length > 0 ? syncedModels.chat : fallbackModels.chat,
      image: syncedModels.image.length > 0 ? syncedModels.image : fallbackModels.image,
      video: syncedModels.video.length > 0 ? syncedModels.video : fallbackModels.video,
    }),
    [fallbackModels, syncedModels],
  );

  const currentDisplayModels = modelPools[activeTab] || [];
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
  const isChatTab = activeTab === 'chat';
  const isSubmitPending = (isChatTab && isGenerating) || isUploadingImage;
  const isVideoModel =
    typeof currentModelName === 'string' && currentModelName.includes('video');
  const isGrokImagineVideoModel = currentModelName === 'grok-imagine-1.0-video';
  const currentImageUploadLimit = getCreativeCenterImageUploadLimit(currentModelName);
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
        snapshot.aspectRatio = sourceParams.aspectRatio || 'auto';
        if (snapshot.aspectRatio === 'auto') {
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
        if (
          !ADOBE_IMAGE_ASPECT_RATIO_OPTIONS.some(
            (option) => option.value === next.aspectRatio,
          )
        ) {
          next.aspectRatio = 'auto';
        }
        if (
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
          !GENERIC_VIDEO_SECONDS_OPTIONS.some(
            (option) => option.value === next.videoSeconds,
          )
        ) {
          next.videoSeconds = '10';
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

    try {
      await API.put(
        API_ENDPOINTS.CREATIVE_CENTER_HISTORY,
        {
          tab: tabKey,
          model_name: activeSession?.model_name || '',
          group: activeSession?.group || '',
          prompt: activeSession?.prompt || '',
          payload: normalizedSnapshot.payload,
        },
        {
          headers: {
            'New-API-User': getUserIdFromLocalStorage(),
          },
        },
      );
    } catch (error) {
      console.error('Failed to save creative center history:', error);
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
      payload,
    };

    try {
      await API.put(API_ENDPOINTS.CREATIVE_CENTER_HISTORY, requestBody, {
        headers: {
          'New-API-User': getUserIdFromLocalStorage(),
        },
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
      console.error('Failed to save creative center history:', error);
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
    setImageRecords((prev) =>
      prev.map((record) => {
        if (record.id !== recordId) {
          return record;
        }

        let hasChanged = false;
        const nextImages = record.images.map((task) => {
          if (task.id !== taskId) {
            return task;
          }

          hasChanged = true;
          return {
            ...task,
            ...(typeof taskPatch === 'function' ? taskPatch(task) : taskPatch),
          };
        });

        if (!hasChanged) {
          return record;
        }

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
      }),
    );
  };

  const patchVideoTask = (recordId, taskId, taskPatch) => {
    setVideoRecords((prev) =>
      prev.map((record) => {
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
      }),
    );
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
    const url =
      dataPayload.url ||
      dataPayload.result_url ||
      dataPayload.video_url ||
      dataPayload.output_url ||
      dataPayload?.metadata?.url ||
      dataPayload?.metadata?.remote_url ||
      rootPayload?.url ||
      rootPayload?.result_url ||
      rootPayload?.video_url ||
      rootPayload?.output_url ||
      rootPayload?.metadata?.url ||
      rootPayload?.metadata?.remote_url ||
      '';
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

    return {
      status,
      progress,
      url,
      content,
      error,
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

  const handleImageFileChange = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';

    if (files.length === 0) {
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

  useEffect(() => {
    videoRecords.forEach((record) => {
      record.tasks.forEach((task) => {
        const queryTaskId = task.taskId || task.id;
        const shouldPoll =
          Boolean(queryTaskId) &&
          task.pollable !== false &&
          ACTIVE_VIDEO_POLL_STATUSES.has(normalizeVideoTaskStatus(task.status));

        if (!shouldPoll || videoPollersRef.current.has(task.id)) {
          return;
        }

        const controller = {
          active: true,
          timer: null,
        };
        videoPollersRef.current.set(task.id, controller);

        const pollTask = async () => {
          if (!controller.active) {
            return;
          }

          try {
            const response = await API.get(
              `${API_ENDPOINTS.VIDEO_GENERATIONS}/${encodeURIComponent(queryTaskId)}`,
              {
                skipErrorHandler: true,
                headers: {
                  'New-API-User': getUserIdFromLocalStorage(),
                },
              },
            );

            if (!controller.active) {
              return;
            }

            const nextTaskState = parseVideoFetchPayload(response);
            const nextStatus = normalizeVideoTaskStatus(nextTaskState.status);
            const isCompleted = nextStatus === 'completed' || Boolean(nextTaskState.url);
            const isFailed = nextStatus === 'failed';

            if (isCompleted && shouldUseEstimatedVideoProgress(record.modelName)) {
              patchVideoTask(record.id, task.id, (currentTask) => ({
                status: 'finalizing',
                progress: 96,
                url: '',
                resultUrl: nextTaskState.url || currentTask.resultUrl || currentTask.url,
                content: nextTaskState.content || currentTask.content,
                error: '',
                finalizingAt: Date.now(),
                pollable: false,
              }));
              window.setTimeout(() => {
                patchVideoTask(record.id, task.id, (currentTask) => ({
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
              patchVideoTask(record.id, task.id, (currentTask) => ({
                status: isCompleted ? 'completed' : isFailed ? 'failed' : nextStatus,
                progress: isCompleted
                  ? 100
                  : nextTaskState.progress ?? currentTask.progress ?? 0,
                url: isCompleted ? (nextTaskState.url || currentTask.url) : currentTask.url,
                content: nextTaskState.content || currentTask.content,
                error: isFailed ? (nextTaskState.error || currentTask.error || '任务生成失败') : '',
                finalizingAt: 0,
                pollable: !(isCompleted || isFailed),
              }));
            }

            if (isCompleted || isFailed) {
              controller.active = false;
              if (controller.timer) {
                window.clearTimeout(controller.timer);
              }
              videoPollersRef.current.delete(task.id);
              return;
            }
          } catch (error) {
            if (!controller.active) {
              return;
            }
            console.error('Failed to poll creative center video task:', error);
          }

          controller.timer = window.setTimeout(pollTask, 2000);
        };

        pollTask();
      });
    });

    const activeTaskIds = new Set(
      videoRecords.flatMap((record) =>
        record.tasks
          .filter((task) => {
            const queryTaskId = task.taskId || task.id;
            return (
              Boolean(queryTaskId) &&
              task.pollable !== false &&
              ACTIVE_VIDEO_POLL_STATUSES.has(normalizeVideoTaskStatus(task.status))
            );
          })
          .map((task) => task.id),
      ),
    );

    videoPollersRef.current.forEach((controller, taskId) => {
      if (!activeTaskIds.has(taskId)) {
        controller.active = false;
        if (controller.timer) {
          window.clearTimeout(controller.timer);
        }
        videoPollersRef.current.delete(taskId);
      }
    });
  }, [videoRecords]);

  const handleReuseRecord = (record) => {
    if (!record) {
      return;
    }

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
      } catch (error) {
        console.error('Failed to load creative center history:', error);
        historyHydratedRef.current = true;
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
    }, 800);

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
    }, 800);

    return () => window.clearTimeout(timer);
  }, [videoPersistSignature, isLoggedIn]);

  const handleSubmit = async () => {
    const uploadedImageUrls = uploadedImages
      .filter((item) => item?.status === 'uploaded' && item?.url)
      .map((item) => item.url);
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
      setChatMessages(prev => [...prev, userMsg]);
      try {
        const payload = createBasePayload(
          currentPrompt,
          params,
          currentModelName,
          'chat',
          currentUploadedImageUrls,
        );
        const data = await postCreativeRequest(API_ENDPOINTS.CHAT_COMPLETIONS, payload);
        const choice = data?.choices?.[0];
        const processed = processThinkTags(
          choice?.message?.content || '',
          choice?.message?.reasoning_content || choice?.message?.reasoning || '',
        );
        const content =
          [processed.reasoningContent, processed.content].filter(Boolean).join('\n\n') ||
          '模型已返回响应，但未解析到可展示内容。';
        const assistantMsg = {
          role: 'assistant',
          content,
          id: Date.now() + 1,
        };
        const nextMessages = [...chatMessages, userMsg, assistantMsg];
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
        const nextMessages = [...chatMessages, userMsg, errorMsg];
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
      const recordId = createCreativeRecordId('image');
      const pendingRecord = {
        id: recordId,
        prompt: currentPrompt,
        modelName: currentModelName,
        group: activeGroup,
        params: currentParamsSnapshot,
        images: Array.from({ length: generationCount }, (_, index) => ({
          id: createCreativeRecordId(`image-task-${index + 1}`),
          url: '',
          status: useEstimatedImageProgress ? 'submitted' : 'generating',
          progress: useEstimatedImageProgress ? 3 : 0,
          error: '',
          resultUrl: '',
          requestId: '',
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
      const pendingRecords = [...imageRecords, pendingRecord];
      setImageRecords(pendingRecords);
      setCollapsedImageRecordIds((prev) => ({
        ...prev,
        [recordId]: false,
      }));

      try {
        const batchSeedBase = createBatchSeedBase();
        const imageTasks = Array.from({ length: generationCount }, (_, index) =>
          (async () => {
            const taskId = pendingRecord.images[index].id;
            const requestSeed = createTaskSeed(batchSeedBase, index);
            const requestUser = createTaskRequestUser(batchSeedBase, index);
            const requestId = createTaskRequestId(batchSeedBase, index);
            const submittedAt = Date.now();
            const estimateStartAt = submittedAt + index * CREATIVE_BATCH_REQUEST_SPACING_MS;
            const basePayload = createBasePayload(
              currentPrompt,
              currentParamsSnapshot,
              currentModelName,
              'image',
              currentUploadedImageUrls,
            );
            const useAdobeChatImageEditRequest =
              ADOBE_CHAT_IMAGE_EDIT_MODELS.has(currentModelName) &&
              currentUploadedImageUrls.length > 0;
            const payload = useAdobeChatImageEditRequest
              ? {
                  model: currentModelName,
                  group: activeGroup,
                  stream: false,
                  messages: basePayload.messages,
                }
              : isGrokImageEditModel
                ? {
                    model: currentModelName,
                    group: activeGroup,
                    prompt: currentPrompt || 'Edit the provided media.',
                    n: 1,
                    response_format: 'url',
                    request_id: requestId,
                    seed: requestSeed,
                    user: requestUser,
                  }
                : {
                    model: currentModelName,
                    group: activeGroup,
                    prompt: currentPrompt,
                    n: 1,
                    response_format: 'url',
                    request_id: requestId,
                    seed: requestSeed,
                    user: requestUser,
                  };
            if (!isGrokImageEditModel && !useAdobeChatImageEditRequest && basePayload.size) {
              payload.size = basePayload.size;
            }
            if (isGrokImageEditModel) {
              if (currentUploadedImageUrls.length === 1) {
                payload.image = currentUploadedImageUrls[0];
              } else if (currentUploadedImageUrls.length > 1) {
                payload.image = currentUploadedImageUrls;
              }
            } else if (useAdobeChatImageEditRequest) {
              if (basePayload.aspect_ratio) {
                payload.aspect_ratio = basePayload.aspect_ratio;
              }
              if (basePayload.output_resolution) {
                payload.output_resolution = basePayload.output_resolution;
              }
            } else {
              if (basePayload.aspect_ratio) {
                payload.aspect_ratio = basePayload.aspect_ratio;
              }
              if (basePayload.output_resolution) {
                payload.output_resolution = basePayload.output_resolution;
              }
              if (currentUploadedImageUrls[0]) {
                payload.image = currentUploadedImageUrls[0];
              }
            }

            patchImageTask(recordId, taskId, {
              requestId,
              requestPollable:
                ADOBE_IMAGE_MODELS.has(currentModelName) &&
                !useAdobeChatImageEditRequest,
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
            const data = await postCreativeRequest(
              isGrokImageEditModel
                ? API_ENDPOINTS.IMAGE_EDITS
                : useAdobeChatImageEditRequest
                  ? API_ENDPOINTS.CHAT_COMPLETIONS
                  : API_ENDPOINTS.IMAGE_GENERATIONS,
              payload,
              {
                'X-Request-Id': requestId,
              },
            );
            const imageUrls = extractImageUrlsFromCreativeResponse(data);

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
              url: imageUrls[0] || '',
              status: imageUrls[0] ? 'completed' : 'failed',
              progress: 100,
              error: imageUrls[0] ? '' : '未获取到图片结果',
              resultUrl: imageUrls[0] || '',
              finalizingAt: 0,
              progressUnavailable: false,
              requestPollable: false,
            });
          })()
            .catch(() => {
              patchImageTask(recordId, pendingRecord.images[index].id, {
                status: 'failed',
                progress: 100,
                error: '请求失败，请稍后再试。',
                finalizingAt: 0,
                progressUnavailable: false,
                requestPollable: false,
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
      const recordId = createCreativeRecordId('video');
      const pendingRecord = {
        id: recordId,
        prompt: currentPrompt,
        modelName: currentModelName,
        group: activeGroup,
        params: currentParamsSnapshot,
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
          requestId: '',
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
      const pendingRecords = [...videoRecords, pendingRecord];
      setVideoRecords(pendingRecords);
      setCollapsedVideoRecordIds((prev) => ({
        ...prev,
        [recordId]: false,
      }));

      try {
        const batchSeedBase = createBatchSeedBase();
        const videoRequests = Array.from({ length: generationCount }, (_, index) =>
          (async () => {
            const localTaskId = pendingRecord.tasks[index].id;
            const requestSeed = createTaskSeed(batchSeedBase, index);
            const requestUser = createTaskRequestUser(batchSeedBase, index);
            const requestId = createTaskRequestId(batchSeedBase, index);
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

            if (isAdobeVideoModel) {
              basePayload.seed = requestSeed;
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

            const payload = {
              model: currentModelName,
              group: activeGroup,
              prompt: currentPrompt,
              request_id: requestId,
              seed: requestSeed,
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
            if (
              currentModelName === 'grok-imagine-1.0-video' &&
              currentUploadedImageUrls.length > 0
            ) {
              payload.image_reference = currentUploadedImageUrls;
            } else if (currentUploadedImageUrls[0]) {
              payload.image = currentUploadedImageUrls[0];
            }
            patchVideoTask(recordId, localTaskId, {
              requestId,
              requestPollable: false,
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
            data = await postCreativeRequest(API_ENDPOINTS.VIDEO_GENERATIONS, payload, {
              'X-Request-Id': requestId,
            });
            const submitPayload =
              data?.data && typeof data.data === 'object' ? data.data : data;
            const immediateResultUrl =
              submitPayload?.url ||
              submitPayload?.video_url ||
              submitPayload?.result_url ||
              '';
            const normalizedStatus = normalizeVideoTaskStatus(
              submitPayload?.status ||
                (immediateResultUrl ? 'completed' : 'submitted'),
            );
            if (useEstimatedVideoProgress && immediateResultUrl) {
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
              status: immediateResultUrl ? 'completed' : normalizedStatus,
              url: immediateResultUrl || '',
              content: submitPayload?.message || '',
              progress:
                immediateResultUrl
                  ? 100
                  : parseProgressValue(submitPayload?.progress) ?? 0,
              error: '',
              resultUrl: immediateResultUrl || '',
              requestId,
              finalizingAt: 0,
              progressUnavailable: false,
              requestPollable: false,
              pollable:
                !immediateResultUrl &&
                Boolean(submitPayload?.task_id || submitPayload?.id),
            });
          })()
            .catch((requestError) => {
              patchVideoTask(recordId, pendingRecord.tasks[index].id, {
                status: 'failed',
                url: '',
                content: `请求失败：${requestError.message || '请稍后再试。'}`,
                progress: 100,
                error: requestError.message || '请稍后再试。',
                finalizingAt: 0,
                progressUnavailable: false,
                requestPollable: false,
                pollable: false,
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

  return (
    <div className='flex h-[calc(100vh-64px)] min-h-[calc(100vh-64px)] w-full bg-slate-50 text-slate-800 font-sans'>
      <aside className='relative z-10 flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white'>
        <div className='p-6'>
          <div className='flex items-center gap-2'>
            <div className='h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200'>
              <Sparkles size={20} />
            </div>
            <h1 className='text-xl font-black tracking-tight text-slate-900'>创作中心</h1>
          </div>
          <p className='mt-1.5 text-xs font-medium text-slate-400'>释放你的灵感与创意</p>
        </div>

        <nav className='flex justify-around border-b border-slate-100 pb-4 px-2'>
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
                className={`relative flex flex-col items-center gap-1.5 transition-all ${active ? 'text-blue-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <div className={`p-2.5 rounded-2xl transition-colors ${active ? 'bg-blue-50' : 'bg-transparent'}`}>
                  <Icon size={22} strokeWidth={2.5} />
                </div>
                <span className='text-[12px] font-bold'>{tab.label}</span>
                {tab.badge && <span className='absolute -right-2 -top-1 rounded-full bg-orange-500 px-1.5 py-0.5 text-[8px] font-bold text-white shadow-sm'>{tab.badge}</span>}
              </button>
            );
          })}
        </nav>

        <div className='border-b border-slate-100 px-4 py-4'>
          <div className='relative flex flex-wrap items-center gap-3'>
            <button
              type='button'
              onClick={() => setIsSessionPanelOpen((prev) => !prev)}
              disabled={isSubmitPending}
              className='inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300'
            >
              <History size={16} />
              历史会话
            </button>
            <button
              type='button'
              onClick={() => createCreativeSession(activeTab)}
              disabled={isSubmitPending}
              className='inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300'
            >
              <Plus size={16} />
              新建会话
            </button>

            {isSessionPanelOpen && (
              <div className='absolute left-0 right-0 top-14 z-30 rounded-[1.75rem] border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-200/80'>
                <div className='mb-3 px-2'>
                  <div className='text-sm font-bold text-slate-800'>历史会话</div>
                  <div className='text-xs text-slate-400'>仅删除会话，图片视频资源仍保留</div>
                </div>
                <div className='max-h-[420px] space-y-2 overflow-y-auto pr-1 custom-scrollbar'>
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
                          className={`rounded-2xl border px-3 py-3 transition ${
                            isCurrentSession
                              ? 'border-blue-200 bg-blue-50/80'
                              : 'border-slate-200 bg-slate-50/70 hover:bg-white'
                          }`}
                        >
                          <button
                            type='button'
                            onClick={() => openCreativeSession(activeTab, session.id)}
                            disabled={isSubmitPending}
                            className='min-w-0 w-full text-left disabled:cursor-not-allowed'
                          >
                            <div className='truncate text-sm font-semibold text-slate-700'>
                              {session.name || '未命名会话'}
                            </div>
                            <div className='mt-1 truncate text-xs text-slate-400'>
                              {formatCreativeSessionMeta(activeTab, session)}
                              {sessionTime ? ` · ${sessionTime}` : ''}
                            </div>
                          </button>
                          <div className='mt-3 flex items-center justify-end gap-2'>
                            <button
                              type='button'
                              onClick={() => renameCreativeSession(activeTab, session.id)}
                              disabled={isSubmitPending}
                              className='rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300'
                            >
                              重命名
                            </button>
                            <button
                              type='button'
                              onClick={() => deleteCreativeSession(activeTab, session.id)}
                              disabled={isSubmitPending}
                              className='rounded-full border border-slate-200 p-2 text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-500'
                              title='只删除会话，图片视频资源仍保留'
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

        </div>

        <div className='flex-1 overflow-y-auto px-4 py-6 space-y-4 custom-scrollbar'>
          <div className='text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-2'>核心创作模型</div>
          {currentDisplayModels.map((model) => (
            <button
              key={model.id}
              onClick={() => setActiveModel(model.id)}
              className={`w-full group flex items-start gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                activeModel === model.id ? 'border-blue-200 bg-blue-50 shadow-sm' : 'border-transparent hover:bg-slate-50'
              }`}
            >
              <div className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${activeModel === model.id ? 'bg-white shadow-sm text-blue-600' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'}`}>
                {model.icon}
              </div>
              <div className='min-w-0'>
                <div className={`text-sm font-bold truncate ${activeModel === model.id ? 'text-blue-900' : 'text-slate-700'}`}>{model.name}</div>
                <p className='mt-1 text-[11px] leading-relaxed text-slate-500 line-clamp-2'>{model.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <main className='relative flex flex-1 flex-col overflow-hidden bg-white/40 backdrop-blur-md'>
        {activeTab === 'chat' && (
          <div className='flex flex-1 flex-col overflow-hidden'>
            <div ref={scrollRef} className='flex-1 overflow-y-auto px-8 pb-10 pt-4 space-y-6 custom-scrollbar'>
              {chatMessages.length === 0 && !isGenerating && (
                <div className='flex h-full items-center justify-center'>
                  <div className='max-w-xl rounded-[2.5rem] border border-slate-200 bg-white/80 px-10 py-12 text-center shadow-[0_20px_80px_rgba(59,130,246,0.08)] backdrop-blur-sm'>
                    <div className='mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-blue-600 shadow-sm'>
                      {selectedModel?.icon || <MessageSquare size={36} />}
                    </div>
                    <div className='text-xs font-bold uppercase tracking-[0.24em] text-slate-400'>
                      当前模型
                    </div>
                    <h3 className='mt-4 text-3xl font-black tracking-tight text-slate-900'>
                      {selectedModel?.name || '对话模型'}
                    </h3>
                    <p className='mt-4 text-sm leading-8 text-slate-500'>
                      {selectedModel?.desc || '这里会显示当前对话模型的介绍，帮助你在开始前快速了解它适合做什么。'}
                    </p>
                  </div>
                </div>
              )}
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-[1.5rem] px-5 py-3.5 shadow-sm transition-all ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-tr-none shadow-blue-100' 
                      : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'
                  }`}>
                    {getMessageImages(msg.content).length > 0 && (
                      <div className='mb-3 grid grid-cols-1 gap-2'>
                        {getMessageImages(msg.content).map((imageUrl, index) => (
                          <img
                            key={`${msg.id}-image-${index}`}
                            src={imageUrl}
                            alt={`uploaded-${index + 1}`}
                            className='max-h-56 rounded-2xl border border-white/20 object-cover'
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
                <div className='flex justify-start animate-pulse'>
                  <div className='bg-white border border-slate-100 rounded-[1.5rem] rounded-tl-none px-5 py-3.5 flex gap-3 items-center text-slate-400 shadow-sm'>
                    <Loader2 size={18} className='animate-spin text-blue-500' />
                    <span className='text-xs font-bold tracking-widest uppercase'>正在深度思考...</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab !== 'chat' && (
          <div ref={scrollRef} className='relative flex-1 overflow-y-auto px-10 pb-10 pt-4 custom-scrollbar'>
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
                        <div className='flex items-start gap-4'>
                          <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-sm'>
                            {recordModel?.icon || <ImageIcon size={22} />}
                          </div>
                          <div className='min-w-0 flex-1'>
                            <div className='rounded-[1.75rem] border border-slate-200 bg-white/90 px-5 py-4 shadow-sm'>
                              <div className='flex items-start justify-between gap-4'>
                                <button
                                  onClick={() => toggleImageRecordCollapsed(record.id)}
                                  className='min-w-0 flex-1 text-left'
                                >
                                  <div className='flex items-start justify-between gap-4'>
                                    <div className='min-w-0'>
                                      <p className='text-[15px] font-semibold leading-7 text-slate-700 whitespace-pre-wrap'>
                                        {record.prompt || '未填写提示词'}
                                      </p>
                                      <div className='mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400'>
                                        <span>{record.modelName || '图片模型'}</span>
                                        {metaSummary ? <span>{metaSummary}</span> : null}
                                        {record.total > 0 ? (
                                          <span>
                                            {record.completedCount || 0} / {record.total} 已完成
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>
                                    <div className='flex shrink-0 items-center gap-3 pl-3 text-xs text-slate-400'>
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
                        <div className='flex items-start gap-4'>
                          <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-sm'>
                            {recordModel?.icon || <Video size={22} />}
                          </div>
                          <div className='min-w-0 flex-1'>
                            <div className='rounded-[1.75rem] border border-slate-200 bg-white/90 px-5 py-4 shadow-sm'>
                              <div className='flex items-start justify-between gap-4'>
                                <button
                                  onClick={() => toggleVideoRecordCollapsed(record.id)}
                                  className='min-w-0 flex-1 text-left'
                                >
                                  <div className='flex items-start justify-between gap-4'>
                                    <div className='min-w-0'>
                                      <p className='text-[15px] font-semibold leading-7 text-slate-700 whitespace-pre-wrap'>
                                        {record.prompt || '未填写提示词'}
                                      </p>
                                      <div className='mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400'>
                                        <span>{record.modelName || '视频模型'}</span>
                                        {metaSummary ? <span>{metaSummary}</span> : null}
                                        {record.total > 0 ? (
                                          <span>
                                            {record.completedCount || 0} / {record.total} 已完成
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>
                                    <div className='flex shrink-0 items-center gap-3 pl-3 text-xs text-slate-400'>
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
              <div className='flex min-h-full items-center justify-center'>
                <div className='max-w-xl rounded-[2.5rem] border border-slate-200 bg-white/80 px-10 py-12 text-center shadow-[0_20px_80px_rgba(59,130,246,0.08)] backdrop-blur-sm'>
                  <div className='mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-blue-600 shadow-sm'>
                    {selectedModel?.icon || (activeTab === 'image' ? <ImageIcon size={36} /> : <Video size={36} />)}
                  </div>
                  <div className='text-xs font-bold uppercase tracking-[0.24em] text-slate-400'>
                    当前模型
                  </div>
                  <h3 className='mt-4 text-3xl font-black tracking-tight text-slate-900'>
                    {selectedModel?.name || (activeTab === 'image' ? '图片模型' : '视频模型')}
                  </h3>
                  <p className='mt-4 text-sm leading-8 text-slate-500'>
                    {selectedModel?.desc || '这里会显示当前模型的介绍，帮助你在开始创作前快速了解它更擅长生成什么内容。'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className='p-8 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent'>
          <div className='mx-auto max-w-4xl'>
            <div className='relative flex flex-col rounded-[2.5rem] bg-white p-5 shadow-2xl shadow-blue-900/5 ring-1 ring-slate-200/80 focus-within:ring-4 focus-within:ring-blue-500/10 focus-within:border-blue-400 transition-all'>
              <input
                ref={fileInputRef}
                type='file'
                accept='image/*'
                multiple
                className='hidden'
                onChange={handleImageFileChange}
              />
              <div className='flex items-end gap-4 px-2'>
                <div className='shrink-0'>
                  <button
                    type='button'
                    onClick={handleUploadButtonClick}
                    className='flex h-24 w-24 items-center justify-center rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50 text-slate-400 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600'
                  >
                    <div className='flex flex-col items-center gap-2'>
                      {isUploadingImage ? (
                        <Loader2 size={20} className='animate-spin' />
                      ) : (
                        <ImagePlus size={20} />
                      )}
                      <span className='text-[11px] font-semibold'>
                        {uploadedImages.length > 0 ? '继续上传' : '上传图片'}
                      </span>
                    </div>
                  </button>
                </div>
                <textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSubmit())}
                  placeholder={!isLoggedIn ? "登录后即可开始对话、图片或视频创作..." : activeTab === 'chat' ? "发送消息..." : "描述你想要的画面..."}
                  className='max-h-60 min-h-[60px] flex-1 resize-none bg-transparent py-3 text-[16px] font-medium leading-relaxed text-slate-800 outline-none placeholder:text-slate-300'
                />
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitPending || (!prompt.trim() && uploadedImages.every((item) => !(item?.status === 'uploaded' && item?.url)))}
                  className='flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl shadow-blue-200 transition-all hover:bg-blue-700 hover:scale-110 active:scale-95 disabled:bg-slate-100 disabled:text-slate-300 disabled:shadow-none'
                >
                  {isSubmitPending ? <Loader2 size={28} className='animate-spin' /> : <ArrowUp size={32} strokeWidth={3} />}
                </button>
              </div>

              {uploadedImages.length > 0 ? (
                <div className='mt-4 flex flex-wrap gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4'>
                  {uploadedImages.map((imageItem) => (
                    <div key={imageItem.id} className='w-24'>
                      <div className='relative h-24 w-24 overflow-hidden rounded-[1.5rem] border border-blue-100 bg-white shadow-sm'>
                        <img
                          src={imageItem.previewUrl || buildCreativeCenterImageDisplayUrl(imageItem.url)}
                          alt={imageItem.name}
                          className='h-full w-full object-cover'
                        />
                        <button
                          onClick={() => removeUploadedImage(imageItem.id)}
                          className='absolute right-2 top-2 rounded-full bg-slate-900/70 p-1 text-white transition hover:bg-slate-900'
                        >
                          <X size={12} />
                        </button>
                      </div>
                      <div className='mt-2 truncate text-center text-[11px] text-slate-500'>
                        {imageItem.status === 'uploading' ? '正在上传' : imageItem.name}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {uploadImageNotice ? (
                <div className='mt-3 px-2 text-xs font-medium text-red-500'>
                  {uploadImageNotice}
                </div>
              ) : null}
              {currentImageUploadLimit ? (
                <div className='mt-2 px-2 text-[11px] text-slate-400'>
                  当前模型最多可上传 {currentImageUploadLimit} 张图片（建议不大于5M/张）
                </div>
              ) : null}

              {!isLoggedIn && (
                <div className='mt-4 flex items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-sm text-blue-700'>
                  <div className='font-medium'>
                    {'\u5f53\u524d\u4ec5\u5f00\u653e\u6d4f\u89c8\uff0c\u53d1\u9001\u5185\u5bb9\u524d\u9700\u8981\u5148\u767b\u5f55\u8d26\u53f7\u3002'}
                  </div>
                  <button
                    onClick={() => {
                      window.location.href = '/login';
                    }}
                    className='shrink-0 rounded-full bg-white px-4 py-1.5 text-xs font-bold text-blue-700 shadow-sm transition hover:bg-blue-100'
                  >
                    {'\u53bb\u767b\u5f55'}
                  </button>
                </div>
              )}
              {activeTab !== 'chat' && (
                <div className='mt-5 flex flex-wrap items-center gap-3 border-t border-slate-50 pt-5 px-2'>
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
                    <div className='rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-500'>
                      比例 跟随图一
                    </div>
                  )}

                  {activeTab === 'image' && isAdobeImageModel && (
                    <>
                      <DropSelectButton
                        menuKey='aspectRatio'
                        icon={<Copy size={14} />}
                        label={`比例 ${getOptionLabel(
                          ADOBE_IMAGE_ASPECT_RATIO_OPTIONS,
                          params.aspectRatio,
                        )}`}
                        value={params.aspectRatio}
                        options={ADOBE_IMAGE_ASPECT_RATIO_OPTIONS}
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
                          GENERIC_VIDEO_SECONDS_OPTIONS,
                          params.videoSeconds,
                        )}`}
                        value={params.videoSeconds}
                        options={GENERIC_VIDEO_SECONDS_OPTIONS}
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

                  <div className='ml-auto text-[10px] text-slate-400 font-bold tracking-widest uppercase'>Enter 发送</div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className='pointer-events-none absolute bottom-8 right-8 z-20'>
          <button
            type='button'
            onClick={handleClearCurrentSession}
            disabled={isSubmitPending}
            title='只删除会话，图片视频资源仍保留'
            className='pointer-events-auto inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-sm font-semibold text-slate-500 shadow-lg shadow-slate-200/60 backdrop-blur-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300'
          >
            <Trash2 size={14} />
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
