package ali

import (
	"bufio"
	"bytes"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"math"
	"mime/multipart"
	"net/http"
	"net/url"
	"path/filepath"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

const aliAudioMaxDataURIBytes = 10 << 20
const aliAudioPromptMaxRunes = 400

type aliAudioTranscriptionRequest struct {
	Model      string             `json:"model"`
	Input      aliAudioInput      `json:"input"`
	Parameters aliAudioParameters `json:"parameters"`
}

type aliAudioInput struct {
	Messages []aliAudioMessage `json:"messages"`
}

type aliAudioMessage struct {
	Role    string            `json:"role"`
	Content []aliAudioContent `json:"content"`
}

type aliAudioContent struct {
	Type       string         `json:"type"`
	Text       string         `json:"text,omitempty"`
	InputAudio *aliInputAudio `json:"input_audio,omitempty"`
}

type aliInputAudio struct {
	Data string `json:"data"`
}

type aliAudioParameters struct {
	Format        string   `json:"format"`
	SampleRate    string   `json:"sample_rate,omitempty"`
	LanguageHints []string `json:"language_hints,omitempty"`
}

type aliAudioTranscriptionResponse struct {
	Output aliAudioOutput `json:"output"`
	Usage  aliAudioUsage  `json:"usage"`
}

type aliQwenASRTranscriptionRequest struct {
	Model      string                  `json:"model"`
	Input      aliQwenASRInput         `json:"input"`
	Parameters aliQwenASRRequestParams `json:"parameters"`
}

type aliQwenASRInput struct {
	Messages []aliQwenASRMessage `json:"messages"`
}

type aliQwenASRMessage struct {
	Role    string              `json:"role"`
	Content []aliQwenASRContent `json:"content"`
}

type aliQwenASRContent struct {
	Audio string `json:"audio"`
}

type aliQwenASRRequestParams struct {
	ASROptions aliQwenASROptions `json:"asr_options,omitempty"`
}

type aliQwenASROptions struct {
	Language string `json:"language,omitempty"`
}

type aliQwenASRTranscriptionResponse struct {
	Output aliQwenASROutput `json:"output"`
	Usage  aliQwenASRUsage  `json:"usage"`
}

type aliQwenASROutput struct {
	Choices []aliQwenASRChoice `json:"choices"`
}

type aliQwenASRChoice struct {
	Message aliQwenASRMessageResponse `json:"message"`
}

type aliQwenASRMessageResponse struct {
	Content []aliQwenASRTextContent `json:"content"`
}

type aliQwenASRTextContent struct {
	Text string `json:"text"`
}

type aliQwenASRUsage struct {
	Seconds *float64 `json:"seconds,omitempty"`
}

type aliAudioOutput struct {
	Text     string             `json:"text"`
	Sentence *aliAudioSentence  `json:"sentence,omitempty"`
	Output   *aliAudioOutput    `json:"output,omitempty"`
	Choices  []aliQwenASRChoice `json:"choices,omitempty"`
}

type aliAudioSentence struct {
	SentenceID  int            `json:"sentence_id"`
	SentenceEnd bool           `json:"sentence_end"`
	BeginTime   int            `json:"begin_time"`
	EndTime     int            `json:"end_time"`
	Text        string         `json:"text"`
	ChannelID   int            `json:"channel_id"`
	Words       []aliAudioWord `json:"words,omitempty"`
}

type aliAudioWord struct {
	Text        string `json:"text"`
	BeginTime   int    `json:"begin_time"`
	EndTime     int    `json:"end_time"`
	Punctuation string `json:"punctuation,omitempty"`
}

type aliAudioUsage struct {
	Duration *float64 `json:"duration,omitempty"`
}

type aliVerboseAudioResponse struct {
	Task     string                   `json:"task"`
	Duration float64                  `json:"duration"`
	Text     string                   `json:"text"`
	Segments []aliVerboseAudioSegment `json:"segments,omitempty"`
}

type aliVerboseAudioSegment struct {
	ID    int                   `json:"id"`
	Start float64               `json:"start"`
	End   float64               `json:"end"`
	Text  string                `json:"text"`
	Words []aliVerboseAudioWord `json:"words,omitempty"`
}

type aliVerboseAudioWord struct {
	Word  string  `json:"word"`
	Start float64 `json:"start"`
	End   float64 `json:"end"`
}

type aliTranscriptDeltaEvent struct {
	Type  string `json:"type"`
	Delta string `json:"delta"`
}

type aliTranscriptDoneEvent struct {
	Type  string                 `json:"type"`
	Text  string                 `json:"text"`
	Usage *aliTranscriptDuration `json:"usage,omitempty"`
}

type aliTranscriptDuration struct {
	Type    string  `json:"type"`
	Seconds float64 `json:"seconds"`
}

func convertAliAudioTranscriptionRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	if info.RelayMode != constant.RelayModeAudioTranscription {
		return nil, errors.New("Ali audio adaptor supports transcription only")
	}
	if aliAudioTranscriptionProtocolFor(info.UpstreamModelName) != aliAudioTranscriptionProtocolLegacyMultimodal {
		return nil, fmt.Errorf("Ali audio transcription model %q is not supported", info.UpstreamModelName)
	}
	if _, err := aliAudioResponseFormat(request); err != nil {
		return nil, err
	}

	form := c.Request.MultipartForm
	if form == nil {
		var err error
		form, err = common.ParseMultipartFormReusable(c)
		if err != nil {
			return nil, fmt.Errorf("failed to parse audio form request: %w", err)
		}
		c.Request.MultipartForm = form
	}
	fileHeaders := form.File["file"]
	if len(fileHeaders) == 0 {
		return nil, errors.New("file is required")
	}

	fileHeader := fileHeaders[0]
	format, mediaType, err := aliAudioFormatAndMediaType(fileHeader)
	if err != nil {
		return nil, err
	}
	prefix := "data:" + mediaType + ";base64,"
	maxRawBytes := ((aliAudioMaxDataURIBytes - len(prefix)) / 4) * 3
	if fileHeader.Size > int64(maxRawBytes) {
		return nil, fmt.Errorf("audio file is too large for Ali Base64 input (maximum %d bytes)", maxRawBytes)
	}

	file, err := fileHeader.Open()
	if err != nil {
		return nil, fmt.Errorf("failed to open audio file: %w", err)
	}
	defer file.Close()

	audioBytes, err := io.ReadAll(io.LimitReader(file, int64(maxRawBytes)+1))
	if err != nil {
		return nil, fmt.Errorf("failed to read audio file: %w", err)
	}
	if len(audioBytes) > maxRawBytes {
		return nil, fmt.Errorf("audio file is too large for Ali Base64 input (maximum %d bytes)", maxRawBytes)
	}

	dataURI := prefix + base64.StdEncoding.EncodeToString(audioBytes)
	if len(dataURI) > aliAudioMaxDataURIBytes {
		return nil, fmt.Errorf("audio file is too large for Ali Base64 input (maximum %d bytes)", maxRawBytes)
	}

	formData := url.Values(form.Value)
	messages := make([]aliAudioMessage, 0, 2)
	if prompt := truncateAliAudioPrompt(formData.Get("prompt")); prompt != "" {
		messages = append(messages, aliAudioMessage{
			Role: "user",
			Content: []aliAudioContent{{
				Type: "input_text",
				Text: prompt,
			}},
		})
	}
	messages = append(messages, aliAudioMessage{
		Role: "user",
		Content: []aliAudioContent{{
			Type:       "input_audio",
			InputAudio: &aliInputAudio{Data: dataURI},
		}},
	})

	aliRequest := aliAudioTranscriptionRequest{
		Model: info.UpstreamModelName,
		Input: aliAudioInput{Messages: messages},
		Parameters: aliAudioParameters{
			Format: format,
		},
	}
	if sampleRate := aliWAVSampleRate(format, audioBytes); sampleRate != "" {
		aliRequest.Parameters.SampleRate = sampleRate
	}
	if language := strings.TrimSpace(formData.Get("language")); language != "" {
		aliRequest.Parameters.LanguageHints = []string{language}
	}

	jsonData, err := common.Marshal(aliRequest)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal Ali audio transcription request: %w", err)
	}
	return bytes.NewReader(jsonData), nil
}

func convertAliQwenASRTranscriptionRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	if info.RelayMode != constant.RelayModeAudioTranscription {
		return nil, errors.New("Ali audio adaptor supports transcription only")
	}
	if aliAudioTranscriptionProtocolFor(info.UpstreamModelName) != aliAudioTranscriptionProtocolQwenASRMultimodal {
		return nil, fmt.Errorf("Ali audio transcription model %q is not supported", info.UpstreamModelName)
	}
	if _, err := aliAudioResponseFormat(request); err != nil {
		return nil, err
	}

	form := c.Request.MultipartForm
	if form == nil {
		var err error
		form, err = common.ParseMultipartFormReusable(c)
		if err != nil {
			return nil, fmt.Errorf("failed to parse audio form request: %w", err)
		}
		c.Request.MultipartForm = form
	}
	fileHeaders := form.File["file"]
	if len(fileHeaders) == 0 {
		return nil, errors.New("file is required")
	}

	fileHeader := fileHeaders[0]
	_, mediaType, err := aliAudioFormatAndMediaType(fileHeader)
	if err != nil {
		return nil, err
	}
	prefix := "data:" + mediaType + ";base64,"
	maxRawBytes := ((aliAudioMaxDataURIBytes - len(prefix)) / 4) * 3
	if fileHeader.Size > int64(maxRawBytes) {
		return nil, fmt.Errorf("audio file is too large for Ali Base64 input (maximum %d bytes)", maxRawBytes)
	}

	file, err := fileHeader.Open()
	if err != nil {
		return nil, fmt.Errorf("failed to open audio file: %w", err)
	}
	defer file.Close()

	audioBytes, err := io.ReadAll(io.LimitReader(file, int64(maxRawBytes)+1))
	if err != nil {
		return nil, fmt.Errorf("failed to read audio file: %w", err)
	}
	if len(audioBytes) > maxRawBytes {
		return nil, fmt.Errorf("audio file is too large for Ali Base64 input (maximum %d bytes)", maxRawBytes)
	}

	dataURI := prefix + base64.StdEncoding.EncodeToString(audioBytes)
	if len(dataURI) > aliAudioMaxDataURIBytes {
		return nil, fmt.Errorf("audio file is too large for Ali Base64 input (maximum %d bytes)", maxRawBytes)
	}

	formData := url.Values(form.Value)
	aliRequest := aliQwenASRTranscriptionRequest{
		Model: info.UpstreamModelName,
		Input: aliQwenASRInput{Messages: []aliQwenASRMessage{{
			Role: "user",
			Content: []aliQwenASRContent{{
				Audio: dataURI,
			}},
		}}},
	}
	if language := strings.TrimSpace(formData.Get("language")); language != "" {
		aliRequest.Parameters.ASROptions.Language = language
	}

	jsonData, err := common.Marshal(aliRequest)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal Ali Qwen ASR transcription request: %w", err)
	}
	return bytes.NewReader(jsonData), nil
}

func aliWAVSampleRate(format string, audioBytes []byte) string {
	if format != "wav" || len(audioBytes) < 20 || string(audioBytes[:4]) != "RIFF" || string(audioBytes[8:12]) != "WAVE" {
		return ""
	}

	for offset := 12; offset+8 <= len(audioBytes); {
		chunkLength := int(binary.LittleEndian.Uint32(audioBytes[offset+4 : offset+8]))
		chunkDataStart := offset + 8
		if chunkLength < 0 || chunkLength > len(audioBytes)-chunkDataStart {
			return ""
		}
		if string(audioBytes[offset:offset+4]) == "fmt " {
			if chunkLength < 8 {
				return ""
			}
			sampleRate := binary.LittleEndian.Uint32(audioBytes[chunkDataStart+4 : chunkDataStart+8])
			if sampleRate == 0 {
				return ""
			}
			return strconv.FormatUint(uint64(sampleRate), 10)
		}
		offset = chunkDataStart + chunkLength
		if chunkLength%2 != 0 {
			offset++
		}
	}
	return ""
}

func aliAudioResponseFormat(request dto.AudioRequest) (string, error) {
	responseFormat := strings.TrimSpace(request.ResponseFormat)
	if responseFormat == "" {
		responseFormat = "json"
	}
	switch responseFormat {
	case "json", "text", "verbose_json":
		return responseFormat, nil
	default:
		return "", fmt.Errorf("response_format %q is not supported by Ali audio transcription", responseFormat)
	}
}

func aliAudioFormatAndMediaType(fileHeader *multipart.FileHeader) (string, string, error) {
	ext := strings.TrimPrefix(strings.ToLower(filepath.Ext(fileHeader.Filename)), ".")
	mediaTypes := map[string]string{
		"aac":  "audio/aac",
		"amr":  "audio/amr",
		"avi":  "video/x-msvideo",
		"flac": "audio/flac",
		"flv":  "video/x-flv",
		"m4a":  "audio/mp4",
		"mkv":  "video/x-matroska",
		"mov":  "video/quicktime",
		"mp3":  "audio/mpeg",
		"mp4":  "audio/mp4",
		"mpeg": "audio/mpeg",
		"ogg":  "audio/ogg",
		"opus": "audio/opus",
		"wav":  "audio/wav",
		"webm": "audio/webm",
		"wma":  "audio/x-ms-wma",
		"wmv":  "video/x-ms-wmv",
	}
	mediaType, ok := mediaTypes[ext]
	if !ok {
		return "", "", fmt.Errorf("unsupported audio file format %q", ext)
	}
	return ext, mediaType, nil
}

func truncateAliAudioPrompt(prompt string) string {
	if utf8.RuneCountInString(prompt) <= aliAudioPromptMaxRunes {
		return prompt
	}
	return string([]rune(prompt)[:aliAudioPromptMaxRunes])
}

func aliAudioTranscriptionHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	request, ok := info.Request.(*dto.AudioRequest)
	if !ok {
		return nil, types.NewError(errors.New("invalid audio request type"), types.ErrorCodeBadResponseBody)
	}
	responseFormat, err := aliAudioResponseFormat(*request)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	if info.IsStream {
		return aliAudioTranscriptionStreamHandler(c, resp, info)
	}
	return aliAudioTranscriptionResponseHandler(c, resp, info, responseFormat)
}

func aliAudioTranscriptionResponseHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo, responseFormat string) (any, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}
	var aliResponse aliAudioTranscriptionResponse
	if err := common.Unmarshal(responseBody, &aliResponse); err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	info.SetFirstResponseTime()
	usage := aliAudioUsageFromDuration(info, aliResponse.Usage.Duration)

	switch responseFormat {
	case "text":
		c.Writer.Header().Set("Content-Type", "text/plain; charset=utf-8")
		c.Writer.WriteHeader(http.StatusOK)
		if _, err := c.Writer.Write([]byte(aliResponse.Output.text())); err != nil {
			return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
		}
	case "verbose_json":
		verboseResponse := aliVerboseAudioResponse{
			Task: "transcribe",
			Text: aliResponse.Output.text(),
		}
		if aliResponse.Usage.Duration != nil {
			verboseResponse.Duration = nonNegativeDuration(*aliResponse.Usage.Duration)
		}
		if sentence := aliResponse.Output.sentence(); sentence != nil {
			verboseResponse.Segments = []aliVerboseAudioSegment{{
				ID:    sentence.SentenceID,
				Start: float64(sentence.BeginTime) / 1000,
				End:   float64(sentence.EndTime) / 1000,
				Text:  sentence.Text,
				Words: aliAudioWordsToVerbose(sentence.Words),
			}}
		}
		jsonData, err := common.Marshal(verboseResponse)
		if err != nil {
			return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
		}
		c.Writer.Header().Set("Content-Type", "application/json")
		c.Writer.WriteHeader(http.StatusOK)
		if _, err := c.Writer.Write(jsonData); err != nil {
			return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
		}
	default:
		jsonData, err := common.Marshal(dto.AudioResponse{Text: aliResponse.Output.text()})
		if err != nil {
			return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
		}
		c.Writer.Header().Set("Content-Type", "application/json")
		c.Writer.WriteHeader(http.StatusOK)
		if _, err := c.Writer.Write(jsonData); err != nil {
			return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
		}
	}

	return usage, nil
}

func aliAudioTranscriptionStreamHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	helper.SetEventStreamHeaders(c)
	scanner := helper.NewStreamScanner(resp.Body)
	scanner.Split(bufio.ScanLines)
	seenSentences := make(map[int]struct{})
	var lastText string
	var emittedText string
	var duration *float64

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		var data string
		switch {
		case strings.HasPrefix(line, "data:"):
			data = strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		case strings.HasPrefix(line, "{"):
			// Some Bailian deployments return one complete JSON object even when
			// X-DashScope-SSE is enabled. Preserve the streaming client contract by
			// converting that object into a delta followed by a done event.
			data = line
		default:
			continue
		}
		if data == "" {
			continue
		}
		if data == "[DONE]" {
			break
		}

		var aliResponse aliAudioTranscriptionResponse
		if err := common.Unmarshal([]byte(data), &aliResponse); err != nil {
			return nil, types.NewError(fmt.Errorf("failed to parse Ali audio stream event: %w", err), types.ErrorCodeBadResponseBody)
		}
		info.SetFirstResponseTime()
		info.ReceivedResponseCount++
		text := aliResponse.Output.text()
		if text == "" {
			text = aliAudioStreamText([]byte(data))
		}
		if aliResponse.Usage.Duration != nil {
			duration = aliResponse.Usage.Duration
		}
		sentence := aliResponse.Output.sentence()
		if sentence == nil {
			if text == "" {
				continue
			}
			delta := text
			if strings.HasPrefix(text, emittedText) {
				delta = strings.TrimPrefix(text, emittedText)
				emittedText = text
				lastText = text
			} else {
				emittedText += text
				lastText += text
			}
			if delta == "" {
				continue
			}
			if err := writeAliAudioSSEvent(c, "transcript.text.delta", aliTranscriptDeltaEvent{
				Type:  "transcript.text.delta",
				Delta: delta,
			}); err != nil {
				return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
			}
			continue
		}
		if text != "" {
			lastText = text
		}
		if !sentence.SentenceEnd || sentence.Text == "" {
			continue
		}
		if _, exists := seenSentences[sentence.SentenceID]; exists {
			continue
		}
		seenSentences[sentence.SentenceID] = struct{}{}
		if err := writeAliAudioSSEvent(c, "transcript.text.delta", aliTranscriptDeltaEvent{
			Type:  "transcript.text.delta",
			Delta: sentence.Text,
		}); err != nil {
			return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}

	usage := aliAudioUsageFromDuration(info, duration)
	doneEvent := aliTranscriptDoneEvent{
		Type: "transcript.text.done",
		Text: lastText,
	}
	if duration != nil {
		doneEvent.Usage = &aliTranscriptDuration{
			Type:    "duration",
			Seconds: nonNegativeDuration(*duration),
		}
	}
	if err := writeAliAudioSSEvent(c, "transcript.text.done", doneEvent); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	return usage, nil
}

func (o aliAudioOutput) text() string {
	if o.Text != "" {
		return o.Text
	}
	if o.Output != nil {
		return o.Output.text()
	}
	for _, choice := range o.Choices {
		for _, content := range choice.Message.Content {
			if content.Text != "" {
				return content.Text
			}
		}
	}
	return ""
}

func (o aliAudioOutput) sentence() *aliAudioSentence {
	if o.Sentence != nil {
		return o.Sentence
	}
	if o.Output != nil {
		return o.Output.sentence()
	}
	return nil
}

func aliAudioStreamText(data []byte) string {
	var value any
	if err := common.Unmarshal(data, &value); err != nil {
		return ""
	}
	return findAliAudioText(value)
}

func findAliAudioText(value any) string {
	switch typed := value.(type) {
	case map[string]any:
		for _, key := range []string{"text", "content"} {
			if text, ok := typed[key].(string); ok && text != "" {
				return text
			}
		}
		for _, key := range []string{"output", "choices", "message", "delta", "content"} {
			if child, ok := typed[key]; ok {
				if text := findAliAudioText(child); text != "" {
					return text
				}
			}
		}
	case []any:
		for _, item := range typed {
			if text := findAliAudioText(item); text != "" {
				return text
			}
		}
	}
	return ""
}

func aliQwenASRTranscriptionHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	request, ok := info.Request.(*dto.AudioRequest)
	if !ok {
		return nil, types.NewError(errors.New("invalid audio request type"), types.ErrorCodeBadResponseBody)
	}
	responseFormat, err := aliAudioResponseFormat(*request)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	if info.IsStream {
		return aliQwenASRTranscriptionStreamHandler(c, resp, info)
	}
	return aliQwenASRTranscriptionResponseHandler(c, resp, info, responseFormat)
}

func aliQwenASRTranscriptionResponseHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo, responseFormat string) (any, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}
	var aliResponse aliQwenASRTranscriptionResponse
	if err := common.Unmarshal(responseBody, &aliResponse); err != nil {
		return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
	}
	info.SetFirstResponseTime()
	usage := aliAudioUsageFromDuration(info, aliResponse.Usage.Seconds)
	text := aliResponse.text()

	switch responseFormat {
	case "text":
		c.Writer.Header().Set("Content-Type", "text/plain; charset=utf-8")
		c.Writer.WriteHeader(http.StatusOK)
		if _, err := c.Writer.Write([]byte(text)); err != nil {
			return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
		}
	case "verbose_json":
		verboseResponse := aliVerboseAudioResponse{
			Task: "transcribe",
			Text: text,
		}
		if aliResponse.Usage.Seconds != nil {
			verboseResponse.Duration = nonNegativeDuration(*aliResponse.Usage.Seconds)
		}
		jsonData, err := common.Marshal(verboseResponse)
		if err != nil {
			return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
		}
		c.Writer.Header().Set("Content-Type", "application/json")
		c.Writer.WriteHeader(http.StatusOK)
		if _, err := c.Writer.Write(jsonData); err != nil {
			return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
		}
	default:
		jsonData, err := common.Marshal(dto.AudioResponse{Text: text})
		if err != nil {
			return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
		}
		c.Writer.Header().Set("Content-Type", "application/json")
		c.Writer.WriteHeader(http.StatusOK)
		if _, err := c.Writer.Write(jsonData); err != nil {
			return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
		}
	}

	return usage, nil
}

func aliQwenASRTranscriptionStreamHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	helper.SetEventStreamHeaders(c)
	scanner := helper.NewStreamScanner(resp.Body)
	scanner.Split(bufio.ScanLines)
	var text string
	var duration *float64

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if data == "" || data == "[DONE]" {
			continue
		}

		var aliResponse aliQwenASRTranscriptionResponse
		if err := common.Unmarshal([]byte(data), &aliResponse); err != nil {
			return nil, types.NewError(fmt.Errorf("failed to parse Ali Qwen ASR stream event: %w", err), types.ErrorCodeBadResponseBody)
		}
		info.SetFirstResponseTime()
		info.ReceivedResponseCount++
		if aliResponse.Usage.Seconds != nil {
			duration = aliResponse.Usage.Seconds
		}
		currentText := aliResponse.text()
		if currentText == "" {
			continue
		}
		delta := currentText
		if strings.HasPrefix(currentText, text) {
			delta = strings.TrimPrefix(currentText, text)
			text = currentText
		} else {
			text += currentText
		}
		if delta == "" {
			continue
		}
		if err := writeAliAudioSSEvent(c, "transcript.text.delta", aliTranscriptDeltaEvent{
			Type:  "transcript.text.delta",
			Delta: delta,
		}); err != nil {
			return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}

	usage := aliAudioUsageFromDuration(info, duration)
	doneEvent := aliTranscriptDoneEvent{
		Type: "transcript.text.done",
		Text: text,
	}
	if duration != nil {
		doneEvent.Usage = &aliTranscriptDuration{
			Type:    "duration",
			Seconds: nonNegativeDuration(*duration),
		}
	}
	if err := writeAliAudioSSEvent(c, "transcript.text.done", doneEvent); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	return usage, nil
}

func (r aliQwenASRTranscriptionResponse) text() string {
	for _, choice := range r.Output.Choices {
		for _, content := range choice.Message.Content {
			if content.Text != "" {
				return content.Text
			}
		}
	}
	return ""
}

func writeAliAudioSSEvent(c *gin.Context, event string, value any) error {
	jsonData, err := common.Marshal(value)
	if err != nil {
		return err
	}
	helper.ExtendWriteDeadline(c)
	c.Render(-1, common.CustomEvent{Data: "event: " + event + "\n"})
	c.Render(-1, common.CustomEvent{Data: "data: " + string(jsonData)})
	return helper.FlushWriter(c)
}

func aliAudioUsageFromDuration(info *relaycommon.RelayInfo, duration *float64) *dto.Usage {
	audioTokens := info.GetEstimatePromptTokens()
	if duration != nil {
		checkedTokens, clamp := common.QuotaRoundChecked(math.Ceil(nonNegativeDuration(*duration)) / 60 * 1000)
		audioTokens = checkedTokens
		if clamp != nil {
			if info.QuotaClamp == nil {
				info.QuotaClamp = clamp
			}
		}
	}
	return &dto.Usage{
		PromptTokens: audioTokens,
		TotalTokens:  audioTokens,
		PromptTokensDetails: dto.InputTokenDetails{
			AudioTokens: audioTokens,
		},
	}
}

func nonNegativeDuration(duration float64) float64 {
	if math.IsNaN(duration) || duration < 0 {
		return 0
	}
	return duration
}

func aliAudioWordsToVerbose(words []aliAudioWord) []aliVerboseAudioWord {
	if len(words) == 0 {
		return nil
	}
	result := make([]aliVerboseAudioWord, 0, len(words))
	for _, word := range words {
		result = append(result, aliVerboseAudioWord{
			Word:  word.Text + word.Punctuation,
			Start: float64(word.BeginTime) / 1000,
			End:   float64(word.EndTime) / 1000,
		})
	}
	return result
}
