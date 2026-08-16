package controller

import "unicode/utf8"

func truncateChannelContributionError(message string, maxBytes int) string {
	if maxBytes <= 0 {
		return ""
	}
	if len(message) <= maxBytes {
		return message
	}
	limit := maxBytes
	for limit > 0 && !utf8.RuneStart(message[limit]) {
		limit--
	}
	return message[:limit]
}
