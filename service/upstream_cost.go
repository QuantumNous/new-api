package service

import (
	"encoding/json"
	"math"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/shopspring/decimal"
)

const upstreamCostMicrosPerCNY = int64(1_000_000)

type upstreamCostProfile struct {
	mode         string
	nativeUnit   string
	rate         decimal.Decimal
	rateFloat    float64
	priceVersion string
}

// AttachUpstreamCost records an estimated CNY acquisition cost from the
// gateway's base billing units. It is retained for billing paths that do not
// expose a normalized upstream usage object.
func AttachUpstreamCost(relayInfo *relaycommon.RelayInfo, quota int, other map[string]interface{}) {
	attachUpstreamCost(relayInfo, nil, quota, other)
}

// AttachUpstreamCostWithUsage prefers an authoritative cost returned by the
// upstream when the channel profile allows it, and otherwise falls back to the
// gateway's base billing units. The snapshot is admin-only and never changes
// the user's quota charge.
func AttachUpstreamCostWithUsage(relayInfo *relaycommon.RelayInfo, usage *dto.Usage, quota int, other map[string]interface{}) {
	attachUpstreamCost(relayInfo, usage, quota, other)
}

func attachUpstreamCost(relayInfo *relaycommon.RelayInfo, usage *dto.Usage, quota int, other map[string]interface{}) {
	if other == nil || relayInfo == nil || relayInfo.ChannelMeta == nil {
		return
	}
	profile, ok := resolveUpstreamCostProfile(relayInfo)
	if !ok {
		settings := relayInfo.ChannelOtherSettings
		mode := strings.TrimSpace(settings.UpstreamCostMode)
		if mode == "" {
			mode = dto.UpstreamCostModeBillingUnits
		}
		nativeUnit := strings.ToUpper(strings.TrimSpace(settings.UpstreamCostUnit))
		if nativeUnit == "" {
			nativeUnit = "UNIT"
		}
		priceVersion := strings.TrimSpace(settings.UpstreamCostPriceVersion)
		if priceVersion == "" {
			priceVersion = "manual"
		}
		attachUpstreamCostToAdminInfo(other, &dto.UpstreamCostSnapshot{
			Status:             dto.UpstreamCostStatusUnpriced,
			Mode:               mode,
			Reason:             "missing_channel_cost_profile",
			NativeUnit:         nativeUnit,
			PriceVersion:       priceVersion,
			SettlementCurrency: "CNY",
		})
		return
	}

	snapshot := &dto.UpstreamCostSnapshot{
		Status:                dto.UpstreamCostStatusUnpriced,
		Mode:                  profile.mode,
		NativeUnit:            profile.nativeUnit,
		RateCNYPerUnit:        profile.rateFloat,
		RateCNYPerUnitDecimal: profile.rate.String(),
		PriceVersion:          profile.priceVersion,
		SettlementCurrency:    "CNY",
	}

	nativeAmount, source, estimated, reason := resolveUpstreamNativeCost(profile.mode, usage, quota, other)
	if reason != "" {
		snapshot.Reason = reason
		attachUpstreamCostToAdminInfo(other, snapshot)
		return
	}

	amountCNY := nativeAmount.Mul(profile.rate)
	amountMicros := amountCNY.Mul(decimal.NewFromInt(upstreamCostMicrosPerCNY)).Round(0)
	maxInt64 := decimal.NewFromInt(math.MaxInt64)
	if amountMicros.IsNegative() || amountMicros.GreaterThan(maxInt64) {
		snapshot.Reason = "amount_out_of_range"
		attachUpstreamCostToAdminInfo(other, snapshot)
		return
	}

	nativeAmountFloat, _ := nativeAmount.Float64()
	amountCNYFloat, _ := amountCNY.Float64()
	if math.IsNaN(nativeAmountFloat) ||
		math.IsInf(nativeAmountFloat, 0) ||
		math.IsNaN(amountCNYFloat) ||
		math.IsInf(amountCNYFloat, 0) {
		snapshot.Reason = "amount_out_of_range"
		attachUpstreamCostToAdminInfo(other, snapshot)
		return
	}

	snapshot.Status = dto.UpstreamCostStatusSettled
	snapshot.Source = source
	snapshot.NativeAmount = nativeAmountFloat
	snapshot.NativeAmountDecimal = nativeAmount.String()
	snapshot.Units = nativeAmountFloat
	snapshot.AmountCNY = amountCNYFloat
	snapshot.AmountCNYMicros = amountMicros.IntPart()
	snapshot.Estimated = estimated
	attachUpstreamCostToAdminInfo(other, snapshot)
}

func resolveUpstreamCostProfile(relayInfo *relaycommon.RelayInfo) (upstreamCostProfile, bool) {
	if relayInfo == nil || relayInfo.ChannelMeta == nil {
		return upstreamCostProfile{}, false
	}
	settings := relayInfo.ChannelOtherSettings
	rate := settings.UpstreamCostRateCNY
	if rate == nil ||
		*rate <= 0 ||
		math.IsNaN(*rate) ||
		math.IsInf(*rate, 0) ||
		*rate > dto.MaxUpstreamCostRateCNY {
		return upstreamCostProfile{}, false
	}

	mode := strings.TrimSpace(settings.UpstreamCostMode)
	if mode == "" {
		// Channels saved before multi-source cost profiles used the local billing
		// unit conversion. Preserve that behavior on upgrade.
		mode = dto.UpstreamCostModeBillingUnits
	}
	switch mode {
	case dto.UpstreamCostModeAuto, dto.UpstreamCostModeResponseCost, dto.UpstreamCostModeBillingUnits:
	default:
		return upstreamCostProfile{}, false
	}

	nativeUnit := strings.ToUpper(strings.TrimSpace(settings.UpstreamCostUnit))
	if nativeUnit == "" {
		nativeUnit = "UNIT"
	}
	priceVersion := strings.TrimSpace(settings.UpstreamCostPriceVersion)
	if priceVersion == "" {
		priceVersion = "manual"
	}
	return upstreamCostProfile{
		mode:         mode,
		nativeUnit:   nativeUnit,
		rate:         decimal.NewFromFloat(*rate),
		rateFloat:    *rate,
		priceVersion: priceVersion,
	}, true
}

func resolveUpstreamNativeCost(mode string, usage *dto.Usage, quota int, other map[string]interface{}) (decimal.Decimal, string, bool, string) {
	if mode == dto.UpstreamCostModeAuto || mode == dto.UpstreamCostModeResponseCost {
		if amount, ok := upstreamResponseCost(usage); ok {
			return amount, dto.UpstreamCostSourceResponseCost, false, ""
		}
		if mode == dto.UpstreamCostModeResponseCost {
			return decimal.Zero, "", false, "missing_response_cost"
		}
	}

	if quota < 0 || common.QuotaPerUnit <= 0 {
		return decimal.Zero, "", true, "missing_billing_units"
	}
	units := decimal.NewFromInt(int64(quota)).Div(decimal.NewFromFloat(common.QuotaPerUnit))
	if groupRatio, ok := decimalFromAny(other["group_ratio"]); ok && groupRatio.IsPositive() {
		units = units.Div(groupRatio)
	}
	if units.IsNegative() {
		return decimal.Zero, "", true, "invalid_billing_units"
	}
	return units, dto.UpstreamCostSourceBillingUnits, true, ""
}

func upstreamResponseCost(usage *dto.Usage) (decimal.Decimal, bool) {
	if usage == nil {
		return decimal.Zero, false
	}
	amount, ok := decimalFromAny(usage.Cost)
	if !ok || amount.IsNegative() {
		return decimal.Zero, false
	}
	return amount, true
}

func decimalFromAny(value any) (decimal.Decimal, bool) {
	switch number := value.(type) {
	case nil:
		return decimal.Zero, false
	case decimal.Decimal:
		return number, true
	case json.Number:
		result, err := decimal.NewFromString(number.String())
		return result, err == nil
	case string:
		result, err := decimal.NewFromString(strings.TrimSpace(number))
		return result, err == nil
	case float64:
		if math.IsNaN(number) || math.IsInf(number, 0) {
			return decimal.Zero, false
		}
		return decimal.NewFromFloat(number), true
	case float32:
		value64 := float64(number)
		if math.IsNaN(value64) || math.IsInf(value64, 0) {
			return decimal.Zero, false
		}
		return decimal.NewFromFloat32(number), true
	case int:
		return decimal.NewFromInt(int64(number)), true
	case int64:
		return decimal.NewFromInt(number), true
	case int32:
		return decimal.NewFromInt(int64(number)), true
	case uint:
		result, err := decimal.NewFromString(strconv.FormatUint(uint64(number), 10))
		return result, err == nil
	case uint64:
		result, err := decimal.NewFromString(strconv.FormatUint(number, 10))
		return result, err == nil
	case uint32:
		return decimal.NewFromInt(int64(number)), true
	default:
		return decimal.Zero, false
	}
}

func attachUpstreamCostToAdminInfo(other map[string]interface{}, snapshot *dto.UpstreamCostSnapshot) {
	adminInfo, ok := other["admin_info"].(map[string]interface{})
	if !ok || adminInfo == nil {
		adminInfo = make(map[string]interface{})
		other["admin_info"] = adminInfo
	}
	adminInfo["upstream_cost"] = snapshot
}
