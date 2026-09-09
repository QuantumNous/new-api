package controller

import (
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
)

// redactUpstreamURLForClient replaces the channel's real upstream address with
// its display address before an error message leaves the server. Server logs
// keep the raw message so super admins can still troubleshoot.
func redactUpstreamURLForClient(info *relaycommon.RelayInfo, msg string) string {
	if info == nil || info.ChannelMeta == nil {
		return msg
	}
	return service.SanitizeWithPair(info.ChannelBaseUrl, info.ChannelDisplayBaseUrl, msg)
}
