package service

import "github.com/QuantumNous/new-api/constant"

// VideoResultChannelLabel returns the fixed metrics/archival channel label for
// channels whose completed video should be archived into GCS and re-served via
// the signed download proxy. Empty means the channel does not use the archive
// redirect path.
func VideoResultChannelLabel(channelType int) string {
	switch channelType {
	case constant.ChannelTypeTechMobiVideo:
		return "techmobi"
	case constant.ChannelTypeModelAPISeedance:
		return "modelapi"
	default:
		return ""
	}
}
