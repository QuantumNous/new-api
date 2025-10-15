package minimax

import (
	"fmt"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	return fmt.Sprintf("%s/v1/text/chatcompletion_v2", info.ChannelBaseUrl), nil
}
