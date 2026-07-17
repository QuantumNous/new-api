package image_stream

// SSE aggregator for upstream /v1/responses stream:true responses.
//
// We bypass any partial_image events (each carries multi-MB base64 noise we
// don't need) and capture only the events that contain final state:
//   - response.output_item.done : the actual image_generation_call result
//   - response.completed        : usage + final response shell
// in_progress / created snapshots are kept only to supplement the completed
// response; they are never accepted as terminal billing data.

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
)

const (
	maxSSELineSize  = 32 << 20 // 32 MiB — image_generation_call.result is ~2-15 MiB at 4K
	initSSEBufBytes = 1 << 20  // 1 MiB initial buffer
)

// UpstreamItem mirrors the relevant fields of an output_item in a
// /v1/responses payload. Only image_generation_call items are interesting
// for our envelope.
type UpstreamItem struct {
	Type          string `json:"type"`
	Result        string `json:"result,omitempty"`
	OutputFormat  string `json:"output_format,omitempty"`
	Size          string `json:"size,omitempty"`
	RevisedPrompt string `json:"revised_prompt,omitempty"`
	Status        string `json:"status,omitempty"`
}

// UpstreamToolUsage carries image_gen costs reported in tool_usage.image_gen.
// Upstream surfaces image_tokens here (typically thousands per render),
// while response.usage only reports the LLM reasoning slice (~40-200 tokens).
// Merging the two is what makes billing reflect actual cost.
type UpstreamToolUsage struct {
	ImageGen *struct {
		InputTokens        int `json:"input_tokens"`
		InputTokensDetails struct {
			ImageTokens int `json:"image_tokens"`
			TextTokens  int `json:"text_tokens"`
		} `json:"input_tokens_details"`
		OutputTokens        int `json:"output_tokens"`
		OutputTokensDetails struct {
			ImageTokens int `json:"image_tokens"`
			TextTokens  int `json:"text_tokens"`
		} `json:"output_tokens_details"`
		TotalTokens int `json:"total_tokens"`
	} `json:"image_gen,omitempty"`
}

// UpstreamResponse is the slice of /v1/responses we use. The SDK doesn't
// model the image-generation tool fully; we keep this shape narrow to avoid
// fighting upstream schema drift.
//
// `background` is intentionally omitted — upstream sometimes sends it as
// bool (`false`), sometimes as string (`"opaque"`), and our envelope doesn't
// need it. Adding a strict type for it would fail the entire unmarshal of
// response.completed and silently zero out usage/tool_usage billing.
type UpstreamResponse struct {
	Model     string             `json:"model,omitempty"`
	Output    []UpstreamItem     `json:"output,omitempty"`
	Usage     *dto.Usage         `json:"usage,omitempty"`
	ToolUsage *UpstreamToolUsage `json:"tool_usage,omitempty"`
}

// AggregateResponseStream reads an SSE event stream and returns the final
// upstream response object. Returns an error if the stream contains an
// "error" or "response.failed" event, or if no terminal event is observed.
func AggregateResponseStream(body io.Reader) (*UpstreamResponse, error) {
	scanner := bufio.NewScanner(body)
	scanner.Buffer(make([]byte, initSSEBufBytes), maxSSELineSize)

	var snapshot *UpstreamResponse
	var collected []UpstreamItem
	var seenCompleted bool

	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimSpace(line[6:])
		if data == "" || data == "[DONE]" {
			continue
		}
		// Cheap pre-filter: partial_image events carry a multi-MB base64
		// payload and we never need them for the final envelope.
		if strings.Contains(data, `"partial_image_b64"`) {
			continue
		}

		var probe struct {
			Type string `json:"type"`
		}
		if err := common.UnmarshalJsonStr(data, &probe); err != nil {
			continue
		}
		if probe.Type == "response.completed" || probe.Type == "response.failed" || probe.Type == "error" {
			common.SysLog(fmt.Sprintf("image_stream sse event: type=%s data_len=%d", probe.Type, len(data)))
		}

		switch probe.Type {
		case "response.output_item.done":
			var ev struct {
				Item *UpstreamItem `json:"item"`
			}
			if err := common.UnmarshalJsonStr(data, &ev); err == nil && ev.Item != nil {
				collected = append(collected, *ev.Item)
			}
		case "response.completed":
			var ev struct {
				Response *UpstreamResponse `json:"response"`
			}
			if err := common.UnmarshalJsonStr(data, &ev); err != nil {
				common.SysError(fmt.Sprintf("image_stream completed unmarshal err: %s data_len=%d", err.Error(), len(data)))
			} else if ev.Response == nil {
				common.SysError("image_stream completed: ev.Response is nil after unmarshal")
			} else {
				snapshot = ev.Response
				seenCompleted = true
				usageInfo := "<nil>"
				if ev.Response.Usage != nil {
					usageInfo = fmt.Sprintf("input=%d output=%d", ev.Response.Usage.InputTokens, ev.Response.Usage.OutputTokens)
				}
				toolUsageInfo := "<nil>"
				if ev.Response.ToolUsage != nil && ev.Response.ToolUsage.ImageGen != nil {
					ig := ev.Response.ToolUsage.ImageGen
					toolUsageInfo = fmt.Sprintf("img_gen{input=%d output=%d image_tokens=%d}",
						ig.InputTokens, ig.OutputTokens, ig.OutputTokensDetails.ImageTokens)
				}
				common.SysLog(fmt.Sprintf("image_stream completed: usage=%s tool=%s", usageInfo, toolUsageInfo))
			}
		case "response.in_progress", "response.created":
			if snapshot == nil {
				var ev struct {
					Response *UpstreamResponse `json:"response"`
				}
				if err := common.UnmarshalJsonStr(data, &ev); err == nil {
					snapshot = ev.Response
				}
			}
		case "error", "response.failed":
			var ev struct {
				Error struct {
					Message string `json:"message"`
				} `json:"error"`
			}
			_ = common.UnmarshalJsonStr(data, &ev)
			if ev.Error.Message == "" {
				return nil, fmt.Errorf("upstream error event")
			}
			return nil, fmt.Errorf("upstream error: %s", ev.Error.Message)
		}

		if seenCompleted {
			break
		}
	}
	scanErr := scanner.Err()
	common.SysLog(fmt.Sprintf("image_stream sse done: seenCompleted=%v collected=%d snapshot_nil=%v scan_err=%v",
		seenCompleted, len(collected), snapshot == nil, scanErr))
	if scanErr != nil {
		return nil, fmt.Errorf("SSE scan: %w", scanErr)
	}
	if !seenCompleted {
		return nil, errors.New("upstream image stream ended before response.completed")
	}

	if snapshot == nil {
		snapshot = &UpstreamResponse{}
	}
	// If completed.response.output came back empty (some upstreams do this),
	// splice in the items we collected from output_item.done events.
	if len(snapshot.Output) == 0 {
		snapshot.Output = collected
	}
	return snapshot, nil
}
