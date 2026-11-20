package volcengine

import (
	"net/url"
	"strings"

	channelconstant "github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"
)

var nativeMessagesHosts = map[string]struct{}{
	"ark.cn-beijing.volces.com":       {},
	"ark.ap-southeast.bytepluses.com": {},
}

// nativeMessagesOrigin 判断 Claude 格式请求是否直连方舟原生 Messages 接口
func nativeMessagesOrigin(info *relaycommon.RelayInfo) (string, bool) {
	if info == nil || info.ChannelMeta == nil || info.RelayFormat != types.RelayFormatClaude {
		return "", false
	}
	if _, ok := channelconstant.ChannelSpecialBases[info.ChannelBaseUrl]; ok {
		return "", false
	}
	if strings.HasPrefix(info.UpstreamModelName, "bot") {
		return "", false
	}
	baseURL := info.ChannelBaseUrl
	if baseURL == "" {
		baseURL = channelconstant.ChannelBaseURLs[channelconstant.ChannelTypeVolcEngine]
	}
	parsed, err := url.Parse(baseURL)
	if err != nil {
		return "", false
	}
	if _, ok := nativeMessagesHosts[strings.ToLower(parsed.Hostname())]; !ok {
		return "", false
	}
	// 只认根路径或 /api/v3，其余路径（如手填的 /api/coding）保持原路由
	if path := strings.TrimSuffix(parsed.Path, "/"); path != "" && path != "/api/v3" {
		return "", false
	}
	return parsed.Scheme + "://" + strings.ToLower(parsed.Host), true
}
