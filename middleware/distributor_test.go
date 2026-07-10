package middleware

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestAdvancedCustomChannelSupportsPlaygroundChatPath(t *testing.T) {
	channel := &model.Channel{
		Type: constant.ChannelTypeAdvancedCustom,
		OtherSettings: `{
			"advanced_custom": {
				"advanced_routes": [
					{
						"incoming_path": "/v1/chat/completions",
						"upstream_path": "/v1/chat/completions",
						"converter": "none"
					}
				]
			}
		}`,
	}

	require.True(t, channelSupportsRequestPath(channel, "/pg/chat/completions"))
}
