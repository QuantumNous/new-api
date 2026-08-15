package cursor_agent

import (
	"bufio"
	"bytes"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

// rewriteCursorResponseModel keeps Cursor's effort-qualified catalog IDs inside
// the relay. Clients continue to see the stable public model they requested.
func rewriteCursorResponseModel(resp *http.Response, info *relaycommon.RelayInfo) {
	if resp == nil || resp.Body == nil || info == nil {
		return
	}
	internal := strings.TrimSpace(info.UpstreamModelName)
	public := strings.TrimSpace(info.OriginModelName)
	if internal == "" || public == "" || (internal == public && !isPublicCursorEffortFamily(public)) {
		return
	}
	resp.Body = &cursorModelRewriteBody{
		source:   bufio.NewReader(resp.Body),
		closer:   resp.Body,
		internal: internal,
		public:   public,
	}
	// Handlers synthesize some terminal/fallback events from RelayInfo.
	info.UpstreamModelName = public
}

func isPublicCursorEffortFamily(public string) bool {
	switch strings.ToLower(strings.TrimSpace(public)) {
	case "grok-4.5", "grok-4.6":
		return true
	default:
		return false
	}
}

type cursorModelRewriteBody struct {
	source   *bufio.Reader
	closer   io.Closer
	internal string
	public   string
	pending  *bytes.Reader
	terminal error
}

func (r *cursorModelRewriteBody) Read(p []byte) (int, error) {
	for {
		if r.pending != nil && r.pending.Len() > 0 {
			return r.pending.Read(p)
		}
		if r.terminal != nil {
			return 0, r.terminal
		}
		line, err := r.source.ReadString('\n')
		if err != nil {
			r.terminal = err
		}
		if line == "" {
			continue
		}
		r.pending = bytes.NewReader(rewriteCursorModelLine(line, r.internal, r.public))
	}
}

func (r *cursorModelRewriteBody) Close() error {
	return r.closer.Close()
}

func rewriteCursorModelLine(line, internal, public string) []byte {
	suffix := ""
	payload := line
	if strings.HasSuffix(payload, "\r\n") {
		suffix = "\r\n"
		payload = strings.TrimSuffix(payload, suffix)
	} else if strings.HasSuffix(payload, "\n") {
		suffix = "\n"
		payload = strings.TrimSuffix(payload, suffix)
	}
	prefix := ""
	if strings.HasPrefix(payload, "data: ") {
		prefix = "data: "
		payload = strings.TrimPrefix(payload, prefix)
	}
	if payload == "" || payload == "[DONE]" {
		return []byte(prefix + payload + suffix)
	}

	var root map[string]any
	if err := common.Unmarshal([]byte(payload), &root); err != nil {
		return []byte(line)
	}
	rewriteModelField(root, internal, public)
	for _, key := range []string{"message", "response"} {
		if nested, ok := root[key].(map[string]any); ok {
			rewriteModelField(nested, internal, public)
		}
	}
	rewritten, err := common.Marshal(root)
	if err != nil {
		return []byte(line)
	}
	return []byte(prefix + string(rewritten) + suffix)
}

func rewriteModelField(value map[string]any, internal, public string) {
	if model, ok := value["model"].(string); ok {
		if model == internal || isCursorEffortVariant(model, public) {
			value["model"] = public
		}
	}
}

func isCursorEffortVariant(model, public string) bool {
	switch strings.ToLower(strings.TrimSpace(public)) {
	case "grok-4.5":
		return strings.HasPrefix(strings.ToLower(model), "cursor-grok-4.5-")
	case "grok-4.6":
		return strings.HasPrefix(strings.ToLower(model), "cursor-grok-4.6-")
	default:
		return false
	}
}
