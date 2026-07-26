// 语音合成(TTS)体验区常量。链路复用视频体验区的异步任务门面
// (POST /pg/videos, task_type=tts),仅参数与结果形态不同(音频 .wav)。
// 状态机/轮询/内容地址等通用工具直接复用 videoPlayground.constants。

export {
  VIDEO_API_ENDPOINTS as AUDIO_API_ENDPOINTS,
  VIDEO_STATUS as AUDIO_STATUS,
  VIDEO_POLL_INTERVAL_MS as AUDIO_POLL_INTERVAL_MS,
  normalizeVideoStatus as normalizeAudioStatus,
  parseProgress,
  buildVideoContentUrl as buildAudioContentUrl,
} from './videoPlayground.constants';

// 语音任务比视频快(短句 RTF~3,数秒~数十秒),但排队深时(单实例 FIFO 8)
// 也可能等几分钟;沿用 4s 间隔,上限略低于视频。
export const AUDIO_POLL_MAX_TIMES = 75; // 约 5 分钟

// 四个能力标签(= 体验区子标签页名;中文即值)。区分 IndexTTS-2 的情感合成与 vLLM-Omni
// 家族的语音合成(音色来源/语言合并为一个玩法的面板内选项)/对话/设计。与后端
// constant/model_capability.go 的 AudioCapabilities 保持一致(新增能力两处同步)。
export const AUDIO_EMOTION_CAPABILITY = '情感合成'; // IndexTTS-2(= 原「语音合成」)
// 语音合成:Qwen3-TTS / VoxCPM2 / CosyVoice3 / GLM-TTS / MOSS-TTS-Nano。单模型同时覆盖
// 预设音色 / 声音克隆 / 多语言方言 —— 它们是一次 TTS 请求的不同维度(音色来源 + 语言),
// 不是独立能力,故合并为一个玩法,音色来源与语言在面板内以选项呈现。
export const AUDIO_SYNTHESIS_CAPABILITY = '语音合成';
export const AUDIO_DIALOGUE_CAPABILITY = '双人对话'; // MOSS-TTSD
export const AUDIO_DESIGN_CAPABILITY = '声音设计'; // MOSS-VoiceGenerator

// 兼容旧引用:情感合成即原单一「语音合成」标签。
export const AUDIO_PAGE_CAPABILITY = AUDIO_EMOTION_CAPABILITY;

// 语音合成玩法的「音色来源」两个选项(面板内 radio/toggle)。默认上传克隆(对所有 Omni
// TTS 模型可用;预设音色为 Qwen3-TTS 专属)。
export const AUDIO_VOICE_SOURCE_UPLOAD = 'upload'; // 上传克隆 → metadata.ref_audio(+可选 ref_text)
export const AUDIO_VOICE_SOURCE_PRESET = 'preset'; // 预设音色 → metadata.speaker(标量透传)
export const AUDIO_DEFAULT_VOICE_SOURCE = AUDIO_VOICE_SOURCE_UPLOAD;
export const AUDIO_VOICE_SOURCE_OPTIONS = [
  { value: AUDIO_VOICE_SOURCE_UPLOAD, label: '上传克隆' },
  { value: AUDIO_VOICE_SOURCE_PRESET, label: '预设音色' },
];

// 预置音色:IndexTTS-2 官方 demo 示例音(HuggingFace spaces/IndexTeam/IndexTTS-2-Demo
// 的 examples/,官方仓已随「移除 LFS」提交删除)。文件随前端打包(public/audio-presets/),
// 发送时前端 fetch → base64 → metadata.voice,与上传自定义音频走同一条路。
// 换素材:替换 public/audio-presets/ 下的 wav 并按需改本表 label。
// 注:官方素材无 voice_10(发布时即跳号),label 按连续序号展示,与文件名解耦;
// 试听后建议把 label 换成描述性名字(如「温柔女声」)。
export const PRESET_VOICES = [
  { id: 'voice_01', label: '音色 01', url: '/audio-presets/voice_01.wav' },
  { id: 'voice_02', label: '音色 02', url: '/audio-presets/voice_02.wav' },
  { id: 'voice_03', label: '音色 03', url: '/audio-presets/voice_03.wav' },
  { id: 'voice_04', label: '音色 04', url: '/audio-presets/voice_04.wav' },
  { id: 'voice_05', label: '音色 05', url: '/audio-presets/voice_05.wav' },
  { id: 'voice_06', label: '音色 06', url: '/audio-presets/voice_06.wav' },
  { id: 'voice_07', label: '音色 07', url: '/audio-presets/voice_07.wav' },
  { id: 'voice_08', label: '音色 08', url: '/audio-presets/voice_08.wav' },
  { id: 'voice_09', label: '音色 09', url: '/audio-presets/voice_09.wav' },
  { id: 'voice_11', label: '音色 10', url: '/audio-presets/voice_11.wav' },
  { id: 'voice_12', label: '音色 11', url: '/audio-presets/voice_12.wav' },
];

// 「上传自定义音频」在音色下拉里的特殊值。
export const VOICE_UPLOAD_VALUE = '__upload__';

// 上传参考音大小上限(base64 后随请求体走,过大拖慢提交)。
export const VOICE_UPLOAD_MAX_MB = 10;

// 情感预设:选中某情绪 → 前端拼 one-hot 8 维向量发 metadata.emo_vector。
// 维度次序与 IndexTTS-2 一致:[喜,怒,哀,惧,厌恶,低落,惊喜,平静]
// (官方 webui 的 8 个滑块次序)。空值 = 跟随参考音色,不发情感参数。
export const EMOTION_PRESETS = [
  { value: '', label: '跟随音色(默认)' },
  { value: 'happy', label: '喜', index: 0 },
  { value: 'angry', label: '怒', index: 1 },
  { value: 'sad', label: '哀', index: 2 },
  { value: 'afraid', label: '惧', index: 3 },
  { value: 'disgusted', label: '厌恶', index: 4 },
  { value: 'melancholic', label: '低落', index: 5 },
  { value: 'surprised', label: '惊喜', index: 6 },
  { value: 'calm', label: '平静', index: 7 },
];

// 情感值 → one-hot 8 维向量(强度作为该维的值,其余为 0)。未知/空返回 null(不发)。
export const emotionToVector = (emotion, weight) => {
  const preset = EMOTION_PRESETS.find((e) => e.value === emotion && e.value);
  if (!preset) return null;
  const vec = [0, 0, 0, 0, 0, 0, 0, 0];
  const w =
    typeof weight === 'number' && weight >= 0 && weight <= 1 ? weight : 1;
  vec[preset.index] = w;
  return vec;
};

// 情感强度(emo_alpha)默认值,与官方 demo 默认一致。
export const AUDIO_DEFAULT_EMO_WEIGHT = 0.65;

// 提示词预设(合成文本示例,短剧配音风)。
export const AUDIO_PROMPT_PRESETS = [
  '大家好,欢迎收听今天的节目,我们将带来一段精彩的故事。',
  '你怎么能这样对我?我们说好了要一起走到最后的!',
  '别怕,有我在。无论发生什么,我都会站在你这边。',
  '哈哈哈,真是太有意思了,快跟我说说后来怎么样了?',
];

// 历史 localStorage 键按 mode 区分(各玩法各自独立历史)。旧单一键保留供迁移/兜底。
export const AUDIO_HISTORY_STORAGE_KEY = 'audio_playground_conversations';
export const AUDIO_HISTORY_STORAGE_PREFIX = 'audio_playground_conversations';
export const audioHistoryStorageKey = (mode) =>
  `${AUDIO_HISTORY_STORAGE_PREFIX}_${mode}`;
export const AUDIO_HISTORY_LIMIT = 10; // 对话段数上限
export const AUDIO_CONV_TURN_LIMIT = 10; // 单段对话生成次数上限

// 语音能力枚举(中文即值,也是体验区标签页名)。与后端 constant/model_capability.go 的
// AudioCapabilities 保持一致。新增能力时两处同步。
export const AUDIO_CAPABILITIES = [
  AUDIO_EMOTION_CAPABILITY,
  AUDIO_SYNTHESIS_CAPABILITY,
  AUDIO_DIALOGUE_CAPABILITY,
  AUDIO_DESIGN_CAPABILITY,
];

// mode → 门面契约映射。四个玩法都发 task_type='tts'(POST /pg/videos 异步门面),只在输入
// 面板与所需 metadata 键上不同。与 new-api 任务适配器(relay/channel/task/gpustackplus/
// adaptor.go)的物化逻辑精确对齐:
//   - emotion(情感合成,IndexTTS-2):参考音色 → metadata.voice(必填,materializeTTSInputs);
//     情感参考音 → metadata.emotion_audio(可选);emo_vector/emo_alpha 标量透传。
//   - synthesis(语音合成,Qwen3-TTS/VoxCPM2/CosyVoice3/GLM-TTS/MOSS-TTS-Nano):单玩法覆盖
//     音色来源 + 语言两个维度。音色来源 toggle:
//       · 上传克隆(默认):克隆源 → metadata.ref_audio(materializeOmniTTSInputs);
//         可选参考文本 → metadata.ref_text(标量透传)。
//       · 预设音色:音色 → metadata.speaker(标量透传,非上传;Qwen3-TTS 专属)。
//       两者互斥(选预设不发 ref_audio;选上传不发 speaker)。
//       语言 → metadata.language(标量,可选;留空=模型默认),两种来源都可带。
//   - dialogue(双人对话,MOSS-TTSD):对话脚本([S1]/[S2])作 prompt;说话人1 →
//     metadata.ref_audio + 说话人2 → metadata.ref_audio_2(materializeOmniTTSInputs)。
//   - design(声音设计,MOSS-VoiceGenerator):声线描述 → metadata.instructions(标量,无参考音)。
// 字段说明:
//   engine:indextts(情感合成走 materializeTTSInputs)/ omni(其余走 materializeOmniTTSInputs
//           或纯标量透传)。仅用于文案/校验分支,task_type 恒为 'tts'。
//   needsVoice:情感合成的参考音色(预置/上传,→ metadata.voice,必填)。
//   needsEmotion:情感合成的情感预设 + 强度 UI。
//   needsVoiceSource:语音合成的「音色来源」toggle(上传克隆 | 预设音色),按选择切换下面两项。
//   needsRefAudio:单个克隆参考音上传(→ metadata.ref_audio)。语音合成里由 toggle 决定是否必填。
//   refAudioRequired:该参考音是否必填(synthesis 上传克隆时必填)。
//   needsDualRef:双人对话双参考音上传(ref_audio + ref_audio_2,均必填)。
//   needsSpeaker:预设音色下拉(→ metadata.speaker 标量;synthesis 选预设音色时用)。
//   needsLanguage:语言下拉(→ metadata.language 标量)。
//   needsRefText:可选参考文本(→ metadata.ref_text 标量;synthesis 上传克隆时用)。
//   needsInstructions:声线/情感指令文本(→ metadata.instructions 标量)。design 必填。
//   instructionsRequired:指令是否必填(design 必填)。
export const AUDIO_MODES = {
  emotion: {
    capability: AUDIO_EMOTION_CAPABILITY,
    engine: 'indextts',
    needsVoice: true,
    needsEmotion: true,
    needsVoiceSource: false,
    needsRefAudio: false,
    refAudioRequired: false,
    needsDualRef: false,
    needsSpeaker: false,
    needsLanguage: false,
    needsRefText: false,
    needsInstructions: false,
    instructionsRequired: false,
  },
  synthesis: {
    capability: AUDIO_SYNTHESIS_CAPABILITY,
    engine: 'omni',
    needsVoice: false,
    needsEmotion: false,
    // 语音融合(Qwen3-TTS CustomVoice)只做预设音色 + 语言/方言。不暴露上传克隆:
    // CustomVoice checkpoint 无 speaker encoder 权重,克隆请求会让引擎维度不匹配崩溃
    // (需 Base checkpoint 才支持克隆),故此处仅预设音色(speaker) + 方言(language)。
    // 扩展限制:synthesis 原设计是多模型共享能力,VoxCPM2/CosyVoice3/MOSS-TTS 等靠
    // ref_audio 零样本克隆(无预设音色)。当前只配了 qwen3-tts,故一刀切为预设音色;若将来
    // 接入那些克隆模型,需改为按模型「音色来源」能力区分(后端 AudioModelConfig 加标注,
    // 前端按当前模型动态显示 预设音色下拉 / 克隆上传),而非对整个 tab 一刀切。
    needsVoiceSource: false,
    needsRefAudio: false,
    refAudioRequired: false,
    needsDualRef: false,
    needsSpeaker: true,
    needsLanguage: true,
    needsRefText: false,
    needsInstructions: false,
    instructionsRequired: false,
  },
  dialogue: {
    capability: AUDIO_DIALOGUE_CAPABILITY,
    engine: 'omni',
    needsVoice: false,
    needsEmotion: false,
    needsVoiceSource: false,
    needsRefAudio: false,
    refAudioRequired: false,
    needsDualRef: true,
    needsSpeaker: false,
    needsLanguage: false,
    needsRefText: false,
    needsInstructions: false,
    instructionsRequired: false,
  },
  design: {
    capability: AUDIO_DESIGN_CAPABILITY,
    engine: 'omni',
    needsVoice: false,
    needsEmotion: false,
    needsVoiceSource: false,
    needsRefAudio: false,
    refAudioRequired: false,
    needsDualRef: false,
    needsSpeaker: false,
    needsLanguage: false,
    needsRefText: false,
    needsInstructions: true,
    instructionsRequired: true,
  },
  // 视频配音(LTX-2.3,task_type=v2a):入口挂在语音页,但输入(上传视频)与产物
  // (配好音的视频)是视频形态 —— 页面渲染走 VideoPlaygroundBody(mode='dub',见
  // pages/Audio/index.jsx 分支),不经 useAudioGeneration,本表仅提供 tab 文案。
  dub: {
    capability: '视频配音',
  },
};

// 体验区子标签页顺序(5 个)。
export const AUDIO_TAB_ORDER = [
  'emotion',
  'synthesis',
  'dialogue',
  'design',
  'dub',
];

// 预设音色(语音合成 → 音色来源=预设音色,Qwen3-TTS):随 metadata.speaker 透传,门面不
// 物化、引擎按 voice/speaker 别名读。提供常用列表 + 允许自由输入。
// 预设音色 = Qwen3-TTS CustomVoice checkpoint 内置的 9 个说话人(与引擎
// /v1/audio/voices 返回一致;此前只列 6 个且含引擎不存在的 chelsie/ethan,已修正)。
export const AUDIO_SPEAKER_PRESETS = [
  { value: 'vivian', label: 'Vivian' },
  { value: 'ryan', label: 'Ryan' },
  { value: 'aiden', label: 'Aiden' },
  { value: 'serena', label: 'Serena' },
  { value: 'dylan', label: 'Dylan' },
  { value: 'eric', label: 'Eric' },
  { value: 'ono_anna', label: 'Ono Anna' },
  { value: 'sohee', label: 'Sohee' },
  { value: 'uncle_fu', label: 'Uncle Fu' },
];
export const AUDIO_DEFAULT_SPEAKER = 'vivian';

// 口音(语音融合):TTS 不翻译,文本什么语言就念什么,引擎 Auto 自动识别语言,故不让用户选
// 语言(英文文本选日文无意义)。用户唯一有意义的主动选择是「中文方言口音」——同一段中文用
// 普通话(=自动)/北京话/四川话念,口音不同。value 是引擎 supported_languages 枚举(引擎对
// language 做 .title() 归一化,serving_speech.py:1648)。方言仅对中文文本生效;当前
// checkpoint 只有北京话/四川话两种(能力由 checkpoint 的 codec_language_id 决定,换
// checkpoint 可扩;非中文文本请留「自动」)。
export const AUDIO_LANGUAGES = [
  { value: '', label: '自动' },
  { value: 'Beijing_Dialect', label: '北京话' },
  { value: 'Sichuan_Dialect', label: '四川话' },
];
export const AUDIO_DEFAULT_LANGUAGE = '';

// 双人对话(dialogue 玩法)脚本示例:含 [S1]/[S2] 说话人标记。
export const AUDIO_DIALOGUE_PRESETS = [
  '[S1]今天天气真不错,我们出去走走吧。[S2]好啊,正好可以透透气。',
  '[S1]你听说了吗?公司要搬新办公室了。[S2]真的假的?什么时候的事?',
];

// 声音设计(design 玩法)声线描述示例。
export const AUDIO_DESIGN_PRESETS = [
  '一位温柔知性的中年女性,声音低沉富有磁性,语速平缓',
  '活泼开朗的少年,声音清亮,语速偏快,充满活力',
  '威严沉稳的老者,声音略带沙哑,吐字缓慢有力',
];

// ── 一键示例(带预置文件/参数)────────────────────────────────────────────
// 示例对象:{ label(按钮名), prompt(填入输入框的合成文本), params?(直接写入 inputs 的
// 标量字段), files?(inputs 文件字段 → 素材 URL;点击时 fetch→base64 写入) }。ChatArea
// 兼容纯字符串示例(向后兼容)。素材见 public/audio-presets/ 与 public/playground-samples/。

// 情感合成:①情感参考音驱动(emo_sad.wav)②情感向量驱动 ③纯预置音色。参考音色走
// voicePreset(generate 内解析),情感参考音走 emotionAudioData(→ metadata.emotion_audio)。
export const AUDIO_EMOTION_EXAMPLES = [
  {
    label: '悲伤·情感参考音',
    prompt: '酒楼丧尽天良,开始借机竞拍房间,哎,一群蠢货。',
    params: {
      voicePreset: 'voice_07',
      emotion: '',
      emotionAudioName: 'emo_sad.wav',
    },
    files: { emotionAudioData: '/audio-presets/emo_sad.wav' },
  },
  {
    label: '愤怒·情感向量',
    prompt: '你到底在搞什么?这件事必须现在给我一个交代!',
    params: { voicePreset: 'voice_08', emotion: 'angry', emoWeight: 0.7 },
  },
  {
    label: '平静·预置音色',
    prompt:
      '这个呀,就是我们精心制作准备的纪念品,大家可以看到这个色泽和材质,多么光彩照人。',
    params: { voicePreset: 'voice_03', emotion: '' },
  },
];

// 语音融合:预设音色(speaker)+ 可选方言(language)。展示不同音色与方言组合。
export const AUDIO_SYNTHESIS_EXAMPLES = [
  {
    label: '预设音色 Vivian',
    prompt: '其实我真的有发现,我是一个特别善于观察别人情绪的人。',
    params: { speaker: 'vivian' },
  },
  {
    label: '男声 Ryan',
    prompt: '大家好,欢迎来到今天的节目,我们准备了很多精彩的内容。',
    params: { speaker: 'ryan' },
  },
  {
    label: '四川话·Serena',
    prompt: '今天天气巴适得很,不如一起出去耍哈嘛。',
    params: { speaker: 'serena', language: 'Sichuan_Dialect' },
  },
];

// 双人对话:两位说话人参考音(MOSS-TTSD 官方示例)。refAudioData/refAudio2Data →
// metadata.ref_audio / ref_audio_2;脚本用 [S1]/[S2] 标记。
export const AUDIO_DIALOGUE_EXAMPLES = [
  {
    label: '双人对话',
    prompt: '[S1]今天天气真不错,我们出去走走吧。[S2]好啊,正好可以透透气。',
    params: {
      refAudioName: 'mosstts-speaker1.wav',
      refAudio2Name: 'mosstts-speaker2.wav',
    },
    files: {
      refAudioData: '/playground-samples/audio/mosstts-speaker1.wav',
      refAudio2Data: '/playground-samples/audio/mosstts-speaker2.wav',
    },
  },
];

// 声音设计:prompt=要合成的文本;声线描述 → instructions(必填,→ metadata.instructions)。
export const AUDIO_DESIGN_EXAMPLES = [
  {
    label: '美食节目主持',
    prompt:
      '亲爱的观众们,今天我要为大家做一道传说中的龙须面,请大家仔细观看我的每一个动作。',
    params: {
      instructions:
        '热情的美食节目主持人,语调生动活泼,充满对美食的热爱和专业精神。',
    },
  },
  {
    label: '温柔知性女声',
    prompt: '夜深了,愿你放下一天的疲惫,好好休息,明天又是崭新的一天。',
    params: {
      instructions: '一位温柔知性的中年女性,声音低沉富有磁性,语速平缓。',
    },
  },
];

// 兜底默认:未在「语音模型配置」里显式配置时使用。maxChars=0 表示不限制。
export const AUDIO_DEFAULT_MAX_CHARS = 2000;
export const AUDIO_DEFAULT_REF_AUDIO_MB = VOICE_UPLOAD_MAX_MB;

// 解析 status 中的 AudioModelConfig(字符串或对象)。形如:
//   { default: { maxChars, refAudioMaxMB }, models: { <model>: { capabilities:[], maxChars, refAudioMaxMB } } }
export const parseAudioModelConfig = (raw) => {
  const empty = {
    default: {
      maxChars: AUDIO_DEFAULT_MAX_CHARS,
      refAudioMaxMB: AUDIO_DEFAULT_REF_AUDIO_MB,
    },
    models: {},
  };
  if (!raw) return empty;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const def = parsed.default || {};
    const models = {};
    if (parsed.models && typeof parsed.models === 'object') {
      Object.entries(parsed.models).forEach(([name, cfg]) => {
        models[name] = {
          capabilities: normalizeList(cfg?.capabilities),
          maxChars: toPositiveInt(cfg?.maxChars),
          refAudioMaxMB: toPositiveInt(cfg?.refAudioMaxMB),
        };
      });
    }
    return {
      default: {
        maxChars: toPositiveInt(def.maxChars) ?? AUDIO_DEFAULT_MAX_CHARS,
        refAudioMaxMB:
          toPositiveInt(def.refAudioMaxMB) ?? AUDIO_DEFAULT_REF_AUDIO_MB,
      },
      models,
    };
  } catch (e) {
    return empty;
  }
};

// 解析非负整数;非法/空返回 null(供 ?? 兜底)。
const toPositiveInt = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

// 复用视频配置的列表规范化(去空格/去空/去重)。
const normalizeList = (list) =>
  Array.isArray(list)
    ? Array.from(new Set(list.map((x) => String(x).trim()).filter(Boolean)))
    : [];

// 指定能力(= 当前 tab)的语音模型集合(勾选了该能力的模型)。未传 capability 时回退到
// 情感合成(兼容旧调用)。
export const getAudioModelSet = (
  config,
  capability = AUDIO_EMOTION_CAPABILITY,
) => {
  const set = new Set();
  Object.entries(config?.models || {}).forEach(([model, cfg]) => {
    const caps = Array.isArray(cfg?.capabilities) ? cfg.capabilities : [];
    if (caps.includes(capability)) set.add(model);
  });
  return set;
};

// 字数上限:按模型配置 → 全局默认 → 兜底常量。0 表示不限制。
export const getMaxCharsForModel = (config, model) => {
  const m = config?.models?.[model];
  if (m && m.maxChars != null) return m.maxChars;
  if (config?.default?.maxChars != null) return config.default.maxChars;
  return AUDIO_DEFAULT_MAX_CHARS;
};

// 参考音大小上限(MB):按模型配置 → 全局默认 → 兜底常量。
export const getRefAudioMaxMBForModel = (config, model) => {
  const m = config?.models?.[model];
  if (m && m.refAudioMaxMB != null) return m.refAudioMaxMB;
  if (config?.default?.refAudioMaxMB != null)
    return config.default.refAudioMaxMB;
  return AUDIO_DEFAULT_REF_AUDIO_MB;
};
