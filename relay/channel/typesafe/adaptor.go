package typesafe

import (
	"encoding/json"
	"errors"
	"io"
	"math"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
)

var errUnsupported = errors.New("TypeSafe supports only /v1/systemone decisions")

type Adaptor struct {
	request *dto.DecisionsRequest
}

func (a *Adaptor) Init(*relaycommon.RelayInfo) {}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	if info.RelayMode != relayconstant.RelayModeDecisions {
		return "", errUnsupported
	}
	return strings.TrimRight(info.ChannelBaseUrl, "/") + "/v1/systemone", nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, header *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, header)
	header.Set("Authorization", "Bearer "+info.ApiKey)
	header.Set("Content-Type", "application/json")
	return nil
}

func (a *Adaptor) ConvertDecisionsRequest(_ *gin.Context, _ *relaycommon.RelayInfo, request *dto.DecisionsRequest) (any, error) {
	if err := request.Validate(); err != nil {
		return nil, err
	}
	// Streaming is not part of the upstream protocol, including stream=false.
	request.Stream = nil
	a.request = request
	return request, nil
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, body io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, body)
}

func (a *Adaptor) DoResponse(c *gin.Context, response *http.Response, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	defer response.Body.Close()
	// Decisions contain compact scores, not arbitrary generated documents.
	const maxResponseBytes = 16 << 20
	body, err := io.ReadAll(io.LimitReader(response.Body, maxResponseBytes+1))
	if err != nil || len(body) > maxResponseBytes {
		return nil, types.NewOpenAIError(errors.New("failed to read TypeSafe response"), types.ErrorCodeReadResponseBodyFailed, http.StatusBadGateway)
	}
	var result dto.DecisionsResponse
	if common.Unmarshal(body, &result) != nil || !a.validResponse(&result) {
		// Never estimate a successful charge from a missing or malformed usage.
		return nil, types.NewOpenAIError(errors.New("invalid TypeSafe answers or usage"), types.ErrorCodeBadResponseBody, http.StatusBadGateway)
	}
	usage := &dto.Usage{
		PromptTokens:     int(*result.Usage.InputTokens),
		CompletionTokens: int(*result.Usage.OutputTokens),
		TotalTokens:      int(*result.Usage.InputTokens + *result.Usage.OutputTokens),
	}
	// Preserve probabilities, confidence, legends and future upstream fields.
	info.SetFirstResponseTime()
	c.Data(http.StatusOK, "application/json", body)
	return usage, nil
}

func (a *Adaptor) validResponse(result *dto.DecisionsResponse) bool {
	if a.request == nil || result.Model == "" || result.Usage == nil || result.Usage.InputTokens == nil || result.Usage.OutputTokens == nil {
		return false
	}
	input, output := *result.Usage.InputTokens, *result.Usage.OutputTokens
	if input < 0 || output < 0 || input > math.MaxInt32 || output > math.MaxInt32-input || len(result.Answers) != len(a.request.Questions) {
		return false
	}
	for id, question := range a.request.Questions {
		var answer struct {
			Type   string   `json:"type"`
			Noul   *float64 `json:"noul"`
			Choice *string  `json:"choice"`
			Score  *float64 `json:"score"`
		}
		if common.Unmarshal(result.Answers[id], &answer) != nil || answer.Type != question.Type {
			return false
		}
		switch question.Type {
		case "noul":
			if answer.Noul == nil || *answer.Noul < 0 || *answer.Noul > 1 {
				return false
			}
		case "choice":
			var criteria map[string]json.RawMessage
			if answer.Choice == nil || common.Unmarshal(question.Criteria, &criteria) != nil {
				return false
			}
			if _, ok := criteria[*answer.Choice]; !ok {
				return false
			}
		case "score":
			var criteria []string
			if answer.Score == nil || common.Unmarshal(question.Criteria, &criteria) != nil || *answer.Score < 0 || *answer.Score > float64(len(criteria)-1) {
				return false
			}
		}
	}
	return true
}

func (a *Adaptor) GetModelList() []string { return []string{"jev-1.13.0", "jev-latest", "jev-preview"} }
func (a *Adaptor) GetChannelName() string { return "typesafe" }

func (a *Adaptor) ConvertOpenAIRequest(*gin.Context, *relaycommon.RelayInfo, *dto.GeneralOpenAIRequest) (any, error) {
	return nil, errUnsupported
}
func (a *Adaptor) ConvertRerankRequest(*gin.Context, int, dto.RerankRequest) (any, error) {
	return nil, errUnsupported
}
func (a *Adaptor) ConvertEmbeddingRequest(*gin.Context, *relaycommon.RelayInfo, dto.EmbeddingRequest) (any, error) {
	return nil, errUnsupported
}
func (a *Adaptor) ConvertAudioRequest(*gin.Context, *relaycommon.RelayInfo, dto.AudioRequest) (io.Reader, error) {
	return nil, errUnsupported
}
func (a *Adaptor) ConvertImageRequest(*gin.Context, *relaycommon.RelayInfo, dto.ImageRequest) (any, error) {
	return nil, errUnsupported
}
func (a *Adaptor) ConvertOpenAIResponsesRequest(*gin.Context, *relaycommon.RelayInfo, dto.OpenAIResponsesRequest) (any, error) {
	return nil, errUnsupported
}
func (a *Adaptor) ConvertClaudeRequest(*gin.Context, *relaycommon.RelayInfo, *dto.ClaudeRequest) (any, error) {
	return nil, errUnsupported
}
func (a *Adaptor) ConvertGeminiRequest(*gin.Context, *relaycommon.RelayInfo, *dto.GeminiChatRequest) (any, error) {
	return nil, errUnsupported
}
