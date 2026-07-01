import {
  useState,
  useEffect,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from 'react';
import { useTranslation } from 'react-i18next';
import { StatusContext } from '../../context/Status';
import { UserContext } from '../../context/User';
import {
  API,
  showError,
  processGroupsData,
  processModelsData,
} from '../../helpers';
import {
  VIDEO_API_ENDPOINTS,
  VIDEO_ENDPOINT_TYPE,
  VIDEO_STATUS,
  VIDEO_HISTORY_LIMIT,
  VIDEO_CONV_TURN_LIMIT,
  VIDEO_POLL_INTERVAL_MS,
  VIDEO_POLL_MAX_TIMES,
  parseVideoModelConfig,
  getSizesForVideoModel,
  getDurationsForVideoModel,
  resolveVideoStrategy,
  normalizeVideoSize,
  normalizeVideoStatus,
  parseProgress,
  buildVideoContentUrl,
} from '../../constants/videoPlayground.constants';

const CONV_STORAGE_KEY = 'video_playground_conversations';

const loadConversations = () => {
  try {
    const raw = localStorage.getItem(CONV_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

const persistConversations = (list) => {
  try {
    localStorage.setItem(
      CONV_STORAGE_KEY,
      JSON.stringify(list.slice(0, VIDEO_HISTORY_LIMIT)),
    );
  } catch (e) {
    // ignore quota errors
  }
};

let idSeq = 0;
const genId = () => `vid-${Date.now()}-${idSeq++}`;

// 兼容 OpenAI 错误({error:{message}})与任务错误({code,message,data})两种形态
const extractApiErrMsg = (error, fallback) => {
  const d = error?.response?.data || {};
  return d.error?.message || d.message || error?.message || fallback;
};

export const useVideoGeneration = () => {
  const { t } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const [userState] = useContext(UserContext);

  const [inputs, setInputs] = useState({
    group: '',
    model: '',
    size: '',
    seconds: '',
  });
  const [groups, setGroups] = useState([]);
  const [models, setModels] = useState([]);
  const [modelTypeMap, setModelTypeMap] = useState(new Map());
  const [modelGroupsMap, setModelGroupsMap] = useState(new Map());

  const [conversations, setConversations] = useState(() => loadConversations());
  const [currentConvId, setCurrentConvId] = useState(null);
  const [generating, setGenerating] = useState(false);

  const messages = useMemo(() => {
    const conv = conversations.find((c) => c.id === currentConvId);
    return conv ? conv.messages : [];
  }, [conversations, currentConvId]);

  const locked = currentConvId !== null;

  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  // 当前进行中的轮询：{ convId, msgId, taskId, timer, canceled }
  const activePollRef = useRef(null);

  const handleInputChange = useCallback((key, value) => {
    if (lockedRef.current) return;
    setInputs((prev) => ({ ...prev, [key]: value }));
  }, []);

  const videoConfig = useMemo(
    () => parseVideoModelConfig(statusState?.status?.VideoModelConfig),
    [statusState?.status?.VideoModelConfig],
  );

  const availableSizes = useMemo(
    () => getSizesForVideoModel(videoConfig, inputs.model),
    [videoConfig, inputs.model],
  );
  const availableDurations = useMemo(
    () => getDurationsForVideoModel(videoConfig, inputs.model),
    [videoConfig, inputs.model],
  );

  // 视频模型集合 = 后端识别(openai-video) ∪ 管理员在「视频模型配置」声明的模型
  const videoModelSet = useMemo(() => {
    const set = new Set(Object.keys(videoConfig.models || {}));
    modelTypeMap.forEach((types, model) => {
      if (Array.isArray(types) && types.includes(VIDEO_ENDPOINT_TYPE)) {
        set.add(model);
      }
    });
    return set;
  }, [videoConfig, modelTypeMap]);

  const videoGroups = useMemo(() => {
    const set = new Set();
    videoModelSet.forEach((model) => {
      (modelGroupsMap.get(model) || []).forEach((g) => set.add(g));
    });
    return set;
  }, [videoModelSet, modelGroupsMap]);

  // size 合法性（锁定时不动）
  useEffect(() => {
    if (locked) return;
    if (availableSizes.length && !availableSizes.includes(inputs.size)) {
      setInputs((prev) => ({ ...prev, size: availableSizes[0] }));
    }
  }, [availableSizes, inputs.size, locked]);

  // seconds 合法性
  useEffect(() => {
    if (locked) return;
    if (
      availableDurations.length &&
      !availableDurations.includes(inputs.seconds)
    ) {
      setInputs((prev) => ({ ...prev, seconds: availableDurations[0] }));
    }
  }, [availableDurations, inputs.seconds, locked]);

  const loadPricing = useCallback(async () => {
    try {
      const res = await API.get(VIDEO_API_ENDPOINTS.PRICING, {
        skipErrorHandler: true,
      });
      const { success, data } = res.data || {};
      if (!success || !Array.isArray(data)) return;
      const typeMap = new Map();
      const groupsMap = new Map();
      data.forEach((item) => {
        if (!item || !item.model_name) return;
        typeMap.set(item.model_name, item.supported_endpoint_types || []);
        groupsMap.set(item.model_name, item.enable_groups || []);
      });
      setModelTypeMap(typeMap);
      setModelGroupsMap(groupsMap);
    } catch (e) {
      // 留空：按管理员声明过滤
    }
  }, []);

  const loadGroups = useCallback(async () => {
    try {
      const res = await API.get(VIDEO_API_ENDPOINTS.USER_GROUPS);
      const { success, data } = res.data;
      if (!success) return;
      const userGroup =
        userState?.user?.group ||
        JSON.parse(localStorage.getItem('user') || '{}')?.group;
      let groupOptions = processGroupsData(data, userGroup);
      const allowAllGroups = videoGroups.has('all');
      if (videoGroups.size > 0 && !allowAllGroups) {
        groupOptions = groupOptions.filter(
          (g) => videoGroups.has(g.value) || g.value === 'auto',
        );
      }
      setGroups(groupOptions);
      setInputs((prev) => {
        if (lockedRef.current) return prev;
        const has = groupOptions.some((g) => g.value === prev.group);
        return has ? prev : { ...prev, group: groupOptions[0]?.value || '' };
      });
    } catch (e) {
      showError(t('加载分组失败'));
    }
  }, [userState, videoGroups, t]);

  const loadModels = useCallback(async () => {
    try {
      const groupParam = inputs.group
        ? `?group=${encodeURIComponent(inputs.group)}`
        : '';
      const res = await API.get(
        `${VIDEO_API_ENDPOINTS.USER_MODELS}${groupParam}`,
      );
      const { success, data } = res.data;
      if (!success) return;
      let list = Array.isArray(data) ? data : [];
      list = list.filter((m) => videoModelSet.has(m));
      const { modelOptions, selectedModel } = processModelsData(
        list,
        inputs.model,
      );
      setModels(modelOptions);
      setInputs((prev) => {
        if (lockedRef.current) return prev;
        return prev.model === selectedModel
          ? prev
          : { ...prev, model: selectedModel || '' };
      });
    } catch (e) {
      showError(t('加载模型失败'));
    }
  }, [inputs.group, inputs.model, videoModelSet, t]);

  useEffect(() => {
    if (userState?.user) loadPricing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userState?.user]);
  useEffect(() => {
    if (userState?.user) loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userState?.user, videoGroups]);
  useEffect(() => {
    if (userState?.user) loadModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userState?.user, inputs.group, videoModelSet]);

  // 挂载后为最近一个仍在进行中的任务恢复轮询（刷新/重进页面不丢进度）
  useEffect(() => {
    if (!userState?.user || activePollRef.current) return;
    let best = null; // { convId, msgId, taskId, ts }
    conversationsRef.current.forEach((conv) => {
      (conv.messages || []).forEach((m) => {
        if (
          m.role === 'assistant' &&
          m.taskId &&
          (m.status === VIDEO_STATUS.QUEUED ||
            m.status === VIDEO_STATUS.IN_PROGRESS)
        ) {
          const ts = Number(String(m.id).split('-')[1]) || 0;
          if (!best || ts > best.ts) {
            best = { convId: conv.id, msgId: m.id, taskId: m.taskId, ts };
          }
        }
      });
    });
    if (best) resumePoll(best.convId, best.msgId, best.taskId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userState?.user]);

  const patchConvMessage = useCallback((convId, msgId, patch) => {
    setConversations((prev) => {
      const next = prev.map((c) =>
        c.id === convId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === msgId ? { ...m, ...patch } : m,
              ),
            }
          : c,
      );
      persistConversations(next);
      return next;
    });
  }, []);

  const turnsUsed = useMemo(
    () => messages.filter((m) => m.role === 'user').length,
    [messages],
  );
  const turnLimitReached = turnsUsed >= VIDEO_CONV_TURN_LIMIT;

  const finishPoll = useCallback(() => {
    if (activePollRef.current?.timer) clearTimeout(activePollRef.current.timer);
    activePollRef.current = null;
    setGenerating(false);
  }, []);

  const pollOnce = useCallback(
    async (convId, msgId, taskId, count) => {
      const active = activePollRef.current;
      if (!active || active.canceled || active.taskId !== taskId) return;
      try {
        const res = await API.get(
          `${VIDEO_API_ENDPOINTS.VIDEO_FETCH}/${encodeURIComponent(taskId)}`,
          { skipErrorHandler: true },
        );
        const data = res.data || {};
        // 兼容 OpenAIVideo（顶层）与通用 TaskResponse（data.data）两种形态
        const inner = data.data || {};
        const status = normalizeVideoStatus(data.status || inner.status);
        const progress = parseProgress(
          data.progress != null ? data.progress : inner.progress,
        );

        if (status === VIDEO_STATUS.COMPLETED) {
          patchConvMessage(convId, msgId, {
            status: VIDEO_STATUS.COMPLETED,
            progress: 100,
            videoUrl: buildVideoContentUrl(taskId),
          });
          finishPoll();
          return;
        }
        if (status === VIDEO_STATUS.FAILED) {
          const msg =
            data.error?.message ||
            inner.error?.message ||
            inner.fail_reason ||
            data.fail_reason ||
            t('视频生成失败');
          patchConvMessage(convId, msgId, {
            status: VIDEO_STATUS.FAILED,
            error: msg,
          });
          showError(msg);
          finishPoll();
          return;
        }
        // queued / in_progress
        patchConvMessage(convId, msgId, {
          status: status || VIDEO_STATUS.IN_PROGRESS,
          ...(progress !== undefined ? { progress } : {}),
        });
        if (count >= VIDEO_POLL_MAX_TIMES) {
          // 客户端轮询超时：不判失败，保留可恢复状态，仅标记以便展示「继续获取」；
          // 任务可能仍在后端进行/已完成，用原 taskId 续查即可，无需重新提交。
          patchConvMessage(convId, msgId, { pollTimedOut: true });
          finishPoll();
          return;
        }
      } catch (e) {
        // 轮询瞬时错误：继续重试直至超时
        if (count >= VIDEO_POLL_MAX_TIMES) {
          patchConvMessage(convId, msgId, { pollTimedOut: true });
          finishPoll();
          return;
        }
      }
      const cur = activePollRef.current;
      if (!cur || cur.canceled || cur.taskId !== taskId) return;
      cur.timer = setTimeout(
        () => pollOnce(convId, msgId, taskId, count + 1),
        VIDEO_POLL_INTERVAL_MS,
      );
    },
    [patchConvMessage, finishPoll, t],
  );

  // 为某个仍在进行中的任务（重新）启动轮询：刷新页面或切走再回来时用，
  // 避免进度冻结在最后一次写入的值。已在轮询同一任务则跳过。
  const resumePoll = useCallback(
    (convId, msgId, taskId) => {
      if (!taskId) return;
      const active = activePollRef.current;
      if (active && active.taskId === taskId && !active.canceled) return;
      if (active?.timer) clearTimeout(active.timer);
      // 重新轮询即回到「生成中」，清掉超时标记
      patchConvMessage(convId, msgId, { pollTimedOut: false });
      activePollRef.current = {
        convId,
        msgId,
        taskId,
        timer: null,
        canceled: false,
      };
      setGenerating(true);
      activePollRef.current.timer = setTimeout(
        () => pollOnce(convId, msgId, taskId, 1),
        VIDEO_POLL_INTERVAL_MS,
      );
    },
    [pollOnce, patchConvMessage],
  );

  // 超时任务「继续获取」：用原 taskId 续查当前会话中的该消息（方案 A：直接顶掉当前轮询槽）
  const refetch = useCallback(
    (msgId, taskId) => {
      if (currentConvId == null || !taskId) return;
      resumePoll(currentConvId, msgId, taskId);
    },
    [currentConvId, resumePoll],
  );

  const generate = useCallback(
    async (prompt) => {
      const text = (prompt || '').trim();
      if (!text || generating) return;

      let convId = currentConvId;
      let params;
      if (convId == null) {
        if (!inputs.model) {
          showError(t('请先选择一个视频模型'));
          return;
        }
        convId = genId();
        params = {
          group: inputs.group,
          model: inputs.model,
          size: normalizeVideoSize(inputs.size),
          seconds: inputs.seconds,
        };
      } else {
        const conv = conversationsRef.current.find((c) => c.id === convId);
        const used = conv
          ? conv.messages.filter((m) => m.role === 'user').length
          : 0;
        if (used >= VIDEO_CONV_TURN_LIMIT) {
          showError(
            t('本轮对话生成次数已达上限（{{count}} 次），请开启新对话', {
              count: VIDEO_CONV_TURN_LIMIT,
            }),
          );
          return;
        }
        params = conv
          ? {
              group: conv.group,
              model: conv.model,
              size: conv.size,
              seconds: conv.seconds,
            }
          : {
              group: inputs.group,
              model: inputs.model,
              size: normalizeVideoSize(inputs.size),
              seconds: inputs.seconds,
            };
      }

      const reqId = genId();
      const now = new Date().toISOString();
      const userMsg = { id: `${reqId}-u`, role: 'user', content: text };
      const asstId = `${reqId}-a`;
      const asstMsg = {
        id: asstId,
        role: 'assistant',
        status: VIDEO_STATUS.QUEUED,
        model: params.model,
        size: params.size,
        seconds: params.seconds,
        prompt: text,
        progress: 0,
        taskId: null,
        videoUrl: null,
      };

      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === convId);
        let next;
        if (idx === -1) {
          next = [
            {
              id: convId,
              group: params.group,
              model: params.model,
              size: params.size,
              seconds: params.seconds,
              title: text,
              createdAt: now,
              updatedAt: now,
              messages: [userMsg, asstMsg],
            },
            ...prev,
          ];
        } else {
          const conv = {
            ...prev[idx],
            updatedAt: now,
            messages: [...prev[idx].messages, userMsg, asstMsg],
          };
          next = [conv, ...prev.filter((_, i) => i !== idx)];
        }
        next = next.slice(0, VIDEO_HISTORY_LIMIT);
        persistConversations(next);
        return next;
      });
      if (currentConvId == null) setCurrentConvId(convId);
      setGenerating(true);

      try {
        // 按模型类别只发对应的时长字段：sora→seconds(字符串)，minimax→duration(整数秒)
        const strategy = resolveVideoStrategy(params.model);
        const body = {
          model: params.model,
          group: params.group,
          prompt: text,
          size: normalizeVideoSize(params.size),
        };
        if (strategy.durationField === 'seconds') {
          body.seconds = params.seconds;
        } else {
          body.duration = parseInt(params.seconds, 10) || undefined;
        }
        const res = await API.post(VIDEO_API_ENDPOINTS.VIDEO_GENERATIONS, body, {
          skipErrorHandler: true,
        });
        const data = res.data || {};
        // 兼容两种响应形态：OpenAIVideo（顶层 id/status）与通用 TaskResponse（data.task_id）
        const inner = data.data || {};
        const taskId = data.id || data.task_id || inner.task_id || inner.id;
        if (!taskId) throw new Error(t('提交视频任务失败'));
        const status = normalizeVideoStatus(data.status || inner.status);
        const progress =
          parseProgress(
            data.progress != null ? data.progress : inner.progress,
          ) || 0;
        // 提交即失败：直接标记，不启动轮询
        if (status === VIDEO_STATUS.FAILED) {
          const msg =
            data.error?.message ||
            inner.error?.message ||
            inner.fail_reason ||
            data.fail_reason ||
            t('视频生成失败');
          patchConvMessage(convId, asstId, {
            status: VIDEO_STATUS.FAILED,
            error: msg,
          });
          showError(msg);
          setGenerating(false);
          return;
        }
        patchConvMessage(convId, asstId, { taskId, status, progress });
        activePollRef.current = {
          convId,
          msgId: asstId,
          taskId,
          timer: null,
          canceled: false,
        };
        activePollRef.current.timer = setTimeout(
          () => pollOnce(convId, asstId, taskId, 1),
          VIDEO_POLL_INTERVAL_MS,
        );
      } catch (error) {
        const msg = extractApiErrMsg(error, t('视频生成失败'));
        patchConvMessage(convId, asstId, {
          status: VIDEO_STATUS.FAILED,
          error: msg,
        });
        showError(msg);
        setGenerating(false);
      }
    },
    [currentConvId, inputs, generating, patchConvMessage, pollOnce, t],
  );

  const regenerate = useCallback((prompt) => generate(prompt), [generate]);

  const newConversation = useCallback(() => {
    setCurrentConvId(null);
  }, []);

  const clearHistory = useCallback(() => {
    // 清空历史时若有进行中的轮询，一并停止，避免 generating 卡住导致发送按钮一直禁用
    if (activePollRef.current) activePollRef.current.canceled = true;
    finishPoll();
    setConversations([]);
    persistConversations([]);
    setCurrentConvId(null);
  }, [finishPoll]);

  const deleteHistoryItem = useCallback(
    (id) => {
      // 删除的正是正在轮询的会话时，停止其轮询并复位 generating
      const active = activePollRef.current;
      if (active && active.convId === id) {
        active.canceled = true;
        finishPoll();
      }
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== id);
        persistConversations(next);
        return next;
      });
      setCurrentConvId((cur) => (cur === id ? null : cur));
    },
    [finishPoll],
  );

  const openHistoryItem = useCallback(
    (conv) => {
      setCurrentConvId(conv.id);
      setInputs((prev) => ({
        ...prev,
        group: conv.group != null ? conv.group : prev.group,
        model: conv.model != null ? conv.model : prev.model,
        size: conv.size != null ? conv.size : prev.size,
        seconds: conv.seconds != null ? conv.seconds : prev.seconds,
      }));
      // 若该会话最后一个任务仍在进行中，恢复轮询
      const assts = (conv.messages || []).filter(
        (m) => m.role === 'assistant',
      );
      const last = assts[assts.length - 1];
      if (
        last?.taskId &&
        (last.status === VIDEO_STATUS.QUEUED ||
          last.status === VIDEO_STATUS.IN_PROGRESS)
      ) {
        resumePoll(conv.id, last.id, last.taskId);
      }
    },
    [resumePoll],
  );

  // 卸载时清理轮询
  useEffect(() => {
    return () => {
      if (activePollRef.current?.timer)
        clearTimeout(activePollRef.current.timer);
      activePollRef.current = null;
    };
  }, []);

  return {
    inputs,
    handleInputChange,
    groups,
    models,
    availableSizes,
    availableDurations,
    messages,
    conversations,
    generating,
    locked,
    turnLimitReached,
    generate,
    regenerate,
    refetch,
    newConversation,
    clearHistory,
    deleteHistoryItem,
    openHistoryItem,
  };
};
