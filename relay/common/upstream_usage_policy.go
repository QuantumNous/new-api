package common

import "github.com/QuantumNous/new-api/dto"

func ShouldTrustUpstreamUsage(settings dto.ChannelOtherSettings) bool {
	if settings.TrustUpstreamUsage == nil {
		return false
	}
	return *settings.TrustUpstreamUsage
}
