package requestplugin

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

var rejectCodePattern = regexp.MustCompile(`^[a-z0-9_.-]{1,64}$`)

func init() {
	jsplugin.SetParamOverrideFunc(ParamOverride)
}

// ParamOverride is utils.paramOverride(body, override): the channel param
// override DSL run on a stage hook's body, with a condition context built
// from the hook's ctx. A DSL return_error comes back as {reject: {code,
// message}}; the headers it returns are only the changes the override made
// to the channel's header override.
func ParamOverride(tctx jsplugin.TransformContext, body json.RawMessage, override json.RawMessage) (json.RawMessage, error) {
	var rules map[string]any
	if err := common.Unmarshal(override, &rules); err != nil || rules == nil {
		return nil, fmt.Errorf("utils.paramOverride override must be a JSON object")
	}
	upstreamModel := tctx.UpstreamModel
	if upstreamModel == "" {
		upstreamModel = tctx.Model
	}
	context := map[string]any{
		"model":          upstreamModel,
		"upstream_model": upstreamModel,
		"original_model": tctx.Model,
		"using_group":    tctx.Group,
		"request_path":   tctx.Path,
		"format":         tctx.Format,
		"retry_index":    tctx.Attempt,
		"is_retry":       tctx.Attempt > 0,
		"retry":          map[string]any{"index": tctx.Attempt, "is_retry": tctx.Attempt > 0},
	}
	var baseHeaders map[string]any
	if tctx.Channel != nil {
		context["channel_id"], context["channel_type"] = tctx.Channel.ID, tctx.Channel.Type
		if channel, err := model.CacheGetChannel(tctx.Channel.ID); err == nil {
			baseHeaders = channel.GetHeaderOverride()
		}
	}
	result, set, removed, err := relaycommon.ApplyPluginParamOverride(body, rules, context, baseHeaders)
	if err != nil {
		returned, ok := relaycommon.AsParamOverrideReturnError(err)
		if !ok {
			return nil, err
		}
		code := strings.ToLower(strings.TrimSpace(returned.Code))
		if !rejectCodePattern.MatchString(code) {
			code = "param_override"
		}
		message := strings.TrimSpace(returned.Message)
		if utf8.RuneCountInString(message) > 256 {
			message = string([]rune(message)[:256])
		}
		return common.Marshal(map[string]any{"reject": map[string]string{"code": code, "message": message}})
	}
	reply := map[string]any{"body": json.RawMessage(result)}
	if len(set) > 0 || len(removed) > 0 {
		headers := map[string]any{}
		if len(set) > 0 {
			headers["set"] = set
		}
		if len(removed) > 0 {
			headers["remove"] = removed
		}
		reply["headers"] = headers
	}
	return common.Marshal(reply)
}
