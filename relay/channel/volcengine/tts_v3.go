package volcengine

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	channelconstant "github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

const (
	openSpeechTTSV3DefaultURL = "https://openspeech.bytedance.com/api/v3/tts/unidirectional"
	defaultTTSV3ResourceID    = "seed-tts-2.0"
)

type volcengineAudioSpeechMetadata struct {
	ResourceID string `json:"resource_id,omitempty"`
}

type volcengineTTSV3Request struct {
	User      volcengineTTSV3User      `json:"user"`
	ReqParams volcengineTTSV3ReqParams `json:"req_params"`
}

type volcengineTTSV3User struct {
	UID string `json:"uid"`
}

type volcengineTTSV3ReqParams struct {
	Text        string                   `json:"text"`
	Speaker     string                   `json:"speaker"`
	AudioParams volcengineTTSV3AudioParams `json:"audio_params"`
}

type volcengineTTSV3AudioParams struct {
	Format     string `json:"format"`
	SampleRate int    `json:"sample_rate"`
}

var utf8BOM = []byte{0xEF, 0xBB, 0xBF}

func isOpenSpeechTTSV3Base(baseURL string) bool {
	baseURL = strings.TrimSpace(baseURL)
	if baseURL == "" {
		return false
	}
	lower := strings.ToLower(baseURL)
	if strings.HasPrefix(lower, "http") && strings.Contains(lower, "/api/v3/tts/unidirectional") {
		return true
	}
	return strings.EqualFold(baseURL, channelconstant.VolcEngineOpenSpeechTTSV3BaseURL)
}

func mapEncodingToTTSV3Format(encoding string) string {
	switch encoding {
	case "ogg_opus":
		return "mp3"
	case "pcm":
		return "pcm"
	case "wav":
		return "wav"
	default:
		return "mp3"
	}
}

func parseTTSV3ResourceID(metadata []byte) string {
	if len(metadata) == 0 {
		return defaultTTSV3ResourceID
	}
	var meta volcengineAudioSpeechMetadata
	if err := common.Unmarshal(metadata, &meta); err != nil || strings.TrimSpace(meta.ResourceID) == "" {
		return defaultTTSV3ResourceID
	}
	return strings.TrimSpace(meta.ResourceID)
}

func buildTTSV3RequestBody(text, speaker, encoding string) ([]byte, error) {
	req := volcengineTTSV3Request{
		User: volcengineTTSV3User{
			UID: "openai_relay_user",
		},
		ReqParams: volcengineTTSV3ReqParams{
			Text:    text,
			Speaker: speaker,
			AudioParams: volcengineTTSV3AudioParams{
				Format:     mapEncodingToTTSV3Format(encoding),
				SampleRate: 24000,
			},
		},
	}
	return common.Marshal(req)
}

func normalizeNdjsonLine(line string) string {
	line = strings.TrimSpace(line)
	if line == "" {
		return ""
	}
	// 兼容 SSE 风格行
	if strings.HasPrefix(strings.ToLower(line), "data:") {
		line = strings.TrimSpace(line[5:])
		if strings.HasPrefix(line, "[DONE]") {
			return ""
		}
	}
	return line
}

func parseNdjsonLineCodeAndData(line string) (code int, hasCode bool, dataStr string, err error) {
	var m map[string]json.RawMessage
	if err = common.UnmarshalJsonStr(line, &m); err != nil {
		return 0, false, "", err
	}
	rawCode, ok := m["code"]
	if !ok || len(rawCode) == 0 {
		return 0, false, "", nil
	}
	// 兼容 JSON number 为整数或小数
	var f float64
	if err = common.Unmarshal(rawCode, &f); err == nil {
		return int(f), true, extractDataString(m["data"]), nil
	}
	var s string
	if err = common.Unmarshal(rawCode, &s); err != nil {
		return 0, false, "", fmt.Errorf("openspeech v3 line code: %w", err)
	}
	n, convErr := strconv.Atoi(strings.TrimSpace(s))
	if convErr != nil {
		return 0, false, "", fmt.Errorf("openspeech v3 line code string: %w", convErr)
	}
	return n, true, extractDataString(m["data"]), nil
}

func extractDataString(raw json.RawMessage) string {
	if len(raw) == 0 || string(raw) == "null" {
		return ""
	}
	var s string
	if err := common.Unmarshal(raw, &s); err == nil {
		return strings.TrimSpace(s)
	}
	return ""
}

func decodeBase64AudioPayload(s string) ([]byte, error) {
	s = strings.TrimSpace(strings.ReplaceAll(s, "\n", ""))
	if s == "" {
		return nil, errors.New("empty payload")
	}
	if b, err := base64.StdEncoding.DecodeString(s); err == nil {
		return b, nil
	}
	return base64.RawURLEncoding.DecodeString(s)
}

func looksLikeJSONObject(b []byte) bool {
	b = bytes.TrimSpace(b)
	return len(b) >= 2 && b[0] == '{' && b[len(b)-1] == '}'
}

func handleTTSV3NdjsonResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo, encoding string) (usage any, err *types.NewAPIError) {
	if resp == nil {
		return nil, types.NewErrorWithStatusCode(
			errors.New("empty upstream response"),
			types.ErrorCodeBadResponseBody,
			http.StatusInternalServerError,
		)
	}
	defer resp.Body.Close()

	body, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("failed to read openspeech v3 response: %w", readErr),
			types.ErrorCodeReadResponseBodyFailed,
			http.StatusInternalServerError,
		)
	}

	if resp.StatusCode != http.StatusOK {
		msg := string(body)
		if len(msg) > 800 {
			msg = msg[:800] + "..."
		}
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("openspeech v3 HTTP %d: %s", resp.StatusCode, msg),
			types.ErrorCodeBadResponseStatusCode,
			http.StatusBadGateway,
		)
	}

	body = bytes.TrimPrefix(body, utf8BOM)

	var chunks [][]byte
	for _, line := range strings.Split(string(body), "\n") {
		line = normalizeNdjsonLine(line)
		if line == "" {
			continue
		}
		code, hasCode, dataStr, lineErr := parseNdjsonLineCodeAndData(line)
		if lineErr != nil {
			return nil, types.NewErrorWithStatusCode(
				fmt.Errorf("openspeech v3 non-JSON line: %w", lineErr),
				types.ErrorCodeBadResponseBody,
				http.StatusBadGateway,
			)
		}
		if !hasCode {
			continue
		}
		switch code {
		case 0:
			if dataStr != "" {
				audioChunk, decodeErr := decodeBase64AudioPayload(dataStr)
				if decodeErr != nil {
					return nil, types.NewErrorWithStatusCode(
						fmt.Errorf("openspeech v3 invalid base64 audio: %w", decodeErr),
						types.ErrorCodeBadResponseBody,
						http.StatusBadGateway,
					)
				}
				if looksLikeJSONObject(audioChunk) {
					return nil, types.NewErrorWithStatusCode(
						fmt.Errorf("openspeech v3 audio chunk looks like JSON (upstream error?): %s", truncateForErr(string(audioChunk), 500)),
						types.ErrorCodeBadResponse,
						http.StatusBadGateway,
					)
				}
				chunks = append(chunks, audioChunk)
			}
		case 20000000:
			goto done
		default:
			return nil, types.NewErrorWithStatusCode(
				fmt.Errorf("openspeech v3 error code=%d line=%s", code, truncateForErr(line, 400)),
				types.ErrorCodeBadResponse,
				http.StatusBadGateway,
			)
		}
	}
done:
	if len(chunks) == 0 {
		preview := string(body)
		if len(preview) > 500 {
			preview = preview[:500] + "..."
		}
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("openspeech v3: no audio chunks in response: %s", preview),
			types.ErrorCodeBadResponseBody,
			http.StatusBadGateway,
		)
	}

	var out []byte
	for _, p := range chunks {
		out = append(out, p...)
	}

	upstreamFmt := mapEncodingToTTSV3Format(encoding)
	trimOut := bytes.TrimSpace(out)
	if upstreamFmt == "mp3" && len(trimOut) > 0 && trimOut[0] == '{' {
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("openspeech v3: concatenated body looks like JSON, not binary audio (常见原因：HTTP 错误 JSON 被保存为 .mp3；Windows 请使用 curl.exe 并加 -w \"%%{http_code}\")： %s", truncateForErr(string(trimOut), 600)),
			types.ErrorCodeBadResponseBody,
			http.StatusBadGateway,
		)
	}
	contentType := getContentTypeByEncoding(upstreamFmt)
	c.Header("Content-Type", contentType)
	c.Data(http.StatusOK, contentType, out)

	usage = &dto.Usage{
		PromptTokens:     info.GetEstimatePromptTokens(),
		CompletionTokens: 0,
		TotalTokens:      info.GetEstimatePromptTokens(),
	}
	return usage, nil
}

func truncateForErr(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "..."
}
