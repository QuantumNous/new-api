package common

import "github.com/QuantumNous/new-api/constant"

// EndpointInfo describes the default request information for a single endpoint
// path: upstream path
// method: HTTP request method, such as POST/GET
// Currently all are POST and can be expanded in the future.
//
// json tag for direct serialization to API output
// For example: {"path":"/v1/chat/completions","method":"POST"}

type EndpointInfo struct {
	Path   string `json:"path"`
	Method string `json:"method"`
}

// defaultEndpointInfoMap saves the default Path and Method of built-in endpoints
var defaultEndpointInfoMap = map[constant.EndpointType]EndpointInfo{
	constant.EndpointTypeOpenAI:                {Path: "/v1/chat/completions", Method: "POST"},
	constant.EndpointTypeOpenAIResponse:        {Path: "/v1/responses", Method: "POST"},
	constant.EndpointTypeOpenAIResponseCompact: {Path: "/v1/responses/compact", Method: "POST"},
	constant.EndpointTypeOpenAIAlphaSearch:     {Path: "/v1/alpha/search", Method: "POST"},
	constant.EndpointTypeDeepSeekToolsSearch:   {Path: "/v1/tools/search", Method: "POST"},
	constant.EndpointTypeDeepSeekToolsFetch:    {Path: "/v1/tools/fetch", Method: "POST"},
	constant.EndpointTypeAnthropic:             {Path: "/v1/messages", Method: "POST"},
	constant.EndpointTypeGemini:                {Path: "/v1beta/models/{model}:generateContent", Method: "POST"},
	constant.EndpointTypeJinaRerank:            {Path: "/v1/rerank", Method: "POST"},
	constant.EndpointTypeImageGeneration:       {Path: "/v1/images/generations", Method: "POST"},
	constant.EndpointTypeEmbeddings:            {Path: "/v1/embeddings", Method: "POST"},
}

// GetDefaultEndpointInfo returns the default information for the specified endpoint type and whether it exists
func GetDefaultEndpointInfo(et constant.EndpointType) (EndpointInfo, bool) {
	info, ok := defaultEndpointInfoMap[et]
	return info, ok
}
