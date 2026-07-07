// Package gpustackplus(普通 Adaptor)实现 GPUStackPlus 的**同步图片**链路:
// /v1/images/generations(t2i)与 /v1/images/edits(i2i,qwen-image-edit)→
// 提交 GPUStack 异步门面 POST /v1/videos → 服务端阻塞轮询 GET /v1/videos/{id} →
// done 后拿 nfs_path(成品在共享 SFS 上的绝对路径)→ 落 OBS → 返回 OpenAI 图片
// 响应(OBS 签名 URL)。
//
// 与同名的 relay/channel/task/gpustackplus(任务 Adaptor,负责视频)区分:
// 同一渠道类型 ChannelTypeGPUStackPlus 的两条链路——视频走任务子系统(异步、
// 客户端轮询),图片走这里的同步 relay(服务端阻塞轮询,一次返回 URL)。
//
// 门面契约(2026-07-07 起,NFS 输入方案 + 反压加固,见 gpustack 仓
// docs/lightx2v-nfs-input-design.md 与 new-api 仓 docs/gpustackplus-sync-image-backpressure.md):
// 提交 body {model(必填), task_type: t2i|i2i, prompt, user_id, input_refs(相对 NFS 路径)};
// **不再发 base64/URL 的 image 字段**——输入由 new-api 统一物化落 NFS,只发相对 ref,门面校验后转
// image_path 交引擎直读。save_result_path / image_path 等引擎原生路径字段由门面 dictates;
// 状态 queued/assigned/running/done/failed/canceled。门面入口做 admission control:队列过深
// 返回 429 skip-retry(new-api 侧映射为 skip-retry,不重试放大反压)。
package gpustackplus

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/gpustackplus/nfsinput"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/mediastore"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// 轮询参数:生图(z-image ~8s / qwen-edit 热态 ~22-38s、冷启含加载可达分钟级)
// 远快于视频,3s 起轮、每 3s 一次、上限 ~5 分钟。
const (
	pollInitialDelay = 3 * time.Second
	pollInterval     = 3 * time.Second
	pollMaxSteps     = 100
)

// 反压加固常量(见 docs/gpustackplus-sync-image-backpressure.md §A2/D)。
const (
	// maxQueuedWait 任务仍停留在 QUEUED(尚未 ASSIGNED/RUNNING)的容忍上限;超过即
	// skip-retry「系统繁忙」,不死等到 5 分钟上限。进入 RUNNING 后此阈值不再生效。
	maxQueuedWait = 25 * time.Second
	// imageBlockingConcurrency 图片阻塞路径(pollUntilDone)的并发上限;超额快速 429,
	// 不排队占 goroutine。按集群产能保守取值,洪峰下保护 new-api 自身。
	imageBlockingConcurrency = 32
)

// imageBlockingSem 图片阻塞路径信号量(§D)。缓冲满 → 直接快速 429 skip-retry。
var imageBlockingSem = make(chan struct{}, imageBlockingConcurrency)

// busyRetryErr 反压/繁忙类快速失败:400/429 且 skip-retry,避免 new-api 渠道重试放大反压。
// 计费为纯后置(image_handler.PostTextConsumeQuota 在 DoResponse 成功之后),这些失败路径
// 走不到计费,一分不扣(见设计文档 §A0)。
func busyRetryErr(msg string, status int) *types.NewAPIError {
	return types.NewErrorWithStatusCode(errors.New(msg), types.ErrorCodeInvalidRequest, status, types.ErrOptionWithSkipRetry())
}

// submitResponse 门面提交接口返回(_public 形态)。
type submitResponse struct {
	TaskID string `json:"task_id"`
	Status string `json:"status"`
}

// statusResponse 门面状态接口返回;done 时 nfs_path 为成品绝对路径。
type statusResponse struct {
	TaskID    string `json:"task_id"`
	Status    string `json:"status"`
	NFSPath   string `json:"nfs_path"`
	Error     string `json:"error"`
	ErrorType string `json:"error_type"`
}

type Adaptor struct {
	baseURL string
	apiKey  string
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
	a.baseURL = strings.TrimRight(info.ChannelBaseUrl, "/")
	a.apiKey = info.ApiKey
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return fmt.Sprintf("%s/v1/videos", strings.TrimRight(info.ChannelBaseUrl, "/")), nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	req.Set("Content-Type", "application/json")
	if info.ApiKey != "" {
		req.Set("Authorization", "Bearer "+info.ApiKey)
	}
	return nil
}

// ConvertImageRequest 构造门面生图提交体:generations → t2i;edits → i2i。
// i2i 的底图(base64 / data-uri / multipart 文件 / URL)统一物化落 NFS,发 input_refs
// 相对路径(不再发 base64/URL 给门面)。物化顺序:先写全部输入 → 再返回 body 供提交。
func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	// 成品只落 SFS,必须经 OBS 才能对外提供 URL——存储关闭时提前拒绝,不占用 GPU。
	if !mediastore.Enabled() {
		return nil, errors.New("媒体存储(OBS)未启用,gpustackplus 渠道无法对外提供成品 URL,请先在系统设置启用")
	}
	if strings.TrimSpace(request.Prompt) == "" {
		return nil, errors.New("prompt is required")
	}
	modelName := firstNonEmpty(info.UpstreamModelName, request.Model, info.OriginModelName)
	if modelName == "" {
		return nil, errors.New("model is required(渠道模型映射与请求 model 均为空)")
	}

	// 若超管为该模型配置了尺寸白名单(系统设置→图片模型尺寸配置),按配置校验;
	// 未配置则不加限制。配置按公开模型名键控,故用 origin/request.Model(公开名)做 key。
	// 参数错误归为 400 并跳过重试——外层 image_handler 的 types.NewError 用 errors.As
	// 透传本错误,不会被覆盖成 500 可重试(否则会在预扣费后无谓重试)。
	if err := common.ValidateImageSizeForModel(request.Size, info.OriginModelName, request.Model); err != nil {
		return nil, types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}

	body := map[string]any{
		"model":   modelName,
		"prompt":  request.Prompt,
		"user_id": userIDStr(info),
	}

	// 用户选的绝对尺寸 → 引擎的 target_shape:[height,width](引擎按 2 元素精确像素出图,
	// 优先于 aspect_ratio;不传则引擎回落到 aspect_ratio 离散分辨率表 / 输入图尺寸)。
	// z-image / qwen-image(t2i)与 qwen-image-edit(i2i)共用同一引擎 shape 逻辑,统一透传。
	var targetShape []int
	if w, h, ok := common.DimsFromSize(request.Size); ok {
		targetShape = []int{h, w}
	}

	// 随机种子:仅本渠道使用,故不加进共享 dto.ImageRequest(否则会被其它渠道的
	// ConvertImageRequest 原样转发给不认 seed 的上游而报错)。JSON 请求的未知字段落在
	// dto.Extra(其 MarshalJSON 不外泄 Extra),multipart(edits)从表单取。非空即透传
	// 给引擎(BaseTaskRequest.seed);留空则引擎自动随机。t2i/i2i 均适用。
	if seed, ok := imageSeedFrom(c, request); ok {
		body["seed"] = seed
	}

	// 负向提示词:同样仅本渠道使用(从 Extra / 表单读),非空才透传给引擎(BaseTaskRequest.negative_prompt)。
	if np := imageNegativePromptFrom(c, request); np != "" {
		body["negative_prompt"] = np
	}

	switch info.RelayMode {
	case relayconstant.RelayModeImagesGenerations:
		body["task_type"] = "t2i"
		// aspect_ratio 作为 size 为空/不可解析时的兜底;有 target_shape 时引擎会优先用后者。
		if ar := common.AspectRatioFromSize(request.Size); ar != "" {
			body["aspect_ratio"] = ar
		}
		if targetShape != nil {
			body["target_shape"] = targetShape
		}
	case relayconstant.RelayModeImagesEdits:
		taskType := "i2i"
		body["task_type"] = taskType
		refs, err := materializeEditInputs(c, info, taskType, modelName, request)
		if err != nil {
			return nil, err
		}
		body["input_refs"] = refs
		if targetShape != nil {
			body["target_shape"] = targetShape
		}
	default:
		return nil, errors.New("gpustackplus 图片链路仅支持 /v1/images/generations 与 /v1/images/edits")
	}
	return body, nil
}

// materializeEditInputs 把 i2i 的底图 / 可选蒙版统一物化落 NFS,返回 input_refs
// (field → 相对路径数组)。底图来源:JSON image/images(字符串/数组;URL 或 base64/data-uri)
// 或 multipart 的 image 文件。蒙版走 JSON mask 字段(单值);有蒙版时底图只允许 1 张(引擎约束)。
func materializeEditInputs(c *gin.Context, info *relaycommon.RelayInfo, taskType, modelName string, request dto.ImageRequest) (map[string][]string, error) {
	m := nfsinput.NewMaterializer(taskType, modelName, userIDStr(info), inputGroupID(info))

	imgs, imgFiles, err := collectEditImages(c, request)
	if err != nil {
		return nil, err
	}
	total := len(imgs) + len(imgFiles)
	if total == 0 {
		return nil, errors.New("图片编辑(i2i)必须提供底图:JSON 的 image/images 字段或 multipart 的 image 文件")
	}
	if total > nfsinput.MaxImageRefs {
		return nil, fmt.Errorf("图片编辑最多支持 %d 张底图,当前 %d 张", nfsinput.MaxImageRefs, total)
	}

	// 蒙版(可选,单值):有蒙版时底图必须恰好 1 张(引擎约束,new-api 侧防呆)。
	maskRaw := extractMask(request)
	if maskRaw != "" && total != 1 {
		return nil, errors.New("带蒙版(mask)的图片编辑只允许 1 张底图")
	}

	multi := total > 1
	ctx := c.Request.Context()
	idx := 0
	// 多输入中途失败时回滚已写文件,避免孤儿(§N2 复审)。
	for _, s := range imgs {
		if err := m.AddString(ctx, nfsinput.FieldImage, idx, multi, s); err != nil {
			m.Cleanup()
			return nil, materializeErr(err)
		}
		idx++
	}
	for _, fh := range imgFiles {
		if err := m.AddMultipartFile(nfsinput.FieldImage, idx, multi, fh); err != nil {
			m.Cleanup()
			return nil, materializeErr(err)
		}
		idx++
	}
	if maskRaw != "" {
		if err := m.AddString(ctx, nfsinput.FieldImageMask, 0, false, maskRaw); err != nil {
			m.Cleanup()
			return nil, materializeErr(err)
		}
	}
	return m.Refs(), nil
}

// materializeErr 把物化错误(含 URL 下不到)统一归为 400 skip-retry,不提交任务、不重试。
func materializeErr(err error) *types.NewAPIError {
	return types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
}

// collectEditImages 从 edits 请求收集底图:JSON 的 image/images(字符串或字符串数组:URL 或
// base64/data-uri 字符串),以及 multipart 的 image/image[] 文件。字符串与文件分开返回,
// 由调用方按到达形态分别物化。
func collectEditImages(c *gin.Context, request dto.ImageRequest) ([]string, []*multipart.FileHeader, error) {
	var strs []string
	appendStr := func(s string) {
		if s = strings.TrimSpace(s); s != "" {
			strs = append(strs, s)
		}
	}
	parseRaw := func(raw []byte) {
		if len(raw) == 0 {
			return
		}
		var s string
		if err := common.Unmarshal(raw, &s); err == nil {
			appendStr(s)
			return
		}
		var arr []string
		if err := common.Unmarshal(raw, &arr); err == nil {
			for _, v := range arr {
				appendStr(v)
			}
		}
	}
	parseRaw(request.Image)
	parseRaw(request.Images)

	var files []*multipart.FileHeader
	if len(strs) == 0 {
		mf := c.Request.MultipartForm
		if mf == nil {
			if _, err := c.MultipartForm(); err == nil {
				mf = c.Request.MultipartForm
			}
		}
		if mf != nil && mf.File != nil {
			files = append(files, mf.File["image"]...)
			files = append(files, mf.File["image[]"]...)
		}
	}
	return strs, files, nil
}

// extractMask 取可选蒙版(JSON mask 字段:URL 或 base64/data-uri 字符串)。空则返回 ""。
func extractMask(request dto.ImageRequest) string {
	if len(request.Mask) == 0 {
		return ""
	}
	var s string
	if err := common.Unmarshal(request.Mask, &s); err == nil {
		return strings.TrimSpace(s)
	}
	return ""
}

// imageSeedFrom 取随机种子(仅本渠道消费,不放共享 dto):
// JSON 请求 → dto.Extra["seed"](未知字段);multipart(edits)→ 表单 seed 字段。
// 返回 (seed, true) 表示显式提供了合法整数种子;否则 (0, false)。
func imageSeedFrom(c *gin.Context, request dto.ImageRequest) (int64, bool) {
	if raw, ok := request.Extra["seed"]; ok && len(raw) > 0 {
		// 解到 *int64:JSON 的 null 会得到 nil(视为未提供,交引擎随机),
		// 只有真正的整数才算显式指定;避免把 "seed": null 误判成 seed=0。
		var v *int64
		if err := common.Unmarshal(raw, &v); err == nil && v != nil {
			return *v, true
		}
	}
	if s := strings.TrimSpace(c.PostForm("seed")); s != "" {
		if v, err := strconv.ParseInt(s, 10, 64); err == nil {
			return v, true
		}
	}
	return 0, false
}

// imageNegativePromptFrom 取负向提示词(仅本渠道消费,不放共享 dto):
// JSON 请求 → dto.Extra["negative_prompt"];multipart(edits)→ 表单字段。空则返回 ""。
func imageNegativePromptFrom(c *gin.Context, request dto.ImageRequest) string {
	if raw, ok := request.Extra["negative_prompt"]; ok && len(raw) > 0 {
		var s string
		if err := common.Unmarshal(raw, &s); err == nil {
			return strings.TrimSpace(s)
		}
	}
	return strings.TrimSpace(c.PostForm("negative_prompt"))
}

// userIDStr new-api 终端用户 id(字符串);与门面 user_id / NFS 路径 <user_id> 段一致。
func userIDStr(info *relaycommon.RelayInfo) string {
	return fmt.Sprintf("%d", info.UserId)
}

// inputGroupID 唯一 input-group id:优先 PublicTaskID,空则新 uuid。
// ⚠️ PublicTaskID 是内嵌 *TaskRelayInfo 上的字段,只有 task(视频)链路才初始化它;
// 图片同步链路 info.TaskRelayInfo 为 nil,直接读 info.PublicTaskID 会空指针 panic。
// 故先判 TaskRelayInfo 是否存在,图片链路一律用新 uuid。
func inputGroupID(info *relaycommon.RelayInfo) string {
	if info.TaskRelayInfo != nil && strings.TrimSpace(info.PublicTaskID) != "" {
		return info.PublicTaskID
	}
	return common.GetUUID()
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	resp, err := channel.DoApiRequest(a, c, info, requestBody)
	if err != nil {
		return nil, err
	}
	// 门面 admission control:队列过深返回 429。image_handler 会在 DoResponse 之前对非 200
	// 短路(RelayErrorHandler),故在此拦截 429 → skip-retry,防止渠道重试放大反压。
	if resp != nil && resp.StatusCode == http.StatusTooManyRequests {
		b, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		msg := strings.TrimSpace(string(b))
		if msg == "" {
			msg = "系统繁忙,请稍后再试"
		}
		return nil, busyRetryErr(msg, http.StatusTooManyRequests)
	}
	return resp, nil
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	if info.RelayMode != relayconstant.RelayModeImagesGenerations &&
		info.RelayMode != relayconstant.RelayModeImagesEdits {
		return nil, types.NewError(errors.New("gpustackplus 图片链路仅支持 /v1/images/generations 与 /v1/images/edits"), types.ErrorCodeInvalidRequest)
	}

	// 1) 读提交响应,取 upstream task_id。
	body, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		return nil, types.NewOpenAIError(readErr, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}
	_ = resp.Body.Close()
	var sr submitResponse
	if uErr := common.Unmarshal(body, &sr); uErr != nil {
		return nil, types.NewOpenAIError(fmt.Errorf("unmarshal submit resp: %w, body: %s", uErr, string(body)), types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	if sr.TaskID == "" {
		return nil, types.NewError(fmt.Errorf("upstream task_id empty, body: %s", string(body)), types.ErrorCodeBadResponse)
	}

	// 2) 并发上限(§D):图片阻塞路径信号量,满 → 快速 429 skip-retry,不排队占 goroutine。
	//    尽力取消已提交但排不上号的门面任务,不留孤儿。
	select {
	case imageBlockingSem <- struct{}{}:
		defer func() { <-imageBlockingSem }()
	default:
		a.cancelTask(c.Request.Context(), sr.TaskID)
		return nil, busyRetryErr("系统繁忙,请稍后再试", http.StatusTooManyRequests)
	}

	// 3) 阻塞轮询直到完成/失败(带 QUEUED 超时兜底 + 断开感知 + 超时/断开尽力 cancel)。
	st, pErr := a.pollUntilDone(c, sr.TaskID)
	if pErr != nil {
		if be, ok := pErr.(*types.NewAPIError); ok {
			return nil, be
		}
		return nil, types.NewError(pErr, types.ErrorCodeBadResponse)
	}
	if st.NFSPath == "" {
		return nil, types.NewError(errors.New("生图完成但门面未返回 nfs_path"), types.ErrorCodeBadResponse)
	}

	// 4) 落 OBS,拿签名 URL。
	signed, sErr := service.PersistImageNFSToOBS(c.Request.Context(), info.UserId, st.NFSPath)
	if sErr != nil {
		return nil, types.NewError(sErr, types.ErrorCodeBadResponse)
	}

	// 5) 组 OpenAI 图片响应写回客户端。
	imgResp := dto.ImageResponse{
		Created: info.StartTime.Unix(),
		Data:    []dto.ImageData{{Url: signed}},
	}
	jsonBytes, mErr := common.Marshal(imgResp)
	if mErr != nil {
		return nil, types.NewOpenAIError(mErr, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	service.IOCopyBytesGracefully(c, resp, jsonBytes)

	// 按次计费:占位 usage(真实扣费由模型价 × n 决定)。
	return &dto.Usage{PromptTokens: 1, TotalTokens: 1}, nil
}

// pollUntilDone 轮询门面 GET /v1/videos/{id} 直到 done/failed/canceled 或超时。
// 反压加固(§A2/B/C):
//   - QUEUED 滞留超 maxQueuedWait(仍未 ASSIGNED/RUNNING)→ skip-retry「系统繁忙」+ 尽力 cancel;
//   - 每轮等待用 select 监听 ctx.Done():客户端断开 → 停轮 + 尽力 cancel;
//   - 撞 5 分钟上限 → 尽力 cancel。
//
// 返回 *types.NewAPIError 时上层直接透传(保留 skip-retry / 状态码)。
func (a *Adaptor) pollUntilDone(c *gin.Context, taskID string) (*statusResponse, error) {
	ctx := c.Request.Context()
	client := service.GetHttpClient()
	uri := fmt.Sprintf("%s/v1/videos/%s", a.baseURL, taskID)

	queuedSince := time.Now() // 首次观测到 QUEUED 的起点;进入 RUNNING 后清零
	enteredRunning := false

	if !sleepOrDone(ctx, pollInitialDelay) {
		a.cancelTask(context.Background(), taskID)
		return nil, errClientGone()
	}
	for step := 0; step < pollMaxSteps; step++ {
		st, err := a.fetchStatus(ctx, client, uri)
		if err != nil {
			if !sleepOrDone(ctx, pollInterval) {
				a.cancelTask(context.Background(), taskID)
				return nil, errClientGone()
			}
			continue
		}
		switch strings.ToLower(strings.TrimSpace(st.Status)) {
		case "done", "completed", "succeed", "success":
			return st, nil
		case "failed", "cancelled", "canceled", "error":
			return nil, fmt.Errorf("生图失败: %s", firstNonEmpty(st.Error, st.ErrorType, "task failed"))
		case "assigned", "running", "processing", "in_progress":
			// 已派发实例(assigned)或已在算(running):越过队列,QUEUED 超时不再约束。
			enteredRunning = true
		default:
			// queued/pending/submitted/未知:仍在排队,受 QUEUED 超时兜底约束(§A2)。
			if !enteredRunning && time.Since(queuedSince) > maxQueuedWait {
				a.cancelTask(context.Background(), taskID)
				return nil, busyRetryErr("系统繁忙,请稍后再试", http.StatusTooManyRequests)
			}
		}
		if !sleepOrDone(ctx, pollInterval) {
			a.cancelTask(context.Background(), taskID)
			return nil, errClientGone()
		}
	}
	// 撞 5 分钟上限:尽力 cancel,不留孤儿输出、不空烧 GPU。返回 skip-retry(§C)——
	// 否则 DoResponse 会把它包成可重试 500,relay 立刻再提交一个 GPU 任务,放大反压。
	a.cancelTask(context.Background(), taskID)
	return nil, busyRetryErr("生图超时,请稍后再试", http.StatusGatewayTimeout)
}

// errClientGone 客户端断开:skip-retry(客户端已走,重试无意义),不计费。
func errClientGone() *types.NewAPIError {
	return types.NewErrorWithStatusCode(errors.New("客户端已断开连接"), types.ErrorCodeInvalidRequest, http.StatusRequestTimeout, types.ErrOptionWithSkipRetry())
}

// sleepOrDone 等待 d,或在 ctx 取消(客户端断开)时提前返回 false(§B)。
func sleepOrDone(ctx context.Context, d time.Duration) bool {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-t.C:
		return true
	}
}

// cancelTask best-effort 调门面 POST /v1/videos/{id}/cancel;失败仅记日志(§B/C)。
// 用独立 context(不复用可能已取消的请求 ctx),带短超时。
func (a *Adaptor) cancelTask(_ context.Context, taskID string) {
	if strings.TrimSpace(taskID) == "" {
		return
	}
	cctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	uri := fmt.Sprintf("%s/v1/videos/%s/cancel", a.baseURL, taskID)
	req, err := http.NewRequestWithContext(cctx, http.MethodPost, uri, nil)
	if err != nil {
		common.SysLog(fmt.Sprintf("[gpustackplus] build cancel request failed for task %s: %v", taskID, err))
		return
	}
	if a.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+a.apiKey)
	}
	resp, err := service.GetHttpClient().Do(req)
	if err != nil {
		common.SysLog(fmt.Sprintf("[gpustackplus] cancel task %s failed: %v", taskID, err))
		return
	}
	_ = resp.Body.Close()
}

func (a *Adaptor) fetchStatus(ctx context.Context, client *http.Client, uri string) (*statusResponse, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, uri, nil)
	if err != nil {
		return nil, err
	}
	if a.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+a.apiKey)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("status endpoint %d: %s", resp.StatusCode, string(body))
	}
	var st statusResponse
	if err := common.Unmarshal(body, &st); err != nil {
		return nil, err
	}
	return &st, nil
}

func (a *Adaptor) GetModelList() []string { return ModelList }
func (a *Adaptor) GetChannelName() string { return ChannelName }

// ————— 以下模式不适用于本渠道,返回 not available —————

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	return nil, errors.New("not available")
}
func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return nil, errors.New("not available")
}
func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return nil, errors.New("not available")
}
func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	return nil, errors.New("not available")
}
func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	return nil, errors.New("not available")
}
func (a *Adaptor) ConvertGeminiRequest(*gin.Context, *relaycommon.RelayInfo, *dto.GeminiChatRequest) (any, error) {
	return nil, errors.New("not available")
}
func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	return nil, errors.New("not available")
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
