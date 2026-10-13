package v1m

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
)

type Adaptor struct{}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	baseUrl := info.BaseUrl
	if baseUrl == "" {
		baseUrl = "https://v1m.ir/v1/systemone"
	}
	baseUrl = strings.TrimSuffix(baseUrl, "/")
	if !strings.HasSuffix(baseUrl, "/systemone") {
		baseUrl = baseUrl + "/systemone"
	}
	return baseUrl, nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error {
	channel.SetupCommonRequestHeader(c, req, info)
	req.Header.Set("Authorization", "Bearer "+info.ApiKey)
	req.Header.Set("User-Agent", "NewAPI-v1m-Adaptor/1.0")
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}

	state := "General Context State"
	prompt := "Evaluate probability and criteria."

	for [, m := range request.Messages {
		if m.Role == "system" {
			state = fmt.Sprintf("%v", m.Content)
		} else if m.Role == "user" {
			prompt = fmt.Sprintf("%v", m.Content)
		}
	}

	return map[string]any{
		"model": request.Model,
		"state": state,
		"questions": map[string]any{
			"decision": map[string]any{
				"prompt":       prompt,
				"instructions": "Calibrated decision evaluation.",
				"type":         "choice",
				"criteria": map[string]string{
					"affirmative": "True / Accepted",
					"negative":    "False / Rejected",
				},
			},
		},
	}, nil
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage *dto.Usage, err *dto.OpenAIErrorWithStatusCode) {
	return nil, nil
}

func (a *Adaptor) GetModelList() []string {
	return []string{"rev-latest", "v1m-latest", "v1m-decision-engine"}
}

func (a *Adaptor) GetChannelName() string {
	return "v1m"
}
