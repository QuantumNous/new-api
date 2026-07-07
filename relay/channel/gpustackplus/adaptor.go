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
// 门面契约(2026-07-06 上线,gpustack 仓 docs/lightx2v-m4-m5-handover.md):
// 提交 body {model(必填), task_type: t2i|i2i, prompt, user_id, image(URL/base64)};
// save_result_path / image_path 等引擎原生路径字段由门面 dictates,外部传入会被
// 剥掉——new-api 不再拼路径/mkdir;状态 queued/assigned/running/done/failed/canceled。
package gpustackplus

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
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

// ConvertImageRequest 构造门面生图提交体:generations → t2i;edits → i2i(带底图,
// URL / base64 直透,multipart 文件读字节转 data-uri;门面负责持久化到 SFS 再喂引擎)。
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
		"user_id": info.UserId,
	}

	switch info.RelayMode {
	case relayconstant.RelayModeImagesGenerations:
		body["task_type"] = "t2i"
		if ar := common.AspectRatioFromSize(request.Size); ar != "" {
			body["aspect_ratio"] = ar
		}
	case relayconstant.RelayModeImagesEdits:
		body["task_type"] = "i2i"
		img, err := extractEditImage(c, request)
		if err != nil {
			return nil, err
		}
		body["image"] = img
	default:
		return nil, errors.New("gpustackplus 图片链路仅支持 /v1/images/generations 与 /v1/images/edits")
	}
	return body, nil
}

// extractEditImage 从 edits 请求取底图:JSON 的 image 字段(字符串或数组首元素,
// URL / data-uri / 裸 base64 门面都认)或 multipart 的 image 文件(读字节转 data-uri)。
func extractEditImage(c *gin.Context, request dto.ImageRequest) (string, error) {
	// JSON 请求:image 字段直透。
	if len(request.Image) > 0 {
		var s string
		if err := common.Unmarshal(request.Image, &s); err == nil && strings.TrimSpace(s) != "" {
			return s, nil
		}
		var arr []string
		if err := common.Unmarshal(request.Image, &arr); err == nil && len(arr) > 0 && strings.TrimSpace(arr[0]) != "" {
			return arr[0], nil
		}
	}
	// multipart 请求:读第一个 image 文件。
	mf := c.Request.MultipartForm
	if mf == nil {
		if _, err := c.MultipartForm(); err == nil {
			mf = c.Request.MultipartForm
		}
	}
	if mf != nil && mf.File != nil {
		files := mf.File["image"]
		if len(files) == 0 {
			files = mf.File["image[]"]
		}
		if len(files) > 0 {
			f, err := files[0].Open()
			if err != nil {
				return "", fmt.Errorf("打开上传底图失败: %w", err)
			}
			defer f.Close()
			data, err := io.ReadAll(f)
			if err != nil {
				return "", fmt.Errorf("读取上传底图失败: %w", err)
			}
			mime := http.DetectContentType(data)
			return "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(data), nil
		}
	}
	return "", errors.New("图片编辑(i2i)必须提供底图:JSON 的 image 字段或 multipart 的 image 文件")
}


func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
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

	// 2) 阻塞轮询直到完成/失败。
	st, pErr := a.pollUntilDone(c, sr.TaskID)
	if pErr != nil {
		return nil, types.NewError(pErr, types.ErrorCodeBadResponse)
	}
	if st.NFSPath == "" {
		return nil, types.NewError(errors.New("生图完成但门面未返回 nfs_path"), types.ErrorCodeBadResponse)
	}

	// 3) 落 OBS,拿签名 URL。
	signed, sErr := service.PersistImageNFSToOBS(c.Request.Context(), info.UserId, st.NFSPath)
	if sErr != nil {
		return nil, types.NewError(sErr, types.ErrorCodeBadResponse)
	}

	// 4) 组 OpenAI 图片响应写回客户端。
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
func (a *Adaptor) pollUntilDone(c *gin.Context, taskID string) (*statusResponse, error) {
	client := service.GetHttpClient()
	uri := fmt.Sprintf("%s/v1/videos/%s", a.baseURL, taskID)
	time.Sleep(pollInitialDelay)
	for step := 0; step < pollMaxSteps; step++ {
		st, err := a.fetchStatus(c.Request.Context(), client, uri)
		if err != nil {
			time.Sleep(pollInterval)
			continue
		}
		switch strings.ToLower(strings.TrimSpace(st.Status)) {
		case "done", "completed", "succeed", "success":
			return st, nil
		case "failed", "cancelled", "canceled", "error":
			return nil, fmt.Errorf("生图失败: %s", firstNonEmpty(st.Error, st.ErrorType, "task failed"))
		}
		time.Sleep(pollInterval)
	}
	return nil, errors.New("生图轮询超时")
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
