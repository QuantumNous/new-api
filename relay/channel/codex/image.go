package codex

import (
	"bufio"
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

const ginKeyCodexImageResponseFormat = "codex_image_response_format"

type imageCallResult struct {
	Result        string
	RevisedPrompt string
	OutputFormat  string
	Size          string
	Background    string
	Quality       string
}

func isCodexImageRelayMode(info *relaycommon.RelayInfo) bool {
	if info == nil {
		return false
	}
	return info.RelayMode == relayconstant.RelayModeImagesGenerations ||
		info.RelayMode == relayconstant.RelayModeImagesEdits
}

func buildCodexImageResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (dto.OpenAIResponsesRequest, error) {
	action := "generate"
	var images []string
	var mask string
	var form *multipart.Form

	if info != nil && info.RelayMode == relayconstant.RelayModeImagesEdits {
		action = "edit"
		var err error
		images, mask, form, err = collectImageEditInputs(c, request)
		if err != nil {
			return dto.OpenAIResponsesRequest{}, err
		}
		if len(images) == 0 {
			return dto.OpenAIResponsesRequest{}, fmt.Errorf("image is required")
		}
	}

	imageModel := strings.TrimSpace(request.Model)
	if imageModel == "" {
		imageModel = CodexImageModel
	}

	responseFormat := imageResponseFormat(request, form)
	if responseFormat == "" {
		responseFormat = "b64_json"
	}
	c.Set(ginKeyCodexImageResponseFormat, responseFormat)

	tool := map[string]any{
		"type":   "image_generation",
		"action": action,
		"model":  imageModel,
	}
	applyImageToolOptions(tool, request, form)
	if mask != "" {
		tool["input_image_mask"] = map[string]any{
			"image_url": mask,
		}
	}

	content := make([]map[string]any, 0, len(images)+1)
	content = append(content, map[string]any{
		"type": "input_text",
		"text": request.Prompt,
	})
	for _, image := range images {
		image = strings.TrimSpace(image)
		if image == "" {
			continue
		}
		content = append(content, map[string]any{
			"type":      "input_image",
			"image_url": image,
		})
	}

	input := []map[string]any{{
		"type":    "message",
		"role":    "user",
		"content": content,
	}}
	inputRaw, err := common.Marshal(input)
	if err != nil {
		return dto.OpenAIResponsesRequest{}, err
	}
	toolsRaw, err := common.Marshal([]map[string]any{tool})
	if err != nil {
		return dto.OpenAIResponsesRequest{}, err
	}
	includeRaw, err := common.Marshal([]string{"reasoning.encrypted_content"})
	if err != nil {
		return dto.OpenAIResponsesRequest{}, err
	}
	toolChoiceRaw, err := common.Marshal(map[string]string{"type": "image_generation"})
	if err != nil {
		return dto.OpenAIResponsesRequest{}, err
	}

	return dto.OpenAIResponsesRequest{
		Model:             defaultImagesMainModel,
		Input:             inputRaw,
		Instructions:      json.RawMessage(`""`),
		Include:           includeRaw,
		ParallelToolCalls: json.RawMessage(`true`),
		Reasoning: &dto.Reasoning{
			Effort:  "medium",
			Summary: "auto",
		},
		Store:      json.RawMessage(`false`),
		Stream:     common.GetPointer(true),
		ToolChoice: toolChoiceRaw,
		Tools:      toolsRaw,
	}, nil
}

func collectImageEditInputs(c *gin.Context, request dto.ImageRequest) ([]string, string, *multipart.Form, error) {
	contentType := ""
	if c != nil && c.Request != nil {
		contentType = strings.ToLower(c.Request.Header.Get("Content-Type"))
	}
	if strings.Contains(contentType, "multipart/form-data") || contentType == "" {
		form, err := common.ParseMultipartFormReusable(c)
		if err != nil {
			return nil, "", nil, fmt.Errorf("failed to parse image edit form request: %w", err)
		}
		images, err := multipartFilesToDataURLs(collectMultipartImageFiles(form))
		if err != nil {
			return nil, "", nil, err
		}
		mask := ""
		if maskFiles := form.File["mask"]; len(maskFiles) > 0 {
			mask, err = multipartFileToDataURL(maskFiles[0])
			if err != nil {
				return nil, "", nil, err
			}
		}
		return images, mask, form, nil
	}

	images, mask, err := jsonImageEditInputs(request)
	return images, mask, nil, err
}

func collectMultipartImageFiles(form *multipart.Form) []*multipart.FileHeader {
	if form == nil || form.File == nil {
		return nil
	}
	if files := form.File["image[]"]; len(files) > 0 {
		return files
	}
	if files := form.File["image"]; len(files) > 0 {
		return files
	}

	var imageFiles []*multipart.FileHeader
	for fieldName, files := range form.File {
		if strings.HasPrefix(fieldName, "image[") && len(files) > 0 {
			imageFiles = append(imageFiles, files...)
		}
	}
	return imageFiles
}

func multipartFilesToDataURLs(fileHeaders []*multipart.FileHeader) ([]string, error) {
	images := make([]string, 0, len(fileHeaders))
	for _, fileHeader := range fileHeaders {
		dataURL, err := multipartFileToDataURL(fileHeader)
		if err != nil {
			return nil, err
		}
		images = append(images, dataURL)
	}
	return images, nil
}

func multipartFileToDataURL(fileHeader *multipart.FileHeader) (string, error) {
	if fileHeader == nil {
		return "", fmt.Errorf("upload file is nil")
	}
	file, err := fileHeader.Open()
	if err != nil {
		return "", fmt.Errorf("open upload file failed: %w", err)
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		return "", fmt.Errorf("read upload file failed: %w", err)
	}
	mediaType := strings.TrimSpace(fileHeader.Header.Get("Content-Type"))
	if mediaType == "" || strings.EqualFold(mediaType, "application/octet-stream") || !strings.HasPrefix(strings.ToLower(mediaType), "image/") {
		detected := http.DetectContentType(data)
		if strings.HasPrefix(strings.ToLower(detected), "image/") {
			mediaType = detected
		}
	}
	if mediaType == "" {
		mediaType = "application/octet-stream"
	}
	return "data:" + mediaType + ";base64," + base64.StdEncoding.EncodeToString(data), nil
}

func jsonImageEditInputs(request dto.ImageRequest) ([]string, string, error) {
	var images []string
	if raw, ok := request.Extra["images"]; ok && len(raw) > 0 {
		var items []struct {
			ImageURL string `json:"image_url"`
			FileID   string `json:"file_id"`
		}
		if err := common.Unmarshal(raw, &items); err != nil {
			return nil, "", err
		}
		for _, item := range items {
			if strings.TrimSpace(item.ImageURL) != "" {
				images = append(images, strings.TrimSpace(item.ImageURL))
			}
		}
	}
	if len(images) == 0 && len(request.Image) > 0 {
		var image string
		if err := common.Unmarshal(request.Image, &image); err == nil && strings.TrimSpace(image) != "" {
			images = append(images, strings.TrimSpace(image))
		}
	}

	mask := ""
	if raw, ok := request.Extra["mask"]; ok && len(raw) > 0 {
		var maskObj struct {
			ImageURL string `json:"image_url"`
			FileID   string `json:"file_id"`
		}
		if err := common.Unmarshal(raw, &maskObj); err != nil {
			return nil, "", err
		}
		mask = strings.TrimSpace(maskObj.ImageURL)
	}
	return images, mask, nil
}

func imageResponseFormat(request dto.ImageRequest, form *multipart.Form) string {
	if form != nil {
		if value := firstFormValue(form, "response_format"); value != "" {
			return value
		}
	}
	return strings.TrimSpace(request.ResponseFormat)
}

func applyImageToolOptions(tool map[string]any, request dto.ImageRequest, form *multipart.Form) {
	setStringToolOption(tool, "size", firstNonEmpty(request.Size, firstFormValue(form, "size")))
	setStringToolOption(tool, "quality", firstNonEmpty(request.Quality, firstFormValue(form, "quality")))
	setRawOrFormStringToolOption(tool, "background", request.Background, form)
	setRawOrFormStringToolOption(tool, "output_format", request.OutputFormat, form)
	setRawOrFormStringToolOption(tool, "moderation", request.Moderation, form)
	setRawOrFormIntToolOption(tool, "output_compression", request.OutputCompression, form)
	setRawOrFormIntToolOption(tool, "partial_images", request.PartialImages, form)
	setStringToolOption(tool, "input_fidelity", firstFormValue(form, "input_fidelity"))
}

func setStringToolOption(tool map[string]any, key string, value string) {
	value = strings.TrimSpace(value)
	if value != "" {
		tool[key] = value
	}
}

func setRawOrFormStringToolOption(tool map[string]any, key string, raw json.RawMessage, form *multipart.Form) {
	if value := firstFormValue(form, key); value != "" {
		tool[key] = value
		return
	}
	setRawToolOption(tool, key, raw)
}

func setRawOrFormIntToolOption(tool map[string]any, key string, raw json.RawMessage, form *multipart.Form) {
	if value := firstFormValue(form, key); value != "" {
		parsed, err := strconv.ParseInt(value, 10, 64)
		if err == nil {
			tool[key] = parsed
		}
		return
	}
	setRawToolOption(tool, key, raw)
}

func setRawToolOption(tool map[string]any, key string, raw json.RawMessage) {
	raw = bytes.TrimSpace(raw)
	if len(raw) == 0 {
		return
	}
	var value any
	if err := common.Unmarshal(raw, &value); err == nil {
		tool[key] = value
	}
}

func firstFormValue(form *multipart.Form, key string) string {
	if form == nil || form.Value == nil {
		return ""
	}
	values := form.Value[key]
	if len(values) == 0 {
		return ""
	}
	return strings.TrimSpace(values[0])
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func handleImageResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return nil, types.NewOpenAIError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}
	defer service.CloseResponseBodyGracefully(resp)

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}

	results, createdAt, usage, firstMeta, newAPIError := collectImagesFromResponseBody(responseBody)
	if newAPIError != nil {
		return nil, newAPIError
	}
	if len(results) == 0 {
		return nil, types.NewOpenAIError(fmt.Errorf("upstream did not return image output"), types.ErrorCodeBadResponseBody, http.StatusBadGateway)
	}

	output, err := buildImageAPIResponse(results, createdAt, usage, firstMeta, c.GetString(ginKeyCodexImageResponseFormat))
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	jsonResp := cloneResponseWithContentType(resp, "application/json")
	service.IOCopyBytesGracefully(c, jsonResp, output)
	return usage, nil
}

func collectImagesFromResponseBody(body []byte) ([]imageCallResult, int64, *dto.Usage, imageCallResult, *types.NewAPIError) {
	if looksLikeSSE(body) {
		return collectImagesFromSSE(body)
	}
	return extractImagesFromCompletedJSON(body)
}

func collectImagesFromSSE(body []byte) ([]imageCallResult, int64, *dto.Usage, imageCallResult, *types.NewAPIError) {
	scanner := bufio.NewScanner(bytes.NewReader(body))
	scanner.Buffer(make([]byte, 64<<10), 64<<20)

	var doneResults []imageCallResult
	var firstDone imageCallResult
	var partialResults []imageCallResult
	var firstPartial imageCallResult
	for scanner.Scan() {
		payload := ssePayloadFromLine(scanner.Text())
		if len(payload) == 0 || bytes.Equal(payload, []byte("[DONE]")) {
			continue
		}

		switch gjson.GetBytes(payload, "type").String() {
		case "response.completed":
			results, createdAt, usage, firstMeta, newAPIError := extractImagesFromCompletedJSON(payload)
			if newAPIError != nil {
				return nil, 0, nil, imageCallResult{}, newAPIError
			}
			if len(results) > 0 {
				return results, createdAt, usage, firstMeta, nil
			}
			if len(doneResults) > 0 {
				return doneResults, createdAt, usage, firstDone, nil
			}
			if len(partialResults) > 0 {
				return partialResults, createdAt, usage, firstPartial, nil
			}
			return results, createdAt, usage, firstMeta, nil
		case "response.output_item.done":
			item := gjson.GetBytes(payload, "item")
			if item.Get("type").String() == dto.ResponsesOutputTypeImageGenerationCall {
				result := imageCallResultFromGJSON(item)
				if result.Result != "" {
					if len(doneResults) == 0 {
						firstDone = result
					}
					doneResults = append(doneResults, result)
				}
			}
		case "response.image_generation_call.partial_image":
			b64 := strings.TrimSpace(gjson.GetBytes(payload, "partial_image_b64").String())
			if b64 != "" {
				result := imageCallResult{
					Result:       b64,
					OutputFormat: strings.TrimSpace(gjson.GetBytes(payload, "output_format").String()),
				}
				if len(partialResults) == 0 {
					firstPartial = result
				}
				partialResults = append(partialResults, result)
			}
		case "response.error", "response.failed":
			message := extractCodexErrorMessage(payload)
			if message == "" {
				message = strings.TrimSpace(string(payload))
			}
			return nil, 0, nil, imageCallResult{}, types.NewOpenAIError(fmt.Errorf("codex upstream error: %s", truncateErrorMessage(message)), types.ErrorCodeBadResponseBody, http.StatusBadGateway)
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, 0, nil, imageCallResult{}, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusBadGateway)
	}
	if len(doneResults) > 0 {
		return doneResults, time.Now().Unix(), &dto.Usage{}, firstDone, nil
	}
	if len(partialResults) > 0 {
		return partialResults, time.Now().Unix(), &dto.Usage{}, firstPartial, nil
	}
	return nil, 0, nil, imageCallResult{}, types.NewOpenAIError(fmt.Errorf("stream disconnected before image completion"), types.ErrorCodeBadResponseBody, http.StatusBadGateway)
}

func extractImagesFromCompletedJSON(payload []byte) ([]imageCallResult, int64, *dto.Usage, imageCallResult, *types.NewAPIError) {
	root := gjson.ParseBytes(payload)
	response := root.Get("response")
	if !response.Exists() {
		response = root
	}

	createdAt := response.Get("created_at").Int()
	if createdAt <= 0 {
		createdAt = time.Now().Unix()
	}

	var results []imageCallResult
	var firstMeta imageCallResult
	output := response.Get("output")
	if output.IsArray() {
		for _, item := range output.Array() {
			if item.Get("type").String() != dto.ResponsesOutputTypeImageGenerationCall {
				continue
			}
			result := imageCallResultFromGJSON(item)
			if result.Result == "" {
				continue
			}
			if len(results) == 0 {
				firstMeta = result
			}
			results = append(results, result)
		}
	}

	usage := &dto.Usage{}
	if usageRaw := response.Get("usage"); usageRaw.Exists() && usageRaw.IsObject() {
		var responseUsage dto.Usage
		if err := common.Unmarshal([]byte(usageRaw.Raw), &responseUsage); err == nil {
			usage = usageFromResponseUsage(&responseUsage)
		}
	} else if usageRaw := response.Get("tool_usage.image_gen"); usageRaw.Exists() && usageRaw.IsObject() {
		var responseUsage dto.Usage
		if err := common.Unmarshal([]byte(usageRaw.Raw), &responseUsage); err == nil {
			usage = usageFromResponseUsage(&responseUsage)
		}
	}
	return results, createdAt, usage, firstMeta, nil
}

func imageCallResultFromGJSON(item gjson.Result) imageCallResult {
	return imageCallResult{
		Result:        strings.TrimSpace(item.Get("result").String()),
		RevisedPrompt: strings.TrimSpace(item.Get("revised_prompt").String()),
		OutputFormat:  strings.TrimSpace(item.Get("output_format").String()),
		Size:          strings.TrimSpace(item.Get("size").String()),
		Background:    strings.TrimSpace(item.Get("background").String()),
		Quality:       strings.TrimSpace(item.Get("quality").String()),
	}
}

func usageFromResponseUsage(responseUsage *dto.Usage) *dto.Usage {
	if responseUsage == nil {
		return &dto.Usage{}
	}
	usage := *responseUsage
	if usage.PromptTokens == 0 && usage.InputTokens > 0 {
		usage.PromptTokens = usage.InputTokens
	}
	if usage.CompletionTokens == 0 && usage.OutputTokens > 0 {
		usage.CompletionTokens = usage.OutputTokens
	}
	if usage.TotalTokens == 0 {
		usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
	}
	return &usage
}

func buildImageAPIResponse(results []imageCallResult, createdAt int64, usage *dto.Usage, firstMeta imageCallResult, responseFormat string) ([]byte, error) {
	responseFormat = strings.ToLower(strings.TrimSpace(responseFormat))
	if responseFormat == "" {
		responseFormat = "b64_json"
	}

	imageResponse := dto.ImageResponse{
		Created:      createdAt,
		Data:         make([]dto.ImageData, 0, len(results)),
		Background:   firstMeta.Background,
		OutputFormat: firstMeta.OutputFormat,
		Quality:      firstMeta.Quality,
		Size:         firstMeta.Size,
	}
	if usage != nil && usage.TotalTokens > 0 {
		imageResponse.Usage = usage
	}

	for _, result := range results {
		item := dto.ImageData{
			RevisedPrompt: result.RevisedPrompt,
		}
		if responseFormat == "url" {
			item.Url = "data:" + mimeTypeFromOutputFormat(result.OutputFormat) + ";base64," + result.Result
		} else {
			item.B64Json = result.Result
		}
		imageResponse.Data = append(imageResponse.Data, item)
	}
	return common.Marshal(imageResponse)
}

func mimeTypeFromOutputFormat(outputFormat string) string {
	outputFormat = strings.ToLower(strings.TrimSpace(outputFormat))
	if outputFormat == "" {
		return "image/png"
	}
	if strings.Contains(outputFormat, "/") {
		return outputFormat
	}
	switch outputFormat {
	case "jpg", "jpeg":
		return "image/jpeg"
	case "webp":
		return "image/webp"
	default:
		return "image/png"
	}
}
