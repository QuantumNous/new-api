package groksubscription

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

const maxGrokEditImages = 3
const maxGrokMultipartImageBytes = 32 << 20

var ensureMediaCredentialForImage = EnsureMediaCredential

type xAIImageRequest struct {
	Model          string          `json:"model"`
	Prompt         string          `json:"prompt"`
	N              *uint           `json:"n,omitempty"`
	ResponseFormat *string         `json:"response_format,omitempty"`
	AspectRatio    *string         `json:"aspect_ratio,omitempty"`
	Resolution     *string         `json:"resolution,omitempty"`
	Quality        *string         `json:"quality,omitempty"`
	Image          *xAIMediaInput  `json:"image,omitempty"`
	Images         []xAIMediaInput `json:"images,omitempty"`
}

type xAIMediaInput struct {
	Type     string           `json:"type"`
	ImageURL xAIMediaImageURL `json:"image_url"`
}

type xAIMediaImageURL struct {
	URL string `json:"url"`
}

func convertGrokImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	if err := validateGrokImageScalars(request); err != nil {
		return nil, err
	}
	out := xAIImageRequest{
		Model:  GrokImageModel,
		Prompt: strings.TrimSpace(request.Prompt),
	}
	n := uint(1)
	if request.N != nil {
		n = *request.N
	}
	out.N = &n
	setStringPtr(&out.ResponseFormat, request.ResponseFormat)
	setStringPtr(&out.Resolution, request.Resolution)
	setStringPtr(&out.Quality, request.Quality)

	mode := relayconstant.RelayModeImagesGenerations
	if info != nil {
		mode = info.RelayMode
	}
	switch mode {
	case relayconstant.RelayModeImagesGenerations:
		setStringPtr(&out.AspectRatio, request.AspectRatio)
		return out, nil
	case relayconstant.RelayModeImagesEdits:
		images, err := collectGrokEditImages(c, request)
		if err != nil {
			return nil, grokImageValidationError(err.Error())
		}
		if len(images) == 1 && strings.TrimSpace(request.AspectRatio) != "" {
			return nil, grokImageValidationError("grok image: aspect_ratio is not allowed for single-image edits")
		}
		if len(images) > 1 {
			setStringPtr(&out.AspectRatio, request.AspectRatio)
			out.Images = images
		} else {
			out.Image = &images[0]
		}
		return out, nil
	default:
		return nil, grokImageValidationError("grok image: unsupported image relay mode")
	}
}

func validateGrokImageScalars(request dto.ImageRequest) error {
	if strings.TrimSpace(request.Model) != GrokImageModel {
		return grokImageValidationError("grok image: model must be " + GrokImageModel)
	}
	if strings.TrimSpace(request.Prompt) == "" {
		return grokImageValidationError("grok image: prompt is required")
	}
	if request.N != nil && (*request.N < 1 || *request.N > 10) {
		return grokImageValidationError("grok image: n must be between 1 and 10")
	}
	if !validOptionalValue(request.ResponseFormat, map[string]struct{}{"url": {}, "b64_json": {}}) {
		return grokImageValidationError("grok image: response_format must be url or b64_json")
	}
	if !validOptionalValue(request.Resolution, map[string]struct{}{"1k": {}, "2k": {}}) {
		return grokImageValidationError("grok image: resolution must be 1k or 2k")
	}
	if !validOptionalValue(request.Quality, map[string]struct{}{"low": {}, "medium": {}}) {
		return grokImageValidationError("grok image: quality must be low or medium")
	}
	if !validOptionalValue(request.AspectRatio, allowedGrokAspectRatios()) {
		return grokImageValidationError("grok image: aspect_ratio is not supported")
	}
	if rawPresent(request.Mask) {
		return grokImageValidationError("grok image: mask is not supported")
	}
	if rawPresent(request.User) {
		return grokImageValidationError("grok image: user is not supported")
	}
	if rawPresent(request.Extra["file_id"]) {
		return grokImageValidationError("grok image: file_id is not supported")
	}
	if rawPresent(request.Extra["storage_options"]) {
		return grokImageValidationError("grok image: storage_options is not supported")
	}
	return nil
}

func allowedGrokAspectRatios() map[string]struct{} {
	return map[string]struct{}{
		"1:1": {}, "16:9": {}, "9:16": {}, "4:3": {}, "3:4": {}, "3:2": {}, "2:3": {},
		"2:1": {}, "1:2": {}, "19.5:9": {}, "9:19.5": {}, "20:9": {}, "9:20": {}, "auto": {},
	}
}

func validOptionalValue(value string, allowed map[string]struct{}) bool {
	value = strings.TrimSpace(value)
	if value == "" {
		return true
	}
	_, ok := allowed[value]
	return ok
}

func rawPresent(raw json.RawMessage) bool {
	s := strings.TrimSpace(string(raw))
	return s != "" && s != "null"
}

func setStringPtr(target **string, value string) {
	value = strings.TrimSpace(value)
	if value != "" {
		v := value
		*target = &v
	}
}

func grokImageValidationError(message string) *types.NewAPIError {
	return types.NewErrorWithStatusCode(errors.New(message), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
}

func collectGrokEditImages(c *gin.Context, request dto.ImageRequest) ([]xAIMediaInput, error) {
	if isGrokMultipartRequest(c) {
		return collectGrokMultipartEditImages(c)
	}
	return collectGrokJSONEditImages(request)
}

func isGrokMultipartRequest(c *gin.Context) bool {
	return c != nil && c.Request != nil && strings.Contains(c.Request.Header.Get("Content-Type"), "multipart/form-data")
}

func collectGrokJSONEditImages(request dto.ImageRequest) ([]xAIMediaInput, error) {
	var values []json.RawMessage
	if rawPresent(request.Image) {
		values = append(values, request.Image)
	}
	if rawPresent(request.Images) {
		var many []json.RawMessage
		if err := common.Unmarshal(request.Images, &many); err != nil {
			return nil, fmt.Errorf("grok image: images must be an array")
		}
		values = append(values, many...)
	}
	if len(values) == 0 {
		return nil, errors.New("grok image: edit requires 1 to 3 source images")
	}
	if len(values) > maxGrokEditImages {
		return nil, fmt.Errorf("grok image: edit accepts at most %d source images", maxGrokEditImages)
	}
	out := make([]xAIMediaInput, 0, len(values))
	for _, raw := range values {
		input, err := parseGrokMediaInput(raw)
		if err != nil {
			return nil, err
		}
		out = append(out, input)
	}
	return out, nil
}

func parseGrokMediaInput(raw json.RawMessage) (xAIMediaInput, error) {
	var s string
	if err := common.Unmarshal(raw, &s); err == nil {
		return newGrokMediaInput(s)
	}
	var obj struct {
		URL      string `json:"url"`
		B64JSON  string `json:"b64_json"`
		ImageURL *struct {
			URL string `json:"url"`
		} `json:"image_url"`
	}
	if err := common.Unmarshal(raw, &obj); err != nil {
		return xAIMediaInput{}, fmt.Errorf("grok image: image must be a URL or data URI string/object")
	}
	switch {
	case obj.URL != "":
		return newGrokMediaInput(obj.URL)
	case obj.B64JSON != "":
		return newGrokMediaInput("data:image/png;base64," + obj.B64JSON)
	case obj.ImageURL != nil && obj.ImageURL.URL != "":
		return newGrokMediaInput(obj.ImageURL.URL)
	default:
		return xAIMediaInput{}, fmt.Errorf("grok image: image object must include url or b64_json")
	}
}

func newGrokMediaInput(value string) (xAIMediaInput, error) {
	value = strings.TrimSpace(value)
	if err := validateGrokMediaURL(value); err != nil {
		return xAIMediaInput{}, err
	}
	return xAIMediaInput{Type: "image_url", ImageURL: xAIMediaImageURL{URL: value}}, nil
}

func validateGrokMediaURL(value string) error {
	if value == "" {
		return fmt.Errorf("grok image: image is empty")
	}
	if strings.HasPrefix(value, "data:") {
		if strings.HasPrefix(value, "data:image/png;base64,") || strings.HasPrefix(value, "data:image/jpeg;base64,") {
			return nil
		}
		return fmt.Errorf("grok image: only JPEG and PNG data URIs are supported")
	}
	parsed, err := url.Parse(value)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" {
		return fmt.Errorf("grok image: image URL must be HTTPS")
	}
	return nil
}

func collectGrokMultipartEditImages(c *gin.Context) ([]xAIMediaInput, error) {
	if c == nil || c.Request == nil {
		return nil, errors.New("grok image: multipart edit requires request context")
	}
	mf := c.Request.MultipartForm
	if mf == nil {
		var err error
		mf, err = common.ParseMultipartFormReusable(c)
		if err != nil {
			return nil, fmt.Errorf("grok image: failed to parse multipart form: %w", err)
		}
		c.Request.MultipartForm = mf
	}
	if mf == nil {
		return nil, errors.New("grok image: edit requires image")
	}
	if len(collectGrokMultipartFiles(mf, "mask")) > 0 {
		return nil, errors.New("grok image: mask is not supported")
	}
	sources := collectGrokMultipartSources(mf, "image")
	if len(sources) == 0 {
		return nil, errors.New("grok image: edit requires image")
	}
	if len(sources) > maxGrokEditImages {
		return nil, fmt.Errorf("grok image: edit accepts at most %d source images", maxGrokEditImages)
	}
	out := make([]xAIMediaInput, 0, len(sources))
	for i, source := range sources {
		input, err := source.toMediaInput()
		if err != nil {
			return nil, fmt.Errorf("grok image: image %d: %w", i, err)
		}
		out = append(out, input)
	}
	return out, nil
}

type grokMultipartImageSource struct {
	text string
	file *multipart.FileHeader
}

func (s grokMultipartImageSource) toMediaInput() (xAIMediaInput, error) {
	if s.file != nil {
		dataURI, err := grokMultipartFileToDataURI(s.file)
		if err != nil {
			return xAIMediaInput{}, err
		}
		return newGrokMediaInput(dataURI)
	}
	return newGrokMediaInput(s.text)
}

func collectGrokMultipartSources(mf *multipart.Form, field string) []grokMultipartImageSource {
	var out []grokMultipartImageSource
	for _, name := range grokMultipartFieldOrder(mf, field) {
		for _, value := range mf.Value[name] {
			out = append(out, grokMultipartImageSource{text: value})
		}
		for _, file := range mf.File[name] {
			out = append(out, grokMultipartImageSource{file: file})
		}
	}
	return out
}

func collectGrokMultipartFiles(mf *multipart.Form, field string) []*multipart.FileHeader {
	var out []*multipart.FileHeader
	for _, name := range grokMultipartFieldOrder(mf, field) {
		out = append(out, mf.File[name]...)
	}
	return out
}

func grokMultipartFieldOrder(mf *multipart.Form, field string) []string {
	names := []string{field, field + "[]"}
	var bracket []string
	for name := range mf.File {
		if name != field+"[]" && strings.HasPrefix(name, field+"[") && strings.HasSuffix(name, "]") {
			bracket = append(bracket, name)
		}
	}
	for name := range mf.Value {
		if name != field+"[]" && strings.HasPrefix(name, field+"[") && strings.HasSuffix(name, "]") {
			bracket = append(bracket, name)
		}
	}
	sort.SliceStable(bracket, func(i, j int) bool {
		ni, oki := grokBracketIndex(field, bracket[i])
		nj, okj := grokBracketIndex(field, bracket[j])
		if oki && okj {
			return ni < nj
		}
		if oki != okj {
			return oki
		}
		return bracket[i] < bracket[j]
	})
	for _, name := range bracket {
		if len(names) == 0 || names[len(names)-1] != name {
			names = append(names, name)
		}
	}
	return names
}

func grokBracketIndex(field, name string) (int, bool) {
	inner := strings.TrimSuffix(strings.TrimPrefix(name, field+"["), "]")
	if inner == "" {
		return 0, false
	}
	n, err := strconv.Atoi(inner)
	if err != nil || n < 0 {
		return 0, false
	}
	return n, true
}

func grokMultipartFileToDataURI(fh *multipart.FileHeader) (string, error) {
	f, err := fh.Open()
	if err != nil {
		return "", fmt.Errorf("open upload: %w", err)
	}
	defer f.Close()
	data, err := io.ReadAll(io.LimitReader(f, maxGrokMultipartImageBytes+1))
	if err != nil {
		return "", fmt.Errorf("read upload: %w", err)
	}
	if int64(len(data)) > maxGrokMultipartImageBytes {
		return "", fmt.Errorf("upload exceeds %d bytes", maxGrokMultipartImageBytes)
	}
	if len(data) == 0 {
		return "", errors.New("empty upload")
	}
	mimeType := fh.Header.Get("Content-Type")
	if mimeType == "" || mimeType == "application/octet-stream" {
		mimeType = http.DetectContentType(data)
	}
	switch mimeType {
	case "image/jpeg", "image/png":
	default:
		return "", fmt.Errorf("only JPEG and PNG uploads are supported")
	}
	return "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(data), nil
}
