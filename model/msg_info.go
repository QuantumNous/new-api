package model

import (
	"encoding/json"
	"fmt"
	"github.com/gin-gonic/gin"
	"one-api/common"
	"one-api/dto"
	"one-api/relay/constant"
	"strings"
)

func GetMsgInfo(c *gin.Context) map[string]any {
	var err error
	msgInfo := make(map[string]any)
	openAiRequest := dto.GeneralOpenAIRequest{}
	if err = common.UnmarshalBodyReusable(c, &openAiRequest); err == nil {
		messages := openAiRequest.Messages
		if len(messages) > 0 {
			msgInfo["msg_input"] = messages[len(messages)-1].Content
		} else if inputs := openAiRequest.Input; inputs != nil {
			if inputList, ok := inputs.([]any); ok {
				if len(inputList) > 0 {
					msgInfo["msg_input"] = inputList[0]
				}
			} else {
				msgInfo["msg_input"] = inputs
			}
		}
	}
	msgInfo["msg_output"] = GetMsgOutput(c)
	return msgInfo
}

type Content interface {
	StringContent() string
}
type ResponseContent[T Content] struct {
	Choices []T `json:"choices"`
}

func (m *ResponseContent[T]) StringContent() string {
	if len(m.Choices) > 0 {
		return m.Choices[0].StringContent()
	}
	return ""
}

type Delta struct {
	dto.Message `json:"delta"`
}

func (m Delta) StringContent() string {
	return m.Message.StringContent()
}

type Message struct {
	dto.Message `json:"message"`
}

func (m Message) StringContent() string {
	return m.Message.StringContent()
}
func newResponseContent[T Content](data []byte) (res ResponseContent[T], err error) {
	err = json.Unmarshal(data, &res)
	return
}
func getResponseContentStr[T Content](data []byte) (res string, err error) {
	var response ResponseContent[T]
	response, err = newResponseContent[T](data)
	if err != nil {
		return
	}
	res = response.StringContent()
	return
}
func GetMsgOutput(c *gin.Context) (output string) {
	var err error
	responseBody, ok := c.Get(common.KeyResponseWriter)
	if !ok {
		return
	}
	blw, ok := responseBody.(common.BodyLogWriter)
	if !ok {
		return
	}
	output = blw.String()
	if len(output) == 0 {
		return
	}
	relayMode := constant.Path2RelayMode(c.Request.URL.Path)
	switch relayMode {
	case constant.RelayModeChatCompletions:
		firstData := output[0]
		switch firstData {
		case '{':
			if output, err = getResponseContentStr[Message]([]byte(output)); err != nil {
				common.LogWarn(c, fmt.Sprintf("unmarshal response failed: %s", err.Error()))
				return
			}
		case 'd':
			resSlice := strings.Split(output, "\n")
			var streamResBuilder strings.Builder
			for _, r := range resSlice {
				r = strings.TrimPrefix(r, "data:")
				r = strings.TrimSpace(r)
				if r == "" || r == "[DONE]" {
					continue
				}
				deltaContent, err := getResponseContentStr[Delta]([]byte(r))
				if err != nil {
					common.LogWarn(c, fmt.Sprintf("unmarshal stream response failed: %s", err.Error()))
					continue
				}
				streamResBuilder.WriteString(deltaContent)
			}
			output = streamResBuilder.String()
		}
	//case constant.RelayModeEmbeddings:
	default:
	}
	return
}
