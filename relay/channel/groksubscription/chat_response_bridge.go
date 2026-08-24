package groksubscription

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/pkg/apicompat"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

// RelayChatOverGrok 处理 CLI proxy 返回的 Responses SSE，并按客户端原始 stream
// 意图（info.UserWantsStream）选择回写形式，与上游“恒流式”彻底解耦（修复 C1）：
//   - true:  逐事件转 Chat Completions SSE chunk（复用已验证的 openai handler）
//   - false: 聚合所有增量后一次性返回单个 chat.completion JSON
//
// 绝不能用 info.IsStream 决定：compatible_handler 会因上游 Content-Type=SSE 把它抬成 true。
//
// 非 200 兜底：上层 compatible_handler.go 已对非 2xx 做 RelayErrorHandler 预过滤，
// 正常情况下非 200 响应到不了本函数；aggregateGrokResponsesToChat 里的非 200 检查是
// 纵深防御。流式路径因此不再做本地非 200 兜底（openai handler 内部自行处理）。
func RelayChatOverGrok(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (any, *types.NewAPIError) {
	if info != nil && info.UserWantsStream {
		return openai.OaiResponsesToChatStreamHandler(c, info, resp)
	}
	return aggregateGrokResponsesToChat(c, info, resp)
}

// aggregateGrokResponsesToChat 缓冲 Responses SSE，合并成单个 Chat JSON 回写。
func aggregateGrokResponsesToChat(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (any, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return buildGrokUsage(nil), types.NewError(errors.New("grok subscription channel: nil upstream response"), types.ErrorCodeBadResponse)
	}
	if resp.StatusCode != http.StatusOK {
		// 上限读取照 refresh.go / token_exchange.go 的 LimitReader 先例；达上限时标记
		// truncated，防止把残缺 JSON 误读为完整。
		body, _ := io.ReadAll(io.LimitReader(resp.Body, maxTokenResponseBytes))
		truncated := ""
		if len(body) == maxTokenResponseBytes {
			truncated = " (truncated)"
		}
		_ = resp.Body.Close()
		// 必须保留上游状态码，否则上层重试/限流策略失去信号（429/5xx 不再退避或切换渠道）。
		return buildGrokUsage(nil), types.NewErrorWithStatusCode(
			fmt.Errorf("grok subscription channel: upstream status %d%s: %s", resp.StatusCode, truncated, string(body)),
			types.ErrorCodeBadResponse, resp.StatusCode)
	}
	defer func() { _ = resp.Body.Close() }()

	acc := apicompat.NewBufferedResponseAccumulator()
	var lastUsage *apicompat.ResponsesUsage
	var lastTerminal *apicompat.ResponsesResponse
	var terminalSeen bool
	var terminalErr *types.NewAPIError

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	var dataLines []string
	flushEvent := func() bool {
		if len(dataLines) == 0 {
			return false
		}
		payload := strings.Join(dataLines, "\n")
		dataLines = dataLines[:0]
		evt := &apicompat.ResponsesStreamEvent{}
		if err := common.Unmarshal([]byte(payload), evt); err != nil {
			return false
		}
		acc.ProcessEvent(evt)

		isFailed := evt.Type == "response.failed" || (evt.Response != nil && evt.Response.Status == "failed")
		if isFailed {
			terminalSeen = true
			terminalErr = grokResponseFailedError(evt)
			if evt.Response != nil && evt.Response.Usage != nil {
				lastUsage = evt.Response.Usage
			}
			return true
		}

		isTerminal := evt.Type == "response.completed" ||
			evt.Type == "response.done" ||
			evt.Type == "response.incomplete"
		if isTerminal && evt.Response != nil {
			if evt.Response.Usage != nil {
				lastUsage = evt.Response.Usage
			}
			lastTerminal = evt.Response
			terminalSeen = true
			return true
		}
		return false
	}

	stop := false
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			if flushEvent() {
				stop = true
				break
			}
			continue
		}
		if strings.HasPrefix(line, "data:") {
			dataLines = append(dataLines, strings.TrimSpace(strings.TrimPrefix(line, "data:")))
		}
	}
	if !stop {
		_ = flushEvent()
	}

	if terminalErr != nil {
		return buildGrokUsage(lastUsage), terminalErr
	}
	if scanErr := scanner.Err(); scanErr != nil {
		common.SysError(fmt.Sprintf("grok chat bridge: SSE scan error: %v", scanErr))
		return buildGrokUsage(lastUsage), types.NewErrorWithStatusCode(
			fmt.Errorf("grok subscription channel: SSE scan error: %v", scanErr),
			types.ErrorCodeBadResponse, http.StatusBadGateway)
	}
	if !terminalSeen {
		return buildGrokUsage(lastUsage), types.NewErrorWithStatusCode(
			errors.New("grok subscription channel: upstream stream ended before a terminal event"),
			types.ErrorCodeBadResponse, http.StatusBadGateway)
	}

	full := &apicompat.ResponsesResponse{}
	acc.SupplementResponseOutput(full)
	if lastTerminal != nil {
		full.Status = lastTerminal.Status
		full.IncompleteDetails = lastTerminal.IncompleteDetails
		full.Error = lastTerminal.Error
	} else {
		full.Status = "completed"
	}
	full.Usage = lastUsage

	upstreamModel := ""
	if info != nil && info.ChannelMeta != nil {
		upstreamModel = info.UpstreamModelName
	}
	chatResp := apicompat.ResponsesToChatCompletions(full, upstreamModel)
	c.JSON(http.StatusOK, chatResp)
	return buildGrokUsage(lastUsage), nil
}

func grokResponseFailedError(evt *apicompat.ResponsesStreamEvent) *types.NewAPIError {
	message := "grok upstream response failed"
	if evt != nil {
		if evt.Response != nil && evt.Response.Error != nil {
			switch {
			case strings.TrimSpace(evt.Response.Error.Message) != "":
				message = evt.Response.Error.Message
			case strings.TrimSpace(evt.Response.Error.Code) != "":
				message = evt.Response.Error.Code
			}
		} else if strings.TrimSpace(evt.Code) != "" {
			message = evt.Code
		}
	}
	return types.NewOpenAIError(errors.New(message), types.ErrorCodeBadResponse, http.StatusInternalServerError)
}

// buildGrokUsage 把 Responses usage 翻译成 *dto.Usage，始终 non-nil（缺失时零值占位）。
func buildGrokUsage(u *apicompat.ResponsesUsage) *dto.Usage {
	out := &dto.Usage{}
	if u == nil {
		return out
	}
	out.PromptTokens = u.InputTokens
	out.CompletionTokens = u.OutputTokens
	out.TotalTokens = u.TotalTokens
	out.InputTokens = u.InputTokens
	out.OutputTokens = u.OutputTokens
	if out.TotalTokens == 0 && (out.PromptTokens != 0 || out.CompletionTokens != 0) {
		out.TotalTokens = out.PromptTokens + out.CompletionTokens
	}
	if u.InputTokensDetails != nil {
		out.PromptTokensDetails = dto.InputTokenDetails{
			CachedTokens:     u.InputTokensDetails.CachedTokens,
			CacheWriteTokens: u.InputTokensDetails.CacheWriteTokens,
		}
		// 同步指针字段，方便下游 reasoning/responses 链路读取（与 codex buildUsage 对齐）。
		out.InputTokensDetails = &dto.InputTokenDetails{
			CachedTokens:     u.InputTokensDetails.CachedTokens,
			CacheWriteTokens: u.InputTokensDetails.CacheWriteTokens,
		}
		if u.InputTokensDetails.CachedTokens > 0 {
			out.PromptCacheHitTokens = u.InputTokensDetails.CachedTokens
		}
	}
	if u.OutputTokensDetails != nil {
		out.CompletionTokenDetails = dto.OutputTokenDetails{
			ReasoningTokens: u.OutputTokensDetails.ReasoningTokens,
		}
	}
	return out
}
