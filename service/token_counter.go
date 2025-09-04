package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"log"
	"math"
	"one-api/common"
	"one-api/constant"
	"one-api/dto"
	relaycommon "one-api/relay/common"
	"one-api/types"
	"strings"
	"sync"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
	"github.com/tiktoken-go/tokenizer"
	"github.com/tiktoken-go/tokenizer/codec"
)

// tokenEncoderMap won't grow after initialization
var defaultTokenEncoder tokenizer.Codec

// tokenEncoderMap is used to store token encoders for different models
var tokenEncoderMap = make(map[string]tokenizer.Codec)

// tokenEncoderMutex protects tokenEncoderMap for concurrent access
var tokenEncoderMutex sync.RWMutex

func InitTokenEncoders() {
	common.SysLog("initializing token encoders")
	defaultTokenEncoder = codec.NewCl100kBase()
	common.SysLog("token encoders initialized")
}

func getTokenEncoder(model string) tokenizer.Codec {
	// First, try to get the encoder from cache with read lock
	tokenEncoderMutex.RLock()
	if encoder, exists := tokenEncoderMap[model]; exists {
		tokenEncoderMutex.RUnlock()
		return encoder
	}
	tokenEncoderMutex.RUnlock()

	// If not in cache, create new encoder with write lock
	tokenEncoderMutex.Lock()
	defer tokenEncoderMutex.Unlock()

	// Double-check if another goroutine already created the encoder
	if encoder, exists := tokenEncoderMap[model]; exists {
		return encoder
	}

	// Create new encoder
	modelCodec, err := tokenizer.ForModel(tokenizer.Model(model))
	if err != nil {
		// Cache the default encoder for this model to avoid repeated failures
		tokenEncoderMap[model] = defaultTokenEncoder
		return defaultTokenEncoder
	}

	// Cache the new encoder
	tokenEncoderMap[model] = modelCodec
	return modelCodec
}

func getTokenNum(tokenEncoder tokenizer.Codec, text string) int {
	if text == "" {
		return 0
	}
	tkm, _ := tokenEncoder.Count(text)
	return tkm
}

func getImageToken(fileMeta *types.FileMeta, model string, stream bool) (int, error) {
	if fileMeta == nil {
		return 0, fmt.Errorf("image_url_is_nil")
	}

	// Defaults for 4o/4.1/4.5 family unless overridden below
	baseTokens := 85
	tileTokens := 170

	// Model classification
	lowerModel := strings.ToLower(model)

	// Special cases from existing behavior
	if strings.HasPrefix(lowerModel, "glm-4") {
		return 1047, nil
	}

	// Patch-based models (32x32 patches, capped at 1536, with multiplier)
	isPatchBased := false
	multiplier := 1.0
	switch {
	case strings.Contains(lowerModel, "gpt-4.1-mini"):
		isPatchBased = true
		multiplier = 1.62
	case strings.Contains(lowerModel, "gpt-4.1-nano"):
		isPatchBased = true
		multiplier = 2.46
	case strings.HasPrefix(lowerModel, "o4-mini"):
		isPatchBased = true
		multiplier = 1.72
	case strings.HasPrefix(lowerModel, "gpt-5-mini"):
		isPatchBased = true
		multiplier = 1.62
	case strings.HasPrefix(lowerModel, "gpt-5-nano"):
		isPatchBased = true
		multiplier = 2.46
	}

	// Tile-based model tokens and bases per doc
	if !isPatchBased {
		if strings.HasPrefix(lowerModel, "gpt-4o-mini") {
			baseTokens = 2833
			tileTokens = 5667
		} else if strings.HasPrefix(lowerModel, "gpt-5-chat-latest") || (strings.HasPrefix(lowerModel, "gpt-5") && !strings.Contains(lowerModel, "mini") && !strings.Contains(lowerModel, "nano")) {
			baseTokens = 70
			tileTokens = 140
		} else if strings.HasPrefix(lowerModel, "o1") || strings.HasPrefix(lowerModel, "o3") || strings.HasPrefix(lowerModel, "o1-pro") {
			baseTokens = 75
			tileTokens = 150
		} else if strings.Contains(lowerModel, "computer-use-preview") {
			baseTokens = 65
			tileTokens = 129
		} else if strings.Contains(lowerModel, "4.1") || strings.Contains(lowerModel, "4o") || strings.Contains(lowerModel, "4.5") {
			baseTokens = 85
			tileTokens = 170
		}
	}

	// Respect existing feature flags/short-circuits
	if fileMeta.Detail == "low" && !isPatchBased {
		return baseTokens, nil
	}
	if !constant.GetMediaTokenNotStream && !stream {
		return 3 * baseTokens, nil
	}
	// Normalize detail
	if fileMeta.Detail == "auto" || fileMeta.Detail == "" {
		fileMeta.Detail = "high"
	}
	// Whether to count image tokens at all
	if !constant.GetMediaToken {
		return 3 * baseTokens, nil
	}

	// Decode image to get dimensions
	var config image.Config
	var err error
	var format string
	var b64str string

	if fileMeta.ParsedData != nil {
		config, format, b64str, err = DecodeBase64ImageData(fileMeta.ParsedData.Base64Data)
	} else {
		if strings.HasPrefix(fileMeta.OriginData, "http") {
			config, format, err = DecodeUrlImageData(fileMeta.OriginData)
		} else {
			common.SysLog(fmt.Sprintf("decoding image"))
			config, format, b64str, err = DecodeBase64ImageData(fileMeta.OriginData)
		}
		fileMeta.MimeType = format
	}

	if err != nil {
		return 0, err
	}

	if config.Width == 0 || config.Height == 0 {
		// not an image
		if format != "" && b64str != "" {
			// file type
			return 3 * baseTokens, nil
		}
		return 0, errors.New(fmt.Sprintf("fail to decode base64 config: %s", fileMeta.OriginData))
	}

	width := config.Width
	height := config.Height
	log.Printf("format: %s, width: %d, height: %d", format, width, height)

	if isPatchBased {
		// 32x32 patch-based calculation with 1536 cap and model multiplier
		ceilDiv := func(a, b int) int { return (a + b - 1) / b }
		rawPatchesW := ceilDiv(width, 32)
		rawPatchesH := ceilDiv(height, 32)
		rawPatches := rawPatchesW * rawPatchesH
		if rawPatches > 1536 {
			// scale down
			area := float64(width * height)
			r := math.Sqrt(float64(32*32*1536) / area)
			wScaled := float64(width) * r
			hScaled := float64(height) * r
			// adjust to fit whole number of patches after scaling
			adjW := math.Floor(wScaled/32.0) / (wScaled / 32.0)
			adjH := math.Floor(hScaled/32.0) / (hScaled / 32.0)
			adj := math.Min(adjW, adjH)
			if !math.IsNaN(adj) && adj > 0 {
				r = r * adj
			}
			wScaled = float64(width) * r
			hScaled = float64(height) * r
			patchesW := math.Ceil(wScaled / 32.0)
			patchesH := math.Ceil(hScaled / 32.0)
			imageTokens := int(patchesW * patchesH)
			if imageTokens > 1536 {
				imageTokens = 1536
			}
			return int(math.Round(float64(imageTokens) * multiplier)), nil
		}
		// below cap
		imageTokens := rawPatches
		return int(math.Round(float64(imageTokens) * multiplier)), nil
	}

	// Tile-based calculation for 4o/4.1/4.5/o1/o3/etc.
	// Step 1: fit within 2048x2048 square
	maxSide := math.Max(float64(width), float64(height))
	fitScale := 1.0
	if maxSide > 2048 {
		fitScale = maxSide / 2048.0
	}
	fitW := int(math.Round(float64(width) / fitScale))
	fitH := int(math.Round(float64(height) / fitScale))

	// Step 2: scale so that shortest side is exactly 768
	minSide := math.Min(float64(fitW), float64(fitH))
	if minSide == 0 {
		return baseTokens, nil
	}
	shortScale := 768.0 / minSide
	finalW := int(math.Round(float64(fitW) * shortScale))
	finalH := int(math.Round(float64(fitH) * shortScale))

	// Count 512px tiles
	tilesW := (finalW + 512 - 1) / 512
	tilesH := (finalH + 512 - 1) / 512
	tiles := tilesW * tilesH

	if common.DebugEnabled {
		log.Printf("scaled to: %dx%d, tiles: %d", finalW, finalH, tiles)
	}

	return tiles*tileTokens + baseTokens, nil
}

func CountRequestToken(c *gin.Context, meta *types.TokenCountMeta, info *relaycommon.RelayInfo) (int, error) {
	if !constant.GetMediaToken {
		return 0, nil
	}
	if !constant.GetMediaTokenNotStream && !info.IsStream {
		return 0, nil
	}
	if info.RelayFormat == types.RelayFormatOpenAIRealtime {
		return 0, nil
	}
	if meta == nil {
		return 0, errors.New("token count meta is nil")
	}

	model := common.GetContextKeyString(c, constant.ContextKeyOriginalModel)
	tkm := 0

	if meta.TokenType == types.TokenTypeTextNumber {
		tkm += utf8.RuneCountInString(meta.CombineText)
	} else {
		tkm += CountTextToken(meta.CombineText, model)
	}

	if info.RelayFormat == types.RelayFormatOpenAI {
		tkm += meta.ToolsCount * 8
		tkm += meta.MessagesCount * 3 // 每条消息的格式化token数量
		tkm += meta.NameCount * 3
		tkm += 3
	}

	shouldFetchFiles := true

	if info.RelayFormat == types.RelayFormatGemini {
		shouldFetchFiles = false
	}

	if shouldFetchFiles {
		for _, file := range meta.Files {
			if strings.HasPrefix(file.OriginData, "http") {
				mineType, err := GetFileTypeFromUrl(c, file.OriginData, "token_counter")
				if err != nil {
					return 0, fmt.Errorf("error getting file base64 from url: %v", err)
				}
				if strings.HasPrefix(mineType, "image/") {
					file.FileType = types.FileTypeImage
				} else if strings.HasPrefix(mineType, "video/") {
					file.FileType = types.FileTypeVideo
				} else if strings.HasPrefix(mineType, "audio/") {
					file.FileType = types.FileTypeAudio
				} else {
					file.FileType = types.FileTypeFile
				}
				file.MimeType = mineType
			} else if strings.HasPrefix(file.OriginData, "data:") {
				// get mime type from base64 header
				parts := strings.SplitN(file.OriginData, ",", 2)
				if len(parts) >= 1 {
					header := parts[0]
					// Extract mime type from "data:mime/type;base64" format
					if strings.Contains(header, ":") && strings.Contains(header, ";") {
						mimeStart := strings.Index(header, ":") + 1
						mimeEnd := strings.Index(header, ";")
						if mimeStart < mimeEnd {
							mineType := header[mimeStart:mimeEnd]
							if strings.HasPrefix(mineType, "image/") {
								file.FileType = types.FileTypeImage
							} else if strings.HasPrefix(mineType, "video/") {
								file.FileType = types.FileTypeVideo
							} else if strings.HasPrefix(mineType, "audio/") {
								file.FileType = types.FileTypeAudio
							} else {
								file.FileType = types.FileTypeFile
							}
							file.MimeType = mineType
						}
					}
				}
			}
		}
	}

	for i, file := range meta.Files {
		switch file.FileType {
		case types.FileTypeImage:
			if info.RelayFormat == types.RelayFormatGemini && !strings.HasPrefix(model, "gemini-2.5-flash-image-preview") {
				tkm += 256
			} else {
				token, err := getImageToken(file, model, info.IsStream)
				if err != nil {
					return 0, fmt.Errorf("error counting image token, media index[%d], original data[%s], err: %v", i, file.OriginData, err)
				}
				tkm += token
			}
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

func CountTokenClaudeRequest(request dto.ClaudeRequest, model string) (int, error) {
	tkm := 0

	// Count tokens in messages
	msgTokens, err := CountTokenClaudeMessages(request.Messages, model, request.Stream)
	if err != nil {
		return 0, err
	}
	tkm += msgTokens

	// Count tokens in system message
	if request.System != "" {
		systemTokens := CountTokenInput(request.System, model)
		tkm += systemTokens
	}

	if request.Tools != nil {
		// check is array
		if tools, ok := request.Tools.([]any); ok {
			if len(tools) > 0 {
				parsedTools, err1 := common.Any2Type[[]dto.Tool](request.Tools)
				if err1 != nil {
					return 0, fmt.Errorf("tools: Input should be a valid list: %v", err)
				}
				toolTokens, err2 := CountTokenClaudeTools(parsedTools, model)
				if err2 != nil {
					return 0, fmt.Errorf("tools: %v", err)
				}
				tkm += toolTokens
			}
		} else {
			return 0, errors.New("tools: Input should be a valid list")
		}
	}

	return tkm, nil
}

func CountTokenClaudeMessages(messages []dto.ClaudeMessage, model string, stream bool) (int, error) {
	tokenEncoder := getTokenEncoder(model)
	tokenNum := 0

	for _, message := range messages {
		// Count tokens for role
		tokenNum += getTokenNum(tokenEncoder, message.Role)
		if message.IsStringContent() {
			tokenNum += getTokenNum(tokenEncoder, message.GetStringContent())
		} else {
			content, err := message.ParseContent()
			if err != nil {
				return 0, err
			}
			for _, mediaMessage := range content {
				switch mediaMessage.Type {
				case "text":
					tokenNum += getTokenNum(tokenEncoder, mediaMessage.GetText())
				case "image":
					//imageTokenNum, err := getClaudeImageToken(mediaMsg.Source, model, stream)
					//if err != nil {
					//	return 0, err
					//}
					tokenNum += 1000
				case "tool_use":
					if mediaMessage.Input != nil {
						tokenNum += getTokenNum(tokenEncoder, mediaMessage.Name)
						inputJSON, _ := json.Marshal(mediaMessage.Input)
						tokenNum += getTokenNum(tokenEncoder, string(inputJSON))
					}
				case "tool_result":
					if mediaMessage.Content != nil {
						contentJSON, _ := json.Marshal(mediaMessage.Content)
						tokenNum += getTokenNum(tokenEncoder, string(contentJSON))
					}
				}
			}
		}
	}

	// Add a constant for message formatting (this may need adjustment based on Claude's exact formatting)
	tokenNum += len(messages) * 2 // Assuming 2 tokens per message for formatting

	return tokenNum, nil
}

func CountTokenClaudeTools(tools []dto.Tool, model string) (int, error) {
	tokenEncoder := getTokenEncoder(model)
	tokenNum := 0

	for _, tool := range tools {
		tokenNum += getTokenNum(tokenEncoder, tool.Name)
		tokenNum += getTokenNum(tokenEncoder, tool.Description)

		schemaJSON, err := json.Marshal(tool.InputSchema)
		if err != nil {
			return 0, errors.New(fmt.Sprintf("marshal_tool_schema_fail: %s", err.Error()))
		}
		tokenNum += getTokenNum(tokenEncoder, string(schemaJSON))
	}

	// Add a constant for tool formatting (this may need adjustment based on Claude's exact formatting)
	tokenNum += len(tools) * 3 // Assuming 3 tokens per tool for formatting

	return tokenNum, nil
}

func CountTokenRealtime(info *relaycommon.RelayInfo, request dto.RealtimeEvent, model string) (int, int, error) {
	audioToken := 0
	textToken := 0
	switch request.Type {
	case dto.RealtimeEventTypeSessionUpdate:
		if request.Session != nil {
			msgTokens := CountTextToken(request.Session.Instructions, model)
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
		tkm := CountTextToken(request.Delta, model)
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
						tokens := CountTextToken(content.Text, model)
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
		return CountTextToken(v, model)
	case []string:
		text := ""
		for _, s := range v {
			text += s
		}
		return CountTextToken(text, model)
	case []interface{}:
		text := ""
		for _, item := range v {
			text += fmt.Sprintf("%v", item)
		}
		return CountTextToken(text, model)
	}
	return CountTokenInput(fmt.Sprintf("%v", input), model)
}

func CountTokenStreamChoices(messages []dto.ChatCompletionsStreamResponseChoice, model string) int {
	tokens := 0
	for _, message := range messages {
		tkm := CountTokenInput(message.Delta.GetContentString(), model)
		tokens += tkm
		if message.Delta.ToolCalls != nil {
			for _, tool := range message.Delta.ToolCalls {
				tkm := CountTokenInput(tool.Function.Name, model)
				tokens += tkm
				tkm = CountTokenInput(tool.Function.Arguments, model)
				tokens += tkm
			}
		}
	}
	return tokens
}

func CountTTSToken(text string, model string) int {
	if strings.HasPrefix(model, "tts") {
		return utf8.RuneCountInString(text)
	} else {
		return CountTextToken(text, model)
	}
}

func CountAudioTokenInput(audioBase64 string, audioFormat string) (int, error) {
	if audioBase64 == "" {
		return 0, nil
	}
	duration, err := parseAudio(audioBase64, audioFormat)
	if err != nil {
		return 0, err
	}
	return int(duration / 60 * 100 / 0.06), nil
}

func CountAudioTokenOutput(audioBase64 string, audioFormat string) (int, error) {
	if audioBase64 == "" {
		return 0, nil
	}
	duration, err := parseAudio(audioBase64, audioFormat)
	if err != nil {
		return 0, err
	}
	return int(duration / 60 * 200 / 0.24), nil
}

//func CountAudioToken(sec float64, audioType string) {
//	if audioType == "input" {
//
//	}
//}

// CountTextToken 统计文本的token数量，仅当文本包含敏感词，返回错误，同时返回token数量
func CountTextToken(text string, model string) int {
	if text == "" {
		return 0
	}
	tokenEncoder := getTokenEncoder(model)
	return getTokenNum(tokenEncoder, text)
}
