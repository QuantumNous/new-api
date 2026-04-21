package relay

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func audioDir() string {
	dir := filepath.Join(os.TempDir(), "new-api-audio")
	_ = os.MkdirAll(dir, 0755)
	return dir
}

func init() {
	go func() {
		ticker := time.NewTicker(30 * time.Minute)
		for range ticker.C {
			dir := audioDir()
			entries, err := os.ReadDir(dir)
			if err != nil {
				continue
			}
			cutoff := time.Now().Add(-time.Hour)
			for _, e := range entries {
				if e.IsDir() {
					continue
				}
				info, err := e.Info()
				if err != nil {
					continue
				}
				if info.ModTime().Before(cutoff) {
					_ = os.Remove(filepath.Join(dir, e.Name()))
				}
			}
		}
	}()
}

// GetCachedAudio retrieves a cached audio file by ID and extension.
// If ext is empty, it searches for any file matching the ID prefix.
func GetCachedAudio(id string) ([]byte, string, bool) {
	dir := audioDir()
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, "", false
	}
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		// match "uuid.ext" pattern
		dotIdx := strings.LastIndex(name, ".")
		if dotIdx == -1 {
			continue
		}
		if name[:dotIdx] != id {
			continue
		}
		ext := name[dotIdx:]
		data, err := os.ReadFile(filepath.Join(dir, name))
		if err != nil {
			return nil, "", false
		}
		return data, inferAudioContentType(ext[1:]), true // ext[1:] strips the leading "."
	}
	return nil, "", false
}

// PlaygroundTTSHelper handles TTS model requests from the playground.
// It converts the chat-completion request into an audio/speech upstream call,
// persists the returned audio to disk, and emits an SSE chunk with a local proxy URL.
func PlaygroundTTSHelper(c *gin.Context, info *relaycommon.RelayInfo) *types.NewAPIError {
	info.InitChannelMeta(c)
	info.RelayMode = relayconstant.RelayModeAudioSpeech
	info.RelayFormat = types.RelayFormatOpenAIAudio
	info.RequestURLPath = "/v1/audio/speech"
	info.IsStream = false // TTS upstream call is always non-streaming here

	audioReq, ok := info.Request.(*dto.AudioRequest)
	if !ok {
		return types.NewError(fmt.Errorf("invalid TTS request type"), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}

	request, err := common.DeepCopy(audioReq)
	if err != nil {
		return types.NewError(fmt.Errorf("failed to copy audio request: %w", err), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
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

	ioReader, err := adaptor.ConvertAudioRequest(c, info, *request)
	if err != nil {
		return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}

	resp, err := adaptor.DoRequest(c, info, ioReader)
	if err != nil {
		return types.NewError(err, types.ErrorCodeDoRequestFailed)
	}

	httpResp, ok := resp.(*http.Response)
	if !ok || httpResp == nil {
		return types.NewError(fmt.Errorf("invalid upstream response"), types.ErrorCodeBadResponse, types.ErrOptionWithSkipRetry())
	}
	defer service.CloseResponseBodyGracefully(httpResp)

	if httpResp.StatusCode != http.StatusOK {
		return service.RelayErrorHandler(c.Request.Context(), httpResp, false)
	}

	audioBytes, err := io.ReadAll(httpResp.Body)
	if err != nil {
		logger.LogError(c, "failed to read TTS response body: "+err.Error())
		return types.NewError(err, types.ErrorCodeReadResponseBodyFailed, types.ErrOptionWithSkipRetry())
	}

	contentType := httpResp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = inferAudioContentType(request.ResponseFormat)
	}

	audioID := uuid.New().String()
	ext := audioExtFromContentType(contentType, request.ResponseFormat)

	// Persist to disk so the file survives server restarts.
	filePath := filepath.Join(audioDir(), audioID+ext)
	if err := os.WriteFile(filePath, audioBytes, 0644); err != nil {
		logger.LogError(c, "failed to write TTS audio to disk: "+err.Error())
		return types.NewError(err, types.ErrorCodeReadResponseBodyFailed, types.ErrOptionWithSkipRetry())
	}

	// Consume quota (prompt tokens = input text length estimate).
	usage := &dto.Usage{}
	usage.PromptTokens = info.GetEstimatePromptTokens()
	usage.TotalTokens = usage.PromptTokens
	service.PostTextConsumeQuota(c, info, usage, nil)

	// Emit SSE chat-completion chunk with a markdown audio link.
	audioURL := fmt.Sprintf("/pg/audio/%s%s", audioID, ext)
	audioMarkdown := fmt.Sprintf("[Generated Audio](%s)", audioURL)

	helper.SetEventStreamHeaders(c)
	finishReason := "stop"
	delta := dto.ChatCompletionsStreamResponseChoiceDelta{}
	delta.SetContentString(audioMarkdown)
	chunk := dto.ChatCompletionsStreamResponse{
		Id:      "tts-" + audioID,
		Object:  "chat.completion.chunk",
		Created: time.Now().Unix(),
		Model:   info.UpstreamModelName,
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Delta: delta, FinishReason: &finishReason},
		},
	}
	_ = helper.ObjectData(c, chunk)
	helper.Done(c)

	return nil
}

func inferAudioContentType(format string) string {
	switch strings.ToLower(format) {
	case "opus":
		return "audio/ogg; codecs=opus"
	case "aac":
		return "audio/aac"
	case "flac":
		return "audio/flac"
	case "wav":
		return "audio/wav"
	case "pcm":
		return "audio/pcm"
	default:
		return "audio/mpeg"
	}
}

func audioExtFromContentType(contentType, format string) string {
	ct := strings.ToLower(contentType)
	if strings.Contains(ct, "ogg") || strings.Contains(ct, "opus") {
		return ".opus"
	}
	if strings.Contains(ct, "aac") {
		return ".aac"
	}
	if strings.Contains(ct, "flac") {
		return ".flac"
	}
	if strings.Contains(ct, "wav") {
		return ".wav"
	}
	if strings.Contains(ct, "pcm") {
		return ".wav"
	}
	// fall back to format hint
	switch strings.ToLower(format) {
	case "opus":
		return ".opus"
	case "aac":
		return ".aac"
	case "flac":
		return ".flac"
	case "wav", "pcm":
		return ".wav"
	}
	return ".mp3"
}
