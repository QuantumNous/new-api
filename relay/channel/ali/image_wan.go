package ali

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
)

func oaiImageGen2QwenImageGen(c *gin.Context, _ *relaycommon.RelayInfo, request dto.ImageRequest) (*QwenImageRequest, error) {
	imageRequest := QwenImageRequest{
		Model: request.Model,
		Input: QwenImageInput{
			Messages: []QwenImageInputMessage{
				{
					Role: "user",
					Content: []QwenImageInputMessageContent{
						{
							Text: request.Prompt,
						},
					},
				},
			},
		},
		Parameters: QwenImageParameters{
			NegativePrompt: "低分辨率，低画质，肢体畸形，手指畸形，画面过饱和，蜡像感，人脸无细节，过度光滑，画面具有AI感。构图混乱。文字模糊，扭曲。",
			PromptExtend:   true,
			Watermark:      false,
			Size:           request.Size,
		},
	}

	imageRequestBytes, _ := json.Marshal(imageRequest)
	logger.LogInfo(c, fmt.Sprintf("oaiImageGen2QwenImageGen %s body: %v", request.Model, string(imageRequestBytes)))
	return &imageRequest, nil
}

func oaiFormEdit2WanxImageEdit(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (*AliImageRequest, error) {
	var err error
	var imageRequest AliImageRequest
	imageRequest.Model = request.Model
	imageRequest.ResponseFormat = request.ResponseFormat
	wanInput := WanImageInput{
		Prompt: request.Prompt,
	}

	if err := common.UnmarshalBodyReusable(c, &wanInput); err != nil {
		return nil, err
	}
	if wanInput.Images, err = getImageBase64sFromForm(c, "image"); err != nil {
		return nil, fmt.Errorf("get image base64s from form failed: %w", err)
	}
	wanParams := WanImageParameters{
		N: int(request.N),
	}
	imageRequest.Input = wanInput
	imageRequest.Parameters = wanParams
	logger.LogInfo(c, fmt.Sprintf("oaiFormEdit2WanxImageEdit %s", request.Model))
	return &imageRequest, nil
}

func isWanModel(modelName string) bool {
	return strings.Contains(modelName, "wan")
}

func isQWENImageModel(modelName string) bool {
	if isWanModel(modelName) {
		return false
	}

	return strings.Contains(modelName, "qwen") && strings.Contains(modelName, "image")
}
