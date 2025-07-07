package dto

type ChannelSettings struct {
	ForceFormat       bool   `json:"force_format,omitempty"`
	ThinkingToContent bool   `json:"thinking_to_content,omitempty"`
	Proxy             string `json:"proxy"`
}
