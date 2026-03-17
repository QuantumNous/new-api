package replicate

import (
	"github.com/QuantumNous/new-api/i18n"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
)

type Adaptor struct {
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	if info == nil {
		return "", errors.New(i18n.Translate("relay.replicate_adaptor_relay_info_is_nil"))
	}
	if info.ChannelBaseUrl == "" {
		info.ChannelBaseUrl = constant.ChannelBaseURLs[constant.ChannelTypeReplicate]
	}
	requestPath := info.RequestURLPath
	if requestPath == "" {
		return info.ChannelBaseUrl, nil
	}
	return relaycommon.GetFullRequestURL(info.ChannelBaseUrl, requestPath, info.ChannelType), nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	if info == nil {
		return errors.New(i18n.Translate("relay.replicate_adaptor_relay_info_is_nil"))
	}
	if info.ApiKey == "" {
		return errors.New(i18n.Translate("relay.replicate_adaptor_api_key_is_required"))
	}
	channel.SetupApiRequestHeader(info, c, req)
	req.Set("Authorization", "Bearer "+info.ApiKey)
	req.Set("Prefer", "wait")
	if req.Get("Content-Type") == "" {
		req.Set("Content-Type", "application/json")
	}
	if req.Get("Accept") == "" {
		req.Set("Accept", "application/json")
	}
	return nil
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	if info == nil {
		return nil, errors.New(i18n.Translate("relay.replicate_adaptor_relay_info_is_nil"))
	}
	if strings.TrimSpace(request.Prompt) == "" {
		if v := c.PostForm("prompt"); strings.TrimSpace(v) != "" {
			request.Prompt = v
		}
	}
	if strings.TrimSpace(request.Prompt) == "" {
		return nil, errors.New(i18n.Translate("relay.replicate_adaptor_prompt_is_required"))
	}

	modelName := strings.TrimSpace(info.UpstreamModelName)
	if modelName == "" {
		modelName = strings.TrimSpace(request.Model)
	}
	if modelName == "" {
		modelName = ModelFlux11Pro
	}
	info.UpstreamModelName = modelName

	info.RequestURLPath = fmt.Sprintf("/v1/models/%s/predictions", modelName)

	inputPayload := make(map[string]any)
	inputPayload["prompt"] = request.Prompt

	if size := strings.TrimSpace(request.Size); size != "" {
		if aspect, width, height, ok := mapOpenAISizeToFlux(size); ok {
			if aspect != "" {
				if aspect == "custom" {
					inputPayload["aspect_ratio"] = "custom"
					if width > 0 {
						inputPayload["width"] = width
					}
					if height > 0 {
						inputPayload["height"] = height
					}
				} else {
					inputPayload["aspect_ratio"] = aspect
				}
			}
		}
	}

	if len(request.OutputFormat) > 0 {
		var outputFormat string
		if err := json.Unmarshal(request.OutputFormat, &outputFormat); err == nil && strings.TrimSpace(outputFormat) != "" {
			inputPayload["output_format"] = outputFormat
		}
	}

	if imageN := lo.FromPtrOr(request.N, uint(0)); imageN > 0 {
		inputPayload["num_outputs"] = int(imageN)
	}

	if strings.EqualFold(request.Quality, "hd") || strings.EqualFold(request.Quality, "high") {
		inputPayload["prompt_upsampling"] = true
	}

	if info.RelayMode == relayconstant.RelayModeImagesEdits {
		imageURL, err := uploadFileFromForm(c, info, "image", "image[]", "image_prompt")
		if err != nil {
			return nil, err
		}
		if imageURL == "" {
			return nil, errors.New(i18n.Translate("relay.replicate_adaptor_image_file_is_required_for_edits"))
		}
		inputPayload["image_prompt"] = imageURL
	}

	if len(request.ExtraFields) > 0 {
		var extra map[string]any
		if err := common.Unmarshal(request.ExtraFields, &extra); err != nil {
			return nil, fmt.Errorf(i18n.Translate("relay.replicate_adaptor_failed_to_decode_extra_fields"), err)
		}
		for key, val := range extra {
			inputPayload[key] = val
		}
	}

	for key, raw := range request.Extra {
		if strings.EqualFold(key, "input") {
			var extraInput map[string]any
			if err := common.Unmarshal(raw, &extraInput); err != nil {
				return nil, fmt.Errorf(i18n.Translate("relay.replicate_adaptor_failed_to_decode_extra_input"), err)
			}
			for k, v := range extraInput {
				inputPayload[k] = v
			}
			continue
		}
		if raw == nil {
			continue
		}
		var val any
		if err := common.Unmarshal(raw, &val); err != nil {
			return nil, fmt.Errorf(i18n.Translate("relay.replicate_adaptor_failed_to_decode_extra_field"), key, err)
		}
		inputPayload[key] = val
	}

	return map[string]any{
		"input": inputPayload,
	}, nil
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	if resp == nil {
		return nil, types.NewError(errors.New(i18n.Translate("relay.replicate_adaptor_empty_response")), types.ErrorCodeBadResponse)
	}

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeReadResponseBodyFailed)
	}
	_ = resp.Body.Close()

	var prediction PredictionResponse
	if err := common.Unmarshal(responseBody, &prediction); err != nil {
		return nil, types.NewError(fmt.Errorf(i18n.Translate("relay.replicate_adaptor_failed_to_decode_response"), err), types.ErrorCodeBadResponseBody)
	}

	if prediction.Error != nil {
		errMsg := prediction.Error.Message
		if errMsg == "" {
			errMsg = prediction.Error.Detail
		}
		if errMsg == "" {
			errMsg = prediction.Error.Code
		}
		if errMsg == "" {
			errMsg = "replicate adaptor: prediction error"
		}
		return nil, types.NewError(errors.New(errMsg), types.ErrorCodeBadResponse)
	}

	if prediction.Status != "" && !strings.EqualFold(prediction.Status, "succeeded") {
		return nil, types.NewError(fmt.Errorf(i18n.Translate("relay.replicate_adaptor_prediction_status"), prediction.Status), types.ErrorCodeBadResponse)
	}

	var urls []string

	appendOutput := func(value string) {
		value = strings.TrimSpace(value)
		if value == "" {
			return
		}
		urls = append(urls, value)
	}

	switch output := prediction.Output.(type) {
	case string:
		appendOutput(output)
	case []any:
		for _, item := range output {
			if str, ok := item.(string); ok {
				appendOutput(str)
			}
		}
	case nil:
		// no output
	default:
		if str, ok := output.(fmt.Stringer); ok {
			appendOutput(str.String())
		}
	}

	if len(urls) == 0 {
		return nil, types.NewError(errors.New(i18n.Translate("relay.replicate_adaptor_empty_prediction_output")), types.ErrorCodeBadResponseBody)
	}

	var imageReq *dto.ImageRequest
	if info != nil {
		if req, ok := info.Request.(*dto.ImageRequest); ok {
			imageReq = req
		}
	}

	wantsBase64 := imageReq != nil && strings.EqualFold(imageReq.ResponseFormat, "b64_json")

	imageResponse := dto.ImageResponse{
		Created: common.GetTimestamp(),
		Data:    make([]dto.ImageData, 0),
	}

	if wantsBase64 {
		converted, convErr := downloadImagesToBase64(urls)
		if convErr != nil {
			return nil, types.NewError(convErr, types.ErrorCodeBadResponse)
		}
		for _, content := range converted {
			if content == "" {
				continue
			}
			imageResponse.Data = append(imageResponse.Data, dto.ImageData{B64Json: content})
		}
	} else {
		for _, url := range urls {
			if url == "" {
				continue
			}
			imageResponse.Data = append(imageResponse.Data, dto.ImageData{Url: url})
		}
	}

	if len(imageResponse.Data) == 0 {
		return nil, types.NewError(errors.New(i18n.Translate("relay.replicate_adaptor_no_usable_image_data")), types.ErrorCodeBadResponse)
	}

	responseBytes, err := common.Marshal(imageResponse)
	if err != nil {
		return nil, types.NewError(fmt.Errorf(i18n.Translate("relay.replicate_adaptor_encode_response_failed"), err), types.ErrorCodeBadResponseBody)
	}

	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(http.StatusOK)
	_, _ = c.Writer.Write(responseBytes)

	usage := &dto.Usage{}
	return usage, nil
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}

func downloadImagesToBase64(urls []string) ([]string, error) {
	results := make([]string, 0, len(urls))
	for _, url := range urls {
		if strings.TrimSpace(url) == "" {
			continue
		}
		_, data, err := service.GetImageFromUrl(url)
		if err != nil {
			return nil, fmt.Errorf(i18n.Translate("relay.replicate_adaptor_failed_to_download_image_from"), url, err)
		}
		results = append(results, data)
	}
	return results, nil
}

func mapOpenAISizeToFlux(size string) (aspect string, width int, height int, ok bool) {
	parts := strings.Split(size, "x")
	if len(parts) != 2 {
		return "", 0, 0, false
	}
	w, err1 := strconv.Atoi(strings.TrimSpace(parts[0]))
	h, err2 := strconv.Atoi(strings.TrimSpace(parts[1]))
	if err1 != nil || err2 != nil || w <= 0 || h <= 0 {
		return "", 0, 0, false
	}

	switch {
	case w == h:
		return "1:1", 0, 0, true
	case w == 1792 && h == 1024:
		return "16:9", 0, 0, true
	case w == 1024 && h == 1792:
		return "9:16", 0, 0, true
	case w == 1536 && h == 1024:
		return "3:2", 0, 0, true
	case w == 1024 && h == 1536:
		return "2:3", 0, 0, true
	}

	rw, rh := reduceRatio(w, h)
	ratioStr := fmt.Sprintf("%d:%d", rw, rh)
	switch ratioStr {
	case "1:1", "16:9", "9:16", "3:2", "2:3", "4:5", "5:4", "3:4", "4:3":
		return ratioStr, 0, 0, true
	}

	width = normalizeFluxDimension(w)
	height = normalizeFluxDimension(h)
	return "custom", width, height, true
}

func reduceRatio(w, h int) (int, int) {
	g := gcd(w, h)
	if g == 0 {
		return w, h
	}
	return w / g, h / g
}

func gcd(a, b int) int {
	for b != 0 {
		a, b = b, a%b
	}
	if a < 0 {
		return -a
	}
	return a
}

func normalizeFluxDimension(value int) int {
	const (
		minDim = 256
		maxDim = 1440
		step   = 32
	)
	if value < minDim {
		value = minDim
	}
	if value > maxDim {
		value = maxDim
	}
	remainder := value % step
	if remainder != 0 {
		if remainder >= step/2 {
			value += step - remainder
		} else {
			value -= remainder
		}
	}
	if value < minDim {
		value = minDim
	}
	if value > maxDim {
		value = maxDim
	}
	return value
}

func uploadFileFromForm(c *gin.Context, info *relaycommon.RelayInfo, fieldCandidates ...string) (string, error) {
	if info == nil {
		return "", errors.New(i18n.Translate("relay.replicate_adaptor_relay_info_is_nil"))
	}

	mf := c.Request.MultipartForm
	if mf == nil {
		if _, err := c.MultipartForm(); err != nil {
			return "", fmt.Errorf(i18n.Translate("relay.replicate_adaptor_parse_multipart_form_failed"), err)
		}
		mf = c.Request.MultipartForm
	}
	if mf == nil || len(mf.File) == 0 {
		return "", nil
	}

	if len(fieldCandidates) == 0 {
		fieldCandidates = []string{"image", "image[]", "image_prompt"}
	}

	var fileHeader *multipart.FileHeader
	for _, key := range fieldCandidates {
		if files := mf.File[key]; len(files) > 0 {
			fileHeader = files[0]
			break
		}
	}
	if fileHeader == nil {
		for _, files := range mf.File {
			if len(files) > 0 {
				fileHeader = files[0]
				break
			}
		}
	}
	if fileHeader == nil {
		return "", nil
	}

	file, err := fileHeader.Open()
	if err != nil {
		return "", fmt.Errorf(i18n.Translate("relay.replicate_adaptor_failed_to_open_image_file"), err)
	}
	defer file.Close()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	hdr := make(textproto.MIMEHeader)
	hdr.Set("Content-Disposition", fmt.Sprintf("form-data; name=\"content\"; filename=\"%s\"", fileHeader.Filename))
	contentType := fileHeader.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	hdr.Set("Content-Type", contentType)

	part, err := writer.CreatePart(hdr)
	if err != nil {
		writer.Close()
		return "", fmt.Errorf(i18n.Translate("relay.replicate_adaptor_create_upload_form_failed"), err)
	}
	if _, err := io.Copy(part, file); err != nil {
		writer.Close()
		return "", fmt.Errorf(i18n.Translate("relay.replicate_adaptor_copy_image_content_failed"), err)
	}
	formContentType := writer.FormDataContentType()
	writer.Close()

	baseURL := info.ChannelBaseUrl
	if baseURL == "" {
		baseURL = constant.ChannelBaseURLs[constant.ChannelTypeReplicate]
	}
	uploadURL := relaycommon.GetFullRequestURL(baseURL, "/v1/files", info.ChannelType)

	req, err := http.NewRequest(http.MethodPost, uploadURL, &body)
	if err != nil {
		return "", fmt.Errorf(i18n.Translate("relay.replicate_adaptor_create_upload_request_failed"), err)
	}
	req.Header.Set("Content-Type", formContentType)
	req.Header.Set("Authorization", "Bearer "+info.ApiKey)

	resp, err := service.GetHttpClient().Do(req)
	if err != nil {
		return "", fmt.Errorf(i18n.Translate("relay.replicate_adaptor_upload_image_failed"), err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf(i18n.Translate("relay.replicate_adaptor_read_upload_response_failed"), err)
	}
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return "", fmt.Errorf(i18n.Translate("relay.replicate_adaptor_upload_image_failed_with_status"), resp.StatusCode, strings.TrimSpace(string(respBody)))
	}

	var uploadResp FileUploadResponse
	if err := common.Unmarshal(respBody, &uploadResp); err != nil {
		return "", fmt.Errorf(i18n.Translate("relay.replicate_adaptor_decode_upload_response_failed"), err)
	}
	if uploadResp.Urls.Get == "" {
		return "", errors.New(i18n.Translate("relay.replicate_adaptor_upload_response_missing_url"))
	}
	return uploadResp.Urls.Get, nil
}

func (a *Adaptor) ConvertOpenAIRequest(*gin.Context, *relaycommon.RelayInfo, *dto.GeneralOpenAIRequest) (any, error) {
	return nil, errors.New(i18n.Translate("relay.replicate_adaptor_convertopenairequest_is_not_implemented"))
}

func (a *Adaptor) ConvertRerankRequest(*gin.Context, int, dto.RerankRequest) (any, error) {
	return nil, errors.New(i18n.Translate("relay.replicate_adaptor_convertrerankrequest_is_not_implemented"))
}

func (a *Adaptor) ConvertEmbeddingRequest(*gin.Context, *relaycommon.RelayInfo, dto.EmbeddingRequest) (any, error) {
	return nil, errors.New(i18n.Translate("relay.replicate_adaptor_convertembeddingrequest_is_not_implemented"))
}

func (a *Adaptor) ConvertAudioRequest(*gin.Context, *relaycommon.RelayInfo, dto.AudioRequest) (io.Reader, error) {
	return nil, errors.New(i18n.Translate("relay.replicate_adaptor_convertaudiorequest_is_not_implemented"))
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(*gin.Context, *relaycommon.RelayInfo, dto.OpenAIResponsesRequest) (any, error) {
	return nil, errors.New(i18n.Translate("relay.replicate_adaptor_convertopenairesponsesrequest_is_not_implemented"))
}

func (a *Adaptor) ConvertClaudeRequest(*gin.Context, *relaycommon.RelayInfo, *dto.ClaudeRequest) (any, error) {
	return nil, errors.New(i18n.Translate("relay.replicate_adaptor_convertclauderequest_is_not_implemented"))
}

func (a *Adaptor) ConvertGeminiRequest(*gin.Context, *relaycommon.RelayInfo, *dto.GeminiChatRequest) (any, error) {
	return nil, errors.New(i18n.Translate("relay.replicate_adaptor_convertgeminirequest_is_not_implemented"))
}
