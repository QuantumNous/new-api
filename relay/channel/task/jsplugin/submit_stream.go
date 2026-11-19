package jsplugin

import (
	"context"
	"fmt"
	"mime"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	pluginruntime "github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/gin-gonic/gin"
)

// submitEventStream is how one SSE submission is read: client, when set, is
// the client of a native route, which receives every upstream event as it
// arrives, and frameLimit bounds each event.
type submitEventStream struct {
	client     *gin.Context
	frameLimit int64
}

// readSubmitEvents owns only SSE framing and bounded JSON state. The plugin
// interprets data, accumulates provider output and decides when it is
// complete. On a native route each event also reaches the client as the
// vendor sent it, before the plugin reads it. Once one has, the client holds
// vendor output and the submission settles instead of failing. The upstream
// finished the stream when the plugin reports completion or the upstream
// closes it, and the last result settles as usual. A stream that stops any
// other way (a read error, the idle timeout or the submission deadline, a
// failed hook, invalid state or changes, a size limit) is reported stopped:
// the plugin did not see the end of the vendor's work, so its usage cannot
// lower the reserved charge, and the client's stream is cut off rather than
// closed. A result that invalid changes left half applied is never published.
func (a *TaskAdaptor) readSubmitEvents(parent context.Context, resp *http.Response, driverContext map[string]any, stream submitEventStream) (_ any, stopped bool, _ error) {
	mediaType, _, err := mime.ParseMediaType(resp.Header.Get("Content-Type"))
	if err != nil || mediaType != "text/event-stream" {
		return nil, false, fmt.Errorf("expected a text/event-stream submit response")
	}
	ctx, cancel := context.WithCancelCause(parent)
	defer cancel(nil)
	stopClose := context.AfterFunc(ctx, func() { _ = resp.Body.Close() })
	defer stopClose()
	idleTimeout := time.Duration(constant.StreamingTimeout) * time.Second
	if idleTimeout <= 0 {
		idleTimeout = 30 * time.Second
	}
	timer := time.AfterFunc(idleTimeout, func() { cancel(fmt.Errorf("task submit stream idle timeout")) })
	defer timer.Stop()

	scanner := helper.NewStreamScanner(resp.Body, int(stream.frameLimit)+1)
	hook := "parseSubmitEvent"
	var accumulated *pluginruntime.JSONState
	if pluginruntime.UsesSubmitEventDelta(a.plugin.Meta, a.plugin.Engine) {
		hook = "parseSubmitEventDelta"
		accumulated = pluginruntime.NewJSONState(maxTaskPluginPersistedJSONBytes)
	}
	var state any
	var data []string
	var eventName, lastID string
	var frame strings.Builder
	relayed, completed := false, false
	var readErr error
	frameBytes := 0
	firstLine := true
	for scanner.Scan() {
		if readErr = context.Cause(ctx); readErr != nil {
			break
		}
		timer.Reset(idleTimeout)
		line := scanner.Text()
		if firstLine {
			line = strings.TrimPrefix(line, "\ufeff")
			firstLine = false
		}
		frameBytes += len(line) + 1
		if int64(frameBytes) > stream.frameLimit {
			readErr = fmt.Errorf("task submit SSE event exceeds size limit")
			break
		}
		if stream.client != nil {
			frame.WriteString(line)
			frame.WriteByte('\n')
		}
		if line != "" {
			field, value, _ := strings.Cut(line, ":")
			value, _ = strings.CutPrefix(value, " ")
			switch field {
			case "data":
				data = append(data, value)
			case "event":
				eventName = value
			case "id":
				if !strings.ContainsRune(value, '\x00') {
					lastID = value
				}
			}
			continue
		}
		frameBytes = 0
		if stream.client != nil {
			relaySubmitEvent(stream.client, frame.String())
			frame.Reset()
			relayed = true
		}
		if len(data) == 0 {
			eventName = ""
			continue
		}
		if eventName == "" {
			eventName = "message"
		}
		event := map[string]any{"event": eventName, "id": lastID, "data": strings.Join(data, "\n")}
		value, err := a.plugin.Engine.Call(ctx, hook, driverContext, event, state)
		if err != nil {
			readErr = err
			break
		}
		result, ok := value.(map[string]any)
		if !ok {
			readErr = fmt.Errorf("%s must return an object", hook)
			break
		}
		nextState, hasState := result["state"]
		done, hasDone := result["done"].(bool)
		if !hasState || !hasDone {
			readErr = fmt.Errorf("%s must return state and a boolean done", hook)
			break
		}
		encoded, err := common.Marshal(nextState)
		if err != nil {
			readErr = fmt.Errorf("invalid submit stream state: %w", err)
			break
		}
		if len(encoded) > maxTaskPluginPersistedJSONBytes {
			readErr = fmt.Errorf("task submit stream state exceeds size limit")
			break
		}
		if accumulated != nil {
			if len(result) != 3 {
				readErr = fmt.Errorf("parseSubmitEventDelta must return only changes, state and done")
				break
			}
			// Control state is separate from the full result and is the only
			// snapshot passed back to JS on the next event.
			if len(encoded) > 64<<10 {
				readErr = fmt.Errorf("task submit stream control state exceeds size limit")
				break
			}
			if err = accumulated.Apply(ctx, result["changes"]); err != nil {
				readErr = fmt.Errorf("invalid submit stream changes: %w", err)
				accumulated, state = nil, nil
				break
			}
		}
		// Keep the exact encoded-byte limit above. Plain JSON state goes back
		// to the next event as is; codec-specific values (for example exported
		// typed arrays) retain the old normalization.
		if isPlainJSONValue(nextState, 0) {
			state = nextState
		} else {
			var decoded any
			if err = common.Unmarshal(encoded, &decoded); err != nil {
				readErr = err
				break
			}
			state = decoded
		}
		if done {
			completed = true
			break
		}
		data = nil
		eventName = ""
	}
	if !completed && readErr == nil {
		readErr = context.Cause(ctx)
	}
	if !completed && readErr == nil && scanner.Err() != nil {
		readErr = fmt.Errorf("read task submit stream: %w", scanner.Err())
	}
	result := state
	if accumulated != nil {
		var valueErr error
		if result, valueErr = accumulated.Value(); valueErr != nil && readErr == nil {
			readErr = valueErr
		}
	}
	switch {
	case readErr == nil && completed:
		return result, false, nil
	case !relayed:
		if readErr == nil {
			readErr = fmt.Errorf("task submit stream ended before the plugin reported completion")
		}
		return nil, false, readErr
	case readErr == nil:
		logger.LogDebug(stream.client, "task_plugin subsystem=adaptor event=relayed_stream_closed plugin=%q reason=eof_before_done", a.plugin.Meta.Key)
		return result, false, nil
	default:
		logger.LogWarn(stream.client, common.LogText("task plugin %s settles a relayed submit stream that stopped early at the reserved quota: %s", a.plugin.Meta.Key, readErr.Error()))
		// The client's stream is cut off rather than closed, so a downstream
		// gateway relaying it keeps its reservation too.
		_ = http.NewResponseController(stream.client.Writer).SetWriteDeadline(time.Now())
		return result, true, nil
	}
}

// relaySubmitEvent writes one upstream SSE event, as the vendor framed it, to
// the client of a native route. The first event commits a 200 event-stream
// response; a client that has left only misses the rest.
func relaySubmitEvent(c *gin.Context, frame string) {
	helper.SetEventStreamHeaders(c)
	_, _ = c.Writer.WriteString(frame)
	c.Writer.Flush()
}
