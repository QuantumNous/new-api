package dto

import (
	"github.com/QuantumNous/new-api/constant"
)

// PricingModel mirrors model.Pricing for OpenAPI schema generation.
// Defined here to avoid an import cycle (dto → model → relay/common → dto).
type PricingModel struct {
	ModelName              string                  `json:"model_name"`
	Description            string                  `json:"description,omitempty"`
	Icon                   string                  `json:"icon,omitempty"`
	Tags                   string                  `json:"tags,omitempty"`
	VendorID               int                     `json:"vendor_id,omitempty"`
	QuotaType              int                     `json:"quota_type"`
	ModelRatio             float64                 `json:"model_ratio"`
	ModelPrice             float64                 `json:"model_price"`
	OwnerBy                string                  `json:"owner_by"`
	CompletionRatio        float64                 `json:"completion_ratio"`
	EnableGroup            []string                `json:"enable_groups"`
	SupportedEndpointTypes []constant.EndpointType `json:"supported_endpoint_types"`
	PricingVersion         string                  `json:"pricing_version,omitempty"`
}

// PricingVendor mirrors model.PricingVendor for OpenAPI schema generation.
type PricingVendor struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Icon        string `json:"icon,omitempty"`
}

// EndpointInfo mirrors common.EndpointInfo for OpenAPI schema generation.
type EndpointInfo struct {
	Path   string `json:"path"`
	Method string `json:"method"`
}

type PricingData struct {
	Success           bool                    `json:"success"`
	Data              []PricingModel          `json:"data"`
	Vendors           []PricingVendor         `json:"vendors"`
	GroupRatio        map[string]float64      `json:"group_ratio"`
	UsableGroup       map[string]string       `json:"usable_group"`
	SupportedEndpoint map[string]EndpointInfo `json:"supported_endpoint"`
	AutoGroups        []string                `json:"auto_groups"`
	PricingVersion    string                  `json:"pricing_version,omitempty"`
}

// 这里不好动就不动了，本来想独立出来的（
type OpenAIModels struct {
	Id                     string                  `json:"id"`
	Object                 string                  `json:"object"`
	Created                int                     `json:"created"`
	OwnedBy                string                  `json:"owned_by"`
	SupportedEndpointTypes []constant.EndpointType `json:"supported_endpoint_types"`
}

type AnthropicModel struct {
	ID          string `json:"id"`
	CreatedAt   string `json:"created_at"`
	DisplayName string `json:"display_name"`
	Type        string `json:"type"`
}

type GeminiModel struct {
	Name                       interface{}   `json:"name"`
	BaseModelId                interface{}   `json:"baseModelId"`
	Version                    interface{}   `json:"version"`
	DisplayName                interface{}   `json:"displayName"`
	Description                interface{}   `json:"description"`
	InputTokenLimit            interface{}   `json:"inputTokenLimit"`
	OutputTokenLimit           interface{}   `json:"outputTokenLimit"`
	SupportedGenerationMethods []interface{} `json:"supportedGenerationMethods"`
	Thinking                   interface{}   `json:"thinking"`
	Temperature                interface{}   `json:"temperature"`
	MaxTemperature             interface{}   `json:"maxTemperature"`
	TopP                       interface{}   `json:"topP"`
	TopK                       interface{}   `json:"topK"`
}
