package types

type FileType string

const (
	FileTypeImage FileType = "image" // Image file type
	FileTypeAudio FileType = "audio" // Audio file type
	FileTypeVideo FileType = "video" // Video file type
	FileTypeFile  FileType = "file"  // Generic file type
)

type TokenType string

const (
	TokenTypeTextNumber TokenType = "text_number" // Text or number tokens
	TokenTypeTokenizer  TokenType = "tokenizer"   // Tokenizer tokens
	TokenTypeImage      TokenType = "image"       // Image tokens
)

type TokenCountMeta struct {
	TokenType     TokenType   `json:"token_type,omitempty"`     // Type of tokens used in the request
	CombineText   string      `json:"combine_text,omitempty"`   // Combined text from all messages
	ToolsCount    int         `json:"tools_count,omitempty"`    // Number of tools used
	NameCount     int         `json:"name_count,omitempty"`     // Number of names in the request
	MessagesCount int         `json:"messages_count,omitempty"` // Number of messages in the request
	Files         []*FileMeta `json:"files,omitempty"`          // List of files, each with type and content
	MaxTokens     int         `json:"max_tokens,omitempty"`     // Maximum tokens allowed in the request

	ImagePriceRatio float64 `json:"image_ratio,omitempty"` // Ratio for image size, if applicable
	//IsStreaming   bool        `json:"is_streaming,omitempty"`   // Indicates if the request is streaming
}

type FileMeta struct {
	FileType
	MimeType   string
	OriginData string // url or base64 data
	Detail     string
	ParsedData *LocalFileData
}

type RequestMeta struct {
	OriginalModelName string `json:"original_model_name"`
	UserUsingGroup    string `json:"user_using_group"`
	PromptTokens      int    `json:"prompt_tokens"`
	PreConsumedQuota  int    `json:"pre_consumed_quota"`
}
