package service

import (
	"errors"
	"fmt"
	"math"
	"path/filepath"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	constant2 "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/tokenkit"

	"github.com/gin-gonic/gin"
)

func getImageToken(c *gin.Context, fileMeta *types.FileMeta, model string, stream bool) (int, error) {
	if fileMeta == nil || fileMeta.Source == nil {
		return 0, fmt.Errorf("image_url_is_nil")
	}

	img := tokenkit.Image{Detail: fileMeta.Detail}
	// Reading the size may download a URL image; operators can turn that off,
	// and the estimate then assumes a typical image size.
	measure := constant.GetMediaToken && (stream || constant.GetMediaTokenNotStream)
	if !measure || !tokenkit.ImageNeedsSize(model, img.Detail) {
		return tokenkit.ImageTokens(model, img), nil
	}

	config, format, err := GetImageConfig(c, fileMeta.Source)
	if err != nil {
		return 0, err
	}
	if (config.Width == 0 || config.Height == 0) && format == "" {
		return 0, fmt.Errorf("fail to decode image config: %s", fileMeta.GetIdentifier())
	}
	img.Width, img.Height = config.Width, config.Height
	logger.LogDebug(c, "image token input: format=%s, width=%d, height=%d", format, img.Width, img.Height)
	return tokenkit.ImageTokens(model, img), nil
}

func EstimateRequestToken(c *gin.Context, meta *types.TokenCountMeta, info *relaycommon.RelayInfo) (int, error) {
	// Whether to count tokens
	if !constant.CountToken {
		return 0, nil
	}
	return CountRequestToken(c, meta, info)
}

// CountRequestToken counts request tokens regardless of the billing estimation
// switch. Utility endpoints such as Claude's messages/count_tokens must remain
// available even when operators disable request-token estimation for relays.
func CountRequestToken(c *gin.Context, meta *types.TokenCountMeta, info *relaycommon.RelayInfo) (int, error) {
	if meta == nil {
		return 0, errors.New("token count meta is nil")
	}

	if info.RelayFormat == types.RelayFormatOpenAIRealtime {
		return 0, nil
	}
	if info.RelayMode == constant2.RelayModeAudioTranscription || info.RelayMode == constant2.RelayModeAudioTranslation {
		multiForm, err := common.ParseMultipartFormReusable(c)
		if err != nil {
			return 0, fmt.Errorf("error parsing multipart form: %v", err)
		}
		fileHeaders := multiForm.File["file"]
		totalAudioToken := 0
		for _, fileHeader := range fileHeaders {
			file, err := fileHeader.Open()
			if err != nil {
				return 0, fmt.Errorf("error opening audio file: %v", err)
			}
			defer file.Close()
			// get ext and io.seeker
			ext := filepath.Ext(fileHeader.Filename)
			duration, err := common.GetAudioDuration(c.Request.Context(), file, ext)
			if err != nil {
				return 0, fmt.Errorf("error getting audio duration: %v", err)
			}
			// duration metadata from user-uploaded files, can be faked to be astronomical or negative.
			// Negative values will cause the token estimate to become a negative number (underestimating the withholding fee). First, clamp it to 0 and then convert it.
			if duration < 0 {
				duration = 0
			}
			// 1000 tokens per minute, aligned with $price / minute.
			totalAudioToken += common.QuotaRound(math.Ceil(duration) / 60.0 * 1000)
		}
		return totalAudioToken, nil
	}

	model := common.GetContextKeyString(c, constant.ContextKeyOriginalModel)
	tkm := 0

	if meta.TokenType == types.TokenTypeTextNumber {
		tkm += utf8.RuneCountInString(meta.CombineText)
	} else {
		tkm += tokenkit.Count(model, meta.CombineText)
	}

	if info.RelayFormat == types.RelayFormatOpenAI {
		tkm += meta.ToolsCount * 8
		tkm += meta.MessagesCount * 3 // Number of formatted tokens per message
		tkm += meta.NameCount * 3
		tkm += 3
	}

	shouldFetchFiles := true

	if info.RelayFormat == types.RelayFormatGemini {
		shouldFetchFiles = false
	}

	// Whether to calculate the number of media tokens locally
	if !constant.GetMediaToken {
		shouldFetchFiles = false
	}

	// Whether to calculate the number of media tokens locally in non-streaming mode
	if !constant.GetMediaTokenNotStream && !info.IsStream {
		shouldFetchFiles = false
	}

	// Get file types using unified file services
	for _, file := range meta.Files {
		if file.Source == nil {
			continue
		}

		// If the file type is unknown and needs to be retrieved, pass MIME type detection
		if file.FileType == "" || (file.Source.IsURL() && shouldFetchFiles) {
			// Note: Here we call LoadFileSource directly instead of GetMimeType
			// Because GetMimeType may internally call GetFileTypeFromUrl (HEAD request)
			// Since we want to calculate token here, we usually need complete data
			cachedData, err := LoadFileSource(c, file.Source, "token_counter")
			if err != nil {
				if shouldFetchFiles {
					return 0, fmt.Errorf("error getting file type: %v", err)
				}
				continue
			}
			file.FileType = DetectFileType(cachedData.MimeType)
		}
	}

	for i, file := range meta.Files {
		switch file.FileType {
		case types.FileTypeImage:
			token, err := getImageToken(c, file, model, info.IsStream)
			if err != nil {
				return 0, fmt.Errorf("error counting image token, media index[%d], identifier[%s], err: %v", i, file.GetIdentifier(), err)
			}
			tkm += token
		case types.FileTypeAudio:
			tkm += 256
		case types.FileTypeVideo:
			tkm += 4096 * 2
		case types.FileTypeFile:
			tkm += 4096
		default:
			tkm += 4096 // Default case for unknown file types
		}
	}

	common.SetContextKey(c, constant.ContextKeyPromptTokens, tkm)
	return tkm, nil
}

func CountTokenRealtime(info *relaycommon.RelayInfo, request dto.RealtimeEvent, model string) (int, int, error) {
	audioToken := 0
	textToken := 0
	switch request.Type {
	case dto.RealtimeEventTypeSessionUpdate:
		if request.Session != nil {
			msgTokens := tokenkit.Count(model, request.Session.Instructions)
			textToken += msgTokens
		}
	case dto.RealtimeEventResponseAudioDelta:
		// count audio token
		atk, err := CountAudioTokenOutput(request.Delta, info.OutputAudioFormat)
		if err != nil {
			return 0, 0, fmt.Errorf("error counting audio token: %v", err)
		}
		audioToken += atk
	case dto.RealtimeEventResponseAudioTranscriptionDelta, dto.RealtimeEventResponseFunctionCallArgumentsDelta:
		// count text token
		tkm := tokenkit.Count(model, request.Delta)
		textToken += tkm
	case dto.RealtimeEventInputAudioBufferAppend:
		// count audio token
		atk, err := CountAudioTokenInput(request.Audio, info.InputAudioFormat)
		if err != nil {
			return 0, 0, fmt.Errorf("error counting audio token: %v", err)
		}
		audioToken += atk
	case dto.RealtimeEventConversationItemCreated:
		if request.Item != nil {
			switch request.Item.Type {
			case "message":
				for _, content := range request.Item.Content {
					if content.Type == "input_text" {
						tokens := tokenkit.Count(model, content.Text)
						textToken += tokens
					}
				}
			}
		}
	case dto.RealtimeEventTypeResponseDone:
		// count tools token
		if !info.IsFirstRequest {
			if info.RealtimeTools != nil && len(info.RealtimeTools) > 0 {
				for _, tool := range info.RealtimeTools {
					toolTokens := CountTokenInput(tool, model)
					textToken += 8
					textToken += toolTokens
				}
			}
		}
	}
	return textToken, audioToken, nil
}

func CountTokenInput(input any, model string) int {
	switch v := input.(type) {
	case string:
		return tokenkit.Count(model, v)
	case []string:
		var text strings.Builder
		for _, s := range v {
			text.WriteString(s)
		}
		return tokenkit.Count(model, text.String())
	case []any:
		var text strings.Builder
		for _, item := range v {
			text.WriteString(fmt.Sprintf("%v", item))
		}
		return tokenkit.Count(model, text.String())
	}
	return CountTokenInput(fmt.Sprintf("%v", input), model)
}

func CountAudioTokenInput(audioBase64 string, audioFormat string) (int, error) {
	if audioBase64 == "" {
		return 0, nil
	}
	duration, err := parseAudio(audioBase64, audioFormat)
	if err != nil {
		return 0, err
	}
	// duration comes from user-supplied audio metadata, saturation conversion prevents int wraparound
	return common.QuotaFromFloat(duration / 60 * 100 / 0.06), nil
}

func CountAudioTokenOutput(audioBase64 string, audioFormat string) (int, error) {
	if audioBase64 == "" {
		return 0, nil
	}
	duration, err := parseAudio(audioBase64, audioFormat)
	if err != nil {
		return 0, err
	}
	// duration Audio metadata returned from upstream, saturation conversion prevents int wraparound
	return common.QuotaFromFloat(duration / 60 * 200 / 0.24), nil
}
