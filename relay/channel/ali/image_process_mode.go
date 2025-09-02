package ali

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"one-api/common"
	"one-api/dto"
	relaycommon "one-api/relay/common"
	"one-api/service"
	"one-api/types"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

// detectImageMimeType determines the MIME type based on the file extension
func detectImageMimeType(filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".webp":
		return "image/webp"
	default:
		// Try to detect from extension if possible
		if strings.HasPrefix(ext, ".jp") {
			return "image/jpeg"
		}
		// Default to png as a fallback
		return "image/png"
	}
}

func indexOfAnySubStr(str string, substrs ...string) int {
	if str == "" || len(substrs) == 0 {
		return -1
	}

	for _, substr := range substrs {
		if substr == "" {
			continue
		}
		if index := strings.Index(str, substr); index > -1 {
			return index
		}
	}
	return -1
}

func getFormImages(c *gin.Context) ([]string, int) {
	var imageContents []string
	var imageFiles []*multipart.FileHeader
	var exists bool

	// 先检查标准 "image" 字段
	if imageFiles, exists = c.Request.MultipartForm.File["image"]; !exists || len(imageFiles) == 0 {
		// 如果没有找到，检查 "image[]" 字段
		if imageFiles, exists = c.Request.MultipartForm.File["image[]"]; !exists || len(imageFiles) == 0 {
			// 如果还是没找到，尝试查找任何以 "image[" 开头的字段
			foundArrayImages := false
			for fieldName, files := range c.Request.MultipartForm.File {
				if strings.HasPrefix(fieldName, "image[") && len(files) > 0 {
					foundArrayImages = true
					for _, file := range files {
						imageFiles = append(imageFiles, file)
					}
				}
			}

			// 如果仍然没有找到图像文件
			if !foundArrayImages && (len(imageFiles) == 0) {
				// 尝试从PostForm中获取图像数据（如果有的话）
				if imageValue := c.PostForm("image"); imageValue != "" {
					imageContents = append(imageContents, imageValue)
				}
			}
		}
	}

	// 处理所有图像文件
	if len(imageFiles) > 0 {
		for i, fileHeader := range imageFiles {
			file, err := fileHeader.Open()
			if err != nil {
				common.SysError(fmt.Sprintf("failed to open image file %d: %v", i, err))
				continue
			}
			defer file.Close()

			// 读取文件内容
			fileBytes, err := io.ReadAll(file)
			if err != nil {
				common.SysError(fmt.Sprintf("failed to read image file %d: %v", i, err))
				continue
			}

			// 确定MIME类型
			mimeType := detectImageMimeType(fileHeader.Filename)

			// 转换为base64
			base64Data := base64.StdEncoding.EncodeToString(fileBytes)
			dataURL := fmt.Sprintf("data:%s;base64,%s", mimeType, base64Data)
			imageContents = append(imageContents, dataURL)
		}
	}
	return imageContents, len(imageContents)
}

func getFormMarkImage(c *gin.Context) (string, bool) {
	var imageFiles []*multipart.FileHeader
	var exists bool
	if imageFiles, exists = c.Request.MultipartForm.File["mask"]; !exists || len(imageFiles) == 0 {
		for i, fileHeader := range imageFiles {
			file, err := fileHeader.Open()
			if err != nil {
				common.SysError(fmt.Sprintf("failed to open image file %d: %v", i, err))
				continue
			}
			defer file.Close()

			// 读取文件内容
			fileBytes, err := io.ReadAll(file)
			if err != nil {
				common.SysError(fmt.Sprintf("failed to read image file %d: %v", i, err))
				continue
			}

			// 确定MIME类型
			mimeType := detectImageMimeType(fileHeader.Filename)

			// 转换为base64
			base64Data := base64.StdEncoding.EncodeToString(fileBytes)
			dataURL := fmt.Sprintf("data:%s;base64,%s", mimeType, base64Data)
			return dataURL, true
		}
	}
	return "", false
}

type ImageProcessMode struct {
	Url             string
	Async           bool
	ProcessRequest  func(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error)
	ProcessResponse func(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*types.NewAPIError, *dto.Usage)
}

func text2ImageMode() *ImageProcessMode {
	return &ImageProcessMode{
		Url:   "/api/v1/services/aigc/text2image/image-synthesis",
		Async: true,
	}
}
func multimoalGenerationMode() *ImageProcessMode {
	return &ImageProcessMode{
		Url:   "/api/v1/services/aigc/multimodal-generation/generation",
		Async: false,
		ProcessRequest: func(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
			// 解析multipart表单
			if err := c.Request.ParseMultipartForm(32 << 20); err != nil { // 32MB max memory
				return nil, err
			}

			imageContents, _ := getFormImages(c)

			// 构建消息内容
			content := []any{}

			// 添加图像内容
			for _, imageData := range imageContents {
				content = append(content, AliImageMessageItem{
					Image: imageData,
				})
			}

			// 添加文本内容
			content = append(content, AliTextMessageItem{
				Text: request.Prompt,
			})

			return &AliMultimodelGenerationRequest{
				Model: request.Model,
				Input: AliInput{
					Messages: []AliMessage{
						{
							Role:    "user",
							Content: content,
						},
					},
				},
			}, nil
		},
		ProcessResponse: func(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*types.NewAPIError, *dto.Usage) {
			respsonseBody, err := io.ReadAll(resp.Body)
			if err != nil {
				return types.NewError(err, types.ErrorCodeReadResponseBodyFailed), nil
			}
			service.CloseResponseBodyGracefully(resp)
			var multimoalGenerationResp AliMultimodelGenerationResponse
			if err := json.Unmarshal(respsonseBody, &multimoalGenerationResp); err != nil {
				return types.NewError(err, types.ErrorCodeBadResponseBody), nil
			}
			if multimoalGenerationResp.Code != "" {
				return types.WithOpenAIError(types.OpenAIError{
					Message: multimoalGenerationResp.Message,
					Code:    multimoalGenerationResp.Code,
					Type:    "ali_error",
					Param:   "",
				}, resp.StatusCode), nil
			}
			responseFormat := c.GetString("response_format")
			usage := multimoalGenerationResp.Usage
			results := make([]TaskResult, 0, len(multimoalGenerationResp.Output.Choices))
			for _, choice := range multimoalGenerationResp.Output.Choices {
				for _, content := range choice.Message.Content {
					results = append(results, TaskResult{
						B64Image: "",
						Url:      content.Image,
						Code:     "",
						Message:  "",
					})

				}
			}

			fullTextResponse := responseAli2OpenAIImage(c, &AliResponse{
				Output: AliOutput{
					TaskId:       multimoalGenerationResp.RequestId,
					TaskStatus:   "SUCCEEDED",
					Text:         "",
					FinishReason: "",
					Message:      multimoalGenerationResp.Message,
					Code:         multimoalGenerationResp.Code,
					Results:      results,
				},
				Usage: AliUsage{
					InputTokens:  usage.InputTokens,
					OutputTokens: usage.OutputTokens,
					TotalTokens:  usage.InputTokens + usage.OutputTokens,
				},
			}, respsonseBody, info, responseFormat)

			jsonResponse, err := marshalWithoutHTMLEscape(fullTextResponse)
			if err != nil {
				return types.NewError(err, types.ErrorCodeBadResponseBody), nil
			}
			c.Writer.Header().Set("Content-Type", "application/json")
			c.Writer.WriteHeader(resp.StatusCode)
			c.Writer.Write(jsonResponse)
			return nil, &dto.Usage{}
		},
	}
}

func image2ImageMode() *ImageProcessMode {
	return &ImageProcessMode{
		Url:   "/api/v1/services/aigc/image2image/image-synthesis",
		Async: true,
		ProcessRequest: func(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
			// 解析multipart表单
			if err := c.Request.ParseMultipartForm(32 << 20); err != nil { // 32MB max memory
				return nil, err
			}
			imageContents, size := getFormImages(c)
			if size == 0 {
				return nil, errors.New("image is required")
			}
			maskImageContent, exists := getFormMarkImage(c)
			if strings.Contains(request.Model, "sketch") {
				return &AliImage2ImageImageSynthesisRequest{
					Model: request.Model,
					Input: struct {
						Prompt         string `json:"prompt,omitempty"`
						Function       string `json:"function,omitempty"`
						BaseImageUrl   string `json:"base_image_url,omitempty"`
						MaskImageUrl   string `json:"mask_image_url,omitempty"`
						SketchImageUrl string `json:"sketch_image_url,omitempty"`
					}{
						Prompt:         request.Prompt,
						SketchImageUrl: imageContents[0],
					},
					Parameters: struct {
						N    uint   `json:"n,omitempty"`
						Size string `json:"size,omitempty"`
					}{
						N:    request.N,
						Size: strings.Replace(request.Size, "x", "*", -1),
					},
				}, nil
			} else if exists {
				return &AliImage2ImageImageSynthesisRequest{
					Model: request.Model,
					Input: struct {
						Prompt         string `json:"prompt,omitempty"`
						Function       string `json:"function,omitempty"`
						BaseImageUrl   string `json:"base_image_url,omitempty"`
						MaskImageUrl   string `json:"mask_image_url,omitempty"`
						SketchImageUrl string `json:"sketch_image_url,omitempty"`
					}{
						Prompt:       request.Prompt,
						Function:     "description_edit_with_mask",
						BaseImageUrl: imageContents[0],
						MaskImageUrl: maskImageContent,
					},
					Parameters: struct {
						N    uint   `json:"n,omitempty"`
						Size string `json:"size,omitempty"`
					}{
						N: request.N,
					},
				}, nil
			} else {

				return &AliImage2ImageImageSynthesisRequest{
					Model: request.Model,
					Input: struct {
						Prompt         string `json:"prompt,omitempty"`
						Function       string `json:"function,omitempty"`
						BaseImageUrl   string `json:"base_image_url,omitempty"`
						MaskImageUrl   string `json:"mask_image_url,omitempty"`
						SketchImageUrl string `json:"sketch_image_url,omitempty"`
					}{
						Prompt:       request.Prompt,
						Function:     "description_edit",
						BaseImageUrl: imageContents[0],
					},
					Parameters: struct {
						N    uint   `json:"n,omitempty"`
						Size string `json:"size,omitempty"`
					}{
						N: request.N,
					},
				}, nil
			}
		},
	}
}
func imageGenerationMode() *ImageProcessMode {
	return &ImageProcessMode{
		Url:   "/api/v1/services/aigc/image-generation/generation",
		Async: true,
	}
}
