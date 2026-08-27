package ir

import "encoding/json"

// BlockKind identifies the payload set on Block.
type BlockKind string

const (
	BlockKindText       BlockKind = "text"
	BlockKindMedia      BlockKind = "media"
	BlockKindThink      BlockKind = "think"
	BlockKindToolUse    BlockKind = "tool_use"
	BlockKindToolResult BlockKind = "tool_result"
	BlockKindCode       BlockKind = "code"
	BlockKindServerTool BlockKind = "server_tool"
	BlockKindRaw        BlockKind = "raw"
)

// MediaKind is the semantic class of a MediaBlock.
type MediaKind string

const (
	MediaImage MediaKind = "image"
	MediaAudio MediaKind = "audio"
	MediaVideo MediaKind = "video"
	MediaFile  MediaKind = "file"
)

// MediaSourceKind is how media bytes are addressed.
type MediaSourceKind string

const (
	MediaSourceURL    MediaSourceKind = "url"
	MediaSourceBase64 MediaSourceKind = "base64"
	MediaSourceURI    MediaSourceKind = "file_uri"
	MediaSourceID     MediaSourceKind = "file_id"
)

// Block is a tagged content unit shared by requests, responses, and stream
// events. Exactly one payload pointer should be set, matching Kind.
type Block struct {
	Kind       BlockKind        `json:"kind"`
	Text       *TextBlock       `json:"text,omitempty"`
	Media      *MediaBlock      `json:"media,omitempty"`
	Think      *ThinkBlock      `json:"think,omitempty"`
	ToolUse    *ToolUseBlock    `json:"tool_use,omitempty"`
	ToolResult *ToolResultBlock `json:"tool_result,omitempty"`
	Code       *CodeBlock       `json:"code,omitempty"`
	ServerTool *ServerToolBlock `json:"server_tool,omitempty"`
	Raw        *RawBlock        `json:"raw,omitempty"`
}

type TextBlock struct {
	Text         string          `json:"text,omitempty"`
	CacheControl *CacheControl   `json:"cache_control,omitempty"`
	Citations    json.RawMessage `json:"citations,omitempty"`
}

type MediaBlock struct {
	Kind         MediaKind       `json:"kind,omitempty"`
	MIME         string          `json:"mime,omitempty"`
	Filename     string          `json:"filename,omitempty"`
	Source       MediaSourceKind `json:"source,omitempty"`
	URL          string          `json:"url,omitempty"`
	Data         string          `json:"data,omitempty"`
	FileID       string          `json:"file_id,omitempty"`
	Detail       string          `json:"detail,omitempty"`
	CacheControl *CacheControl   `json:"cache_control,omitempty"`
}

type ThinkBlock struct {
	Text         string `json:"text,omitempty"`
	Signature    string `json:"signature,omitempty"`
	Redacted     bool   `json:"redacted,omitempty"`
	RedactedData string `json:"redacted_data,omitempty"`
	ProviderSig  []byte `json:"provider_sig,omitempty"`
}

type ToolUseBlock struct {
	ID          string          `json:"id,omitempty"`
	Name        string          `json:"name,omitempty"`
	Input       json.RawMessage `json:"input,omitempty"`
	ProviderSig []byte          `json:"provider_sig,omitempty"`
	Server      bool            `json:"server,omitempty"`
}

type ToolResultBlock struct {
	ToolUseID    string        `json:"tool_use_id,omitempty"`
	Name         string        `json:"name,omitempty"`
	Blocks       []Block       `json:"blocks,omitempty"`
	IsError      bool          `json:"is_error,omitempty"`
	CacheControl *CacheControl `json:"cache_control,omitempty"`
}

type CodeBlock struct {
	Language string `json:"language,omitempty"`
	Code     string `json:"code,omitempty"`
	Outcome  string `json:"outcome,omitempty"`
	Output   string `json:"output,omitempty"`
	Result   bool   `json:"result,omitempty"`
}

type ServerToolBlock struct {
	Kind   string          `json:"kind,omitempty"`
	ID     string          `json:"id,omitempty"`
	Name   string          `json:"name,omitempty"`
	Output json.RawMessage `json:"output,omitempty"`
}

// RawBlock holds a wire-format content block that has no first-class IR kind.
// To(X) writes it back when the target is the originating protocol.
type RawBlock struct {
	Type string          `json:"type"`
	JSON json.RawMessage `json:"json,omitempty"`
}

type CacheControl struct {
	Type string `json:"type,omitempty"`
	TTL  string `json:"ttl,omitempty"`
}

func Text(text string) Block {
	return Block{Kind: BlockKindText, Text: &TextBlock{Text: text}}
}

func Think(text, signature string) Block {
	return Block{Kind: BlockKindThink, Think: &ThinkBlock{Text: text, Signature: signature}}
}

func RedactedThink(data string) Block {
	return Block{Kind: BlockKindThink, Think: &ThinkBlock{Redacted: true, RedactedData: data}}
}

func ToolUse(id, name string, input json.RawMessage) Block {
	return Block{Kind: BlockKindToolUse, ToolUse: &ToolUseBlock{ID: id, Name: name, Input: input}}
}

func ToolResult(toolUseID string, blocks []Block) Block {
	return Block{Kind: BlockKindToolResult, ToolResult: &ToolResultBlock{ToolUseID: toolUseID, Blocks: blocks}}
}

func Raw(blockType string, payload json.RawMessage) Block {
	return Block{Kind: BlockKindRaw, Raw: &RawBlock{Type: blockType, JSON: payload}}
}
