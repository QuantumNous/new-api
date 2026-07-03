// Package gpustackplus（普通 Adaptor）实现 GPUStackPlus 的**同步生图**链路：
// /v1/images/generations → 提交 LightX2V /v1/tasks/image/（异步）→ 阻塞轮询 status →
// 拿 save_result_path（成品在 SFS 上的绝对路径）→ 落 OBS → 返回 OpenAI 图片响应（OBS 签名 URL）。
//
// 与同名的 relay/channel/task/gpustackplus（任务 Adaptor，负责视频）区分：
// 同一渠道类型 ChannelTypeGPUStackPlus 的两条链路——视频走任务子系统（异步、客户端轮询），
// 图片走这里的同步 relay（服务端阻塞轮询，一次返回 URL）。
package gpustackplus

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/mediastore"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// 轮询参数：生图（如 Z-Image 9 步 ~8s）远快于视频，5s 起轮、每 3s 一次、上限 ~5 分钟。
const (
	pollInitialDelay = 3 * time.Second
	pollInterval     = 3 * time.Second
	pollMaxSteps     = 100
)

type submitResponse struct {
	TaskID         string `json:"task_id"`
	TaskStatus     string `json:"task_status"`
	SaveResultPath string `json:"save_result_path"`
}

type statusResponse struct {
	TaskID         string `json:"task_id"`
	Status         string `json:"status"`
	Error          string `json:"error"`
	ErrorType      string `json:"error_type"`
	SaveResultPath string `json:"save_result_path"`
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
	return fmt.Sprintf("%s/v1/tasks/image/", strings.TrimRight(info.ChannelBaseUrl, "/")), nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	req.Set("Content-Type", "application/json")
	if info.ApiKey != "" {
		req.Set("Authorization", "Bearer "+info.ApiKey)
	}
	return nil
}

// ConvertImageRequest 构造 LightX2V 生图提交体，并由 new-api 拼含 user_id 的 save_result_path
// + 建好父目录（new-api 对该 SFS 有写权限）。
func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	// 目前只支持文生图。图片编辑（/v1/images/edits）需要转发底图/蒙版并改走 i2i 端点，
	// 尚未实现——提前拒绝，避免把底图丢弃后静默退化成一次纯文生图（给错结果）。
	if info.RelayMode == relayconstant.RelayModeImagesEdits {
		return nil, errors.New("gpustackplus 暂不支持图片编辑（/v1/images/edits），请使用 /v1/images/generations")
	}
	// 成品只落 SFS，必须经 OBS 才能对外提供 URL——存储关闭时提前拒绝，不占用 GPU。
	if !mediastore.Enabled() {
		return nil, errors.New("媒体存储（OBS）未启用，gpustackplus 渠道无法对外提供成品 URL，请先在系统设置启用")
	}
	if strings.TrimSpace(request.Prompt) == "" {
		return nil, errors.New("prompt is required")
	}
	savePath, err := buildSaveResultPath(info, request)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Dir(savePath), 0o755); err != nil {
		return nil, fmt.Errorf("mkdir save_result_path dir failed (new-api 是否已读写挂载 SFS?): %w", err)
	}
	body := map[string]any{
		"prompt":           request.Prompt,
		"save_result_path": savePath,
	}
	return body, nil
}

// buildSaveResultPath 拼 <root>/t2i-<模型>/YYYY/MM/DD/<user_id>/<rand>.png。
func buildSaveResultPath(info *relaycommon.RelayInfo, request dto.ImageRequest) (string, error) {
	root := system_setting.GetMediaStorageSettings().NFSRoot()
	modelSeg := sanitizeSeg(firstNonEmpty(info.OriginModelName, info.UpstreamModelName, request.Model, "model"))
	now := time.Now().UTC()
	name := "img_" + common.GetRandomString(16) + ".png"
	return filepath.Join(
		root,
		"t2i-"+modelSeg,
		fmt.Sprintf("%04d", now.Year()),
		fmt.Sprintf("%02d", int(now.Month())),
		fmt.Sprintf("%02d", now.Day()),
		fmt.Sprintf("%d", info.UserId),
		name,
	), nil
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	if info.RelayMode != relayconstant.RelayModeImagesGenerations {
		// 只认文生图；edits 已在 ConvertImageRequest 提前拒绝，这里是防御性收紧。
		return nil, types.NewError(errors.New("gpustackplus 渠道仅支持生图 /v1/images/generations"), types.ErrorCodeInvalidRequest)
	}

	// 1) 读提交响应，取 upstream task_id。
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
	nfsPath := firstNonEmpty(st.SaveResultPath, sr.SaveResultPath)
	if nfsPath == "" {
		return nil, types.NewError(errors.New("生图完成但未返回 save_result_path"), types.ErrorCodeBadResponse)
	}

	// 3) 落 OBS，拿签名 URL。
	signed, sErr := service.PersistImageNFSToOBS(c.Request.Context(), info.UserId, nfsPath)
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

	// 按次计费：占位 usage（真实扣费由模型价 × n 决定）。
	return &dto.Usage{PromptTokens: 1, TotalTokens: 1}, nil
}

// pollUntilDone 轮询 /v1/tasks/{id}/status 直到 completed/failed/cancelled 或超时。
func (a *Adaptor) pollUntilDone(c *gin.Context, taskID string) (*statusResponse, error) {
	client := service.GetHttpClient()
	uri := fmt.Sprintf("%s/v1/tasks/%s/status", a.baseURL, taskID)
	time.Sleep(pollInitialDelay)
	for step := 0; step < pollMaxSteps; step++ {
		st, err := a.fetchStatus(c.Request.Context(), client, uri)
		if err != nil {
			time.Sleep(pollInterval)
			continue
		}
		switch strings.ToLower(strings.TrimSpace(st.Status)) {
		case "completed", "succeed", "success":
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

// ————— 以下模式不适用于本渠道，返回 not available —————

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

func sanitizeSeg(s string) string {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, "/", "_")
	s = strings.ReplaceAll(s, "\\", "_")
	s = strings.ReplaceAll(s, " ", "_")
	if s == "" {
		return "model"
	}
	return s
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
