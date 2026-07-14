package tencent

import (
	"bufio"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// https://cloud.tencent.com/document/product/1729/97732

func requestOpenAI2Tencent(a *Adaptor, request dto.GeneralOpenAIRequest) *TencentChatRequest {
	messages := make([]*TencentMessage, 0, len(request.Messages))
	for i := 0; i < len(request.Messages); i++ {
		message := request.Messages[i]
		messages = append(messages, &TencentMessage{
			Content: message.StringContent(),
			Role:    message.Role,
		})
	}
	var req = TencentChatRequest{
		Stream:   request.Stream,
		Messages: messages,
		Model:    &request.Model,
	}
	if request.TopP != nil {
		req.TopP = request.TopP
	}
	req.Temperature = request.Temperature
	return &req
}

func responseTencent2OpenAI(response *TencentChatResponse) *dto.OpenAITextResponse {
	fullTextResponse := dto.OpenAITextResponse{
		Id:      response.Id,
		Object:  "chat.completion",
		Created: common.GetTimestamp(),
		Usage: dto.Usage{
			PromptTokens:     response.Usage.PromptTokens,
			CompletionTokens: response.Usage.CompletionTokens,
			TotalTokens:      response.Usage.TotalTokens,
		},
	}
	if len(response.Choices) > 0 {
		choice := dto.OpenAITextResponseChoice{
			Index: 0,
			Message: dto.Message{
				Role:    "assistant",
				Content: response.Choices[0].Messages.Content,
			},
			FinishReason: response.Choices[0].FinishReason,
		}
		fullTextResponse.Choices = append(fullTextResponse.Choices, choice)
	}
	return &fullTextResponse
}

func streamResponseTencent2OpenAI(TencentResponse *TencentChatResponse) *dto.ChatCompletionsStreamResponse {
	response := dto.ChatCompletionsStreamResponse{
		Object:  "chat.completion.chunk",
		Created: common.GetTimestamp(),
		Model:   "tencent-hunyuan",
	}
	if len(TencentResponse.Choices) > 0 {
		var choice dto.ChatCompletionsStreamResponseChoice
		choice.Delta.SetContentString(TencentResponse.Choices[0].Delta.Content)
		if TencentResponse.Choices[0].FinishReason == "stop" {
			choice.FinishReason = &constant.FinishReasonStop
		}
		response.Choices = append(response.Choices, choice)
	}
	return &response
}

// tencentStreamHandler relays Tencent stream events and accumulates usage.
func tencentStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)
	var responseText string
	completed := false
	var streamErr *types.NewAPIError
	scanner := helper.NewStreamScanner(resp.Body)
	scanner.Split(bufio.ScanLines)

	helper.SetEventStreamHeaders(c)

	for scanner.Scan() {
		data := scanner.Text()
		if len(data) < 5 || !strings.HasPrefix(data, "data:") {
			continue
		}
		data = strings.TrimPrefix(data, "data:")

		var tencentResponse TencentChatResponse
		err := common.Unmarshal([]byte(data), &tencentResponse)
		if err != nil {
			common.SysLog("error unmarshalling stream response: " + err.Error())
			streamErr = types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusBadGateway)
			break
		}
		if tencentResponse.Error.Code != 0 {
			streamErr = types.WithOpenAIError(types.OpenAIError{
				Message: tencentResponse.Error.Message,
				Code:    tencentResponse.Error.Code,
			}, http.StatusBadGateway)
			break
		}

		response := streamResponseTencent2OpenAI(&tencentResponse)
		if len(response.Choices) != 0 {
			responseText += response.Choices[0].Delta.GetContentString()
			completed = response.Choices[0].FinishReason != nil
		}

		err = helper.ObjectData(c, response)
		if err != nil {
			common.SysLog(err.Error())
			streamErr = types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusBadGateway)
			break
		}
		if completed {
			break
		}
	}

	if streamErr == nil {
		if err := scanner.Err(); err != nil {
			common.SysLog("error reading stream: " + err.Error())
			streamErr = types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusBadGateway)
		} else if !completed {
			streamErr = types.NewOpenAIError(io.ErrUnexpectedEOF, types.ErrorCodeBadResponse, http.StatusBadGateway)
		}
	}
	usage := service.ResponseText2Usage(c, responseText, info.UpstreamModelName, info.GetEstimatePromptTokens())
	if streamErr != nil {
		if !helper.HasWrittenUpstreamResponse(c) {
			return nil, streamErr
		}
		_ = helper.ObjectData(c, gin.H{"error": streamErr.ToOpenAIError()})
		return usage, nil
	}
	helper.Done(c)
	return usage, nil
}

// tencentHandler converts a buffered Tencent response and returns its usage.
func tencentHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)
	var tencentSb TencentChatResponseSB
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}
	err = json.Unmarshal(responseBody, &tencentSb)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	if tencentSb.Response.Error.Code != 0 {
		return nil, types.WithOpenAIError(types.OpenAIError{
			Message: tencentSb.Response.Error.Message,
			Code:    tencentSb.Response.Error.Code,
		}, types.NormalizeUpstreamErrorStatusCode(resp.StatusCode))
	}
	fullTextResponse := responseTencent2OpenAI(&tencentSb.Response)
	jsonResponse, err := common.Marshal(fullTextResponse)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(resp.StatusCode)
	service.IOCopyBytesGracefully(c, resp, jsonResponse)
	return &fullTextResponse.Usage, nil
}

func parseTencentConfig(config string) (appId int64, secretId string, secretKey string, err error) {
	parts := strings.Split(config, "|")
	if len(parts) != 3 {
		err = errors.New("invalid tencent config")
		return
	}
	appId, err = strconv.ParseInt(parts[0], 10, 64)
	secretId = parts[1]
	secretKey = parts[2]
	return
}

func sha256hex(s string) string {
	b := sha256.Sum256([]byte(s))
	return hex.EncodeToString(b[:])
}

func hmacSha256(s, key string) string {
	hashed := hmac.New(sha256.New, []byte(key))
	hashed.Write([]byte(s))
	return string(hashed.Sum(nil))
}

func getTencentSign(req TencentChatRequest, adaptor *Adaptor, secId, secKey string) string {
	// build canonical request string
	host := "hunyuan.tencentcloudapi.com"
	httpRequestMethod := "POST"
	canonicalURI := "/"
	canonicalQueryString := ""
	canonicalHeaders := fmt.Sprintf("content-type:%s\nhost:%s\nx-tc-action:%s\n",
		"application/json", host, strings.ToLower(adaptor.Action))
	signedHeaders := "content-type;host;x-tc-action"
	payload, _ := json.Marshal(req)
	hashedRequestPayload := sha256hex(string(payload))
	canonicalRequest := fmt.Sprintf("%s\n%s\n%s\n%s\n%s\n%s",
		httpRequestMethod,
		canonicalURI,
		canonicalQueryString,
		canonicalHeaders,
		signedHeaders,
		hashedRequestPayload)
	// build string to sign
	algorithm := "TC3-HMAC-SHA256"
	requestTimestamp := strconv.FormatInt(adaptor.Timestamp, 10)
	timestamp, _ := strconv.ParseInt(requestTimestamp, 10, 64)
	t := time.Unix(timestamp, 0).UTC()
	// must be the format 2006-01-02, ref to package time for more info
	date := t.Format("2006-01-02")
	credentialScope := fmt.Sprintf("%s/%s/tc3_request", date, "hunyuan")
	hashedCanonicalRequest := sha256hex(canonicalRequest)
	string2sign := fmt.Sprintf("%s\n%s\n%s\n%s",
		algorithm,
		requestTimestamp,
		credentialScope,
		hashedCanonicalRequest)

	// sign string
	secretDate := hmacSha256(date, "TC3"+secKey)
	secretService := hmacSha256("hunyuan", secretDate)
	secretKey := hmacSha256("tc3_request", secretService)
	signature := hex.EncodeToString([]byte(hmacSha256(string2sign, secretKey)))

	// build authorization
	authorization := fmt.Sprintf("%s Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		algorithm,
		secId,
		credentialScope,
		signedHeaders,
		signature)
	return authorization
}
