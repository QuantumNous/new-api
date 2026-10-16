package ir

// EventKind is the stream IR. Chat token deltas are a projection of these
// events, not the hub.
type EventKind string

const (
	EventStart      EventKind = "start"
	EventBlockStart EventKind = "block_start"
	EventBlockDelta EventKind = "block_delta"
	EventBlockStop  EventKind = "block_stop"
	EventFinish     EventKind = "finish"
	EventUsage      EventKind = "usage"
	EventPing       EventKind = "ping"
	EventError      EventKind = "error"
)

// Event is one step of a projected stream. BlockStart carries the skeleton,
// BlockDelta carries incremental payload, BlockStop carries the completed block
// (signatures often arrive here).
type Event struct {
	Kind   EventKind   `json:"kind"`
	ID     string      `json:"id,omitempty"`
	Model  string      `json:"model,omitempty"`
	Index  int         `json:"index,omitempty"`
	Block  *Block      `json:"block,omitempty"`
	Delta  *BlockDelta `json:"delta,omitempty"`
	Finish *Finish     `json:"finish,omitempty"`
	Usage  *Usage      `json:"usage,omitempty"`
	Error  string      `json:"error,omitempty"`
}

type BlockDelta struct {
	Text      string `json:"text,omitempty"`
	JSON      string `json:"json,omitempty"`
	Signature string `json:"signature,omitempty"`
}
