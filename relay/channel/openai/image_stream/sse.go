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
	"bytes"
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
)

const (
	maxSSELineSize          = 64 << 20 // one completed event may contain a large 4K result
	maxSSEResultBytes       = 56 << 20
	maxSSEItemMetadataBytes = 256 << 10
	initSSEBufBytes         = 1 << 20 // 1 MiB initial buffer
	sseLeaseAcquireBytes    = 1 << 20
)

type sseOutputLease struct {
	acquire func() (bool, error)
	release func()
}

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
	return aggregateResponseStream(body, nil)
}

func aggregateResponseStream(body io.Reader, outputLease *sseOutputLease) (*UpstreamResponse, error) {
	reader := bufio.NewReaderSize(body, initSSEBufBytes)

	var snapshot *UpstreamResponse
	var collected []UpstreamItem
	var collectedBytes int
	var seenCompleted bool

	for {
		line, skipped, lineLease, readErr := readSSELine(reader, outputLease)
		if errors.Is(readErr, io.EOF) {
			break
		}
		if readErr != nil {
			return nil, fmt.Errorf("SSE scan: %w", readErr)
		}
		if skipped {
			continue
		}
		retainLineLease := false
		if !strings.HasPrefix(line, "data: ") {
			releaseSSELineLease(outputLease, lineLease)
			continue
		}
		data := strings.TrimSpace(line[6:])
		if data == "" || data == "[DONE]" {
			releaseSSELineLease(outputLease, lineLease)
			continue
		}

		var probe struct {
			Type string `json:"type"`
		}
		if err := common.UnmarshalJsonStr(data, &probe); err != nil {
			releaseSSELineLease(outputLease, lineLease)
			continue
		}
		if probe.Type == "response.completed" || probe.Type == "response.failed" || probe.Type == "error" {
			common.SysLog(fmt.Sprintf("image_stream sse event: type=%s data_len=%d", probe.Type, len(data)))
		}

		switch probe.Type {
		case "response.output_item.done":
			newLease, err := acquireSSEOutputLease(outputLease)
			if err != nil {
				return nil, err
			}
			var ev struct {
				Item *UpstreamItem `json:"item"`
			}
			if err := common.UnmarshalJsonStr(data, &ev); err == nil && ev.Item != nil {
				if err := validateUpstreamItems([]UpstreamItem{*ev.Item}, len(collected), collectedBytes); err != nil {
					return nil, err
				}
				collected = append(collected, *ev.Item)
				collectedBytes += upstreamItemRetainedBytes(*ev.Item)
				retainLineLease = true
			} else if newLease {
				outputLease.release()
			}
		case "response.completed":
			if _, err := acquireSSEOutputLease(outputLease); err != nil {
				return nil, err
			}
			retainLineLease = true
			var ev struct {
				Response *UpstreamResponse `json:"response"`
			}
			if err := common.UnmarshalJsonStr(data, &ev); err != nil {
				common.SysError(fmt.Sprintf("image_stream completed unmarshal err: %s data_len=%d", err.Error(), len(data)))
			} else if ev.Response == nil {
				common.SysError("image_stream completed: ev.Response is nil after unmarshal")
			} else {
				if err := validateUpstreamItems(ev.Response.Output, 0, 0); err != nil {
					return nil, err
				}
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
					retainLineLease = lineLease && upstreamResponseRetainsImageBytes(snapshot)
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
		if lineLease && !retainLineLease {
			releaseSSELineLease(outputLease, true)
		}

		if seenCompleted {
			break
		}
	}
	common.SysLog(fmt.Sprintf("image_stream sse done: seenCompleted=%v collected=%d snapshot_nil=%v scan_err=<nil>",
		seenCompleted, len(collected), snapshot == nil))
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
	if err := validateUpstreamItems(snapshot.Output, 0, 0); err != nil {
		return nil, err
	}
	return snapshot, nil
}

func readSSELine(reader *bufio.Reader, outputLease *sseOutputLease) (string, bool, bool, error) {
	if reader == nil {
		return "", false, false, errors.New("SSE reader is required")
	}
	var line bytes.Buffer
	lineBytes := 0
	lineLease := false
	leaseChecked := false
	skipped := false
	for {
		if !skipped && !leaseChecked && lineBytes >= sseLeaseAcquireBytes {
			acquired, err := acquireSSEOutputLease(outputLease)
			if err != nil {
				return "", false, lineLease, err
			}
			lineLease = acquired
			leaseChecked = true
		}
		fragment, err := reader.ReadSlice('\n')
		lineBytes += len(fragment)
		if lineBytes > maxSSELineSize {
			return "", false, lineLease, fmt.Errorf("SSE line exceeds %d bytes", maxSSELineSize)
		}
		if !skipped {
			_, _ = line.Write(fragment)
			if bytes.Contains(line.Bytes(), []byte(`"partial_image_b64"`)) {
				skipped = true
				line.Reset()
				if lineLease {
					releaseSSELineLease(outputLease, true)
					lineLease = false
				}
			}
		}
		switch {
		case err == nil:
			return line.String(), skipped, lineLease, nil
		case errors.Is(err, bufio.ErrBufferFull):
			continue
		case errors.Is(err, io.EOF) && lineBytes > 0:
			return line.String(), skipped, lineLease, nil
		default:
			return "", false, lineLease, err
		}
	}
}

func acquireSSEOutputLease(outputLease *sseOutputLease) (bool, error) {
	if outputLease == nil || outputLease.acquire == nil {
		return false, nil
	}
	return outputLease.acquire()
}

func releaseSSELineLease(outputLease *sseOutputLease, acquired bool) {
	if acquired && outputLease != nil && outputLease.release != nil {
		outputLease.release()
	}
}

func upstreamResponseRetainsImageBytes(response *UpstreamResponse) bool {
	if response == nil {
		return false
	}
	for _, item := range response.Output {
		if item.Result != "" {
			return true
		}
	}
	return false
}

func validateUpstreamItems(items []UpstreamItem, existingCount, existingBytes int) error {
	if existingCount+len(items) > dto.MaxImageN {
		return fmt.Errorf("upstream image response contains more than %d output items", dto.MaxImageN)
	}
	total := existingBytes
	for _, item := range items {
		if len(item.Result) > maxSSEResultBytes {
			return fmt.Errorf("upstream image result exceeds %d bytes", maxSSEResultBytes)
		}
		for field, value := range map[string]string{
			"output_format":  item.OutputFormat,
			"size":           item.Size,
			"revised_prompt": item.RevisedPrompt,
			"status":         item.Status,
		} {
			if len(value) > maxSSEItemMetadataBytes {
				return fmt.Errorf("upstream image %s exceeds %d bytes", field, maxSSEItemMetadataBytes)
			}
		}
		total += upstreamItemRetainedBytes(item)
		if total > maxSSEResultBytes {
			return fmt.Errorf("upstream image response exceeds %d total bytes", maxSSEResultBytes)
		}
	}
	return nil
}

func upstreamItemRetainedBytes(item UpstreamItem) int {
	return len(item.Type) + len(item.Result) + len(item.OutputFormat) + len(item.Size) + len(item.RevisedPrompt) + len(item.Status)
}
