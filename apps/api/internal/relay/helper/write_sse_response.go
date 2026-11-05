package helper

import (
	"github.com/QuantumNous/new-api/internal/gateway"
	relaycommon "github.com/QuantumNous/new-api/internal/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/QuantumNous/new-api/internal/transport/contract"
)

// renderSSE writes a raw SSE line through the framework-neutral response
// writer, byte-identical to the previous CustomEvent render path.
func renderSSE(c contract.Context, data string) {
	gateway.RenderSSE(c, data)
}

func FlushWriter(c contract.Context) (err error) {
	return gateway.FlushWriter(c)
}

func SetEventStreamHeaders(c contract.Context) {
	gateway.SetEventStreamHeaders(c)
}

func ClaudeData(c contract.Context, resp dto.ClaudeResponse) error {
	return gateway.ClaudeData(c, resp)
}

func ClaudeChunkData(c contract.Context, resp dto.ClaudeResponse, data string) {
	gateway.ClaudeChunkData(c, resp, data)
}

func ResponseChunkData(c contract.Context, resp dto.ResponsesStreamResponse, data string) error {
	return gateway.ResponseChunkData(c, resp, data)
}

func StringData(c contract.Context, str string) error {
	return gateway.StringData(c, str)
}

func PingData(c contract.Context) error {
	return gateway.PingData(c)
}

func ObjectData(c contract.Context, object interface{}) error {
	return gateway.ObjectData(c, object)
}

func Done(c contract.Context) {
	gateway.Done(c)
}

func WssString(c contract.Context, ws relaycommon.WSConn, str string) error {
	return gateway.WssString(c, ws, str)
}

func WssObject(c contract.Context, ws relaycommon.WSConn, object interface{}) error {
	return gateway.WssObject(c, ws, object)
}

func WssError(c contract.Context, ws relaycommon.WSConn, openaiError types.OpenAIError) {
	gateway.WssError(c, ws, openaiError)
}

func GetResponseID(c contract.Context) string {
	return gateway.GetResponseID(c)
}

func GetLocalRealtimeID(c contract.Context) string {
	return gateway.GetLocalRealtimeID(c)
}

func GenerateStartEmptyResponse(id string, createAt int64, model string, systemFingerprint *string) *dto.ChatCompletionsStreamResponse {
	return gateway.GenerateStartEmptyResponse(id, createAt, model, systemFingerprint)
}

func GenerateStopResponse(id string, createAt int64, model string, finishReason string) *dto.ChatCompletionsStreamResponse {
	return gateway.GenerateStopResponse(id, createAt, model, finishReason)
}

func GenerateFinalUsageResponse(id string, createAt int64, model string, usage dto.Usage) *dto.ChatCompletionsStreamResponse {
	return gateway.GenerateFinalUsageResponse(id, createAt, model, usage)
}

// SSERender is the exported form of renderSSE for relay root handlers that
// stream raw event lines without going through StreamScannerHandler.
func SSERender(c contract.Context, data string) {
	gateway.SSERender(c, data)
}
