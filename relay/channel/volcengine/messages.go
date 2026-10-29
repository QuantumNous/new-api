package volcengine

import (
	"net/url"
	"strings"

	channelconstant "github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

// 方舟官方创建 Message 的地址。
const officialMessagesURL = "https://ark.cn-beijing.volces.com/api/compatible/v1/messages"

const officialArkHost = "ark.cn-beijing.volces.com"

// UseOfficialMessagesAPI 判断这次请求是否走方舟官方 Messages。
func UseOfficialMessagesAPI(info *relaycommon.RelayInfo) bool {
	if info == nil || info.ChannelMeta == nil {
		return false
	}
	if info.RelayFormat != types.RelayFormatClaude {
		return false
	}
	if info.ChannelType != channelconstant.ChannelTypeVolcEngine {
		return false
	}
	if _, ok := channelconstant.ChannelSpecialBases[info.ChannelBaseUrl]; ok {
		return false
	}
	baseURL := strings.TrimSpace(info.ChannelBaseUrl)
	if baseURL == "" {
		return true
	}
	parsed, err := url.Parse(baseURL)
	if err != nil || parsed.Hostname() == "" {
		return false
	}
	return strings.EqualFold(parsed.Hostname(), officialArkHost)
}

// PrepareOfficialMessagesBody 准备官方 Messages 的出站请求体。
func PrepareOfficialMessagesBody(raw []byte, upstreamModel string, mapped bool) ([]byte, error) {
	out := make([]byte, len(raw))
	copy(out, raw)
	if !mapped || upstreamModel == "" || len(out) == 0 {
		return out, nil
	}
	if gjson.GetBytes(out, "model").String() == upstreamModel {
		return out, nil
	}
	return sjson.SetBytes(out, "model", upstreamModel)
}
