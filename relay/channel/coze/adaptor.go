package coze

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	appcommon "github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// Adaptor implements the relay channel contract for Coze chat requests.
type Adaptor struct{}

// ConvertGeminiRequest reports that Coze does not support Gemini-format input.
func (a *Adaptor) ConvertGeminiRequest(*gin.Context, *common.RelayInfo, *dto.GeminiChatRequest) (any, error) {
	//TODO implement me
	return nil, errors.New("not implemented")
}

// ConvertAudioRequest implements channel.Adaptor.
func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *common.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	return nil, errors.New("not implemented")
}

// ConvertClaudeRequest implements channel.Adaptor.
func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *common.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	return nil, errors.New("not implemented")
}

// ConvertEmbeddingRequest implements channel.Adaptor.
func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *common.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return nil, errors.New("not implemented")
}

// ConvertImageRequest implements channel.Adaptor.
func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *common.RelayInfo, request dto.ImageRequest) (any, error) {
	return nil, errors.New("not implemented")
}

// ConvertOpenAIRequest implements channel.Adaptor.
func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *common.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}
	return convertCozeChatRequest(c, *request), nil
}

// ConvertOpenAIResponsesRequest implements channel.Adaptor.
func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *common.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	return nil, errors.New("not implemented")
}

// ConvertRerankRequest implements channel.Adaptor.
func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return nil, errors.New("not implemented")
}

// DoRequest implements channel.Adaptor.
func (a *Adaptor) DoRequest(c *gin.Context, info *common.RelayInfo, requestBody io.Reader) (any, error) {
	if info.IsStream {
		return channel.DoApiRequest(a, c, info, requestBody)
	}
	// 首先发送创建消息请求，成功后再发送获取消息请求
	// 发送创建消息请求
	resp, err := channel.DoApiRequest(a, c, info, requestBody)
	if err != nil {
		return nil, err
	}
	// 解析 resp
	var cozeResponse CozeChatResponse
	respBody, err := io.ReadAll(resp.Body)
	service.CloseResponseBodyGracefully(resp)
	if err != nil {
		return nil, err
	}
	if err := appcommon.Unmarshal(respBody, &cozeResponse); err != nil {
		return nil, fmt.Errorf("unmarshal create chat response failed: %w", err)
	}
	if cozeResponse.Code != 0 {
		return nil, errors.New(cozeResponse.Msg)
	}
	c.Set("coze_conversation_id", cozeResponse.Data.ConversationId)
	c.Set("coze_chat_id", cozeResponse.Data.Id)
	// 轮询检查消息是否完成
	for {
		err, isComplete := checkIfChatComplete(a, c, info)
		if err != nil {
			return nil, err
		} else {
			if isComplete {
				break
			}
		}
		time.Sleep(time.Second * 1)
	}
	// 发送获取消息请求
	return getChatDetail(a, c, info)
}

// DoResponse implements channel.Adaptor.
func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *common.RelayInfo) (usage any, err *types.NewAPIError) {
	if info.IsStream {
		usage, err = cozeChatStreamHandler(c, info, resp)
	} else {
		usage, err = cozeChatHandler(c, info, resp)
	}
	return
}

// GetChannelName implements channel.Adaptor.
func (a *Adaptor) GetChannelName() string {
	return ChannelName
}

// GetModelList implements channel.Adaptor.
func (a *Adaptor) GetModelList() []string {
	return ModelList
}

// GetRequestURL implements channel.Adaptor.
func (a *Adaptor) GetRequestURL(info *common.RelayInfo) (string, error) {
	return fmt.Sprintf("%s/v3/chat", info.ChannelBaseUrl), nil
}

// Init implements channel.Adaptor.
func (a *Adaptor) Init(info *common.RelayInfo) {

}

// SetupRequestHeader implements channel.Adaptor.
func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *common.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	req.Set("Authorization", "Bearer "+info.ApiKey)
	return nil
}
