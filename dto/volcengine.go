package dto

import "encoding/json"

/*
Base On full request demo
export ARK_API_KEY="YOUR_API_KEY" #YOUR_API_KEY 需要替换为您在平台创建的 API Key
curl https://ark.cn-beijing.volces.com/api/v3/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ARK_API_KEY" \
  -d $'{
    "guidance_scale": 1,
    "model": "doubao-seedream-4-0-250828",
    "optimize_prompt_options": {
        "mode": "standard"
    },
    "prompt": "生成一组共4张连贯插画，核心为同一庭院一角的四季变迁，以统一风格展现四季独特色彩、元素与氛围",
    "response_format": "asdad",
    "seed": 123,
    "sequential_image_generation": "auto",
    "sequential_image_generation_options": {
        "max_images": 4
    },
    "size": "2k",
    "stream": true,
    "watermark": true
}'
*/

// VolcengineImageRequest 表示火山引擎图像生成的请求，包含基础图像请求参数和火山引擎特有的扩展参数。
type VolcengineImageRequest struct {
	Model                  string          `json:"model"`
	Prompt                 string          `json:"prompt" binding:"required"`
	N                      uint            `json:"n,omitempty"`
	Size                   string          `json:"size,omitempty"`
	Quality                string          `json:"quality,omitempty"`
	ResponseFormat         string          `json:"response_format,omitempty"`
	Style                  json.RawMessage `json:"style,omitempty"`
	User                   json.RawMessage `json:"user,omitempty"`
	ExtraFields            json.RawMessage `json:"extra_fields,omitempty"`
	Background             json.RawMessage `json:"background,omitempty"`
	Moderation             json.RawMessage `json:"moderation,omitempty"`
	OutputFormat           json.RawMessage `json:"output_format,omitempty"`
	OutputCompression      json.RawMessage `json:"output_compression,omitempty"`
	Stream                 bool            `json:"stream,omitempty"`         // 是否以流式方式返回响应
	GuidanceScale          float32         `json:"guidance_scale,omitempty"` // 图像生成的引导系数，需为小于10的 float32
	Seed                   int32           `json:"seed,omitempty"`           // 随机数生成的种子
	Watermark              *bool           `json:"watermark,omitempty"`
	WatermarkEnabled       json.RawMessage `json:"watermark_enabled,omitempty"` // zhipu 4v
	UserId                 json.RawMessage `json:"user_id,omitempty"`
	Image                  []string        `json:"image,omitempty"`
	VolcengineImageExtends                 // 火山引擎特有的图像生成选项
}

// VolcengineImageExtends 包含火山引擎特有的图像生成选项。
type VolcengineImageExtends struct {
	SequentialImageGeneration        string                           `json:"sequential_image_generation,omitempty"`         // 连续图像生成的模式
	SequentialImageGenerationOptions SequentialImageGenerationOptions `json:"sequential_image_generation_options,omitempty"` // 连续图像生成的选项
}

// SequentialImageGenerationOptions 定义了连续生成多张图像的选项。
type SequentialImageGenerationOptions struct {
	MaxImages int `json:"max_images,omitempty"` // 生成图像的最大数量
}
