export const buildTaskVideoProxyUrl = (taskId) =>
  taskId ? `/v1/videos/${taskId}/content` : '';

export const isDirectHttpUrl = (url) =>
  typeof url === 'string' && /^https?:\/\//.test(url);

export const isTaskVideoProxyUrl = (url, taskId) =>
  typeof url === 'string' &&
  typeof taskId === 'string' &&
  taskId !== '' &&
  url.includes(`/v1/videos/${taskId}/content`);

const pickHttpUrl = (value) => {
  const url = typeof value === 'string' ? value.trim() : '';
  return isDirectHttpUrl(url) ? url : '';
};

const readPath = (source, path) => {
  if (!source || typeof source !== 'object') {
    return '';
  }
  return pickHttpUrl(path.split('.').reduce((acc, key) => acc?.[key], source));
};

/** 与后端 taskcommon.ExtractVideoURLFromJSON 字段保持一致 */
export const extractVideoUrlFromTaskData = (data) => {
  if (data == null) {
    return '';
  }

  let payload = data;
  if (typeof data === 'string') {
    try {
      payload = JSON.parse(data);
    } catch {
      return pickHttpUrl(data);
    }
  }

  if (typeof payload !== 'object') {
    return '';
  }

  for (const path of [
    'video_url',
    'content.video_url',
    'data.video_url',
    'data.url',
    'remixed_from_video_id',
  ]) {
    const url = readPath(payload, path);
    if (url) {
      return url;
    }
  }

  return '';
};

export const resolveDirectTaskVideoUrl = (record) => {
  const taskId = record?.task_id;
  const candidates = [
    record?.result_url,
    extractVideoUrlFromTaskData(record?.data),
    record?.fail_reason,
  ];

  for (const candidate of candidates) {
    const url = pickHttpUrl(candidate);
    if (url && !isTaskVideoProxyUrl(url, taskId)) {
      return url;
    }
  }

  return '';
};

export const resolveTaskVideoPreview = (record) => {
  const taskId = record?.task_id;
  const proxyUrl = buildTaskVideoProxyUrl(taskId);
  const directUrl = resolveDirectTaskVideoUrl(record);

  if (directUrl) {
    return {
      primary: directUrl,
      fallback: proxyUrl,
    };
  }

  return {
    primary: proxyUrl,
    fallback: '',
  };
};
