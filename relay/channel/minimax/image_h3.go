package minimax

import (
	"bytes"
	"cmp"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"net/url"
	"slices"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// MiniMaxH3ImageRequest is the MiniMax H3 image request body. It serves both
// /v1/images/generations and /v1/images/edits; the reference images are only
// sent on the edit path.
type MiniMaxH3ImageRequest struct {
	Model                 string       `json:"model"`
	Prompt                string       `json:"prompt"`
	Images                []h3ImageRef `json:"images,omitempty"`
	N                     *int         `json:"n,omitempty"`
	Size                  string       `json:"size,omitempty"`
	AspectRatio           string       `json:"aspect_ratio,omitempty"`
	Area                  string       `json:"area,omitempty"`
	OutputFormat          string       `json:"output_format,omitempty"`
	ResponseFormat        string       `json:"response_format,omitempty"`
	OutputCompression     *int         `json:"output_compression,omitempty"`
	DisablePromptEnhanced *bool        `json:"disable_prompt_enhanced,omitempty"`
	Stream                bool         `json:"stream,omitempty"`
}

// H3ImageRef is one reference image of an image edit request.
type h3ImageRef struct {
	ImageURL string `json:"image_url"`
}

// miniMaxH3ImageFields holds the MiniMax image parameters of one request.
// They come from the JSON body or from the multipart form, which carry
// different subsets of the same parameters.
type h3ImageFields struct {
	N                     *int
	Size                  string
	AspectRatio           string
	Area                  string
	OutputFormat          string
	ResponseFormat        string
	OutputCompression     *int
	DisablePromptEnhanced *bool
	Stream                bool
}

// isMiniMaxH3ImageModel reports whether the upstream model is served by the
// H3 image endpoints.
func isMiniMaxH3ImageModel(model string) bool {
	return model == "MiniMax-H3-Image" || model == "MiniMax-H3-Image-Highspeed"
}

// convertMiniMaxH3Generation builds the H3 request for /v1/images/generations.
func convertMiniMaxH3Generation(request dto.ImageRequest) (MiniMaxH3ImageRequest, error) {
	fields, err := miniMaxH3FieldsFromRequest(request)
	if err != nil {
		return MiniMaxH3ImageRequest{}, err
	}

	fields, err = miniMaxH3ResolveFields(fields)
	if err != nil {
		return MiniMaxH3ImageRequest{}, err
	}

	if err := miniMaxH3ValidatePrompt(request.Prompt); err != nil {
		return MiniMaxH3ImageRequest{}, err
	}

	return miniMaxH3ImageRequest(request.Model, request.Prompt, fields, nil), nil
}

// convertMiniMaxH3Edit builds the H3 request for /v1/images/edits. A JSON
// request carries its reference images as URLs or data URIs and is sent as
// JSON; a multipart request uploads image files and is forwarded as multipart.
func convertMiniMaxH3Edit(c *gin.Context, request dto.ImageRequest) (any, error) {
	if !isMiniMaxH3ImageModel(request.Model) {
		return nil, miniMaxH3ClientError(errors.New("the MiniMax image edit API requires MiniMax-H3-Image or MiniMax-H3-Image-Highspeed"))
	}
	if miniMaxH3IsMultipartRequest(c) {
		return convertMiniMaxH3EditMultipart(c, request)
	}

	fields, err := miniMaxH3FieldsFromRequest(request)
	if err != nil {
		return nil, err
	}
	fields, err = miniMaxH3ResolveFields(fields)
	if err != nil {
		return nil, err
	}
	if fields.DisablePromptEnhanced != nil {
		return nil, miniMaxH3ClientError(errors.New("disable_prompt_enhanced is not supported by the MiniMax image edit API"))
	}
	if err := miniMaxH3ValidatePrompt(request.Prompt); err != nil {
		return nil, err
	}
	references, err := miniMaxH3EditReferences(request)
	if err != nil {
		return nil, err
	}
	return miniMaxH3ImageRequest(request.Model, request.Prompt, fields, references), nil
}

// convertMiniMaxH3EditMultipart forwards an uploaded image edit request as
// multipart, keeping the reference images as files instead of inflating them
// into base64 payloads.
func convertMiniMaxH3EditMultipart(c *gin.Context, request dto.ImageRequest) (*bytes.Buffer, error) {
	form := c.Request.MultipartForm
	if form == nil {
		parsed, err := common.ParseMultipartFormReusable(c)
		if err != nil {
			return nil, miniMaxH3ClientError(fmt.Errorf("failed to parse multipart form: %w", err))
		}
		c.Request.MultipartForm = parsed
		c.Request.PostForm = url.Values(parsed.Value)
		form = parsed
	}
	if len(form.File["mask"]) > 0 {
		return nil, miniMaxH3ClientError(errors.New("mask is not supported by the MiniMax image edit API"))
	}
	files := miniMaxH3FormFiles(form)
	if len(files) == 0 {
		return nil, miniMaxH3ClientError(errors.New("at least one reference image is required"))
	}

	if len(files) > miniMaxH3MaxReferenceImages {
		return nil, miniMaxH3ClientError(fmt.Errorf("at most %d reference images are allowed", miniMaxH3MaxReferenceImages))
	}
	fields, err := miniMaxH3FieldsFromForm(url.Values(form.Value))
	if err != nil {
		return nil, err
	}
	fields, err = miniMaxH3ResolveFields(fields)
	if err != nil {
		return nil, err
	}
	if fields.DisablePromptEnhanced != nil {
		return nil, miniMaxH3ClientError(errors.New("disable_prompt_enhanced is not supported by the MiniMax image edit API"))
	}
	if err := miniMaxH3ValidatePrompt(request.Prompt); err != nil {
		return nil, err
	}

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	writer.WriteField("model", request.Model)
	writer.WriteField("prompt", request.Prompt)
	if fields.N != nil {
		writer.WriteField("n", strconv.Itoa(*fields.N))
	}
	if fields.Size != "" {
		writer.WriteField("size", fields.Size)
	}
	if fields.AspectRatio != "" {
		writer.WriteField("aspect_ratio", fields.AspectRatio)
	}
	if fields.Area != "" {
		writer.WriteField("area", fields.Area)
	}
	if fields.OutputFormat != "" {
		writer.WriteField("output_format", fields.OutputFormat)
	}
	if fields.ResponseFormat != "" {
		writer.WriteField("response_format", fields.ResponseFormat)
	}
	if fields.OutputCompression != nil {
		writer.WriteField("output_compression", strconv.Itoa(*fields.OutputCompression))
	}
	if fields.Stream {
		writer.WriteField("stream", "true")
	}

	fieldName := "image"
	if len(files) > 1 {
		fieldName = "image[]"
	}
	for _, fileHeader := range files {
		if err := miniMaxH3WriteImagePart(writer, fieldName, fileHeader); err != nil {
			return nil, err
		}
	}
	writer.Close()
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())
	return &body, nil
}

// miniMaxH3WriteImagePart copies one uploaded reference image into the
// upstream multipart body.
func miniMaxH3WriteImagePart(writer *multipart.Writer, fieldName string, fileHeader *multipart.FileHeader) error {
	file, err := fileHeader.Open()
	if err != nil {
		return miniMaxH3ClientError(fmt.Errorf("failed to open image file %s: %w", fileHeader.Filename, err))
	}
	defer file.Close()

	header := make(textproto.MIMEHeader)
	header.Set("Content-Disposition", fmt.Sprintf(`form-data; name="%s"; filename="%s"`, fieldName, fileHeader.Filename))
	header.Set("Content-Type", openai.DetectImageMimeType(fileHeader.Filename))
	part, err := writer.CreatePart(header)
	if err != nil {
		return miniMaxH3ClientError(fmt.Errorf("create form part failed for image %s: %w", fileHeader.Filename, err))
	}
	if _, err := io.Copy(part, file); err != nil {
		return miniMaxH3ClientError(fmt.Errorf("copy image file %s failed: %w", fileHeader.Filename, err))
	}
	return nil
}

// miniMaxH3FormFiles returns the uploaded reference images in the order the
// client sent them, because the prompt refers to them by position.
func miniMaxH3FormFiles(form *multipart.Form) []*multipart.FileHeader {
	files := make([]*multipart.FileHeader, 0, len(form.File))
	files = append(files, form.File["image"]...)
	files = append(files, form.File["image[]"]...)

	// An indexed key carries the position of the reference, so the keys are
	// ordered by that number: image[2] comes before image[10].
	type indexedKey struct {
		key   string
		index int
	}
	indexed := make([]indexedKey, 0, len(form.File))
	for key := range form.File {
		if key == "image" || key == "image[]" {
			continue
		}
		rest, ok := strings.CutPrefix(key, "image[")
		if !ok {
			continue
		}
		position, err := strconv.Atoi(strings.TrimSuffix(rest, "]"))
		if err != nil {
			// A key the client did not number keeps its place at the end.
			position = math.MaxInt
		}
		indexed = append(indexed, indexedKey{key: key, index: position})
	}
	slices.SortFunc(indexed, func(a, b indexedKey) int {
		if order := cmp.Compare(a.index, b.index); order != 0 {
			return order
		}
		return cmp.Compare(a.key, b.key)
	})
	for _, item := range indexed {
		files = append(files, form.File[item.key]...)
	}
	return files
}

// miniMaxH3ImageRequest assembles the upstream request body.
func miniMaxH3ImageRequest(model, prompt string, fields h3ImageFields, images []h3ImageRef) MiniMaxH3ImageRequest {
	return MiniMaxH3ImageRequest{
		Model:                 model,
		Prompt:                prompt,
		Images:                images,
		N:                     fields.N,
		Size:                  fields.Size,
		AspectRatio:           fields.AspectRatio,
		Area:                  fields.Area,
		OutputFormat:          fields.OutputFormat,
		ResponseFormat:        fields.ResponseFormat,
		OutputCompression:     fields.OutputCompression,
		DisablePromptEnhanced: fields.DisablePromptEnhanced,
		Stream:                fields.Stream,
	}
}

// miniMaxH3FieldsFromRequest reads the MiniMax parameters of a JSON request.
// The DTO models only part of them, so the remaining ones arrive as extra
// fields.
func miniMaxH3FieldsFromRequest(request dto.ImageRequest) (h3ImageFields, error) {
	fields := h3ImageFields{
		Size:           strings.TrimSpace(request.Size),
		ResponseFormat: strings.TrimSpace(request.ResponseFormat),
		Stream:         request.Stream != nil && *request.Stream,
	}

	if request.N != nil {
		n := int(*request.N)
		fields.N = &n
	}

	outputFormat, err := miniMaxH3StringField(request.OutputFormat, "output_format")
	if err != nil {
		return fields, err
	}
	fields.OutputFormat = outputFormat

	compression, err := miniMaxH3Field[int](request.OutputCompression, "output_compression")
	if err != nil {
		return fields, err
	}
	fields.OutputCompression = compression

	aspectRatio, err := miniMaxH3StringField(request.Extra["aspect_ratio"], "aspect_ratio")
	if err != nil {
		return fields, err
	}
	fields.AspectRatio = aspectRatio
	area, err := miniMaxH3StringField(request.Extra["area"], "area")
	if err != nil {
		return fields, err
	}
	fields.Area = area

	disablePromptEnhanced, err := miniMaxH3Field[bool](request.Extra["disable_prompt_enhanced"], "disable_prompt_enhanced")
	if err != nil {
		return fields, err
	}
	fields.DisablePromptEnhanced = disablePromptEnhanced
	return fields, nil
}

// miniMaxH3FieldsFromForm reads the MiniMax parameters of a multipart
// request. The generic image request DTO keeps only a subset of the form
// fields, so the MiniMax ones are read from the form itself.
func miniMaxH3FieldsFromForm(form url.Values) (h3ImageFields, error) {
	fields := h3ImageFields{
		Size:           strings.TrimSpace(form.Get("size")),
		AspectRatio:    strings.TrimSpace(form.Get("aspect_ratio")),
		Area:           strings.TrimSpace(form.Get("area")),
		OutputFormat:   strings.TrimSpace(form.Get("output_format")),
		ResponseFormat: strings.TrimSpace(form.Get("response_format")),
	}
	if raw := strings.TrimSpace(form.Get("n")); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil {
			return fields, miniMaxH3ClientError(fmt.Errorf("invalid n: %w", err))
		}
		// The generic image request treats n=0 as the default of one, and the
		// upstream default is one as well.
		if n > 0 {
			fields.N = &n
		}
	}
	if raw := strings.TrimSpace(form.Get("output_compression")); raw != "" {
		compression, err := strconv.Atoi(raw)
		if err != nil {
			return fields, miniMaxH3ClientError(fmt.Errorf("invalid output_compression: %w", err))
		}
		fields.OutputCompression = &compression
	}
	if raw := strings.TrimSpace(form.Get("disable_prompt_enhanced")); raw != "" {
		disable, err := strconv.ParseBool(raw)
		if err != nil {
			return fields, miniMaxH3ClientError(fmt.Errorf("invalid disable_prompt_enhanced: %w", err))
		}
		fields.DisablePromptEnhanced = &disable
	}
	if raw := strings.TrimSpace(form.Get("stream")); raw != "" {
		stream, err := strconv.ParseBool(raw)
		if err != nil {
			return fields, miniMaxH3ClientError(fmt.Errorf("invalid stream: %w", err))
		}
		fields.Stream = stream
	}
	return fields, nil
}

// miniMaxH3ResolveFields validates the MiniMax parameters and resolves the
// mutually exclusive size, aspect_ratio and area parameters: an explicit size
// wins, and a size the upstream cannot serve degrades into an aspect ratio
// plus a resolution bucket.
func miniMaxH3ResolveFields(fields h3ImageFields) (h3ImageFields, error) {
	if fields.N != nil && (*fields.N < 1 || *fields.N > miniMaxH3MaxN) {
		return fields, miniMaxH3ClientError(fmt.Errorf("n must be an integer between 1 and %d", miniMaxH3MaxN))
	}

	switch fields.ResponseFormat {
	case "", "url", "b64_json":
	default:
		return fields, miniMaxH3ClientError(errors.New("response_format must be url or b64_json"))
	}
	// The upstream only streams image links, the base64 payload has no
	// streaming form.
	if fields.Stream && fields.ResponseFormat == "b64_json" {
		return fields, miniMaxH3ClientError(errors.New("streaming image responses require response_format url"))
	}
	switch fields.OutputFormat {
	case "", "png", "jpeg", "jpg", "webp":
	default:
		return fields, miniMaxH3ClientError(errors.New("output_format must be png, jpeg, jpg or webp"))
	}
	if fields.OutputCompression != nil && (*fields.OutputCompression < 0 || *fields.OutputCompression > 100) {
		return fields, miniMaxH3ClientError(errors.New("output_compression must be an integer between 0 and 100"))
	}
	switch fields.Area {
	case "", "1K", "2K", "4K":
	default:
		return fields, miniMaxH3ClientError(errors.New("area must be 1K, 2K or 4K"))
	}

	size, aspectRatio, area := fields.Size, fields.AspectRatio, fields.Area
	if size != "" && size != "auto" {
		width, height, ok := parseImageSize(size)
		if !ok {
			return fields, miniMaxH3ClientError(errors.New("size must be WIDTHxHEIGHT"))
		}
		if miniMaxH3SizeSupported(width, height) {
			aspectRatio, area = "", ""
		} else {
			size = ""
			aspectRatio = reduceAspectRatio(width, height)
			area = miniMaxH3AreaForPixels(width * height)
		}
	}
	if aspectRatio != "" {
		if err := miniMaxH3ValidateAspectRatio(aspectRatio); err != nil {
			return fields, err
		}
	}
	fields.Size, fields.AspectRatio, fields.Area = size, aspectRatio, area
	return fields, nil
}

// miniMaxH3ValidatePrompt rejects a blank prompt, which the upstream refuses.
func miniMaxH3ValidatePrompt(prompt string) error {
	if strings.TrimSpace(prompt) == "" {
		return miniMaxH3ClientError(errors.New("prompt is required"))
	}
	return nil
}

// miniMaxH3SizeSupported reports whether an explicit size fits the upstream
// pixel and aspect ratio limits.
func miniMaxH3SizeSupported(width, height int) bool {
	pixels := width * height
	if pixels < miniMaxH3MinPixels || pixels > miniMaxH3MaxPixels {
		return false
	}
	return width*3 >= height && height*3 >= width
}

// miniMaxH3AreaForPixels maps a requested pixel count onto the resolution
// buckets the upstream understands.
func miniMaxH3AreaForPixels(pixels int) string {
	switch {
	case pixels <= 1024*1024:
		return "1K"
	case pixels <= 2048*2048:
		return "2K"
	default:
		return "4K"
	}
}

// miniMaxH3ValidateAspectRatio checks an explicit aspect ratio against the
// upstream limits. The upstream also accepts "auto", which lets it pick the
// ratio from the prompt and the reference images.
func miniMaxH3ValidateAspectRatio(aspectRatio string) error {
	if strings.EqualFold(strings.TrimSpace(aspectRatio), "auto") {
		return nil
	}

	widthText, heightText, ok := strings.Cut(aspectRatio, ":")
	if !ok {
		return miniMaxH3ClientError(errors.New("aspect_ratio must be in the X:Y format"))
	}

	width, err := strconv.Atoi(strings.TrimSpace(widthText))
	if err != nil || width < 1 || width > 300 {
		return miniMaxH3ClientError(errors.New("aspect_ratio must be in the X:Y format with each value between 1 and 300"))
	}
	height, err := strconv.Atoi(strings.TrimSpace(heightText))
	if err != nil || height < 1 || height > 300 {
		return miniMaxH3ClientError(errors.New("aspect_ratio must be in the X:Y format with each value between 1 and 300"))
	}
	if width*3 < height || height*3 < width {
		return miniMaxH3ClientError(errors.New("aspect_ratio must be between 1:3 and 3:1"))
	}
	return nil
}

// miniMaxH3EditReferences reads the reference images of a JSON image edit
// request. OpenAI sends them as "image" or "images", as a URL string, an array
// of URL strings or an array of objects; MiniMax expects a list of objects.
func miniMaxH3EditReferences(request dto.ImageRequest) ([]h3ImageRef, error) {
	raw := request.Images
	if len(raw) == 0 {
		raw = request.Image
	}

	if len(raw) == 0 && strings.TrimSpace((string(raw))) == "null" {
		return nil, miniMaxH3ClientError(errors.New("at least one reference image is required"))
	}

	var single string
	if err := common.Unmarshal(raw, &single); err == nil {
		return miniMaxH3ValidateReferences([]h3ImageRef{{ImageURL: single}})
	}

	var items []json.RawMessage
	if err := common.Unmarshal(raw, &items); err != nil {
		return nil, miniMaxH3ClientError(errors.New("image must be a URL string or an array of image references"))
	}

	references := make([]h3ImageRef, 0, len(items))
	for _, item := range items {
		var url string
		if err := common.Unmarshal(item, &url); err == nil {
			references = append(references, h3ImageRef{ImageURL: url})
			continue
		}
		var object struct {
			ImageURL string `json:"image_url"`
			URL      string `json:"url"`
		}
		if err := common.Unmarshal(item, &object); err != nil {
			return nil, miniMaxH3ClientError(errors.New("image must be a URL string or an object with an image_url field"))
		}
		imageURL := object.ImageURL
		if imageURL == "" {
			imageURL = object.URL
		}
		references = append(references, h3ImageRef{ImageURL: imageURL})
	}
	return miniMaxH3ValidateReferences(references)
}

// miniMaxH3ValidateReferences checks the reference image count and the source
// formats the upstream accepts.
func miniMaxH3ValidateReferences(references []h3ImageRef) ([]h3ImageRef, error) {
	if len(references) == 0 {
		return nil, miniMaxH3ClientError(errors.New("at least one reference image is required"))
	}
	if len(references) > miniMaxH3MaxReferenceImages {
		return nil, miniMaxH3ClientError(fmt.Errorf("at most %d reference images are allowed", miniMaxH3MaxReferenceImages))
	}
	for _, reference := range references {
		if !miniMaxH3SupportedImageSource(reference.ImageURL) {
			return nil, miniMaxH3ClientError(errors.New("reference image must be an http(s) URL, a data:image base64 URI or an mm_file identifier"))
		}
	}
	return references, nil
}

// miniMaxH3SupportedImageSource reports whether the upstream can read the
// reference image from the given source.
func miniMaxH3SupportedImageSource(source string) bool {
	source = strings.TrimSpace(source)
	if source == "" {
		return false
	}

	return strings.HasPrefix(source, "http://") ||
		strings.HasPrefix(source, "https://") ||
		strings.HasPrefix(source, "data:image/") ||
		strings.HasPrefix(source, "mm_file://")
}

// miniMaxH3StringField reads an optional string field from a raw JSON value.
func miniMaxH3StringField(raw json.RawMessage, name string) (string, error) {
	value, err := miniMaxH3Field[string](raw, name)
	if err != nil || value == nil {
		return "", err
	}
	return strings.TrimSpace(*value), nil
}

// miniMaxH3Field reads an optional field from a raw JSON value. The result
// stays a pointer so an explicit zero reaches the upstream.
func miniMaxH3Field[T any](raw json.RawMessage, name string) (*T, error) {
	if len(raw) == 0 || strings.TrimSpace(string(raw)) == "null" {
		return nil, nil
	}
	var value T
	if err := common.Unmarshal(raw, &value); err != nil {
		return nil, miniMaxH3ClientError(fmt.Errorf("invalid %s: %w", name, err))
	}
	return &value, nil
}

// miniMaxH3IsMultipartRequest reports whether the client sent the request as
// multipart form data.
func miniMaxH3IsMultipartRequest(c *gin.Context) bool {
	if c == nil || c.Request == nil {
		return false
	}
	return strings.HasPrefix(c.Request.Header.Get("Content-Type"), "multipart/form-data")
}

// miniMaxH3ClientError builds a client error for a request the upstream would
// refuse, so the relay answers 400 instead of spending a channel retry.
func miniMaxH3ClientError(err error) *types.NewAPIError {
	return types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
}

// miniMaxH3ImageError is the error the upstream reports for one failed image.
type h3ImageError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// miniMaxH3ImageData is one image of a MiniMax H3 image response. A failed
// image carries the error instead of an image payload.
type h3ImageData struct {
	URL           string        `json:"url"`
	B64JSON       string        `json:"b64_json"`
	Size          string        `json:"size"`
	RevisedPrompt string        `json:"revised_prompt"`
	Error         *h3ImageError `json:"error"`
}

// miniMaxH3ImageResponse is the MiniMax H3 image response. It follows the
// OpenAI image shape, so it is forwarded to the client unchanged.
type miniMaxH3ImageResponse struct {
	Created      int64         `json:"created"`
	Data         []h3ImageData `json:"data"`
	OutputFormat string        `json:"output_format"`
	Usage        dto.Usage     `json:"usage"`
	RequestID    string        `json:"request_id"`
}

// miniMaxH3ImageHandler answers a MiniMax H3 image response. The upstream
// reports a failed image as an error object inside the data array and still
// answers 200, so a fully failed request becomes a relay error and refunds
// the reservation instead of billing for images that were never produced.
func miniMaxH3ImageHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}

	var parsed miniMaxH3ImageResponse
	if err := common.Unmarshal(responseBody, &parsed); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	if failed := miniMaxH3FailedImages(parsed.Data); failed != nil {
		return nil, miniMaxH3GenerationFailure(failed.Message, failed.Code)
	}
	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(resp.StatusCode)

	openai.NormalizeOpenAIUsage(&parsed.Usage)
	info.UpdateImageCount(openai.OpenaiImageResponseCount(responseBody))

	// The upstream already generated the images. A failed write only means the client disconnected, so it must not skip settlement.
	_, _ = c.Writer.Write(responseBody)

	return &parsed.Usage, nil
}

// miniMaxH3FailedImages returns the first failed image of a response, or nil
// when the response carries at least one generated image.
func miniMaxH3FailedImages(data []h3ImageData) *h3ImageError {
	if len(data) == 0 {
		return nil
	}
	for _, item := range data {
		if item.Error == nil {
			return nil
		}
	}
	return data[0].Error
}

// miniMaxH3GenerationFailure builds the relay error of a failed MiniMax image
// request, so the reservation is refunded instead of billed for images that
// were never produced.
func miniMaxH3GenerationFailure(message, code string) *types.NewAPIError {
	if code != "" {
		return types.NewErrorWithStatusCode(
			fmt.Errorf("minimax image generation failed: %s (code %s)", message, code),
			types.ErrorCodeBadResponseBody,
			http.StatusBadGateway,
		)
	}
	return types.NewErrorWithStatusCode(
		fmt.Errorf("minimax image generation failed: %s", message),
		types.ErrorCodeBadResponseBody,
		http.StatusBadGateway,
	)
}

// miniMaxH3ImageStreamHandler answers a streaming MiniMax H3 image response.
// Every upstream event is forwarded as it arrives, the generated images are
// counted from the events that carry an image, and the usage is taken from
// the summary event that ends the stream.
func miniMaxH3ImageStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return nil, types.NewOpenAIError(errors.New("invalid response"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}
	if !strings.Contains(strings.ToLower(resp.Header.Get("Content-Type")), "text/event-stream") {
		// The upstream answered with a regular JSON body. Re-emit it as an
		// OpenAI style image stream so the client still receives the images.
		return openai.OpenaiImageStreamHandler(c, info, resp)
	}

	usage := &dto.Usage{}
	var generatedImages int64
	var failed bool
	var failureMessage, failureCode string

	helper.StreamScannerHandler(c, resp, info, func(data string, sr *helper.StreamResult) {
		raw := common.StringToByteSlice(data)
		var event struct {
			Type  string    `json:"type"`
			URL   string    `json:"url"`
			Usage dto.Usage `json:"usage"`
		}
		if err := common.Unmarshal(raw, &event); err == nil {
			openai.NormalizeOpenAIUsage(&event.Usage)
			if service.ValidUsage(&event.Usage) {
				usage = &event.Usage
			}
			switch event.Type {
			case miniMaxH3GenerationPartialSucceeded, miniMaxH3EditPartialSucceeded:
				// Only an event that carries an image bills an image.
				if event.URL != "" {
					generatedImages++
				}
			case "error":
				failed = true
				failureMessage, failureCode = miniMaxH3StreamError(raw)
				sr.Error(errors.New(failureMessage))
			}
		}
		if err := writeMiniMaxH3StreamEvent(c, raw); err != nil {
			sr.Stop(err)
		}
	})

	// The upstream ends its stream with the summary event instead of the
	// OpenAI [DONE] marker, so the marker is added for the clients that wait
	// for it. A stream that ended with an upstream error keeps its own ending.
	if !failed && info.StreamStatus != nil {
		endReason := info.StreamStatus.EndReason
		if endReason == relaycommon.StreamEndReasonDone || endReason == relaycommon.StreamEndReasonEOF {
			helper.Done(c)
		}
	}

	// Only trust a lower image count when the upstream finished the stream. A
	// client that disconnects mid stream leaves the count of the images the
	// upstream already generated and billed unknown, so the requested quantity
	// stays in place. The guard only blocks lowering the charge: more images
	// than requested are billed as they are.
	if info.StreamStatus != nil {
		upstreamFinished := info.StreamStatus.EndReason == relaycommon.StreamEndReasonDone ||
			info.StreamStatus.EndReason == relaycommon.StreamEndReasonEOF
		if upstreamFinished || generatedImages > int64(info.RequestedImageCount()) {
			info.UpdateImageCount(generatedImages)
		}
	}

	// An upstream error event that produced no image is a failed request: it
	// refunds the reservation instead of billing for images that were never
	// produced, like the non-stream path does. The error event already reached
	// the client, so the relay error is returned without writing another body.
	if failed && generatedImages == 0 {
		return nil, miniMaxH3GenerationFailure(failureMessage, failureCode)
	}

	return usage, nil
}

// writeMiniMaxH3StreamEvent forwards one upstream event. The scanner delivers
// the data payload only, so the event name is rebuilt from the JSON type
// field, which the upstream keeps equal to the SSE event name.
func writeMiniMaxH3StreamEvent(c *gin.Context, data []byte) error {
	var payload struct {
		Type string `json:"type"`
	}
	_ = common.Unmarshal(data, &payload)
	if eventName := strings.TrimSpace(payload.Type); eventName != "" {
		return helper.ResponseChunkData(c, dto.ResponsesStreamResponse{Type: eventName}, string(data))
	}
	return helper.StringData(c, string(data))
}

// miniMaxH3StreamError reads the message and the code of an upstream error
// event. The message falls back to a generic text when the event carries
// none.
func miniMaxH3StreamError(data []byte) (message string, code string) {
	var payload struct {
		Error struct {
			Message string          `json:"message"`
			Code    json.RawMessage `json:"code"`
		} `json:"error"`
	}
	if err := common.Unmarshal(data, &payload); err == nil {
		message = strings.TrimSpace(payload.Error.Message)
		code = strings.Trim(strings.TrimSpace(string(payload.Error.Code)), `"`)
		if code == "null" {
			code = ""
		}
	}
	if message == "" {
		message = "upstream image stream returned an error event"
	}
	return message, code
}
