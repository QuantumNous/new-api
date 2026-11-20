package jsplugin

import (
	"fmt"
	"maps"

	"github.com/QuantumNous/new-api/common"
	pluginruntime "github.com/QuantumNous/new-api/pkg/jsplugin"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

// applyImageProtocolParamOverride derives an attempt-local request before the
// plugin's final decoder, so validation, usage and response rendering agree.
// The original request and its file references remain available for retries.
func applyImageProtocolParamOverride(request pluginruntime.ProtocolRequestContext, info *relaycommon.RelayInfo) (pluginruntime.ProtocolRequestContext, error) {
	if info == nil || info.ChannelMeta == nil || len(info.ParamOverride) == 0 {
		return request, nil
	}
	body, ok := request.Body.(map[string]any)
	if !ok {
		return request, fmt.Errorf("invalid image protocol request body")
	}
	var data []byte
	var err error
	fields, _ := body["fields"].(map[string][]string)
	switch body["kind"] {
	case string(pluginruntime.BodyJSON):
		if len(request.BodyText) > 0 {
			data = append([]byte(nil), request.BodyText...)
		} else {
			data, err = common.Marshal(body["value"])
		}
	case string(pluginruntime.BodyMultipart), string(pluginruntime.BodyForm):
		values := make(map[string]any, len(fields))
		for key, entries := range fields {
			if len(entries) == 1 {
				values[key] = entries[0]
			} else {
				values[key] = entries
			}
		}
		data, err = common.Marshal(values)
	default:
		return request, fmt.Errorf("unsupported image protocol request body")
	}
	if err != nil {
		return request, err
	}
	// Match model conditions against the mapped name, as ordinary image relay
	// does. The decoder still receives the pinned client model afterwards.
	upstreamModel := info.UpstreamModelName
	if upstreamModel == "" {
		upstreamModel = request.Model
	}
	data, err = sjson.SetBytes(data, "model", upstreamModel)
	if err != nil {
		return request, err
	}
	data, err = relaycommon.ApplyParamOverrideWithRelayInfo(data, info)
	if err != nil {
		return request, err
	}
	model := gjson.GetBytes(data, "model")
	if model.Type != gjson.String || model.String() != upstreamModel {
		return request, fmt.Errorf("image protocol parameter overrides cannot change the pinned model; use channel model mapping")
	}
	data, err = sjson.SetBytes(data, "model", request.Model)
	if err != nil {
		return request, err
	}
	// Never mutate maps that have already been exposed to a plugin hook.
	body = maps.Clone(body)
	if body["kind"] == string(pluginruntime.BodyJSON) {
		var value map[string]any
		if err = common.Unmarshal(data, &value); err != nil {
			return request, err
		}
		body["value"] = value
		request.BodyText = data
		request.RequestBody = value
	} else {
		values := gjson.ParseBytes(data)
		if !values.IsObject() {
			return request, fmt.Errorf("image protocol parameter overrides must preserve an object request")
		}
		effectiveFields := make(map[string][]string)
		for key, value := range values.Map() {
			if value.Type == gjson.String {
				effectiveFields[key] = []string{value.String()}
			} else if len(fields[key]) > 1 && value.IsArray() {
				var entries []string
				if err = common.Unmarshal([]byte(value.Raw), &entries); err != nil {
					return request, err
				}
				effectiveFields[key] = entries
			} else {
				// Multipart scalars, objects and arrays reach the decoder in the
				// same text form as fields supplied by the client.
				effectiveFields[key] = []string{value.Raw}
			}
		}
		body["fields"] = effectiveFields
		request.BodyText = nil
		request.RequestBody = effectiveFields
	}
	request.Body = body
	return request, nil
}
