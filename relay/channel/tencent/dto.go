package tencent

type TencentMessage struct {
	Role    string `json:"Role"`
	Content string `json:"Content"`
}

type TencentChatRequest struct {
	// Model name. Optional values include hunyuan-lite, hunyuan-standard, hunyuan-standard-256K, and hunyuan-pro.
	// For the introduction of each model, please read the instructions in [Product Overview](https://cloud.tencent.com/document/product/1729/104753).
	//
	// Note:
	// Different models are charged differently, please call according to the [Buying Guide](https://cloud.tencent.com/document/product/1729/97731)) as needed.
	Model *string `json:"Model"`
	// Chat context information.
	// Description:
	// 1. The maximum length is 40, arranged in the array from oldest to newest by conversation time.
	// 2. Message.Role optional values: system, user, assistant.
	// Among them, the system role is optional. If it exists, it must be at the beginning of the list. User and assistant must appear alternately (one question and one answer), starting and ending with user's question, and Content cannot be empty. Example sequence of Roles: [system (optional) user assistant user assistant user ...].
	// 3. The total length of Content in Messages cannot exceed the upper limit of model input length (please refer to [Product Overview] (https://cloud.tencent.com/document/product/1729/104753) document)). If it exceeds the limit, the front content will be truncated and only the tail content will be retained.
	Messages []*TencentMessage `json:"Messages"`
	// Streaming call switch.
	// Description:
	// 1. If no value is passed, the default is non-streaming call (false).
	// 2. When making a streaming call, the result is returned incrementally using the SSE protocol (the return value is the value in Choices[n].Delta, and incremental data needs to be spliced to obtain the complete result).
	// 3. When calling in non-streaming mode:
	// The calling method is the same as an ordinary HTTP request.
	// The interface response takes a long time. **If lower latency is required, it is recommended to set it to true**.
	// The final result is returned only once (the return value takes the value in Choices[n].Message).
	//
	// Note:
	// When calling through the SDK, streaming and non-streaming calls need to use **different methods** to obtain the return value. For details, refer to the comments or examples in the SDK (in the examples/hunyuan/v20230901/ directory of each language SDK code repository).
	Stream *bool `json:"Stream,omitempty"`
	// Description:
	// 1. Affects the diversity of the output text. The larger the value, the stronger the diversity of the generated text.
	// 2. The value range is [0.0, 1.0]. If no value is passed, the recommended value of each model is used.
	// 3. It is not recommended to use it unless necessary. Unreasonable values will affect the effect.
	TopP *float64 `json:"TopP,omitempty"`
	// Description:
	// 1. Higher values make the output more random, while lower values make it more focused and deterministic.
	// 2. The value range is [0.0, 2.0]. If no value is passed, the recommended value of each model is used.
	// 3. It is not recommended to use it unless necessary. Unreasonable values will affect the effect.
	Temperature *float64 `json:"Temperature,omitempty"`
}

type TencentError struct {
	Code    int    `json:"Code"`
	Message string `json:"Message"`
}

type TencentUsage struct {
	PromptTokens     int `json:"PromptTokens"`
	CompletionTokens int `json:"CompletionTokens"`
	TotalTokens      int `json:"TotalTokens"`
}

type TencentResponseChoices struct {
	FinishReason string         `json:"FinishReason,omitempty"` // Streaming end flag, if it is stop, it means the tail packet
	Messages     TencentMessage `json:"Message"`                // Content, synchronous mode returns content, streaming mode is null and outputs content. The total number of content supports up to 1024 tokens.
	Delta        TencentMessage `json:"Delta"`                  // Content, streaming mode returns content, synchronization mode is null and output content. The total number of content supports up to 1024 tokens.
}

type TencentChatResponse struct {
	Choices []TencentResponseChoices `json:"Choices,omitempty"` // result
	Created int64                    `json:"Created,omitempty"` // unix timestamp string
	Id      string                   `json:"Id,omitempty"`      // session id
	Usage   TencentUsage             `json:"Usage"`             // token quantity
	Error   TencentError             `json:"Error"`             // Error message Note: This field may return null, indicating that no valid value can be obtained
	Note    string                   `json:"Note,omitempty"`    // Comment
	ReqID   string                   `json:"Req_id,omitempty"`  // Unique request ID, returned for every request. Used for feedback interface input parameters
}

type TencentChatResponseSB struct {
	Response TencentChatResponse `json:"Response"`
}
