package channel

import (
	"context"
	"io"
	"net/http"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

type Adaptor interface {
	// Init IsStream bool
	Init(info *relaycommon.RelayInfo)
	GetRequestURL(info *relaycommon.RelayInfo) (string, error)
	SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error
	ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error)
	ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error)
	ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error)
	ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error)
	ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error)
	ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error)
	DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error)
	DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError)
	GetModelList() []string
	GetChannelName() string
	ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error)
	ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error)
}

type TaskAdaptor interface {
	Init(info *relaycommon.RelayInfo)

	ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError

	// ── Billing ──────────────────────────────────────────────────────

	// EstimateBilling returns OtherRatios for pre-charge based on user request.
	// Called after ValidateRequestAndSetAction, before price calculation.
	// Adaptors should extract duration, resolution, etc. from the parsed request
	// and return them as ratio multipliers (e.g. {"seconds": 5, "size": 1.666}).
	// Return nil to use the base model price without extra ratios.
	EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64

	// AdjustBillingOnSubmit returns adjusted OtherRatios from the upstream
	// submit response. Called after a successful DoResponse.
	// If the upstream returned actual parameters that differ from the estimate
	// (e.g. actual seconds), return updated ratios so the caller can recalculate
	// the quota and settle the delta with the pre-charge.
	// Return nil if no adjustment is needed.
	AdjustBillingOnSubmit(info *relaycommon.RelayInfo, taskData []byte) map[string]float64

	// AdjustBillingOnComplete returns the actual quota when a task reaches a
	// terminal state (success/failure) during polling.
	// Called by the polling loop after ParseTaskResult.
	// Return a positive value to trigger delta settlement (supplement / refund).
	// Return 0 to keep the pre-charged amount unchanged.
	//
	// 接口契约（GCS 转存模式，gcs-video-transfer-design.md 4.4）：转存 worker 结算时
	// 传入的 taskResult 由 PrivateData.SettleTokens 合成，仅保证 TotalTokens 有效。
	// 实现不得读取 taskResult 的其他字段（Url/Progress/Reason 等），否则需先扩展
	// SettleTokens 的持久化集。当前唯一非默认实现 pollo 只读 TotalTokens。
	AdjustBillingOnComplete(task *model.Task, taskResult *relaycommon.TaskInfo) int

	// ── Request / Response ───────────────────────────────────────────

	BuildRequestURL(info *relaycommon.RelayInfo) (string, error)
	BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error
	BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error)

	DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error)
	DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, err *dto.TaskError)

	GetModelList() []string
	GetChannelName() string

	// ── Polling ──────────────────────────────────────────────────────

	FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error)
	ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error)

	// ── GCS Transfer (gcs-video-transfer-design.md 4.2) ─────────────

	// ExtractUpstreamAssets 在"上游成功"时由轮询循环调用，枚举本任务的全部结果资产。
	// rawRespBody 是上游查询响应的原始字节（URL/base64 脱敏前）——多资产渠道
	// （Vidu/Pollo）只能从原始响应解析，不得依赖 task.Data（其内容受脱敏时序影响）。
	// 调用点硬顺序（S6）：先 Extract 暂存进 PrivateData.UpstreamAssets，后 URL 脱敏，
	// 再落库；转存重试不再依赖 task.Data。
	// 返回 error 或空清单时，本轮不进入转存阶段（不写 UpstreamDoneAt），下一轮重试。
	ExtractUpstreamAssets(task *model.Task, taskResult *relaycommon.TaskInfo, rawRespBody []byte) ([]taskcommon.UpstreamAsset, error)

	// FetchResultContent 返回单个资产的内容流，由异步转存 worker（S5）调用，
	// 可能发起带鉴权的上游请求（Sora content 端点 / Gemini 文件 URI / Vertex 重取 base64）。
	// 取流凭证解析顺序：task.PrivateData.Key 优先、ch.Key 兜底（taskcommon.ResolveTaskFetchKey）。
	// 实现必须：URL 下载前过 common.ValidateURLWithFetchSetting、使用 service.GetHttpClient
	// 系列共享 client（禁止裸 http.Client）、超时经 ctx 强制。
	// 返回 (内容流, Content-Type, error)，调用方负责 Close。
	FetchResultContent(ctx context.Context, task *model.Task, ch *model.Channel, asset taskcommon.UpstreamAsset) (io.ReadCloser, string, error)
}

type OpenAIVideoConverter interface {
	ConvertToOpenAIVideo(originTask *model.Task) ([]byte, error)
}
