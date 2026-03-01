package dto

import (
	"github.com/QuantumNous/new-api/constant"
)

// ChannelKeyData is the response data for POST /api/channel/:id/key.
type ChannelKeyData struct {
	Key string `json:"key"`
}

// AddChannelRequest is the request body for POST /api/channel/.
type AddChannelRequest struct {
	Mode                      string                `json:"mode"`
	MultiKeyMode              constant.MultiKeyMode `json:"multi_key_mode"`
	BatchAddSetKeyPrefix2Name bool                  `json:"batch_add_set_key_prefix_2_name"`
	Channel                   any                   `json:"channel"`
}

// PatchChannel is the request body for PUT /api/channel/.
// Embeds channel fields at the top level with additional key management fields.
type PatchChannel struct {
	MultiKeyMode *string `json:"multi_key_mode"`
	KeyMode      *string `json:"key_mode"` // 多key模式下密钥覆盖或者追加
}

// ChannelTag is the request body for tag-related channel operations.
type ChannelTag struct {
	Tag            string  `json:"tag"`
	NewTag         *string `json:"new_tag"`
	Priority       *int64  `json:"priority"`
	Weight         *uint   `json:"weight"`
	ModelMapping   *string `json:"model_mapping"`
	Models         *string `json:"models"`
	Groups         *string `json:"groups"`
	ParamOverride  *string `json:"param_override"`
	HeaderOverride *string `json:"header_override"`
}

// ChannelBatch is the request body for batch channel operations.
type ChannelBatch struct {
	Ids []int   `json:"ids"`
	Tag *string `json:"tag"`
}

// FetchModelsRequest is the request body for POST /api/channel/fetch_models.
type FetchModelsRequest struct {
	BaseURL string `json:"base_url"`
	Type    int    `json:"type"`
	Key     string `json:"key"`
}

// OllamaModelRequest is the request body for Ollama model operations.
type OllamaModelRequest struct {
	ChannelID int    `json:"channel_id"`
	ModelName string `json:"model_name"`
}

// --- Channel response types ---

type CopyChannelData struct {
	ID int `json:"id"`
}

type OllamaVersionData struct {
	Version string `json:"version"`
}

type FixAbilityData struct {
	Success int `json:"success"`
	Fails   int `json:"fails"`
}

type RefreshCodexData struct {
	ExpiresAt   string `json:"expires_at"`
	LastRefresh string `json:"last_refresh"`
	AccountID   string `json:"account_id"`
	Email       string `json:"email"`
	ChannelID   int    `json:"channel_id"`
	ChannelType int    `json:"channel_type"`
	ChannelName string `json:"channel_name"`
}

type KeyStatus struct {
	Index        int    `json:"index"`
	Status       int    `json:"status"`
	DisabledTime int64  `json:"disabled_time,omitempty"`
	Reason       string `json:"reason,omitempty"`
	KeyPreview   string `json:"key_preview"`
}

type MultiKeyStatusResponse struct {
	Keys                []KeyStatus `json:"keys"`
	Total               int         `json:"total"`
	Page                int         `json:"page"`
	PageSize            int         `json:"page_size"`
	TotalPages          int         `json:"total_pages"`
	EnabledCount        int         `json:"enabled_count"`
	ManualDisabledCount int         `json:"manual_disabled_count"`
	AutoDisabledCount   int         `json:"auto_disabled_count"`
}

// OpenAIModel represents a single model in the OpenAI models API format.
type OpenAIModel struct {
	ID         string         `json:"id"`
	Object     string         `json:"object"`
	Created    int64          `json:"created"`
	OwnedBy   string         `json:"owned_by"`
	Metadata   map[string]any `json:"metadata,omitempty"`
	Permission []struct {
		ID                 string `json:"id"`
		Object             string `json:"object"`
		Created            int64  `json:"created"`
		AllowCreateEngine  bool   `json:"allow_create_engine"`
		AllowSampling      bool   `json:"allow_sampling"`
		AllowLogprobs      bool   `json:"allow_logprobs"`
		AllowSearchIndices bool   `json:"allow_search_indices"`
		AllowView          bool   `json:"allow_view"`
		AllowFineTuning    bool   `json:"allow_fine_tuning"`
		Organization       string `json:"organization"`
		Group              string `json:"group"`
		IsBlocking         bool   `json:"is_blocking"`
	} `json:"permission"`
	Root   string `json:"root"`
	Parent string `json:"parent"`
}

// OpenAIModelsResponse is the response from the OpenAI /v1/models endpoint.
type OpenAIModelsResponse struct {
	Data    []OpenAIModel `json:"data"`
	Success bool          `json:"success"`
}
