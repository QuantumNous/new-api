package relay

import relaycommon "github.com/QuantumNous/new-api/relay/common"

func applyTextPlan(info *relaycommon.RelayInfo) {
	if info == nil {
		return
	}
	info.BuildTextPlan(shouldUpgradeChatToResponses(info))
}

// ApplyTextPlan is the production TextPlan decision. Shared with channel-test
// so body conversion, GetRequestURL, and DoResponse all read the same native.
func ApplyTextPlan(info *relaycommon.RelayInfo) {
	applyTextPlan(info)
}
