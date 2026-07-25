// 能力注册表(设计文档 docs/canvas-orchestration-design.md §3.1,v0.2)。
// 把体验区 19 个已实现能力标签形式化为注册表记录:节点的模型下拉、参数面板、输入校验、
// 请求构建全部由本表驱动,不在业务代码里写能力分支。能力私有的组装逻辑(互斥/联动)
// 收敛在各记录的 postProcess 钩子里,通用层保持零能力分支。
//
// label(中文能力标签)是与后台运营设置对齐的协议键——MediaModelConfig.models[name]
// .capabilities 里存的就是这些中文标签(见 new-api constant/model_capability.go),
// 代码逻辑一律用英文 key,仅在与配置比对/展示时用 label。

import { CanvasNodeType } from "@/app/(user)/canvas/types";

export type CapabilityModality = "image" | "video" | "audio" | "music";
export type CapabilityChannel = "image-generation" | "image-edit" | "task";
export type InputSlotKind = "text" | "image" | "video" | "audio";

export type InputSlot = {
    /** 请求字段映射: "prompt" | "images" | "metadata.audio" | "metadata.src_video" ... */
    key: string;
    kind: InputSlotKind;
    required: boolean;
    /** 多值上限(images / src_ref_images);缺省单值 */
    max?: number;
    /** 面板/校验提示用槽位名 */
    role: string;
};

export type SelectOption = { value: string; label: string };

export type ParamSpec = {
    /** 请求字段映射: "size" | "seconds" | "metadata.sr_ratio" | "metadata.lyrics" ... */
    key: string;
    label: string;
    type: "select" | "number" | "text" | "textarea";
    /** select 选项来源:配置白名单(sizes/durations)或固定列表(可带展示名) */
    options?: "sizes" | "durations" | string[] | SelectOption[];
    placeholder?: string;
    min?: number;
    max?: number;
    step?: number;
    /** 必填参数(如声音设计的声线描述):生成前校验非空 */
    required?: boolean;
    /** 用户未填时兜底下发的默认值(如 AudioX 引擎硬要的 num_inference_steps) */
    defaultValue?: string | number;
    /** 仅供 postProcess 消费,不自动映射进请求体(如情感选择 → emo_vector 需二次加工) */
    virtual?: boolean;
};

/** postProcess 钩子入参:payload 已按通用规则组装完毕,可在此做能力私有的增删改 */
export type PostProcessContext = {
    prompt: string;
    params: Record<string, string | number>;
    slots: Record<string, string[]>;
    metadata: Record<string, unknown>;
    payload: Record<string, unknown>;
};

export type CapabilitySpec = {
    key: string;
    /** 中文能力标签,与 constant/model_capability.go 严格一致(协议键) */
    label: string;
    /** 该能力改名前的旧标签:已按旧标签配置的模型仍匹配到本节点(对齐 classic 的
     * VIDEO_CAPABILITY_LEGACY_ALIASES,否则旧配置在 Canvas 消失直到手动重打标) */
    legacyLabels?: string[];
    modality: CapabilityModality;
    /** 产物节点媒体类型 */
    output: CanvasNodeType;
    channel: CapabilityChannel;
    /** channel === "task" 时显式下发的 metadata.task_type;体验区约定 t2v/i2v/flf2v 靠模型推断不下发 */
    taskType?: string;
    /** 提示词非空时改用的 task_type(AudioX v2a→tv2a / v2m→tv2m,与体验区 resolveTaskType 一致) */
    taskTypeWithPrompt?: string;
    /** 把最终 task_type 同值镜像到 metadata 的另一键(AudioX 引擎另需 audiox_task) */
    mirrorTaskTypeAs?: string;
    /** 提示词为空时的占位文案(门面 prompt 必填;如 svs 无需文本、sr 无提示词) */
    promptFallback?: string;
    inputs: InputSlot[];
    params: ParamSpec[];
    /** 跨槽位约束:keys 中至少一个槽位有值(如 vace 的 源视频/参考图 至少其一) */
    atLeastOne?: { keys: string[]; message: string };
    /** 槽位/参数二选一约束:槽位无值且参数未填 → 报错(如语音合成 克隆参考音/预设音色) */
    requireOneOf?: { slotKey: string; paramKey: string; message: string };
    /** 能力私有的请求体后处理(互斥剔除、参数联动),在通用组装完成后执行 */
    postProcess?: (ctx: PostProcessContext) => void;
};

const PROMPT_SLOT: InputSlot = { key: "prompt", kind: "text", required: true, role: "提示词" };
const OPTIONAL_PROMPT_SLOT: InputSlot = { key: "prompt", kind: "text", required: false, role: "提示词" };

export const CAPABILITIES: CapabilitySpec[] = [
    {
        key: "t2i",
        label: "文生图",
        modality: "image",
        output: CanvasNodeType.Image,
        channel: "image-generation",
        inputs: [PROMPT_SLOT],
        // 图片能力复用画布既有同步生图链路(requestGeneration),参数以其支持为准
        params: [{ key: "size", label: "尺寸", type: "select", options: "sizes" }],
    },
    {
        key: "i2i",
        label: "图生图",
        modality: "image",
        output: CanvasNodeType.Image,
        channel: "image-edit",
        inputs: [PROMPT_SLOT, { key: "image", kind: "image", required: true, max: 5, role: "底图" }],
        params: [],
    },
    {
        key: "t2v",
        label: "文生视频",
        modality: "video",
        output: CanvasNodeType.Video,
        channel: "task",
        // 显式下发 t2v(不靠模型名推断):Bernini 同名模型横跨 t2v 与 v2v/rv2v/r2v,
        // inferTaskType 按名恒判 v2v,故这里显式;对其它 t2v 模型无影响。
        taskType: "t2v",
        inputs: [PROMPT_SLOT],
        params: [
            { key: "size", label: "尺寸", type: "select", options: "sizes" },
            { key: "seconds", label: "时长(秒)", type: "select", options: "durations" },
            { key: "metadata.seed", label: "随机种子", type: "number", placeholder: "留空随机" },
            { key: "metadata.negative_prompt", label: "负向提示", type: "text", placeholder: "可选" },
        ],
    },
    {
        // 图生视频(2026-07 改判 Bernini r2v):参考图(1~3 张)组合主体/服装/道具/场景
        // 生成视频(非首帧约束;首帧约束在「关键帧」)。显式 task_type=r2v(Bernini
        // 模型名推断恒 v2v)。key 沿用 "i2v"(稳定标识,不破坏已保存画布)。
        key: "i2v",
        label: "图生视频",
        modality: "video",
        output: CanvasNodeType.Video,
        channel: "task",
        taskType: "r2v",
        inputs: [PROMPT_SLOT, { key: "metadata.src_ref_images", kind: "image", required: true, max: 3, role: "参考图(1~3 张)" }],
        params: [
            { key: "seconds", label: "时长(秒)", type: "select", options: "durations" },
            { key: "metadata.seed", label: "随机种子", type: "number", placeholder: "留空随机" },
            { key: "metadata.negative_prompt", label: "负向提示", type: "text", placeholder: "可选" },
        ],
    },
    {
        // 关键帧(原「首尾帧」,wan2.2 i2v):仅首帧→i2v、首+尾帧→flf2v,按连接的帧数
        // 派生 task_type 显式下发(同一 i2v 实例,模型名推断分不出)。key 沿用 "flf2v"。
        key: "flf2v",
        label: "关键帧",
        legacyLabels: ["首尾帧"],
        modality: "video",
        output: CanvasNodeType.Video,
        channel: "task",
        inputs: [PROMPT_SLOT, { key: "images", kind: "image", required: true, max: 2, role: "首帧(+可选尾帧,按连线顺序)" }],
        params: [
            { key: "seconds", label: "时长(秒)", type: "select", options: "durations" },
            { key: "metadata.seed", label: "随机种子", type: "number", placeholder: "留空随机" },
        ],
        postProcess: ({ slots, metadata }) => {
            metadata.task_type = (slots["images"] || []).length >= 2 ? "flf2v" : "i2v";
        },
    },
    {
        key: "s2v",
        label: "数字人",
        modality: "video",
        output: CanvasNodeType.Video,
        channel: "task",
        taskType: "s2v",
        inputs: [PROMPT_SLOT, { key: "images", kind: "image", required: true, role: "人物图" }, { key: "metadata.audio", kind: "audio", required: true, role: "驱动音频" }],
        params: [{ key: "metadata.seed", label: "随机种子", type: "number", placeholder: "留空随机" }],
    },
    {
        key: "sr",
        label: "视频超分",
        modality: "video",
        output: CanvasNodeType.Video,
        channel: "task",
        taskType: "sr",
        promptFallback: "视频超分",
        inputs: [OPTIONAL_PROMPT_SLOT, { key: "metadata.video", kind: "video", required: true, role: "源视频" }],
        params: [
            // sr_ratio=1 → 仅插帧/不放大(输出被引擎按配置目标尺寸封顶,见设计文档 §3.9)
            { key: "metadata.sr_ratio", label: "放大倍率", type: "number", min: 1, max: 4, step: 0.5, placeholder: "默认 2;1=不放大" },
            // 部署侧 SeedVR2 config 已常驻 RIFE 插帧(见设计文档 §3.9):留空即用部署默认 32fps,填值覆盖
            { key: "metadata.target_fps", label: "插帧目标 FPS", type: "number", min: 16, max: 60, step: 1, placeholder: "留空默认 32fps" },
        ],
    },
    {
        // key 沿用 "vace"(稳定标识,不破坏已保存画布),现驱动 Bernini 视频编辑。
        key: "vace",
        label: "视频编辑",
        modality: "video",
        output: CanvasNodeType.Video,
        channel: "task",
        // 默认 v2v;真实 task_type 由 postProcess 按输入分流(源视频数/参考图组合)。
        taskType: "v2v",
        inputs: [
            PROMPT_SLOT,
            // 后端约束(materializeBerniniInputs):≥1 源视频(仅参考图的 r2v 已迁到
            // 「图生视频」);2 视频=mv2v 多源编辑(ads2v 广告植入输入相同,引擎侧
            // 配方不同,画布不提供自动分流,直连 API 可显式指定)。
            { key: "metadata.src_video", kind: "video", required: true, max: 2, role: "源视频(1~2 个)" },
            { key: "metadata.src_ref_images", kind: "image", required: false, max: 5, role: "参考图" },
        ],
        params: [{ key: "metadata.seed", label: "随机种子", type: "number", placeholder: "留空随机" }],
        // Bernini 按输入自动分流玩法:1 视频无参考图=v2v、1 视频+参考图=rv2v、2 视频=mv2v
        //(与 classic 体验区 useVideoGeneration 的分流规则一致)。
        postProcess: ({ slots, metadata }) => {
            const nVideos = (slots["metadata.src_video"] || []).length;
            const hasRefs = (slots["metadata.src_ref_images"] || []).length > 0;
            metadata.task_type = nVideos >= 2 ? "mv2v" : hasRefs ? "rv2v" : "v2v";
        },
    },
    // ── 音频:四个能力共用 task_type=tts,按能力标签筛出的模型集合区分引擎(§3.1) ──
    {
        key: "tts_emotion",
        label: "情感合成",
        modality: "audio",
        output: CanvasNodeType.Audio,
        channel: "task",
        taskType: "tts",
        inputs: [
            PROMPT_SLOT,
            { key: "metadata.voice", kind: "audio", required: true, role: "参考音色" },
            { key: "metadata.emotion_audio", kind: "audio", required: false, role: "情感参考音" },
        ],
        params: [
            // 维度次序与 IndexTTS-2 一致:[喜,怒,哀,惧,厌恶,低落,惊喜,平静](体验区 EMOTION_PRESETS)
            {
                key: "emotion",
                label: "情感预设",
                type: "select",
                virtual: true,
                options: [
                    { value: "happy", label: "喜" },
                    { value: "angry", label: "怒" },
                    { value: "sad", label: "哀" },
                    { value: "afraid", label: "惧" },
                    { value: "disgusted", label: "厌恶" },
                    { value: "melancholic", label: "低落" },
                    { value: "surprised", label: "惊喜" },
                    { value: "calm", label: "平静" },
                ],
                placeholder: "留空跟随音色",
            },
            { key: "emoAlpha", label: "情感强度", type: "number", virtual: true, min: 0, max: 1, step: 0.05, placeholder: "默认 0.65" },
        ],
        postProcess: ({ params, metadata }) => {
            // 选中情绪 → one-hot 8 维向量(选中维 = 强度),emo_alpha 同步;未选不发情感参数
            const EMOTION_INDEX: Record<string, number> = { happy: 0, angry: 1, sad: 2, afraid: 3, disgusted: 4, melancholic: 5, surprised: 6, calm: 7 };
            const index = EMOTION_INDEX[String(params.emotion ?? "")];
            if (index === undefined) return;
            const alphaRaw = Number(params.emoAlpha);
            const alpha = Number.isFinite(alphaRaw) && alphaRaw >= 0 && alphaRaw <= 1 ? alphaRaw : 0.65;
            const vector = [0, 0, 0, 0, 0, 0, 0, 0];
            vector[index] = alpha;
            metadata.emo_vector = vector;
            metadata.emo_alpha = alpha;
        },
    },
    {
        key: "tts_synth",
        label: "语音合成",
        modality: "audio",
        output: CanvasNodeType.Audio,
        channel: "task",
        taskType: "tts",
        // 语音融合(Qwen3-TTS CustomVoice)只做预设音色 + 语言/方言。不暴露克隆参考音:
        // CustomVoice checkpoint 无 speaker encoder 权重,克隆会让引擎维度不匹配崩溃
        // (克隆需 Base checkpoint)。故仅 speaker(预设音色,默认 vivian) + language。
        inputs: [PROMPT_SLOT],
        params: [
            {
                key: "metadata.speaker",
                label: "预设音色",
                type: "select",
                defaultValue: "vivian",
                options: [
                    { value: "vivian", label: "Vivian" },
                    { value: "ryan", label: "Ryan" },
                    { value: "aiden", label: "Aiden" },
                    { value: "serena", label: "Serena" },
                    { value: "dylan", label: "Dylan" },
                    { value: "eric", label: "Eric" },
                    { value: "ono_anna", label: "Ono Anna" },
                    { value: "sohee", label: "Sohee" },
                    { value: "uncle_fu", label: "Uncle Fu" },
                ],
                placeholder: "选择预设音色",
            },
            {
                // 口音:TTS 不翻译,引擎 Auto 按文本语言发音,故不让用户选语言;仅提供中文方言
                // 口音(同一段中文换口音)。value 是引擎 supported_languages 枚举(.title()
                // 归一化)。方言仅对中文文本生效,当前 checkpoint 只有北京话/四川话;留空=自动。
                key: "metadata.language",
                label: "口音",
                type: "select",
                options: [
                    { value: "Beijing_Dialect", label: "北京话" },
                    { value: "Sichuan_Dialect", label: "四川话" },
                ],
                placeholder: "留空自动(按文本语言)",
            },
        ],
    },
    {
        key: "tts_dialogue",
        label: "双人对话",
        modality: "audio",
        output: CanvasNodeType.Audio,
        channel: "task",
        taskType: "tts",
        inputs: [
            { key: "prompt", kind: "text", required: true, role: "对话脚本(如 [S1]你好。[S2]你好呀。)" },
            { key: "metadata.ref_audio", kind: "audio", required: true, role: "说话人1参考音" },
            { key: "metadata.ref_audio_2", kind: "audio", required: true, role: "说话人2参考音" },
        ],
        params: [],
    },
    {
        key: "tts_design",
        label: "声音设计",
        modality: "audio",
        output: CanvasNodeType.Audio,
        channel: "task",
        taskType: "tts",
        inputs: [PROMPT_SLOT],
        params: [{ key: "metadata.instructions", label: "声线描述", type: "textarea", required: true, placeholder: "如:温柔女声,语速平缓,带一点笑意" }],
    },
    {
        key: "t2m",
        label: "文生音乐",
        modality: "music",
        output: CanvasNodeType.Audio,
        channel: "task",
        taskType: "t2m",
        inputs: [PROMPT_SLOT],
        params: [
            { key: "metadata.lyrics", label: "歌词", type: "textarea", placeholder: "留空自动生成" },
            { key: "metadata.audio_duration", label: "时长(秒)", type: "number", min: 10, max: 240, step: 1, placeholder: "留空默认" },
            { key: "metadata.vocal_language", label: "人声语种", type: "select", options: ["zh", "yue", "en", "ja", "ko", "unknown"] },
            { key: "metadata.bpm", label: "BPM", type: "number", min: 40, max: 220, step: 1, placeholder: "留空默认" },
            { key: "metadata.seed", label: "随机种子", type: "number", placeholder: "留空随机" },
        ],
        postProcess: ({ prompt, metadata }) => {
            // 与体验区一致:t2m 未填歌词 → 开 sample 模式,引擎按描述 LM 自动生成 caption+歌词;
            // prompt 仍保持=描述文本(满足门面 prompt 必填,也让不认 sample_mode 的路径兜底)
            if (!String(metadata.lyrics ?? "").trim()) {
                delete metadata.lyrics;
                metadata.sample_mode = true;
                metadata.sample_query = prompt;
            }
        },
    },
    {
        key: "cover",
        label: "音乐改编",
        modality: "music",
        output: CanvasNodeType.Audio,
        channel: "task",
        taskType: "cover",
        inputs: [PROMPT_SLOT, { key: "metadata.reference_audio", kind: "audio", required: true, role: "参考音频" }],
        params: [
            { key: "metadata.lyrics", label: "歌词", type: "textarea", placeholder: "留空沿用原曲" },
            { key: "metadata.seed", label: "随机种子", type: "number", placeholder: "留空随机" },
        ],
    },
    {
        key: "repaint",
        label: "音乐重绘",
        modality: "music",
        output: CanvasNodeType.Audio,
        channel: "task",
        taskType: "repaint",
        inputs: [PROMPT_SLOT, { key: "metadata.src_audio", kind: "audio", required: true, role: "源音频" }],
        params: [
            { key: "metadata.lyrics", label: "歌词", type: "textarea", placeholder: "留空沿用原曲" },
            { key: "metadata.seed", label: "随机种子", type: "number", placeholder: "留空随机" },
        ],
    },
    // ── AudioX 扩散音频:引擎硬要 num_inference_steps(无 deploy-config 兜底),
    //    seconds_total/guidance_scale 同「所见即所发」补 UI 默认(与体验区一致) ──
    {
        key: "t2a",
        label: "文生音效",
        modality: "music",
        output: CanvasNodeType.Audio,
        channel: "task",
        taskType: "t2a",
        mirrorTaskTypeAs: "audiox_task",
        inputs: [PROMPT_SLOT],
        params: [
            { key: "metadata.seconds_total", label: "时长(秒)", type: "number", min: 1, max: 60, step: 1, defaultValue: 10, placeholder: "默认 10" },
            { key: "metadata.num_inference_steps", label: "采样步数", type: "number", min: 50, max: 500, step: 10, defaultValue: 250, placeholder: "默认 250" },
            { key: "metadata.guidance_scale", label: "引导系数", type: "number", min: 1, max: 20, step: 0.5, defaultValue: 7.0, placeholder: "默认 7.0" },
            { key: "metadata.seed", label: "随机种子", type: "number", placeholder: "留空随机" },
        ],
    },
    {
        key: "v2a",
        label: "视频配音效",
        modality: "music",
        output: CanvasNodeType.Audio,
        channel: "task",
        taskType: "v2a",
        taskTypeWithPrompt: "tv2a",
        mirrorTaskTypeAs: "audiox_task",
        inputs: [OPTIONAL_PROMPT_SLOT, { key: "metadata.video", kind: "video", required: true, role: "源视频" }],
        params: [
            { key: "metadata.seconds_total", label: "时长(秒)", type: "number", min: 1, max: 60, step: 1, defaultValue: 10, placeholder: "默认 10" },
            { key: "metadata.num_inference_steps", label: "采样步数", type: "number", min: 50, max: 500, step: 10, defaultValue: 250, placeholder: "默认 250" },
            { key: "metadata.guidance_scale", label: "引导系数", type: "number", min: 1, max: 20, step: 0.5, defaultValue: 7.0, placeholder: "默认 7.0" },
            { key: "metadata.seed", label: "随机种子", type: "number", placeholder: "留空随机" },
        ],
    },
    {
        key: "v2m",
        label: "视频配乐",
        modality: "music",
        output: CanvasNodeType.Audio,
        channel: "task",
        taskType: "v2m",
        taskTypeWithPrompt: "tv2m",
        mirrorTaskTypeAs: "audiox_task",
        inputs: [OPTIONAL_PROMPT_SLOT, { key: "metadata.video", kind: "video", required: true, role: "源视频" }],
        params: [
            { key: "metadata.seconds_total", label: "时长(秒)", type: "number", min: 1, max: 60, step: 1, defaultValue: 10, placeholder: "默认 10" },
            { key: "metadata.num_inference_steps", label: "采样步数", type: "number", min: 50, max: 500, step: 10, defaultValue: 250, placeholder: "默认 250" },
            { key: "metadata.guidance_scale", label: "引导系数", type: "number", min: 1, max: 20, step: 0.5, defaultValue: 7.0, placeholder: "默认 7.0" },
            { key: "metadata.seed", label: "随机种子", type: "number", placeholder: "留空随机" },
        ],
    },
    // SoulX 歌声合成:num_inference_steps/guidance_scale 有 deploy-config 默认(32/3.0),留空不下发
    {
        key: "svs",
        label: "歌声合成",
        modality: "music",
        output: CanvasNodeType.Audio,
        channel: "task",
        taskType: "svs",
        promptFallback: "歌声合成",
        inputs: [
            { key: "metadata.prompt_audio", kind: "audio", required: true, role: "音色参考人声" },
            { key: "metadata.target_audio", kind: "audio", required: true, role: "目标曲/伴奏" },
        ],
        params: [
            {
                key: "metadata.language",
                label: "演唱语言",
                type: "select",
                options: [
                    { value: "Mandarin", label: "普通话" },
                    { value: "Cantonese", label: "粤语" },
                    { value: "English", label: "英文" },
                ],
                placeholder: "默认普通话",
            },
            {
                key: "metadata.control",
                label: "控制方式",
                type: "select",
                options: [
                    { value: "melody", label: "旋律(melody)" },
                    { value: "score", label: "曲谱(score)" },
                ],
                placeholder: "默认旋律",
            },
            { key: "metadata.seed", label: "随机种子", type: "number", placeholder: "留空随机" },
        ],
    },
];

const byKey = new Map(CAPABILITIES.map((spec) => [spec.key, spec]));
// 兼容 v0.1 旧节点:当年的 "tts"(voice+emo_alpha)即 IndexTTS-2 情感合成,别名指向新 key,
// 旧项目 JSON 打开后能力行为不丢
byKey.set("tts", byKey.get("tts_emotion")!);

export function capabilitySpec(key: string | undefined): CapabilitySpec | null {
    return (key && byKey.get(key)) || null;
}

/** 按模态分组(添加生成节点选择器用) */
export function capabilitiesByModality(): Array<{ modality: CapabilityModality; label: string; items: CapabilitySpec[] }> {
    const groups: Array<{ modality: CapabilityModality; label: string }> = [
        { modality: "image", label: "图片" },
        { modality: "video", label: "视频" },
        { modality: "audio", label: "音频" },
        { modality: "music", label: "音乐" },
    ];
    return groups.map((group) => ({ ...group, items: CAPABILITIES.filter((spec) => spec.modality === group.modality) }));
}
