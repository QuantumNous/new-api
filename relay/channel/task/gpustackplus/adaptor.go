// Package gpustackplus 实现「GPUStackPlus」任务渠道:对接二次开发 GPUStack 的
// LightX2V 内置后端异步门面(/v1/videos,2026-07-06 上线,见 gpustack 仓
// docs/lightx2v-backend-design.md §6.0 与 docs/lightx2v-m4-m5-handover.md)。
//
// 门面契约(GPUStack server,非直连引擎):
//
//	POST {base}/v1/videos        body: {model(必填), task_type, prompt, user_id,
//	                                    image(URL 或 base64/data-uri), ...引擎可选参数}
//	                             → {task_id, status, model, task_type, nfs_path, error, error_type}
//	GET  {base}/v1/videos/{id}   → 同上;status ∈ queued/assigned/running/done/failed/canceled;
//	                               done 时 nfs_path 为成品在共享 SFS 上的绝对路径
//
// 关键约定:
//   - save_result_path / image_path 等引擎原生路径字段是门面的 engine-owned 字段,
//     外部传入会被剥掉——路径由门面统一 dictates 并自建父目录,new-api 不再拼路径
//     也不再 mkdir,完成后从状态响应读 nfs_path 交给落盘钩子搬 OBS;
//   - 图片输入走 "image" 字段(URL 直透 / base64 由门面持久化到 SFS inputs/ 再喂引擎);
//   - 除保留字段外的请求参数(negative_prompt/seed/target_video_length 等)原样透传,
//     门面转交引擎,校验归上游(new-api 侧 metadata 即此通道)。
package gpustackplus

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/gpustackplus/nfsinput"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/mediastore"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"
)

// new-api 侧当前支持的 task_type,与门面 routes/videos.py 的 _VALID_TASK_TYPES 对齐。
//
// tts(语音合成,IndexTTS-2):文本走 prompt,参考音色 metadata.voice + 可选情感参考音
// metadata.emotion_audio 物化到 input_refs,情感标量(emo_vector/emo_alpha/emo_text)收进
// body.extra_params(引擎只从 extra_params 读)。见 materializeTTSInputs / foldEmotionParamsIntoExtra。
//
// s2v(数字人,InfiniteTalk):人物图走 image/input_reference,驱动音频 metadata.audio,
// 一并物化到 input_refs(image + audio)。见 materializeS2VInputs。
// sr(超分,SeedVR2):源视频 metadata.video 物化到 input_refs.video,倍率 metadata.sr_ratio
// 随 metadata 透传(门面按 config 目标尺寸封顶)。见 materializeSRInputs。
// v2v/rv2v/r2v/mv2v/ads2v(视频编辑/图生视频,Bernini,顶替下线的 wan2.2-VACE):按输入
// 组合区分——v2v 单源视频 metadata.src_video、rv2v 源视频+参考图 metadata.src_ref_images、
// r2v 仅参考图(体验区「图生视频」)、mv2v 双源视频多源编辑、ads2v 双源视频广告植入
// (与 mv2v 同输入,引擎侧 system prompt/guidance 不同,只能显式指定)。
// 物化到 input_refs,见 materializeBerniniInputs。
var validTaskTypes = map[string]bool{
	"t2i": true, "i2i": true, "t2v": true, "i2v": true, "flf2v": true,
	"tts": true, "s2v": true, "sr": true, "v2v": true, "rv2v": true, "r2v": true,
	"mv2v": true, "ads2v": true,
	// 视频配乐(LTX-2.3 v2a):输入视频 + 可选 prompt → 原画面逐帧不动 + AI 音轨的
	// mp4。2026-07 契约改判:v2a 原属 AudioX(出 .wav 纯音频),该产品线下线,
	// v2a 现为「视频→配好音的视频」任务形态(可挂多模型,LTX-2.3 首发);tv2a
	// 随之删除(新契约 prompt 本就可选,无需"带文本"单列)。
	"v2a": true,
	// 音乐生成(ACE-Step):t2m 纯文本、cover 参考音频、repaint 源音频。
	"t2m": true, "cover": true, "repaint": true,
	// 扩散音频(vLLM-Omni audiogen):AudioX t2a/v2m/tv2m + SoulX-Singer svs。
	"t2a": true, "v2m": true, "tv2m": true, "svs": true,
}

// legacyInputKeys 旧的原始输入 / 引擎原生路径字段:输入统一走 input_refs,这些键
// 若从 metadata 混进 body,门面会因"检测到原始输入字段"整单 400,故播种后剥掉。
// 与门面 _INPUT_FIELDS + _ENGINE_OWNED_FIELDS 对齐(含 TTS 的 voice/emotion_audio)。
var legacyInputKeys = map[string]bool{
	"image": true, "last_frame": true, "image_mask": true, "audio": true,
	"voice": true, "emotion_audio": true,
	"video": true, "src_video": true, "src_mask": true, "src_ref_images": true,
	// 音乐(ACE-Step)原始输入 + 引擎原生路径字段。
	"reference_audio": true, "src_audio": true,
	// vLLM-Omni TTS 参考音原始输入 + 门面注入的引擎路径字段(ref_audio→ref_audio_path)。
	// 输入统一走 input_refs 物化,残留裸键会被门面当作"原始输入"整单拒。
	"ref_audio": true, "ref_audio_2": true,
	"ref_audio_path": true, "ref_audio_2_path": true,
	// 扩散音频(vLLM-Omni audiogen):AudioX 视频复用 video(已在上);SoulX SVS 的
	// prompt_audio/target_audio 引擎字段名与裸键同名,一并剥离。
	"prompt_audio": true, "target_audio": true,
	"image_path": true, "last_frame_path": true, "image_mask_path": true,
	"audio_path": true, "spk_audio_path": true, "emo_audio_path": true,
	"video_path": true, "save_result_path": true,
	"reference_audio_path": true, "src_audio_path": true,
}

// localBadRequest 构造本地 400 skip-retry 错误:BuildRequestBody 里的输入校验 /
// 物化失败(URL 下不到、非法 task_type 等)属客户端问题,不应触发跨渠道重试。
// relay_task.go 识别 *types.NewAPIError 并转成 LocalError 的 TaskError。
func localBadRequest(err error) *types.NewAPIError {
	return types.NewErrorWithStatusCode(
		err, types.ErrorCodeInvalidRequest, http.StatusBadRequest,
		types.ErrOptionWithSkipRetry(),
	)
}

// submitResponse 门面提交接口返回(_public 形态,提交时 nfs_path 恒为 null)。
type submitResponse struct {
	TaskID string `json:"task_id"`
	Status string `json:"status"`
}

// statusResponse 门面状态接口返回(_public 形态)。
type statusResponse struct {
	TaskID    string `json:"task_id"`
	Status    string `json:"status"`
	NFSPath   string `json:"nfs_path"`
	Error     string `json:"error"`
	ErrorType string `json:"error_type"`
}

type TaskAdaptor struct {
	taskcommon.BaseBilling
	ChannelType int
	apiKey      string
	baseURL     string
}

func (a *TaskAdaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
	a.baseURL = strings.TrimRight(info.ChannelBaseUrl, "/")
	a.apiKey = info.ApiKey
}

func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
	// 成品只落 SFS(nfs_path),必须经 OBS 才能对外提供 URL——存储关闭时提前拒绝,
	// 不占用 GPU 渲染一个交付不出去的成品。
	if !mediastore.Enabled() {
		return service.TaskErrorWrapper(
			fmt.Errorf("媒体存储(OBS)未启用,gpustackplus 渠道无法对外提供成品 URL,请先在系统设置启用"),
			"media_storage_disabled", http.StatusServiceUnavailable)
	}
	if taskErr := relaycommon.ValidateBasicTaskRequest(c, info, constant.TaskActionGenerate); taskErr != nil {
		return taskErr
	}
	// 若超管为该模型配置了尺寸/时长白名单(系统设置→视频模型配置),按配置校验;
	// 未配置则不加限制。此处早于模型映射,用请求里的公开 model 名做 key。参数错误
	// 归为本地 400(不重试、不误标渠道故障)。
	// 配置按公开模型名键控(体验区用选中的公开名读它),映射不改 OriginModelName;
	// 故只用公开名做 key,与映射时机无关。
	if req, err := relaycommon.GetTaskRequest(c); err == nil {
		if verr := common.ValidateVideoParamsForModel(req.Size, req.Duration, req.Seconds,
			req.Model, info.OriginModelName); verr != nil {
			return service.TaskErrorWrapperLocal(verr, "invalid_request", http.StatusBadRequest)
		}
	}
	return nil
}

func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.RelayInfo) (string, error) {
	// 视频经任务子系统走异步门面;图片走同步 relay,另行接入。
	return fmt.Sprintf("%s/v1/videos", a.baseURL), nil
}

func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	req.Header.Set("Content-Type", "application/json")
	if a.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+a.apiKey)
	}
	return nil
}

func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error) {
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		return nil, errors.Wrap(err, "get_task_request_failed")
	}

	modelName := firstNonEmpty(info.UpstreamModelName, req.Model, info.OriginModelName)
	if modelName == "" {
		return nil, fmt.Errorf("model is required (渠道模型映射与请求 model 均为空)")
	}

	// OpenAI /v1/videos 风格用 input_reference 传条件图;公共校验只归一化了
	// image→Images,这里补上,否则合法的 i2v 请求会被下方防呆误拒。
	if !req.HasImage() && strings.TrimSpace(req.InputReference) != "" {
		req.Images = []string{req.InputReference}
	}

	// 引擎可识别的可选参数(negative_prompt / seed / target_video_length /
	// aspect_ratio 等)经 metadata 整体透传;门面会剥掉 engine-owned 字段,
	// 下面的保留字段随后覆盖同名键,防止篡改核心语义。
	//
	// 白名单加固:若该模型配了尺寸/时长白名单,剔除 metadata 里对应维度的引擎原生
	// 别名键(如 target_video_length / aspect_ratio),否则客户端可绕过顶层 size/
	// duration 的校验,用 metadata 直接注入被禁值。被锁维度只允许走(已校验的)顶层字段。
	allowedSizes, allowedDurations, _ := common.VideoParamsAllowedForModel(req.Model, info.OriginModelName)
	sizeLocked := len(allowedSizes) > 0
	durationLocked := len(allowedDurations) > 0
	body := make(map[string]any, len(req.Metadata)+8)
	for k, v := range req.Metadata {
		lk := strings.ToLower(strings.TrimSpace(k))
		if durationLocked && durationOverrideKeys[lk] {
			continue
		}
		if sizeLocked && sizeOverrideKeys[lk] {
			continue
		}
		body[k] = v
	}
	// 剥掉遗留输入 / 引擎路径字段(§N4):输入统一走 input_refs,残留会被门面整单拒。
	for k := range body {
		if legacyInputKeys[strings.ToLower(strings.TrimSpace(k))] {
			delete(body, k)
		}
	}
	body["model"] = modelName
	body["prompt"] = req.Prompt
	// user_id 用字符串:与 NFS 输入路径的 <user_id> 段一致,门面校验 parent_dir_name == user_id。
	body["user_id"] = fmt.Sprintf("%d", info.UserId)
	if _, ok := body["task_type"]; !ok {
		body["task_type"] = inferTaskType(modelName)
	}
	// 转发已校验的顶层 size:同时给 size 与由它换算的 aspect_ratio,兼容不同引擎读法。
	// size 被锁定时上面已剔除 metadata 的同类别名,这里的规范值即唯一来源(不退化、不绕过)。
	if s := strings.TrimSpace(req.Size); s != "" {
		body["size"] = s
		if ar := common.AspectRatioFromSize(s); ar != "" {
			body["aspect_ratio"] = ar
		}
	}
	taskType, _ := body["task_type"].(string)
	// task_type 白名单校验(§N2):它可能来自 metadata,非法值既会让 NFS 写盘路径异常,
	// 也会被门面拒;就地本地 400,不进后续物化 / 提交。
	if !validTaskTypes[taskType] {
		return nil, localBadRequest(fmt.Errorf("不支持的 task_type: %q(允许:t2i/i2i/t2v/i2v/flf2v/tts/s2v/sr/v2a/v2v/rv2v/r2v/mv2v/ads2v/t2m/cover/repaint/t2a/v2m/tv2m/svs)", taskType))
	}
	// SoulX svs 的文本仅占位(引擎按 prompt_audio/target_audio 生成歌声),但引擎 input 需非空、
	// 且真机验证过的请求带 "soulx-singer" 标签。ValidateBasicTaskRequest 已豁免 svs 的空 prompt,
	// 这里为空时兜底一个 label,避免直连空 prompt 传到引擎(v2a/v2m 纯视频输入,空 prompt 是正确
	// 语义,不兜底)。
	if taskType == "svs" && strings.TrimSpace(req.Prompt) == "" {
		req.Prompt = "soulx-singer"
		body["prompt"] = req.Prompt
	}
	// 输入兼容性防呆必须在物化之前(§N2 复审):否则 t2v/t2i 带图、flf2v 只给 1 张等非法
	// 组合会先把图写到 NFS 再被拒,留下孤儿输入文件。这些检查只依赖 taskType / req,不需物化。
	if imageRequiredTaskTypes[taskType] && !req.HasImage() {
		return nil, localBadRequest(fmt.Errorf("模型 %s 的任务类型 %s 需要图片输入,必须提供 image/input_reference", modelName, taskType))
	}
	if textOnlyTaskTypes[taskType] && req.HasImage() {
		return nil, localBadRequest(fmt.Errorf("模型 %s 的任务类型 %s 不接受图片输入;图生视频请改用 i2v 模型(如 wan2.2-i2v)", modelName, taskType))
	}
	if taskType == "flf2v" && len(req.Images) < 2 {
		return nil, localBadRequest(fmt.Errorf("模型 %s 的任务类型 flf2v(首尾帧)需要首帧和尾帧两张图:请提供 images=[首帧,尾帧]", modelName))
	}
	if taskType == "tts" {
		// 语音合成不接受图片输入(参考音走 metadata.voice,下面单独物化)。
		if req.HasImage() {
			return nil, localBadRequest(fmt.Errorf("模型 %s 的任务类型 tts 不接受图片输入", modelName))
		}
		if strings.TrimSpace(req.Prompt) == "" {
			return nil, localBadRequest(fmt.Errorf("模型 %s 的任务类型 tts 需要合成文本(prompt)", modelName))
		}
		// 字数上限(AudioModelConfig,按模型/全局默认;0=不限制):就地本地 400,防前端绕过。
		if err := common.ValidateAudioTextForModel(req.Prompt, req.Model, info.OriginModelName, modelName); err != nil {
			return nil, localBadRequest(err)
		}
	}
	if taskType == "t2m" || taskType == "cover" || taskType == "repaint" ||
		taskType == "t2a" || taskType == "tv2m" {
		// 字数上限(MusicModelConfig,按模型/全局默认;0=不限制):就地本地 400,防前端(含
		// 直连 /pg/videos)绕过。ACE-Step 校验 prompt/lyrics/sample_query;AudioX 文本类
		// (t2a/tv2m)也归「音乐」大类,同样受 MusicModelConfig 字数限制,只有 prompt。
		// (tv2a 已随 AudioX 视频配乐下线;v2a 现属视频大类,不走音乐字数限制。)
		// 任一字段超限即拒。
		for _, txt := range []string{
			req.Prompt,
			metadataString(req.Metadata, "lyrics"),
			metadataString(req.Metadata, "sample_query"),
		} {
			if strings.TrimSpace(txt) == "" {
				continue
			}
			if err := common.ValidateMusicTextForModel(txt, req.Model, info.OriginModelName, modelName); err != nil {
				return nil, localBadRequest(err)
			}
		}
	}

	// 输入物化:每个 task_type 落齐自己需要的输入到 NFS,统一发 input_refs 相对路径(不再
	// 发 base64/URL 给门面,方案见 gpustack 仓 docs/lightx2v-nfs-input-design.md)。物化顺序
	// 一律"先写全部输入 → 再提交",任一路失败回滚已写文件(见各 materialize 函数),避免孤儿。
	// URL 下不到 / SSRF 拒 / 写盘失败:本地 400 skip-retry,不触发跨渠道重试(§N3)。
	var refs map[string][]string
	switch taskType {
	case "tts":
		if isOmniTTSModel(modelName) {
			// vLLM-Omni:参考音走 ref_audio(+ MOSS-TTSD 第二说话人 ref_audio_2),
			// 均可选;预设音色走标量 speaker 透传(不物化)。VoiceGenerator/SoundEffect
			// 纯文本无参考音。
			refs, err = materializeOmniTTSInputs(c, info, taskType, modelName, req)
		} else {
			// IndexTTS-2(现由 vLLM-Omni 引擎服务):情感合成前端仍用 IndexTTS 语义键
			// (voice 参考音色 + emotion_audio 情感参考音),但引擎读 ref_audio/emo_audio。
			// materializeTTSInputs 物化为 ref_audio→ref_audio_path、emotion_audio→emo_audio_path。
			refs, err = materializeTTSInputs(c, info, taskType, modelName, req)
		}
	case "s2v":
		// 数字人:人物图(image/input_reference)+ 驱动音频(metadata.audio)。
		refs, err = materializeS2VInputs(c, info, taskType, modelName, req)
	case "sr":
		// 超分:源视频(metadata.video);倍率 sr_ratio 随 metadata 透传,不物化。
		refs, err = materializeSRInputs(c, info, taskType, modelName, req)
	case "v2v", "rv2v", "r2v", "mv2v", "ads2v":
		// Bernini:v2v 单源视频 / rv2v 源视频+参考图 / r2v 仅参考图(图生视频)/
		// mv2v·ads2v 双源视频(多源编辑 / 广告植入)。
		refs, err = materializeBerniniInputs(c, info, taskType, modelName, req)
	case "t2m", "cover", "repaint":
		// 音乐生成:t2m 无输入;cover 需参考音频(metadata.reference_audio);
		// repaint 需源音频(metadata.src_audio)。
		refs, err = materializeMusicInputs(c, info, taskType, modelName, req)
	case "t2a":
		// AudioX 文本→音效/音乐:纯文本 prompt,无输入物化。
	case "v2a":
		// 视频配乐(LTX-2.3 首发):源视频(metadata.video)+ 可选 prompt(透传)。
		// 归视频大类 → 走 VideoModelConfig 上限(newVideoMaterializer),与下线的
		// AudioX v2a(音乐大类上限)不同,故独立物化函数。
		refs, err = materializeDubInputs(c, info, taskType, modelName, req)
	case "v2m", "tv2m":
		// AudioX 视频→音乐:物化视频(metadata.video);tv2m 另有文本 prompt(透传)。
		refs, err = materializeAudioXVideoInputs(c, info, taskType, modelName, req)
	case "svs":
		// SoulX-Singer 集成 preprocess:物化 prompt_audio(音色参考)+ target_audio(目标曲/伴奏)。
		refs, err = materializeSingingInputs(c, info, taskType, modelName, req)
	default:
		// t2v/i2v/flf2v/i2i/t2i:有图才物化(纯文本 t2v/t2i 无输入)。
		// 首尾帧(flf2v):images[0]=首帧→image,images[1]=尾帧→last_frame;其余只取首帧。
		if req.HasImage() {
			refs, err = materializeVideoInputs(c, info, taskType, modelName, req)
		}
	}
	if err != nil {
		return nil, localBadRequest(err)
	}
	if len(refs) > 0 {
		body["input_refs"] = refs
	}
	// OpenAI 风格 duration/seconds → wan 帧数约定(4n+1,16fps:5s → 81 帧)。
	durationSec := req.Duration
	if durationSec == 0 && strings.TrimSpace(req.Seconds) != "" {
		if v, convErr := strconv.Atoi(strings.TrimSpace(req.Seconds)); convErr == nil {
			durationSec = v
		}
	}
	if durationSec > 0 {
		if _, ok := body["target_video_length"]; !ok {
			body["target_video_length"] = durationSec*16 + 1
		}
	}
	// IndexTTS-2 情感标量:引擎(vLLM-Omni IndexTTS2 talker)只从 extra_params 读
	// emo_vector/emo_alpha/…,顶层同名键会被引擎 AudioTaskRequest(继承
	// OpenAICreateSpeechRequest,extra=ignore)静默丢弃。前端经 metadata 平铺发来,
	// 这里把它们从 body 顶层收进 body["extra_params"](门面非控制键,原样透传)。
	if taskType == "tts" {
		foldEmotionParamsIntoExtra(body)
	}

	data, err := common.Marshal(body)
	if err != nil {
		return nil, errors.Wrap(err, "marshal_request_body_failed")
	}
	return bytes.NewReader(data), nil
}

// 门面 task_type 的输入约束(与 gpustack routes/videos.py 的 _VALID_TASK_TYPES 对应)。
// s2v(数字人)也需要人物图,故列入 imageRequiredTaskTypes;它额外需要驱动音频,由
// materializeS2VInputs 校验。sr / v2v/rv2v/r2v 的输入是视频或参考图(走 metadata,非
// image 字段),各自的 materialize 函数校验,不进这两张表。
var imageRequiredTaskTypes = map[string]bool{"i2v": true, "flf2v": true, "i2i": true, "s2v": true}
var textOnlyTaskTypes = map[string]bool{"t2v": true, "t2i": true}

// 被白名单锁定的维度对应的引擎原生别名键——metadata 里这些键会绕过顶层 size/
// duration 校验,锁定时需从透传体里剔除(小写匹配)。
var durationOverrideKeys = map[string]bool{
	"target_video_length": true, "video_length": true, "num_frames": true, "frames": true,
}
var sizeOverrideKeys = map[string]bool{
	"aspect_ratio": true, "size": true, "resolution": true,
	"width": true, "height": true, "target_width": true, "target_height": true,
}

// IndexTTS-2 情感标量键:vLLM-Omni 的 IndexTTS2 talker 只从 request.extra_params 读它们
// (见 vllm-omni tts_adapters/indextts2.py 的 _INDEXTTS2_EMOTION_KEYS)。作为顶层字段下发
// 会被引擎 AudioTaskRequest(继承 OpenAICreateSpeechRequest,Pydantic extra=ignore)丢弃。
var indexTTS2EmotionKeys = []string{
	"emo_vector", "emo_alpha", "emo_text", "use_emo_text", "use_random",
}

// foldEmotionParamsIntoExtra 把 IndexTTS-2 情感标量从 body 顶层挪进 body["extra_params"]:
// 引擎只认 extra_params 里的这些键。已有 extra_params 保留、同名不覆盖(caller 显式值优先);
// 顶层原键删除,避免"既顶层又嵌套"的歧义。门面 extra_params 非控制/引擎拥有/输入键,原样
// 透传到引擎 body 顶层,而 AudioTaskRequest 有 extra_params 字段,故能完整到达 talker。
func foldEmotionParamsIntoExtra(body map[string]any) {
	extra, _ := body["extra_params"].(map[string]any)
	for _, k := range indexTTS2EmotionKeys {
		v, ok := body[k]
		if !ok {
			continue
		}
		if extra == nil {
			extra = make(map[string]any)
		}
		if _, exists := extra[k]; !exists {
			extra[k] = v
		}
		delete(body, k)
	}
	if len(extra) > 0 {
		body["extra_params"] = extra
	}
}

// inferTaskType 按模型名推断门面 task_type;显式 metadata.task_type 优先于此推断。
func inferTaskType(modelName string) string {
	m := strings.ToLower(modelName)
	switch {
	// 扩散音频(vLLM-Omni audiogen)放最前,免被下面的 tts/兜底吞掉:
	//   AudioX 默认 t2a(文生音效);v2m/tv2m 由 metadata.task_type 显式指定
	//  (v2a/tv2a 已随 AudioX 视频配乐下线,v2a 契约改判给视频配乐,见 validTaskTypes)。
	//   SoulX-Singer 默认 svs(歌声合成)。
	case strings.Contains(m, "audiox"):
		return "t2a"
	// 视频配乐(v2a,LTX-2.3 首发):只匹配任务 token(v2a/dub,如部署名 ltx2-v2a),
	// 不匹配模型家族名——裸 "ltx" 会把 LTX-Video t2v/i2v、ltx2 t2av 等生成类部署
	// 误判成配音。生成类 LTX 落 t2v 兜底;不带任务后缀的配音部署用显式
	// metadata.task_type(优先于本推断)。与 gpustack-ui task-inputs.ts 保持镜像。
	case strings.Contains(m, "v2a") || strings.Contains(m, "dub"):
		return "v2a"
	case strings.Contains(m, "soulx") || strings.Contains(m, "singer"):
		return "svs"
	// 语音合成:含 "tts" 的名字(qwen3-tts/glm-tts/moss-ttsd/indextts)+ vLLM-Omni
	// 里名字不含 "tts" 的 TTS 家族(voxcpm/cosyvoice 克隆、moss-voicegenerator
	// 声音设计、moss-soundeffect 音效)。都走 /v1/audio/speech 异步契约。
	case strings.Contains(m, "tts") || strings.Contains(m, "indextts") ||
		strings.Contains(m, "voxcpm") || strings.Contains(m, "cosyvoice") ||
		strings.Contains(m, "moss"):
		return "tts"
	// 数字人 / 超分 / 编辑放在通用 i2v/i2i 之前:InfiniteTalk 名里常含 "talk",
	// SeedVR2 含 "seedvr"/"sr",Bernini 视频编辑含 "bernini" —— 显式匹配免落到 t2v 兜底。
	case strings.Contains(m, "infinitetalk") || strings.Contains(m, "s2v"):
		return "s2v"
	case strings.Contains(m, "seedvr") || strings.Contains(m, "-sr") || strings.HasSuffix(m, "sr"):
		return "sr"
	// Bernini 一个模型出 v2v/rv2v/r2v 三种玩法,模型名只能给兜底默认(v2v);
	// 真实玩法由前端体验区按输入组合显式下发 metadata.task_type(优先于此推断)。
	case strings.Contains(m, "bernini"):
		return "v2v"
	// 音乐生成:acestep 系模型默认 t2m;cover/repaint 由 metadata.task_type 显式指定。
	case strings.Contains(m, "acestep"):
		return "t2m"
	case strings.Contains(m, "flf2v"):
		return "flf2v"
	case strings.Contains(m, "i2v"):
		return "i2v"
	case strings.Contains(m, "edit") || strings.Contains(m, "i2i"):
		return "i2i"
	case strings.Contains(m, "t2i"):
		return "t2i"
	default:
		return "t2v"
	}
}

// materializeVideoInputs 把视频链路的输入图统一物化落 NFS,返回 input_refs(field → 相对路径数组)。
// 视频链路为 JSON-only:req.Images 里是 URL 或 base64/data-uri 字符串。
// flf2v:images[0]=首帧(image)、images[1]=尾帧(last_frame);i2v/s2v 只取首帧(image)。
// 用 info.PublicTaskID 作 input-group id,info.UserId 作 <user_id> 段(与门面 user_id 一致)。
func materializeVideoInputs(c *gin.Context, info *relaycommon.RelayInfo, taskType, modelName string, req relaycommon.TaskSubmitReq) (map[string][]string, error) {
	if len(req.Images) == 0 {
		return nil, fmt.Errorf("缺少图片输入")
	}
	m := newVideoMaterializer(info, taskType, modelName, req)
	ctx := c.Request.Context()

	// 首帧(image),单值。多输入中途失败时回滚已写文件,避免孤儿(§N2 复审)。
	if err := m.AddString(ctx, nfsinput.FieldImage, 0, false, req.Images[0]); err != nil {
		m.Cleanup()
		return nil, err
	}
	// flf2v 尾帧(last_frame),单值。
	if taskType == "flf2v" {
		if len(req.Images) < 2 {
			m.Cleanup()
			return nil, fmt.Errorf("模型 %s 的任务类型 flf2v(首尾帧)需要首帧和尾帧两张图", modelName)
		}
		if err := m.AddString(ctx, nfsinput.FieldLastFrame, 0, false, req.Images[1]); err != nil {
			m.Cleanup()
			return nil, err
		}
	}
	return m.Refs(), nil
}

// materializeS2VInputs 物化数字人(InfiniteTalk)的输入:人物图(image/input_reference,
// 取首帧)+ 驱动音频(metadata.audio)。两者同一 gid,先写全部 → 再提交,失败回滚。
// 门面把 image→image_path、audio→audio_path 映射给 InfiniteTalk 引擎。
func materializeS2VInputs(c *gin.Context, info *relaycommon.RelayInfo, taskType, modelName string, req relaycommon.TaskSubmitReq) (map[string][]string, error) {
	if len(req.Images) == 0 {
		return nil, fmt.Errorf("模型 %s 的任务类型 s2v(数字人)需要人物图:请提供 image/input_reference", modelName)
	}
	audio := metadataString(req.Metadata, "audio")
	if audio == "" {
		return nil, fmt.Errorf("模型 %s 的任务类型 s2v(数字人)需要驱动音频:请在 metadata.audio 提供音频 URL 或 base64", modelName)
	}
	m := newVideoMaterializer(info, taskType, modelName, req)
	ctx := c.Request.Context()

	if err := m.AddString(ctx, nfsinput.FieldImage, 0, false, req.Images[0]); err != nil {
		m.Cleanup()
		return nil, err
	}
	if err := m.AddString(ctx, nfsinput.FieldAudio, 0, false, audio); err != nil {
		m.Cleanup()
		return nil, err
	}
	return m.Refs(), nil
}

// materializeSRInputs 物化视频超分(SeedVR2)的源视频(metadata.video)。倍率 sr_ratio 不
// 物化——它随 metadata 透传进 body,门面转交引擎(引擎按 config 目标尺寸封顶)。
// 门面把 video→video_path 映射给 SeedVR2 引擎。
func materializeSRInputs(c *gin.Context, info *relaycommon.RelayInfo, taskType, modelName string, req relaycommon.TaskSubmitReq) (map[string][]string, error) {
	video := metadataString(req.Metadata, "video")
	if video == "" {
		return nil, fmt.Errorf("模型 %s 的任务类型 sr(超分)需要源视频:请在 metadata.video 提供视频 URL 或 base64", modelName)
	}
	m := newVideoMaterializer(info, taskType, modelName, req)
	if err := m.AddString(c.Request.Context(), nfsinput.FieldVideo, 0, false, video); err != nil {
		m.Cleanup()
		return nil, err
	}
	return m.Refs(), nil
}

// materializeDubInputs 物化视频配乐(v2a,LTX-2.3 首发)的源视频(metadata.video)。
// 契约:原视频画面逐帧不动,只补 AI 音轨,产物 mp4。门面把 video→video_path 给引擎;
// prompt(声音描述,可选)/negative_prompt/seed 等标量随 metadata 透传,不物化。
// 与 SR 同走视频大类上限(VideoModelConfig.maxInputMB)。
func materializeDubInputs(c *gin.Context, info *relaycommon.RelayInfo, taskType, modelName string, req relaycommon.TaskSubmitReq) (map[string][]string, error) {
	video := metadataString(req.Metadata, "video")
	if video == "" {
		return nil, fmt.Errorf("模型 %s 的任务类型 v2a(视频配乐)需要源视频:请在 metadata.video 提供视频 URL 或 base64", modelName)
	}
	m := newVideoMaterializer(info, taskType, modelName, req)
	if err := m.AddString(c.Request.Context(), nfsinput.FieldVideo, 0, false, video); err != nil {
		m.Cleanup()
		return nil, err
	}
	return m.Refs(), nil
}

// materializeBerniniInputs 物化 Bernini 视频玩法(视频编辑 + 图生视频)的输入。按输入
// 组合区分(与前端体验区自动分流规则一致):
//   - v2v  :纯提示词编辑,须有且只有 1 个源视频(metadata.src_video),参考图忽略;
//   - rv2v :1 个源视频 + 参考图(metadata.src_ref_images,单串或数组,≤MaxImageRefs);
//   - r2v  :参考图生视频(体验区「图生视频」),1~maxR2VRefImages 张参考图、无源视频;
//   - mv2v :双源视频多源编辑(metadata.src_video 为 2 元数组/逗号串),无参考图;
//   - ads2v:双源视频广告植入 —— 输入与 mv2v 相同(引擎侧 system prompt/guidance
//     不同),自动分流分不出,只能显式 task_type(预置示例带)。
//
// 门面把 src_video/src_ref_images 原样(无 _path 后缀)映射给 Bernini 引擎;多值字段
// 逗号拼接(门面 _MULTI_INPUT_FIELDS,src_video ≤2)。Bernini 无 mask,不处理 src_mask。
func materializeBerniniInputs(c *gin.Context, info *relaycommon.RelayInfo, taskType, modelName string, req relaycommon.TaskSubmitReq) (map[string][]string, error) {
	srcVideos := metadataStringList(req.Metadata, "src_video")
	refImages := metadataStringList(req.Metadata, "src_ref_images")
	if len(refImages) > nfsinput.MaxImageRefs {
		return nil, fmt.Errorf("模型 %s 的 metadata.src_ref_images 最多 %d 张,收到 %d 张", modelName, nfsinput.MaxImageRefs, len(refImages))
	}
	if len(srcVideos) > maxBerniniSrcVideos {
		return nil, fmt.Errorf("模型 %s 的 metadata.src_video 最多 %d 个视频,收到 %d 个", modelName, maxBerniniSrcVideos, len(srcVideos))
	}
	// 按 task_type 精确校验输入(前端已按输入组合分流,这里是服务端兜底,防直连绕过)。
	switch taskType {
	case "v2v":
		if len(srcVideos) != 1 {
			return nil, fmt.Errorf("模型 %s 的任务类型 v2v(视频编辑)需要且只需要 1 个源视频(metadata.src_video);两个视频请用 mv2v/ads2v", modelName)
		}
	case "rv2v":
		if len(srcVideos) != 1 || len(refImages) == 0 {
			return nil, fmt.Errorf("模型 %s 的任务类型 rv2v(参考视频编辑)需要 1 个源视频(metadata.src_video)和至少 1 张参考图(metadata.src_ref_images)", modelName)
		}
	case "r2v":
		if len(refImages) == 0 || len(refImages) > maxR2VRefImages {
			return nil, fmt.Errorf("模型 %s 的任务类型 r2v(图生视频)需要 1~%d 张参考图(metadata.src_ref_images)", modelName, maxR2VRefImages)
		}
		if len(srcVideos) != 0 {
			return nil, fmt.Errorf("模型 %s 的任务类型 r2v(图生视频)不接受源视频;含源视频的编辑请用 v2v/rv2v", modelName)
		}
	case "mv2v", "ads2v":
		if len(srcVideos) != 2 {
			return nil, fmt.Errorf("模型 %s 的任务类型 %s 需要恰好 2 个源视频(metadata.src_video 数组);单视频编辑请用 v2v/rv2v", modelName, taskType)
		}
	default:
		return nil, fmt.Errorf("模型 %s 的视频编辑任务类型 %s 不支持", modelName, taskType)
	}
	m := newVideoMaterializer(info, taskType, modelName, req)
	ctx := c.Request.Context()

	// 先写全部输入 → 再提交,任一路失败回滚已写文件避免孤儿。
	multiVideo := len(srcVideos) > 1
	for i, v := range srcVideos {
		if err := m.AddString(ctx, nfsinput.FieldSrcVideo, i, multiVideo, v); err != nil {
			m.Cleanup()
			return nil, err
		}
	}
	// v2v/mv2v/ads2v 只用源视频(参考图忽略);rv2v/r2v 物化参考图。
	if taskType == "rv2v" || taskType == "r2v" {
		for i, img := range refImages {
			if err := m.AddString(ctx, nfsinput.FieldSrcRefImages, i, true, img); err != nil {
				m.Cleanup()
				return nil, err
			}
		}
	}
	return m.Refs(), nil
}

// Bernini 输入基数上限(服务端兜底,与门面/产品约定对齐):
// maxBerniniSrcVideos 与门面 _MAX_INPUT_VIDEOS 一致(mv2v/ads2v 双视频);
// maxR2VRefImages 是「图生视频」产品档位(验证报告:5 张可控、8 张难控,产品定 3)。
const (
	maxBerniniSrcVideos = 2
	maxR2VRefImages     = 3
)

// inputGroupID 取本次请求的 input-group id:优先 info.PublicTaskID,空则新 uuid。
func inputGroupID(info *relaycommon.RelayInfo) string {
	if gid := strings.TrimSpace(info.PublicTaskID); gid != "" {
		return gid
	}
	return common.GetUUID()
}

// newVideoMaterializer 构造视频输入物化器,并按 VideoModelConfig 的 maxInputMB 设置单文件
// 大小上限(吃上传的 i2v/flf2v/s2v/sr/vace 通用护栏;0/未配=不限;服务端兜底防直连绕过前端)。
func newVideoMaterializer(info *relaycommon.RelayInfo, taskType, modelName string, req relaycommon.TaskSubmitReq) *nfsinput.Materializer {
	m := nfsinput.NewMaterializer(taskType, modelName, fmt.Sprintf("%d", info.UserId), inputGroupID(info))
	if maxBytes, ok := common.VideoMaxInputBytesForModel(req.Model, info.OriginModelName, modelName); ok {
		m.SetMaxBytes(maxBytes)
	}
	return m
}

// metadataStringList 从 metadata 取一个字符串列表:支持数组([]any 里的字符串)、
// 逗号分隔的单串、或单个字符串。用于 VACE 的 src_ref_images(可多张)。
func metadataStringList(md map[string]any, key string) []string {
	if md == nil {
		return nil
	}
	v, ok := md[key]
	if !ok {
		return nil
	}
	var out []string
	switch t := v.(type) {
	case string:
		s := strings.TrimSpace(t)
		if s == "" {
			break
		}
		// A data URL carries a comma in its own payload (data:...;base64,XXXX),
		// so never comma-split it — treat the whole string as one image. Only
		// plain URL/path lists are comma-separated; multiple data URLs must be
		// sent as a JSON array (handled by the []any/[]string cases below).
		if strings.HasPrefix(s, "data:") {
			out = append(out, s)
		} else {
			for _, part := range strings.Split(s, ",") {
				if p := strings.TrimSpace(part); p != "" {
					out = append(out, p)
				}
			}
		}
	case []any:
		for _, e := range t {
			if s, ok := e.(string); ok {
				if s = strings.TrimSpace(s); s != "" {
					out = append(out, s)
				}
			}
		}
	case []string:
		for _, s := range t {
			if s = strings.TrimSpace(s); s != "" {
				out = append(out, s)
			}
		}
	}
	return out
}

// metadataString 从请求 metadata 里安全取一个字符串值(容忍 nil / 非字符串)。
func metadataString(md map[string]any, key string) string {
	if md == nil {
		return ""
	}
	if v, ok := md[key]; ok {
		if s, ok := v.(string); ok {
			return strings.TrimSpace(s)
		}
	}
	return ""
}

// materializeTTSInputs 物化 IndexTTS-2 情感合成的参考音色(必填,metadata.voice)与可选
// 情感参考音(metadata.emotion_audio),返回 input_refs(field → 相对路径)。voice /
// emotion_audio 是 URL 或 base64/data-uri 音频字符串,与视频输入复用同一物化机制。
// IndexTTS-2 现由 vLLM-Omni 引擎服务(取代独立 IndexTTS),引擎读 ref_audio/emo_audio,
// 故:voice→ref_audio(门面映射 ref_audio→ref_audio_path)、emotion_audio→emo_audio_path
// (引擎 AudioTaskRequest 折叠 emo_audio_path→emo_audio)。情感向量/强度(emo_vector/
// emo_alpha)是标量,不在此物化——由 foldEmotionParamsIntoExtra 收进 body.extra_params。
func materializeTTSInputs(c *gin.Context, info *relaycommon.RelayInfo, taskType, modelName string, req relaycommon.TaskSubmitReq) (map[string][]string, error) {
	voice := metadataString(req.Metadata, "voice")
	if voice == "" {
		return nil, fmt.Errorf("模型 %s 的任务类型 tts 需要参考音色:请在 metadata.voice 提供音频 URL 或 base64", modelName)
	}
	m := nfsinput.NewMaterializer(taskType, modelName, fmt.Sprintf("%d", info.UserId), inputGroupID(info))
	// 参考音大小上限(AudioModelConfig,按模型/全局默认;0=不限):服务端兜底,防直连绕过
	// 前端上传限制(校验 base64 解码后 / URL 下载后的字节数,见 nfsinput.addBytesExt)。
	if maxBytes, ok := common.AudioRefAudioMaxBytesForModel(req.Model, info.OriginModelName, modelName); ok {
		m.SetMaxBytes(maxBytes)
	}
	ctx := c.Request.Context()

	// 参考音色(必填),单值;失败回滚。物化为 ref_audio(vLLM-Omni 引擎的克隆参考音字段)。
	if err := m.AddString(ctx, nfsinput.FieldRefAudio, 0, false, voice); err != nil {
		m.Cleanup()
		return nil, err
	}
	// 情感参考音(可选),单值。
	if emo := metadataString(req.Metadata, "emotion_audio"); emo != "" {
		if err := m.AddString(ctx, nfsinput.FieldEmotionAudio, 0, false, emo); err != nil {
			m.Cleanup()
			return nil, err
		}
	}
	return m.Refs(), nil
}

// materializeAudioXVideoInputs 物化 AudioX 视频→音乐(v2m/tv2m)的源视频
// (metadata.video)。门面把 video→video_path 映射给引擎(AudioX 用 av.open 读裸路径,无需
// file://)。audiox_task/seconds_total/num_inference_steps 等标量随 metadata 透传,不物化。
// 注:v2a/tv2a 已随 AudioX 视频配乐下线;v2a 契约改判给视频配乐,走 materializeDubInputs。
func materializeAudioXVideoInputs(c *gin.Context, info *relaycommon.RelayInfo, taskType, modelName string, req relaycommon.TaskSubmitReq) (map[string][]string, error) {
	video := metadataString(req.Metadata, "video")
	if video == "" {
		return nil, fmt.Errorf("模型 %s 的任务类型 %s(视频→音频/音乐)需要源视频:请在 metadata.video 提供视频 URL 或 base64", modelName, taskType)
	}
	// AudioX 归「音乐」大类,视频上限配在 MusicModelConfig.videoMaxMB(不是 VideoModelConfig)
	// —— 故不用 newVideoMaterializer(读视频模型配置),改直接建物化器 + 音乐视频上限兜底。
	m := nfsinput.NewMaterializer(taskType, modelName, fmt.Sprintf("%d", info.UserId), inputGroupID(info))
	if maxBytes, ok := common.MusicVideoMaxBytesForModel(req.Model, info.OriginModelName, modelName); ok {
		m.SetMaxBytes(maxBytes)
	}
	if err := m.AddString(c.Request.Context(), nfsinput.FieldVideo, 0, false, video); err != nil {
		m.Cleanup()
		return nil, err
	}
	return m.Refs(), nil
}

// materializeSingingInputs 物化 SoulX-Singer SVS 集成 preprocess 的输入:prompt_audio(音色
// 参考人声,必填)+ target_audio(目标曲/伴奏,必填)。服务器内联抽歌词/音符/音高,免预计算
// 元数据。门面把 prompt_audio/target_audio 原样(引擎 extra_args 同名键)映射给引擎;
// language/control/num_inference_steps 等标量随 metadata 透传。
func materializeSingingInputs(c *gin.Context, info *relaycommon.RelayInfo, taskType, modelName string, req relaycommon.TaskSubmitReq) (map[string][]string, error) {
	promptAudio := metadataString(req.Metadata, "prompt_audio")
	targetAudio := metadataString(req.Metadata, "target_audio")
	if promptAudio == "" || targetAudio == "" {
		return nil, fmt.Errorf("模型 %s 的任务类型 svs(歌声合成)需要 metadata.prompt_audio(音色参考)与 metadata.target_audio(目标曲/伴奏)", modelName)
	}
	m := nfsinput.NewMaterializer(taskType, modelName, fmt.Sprintf("%d", info.UserId), inputGroupID(info))
	// SoulX 归「音乐」大类,参考音上限配在 MusicModelConfig.refAudioMaxMB(不是 AudioModelConfig)。
	if maxBytes, ok := common.MusicRefAudioMaxBytesForModel(req.Model, info.OriginModelName, modelName); ok {
		m.SetMaxBytes(maxBytes)
	}
	ctx := c.Request.Context()
	if err := m.AddString(ctx, nfsinput.FieldPromptAudio, 0, false, promptAudio); err != nil {
		m.Cleanup()
		return nil, err
	}
	if err := m.AddString(ctx, nfsinput.FieldTargetAudio, 0, false, targetAudio); err != nil {
		m.Cleanup()
		return nil, err
	}
	return m.Refs(), nil
}

// isOmniTTSModel 判断 tts 任务的模型是否由 vLLM-Omni 引擎服务(区别于旧 IndexTTS)。
// 二者共用 task_type=tts,但参考音契约不同:IndexTTS 用必填 voice→spk_audio_path;
// vLLM-Omni 用可选 ref_audio/ref_audio_2 + 标量 speaker 预设音色。按模型名前缀区分
// (indextts 走旧路径,其余 TTS 家族走 Omni)。与 inferTaskType 的 tts 判定同源。
func isOmniTTSModel(modelName string) bool {
	m := strings.ToLower(modelName)
	if strings.Contains(m, "indextts") {
		return false
	}
	for _, k := range []string{
		"qwen3-tts", "voxcpm", "cosyvoice", "glm-tts", "moss",
	} {
		if strings.Contains(m, k) {
			return true
		}
	}
	return false
}

// materializeOmniTTSInputs 物化 vLLM-Omni TTS 的参考音输入(全部可选):
//   - ref_audio:克隆参考音(VoxCPM2/CosyVoice3 零样本克隆、MOSS-TTSD 说话人一),单值;
//   - ref_audio_2:MOSS-TTSD 双人对话第二说话人参考音,单值(需与 ref_audio 同时给)。
//
// 预设音色(Qwen3-TTS/GLM-TTS)走标量 metadata.speaker 透传,不在此物化;声音设计
// (MOSS-VoiceGenerator)与音效(MOSS-SoundEffect)纯文本,无参考音。因此本函数可能返回
// nil(无参考音输入),与 IndexTTS 的 voice 必填不同。门面把 ref_audio→ref_audio_path、
// ref_audio_2→ref_audio_2_path 注入引擎,引擎再转 file:// URI 交给 speech handler。
func materializeOmniTTSInputs(c *gin.Context, info *relaycommon.RelayInfo, taskType, modelName string, req relaycommon.TaskSubmitReq) (map[string][]string, error) {
	refAudio := metadataString(req.Metadata, "ref_audio")
	refAudio2 := metadataString(req.Metadata, "ref_audio_2")
	if refAudio == "" {
		if refAudio2 != "" {
			return nil, fmt.Errorf("模型 %s 提供了 ref_audio_2 却缺少 ref_audio:双人对话需先给第一说话人参考音", modelName)
		}
		return nil, nil // 预设音色 / 声音设计 / 音效:无参考音输入
	}
	m := nfsinput.NewMaterializer(taskType, modelName, fmt.Sprintf("%d", info.UserId), inputGroupID(info))
	if maxBytes, ok := common.AudioRefAudioMaxBytesForModel(req.Model, info.OriginModelName, modelName); ok {
		m.SetMaxBytes(maxBytes)
	}
	ctx := c.Request.Context()

	// 克隆参考音(单值);失败回滚。
	if err := m.AddString(ctx, nfsinput.FieldRefAudio, 0, false, refAudio); err != nil {
		m.Cleanup()
		return nil, err
	}
	// 第二说话人参考音(可选,MOSS-TTSD),单值。
	if refAudio2 != "" {
		if err := m.AddString(ctx, nfsinput.FieldRefAudio2, 0, false, refAudio2); err != nil {
			m.Cleanup()
			return nil, err
		}
	}
	return m.Refs(), nil
}

// materializeMusicInputs 物化音乐生成(ACE-Step)的音频输入:t2m 无输入(纯 prompt);
// cover 需参考音频(metadata.reference_audio);repaint 需源音频(metadata.src_audio)。
// 门面把 reference_audio → reference_audio_path、src_audio → src_audio_path 映射给引擎。
func materializeMusicInputs(c *gin.Context, info *relaycommon.RelayInfo, taskType, modelName string, req relaycommon.TaskSubmitReq) (map[string][]string, error) {
	if taskType == "t2m" {
		return nil, nil // 纯文本生成,无音频输入
	}
	var field nfsinput.Field
	var meta, label string
	switch taskType {
	case "cover":
		field, meta, label = nfsinput.FieldReferenceAudio, "reference_audio", "cover(覆盖生成)需要参考音频:请在 metadata.reference_audio"
	case "repaint":
		field, meta, label = nfsinput.FieldSrcAudio, "src_audio", "repaint(音乐重绘)需要源音频:请在 metadata.src_audio"
	default:
		return nil, fmt.Errorf("模型 %s 的音乐任务类型 %s 不支持", modelName, taskType)
	}
	audio := metadataString(req.Metadata, meta)
	if audio == "" {
		return nil, fmt.Errorf("模型 %s 的任务类型 %s 提供音频 URL 或 base64", modelName, label)
	}
	m := nfsinput.NewMaterializer(taskType, modelName, fmt.Sprintf("%d", info.UserId), inputGroupID(info))
	// 参考音/源音大小上限(MusicModelConfig,按模型/全局默认;0=不限):服务端兜底,防直连绕过。
	if maxBytes, ok := common.MusicRefAudioMaxBytesForModel(req.Model, info.OriginModelName, modelName); ok {
		m.SetMaxBytes(maxBytes)
	}
	// 单值音频(必填),失败回滚。
	if err := m.AddString(c.Request.Context(), field, 0, false, audio); err != nil {
		m.Cleanup()
		return nil, err
	}
	return m.Refs(), nil
}

func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
		return
	}
	_ = resp.Body.Close()

	var sr submitResponse
	if err := common.Unmarshal(responseBody, &sr); err != nil {
		taskErr = service.TaskErrorWrapper(errors.Wrapf(err, "body: %s", responseBody), "unmarshal_response_body_failed", http.StatusInternalServerError)
		return
	}
	if sr.TaskID == "" {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("upstream task_id is empty, body: %s", responseBody), "invalid_response", http.StatusInternalServerError)
		return
	}

	// 返回给客户端 OpenAI 兼容 video 对象(用公开 task_xxxx ID)。
	ov := dto.NewOpenAIVideo()
	ov.ID = info.PublicTaskID
	ov.TaskID = info.PublicTaskID
	ov.Model = info.OriginModelName
	ov.CreatedAt = time.Now().Unix()
	c.JSON(http.StatusOK, ov)

	return sr.TaskID, responseBody, nil
}

func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error) {
	taskID, ok := body["task_id"].(string)
	if !ok || taskID == "" {
		return nil, fmt.Errorf("invalid task_id")
	}
	uri := fmt.Sprintf("%s/v1/videos/%s", strings.TrimRight(baseUrl, "/"), taskID)
	req, err := http.NewRequest(http.MethodGet, uri, nil)
	if err != nil {
		return nil, err
	}
	if key != "" {
		req.Header.Set("Authorization", "Bearer "+key)
	}
	client, err := service.GetHttpClientWithProxy(proxy)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}
	return client.Do(req)
}

func (a *TaskAdaptor) ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error) {
	var sr statusResponse
	if err := common.Unmarshal(respBody, &sr); err != nil {
		return nil, errors.Wrap(err, "unmarshal task result failed")
	}
	ti := &relaycommon.TaskInfo{Code: 0, TaskID: sr.TaskID}

	// 门面状态机:queued(排队/等重派)→ assigned(已派发实例)→ running → done;
	// failed/canceled 终态。旧引擎态(pending/processing/completed)保留兼容。
	switch strings.ToLower(strings.TrimSpace(sr.Status)) {
	case "queued", "assigned", "pending", "submitted":
		ti.Status = model.TaskStatusQueued
	case "running", "processing", "in_progress":
		ti.Status = model.TaskStatusInProgress
	case "done", "completed", "succeed", "success":
		ti.Status = model.TaskStatusSuccess
		// 关键:把成品在 SFS 上的绝对路径交给落盘钩子(显式 nfs_path,非启发式)。
		ti.NFSPath = sr.NFSPath
	case "failed", "cancelled", "canceled", "error":
		ti.Status = model.TaskStatusFailure
		ti.Reason = firstNonEmpty(sr.Error, sr.ErrorType, "task failed")
	default:
		// 未知/空状态:保持排队,交后续轮询与超时兜底,避免误杀刚提交的任务。
		if strings.TrimSpace(sr.Status) != "" {
			common.SysLog(fmt.Sprintf("[gpustackplus] unrecognized task status %q, body: %s", sr.Status, string(respBody)))
		}
		ti.Status = model.TaskStatusQueued
	}
	return ti, nil
}

// ConvertToOpenAIVideo 供 /v1/videos/:id 查询走 OpenAI 兼容格式;url metadata 里的
// 结果链接由 model.Task.ToOpenAIVideo 经 ResolveResultURL 实时签成 OBS URL。
func (a *TaskAdaptor) ConvertToOpenAIVideo(task *model.Task) ([]byte, error) {
	ov := task.ToOpenAIVideo()
	data, err := common.Marshal(ov)
	if err != nil {
		return nil, errors.Wrap(err, "marshal openai video failed")
	}
	return data, nil
}

func (a *TaskAdaptor) GetModelList() []string {
	return ModelList
}

func (a *TaskAdaptor) GetChannelName() string {
	return ChannelName
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
