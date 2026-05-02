package xiaomi

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

type xiaomiTTSMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type xiaomiTTSAudio struct {
	Voice  string `json:"voice"`
	Format string `json:"format"`
}

type xiaomiTTSRequest struct {
	Model    string             `json:"model"`
	Messages []xiaomiTTSMessage `json:"messages"`
	Audio    xiaomiTTSAudio     `json:"audio"`
}

type xiaomiTTSResponse struct {
	Choices []struct {
		Message struct {
			Audio struct {
				Data string `json:"data"`
			} `json:"audio"`
		} `json:"message"`
	} `json:"choices"`
	Usage dto.Usage `json:"usage"`
}

func convertTTSRequest(c *gin.Context, request dto.AudioRequest) (io.Reader, error) {
	audioFormat := normalizeMimoAudioFormat(request.ResponseFormat)
	c.Set(contextKeyAudioFormat, audioFormat)

	voice := request.Voice
	if voice == "" {
		voice = defaultMimoVoice
	}

	messages := make([]xiaomiTTSMessage, 0, 2)
	if request.Instructions != "" {
		messages = append(messages, xiaomiTTSMessage{Role: "user", Content: request.Instructions})
	}
	messages = append(messages, xiaomiTTSMessage{Role: "assistant", Content: request.Input})

	jsonData, err := common.Marshal(xiaomiTTSRequest{
		Model:    request.Model,
		Messages: messages,
		Audio:    xiaomiTTSAudio{Voice: voice, Format: audioFormat},
	})
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(jsonData), nil
}

func normalizeMimoAudioFormat(format string) string {
	switch format {
	case "":
		return "wav"
	case "pcm":
		return "pcm16"
	default:
		return format
	}
}

func getTTSContentType(format string) string {
	switch format {
	case "mp3":
		return "audio/mpeg"
	case "pcm", "pcm16":
		return "audio/pcm"
	default:
		return "audio/wav"
	}
}

func handleTTSResponse(c *gin.Context, resp *http.Response, _ *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("invalid xiaomi TTS response"),
			types.ErrorCodeBadResponse,
			http.StatusInternalServerError,
		)
	}
	defer resp.Body.Close()
	audioFormat := c.GetString(contextKeyAudioFormat)
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("read xiaomi TTS response: %w", err),
			types.ErrorCodeReadResponseBodyFailed,
			http.StatusInternalServerError,
		)
	}

	var ttsResp xiaomiTTSResponse
	if err := common.Unmarshal(body, &ttsResp); err != nil {
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("unmarshal xiaomi TTS response: %w", err),
			types.ErrorCodeBadResponseBody,
			http.StatusBadGateway,
		)
	}

	if len(ttsResp.Choices) == 0 || ttsResp.Choices[0].Message.Audio.Data == "" {
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("xiaomi TTS response missing audio data"),
			types.ErrorCodeBadResponse,
			http.StatusBadGateway,
		)
	}

	audioData, err := base64.StdEncoding.DecodeString(ttsResp.Choices[0].Message.Audio.Data)
	if err != nil {
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("decode xiaomi TTS audio payload: %w", err),
			types.ErrorCodeBadResponse,
			http.StatusBadGateway,
		)
	}

	c.Data(http.StatusOK, getTTSContentType(audioFormat), audioData)

	return &ttsResp.Usage, nil
}
