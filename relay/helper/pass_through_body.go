package helper

import (
	"bytes"
	"io"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

// PassThroughRequestBody returns the outbound passthrough body. When the
// global mapping toggle is on and the channel mapped the model, only the
// top-level JSON "model" field is rewritten. Otherwise the original stored
// request body is replayed unchanged.
//
// closer is non-nil only when a rewritten body was allocated; callers must
// Close it after the upstream request. The original gin-owned storage is
// never closed here.
func PassThroughRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (body common.ReplayableBody, closer io.Closer, err error) {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil, nil, err
	}
	if !shouldApplyPassThroughModelMapping(info) {
		if common.DebugEnabled {
			if debugBytes, bErr := storage.Bytes(); bErr == nil {
				logger.LogDebug(c, "requestBody: %s", debugBytes)
			}
		}
		return common.NewReplayableBodyReader(storage), nil, nil
	}
	original, err := storage.Bytes()
	if err != nil {
		return nil, nil, err
	}
	patched := applyPassThroughModelMapping(original, info)
	if common.DebugEnabled {
		logger.LogDebug(c, "requestBody: %s", patched)
	}
	if bytes.Equal(patched, original) {
		return common.NewReplayableBodyReader(storage), nil, nil
	}
	outbound, closer, err := relaycommon.NewOutboundJSONBody(patched)
	if err != nil {
		return nil, nil, err
	}
	return outbound, closer, nil
}

func shouldApplyPassThroughModelMapping(info *relaycommon.RelayInfo) bool {
	if info == nil || info.ChannelMeta == nil {
		return false
	}
	if !model_setting.GetGlobalSettings().PassThroughModelMappingEnabled {
		return false
	}
	if !info.IsModelMapped {
		return false
	}
	upstream := info.UpstreamModelName
	return upstream != "" && upstream != info.OriginModelName
}

func applyPassThroughModelMapping(body []byte, info *relaycommon.RelayInfo) []byte {
	if len(body) == 0 || !shouldApplyPassThroughModelMapping(info) {
		return body
	}
	if !gjson.ValidBytes(body) {
		return body
	}
	modelResult := gjson.GetBytes(body, "model")
	if !modelResult.Exists() {
		return body
	}
	upstream := info.UpstreamModelName
	if modelResult.String() == upstream {
		return body
	}
	// storage.Bytes() may return the live backing array; copy before sjson.
	working := append([]byte(nil), body...)
	patched, err := sjson.SetBytes(working, "model", upstream)
	if err != nil {
		return body
	}
	return patched
}
