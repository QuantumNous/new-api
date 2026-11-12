package service

import (
	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/gin-gonic/gin"
)

// abnormalChargeCase is the billing situation of a request that did not end
// normally. A failure before the response started is always refunded.
type abnormalChargeCase int

const (
	abnormalChargeNone abnormalChargeCase = iota
	abnormalChargeClientBeforeResponse
	abnormalChargeClientDuringResponse
	abnormalChargeUpstreamDuringResponse
	abnormalChargeUpstreamBeforeResponse
)

const abnormalChargeCaseKey = "abnormal_charge_case"

// classifyAbnormalCharge reads the tracked upstream attempt. A request whose
// attempt is not tracked is treated as normal so it keeps today's charge.
func classifyAbnormalCharge(c *gin.Context, info *relaycommon.RelayInfo) abnormalChargeCase {
	if c != nil {
		if value, ok := c.Get(abnormalChargeCaseKey); ok {
			if chargeCase, ok := value.(abnormalChargeCase); ok {
				return chargeCase
			}
		}
	}
	attempt := info.UpstreamAttempt()
	if attempt == nil {
		return abnormalChargeNone
	}
	// A Cloudflare-truncated relay keeps running, so the attempt itself ends
	// normally; the moment the client left decides the case.
	if goneAt, gone := proxiedClientGoneAt(c); gone {
		if attempt.RespondedBefore(goneAt) {
			return abnormalChargeClientDuringResponse
		}
		return abnormalChargeClientBeforeResponse
	}
	termination := info.Termination()
	if termination == nil {
		return abnormalChargeNone
	}
	receiving := termination.Phase == relaycommon.TerminationPhaseReceiving
	switch {
	case termination.EndedBy == relaycommon.TerminationEndedByClient && receiving:
		return abnormalChargeClientDuringResponse
	case termination.EndedBy == relaycommon.TerminationEndedByClient:
		return abnormalChargeClientBeforeResponse
	case receiving:
		return abnormalChargeUpstreamDuringResponse
	default:
		return abnormalChargeUpstreamBeforeResponse
	}
}

// policyBlockIsFree reports whether upstream refused the request by a safety
// policy while charge_policy_block is off, so nothing may be charged for it.
func policyBlockIsFree(info *relaycommon.RelayInfo) bool {
	return info != nil && !billing_setting.ChargePolicyBlock() && info.StreamStatus.PolicyBlockCode() != ""
}

// abnormalChargeWaiver reports whether settlement must drop the charge and
// the log line explaining why. A request upstream refused by a safety policy
// is free unless charge_policy_block is on. A request that failed before
// upstream responded produced nothing to bill and is refunded in full;
// anything else is charged the usage it produced.
func abnormalChargeWaiver(info *relaycommon.RelayInfo, chargeCase abnormalChargeCase) (bool, *common.Message) {
	if policyBlockIsFree(info) {
		return true, common.NewMessage("Not charged: upstream blocked the request by a safety policy")
	}
	if chargeCase == abnormalChargeUpstreamBeforeResponse {
		return true, common.NewMessage("Not charged: upstream or the gateway failed before responding")
	}
	return false, nil
}
