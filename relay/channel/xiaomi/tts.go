package xiaomi

import (
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

type mimoTTSResponse struct {
	Choices []struct {
		Message struct {
			Audio struct {
				Data string `json:"data"`
			} `json:"audio"`
		} `json:"message"`
	} `json:"choices"`
	Usage dto.Usage `json:"usage"`
}

func getTTSContentType(format string) string {
	switch format {
	case "wav":
		return "audio/wav"
	case "mp3":
		return "audio/mpeg"
	case "pcm", "pcm16":
		return "audio/pcm"
	case "flac":
		return "audio/flac"
	case "opus":
		return "audio/opus"
	case "aac":
		return "audio/aac"
	default:
		return "audio/wav"
	}
}

func handleTTSResponse(c *gin.Context, resp *http.Response, _ *relaycommon.RelayInfo, audioFormat string) (usage any, err *types.NewAPIError) {
	defer resp.Body.Close()
	body, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("failed to read xiaomi TTS response: %w", readErr),
			types.ErrorCodeReadResponseBodyFailed,
			http.StatusInternalServerError,
		)
	}

	var mimoResp mimoTTSResponse
	if unmarshalErr := common.Unmarshal(body, &mimoResp); unmarshalErr != nil {
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("failed to unmarshal xiaomi TTS response: %w", unmarshalErr),
			types.ErrorCodeBadResponseBody,
			http.StatusInternalServerError,
		)
	}

	if len(mimoResp.Choices) == 0 || mimoResp.Choices[0].Message.Audio.Data == "" {
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("no audio data in xiaomi TTS response"),
			types.ErrorCodeBadResponse,
			http.StatusBadRequest,
		)
	}

	audioData, decodeErr := base64.StdEncoding.DecodeString(mimoResp.Choices[0].Message.Audio.Data)
	if decodeErr != nil {
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("failed to decode base64 audio data: %w", decodeErr),
			types.ErrorCodeBadResponse,
			http.StatusInternalServerError,
		)
	}

	contentType := getTTSContentType(audioFormat)
	c.Data(http.StatusOK, contentType, audioData)

	usage = &dto.Usage{
		PromptTokens:     mimoResp.Usage.PromptTokens,
		CompletionTokens: mimoResp.Usage.CompletionTokens,
		TotalTokens:      mimoResp.Usage.TotalTokens,
	}

	return usage, nil
}
