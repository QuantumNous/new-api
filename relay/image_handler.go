package relay

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func ImageHelper(c *gin.Context, info *relaycommon.RelayInfo) (newAPIError *types.NewAPIError) {
	info.InitChannelMeta(c)

	imageReq, ok := info.Request.(*dto.ImageRequest)
	if !ok {
		return types.NewErrorWithStatusCode(fmt.Errorf("invalid request type, expected dto.ImageRequest, got %T", info.Request), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}

	request, err := common.DeepCopy(imageReq)
	if err != nil {
		return types.NewError(fmt.Errorf("failed to copy request to ImageRequest: %w", err), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}

	err = helper.ModelMappedHelper(c, info, request)
	if err != nil {
		return types.NewError(err, types.ErrorCodeChannelModelMappedError, types.ErrOptionWithSkipRetry())
	}

	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return types.NewError(fmt.Errorf("invalid api type: %d", info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(info)

	// The settlement key may survive a previous failed attempt on this same
	// gin.Context (the relay retry loop reuses it). Clear it so the
	// bill-through guard below only ever sees signals from THIS attempt.
	delete(c.Keys, string(constant.ContextKeyBlockRunSettlement))

	// info is likewise shared across retry attempts: a prior blockrun attempt
	// may have set IsStream=true in its ConvertImageRequest. Image requests
	// always start non-streaming (dto.ImageRequest carries no stream state into
	// GenRelayInfo), so reset and let this attempt's converter / Content-Type
	// sniff re-derive it.
	info.IsStream = false

	var requestBody io.Reader

	// codex 图像必须走 ConvertImageRequest 合成 Responses + image_generation body：
	// 原始 OpenAI /v1/images body 与上游 /backend-api/codex/responses 结构不兼容，
	// 直接透传会导致 info.IsStream 永不置位、上游 400，图像静默损坏。
	// 因此对 codex 图像路径强制忽略 PassThrough（全局/渠道级），仅缩小到本 ApiType，
	// 不影响其它渠道的透传行为。ImageHelper 仅在图像 relay mode 下被调用，故此处
	// 判断 ApiType 即等价于「codex 渠道 + 图像模式」。
	codexImagePath := info.ApiType == constant.APITypeCodex

	if !codexImagePath && (model_setting.GetGlobalSettings().PassThroughRequestEnabled || info.ChannelSetting.PassThroughBodyEnabled) {
		storage, err := common.GetBodyStorage(c)
		if err != nil {
			return types.NewErrorWithStatusCode(err, types.ErrorCodeReadRequestBodyFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		requestBody = common.ReaderOnly(storage)
	} else {
		convertedRequest, err := adaptor.ConvertImageRequest(c, info, *request)
		if err != nil {
			// 适配器已显式带状态码的错误，原样透传（保留其 4xx/5xx 语义）。
			if apiErr, ok := err.(*types.NewAPIError); ok {
				return apiErr
			}
			// codex 图像的 ConvertImageRequest 错误均为入参校验类（response_format /
			// 模型前缀 / 缺少 image / mask 读取失败），属客户端输入错误，返回 400 而非 500。
			if codexImagePath {
				return types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
			}
			return types.NewError(err, types.ErrorCodeConvertRequestFailed)
		}
		relaycommon.AppendRequestConversionFromRequest(info, convertedRequest)

		switch convertedRequest.(type) {
		case *bytes.Buffer:
			requestBody = convertedRequest.(io.Reader)
		default:
			jsonData, err := common.Marshal(convertedRequest)
			if err != nil {
				return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
			}

			// apply param override
			if len(info.ParamOverride) > 0 {
				jsonData, err = relaycommon.ApplyParamOverrideWithRelayInfo(jsonData, info)
				if err != nil {
					return newAPIErrorFromParamOverride(err)
				}
			}

			logger.LogDebug(c, "image request body: %s", jsonData)
			body, size, closer, err := relaycommon.NewOutboundJSONBody(jsonData)
			if err != nil {
				return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
			}
			defer closer.Close()
			jsonData = nil
			info.UpstreamRequestBodySize = size
			requestBody = body
		}
	}

	statusCodeMappingStr := c.GetString("status_code_mapping")

	resp, err := adaptor.DoRequest(c, info, requestBody)
	if err != nil {
		// Once any bytes have reached the client (e.g. the blockrun image-stream
		// heartbeat / SSE error event), a retry can never produce a clean
		// response — it would replay a whole relay onto the same stream.
		if c.Writer.Written() {
			return types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError, types.ErrOptionWithSkipRetry())
		}
		return types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	}
	var httpResp *http.Response
	if resp != nil {
		httpResp = resp.(*http.Response)
		info.IsStream = info.IsStream || strings.HasPrefix(httpResp.Header.Get("Content-Type"), "text/event-stream")
		if httpResp.StatusCode != http.StatusOK {
			if httpResp.StatusCode == http.StatusCreated && info.ApiType == constant.APITypeReplicate {
				// replicate channel returns 201 Created when using Prefer: wait, treat it as success.
				httpResp.StatusCode = http.StatusOK
			} else {
				newAPIError = service.RelayErrorHandler(c.Request.Context(), httpResp, false)
				// reset status code 重置状态码
				service.ResetStatusCode(newAPIError, statusCodeMappingStr)
				return newAPIError
			}
		}
	}

	usage, newAPIError := adaptor.DoResponse(c, httpResp, info)
	if newAPIError != nil {
		// BlockRun settlement is irreversible the moment a poll observes
		// "completed". If cost signals were captured, the upstream has been (or
		// will be) charged — a late client disconnect / body-write failure must
		// not skip local billing, and retrying would double-pay. Bill through.
		//
		// Key presence here implies settlement really happened: the async poll
		// loop runs inside DoRequest, so an envelope price captured without the
		// poll ever observing "completed" exits via the DoRequest error path
		// above and never reaches this guard. Reaching DoResponse with the key
		// set means the poll saw "completed" (or a sync response already
		// carried a payment receipt).
		//
		// Tradeoff: swallowing the error means the client may receive a hollow
		// 200 (empty body). That is intentional — billing correctness beats
		// delivery, because surfacing the error would trigger a channel retry
		// and a second upstream payment. The request id in the warn log keeps
		// the incident traceable.
		if _, settled := c.Get(string(constant.ContextKeyBlockRunSettlement)); settled {
			logger.LogWarn(c, fmt.Sprintf("blockrun image: upstream settled but response delivery failed, billing anyway (user=%d channel=%d model=%s): %s", info.UserId, info.ChannelId, info.OriginModelName, newAPIError.Error()))
			if usage == nil {
				usage = &dto.Usage{}
			}
		} else {
			// reset status code 重置状态码
			service.ResetStatusCode(newAPIError, statusCodeMappingStr)
			return newAPIError
		}
	}

	imageN := uint(1)
	if request.N != nil {
		imageN = *request.N
	}

	// n is handled via OtherRatio so it is applied exactly once in quota
	// calculation (both price-based and ratio-based paths).
	// Adaptors may have already set a more accurate count from the
	// upstream response; only set the default when they haven't.
	// On the bill-through path (settlement captured but delivery failed) the
	// client-requested n still applies on purpose: the upstream settles the
	// request as submitted, so we charge for what was submitted, not for what
	// was delivered.
	if info.PriceData.UsePrice { // only price model use N ratio
		if _, hasN := info.PriceData.OtherRatios["n"]; !hasN {
			info.PriceData.AddOtherRatio("n", float64(imageN))
		}
	}

	if usage.(*dto.Usage).TotalTokens == 0 {
		usage.(*dto.Usage).TotalTokens = 1
	}
	if usage.(*dto.Usage).PromptTokens == 0 {
		usage.(*dto.Usage).PromptTokens = 1
	}

	quality := request.Quality
	if quality == "" {
		quality = "standard"
	}

	var logContent []string

	if len(request.Size) > 0 {
		logContent = append(logContent, fmt.Sprintf("大小 %s", request.Size))
	}
	if len(quality) > 0 {
		logContent = append(logContent, fmt.Sprintf("品质 %s", quality))
	}
	if imageN > 0 {
		logContent = append(logContent, fmt.Sprintf("生成数量 %d", imageN))
	}

	service.PostTextConsumeQuota(c, info, usage.(*dto.Usage), logContent)
	return nil
}
