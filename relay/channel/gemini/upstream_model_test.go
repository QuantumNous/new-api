package gemini

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/assert"
)

func TestURLModelNameStripsPublisherPrefix(t *testing.T) {
	t.Parallel()

	info := &relaycommon.RelayInfo{
		OriginModelName: "gemini-3.7-flash",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "google/gemini-3.7-flash",
		},
	}

	assert.Equal(t, "gemini-3.7-flash", URLModelName(info))
}
