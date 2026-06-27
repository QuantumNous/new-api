package ali_token_plan

import (
	"fmt"
	"io"
	"net/http"

	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/ali"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

type Adaptor struct {
	ali.Adaptor
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	if info.RelayFormat == types.RelayFormatClaude {
		return fmt.Sprintf("%s/compatible-mode/v1/chat/completions", info.ChannelBaseUrl), nil
	}

	switch info.RelayMode {
	case constant.RelayModeResponses:
		return fmt.Sprintf("%s/compatible-mode/v1/responses", info.ChannelBaseUrl), nil
	case constant.RelayModeEmbeddings:
		return fmt.Sprintf("%s/compatible-mode/v1/embeddings", info.ChannelBaseUrl), nil
	case constant.RelayModeCompletions:
		return fmt.Sprintf("%s/compatible-mode/v1/completions", info.ChannelBaseUrl), nil
	case constant.RelayModeImagesGenerations:
		return a.Adaptor.GetRequestURL(info)
	case constant.RelayModeImagesEdits:
		return a.Adaptor.GetRequestURL(info)
	case constant.RelayModeRerank:
		return fmt.Sprintf("%s/compatible-mode/v1/rerank", info.ChannelBaseUrl), nil
	default:
		return a.Adaptor.GetRequestURL(info)
	}
}

// SetupRequestHeader 覆写父类方法，去掉 DashScope 专属头部（X-DashScope-SSE 等）
// Token Plan 的 compatible-mode API 使用标准 OpenAI 协议，不需要 DashScope 头
func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	req.Set("Authorization", "Bearer "+info.ApiKey)
	return nil
}

// DoRequest 覆写父类方法，确保 DoApiRequest 接收的是 *ali_token_plan.Adaptor
// 而非内层的 *ali.Adaptor，这样 GetRequestURL 和 SetupRequestHeader 的覆写才能生效
func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) GetModelList() []string {
	return ali.ModelList
}

func (a *Adaptor) GetChannelName() string {
	return "ali_token_plan"
}
