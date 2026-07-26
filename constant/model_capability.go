package constant

// 图片 / 视频 / 语音 / 音乐模型能力枚举（中文即值），需与前端
// web/classic/src/constants/imagePlayground.constants.js 的 IMAGE_CAPABILITIES、
// videoPlayground.constants.js 的 VIDEO_CAPABILITIES、
// audioPlayground.constants.js 的 AUDIO_CAPABILITIES、
// musicPlayground.constants.js 的 MUSIC_CAPABILITIES 保持一致。
// 这些能力由运营设置里逐模型声明，作为「能力标签」在模型广场展示。
var ImageCapabilities = []string{
	"文生图",
	"图生图",
	"图像编辑",
	"局部重绘",
	"扩图",
	"高清放大",
}

var VideoCapabilities = []string{
	"文生视频",
	"图生视频",
	// 2026-07 由「首尾帧」改名:wan2.2 i2v 仅首帧 / 首+尾帧都可(task_type 按输入
	// 派生 i2v/flf2v)。前端有 legacy alias 兼容旧标签配置。
	"关键帧",
	"数字人",
	"视频超分",
	"视频编辑",
	// 视频配音 -> 门面 task_type=v2a(视频→配好音的视频,LTX-2.3 首发,可挂多模型)。
	// 2026-07 从音乐词表迁入:AudioX 视频配乐(出 .wav)下线,该标签现属视频大类
	// (产物是视频);存量 AudioX 模型配置若还挂着此标签,需在管理端摘除。
	// 2026-07 由「视频配乐」改名「视频配音」,旧配置靠前端 legacy alias 兼容。
	"视频配音",
}

// AudioCapabilities 四个语音(TTS)能力标签,区分 IndexTTS-2 的情感合成与 vLLM-Omni
// 家族的语音合成/对话/设计 —— 归入体验区「语音模型」下的子标签页,并在模型广场同归
// 「语音」能力分类。全部走门面 task_type=tts,按能力标签过滤模型选对应引擎:
//
//	情感合成 -> IndexTTS-2(voice 参考音色 + emotion_audio 情感参考音)
//	语音合成 -> Qwen3-TTS/VoxCPM2/CosyVoice3/GLM-TTS/MOSS-TTS-Nano。单模型覆盖音色来源
//	            (上传克隆 ref_audio + 可选 ref_text / 预设音色 speaker)与语言(language)两个
//	            维度 —— 面板内以选项呈现,不再拆成独立能力。
//	双人对话 -> MOSS-TTSD(ref_audio + ref_audio_2 双说话人参考音)
//	声音设计 -> MOSS-VoiceGenerator(instructions 声线描述,无参考音)
var AudioCapabilities = []string{
	"情感合成",
	"语音合成",
	"双人对话",
	"声音设计",
}

// MusicCapabilities 涵盖 ACE-Step 文生音乐/音乐改编/音乐重绘，以及扩散音频生成
// （vLLM-Omni：AudioX + SoulX-Singer）的音效/歌声合成 —— 归入体验区「音乐模型」下的
// 子标签页,并在模型广场同归「音乐」能力分类。
//
//	文生音效   -> AudioX t2a
//	歌声合成   -> SoulX-Singer svs
//
// 2026-07 下线:视频生音/视频配音效/视频配乐(AudioX v2a/tv2a,出 .wav)——视频配乐
// 产品线移交 LTX-2.3(task_type=v2a 契约改判,产物为配好音的视频),标签迁入
// VideoCapabilities;AudioX 的 v2m/tv2m 仍有效但暂无前端入口(去留待产品确认)。
var MusicCapabilities = []string{
	"文生音乐",
	"音乐改编",
	"音乐重绘",
	"文生音效",
	"歌声合成",
}

// IsCapabilityTag 判断某个标签词是否属于能力词表（图片、视频、语音或音乐）。
// 用于模型广场对标签归类去重：命中者归入「模型能力」分类。
func IsCapabilityTag(tag string) bool {
	for _, c := range ImageCapabilities {
		if c == tag {
			return true
		}
	}
	for _, c := range VideoCapabilities {
		if c == tag {
			return true
		}
	}
	for _, c := range AudioCapabilities {
		if c == tag {
			return true
		}
	}
	for _, c := range MusicCapabilities {
		if c == tag {
			return true
		}
	}
	return false
}
