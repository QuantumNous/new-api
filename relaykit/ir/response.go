package ir

// Finish is the normalized terminal reason. ProviderFinish on Response keeps
// the original wire token for X→IR→X.
type Finish string

const (
	FinishStop    Finish = "stop"
	FinishLength  Finish = "length"
	FinishTool    Finish = "tool"
	FinishFilter  Finish = "filter"
	FinishError   Finish = "error"
	FinishUnknown Finish = "unknown"
)

// Response is the protocol-neutral non-stream assistant output.
type Response struct {
	ID             string     `json:"id,omitempty"`
	Model          string     `json:"model,omitempty"`
	Blocks         []Block    `json:"blocks,omitempty"`
	Finish         Finish     `json:"finish,omitempty"`
	ProviderFinish string     `json:"provider_finish,omitempty"`
	Usage          Usage      `json:"usage,omitempty"`
	Extensions     Extensions `json:"extensions,omitempty"`
}

type Usage struct {
	Input      int            `json:"input,omitempty"`
	Output     int            `json:"output,omitempty"`
	Thought    int            `json:"thought,omitempty"`
	CacheRead  int            `json:"cache_read,omitempty"`
	CacheWrite int            `json:"cache_write,omitempty"`
	Extra      map[string]int `json:"extra,omitempty"`
}
