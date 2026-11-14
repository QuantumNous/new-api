package ali

import (
	"bytes"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/go-audio/wav"
)

// Qwen's HTTP TTS API accepts at most 600 characters and produces 24 kHz,
// mono, signed 16-bit PCM (Base64) or a WAV download. It does not document
// speed controls or encoded output formats such as MP3.
// https://docs.bailian.console.aliyun.com/zh/model-studio/qwen-tts-api
const (
	aliTTSMaxCharacters = 600
	aliTTSMaxAudioBytes = 32 << 20
)

type AliTTSRequest struct {
	Model string      `json:"model"`
	Input AliTTSInput `json:"input"`
}

type AliTTSInput struct {
	Text         string `json:"text"`
	Voice        string `json:"voice"`
	LanguageType string `json:"language_type,omitempty"`
}

type AliTTSResponse struct {
	Output struct {
		Audio struct {
			URL  string `json:"url"`
			Data string `json:"data"`
		} `json:"audio"`
	} `json:"output"`
	Usage struct {
		Characters int64 `json:"characters"`
	} `json:"usage"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

var openAIToAliVoiceMap = map[string]string{
	"alloy":   "Cherry",
	"echo":    "Ethan",
	"fable":   "Serena",
	"onyx":    "Ethan",
	"nova":    "Chelsie",
	"shimmer": "Serena",
}

// convertOpenAITTSRequestToAli validates the supported HTTP speech contract
// without silently substituting a different audio codec or unsupported controls.
func convertOpenAITTSRequestToAli(request dto.AudioRequest) (*AliTTSRequest, error) {
	if strings.TrimSpace(request.Input) == "" || utf8.RuneCountInString(request.Input) > aliTTSMaxCharacters {
		return nil, fmt.Errorf("Qwen TTS input must contain 1 to %d characters", aliTTSMaxCharacters)
	}
	if strings.TrimSpace(request.Voice) == "" {
		return nil, errors.New("Qwen TTS voice is required")
	}
	if request.StreamFormat != "" && request.StreamFormat != "audio" {
		return nil, errors.New("Qwen HTTP TTS supports stream_format=audio only")
	}
	if request.ResponseFormat != "wav" && request.ResponseFormat != "pcm" {
		return nil, errors.New("Qwen HTTP TTS does not support the OpenAI default MP3 format; explicitly set response_format to wav or pcm")
	}
	if request.Speed != nil && *request.Speed != 1 {
		return nil, errors.New("Qwen HTTP TTS does not support changing speed; omit speed or use 1")
	}
	if request.Instructions != "" {
		return nil, errors.New("Qwen HTTP TTS does not support instructions")
	}

	language := "Auto"
	if len(request.Language) != 0 {
		var value string
		if err := common.Unmarshal(request.Language, &value); err != nil {
			return nil, errors.New("Qwen TTS language must be a string")
		}
		switch strings.ToLower(strings.TrimSpace(value)) {
		case "", "auto":
		case "zh", "zh-cn", "zh-tw", "chinese":
			language = "Chinese"
		case "en", "english":
			language = "English"
		case "de", "german":
			language = "German"
		case "it", "italian":
			language = "Italian"
		case "pt", "portuguese":
			language = "Portuguese"
		case "es", "spanish":
			language = "Spanish"
		case "ja", "japanese":
			language = "Japanese"
		case "ko", "korean":
			language = "Korean"
		case "fr", "french":
			language = "French"
		case "ru", "russian":
			language = "Russian"
		default:
			return nil, fmt.Errorf("unsupported Qwen TTS language %q", value)
		}
	}
	voice := request.Voice
	if mapped, ok := openAIToAliVoiceMap[voice]; ok {
		voice = mapped
	}
	return &AliTTSRequest{
		Model: request.Model,
		Input: AliTTSInput{Text: request.Input, Voice: voice, LanguageType: language},
	}, nil
}

// validateAliTTSBilling rejects token-priced aliases and expressions because
// this upstream reports characters, not input or output audio tokens. Fixed
// per-request pricing and the existing character-count TTS ratio mode are safe.
func validateAliTTSBilling(info *relaycommon.RelayInfo) error {
	if snap := info.TieredBillingSnapshot; snap != nil {
		vars := billingexpr.UsedVarsByHash(snap.ExprString, snap.ExprHash)
		for _, name := range []string{"p", "c", "len", "cr", "cc", "cc1h", "cc12h", "img", "img_cr", "img_o", "ai", "ao"} {
			if vars[name] {
				return errors.New("Qwen HTTP TTS reports characters and cannot use a token-priced billing expression; configure per-request pricing or character-count TTS ratios")
			}
		}
		return nil
	}
	if info.PriceData.UsePrice {
		return nil
	}
	// Request metadata historically treats every non-GPT name as characters.
	// Only known character-priced speech families establish that unit; aliases
	// such as o1@thinking:off must be checked using their resolved billing name.
	name := info.GetBillingModelName()
	characterPriced := name == "qwen-tts" || strings.HasPrefix(name, "qwen-tts-") ||
		name == "qwen3-tts-flash" || strings.HasPrefix(name, "qwen3-tts-flash-") ||
		name == "tts-1" || strings.HasPrefix(name, "tts-1-")
	if !characterPriced || info.Request != nil && info.Request.GetTokenCountMeta().TokenType != types.TokenTypeTextNumber {
		return errors.New("Qwen HTTP TTS cannot bill a token-priced model alias; use a character-count TTS model name or per-request pricing")
	}
	return nil
}

// handleAliTTSResponse downloads and validates the complete audio before
// writing a successful response, retaining only the provider's character usage.
func handleAliTTSResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return nil, types.NewErrorWithStatusCode(errors.New("empty Qwen TTS response"), types.ErrorCodeBadResponse, http.StatusBadGateway)
	}
	defer service.CloseResponseBodyGracefully(resp)
	if resp.StatusCode != http.StatusOK {
		return nil, service.RelayErrorHandler(c.Request.Context(), resp, false)
	}
	// Bound both a Base64 envelope and the downloaded/decoded audio.
	body, err := io.ReadAll(io.LimitReader(resp.Body, 2*aliTTSMaxAudioBytes+1))
	if err != nil || len(body) > 2*aliTTSMaxAudioBytes {
		return nil, types.NewErrorWithStatusCode(errors.New("failed to read Qwen TTS response or response too large"), types.ErrorCodeReadResponseBodyFailed, http.StatusBadGateway)
	}
	var response AliTTSResponse
	if err := common.Unmarshal(body, &response); err != nil {
		return nil, types.NewErrorWithStatusCode(fmt.Errorf("invalid Qwen TTS response: %w", err), types.ErrorCodeBadResponseBody, http.StatusBadGateway)
	}
	if response.Code != "" && response.Code != "Success" {
		return nil, types.NewErrorWithStatusCode(fmt.Errorf("Qwen TTS error: %s - %s", response.Code, response.Message), types.ErrorCodeBadResponse, http.StatusBadGateway)
	}

	var audio []byte
	fromURL := response.Output.Audio.URL != ""
	if fromURL {
		request, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, response.Output.Audio.URL, nil)
		if err != nil {
			return nil, types.NewErrorWithStatusCode(errors.New("invalid Qwen audio URL"), types.ErrorCodeBadResponse, http.StatusBadGateway)
		}
		// The URL is upstream-controlled: use the fetch client, which validates
		// DNS and redirects, and never forward the channel API key.
		download, err := service.GetSSRFProtectedHTTPClient().Do(request)
		if err != nil {
			return nil, types.NewErrorWithStatusCode(errors.New("failed to download Qwen audio"), types.ErrorCodeBadResponse, http.StatusBadGateway)
		}
		defer service.CloseResponseBodyGracefully(download)
		if download.StatusCode != http.StatusOK {
			return nil, types.NewErrorWithStatusCode(fmt.Errorf("Qwen audio download returned HTTP %d", download.StatusCode), types.ErrorCodeBadResponse, http.StatusBadGateway)
		}
		audio, err = io.ReadAll(io.LimitReader(download.Body, aliTTSMaxAudioBytes+1))
		if err != nil {
			return nil, types.NewErrorWithStatusCode(errors.New("failed to read Qwen audio download"), types.ErrorCodeReadResponseBodyFailed, http.StatusBadGateway)
		}
	} else {
		audio, err = base64.StdEncoding.DecodeString(response.Output.Audio.Data)
		if err != nil {
			return nil, types.NewErrorWithStatusCode(errors.New("invalid Base64 Qwen audio"), types.ErrorCodeBadResponseBody, http.StatusBadGateway)
		}
	}
	if len(audio) == 0 || len(audio) > aliTTSMaxAudioBytes {
		return nil, types.NewErrorWithStatusCode(errors.New("Qwen audio is empty or too large"), types.ErrorCodeBadResponseBody, http.StatusBadGateway)
	}
	format := "wav"
	if request, ok := info.Request.(*dto.AudioRequest); ok && request.ResponseFormat == "pcm" {
		format = "pcm"
	}
	audio, err = formatAliTTSAudio(audio, fromURL, format)
	if err != nil {
		return nil, types.NewErrorWithStatusCode(err, types.ErrorCodeBadResponseBody, http.StatusBadGateway)
	}

	characters := response.Usage.Characters
	if characters <= 0 {
		characters = int64(max(info.GetEstimatePromptTokens(), 0))
		if request, ok := info.Request.(*dto.AudioRequest); ok && request.Input != "" {
			characters = int64(utf8.RuneCountInString(request.Input))
		}
	}
	count, clamp := common.QuotaFromFloatChecked(float64(characters))
	if info.QuotaClamp == nil {
		info.QuotaClamp = clamp
	}
	c.Data(http.StatusOK, "audio/"+format, audio)
	return &dto.Usage{PromptTokens: count, TotalTokens: count}, nil
}

// formatAliTTSAudio preserves a valid WAV download or wraps raw PCM in a WAV
// header; PCM requests receive only 24 kHz, mono, signed 16-bit samples.
func formatAliTTSAudio(audio []byte, fromURL bool, format string) ([]byte, error) {
	isWAV := len(audio) >= 12 && string(audio[:4]) == "RIFF" && string(audio[8:12]) == "WAVE"
	if fromURL || isWAV {
		decoder := wav.NewDecoder(bytes.NewReader(audio))
		if err := decoder.FwdToPCM(); err != nil {
			return nil, errors.New("Qwen audio download is not a valid WAV file")
		}
		if decoder.WavAudioFormat != 1 || decoder.NumChans != 1 || decoder.BitDepth != 16 || decoder.SampleRate != 24000 {
			return nil, errors.New("Qwen audio must be 24 kHz mono PCM16")
		}
		pcm, err := io.ReadAll(decoder.PCMChunk)
		if err != nil || len(pcm) == 0 || len(pcm)%2 != 0 || len(pcm) != decoder.PCMSize {
			return nil, errors.New("Qwen audio contains incomplete PCM samples")
		}
		if format == "pcm" {
			return pcm, nil
		}
		return audio, nil
	}
	if len(audio)%2 != 0 {
		return nil, errors.New("Qwen audio contains incomplete PCM samples")
	}
	if format == "pcm" {
		return audio, nil
	}
	// The response size limit above keeps both RIFF sizes within uint32.
	result := make([]byte, 44+len(audio))
	copy(result, "RIFF")
	binary.LittleEndian.PutUint32(result[4:], uint32(36+len(audio)))
	copy(result[8:], "WAVEfmt ")
	binary.LittleEndian.PutUint32(result[16:], 16)
	binary.LittleEndian.PutUint16(result[20:], 1)
	binary.LittleEndian.PutUint16(result[22:], 1)
	binary.LittleEndian.PutUint32(result[24:], 24000)
	binary.LittleEndian.PutUint32(result[28:], 48000)
	binary.LittleEndian.PutUint16(result[32:], 2)
	binary.LittleEndian.PutUint16(result[34:], 16)
	copy(result[36:], "data")
	binary.LittleEndian.PutUint32(result[40:], uint32(len(audio)))
	copy(result[44:], audio)
	return result, nil
}
