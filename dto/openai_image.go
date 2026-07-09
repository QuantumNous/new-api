package dto

import (
	"encoding/json"
	"math"
	"reflect"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
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
	// Stream            bool            `json:"stream,omitempty"`
	Watermark *bool `json:"watermark,omitempty"`
	// zhipu 4v
	WatermarkEnabled json.RawMessage `json:"watermark_enabled,omitempty"`
	UserId           json.RawMessage `json:"user_id,omitempty"`
	Image            json.RawMessage `json:"image,omitempty"`
	// 用匿名参数接收额外参数
	Extra map[string]json.RawMessage `json:"-"`
}

func (i *ImageRequest) UnmarshalJSON(data []byte) error {
	// 先解析成 map[string]interface{}
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

	// 提取多余字段
	i.Extra = make(map[string]json.RawMessage)
	for k, v := range rawMap {
		if _, ok := knownFields[k]; !ok {
			i.Extra[k] = v
		}
	}
	return nil
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

func normalizeImageQuality(quality string) string {
	switch strings.ToLower(strings.TrimSpace(quality)) {
	case "low", "medium", "high":
		return strings.ToLower(strings.TrimSpace(quality))
	default:
		return "medium"
	}
}

func parseImageSize(size string) (int, int, bool) {
	size = strings.ToLower(strings.TrimSpace(size))
	if size == "" || size == "auto" {
		size = "1024x1024"
	}
	parts := strings.Split(strings.ToLower(strings.TrimSpace(size)), "x")
	if len(parts) != 2 {
		return 0, 0, false
	}
	width := common.String2Int(strings.TrimSpace(parts[0]))
	height := common.String2Int(strings.TrimSpace(parts[1]))
	if width <= 0 || height <= 0 {
		return 0, 0, false
	}
	return width, height, true
}

func imageSizeTier(size string) (string, bool) {
	width, height, ok := parseImageSize(size)
	if !ok {
		return "", false
	}
	longEdge := width
	if height > longEdge {
		longEdge = height
	}
	switch {
	case longEdge <= 1024:
		return "1k", true
	case longEdge <= 2048:
		return "2k", true
	case longEdge <= 4096:
		return "4k", true
	default:
		return "", false
	}
}

func imageGroupUnitPrice(size string) (float64, bool) {
	tier, ok := imageSizeTier(size)
	if !ok {
		return 0, false
	}
	switch tier {
	case "1k":
		return 0.10, true
	case "2k":
		return 0.14, true
	case "4k":
		return 0.20, true
	}
	return 0, false
}

func gptImage2UnitPrice(size string, quality string) (float64, bool) {
	width, height, ok := parseImageSize(size)
	if !ok {
		return 0, false
	}
	if width%16 != 0 || height%16 != 0 {
		return 0, false
	}
	pixels := width * height
	if pixels < 655360 || pixels > 8294400 {
		return 0, false
	}
	longEdge := width
	shortEdge := height
	if height > width {
		longEdge = height
		shortEdge = width
	}
	if longEdge > 3840 || float64(longEdge)/float64(shortEdge) > 3 {
		return 0, false
	}

	qualityGrid := map[string]int{
		"low":    16,
		"medium": 48,
		"high":   96,
	}[normalizeImageQuality(quality)]
	shortGrid := int(math.Round(float64(qualityGrid) * float64(shortEdge) / float64(longEdge)))
	widthGrid := shortGrid
	heightGrid := qualityGrid
	if width >= height {
		widthGrid = qualityGrid
		heightGrid = shortGrid
	}
	outputTokens := math.Ceil(float64(widthGrid*heightGrid) * float64(2000000+pixels) / 4000000)
	return outputTokens * 30 / 1000000, true
}

func builtInImageUnitPrice(model string, size string, quality string) (float64, bool) {
	model = strings.ToLower(strings.TrimSpace(model))
	if model == "gpt-image-2" {
		return gptImage2UnitPrice(size, quality)
	}

	tier, ok := imageSizeTier(size)
	if !ok {
		return 0, false
	}

	switch model {
	case "gemini-3.1-flash-image", "nano-banana-2":
		switch tier {
		case "1k":
			return 0.067, true
		case "2k":
			return 0.101, true
		case "4k":
			return 0.151, true
		}
	case "gemini-3-pro-image", "nano-banana-pro":
		switch tier {
		case "1k", "2k":
			return 0.134, true
		case "4k":
			return 0.240, true
		}
	case "gemini-2.5-flash-image", "nano-banana":
		if tier == "1k" {
			return 0.039, true
		}
	case "gemini-3.1-flash-lite-image":
		if tier == "1k" {
			return 0.0336, true
		}
	}
	return 0, false
}

func (i *ImageRequest) GetTokenCountMeta() *types.TokenCountMeta {
	var sizeRatio = 1.0
	var qualityRatio = 1.0
	imageUnitPrice, _ := builtInImageUnitPrice(i.Model, i.Size, i.Quality)
	imageGroupUnitPrice, _ := imageGroupUnitPrice(i.Size)

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

	// n is NOT included here; it is handled via OtherRatio("n") in
	// image_handler.go (default) or channel adaptors (actual count).
	// Including n here caused double-counting for channels that also
	// set OtherRatio("n") (e.g. Ali/Bailian).
	return &types.TokenCountMeta{
		CombineText:         i.Prompt,
		MaxTokens:           1584,
		ImagePriceRatio:     sizeRatio * qualityRatio,
		ImageUnitPrice:      imageUnitPrice,
		ImageGroupUnitPrice: imageGroupUnitPrice,
	}
}

func (i *ImageRequest) IsStream(c *gin.Context) bool {
	return false
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
