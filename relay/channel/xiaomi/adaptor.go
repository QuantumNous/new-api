package xiaomi

import (
	"bytes"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"math"
	"mime"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"slices"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// Adaptor serves Xiaomi MiMo. Chat completions, Responses and model listing
// already speak the OpenAI wire format upstream, so those relay modes forward
// unchanged. Speech recognition and synthesis are the exception: MiMo serves
// both on /v1/chat/completions instead of the OpenAI audio endpoints, so this
// adaptor rewrites the request into a chat completion and unpacks the audio or
// transcript back out of the reply.
type Adaptor struct {
	openaiAdaptor openai.Adaptor

	// speechFormat is the audio container negotiated for the current
	// /v1/audio/speech request. The upstream renders exactly what it was asked
	// for, so it also decides the Content-Type of the bytes sent back. Empty on
	// every other relay mode.
	speechFormat string
}

// chatPath is the single endpoint MiMo exposes every capability behind.
const chatPath = "/v1/chat/completions"

const (
	audioFormatWAV = "wav"
	audioFormatMP3 = "mp3"
)

// defaultVoice is the MiMo preset used when the client asks for a voice MiMo
// does not have, so a client that only knows the OpenAI voice names still gets
// usable audio instead of a rejected request.
const defaultVoice = "mimo_default"

// audioFormatMIMETypes maps the container requested from MiMo onto the
// Content-Type of the bytes it returns.
var audioFormatMIMETypes = map[string]string{
	audioFormatWAV: "audio/wav",
	audioFormatMP3: "audio/mpeg",
}

// voicePresets are the voices MiMo renders.
var voicePresets = []string{"mimo_default", "冰糖", "茉莉", "苏打", "白桦", "Mia", "Chloe", "Milo", "Dean"}

// inputAudioMIMETypes maps the containers accepted for recognition onto the
// MIME type of the data URL. MiMo rejects every other container.
var inputAudioMIMETypes = map[string]string{
	audioFormatWAV: "audio/wav",
	audioFormatMP3: "audio/mpeg",
}

// clientError marks a request the caller sent wrong. Left as a plain error the
// audio helper would wrap it into a retryable 500, hiding the caller's mistake
// behind an unrelated gateway failure; every Xiaomi channel refuses the same
// input, so the rejection is a 400 that skips channel retries.
func clientError(err error) error {
	return types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
	a.openaiAdaptor.Init(info)
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	requestPath := info.RequestURLPath
	if isAudioRelayMode(info.RelayMode) {
		requestPath = chatPath
	}
	return relaycommon.GetFullRequestURL(info.ChannelBaseUrl, requestPath, info.ChannelType), nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	if isAudioRelayMode(info.RelayMode) {
		// Transcription arrives as multipart and SetupApiRequestHeader leaves
		// that content type in place, but the rewritten body is JSON.
		req.Set("Content-Type", "application/json")
	}
	req.Set("Authorization", "Bearer "+info.ApiKey)
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	return a.openaiAdaptor.ConvertOpenAIRequest(c, info, request)
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	return a.openaiAdaptor.ConvertOpenAIResponsesRequest(c, info, request)
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	return nil, errors.New("not available on the Xiaomi MiMo channel")
}

func (a *Adaptor) ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error) {
	return nil, errors.New("not available on the Xiaomi MiMo channel")
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return nil, errors.New("not available on the Xiaomi MiMo channel")
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return nil, errors.New("not available on the Xiaomi MiMo channel")
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	return nil, errors.New("not available on the Xiaomi MiMo channel")
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	switch info.RelayMode {
	case relayconstant.RelayModeAudioSpeech:
		return a.buildSpeechRequest(c, request)
	case relayconstant.RelayModeAudioTranscription:
		return buildTranscriptionRequest(c, request)
	default:
		// MiMo neither translates nor exposes the OpenAI realtime audio API.
		return nil, clientError(errors.New("the Xiaomi MiMo channel does not support this audio endpoint"))
	}
}

// buildSpeechRequest turns an OpenAI speech request into the chat completion
// MiMo expects: the delivery instruction becomes the user turn and the text to
// read becomes the assistant turn.
func (a *Adaptor) buildSpeechRequest(c *gin.Context, request dto.AudioRequest) (io.Reader, error) {
	if strings.TrimSpace(request.Input) == "" {
		return nil, clientError(errors.New("input is required"))
	}

	// MiMo renders wav and mp3. The remaining OpenAI containers (opus, aac,
	// flac, pcm) have no MiMo equivalent; answering them with wav bytes would
	// hand the client a payload its decoder cannot read, so they are rejected
	// before the upstream is asked to synthesise anything.
	format := audioFormatWAV
	switch strings.ToLower(strings.TrimSpace(request.ResponseFormat)) {
	case "", audioFormatWAV:
	case audioFormatMP3:
		format = audioFormatMP3
	default:
		return nil, clientError(fmt.Errorf("unsupported response_format %q: the Xiaomi MiMo channel renders wav and mp3", request.ResponseFormat))
	}
	a.speechFormat = format

	voice := strings.TrimSpace(request.Voice)
	if !slices.Contains(voicePresets, voice) {
		if voice != "" {
			logger.LogWarn(c.Request.Context(), common.LogText("xiaomi has no voice %q, using %s", voice, defaultVoice))
		}
		voice = defaultVoice
	}

	messages := make([]dto.Message, 0, 2)
	if instructions := strings.TrimSpace(request.Instructions); instructions != "" {
		messages = append(messages, dto.Message{Role: "user", Content: instructions})
	}
	messages = append(messages, dto.Message{Role: "assistant", Content: request.Input})

	body, err := common.Marshal(map[string]any{
		"model":    request.Model,
		"messages": messages,
		"audio": map[string]any{
			"format": format,
			"voice":  voice,
		},
		"stream": false,
	})
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(body), nil
}

// buildTranscriptionRequest turns an OpenAI transcription request into the chat
// completion MiMo expects, carrying the uploaded audio as a base64 data URL.
func buildTranscriptionRequest(c *gin.Context, request dto.AudioRequest) (io.Reader, error) {
	// MiMo returns a plain transcript with no timestamps, so json and text are
	// the only OpenAI transcription formats that can be honoured. The timed
	// ones are rejected here, before the upstream is charged for a transcript
	// this adaptor would otherwise have to mislabel as json.
	switch strings.ToLower(strings.TrimSpace(request.ResponseFormat)) {
	case "", "json", "text":
	default:
		return nil, clientError(fmt.Errorf("unsupported response_format %q: the Xiaomi MiMo channel renders json and text", request.ResponseFormat))
	}

	form, err := common.ParseMultipartFormReusable(c)
	if err != nil {
		return nil, clientError(fmt.Errorf("parse multipart form failed: %w", err))
	}
	fileHeaders := form.File["file"]
	if len(fileHeaders) == 0 {
		return nil, clientError(errors.New("file is required"))
	}

	dataURL, err := inputAudioDataURL(fileHeaders[0])
	if err != nil {
		return nil, err
	}

	body, err := common.Marshal(map[string]any{
		"model": request.Model,
		"messages": []any{
			map[string]any{
				"role": "user",
				"content": []any{
					map[string]any{
						"type":        "input_audio",
						"input_audio": map[string]any{"data": dataURL},
					},
				},
			},
		},
		"asr_options": map[string]any{"language": asrLanguage(form.Value["language"])},
		"stream":      false,
	})
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(body), nil
}

// inputAudioDataURL encodes an uploaded file as the data URL MiMo accepts. The
// MIME type has to match the bytes, so a container MiMo cannot decode is
// rejected here instead of being mislabelled upstream.
func inputAudioDataURL(fileHeader *multipart.FileHeader) (string, error) {
	// The filename extension is the reliable signal; a part that declares a
	// content type without a usable name falls back to it.
	format := strings.ToLower(strings.TrimPrefix(filepath.Ext(fileHeader.Filename), "."))
	if _, supported := inputAudioMIMETypes[format]; !supported {
		format = ""
		mediaType, _, err := mime.ParseMediaType(fileHeader.Header.Get("Content-Type"))
		if err == nil {
			switch strings.ToLower(mediaType) {
			case "audio/mpeg", "audio/mp3":
				format = audioFormatMP3
			case "audio/wav", "audio/wave", "audio/x-wav":
				format = audioFormatWAV
			}
		}
	}
	if format == "" {
		return "", clientError(fmt.Errorf("unsupported audio format %q: the Xiaomi MiMo channel accepts mp3 and wav", fileHeader.Filename))
	}

	file, err := fileHeader.Open()
	if err != nil {
		return "", fmt.Errorf("open audio file failed: %w", err)
	}
	defer file.Close()

	audio, err := io.ReadAll(file)
	if err != nil {
		return "", fmt.Errorf("read audio file failed: %w", err)
	}
	return "data:" + inputAudioMIMETypes[format] + ";base64," + base64.StdEncoding.EncodeToString(audio), nil
}

// asrLanguage narrows the OpenAI language hint to the values MiMo recognises.
// OpenAI clients send any ISO-639-1 code, and an unsupported one must not turn
// an otherwise valid request into a rejection.
func asrLanguage(values []string) string {
	if len(values) == 0 {
		return "auto"
	}
	switch language := strings.ToLower(strings.TrimSpace(values[0])); language {
	case "zh", "en":
		return language
	default:
		return "auto"
	}
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	// The rewritten audio bodies are JSON, so they bypass the multipart path
	// DoRequest would otherwise pick for transcription.
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	switch info.RelayMode {
	case relayconstant.RelayModeAudioSpeech:
		return a.doSpeechResponse(c, resp, info)
	case relayconstant.RelayModeAudioTranscription:
		return doTranscriptionResponse(c, resp, info)
	default:
		// Chat and Responses reach MiMo in the OpenAI wire format, and the stock
		// adaptor already selects the right handler per relay mode. Handling
		// them here instead would bill a Responses reply through the chat
		// handlers, which read prompt_tokens rather than input_tokens and would
		// settle it as an estimate. Every mode MiMo cannot serve is refused
		// during conversion, so nothing else can arrive.
		adaptor := openai.Adaptor{}
		return adaptor.DoResponse(c, resp, info)
	}
}

// doSpeechResponse unpacks the base64 audio MiMo returns inside the chat
// completion and writes it as the raw audio body /v1/audio/speech promises.
func (a *Adaptor) doSpeechResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}
	audio, err := speechAudio(body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	contentType := audioFormatMIMETypes[a.speechFormat]
	if contentType == "" {
		contentType = audioFormatMIMETypes[audioFormatWAV]
	}
	c.Writer.Header().Set("Content-Type", contentType)
	c.Writer.Header().Set("Content-Length", strconv.Itoa(len(audio)))
	c.Writer.WriteHeader(resp.StatusCode)

	usage := &dto.Usage{}
	usage.PromptTokens = info.GetEstimatePromptTokens()
	usage.PromptTokensDetails.TextTokens = usage.PromptTokens
	usage.TotalTokens = usage.PromptTokens

	// MiMo reports no duration for synthesis, so the audio it just produced is
	// what gets billed, at the same rate the OpenAI TTS handler uses. The count
	// is derived before the body is written: the upstream has already generated
	// and charged for this audio, so a write that fails part way (a client that
	// disconnected, say) must not leave the request settling as text-only and
	// letting the gateway absorb the synthesis cost.
	usage.CompletionTokens = audioTokenCount(c, audio, a.speechFormat)
	usage.CompletionTokenDetails.AudioTokens = usage.CompletionTokens
	usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens

	if _, err := c.Writer.Write(audio); err != nil {
		logger.LogError(c, common.LogText("failed to write xiaomi TTS response: %s", err.Error()))
	}
	return usage, nil
}

// speechAudio extracts the base64 audio payload from a MiMo synthesis reply.
func speechAudio(body []byte) ([]byte, error) {
	var completion struct {
		Choices []struct {
			Message struct {
				Audio *struct {
					Data string `json:"data"`
				} `json:"audio"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := common.Unmarshal(body, &completion); err != nil {
		return nil, err
	}
	if len(completion.Choices) == 0 || completion.Choices[0].Message.Audio == nil || completion.Choices[0].Message.Audio.Data == "" {
		return nil, errors.New("upstream response carries no audio")
	}
	audio, err := base64.StdEncoding.DecodeString(completion.Choices[0].Message.Audio.Data)
	if err != nil {
		return nil, fmt.Errorf("decode upstream audio failed: %w", err)
	}
	return audio, nil
}

// audioTokenCount converts a rendered audio payload into the token count the
// gateway bills, at 1000 tokens per minute. The duration comes from a container
// header the upstream controls, so the conversion saturates rather than
// wrapping, and a payload whose header cannot be read still gets billed.
func audioTokenCount(c *gin.Context, audio []byte, format string) int {
	duration, err := common.GetAudioDuration(c.Request.Context(), bytes.NewReader(audio), "."+format)
	if err != nil || duration <= 0 {
		logger.LogWarn(c, common.LogText("failed to read xiaomi TTS audio duration: %v", err))
		return common.QuotaRound(math.Ceil(float64(len(audio)) / 1000.0))
	}
	return common.QuotaRound(math.Ceil(duration) / 60.0 * 1000)
}

// doTranscriptionResponse writes the transcript MiMo returns in the chat
// message as the OpenAI transcription payload.
func doTranscriptionResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}

	var completion struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Usage dto.Usage `json:"usage"`
	}
	if err := common.Unmarshal(body, &completion); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	text := ""
	if len(completion.Choices) > 0 {
		text = completion.Choices[0].Message.Content
	}

	// buildTranscriptionRequest rejects the timed formats before the upstream is
	// called, so only json and text reach this point.
	responseFormat := ""
	if request, ok := info.Request.(*dto.AudioRequest); ok {
		responseFormat = request.ResponseFormat
	}
	if strings.EqualFold(strings.TrimSpace(responseFormat), "text") {
		c.Writer.Header().Set("Content-Type", "text/plain; charset=utf-8")
		c.Writer.Header().Set("Content-Length", strconv.Itoa(len(text)))
		c.Writer.WriteHeader(resp.StatusCode)
		if _, err := c.Writer.WriteString(text); err != nil {
			logger.LogError(c, common.LogText("failed to write xiaomi transcription response: %s", err.Error()))
		}
	} else {
		payload, err := common.Marshal(map[string]string{"text": text})
		if err != nil {
			return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
		}
		c.Writer.Header().Set("Content-Type", "application/json")
		c.Writer.Header().Set("Content-Length", strconv.Itoa(len(payload)))
		c.Writer.WriteHeader(resp.StatusCode)
		if _, err := c.Writer.Write(payload); err != nil {
			logger.LogError(c, common.LogText("failed to write xiaomi transcription response: %s", err.Error()))
		}
	}

	// The audio-token detail MiMo reports is what makes the gateway settle this
	// request against the audio prices rather than the text ones. A reply that
	// carries prompt tokens without that detail still reports what the upstream
	// recognised, so it is kept; only a reply that reports no prompt tokens at
	// all needs the local estimate to stand in for them.
	usage := completion.Usage
	if usage.PromptTokensDetails.AudioTokens == 0 && usage.PromptTokens == 0 {
		usage.PromptTokens = info.GetEstimatePromptTokens()
		usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
	}
	return &usage, nil
}

// isAudioRelayMode reports the audio relay modes this adaptor translates into a
// chat completion. MiMo serves no other audio endpoint.
func isAudioRelayMode(relayMode int) bool {
	switch relayMode {
	case relayconstant.RelayModeAudioSpeech, relayconstant.RelayModeAudioTranscription:
		return true
	default:
		return false
	}
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}
