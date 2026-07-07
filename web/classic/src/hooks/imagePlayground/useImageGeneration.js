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
  IMAGE_API_ENDPOINTS,
  IMAGE_PAGE_CAPABILITY,
  IMAGE_I2I_CAPABILITY,
  IMAGE_MAX_EDIT_IMAGES,
  IMAGE_GEN_STATUS,
  IMAGE_HISTORY_LIMIT,
  IMAGE_CONV_TURN_LIMIT,
  getSizesForModel,
  parseImageSizeConfig,
  normalizeImageSize,
} from '../../constants/imagePlayground.constants';

// 文生图 / 图生图共用本 hook,按 mode 区分能力过滤、请求端点、是否带底图。
// 两种模式各自独立的历史存储 key,互不串扰。
const CONV_STORAGE_KEY_BASE = 'image_playground_conversations';
const storageKeyFor = (mode) =>
  mode === 'image2image'
    ? `${CONV_STORAGE_KEY_BASE}_i2i`
    : CONV_STORAGE_KEY_BASE;

const loadConversations = (storageKey) => {
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

// base64（data: 开头）图片不落 localStorage，避免撑爆配额；仅保留 url 图。
// 图生图的底图(conv.images / 用户消息 images)也是 base64,同样剥掉——否则一两张
// 上传图就可能超配额,导致整段历史写入失败。刷新后底图丢失的对话不能再续问
// (generate 里对 isI2I 底图为空的续问拦截并提示重开对话)。
const stripImgList = (arr) =>
  Array.isArray(arr)
    ? arr.filter((src) => !String(src).startsWith('data:'))
    : arr;

const stripBase64ForPersist = (list) =>
  list.map((conv) => ({
    ...conv,
    images: stripImgList(conv.images),
    messages: (conv.messages || []).map((m) => {
      if (!m.images || m.images.length === 0) return m;
      const urlImages = m.images.filter(
        (src) => !String(src).startsWith('data:'),
      );
      if (urlImages.length === m.images.length) return m; // 全是 url，原样保留
      return {
        ...m,
        images: urlImages,
        imagesNotPersisted:
          urlImages.length === 0 ? true : m.imagesNotPersisted,
      };
    }),
  }));

const persistConversations = (storageKey, list) => {
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify(stripBase64ForPersist(list.slice(0, IMAGE_HISTORY_LIMIT))),
    );
  } catch (e) {
    // ignore quota errors
  }
};

let idSeq = 0;
const genId = () => `img-${Date.now()}-${idSeq++}`;

export const useImageGeneration = ({ mode = 'text2image' } = {}) => {
  const { t } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const [userState] = useContext(UserContext);

  const isI2I = mode === 'image2image';
  const pageCapability = isI2I ? IMAGE_I2I_CAPABILITY : IMAGE_PAGE_CAPABILITY;
  const storageKey = storageKeyFor(mode);

  const [inputs, setInputs] = useState({
    group: '',
    model: '',
    size: '',
    seed: '', // 随机种子;'' 表示随机(不下发,引擎自动随机)
    negativePrompt: '', // 负向提示词;生图默认不填
    imageUrls: [], // 图生图底图（base64 data-url 数组,≤IMAGE_MAX_EDIT_IMAGES）
  });
  const [groups, setGroups] = useState([]);
  const [models, setModels] = useState([]);
  // 来自 /api/pricing：model -> enable_groups[]（用于分组过滤）
  const [modelGroupsMap, setModelGroupsMap] = useState(new Map());

  // 以「对话」为单位的历史；每个对话 = { id, group, model, size, title, createdAt, updatedAt, messages: [...] }
  // currentConvId 为 null 表示「新对话」（尚未开始生成）
  const [conversations, setConversations] = useState(() =>
    loadConversations(storageKey),
  );
  const [currentConvId, setCurrentConvId] = useState(null);
  const [generating, setGenerating] = useState(false);

  // 当前对话的消息（中间区显示）
  const messages = useMemo(() => {
    const conv = conversations.find((c) => c.id === currentConvId);
    return conv ? conv.messages : [];
  }, [conversations, currentConvId]);

  // 一旦进入某个对话（已生成或打开了历史）即锁定参数，直到「新对话」
  const locked = currentConvId !== null;

  // 当前对话已生成次数 / 是否到达上限
  const turnsUsed = useMemo(
    () => messages.filter((m) => m.role === 'user').length,
    [messages],
  );
  const turnLimitReached = turnsUsed >= IMAGE_CONV_TURN_LIMIT;

  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  const handleInputChange = useCallback((key, value) => {
    // 锁定后不允许修改分组/模型/尺寸
    if (lockedRef.current) return;
    setInputs((prev) => ({ ...prev, [key]: value }));
  }, []);

  // 解析按模型尺寸配置
  const sizeConfig = useMemo(
    () => parseImageSizeConfig(statusState?.status?.ImageModelSizeConfig),
    [statusState?.status?.ImageModelSizeConfig],
  );

  const availableSizes = useMemo(
    () => getSizesForModel(sizeConfig, inputs.model),
    [sizeConfig, inputs.model],
  );

  // 图片模型集合 = 管理员在「图片模型尺寸配置」里声明、且能力含「文生图」的模型。
  // 只认运营设置里的能力声明，不再按后端端点类型识别。
  const imageModelSet = useMemo(() => {
    const set = new Set();
    Object.entries(sizeConfig.models || {}).forEach(([model, cfg]) => {
      const caps = Array.isArray(cfg?.capabilities) ? cfg.capabilities : [];
      if (caps.includes(pageCapability)) set.add(model);
    });
    return set;
  }, [sizeConfig]);

  // 含图片模型的分组集合：对图片模型集合取其 enable_groups 的并集
  const imageGroups = useMemo(() => {
    const set = new Set();
    imageModelSet.forEach((model) => {
      (modelGroupsMap.get(model) || []).forEach((g) => set.add(g));
    });
    return set;
  }, [imageModelSet, modelGroupsMap]);

  // 选中模型变化或尺寸列表变化时，确保 size 合法（锁定时不改动）
  useEffect(() => {
    if (locked) return;
    if (availableSizes.length === 0) return;
    if (!availableSizes.includes(inputs.size)) {
      setInputs((prev) => ({ ...prev, size: availableSizes[0] }));
    }
  }, [availableSizes, inputs.size, locked]);

  // 加载 pricing：构建 model -> 端点类型、model -> 分组 两个映射（覆盖全部模型）
  const loadPricing = useCallback(async () => {
    try {
      const res = await API.get(IMAGE_API_ENDPOINTS.PRICING, {
        skipErrorHandler: true,
      });
      const { success, data } = res.data || {};
      if (!success || !Array.isArray(data)) return;
      const groupsMap = new Map();
      data.forEach((item) => {
        if (!item || !item.model_name) return;
        groupsMap.set(item.model_name, item.enable_groups || []);
      });
      setModelGroupsMap(groupsMap);
    } catch (e) {
      // pricing 不可用时映射为空：分组不再按 enable_groups 收窄（模型仍按能力声明过滤）
    }
  }, []);

  const loadGroups = useCallback(async () => {
    try {
      const res = await API.get(IMAGE_API_ENDPOINTS.USER_GROUPS);
      const { success, data } = res.data;
      if (!success) return;
      const userGroup =
        userState?.user?.group ||
        JSON.parse(localStorage.getItem('user') || '{}')?.group;
      let groupOptions = processGroupsData(data, userGroup);
      // 仅保留含图片模型的分组（auto 始终保留）。
      // enable_groups 含哨兵 "all" 表示该模型对所有分组可用，此时不做过滤。
      const allowAllGroups = imageGroups.has('all');
      if (imageGroups.size > 0 && !allowAllGroups) {
        groupOptions = groupOptions.filter(
          (g) => imageGroups.has(g.value) || g.value === 'auto',
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
  }, [userState, imageGroups, t]);

  const loadModels = useCallback(async () => {
    try {
      const groupParam = inputs.group
        ? `?group=${encodeURIComponent(inputs.group)}`
        : '';
      const res = await API.get(
        `${IMAGE_API_ENDPOINTS.USER_MODELS}${groupParam}`,
      );
      const { success, data } = res.data;
      if (!success) return;
      let list = Array.isArray(data) ? data : [];
      // 严格过滤：仅保留图片模型（后端识别 ∪ 管理员声明）
      list = list.filter((m) => imageModelSet.has(m));
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
  }, [inputs.group, inputs.model, imageModelSet, t]);

  // 初始化：pricing -> groups
  useEffect(() => {
    if (userState?.user) loadPricing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userState?.user]);

  useEffect(() => {
    if (userState?.user) loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userState?.user, imageGroups]);

  useEffect(() => {
    if (userState?.user) loadModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userState?.user, inputs.group, imageModelSet]);

  // 更新某对话内某条消息
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
      persistConversations(storageKey, next);
      return next;
    });
  }, []);

  // 核心：生成图片（追加到当前对话；无当前对话则新建一个并锁定参数）
  const generate = useCallback(
    async (prompt) => {
      const text = (prompt || '').trim();
      if (!text || generating) return;

      // 图生图:底图取自新对话的 inputs.imageUrls;后续追问沿用对话首条锁定的底图。
      let convImages = [];
      let convId = currentConvId;
      let params;
      if (convId == null) {
        if (!inputs.model) {
          showError(t('请先选择一个图片模型'));
          return;
        }
        if (isI2I) {
          const imgs = (inputs.imageUrls || []).filter(Boolean);
          if (imgs.length === 0) {
            showError(t('请先上传至少一张底图'));
            return;
          }
          if (imgs.length > IMAGE_MAX_EDIT_IMAGES) {
            showError(
              t('最多上传 {{count}} 张底图', { count: IMAGE_MAX_EDIT_IMAGES }),
            );
            return;
          }
          convImages = imgs;
        }
        convId = genId();
        params = {
          group: inputs.group,
          model: inputs.model,
          size: normalizeImageSize(inputs.size),
          seed: inputs.seed,
          negativePrompt: inputs.negativePrompt,
          images: convImages,
        };
      } else {
        const conv = conversationsRef.current.find((c) => c.id === convId);
        // 单段对话生成次数上限
        const used = conv
          ? conv.messages.filter((m) => m.role === 'user').length
          : 0;
        if (used >= IMAGE_CONV_TURN_LIMIT) {
          showError(
            t('本轮对话生成次数已达上限（{{count}} 次），请开启新对话', {
              count: IMAGE_CONV_TURN_LIMIT,
            }),
          );
          return;
        }
        params = conv
          ? {
              group: conv.group,
              model: conv.model,
              size: conv.size,
              seed: conv.seed,
              negativePrompt: conv.negativePrompt,
              images: conv.images || [],
            }
          : {
              group: inputs.group,
              model: inputs.model,
              size: normalizeImageSize(inputs.size),
              seed: inputs.seed,
              negativePrompt: inputs.negativePrompt,
              images: convImages,
            };
      }

      // 图生图续问:底图取自锁定的对话;刷新后 base64 底图已从 localStorage 剥离,
      // 此时无法续问,提示重开对话重新上传(避免向后端发空底图被拒)。
      if (isI2I) {
        params.images = (params.images || []).filter(Boolean);
        if (params.images.length === 0) {
          showError(t('底图已失效,请开启新对话并重新上传底图'));
          return;
        }
      }

      const reqId = genId();
      const now = new Date().toISOString();
      const userMsg = {
        id: `${reqId}-u`,
        role: 'user',
        content: text,
        // 图生图:用户消息展示底图
        images: isI2I ? params.images || [] : undefined,
      };
      const asstMsg = {
        id: `${reqId}-a`,
        role: 'assistant',
        status: IMAGE_GEN_STATUS.PENDING,
        model: params.model,
        size: params.size,
        prompt: text,
        images: [],
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
              seed: params.seed,
              negativePrompt: params.negativePrompt,
              images: params.images || [],
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
        next = next.slice(0, IMAGE_HISTORY_LIMIT);
        persistConversations(storageKey, next);
        return next;
      });
      if (currentConvId == null) setCurrentConvId(convId);
      setGenerating(true);

      try {
        const reqBody = {
          model: params.model,
          group: params.group,
          prompt: text,
          size: normalizeImageSize(params.size),
          n: 1,
          // 不强制 response_format：各供应商返回原生格式（url 或 base64），前端均兼容
        };
        // 随机种子:非空即下发(整数);留空则不发,由引擎自动随机。
        if (params.seed !== '' && params.seed != null) {
          reqBody.seed = Number(params.seed);
        }
        // 负向提示词:非空才发(生图默认不填)。gpustackplus 从 Extra 读取,不外泄其它渠道。
        if (params.negativePrompt && params.negativePrompt.trim()) {
          reqBody.negative_prompt = params.negativePrompt.trim();
        }
        // 图生图:走 edits 端点,带底图数组(gpustackplus 后端接受 image 数组)
        if (isI2I) {
          reqBody.image = params.images || [];
        }
        const res = await API.post(
          isI2I
            ? IMAGE_API_ENDPOINTS.IMAGE_EDITS
            : IMAGE_API_ENDPOINTS.IMAGE_GENERATIONS,
          reqBody,
          { skipErrorHandler: true },
        );
        const data = res.data || {};
        const items = Array.isArray(data.data) ? data.data : [];
        const images = items
          .map((it) =>
            it.url
              ? it.url
              : it.b64_json
                ? `data:image/png;base64,${it.b64_json}`
                : null,
          )
          .filter(Boolean);
        if (images.length === 0) {
          throw new Error(t('未返回图片数据'));
        }
        patchConvMessage(convId, `${reqId}-a`, {
          status: IMAGE_GEN_STATUS.SUCCESS,
          images,
        });
      } catch (error) {
        const msg =
          error?.response?.data?.error?.message ||
          error?.message ||
          t('图片生成失败');
        patchConvMessage(convId, `${reqId}-a`, {
          status: IMAGE_GEN_STATUS.FAILED,
          error: msg,
        });
        showError(msg);
      } finally {
        setGenerating(false);
      }
    },
    [currentConvId, inputs, generating, patchConvMessage, storageKey, isI2I, t],
  );

  const regenerate = useCallback((prompt) => generate(prompt), [generate]);

  // 新对话：解锁参数，清空中间区
  const newConversation = useCallback(() => {
    setCurrentConvId(null);
  }, []);

  const clearHistory = useCallback(() => {
    setConversations([]);
    persistConversations(storageKey, []);
    setCurrentConvId(null);
  }, []);

  const deleteHistoryItem = useCallback((id) => {
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      persistConversations(storageKey, next);
      return next;
    });
    setCurrentConvId((cur) => (cur === id ? null : cur));
  }, []);

  // 点击历史：恢复整段对话，并带出当时锁定的分组/模型/尺寸/种子
  const openHistoryItem = useCallback((conv) => {
    setCurrentConvId(conv.id);
    setInputs((prev) => ({
      ...prev,
      group: conv.group != null ? conv.group : prev.group,
      model: conv.model != null ? conv.model : prev.model,
      size: conv.size != null ? conv.size : prev.size,
      seed: conv.seed != null ? conv.seed : prev.seed,
      negativePrompt:
        conv.negativePrompt != null ? conv.negativePrompt : prev.negativePrompt,
    }));
  }, []);

  // 图生图必须先上传底图:新对话(未锁定)且无底图时发送置灰,
  // 避免只填提示词就点发送(点了才报错且 Semi 会清空已输入的提示词)。
  const missingRequiredImage =
    isI2I && !locked && (inputs.imageUrls || []).length === 0;

  return {
    isI2I,
    inputs,
    handleInputChange,
    groups,
    models,
    availableSizes,
    messages,
    conversations,
    generating,
    locked,
    turnLimitReached,
    missingRequiredImage,
    generate,
    regenerate,
    newConversation,
    clearHistory,
    deleteHistoryItem,
    openHistoryItem,
  };
};
