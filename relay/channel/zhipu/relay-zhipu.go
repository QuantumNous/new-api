package zhipu

import (
	"bufio"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/samber/lo"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// https://open.bigmodel.cn/doc/api#chatglm_std
// chatglm_std, chatglm_lite
// https://open.bigmodel.cn/api/paas/v3/model-api/chatglm_std/invoke
// https://open.bigmodel.cn/api/paas/v3/model-api/chatglm_std/sse-invoke

var zhipuTokens sync.Map
var expSeconds int64 = 24 * 3600

func getZhipuToken(apikey string) string {
	data, ok := zhipuTokens.Load(apikey)
	if ok {
		tokenData := data.(zhipuTokenData)
		if time.Now().Before(tokenData.ExpiryTime) {
			return tokenData.Token
		}
	}

	split := strings.Split(apikey, ".")
	if len(split) != 2 {
		common.SysLog("invalid zhipu key: " + apikey)
		return ""
	}

	id := split[0]
	secret := split[1]

	expMillis := time.Now().Add(time.Duration(expSeconds)*time.Second).UnixNano() / 1e6
	expiryTime := time.Now().Add(time.Duration(expSeconds) * time.Second)

	timestamp := time.Now().UnixNano() / 1e6

	payload := jwt.MapClaims{
		"api_key":   id,
		"exp":       expMillis,
		"timestamp": timestamp,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, payload)

	token.Header["alg"] = "HS256"
	token.Header["sign_type"] = "SIGN"

	tokenString, err := token.SignedString([]byte(secret))
	if err != nil {
		return ""
	}

	zhipuTokens.Store(apikey, zhipuTokenData{
		Token:      tokenString,
		ExpiryTime: expiryTime,
	})

	return tokenString
}

func requestOpenAI2Zhipu(request dto.GeneralOpenAIRequest) *ZhipuRequest {
	messages := make([]ZhipuMessage, 0, len(request.Messages))
	for _, message := range request.Messages {
		if message.Role == "system" {
			messages = append(messages, ZhipuMessage{
				Role:    "system",
				Content: message.StringContent(),
			})
			messages = append(messages, ZhipuMessage{
				Role:    "user",
				Content: "Okay",
			})
		} else {
			messages = append(messages, ZhipuMessage{
				Role:    message.Role,
				Content: message.StringContent(),
			})
		}
	}
	return &ZhipuRequest{
		Prompt:      messages,
		Temperature: request.Temperature,
		TopP:        lo.FromPtrOr(request.TopP, 0),
		Incremental: false,
	}
}

func responseZhipu2OpenAI(response *ZhipuResponse) *dto.OpenAITextResponse {
	fullTextResponse := dto.OpenAITextResponse{
		Id:      response.Data.TaskId,
		Object:  "chat.completion",
		Created: common.GetTimestamp(),
		Choices: make([]dto.OpenAITextResponseChoice, 0, len(response.Data.Choices)),
		Usage:   response.Data.Usage,
	}
	for i, choice := range response.Data.Choices {
		openaiChoice := dto.OpenAITextResponseChoice{
			Index: i,
			Message: dto.Message{
				Role:    choice.Role,
				Content: strings.Trim(choice.Content, "\""),
			},
			FinishReason: "",
		}
		if i == len(response.Data.Choices)-1 {
			openaiChoice.FinishReason = "stop"
		}
		fullTextResponse.Choices = append(fullTextResponse.Choices, openaiChoice)
	}
	return &fullTextResponse
}

func streamResponseZhipu2OpenAI(zhipuResponse string) *dto.ChatCompletionsStreamResponse {
	var choice dto.ChatCompletionsStreamResponseChoice
	choice.Delta.SetContentString(zhipuResponse)
	response := dto.ChatCompletionsStreamResponse{
		Object:  "chat.completion.chunk",
		Created: common.GetTimestamp(),
		Model:   "chatglm",
		Choices: []dto.ChatCompletionsStreamResponseChoice{choice},
	}
	return &response
}

func streamMetaResponseZhipu2OpenAI(zhipuResponse *ZhipuStreamMetaResponse) (*dto.ChatCompletionsStreamResponse, *dto.Usage) {
	var choice dto.ChatCompletionsStreamResponseChoice
	choice.Delta.SetContentString("")
	choice.FinishReason = &constant.FinishReasonStop
	response := dto.ChatCompletionsStreamResponse{
		Id:      zhipuResponse.RequestId,
		Object:  "chat.completion.chunk",
		Created: common.GetTimestamp(),
		Model:   "chatglm",
		Choices: []dto.ChatCompletionsStreamResponseChoice{choice},
	}
	return &response, &zhipuResponse.Usage
}

func zhipuStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	var usage *dto.Usage
	var responseText strings.Builder
	scanner := helper.NewStreamScanner(resp.Body)
	scanner.Split(bufio.ScanLines)
	// F-29 family: buffer the channels and let the reader exit on client
	// disconnect; otherwise a mid-stream disconnect strands the goroutine
	// forever on an unbuffered send (goroutine + connection leak per request).
	dataChan := make(chan string, 64)
	metaChan := make(chan string, 16)
	stopChan := make(chan bool)
	go func() {
		for scanner.Scan() {
			data := scanner.Text()
			lines := strings.Split(data, "\n")
			for i, line := range lines {
				if len(line) < 5 {
					continue
				}
				if line[:5] == "data:" {
					select {
					case dataChan <- line[5:]:
					case <-c.Request.Context().Done():
						return
					}
					if i != len(lines)-1 {
						select {
						case dataChan <- "\n":
						case <-c.Request.Context().Done():
							return
						}
					}
				} else if line[:5] == "meta:" {
					select {
					case metaChan <- line[5:]:
					case <-c.Request.Context().Done():
						return
					}
				}
			}
		}
		if err := scanner.Err(); err != nil {
			common.SysLog("error reading stream: " + err.Error())
		}
		// Deliver the terminal signal reliably: a non-blocking send to an
		// unbuffered channel drops the completion when the consumer is busy
		// draining data/meta frames, leaving the stream hanging after EOF.
		select {
		case stopChan <- true:
		case <-c.Request.Context().Done():
			return
		}
	}()
	helper.SetEventStreamHeaders(c)
	c.Stream(func(w io.Writer) bool {
		select {
		case data := <-dataChan:
			response := streamResponseZhipu2OpenAI(data)
			if len(response.Choices) > 0 {
				responseText.WriteString(response.Choices[0].Delta.GetContentString())
			}
			jsonResponse, err := json.Marshal(response)
			if err != nil {
				common.SysLog("error marshalling stream response: " + err.Error())
				return true
			}
			c.Render(-1, common.CustomEvent{Data: "data: " + string(jsonResponse)})
			return true
		case data := <-metaChan:
			var zhipuResponse ZhipuStreamMetaResponse
			err := json.Unmarshal([]byte(data), &zhipuResponse)
			if err != nil {
				common.SysLog("error unmarshalling stream response: " + err.Error())
				return true
			}
			response, zhipuUsage := streamMetaResponseZhipu2OpenAI(&zhipuResponse)
			jsonResponse, err := json.Marshal(response)
			if err != nil {
				common.SysLog("error marshalling stream response: " + err.Error())
				return true
			}
			usage = zhipuUsage
			c.Render(-1, common.CustomEvent{Data: "data: " + string(jsonResponse)})
			return true
		case <-stopChan:
			c.Render(-1, common.CustomEvent{Data: "data: [DONE]"})
			return false
		}
	})
	service.CloseResponseBodyGracefully(resp)
	if usage == nil || (usage.TotalTokens == 0 && usage.PromptTokens == 0 && usage.CompletionTokens == 0) {
		// F-55: zhipu streams may omit the usage meta event entirely; fall
		// back to the estimate so chat is not billed as zero.
		usage = service.ResponseText2Usage(c, responseText.String(), info.UpstreamModelName, info.GetEstimatePromptTokens())
	}
	return usage, nil
}

func zhipuHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	var zhipuResponse ZhipuResponse
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}
	service.CloseResponseBodyGracefully(resp)
	err = json.Unmarshal(responseBody, &zhipuResponse)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	if !zhipuResponse.Success {
		return nil, types.WithOpenAIError(types.OpenAIError{
			Message: zhipuResponse.Msg,
			Code:    zhipuResponse.Code,
		}, resp.StatusCode)
	}
	fullTextResponse := responseZhipu2OpenAI(&zhipuResponse)
	if fullTextResponse.Usage.TotalTokens == 0 &&
		fullTextResponse.Usage.PromptTokens == 0 &&
		fullTextResponse.Usage.CompletionTokens == 0 {
		// F-55: fall back to the estimate (prompt+completion+total) when the
		// upstream omits usage, so generated output is not billed as zero.
		var textBuilder strings.Builder
		for _, choice := range zhipuResponse.Data.Choices {
			textBuilder.WriteString(strings.Trim(choice.Content, "\""))
		}
		fullTextResponse.Usage = *service.ResponseText2Usage(c, textBuilder.String(), info.UpstreamModelName, info.GetEstimatePromptTokens())
	}
	jsonResponse, err := json.Marshal(fullTextResponse)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(resp.StatusCode)
	_, err = c.Writer.Write(jsonResponse)
	return &fullTextResponse.Usage, nil
}
