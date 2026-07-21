package dto

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/url"
	"reflect"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// MaxImageN caps the image generation count. Without this bound a huge or
// wrapped-negative n overflows quota calculation into a negative charge.
const MaxImageN = common.MaxImageGenerationCount

// Unified image inputs are intentionally bounded before they reach any
// adaptor. These values protect both request memory and downstream URL fetches.
const (
	MaxUnifiedImageInputURLs      = common.MaxImageInputURLs
	MaxUnifiedImageInputURLLength = 8192
	// Remote URLs are kept short because they are fetched by the worker. Data
	// URLs are allowed to carry the bounded 30 MiB decoded input image; their
	// base64 representation is consequently much larger than this remote URL
	// limit.
	MaxUnifiedImageDataURLLength = (30<<20)*4/3 + 1024
	MaxUnifiedImagePromptLength  = common.MaxImagePromptCharacters
)

type ImageRequest struct {
	Model             string          `json:"model"`
	Prompt            string          `json:"prompt" binding:"required"`
	N                 *uint           `json:"n,omitempty"`
	Size              string          `json:"size,omitempty"`
	Quality           string          `json:"quality,omitempty"`
	ResponseFormat    string          `json:"response_format,omitempty"`
	Style             json.RawMessage `json:"style,omitempty"`
	User              json.RawMessage `json:"user,omitempty"`
	ExtraFields       json.RawMessage `json:"extra_fields,omitempty"`
	Background        json.RawMessage `json:"background,omitempty"`
	Moderation        json.RawMessage `json:"moderation,omitempty"`
	OutputFormat      json.RawMessage `json:"output_format,omitempty"`
	OutputCompression json.RawMessage `json:"output_compression,omitempty"`
	PartialImages     json.RawMessage `json:"partial_images,omitempty"`
	Stream            *bool           `json:"stream,omitempty"`
	Images            json.RawMessage `json:"images,omitempty"`
	Mask              json.RawMessage `json:"mask,omitempty"`
	InputFidelity     json.RawMessage `json:"input_fidelity,omitempty"`
	Watermark         *bool           `json:"watermark,omitempty"`
	// zhipu 4v
	WatermarkEnabled json.RawMessage `json:"watermark_enabled,omitempty"`
	UserId           json.RawMessage `json:"user_id,omitempty"`
	Image            json.RawMessage `json:"image,omitempty"`
	// Gateway-only async controls. They are parsed explicitly in UnmarshalJSON
	// and excluded from MarshalJSON so they are never forwarded to providers.
	Async         *bool  `json:"-"`
	WebhookURL    string `json:"-"`
	WebhookSecret string `json:"-"`
	// 用匿名参数接收额外参数
	Extra map[string]json.RawMessage `json:"-"`

	// unifiedInput records that the request used the gateway's nested input
	// envelope. It is intentionally not serialized or exposed as a JSON field.
	unifiedInput bool
	// imageSelectionRequirement is resolved before billing and channel retry so
	// every stage uses the same canonical image variant.
	imageSelectionRequirement *ImageSelectionRequirement
	// Multipart file metadata is resolved by the reusable request parser before
	// channel selection. File bytes remain in gin's multipart form and are never
	// serialized into the provider request DTO.
	multipartReferenceImageCount int
	multipartHasMask             bool
}

func (i *ImageRequest) UnmarshalJSON(data []byte) error {
	var rawMap map[string]json.RawMessage
	if err := common.Unmarshal(data, &rawMap); err != nil {
		return err
	}

	// 用 struct tag 获取所有已定义字段名
	knownFields := GetJSONFieldNames(reflect.TypeOf(*i))

	// 再正常解析已定义字段
	type Alias ImageRequest
	var known Alias
	if err := common.Unmarshal(data, &known); err != nil {
		return err
	}
	*i = ImageRequest(known)
	i.unifiedInput = false
	if raw, ok := rawMap["async"]; ok {
		if err := common.Unmarshal(raw, &i.Async); err != nil {
			return err
		}
	}
	if raw, ok := rawMap["webhook_url"]; ok {
		if err := common.Unmarshal(raw, &i.WebhookURL); err != nil {
			return err
		}
	}
	if raw, ok := rawMap["webhook_secret"]; ok {
		if err := common.Unmarshal(raw, &i.WebhookSecret); err != nil {
			return err
		}
	}
	if raw, ok := rawMap["callBackUrl"]; ok {
		callbackURL, err := decodeStringField(raw, "callBackUrl")
		if err != nil {
			return err
		}
		if _, hasWebhook := rawMap["webhook_url"]; hasWebhook && i.WebhookURL != callbackURL {
			return fmt.Errorf("conflicting callback URL values")
		}
		i.WebhookURL = callbackURL
	}

	// 提取多余字段
	i.Extra = make(map[string]json.RawMessage)
	for k, v := range rawMap {
		switch k {
		case "async", "webhook_url", "webhook_secret", "callBackUrl", "input":
			continue
		}
		if _, ok := knownFields[k]; !ok {
			i.Extra[k] = v
		}
	}

	if rawInput, ok := rawMap["input"]; ok {
		if err := i.normalizeUnifiedInput(rawInput, rawMap); err != nil {
			return err
		}
	}
	return nil
}

// HasUnifiedImageInput reports whether the request contained the nested
// `input` envelope used by unified image APIs.
func (i ImageRequest) HasUnifiedImageInput() bool {
	return i.unifiedInput
}

func (i *ImageRequest) SetMultipartImageSelectionMeta(referenceImageCount int, hasMask bool) {
	if i == nil {
		return
	}
	i.multipartReferenceImageCount = referenceImageCount
	i.multipartHasMask = hasMask
}

func (i ImageRequest) MultipartImageSelectionMeta() (int, bool) {
	return i.multipartReferenceImageCount, i.multipartHasMask
}

// ImageInputURLs returns the validated image URLs carried by the request's
// `images` field. Nested unified aliases are normalized into this field during
// JSON decoding.
func (i ImageRequest) ImageInputURLs() ([]string, error) {
	if len(bytes.TrimSpace(i.Images)) == 0 || common.GetJsonType(i.Images) == "null" {
		return nil, nil
	}
	return parseUnifiedImageURLs(i.Images, "images")
}

func (i *ImageRequest) normalizeUnifiedInput(rawInput json.RawMessage, topLevel map[string]json.RawMessage) error {
	if common.GetJsonType(rawInput) != "object" {
		return fmt.Errorf("input must be an object")
	}

	var input map[string]json.RawMessage
	if err := common.Unmarshal(rawInput, &input); err != nil {
		return fmt.Errorf("invalid input object: %w", err)
	}
	if err := i.mergeNestedAsyncControls(input, topLevel); err != nil {
		return err
	}
	if isProviderNativeImageInput(input) {
		// Some legacy non-unified image handlers still decode provider-native
		// payloads from the top-level `input` object. Preserve that DTO shape for
		// those handlers, while removing gateway-only delivery controls. The
		// unified asynchronous generation endpoint rejects this shape later and
		// requires input.prompt plus input.image_input instead.
		providerInput := make(map[string]json.RawMessage, len(input))
		for key, value := range input {
			if isAsyncImageGatewayField(key) {
				continue
			}
			providerInput[key] = cloneRawMessage(value)
		}
		encoded, err := common.Marshal(providerInput)
		if err != nil {
			return fmt.Errorf("sanitize provider image input: %w", err)
		}
		i.Extra["input"] = encoded
		if rawPrompt, ok := input["prompt"]; ok && strings.TrimSpace(i.Prompt) == "" {
			prompt, err := decodeStringField(rawPrompt, "input.prompt")
			if err != nil {
				return err
			}
			if utf8.RuneCountInString(prompt) > MaxUnifiedImagePromptLength {
				return fmt.Errorf("input.prompt is too long (max %d characters)", MaxUnifiedImagePromptLength)
			}
			i.Prompt = prompt
		}
		return nil
	}
	i.unifiedInput = true

	if rawPrompt, ok := input["prompt"]; ok {
		prompt, err := decodeStringField(rawPrompt, "input.prompt")
		if err != nil {
			return err
		}
		if utf8.RuneCountInString(prompt) > MaxUnifiedImagePromptLength {
			return fmt.Errorf("input.prompt is too long (max %d characters)", MaxUnifiedImagePromptLength)
		}
		if rawTopPrompt, exists := topLevel["prompt"]; exists && common.GetJsonType(rawTopPrompt) != "null" {
			if i.Prompt != prompt {
				return fmt.Errorf("conflicting prompt values")
			}
		} else {
			i.Prompt = prompt
		}
	}

	if err := i.normalizeUnifiedImageAliases(input, topLevel); err != nil {
		return err
	}

	for _, field := range unifiedImageFieldNames {
		rawValue, ok := input[field]
		if !ok {
			continue
		}
		if err := i.mergeUnifiedKnownField(field, rawValue, topLevel); err != nil {
			return err
		}
	}

	for key, value := range input {
		if isUnifiedImageHandledField(key) {
			continue
		}
		if existing, exists := i.Extra[key]; exists && !jsonRawValuesEqual(existing, value) {
			return fmt.Errorf("conflicting %s values", key)
		}
		i.Extra[key] = append(json.RawMessage(nil), value...)
	}
	return nil
}

func isProviderNativeImageInput(input map[string]json.RawMessage) bool {
	for _, field := range []string{"images", "image_input", "input_urls", "aspect_ratio", "resolution"} {
		if _, ok := input[field]; ok {
			return false
		}
	}
	for _, field := range []string{"messages", "num_outputs"} {
		if _, ok := input[field]; ok {
			return true
		}
	}
	return false
}

func isAsyncImageGatewayField(key string) bool {
	switch key {
	case "async", "webhook_url", "webhook_secret", "callBackUrl":
		return true
	default:
		return false
	}
}

func (i *ImageRequest) mergeNestedAsyncControls(input, topLevel map[string]json.RawMessage) error {
	if rawAsync, ok := input["async"]; ok {
		if topAsync, exists := topLevel["async"]; exists && !jsonRawValuesEqual(topAsync, rawAsync) {
			return fmt.Errorf("conflicting async values")
		}
		if err := common.Unmarshal(rawAsync, &i.Async); err != nil {
			return fmt.Errorf("input.async must be a boolean: %w", err)
		}
	}
	if rawSecret, ok := input["webhook_secret"]; ok {
		if topSecret, exists := topLevel["webhook_secret"]; exists && !jsonRawValuesEqual(topSecret, rawSecret) {
			return fmt.Errorf("conflicting webhook_secret values")
		}
		secret, err := decodeStringField(rawSecret, "input.webhook_secret")
		if err != nil {
			return err
		}
		i.WebhookSecret = secret
	}

	callbackURL := i.WebhookURL
	callbackPresent := false
	if _, ok := topLevel["webhook_url"]; ok {
		callbackPresent = true
	}
	if _, ok := topLevel["callBackUrl"]; ok {
		callbackPresent = true
	}
	for _, field := range []string{"callBackUrl", "webhook_url"} {
		rawCallback, ok := input[field]
		if !ok {
			continue
		}
		value, err := decodeStringField(rawCallback, "input."+field)
		if err != nil {
			return err
		}
		if callbackPresent && callbackURL != value {
			return fmt.Errorf("conflicting callback URL values")
		}
		callbackURL = value
		callbackPresent = true
	}
	if callbackPresent {
		i.WebhookURL = callbackURL
	}
	return nil
}

var unifiedImageFieldNames = []string{
	"model",
	"n",
	"size",
	"quality",
	"response_format",
	"style",
	"user",
	"extra_fields",
	"background",
	"moderation",
	"output_format",
	"output_compression",
	"partial_images",
	"stream",
	"mask",
	"input_fidelity",
	"watermark",
	"watermark_enabled",
	"user_id",
	"image",
	"async",
	"webhook_secret",
}

func isUnifiedImageHandledField(key string) bool {
	if key == "prompt" || key == "images" || key == "image_input" || key == "input_urls" || key == "callBackUrl" || key == "webhook_url" {
		return true
	}
	for _, field := range unifiedImageFieldNames {
		if key == field {
			return true
		}
	}
	return false
}

func (i *ImageRequest) normalizeUnifiedImageAliases(input, topLevel map[string]json.RawMessage) error {
	var normalized []string
	var seen bool
	for _, field := range []string{"images", "image_input", "input_urls"} {
		rawValue, ok := input[field]
		if !ok {
			continue
		}
		urls, err := parseUnifiedImageURLs(rawValue, "input."+field)
		if err != nil {
			return err
		}
		if seen && !stringSlicesEqual(normalized, urls) {
			return fmt.Errorf("conflicting image input values")
		}
		normalized = urls
		seen = true
	}
	if !seen {
		return nil
	}

	if rawTopImages, ok := topLevel["images"]; ok {
		topURLs, err := parseUnifiedImageURLs(rawTopImages, "images")
		if err != nil {
			return err
		}
		if !stringSlicesEqual(topURLs, normalized) {
			return fmt.Errorf("conflicting image input values")
		}
	}

	encoded, err := common.Marshal(normalized)
	if err != nil {
		return fmt.Errorf("failed to normalize image input: %w", err)
	}
	i.Images = json.RawMessage(encoded)
	return nil
}

func (i *ImageRequest) mergeUnifiedKnownField(field string, rawValue json.RawMessage, topLevel map[string]json.RawMessage) error {
	if rawTopValue, exists := topLevel[field]; exists {
		if !jsonRawValuesEqual(rawTopValue, rawValue) {
			return fmt.Errorf("conflicting %s values", field)
		}
		return nil
	}

	switch field {
	case "model":
		return common.Unmarshal(rawValue, &i.Model)
	case "n":
		return common.Unmarshal(rawValue, &i.N)
	case "size":
		return common.Unmarshal(rawValue, &i.Size)
	case "quality":
		return common.Unmarshal(rawValue, &i.Quality)
	case "response_format":
		return common.Unmarshal(rawValue, &i.ResponseFormat)
	case "stream":
		return common.Unmarshal(rawValue, &i.Stream)
	case "watermark":
		return common.Unmarshal(rawValue, &i.Watermark)
	case "async":
		return common.Unmarshal(rawValue, &i.Async)
	case "webhook_secret":
		return common.Unmarshal(rawValue, &i.WebhookSecret)
	case "style":
		i.Style = cloneRawMessage(rawValue)
	case "user":
		i.User = cloneRawMessage(rawValue)
	case "extra_fields":
		i.ExtraFields = cloneRawMessage(rawValue)
	case "background":
		i.Background = cloneRawMessage(rawValue)
	case "moderation":
		i.Moderation = cloneRawMessage(rawValue)
	case "output_format":
		i.OutputFormat = cloneRawMessage(rawValue)
	case "output_compression":
		i.OutputCompression = cloneRawMessage(rawValue)
	case "partial_images":
		i.PartialImages = cloneRawMessage(rawValue)
	case "mask":
		i.Mask = cloneRawMessage(rawValue)
	case "input_fidelity":
		i.InputFidelity = cloneRawMessage(rawValue)
	case "watermark_enabled":
		i.WatermarkEnabled = cloneRawMessage(rawValue)
	case "user_id":
		i.UserId = cloneRawMessage(rawValue)
	case "image":
		i.Image = cloneRawMessage(rawValue)
	}
	return nil
}

func parseUnifiedImageURLs(raw json.RawMessage, field string) ([]string, error) {
	if common.GetJsonType(raw) == "null" {
		return nil, fmt.Errorf("%s must contain image URLs", field)
	}

	var rawValues []json.RawMessage
	switch common.GetJsonType(raw) {
	case "string":
		rawValues = []json.RawMessage{cloneRawMessage(raw)}
	case "array":
		if err := common.Unmarshal(raw, &rawValues); err != nil {
			return nil, fmt.Errorf("invalid %s image URL list: %w", field, err)
		}
	default:
		return nil, fmt.Errorf("%s must be a string or an array of image URLs", field)
	}
	if len(rawValues) > MaxUnifiedImageInputURLs {
		return nil, fmt.Errorf("too many image URLs in %s (max %d)", field, MaxUnifiedImageInputURLs)
	}

	urls := make([]string, 0, len(rawValues))
	for idx, rawValue := range rawValues {
		value, err := decodeStringField(rawValue, fmt.Sprintf("%s[%d]", field, idx))
		if err != nil {
			return nil, err
		}
		validated, err := validateUnifiedImageURL(value, field)
		if err != nil {
			return nil, err
		}
		urls = append(urls, validated)
	}
	return urls, nil
}

func validateUnifiedImageURL(rawURL, field string) (string, error) {
	value := strings.TrimSpace(rawURL)
	if value == "" {
		return "", fmt.Errorf("%s contains an empty image URL", field)
	}

	parsed, err := url.Parse(value)
	if err != nil {
		return "", fmt.Errorf("%s contains a malformed image URL: %w", field, err)
	}
	switch strings.ToLower(parsed.Scheme) {
	case "http", "https":
		if len(value) > MaxUnifiedImageInputURLLength {
			return "", fmt.Errorf("%s contains an image URL that is too long (max %d characters)", field, MaxUnifiedImageInputURLLength)
		}
		if parsed.Host == "" {
			return "", fmt.Errorf("%s contains an image URL without a host", field)
		}
	case "data":
		if len(value) > MaxUnifiedImageDataURLLength {
			return "", fmt.Errorf("%s contains a data image URL that is too long (max %d characters)", field, MaxUnifiedImageDataURLLength)
		}
		comma := strings.IndexByte(parsed.Opaque, ',')
		if comma <= 0 || comma == len(parsed.Opaque)-1 {
			return "", fmt.Errorf("%s contains a malformed data image URL", field)
		}
		metadata := strings.Split(parsed.Opaque[:comma], ";")
		mimeType := strings.ToLower(strings.TrimSpace(metadata[0]))
		switch mimeType {
		case "image/png", "image/jpeg", "image/jpg", "image/webp":
		default:
			return "", fmt.Errorf("%s contains an unsupported data image MIME type", field)
		}
		if !strings.Contains(strings.ToLower(parsed.Opaque[:comma]), ";base64") {
			return "", fmt.Errorf("%s contains a non-base64 data image URL", field)
		}
	default:
		return "", fmt.Errorf("%s contains an unsupported image URL scheme", field)
	}
	return value, nil
}

func decodeStringField(raw json.RawMessage, field string) (string, error) {
	var value string
	if err := common.Unmarshal(raw, &value); err != nil {
		return "", fmt.Errorf("%s must be a string: %w", field, err)
	}
	return value, nil
}

func cloneRawMessage(raw json.RawMessage) json.RawMessage {
	return append(json.RawMessage(nil), raw...)
}

func stringSlicesEqual(left, right []string) bool {
	if len(left) != len(right) {
		return false
	}
	for idx := range left {
		if left[idx] != right[idx] {
			return false
		}
	}
	return true
}

func jsonRawValuesEqual(left, right json.RawMessage) bool {
	var leftValue, rightValue any
	if err := common.Unmarshal(left, &leftValue); err != nil {
		return bytes.Equal(bytes.TrimSpace(left), bytes.TrimSpace(right))
	}
	if err := common.Unmarshal(right, &rightValue); err != nil {
		return bytes.Equal(bytes.TrimSpace(left), bytes.TrimSpace(right))
	}
	leftCanonical, leftErr := common.Marshal(leftValue)
	rightCanonical, rightErr := common.Marshal(rightValue)
	if leftErr != nil || rightErr != nil {
		return bytes.Equal(bytes.TrimSpace(left), bytes.TrimSpace(right))
	}
	return bytes.Equal(leftCanonical, rightCanonical)
}

// 序列化时需要重新把字段平铺
func (r ImageRequest) MarshalJSON() ([]byte, error) {
	// 将已定义字段转为 map
	type Alias ImageRequest
	alias := Alias(r)
	base, err := common.Marshal(alias)
	if err != nil {
		return nil, err
	}

	var baseMap map[string]json.RawMessage
	if err := common.Unmarshal(base, &baseMap); err != nil {
		return nil, err
	}

	// 不能合并ExtraFields！！！！！！！！
	// 合并 ExtraFields
	//for k, v := range r.Extra {
	//	if _, exists := baseMap[k]; !exists {
	//		baseMap[k] = v
	//	}
	//}

	return common.Marshal(baseMap)
}

func GetJSONFieldNames(t reflect.Type) map[string]struct{} {
	fields := make(map[string]struct{})
	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)

		// 跳过匿名字段（例如 ExtraFields）
		if field.Anonymous {
			continue
		}

		tag := field.Tag.Get("json")
		if tag == "-" || tag == "" {
			continue
		}

		// 取逗号前字段名（排除 omitempty 等）
		name := tag
		if commaIdx := indexComma(tag); commaIdx != -1 {
			name = tag[:commaIdx]
		}
		fields[name] = struct{}{}
	}
	return fields
}

func indexComma(s string) int {
	for i := 0; i < len(s); i++ {
		if s[i] == ',' {
			return i
		}
	}
	return -1
}

func (i *ImageRequest) GetTokenCountMeta() *types.TokenCountMeta {
	var sizeRatio = 1.0
	var qualityRatio = 1.0

	if strings.HasPrefix(i.Model, "dall-e") {
		// Size
		if i.Size == "256x256" {
			sizeRatio = 0.4
		} else if i.Size == "512x512" {
			sizeRatio = 0.45
		} else if i.Size == "1024x1024" {
			sizeRatio = 1
		} else if i.Size == "1024x1792" || i.Size == "1792x1024" {
			sizeRatio = 2
		}

		if i.Model == "dall-e-3" && i.Quality == "hd" {
			qualityRatio = 2.0
			if i.Size == "1024x1792" || i.Size == "1792x1024" {
				qualityRatio = 1.5
			}
		}
	}

	imageN := uint(1)
	if i.N != nil && *i.N > 0 {
		imageN = *i.N
	}

	// Keep n separate from ImagePriceRatio so size/quality and count remain
	// independent billing dimensions. Fixed-price pre-consume stores this on
	// PriceData, and image settlement reuses or replaces the same "n" ratio.
	return &types.TokenCountMeta{
		CombineText:     i.Prompt,
		MaxTokens:       1584,
		ImagePriceRatio: sizeRatio * qualityRatio,
		BillingRatios:   map[string]float64{"n": float64(imageN)},
		ImageResolution: i.imageBillingResolution(),
	}
}

func (i *ImageRequest) IsStream(c *gin.Context) bool {
	return i.Stream != nil && *i.Stream
}

func (i *ImageRequest) SetModelName(modelName string) {
	if modelName != "" {
		i.Model = modelName
	}
}

type ImageResponse struct {
	Data     []ImageData     `json:"data"`
	Created  int64           `json:"created"`
	Metadata json.RawMessage `json:"metadata,omitempty"`
}
type ImageData struct {
	Url           string `json:"url"`
	B64Json       string `json:"b64_json"`
	RevisedPrompt string `json:"revised_prompt"`
}
