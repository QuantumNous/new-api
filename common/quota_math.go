package common

import (
	"fmt"
	"math"
	"strconv"

	"github.com/shopspring/decimal"
)

const (
	MaxQuota = math.MaxInt32
	MinQuota = math.MinInt32
)

type QuotaClampKind string

const (
	QuotaClampOverflow  QuotaClampKind = "overflow"
	QuotaClampUnderflow QuotaClampKind = "underflow"
	QuotaClampNaN       QuotaClampKind = "nan"
)

type QuotaClamp struct {
	Op       string         `json:"op"`
	Kind     QuotaClampKind `json:"kind"`
	Original string         `json:"original"`
	Clamped  int            `json:"clamped"`
}

func (c *QuotaClamp) Error() string {
	if c == nil {
		return ""
	}
	return fmt.Sprintf("quota conversion (%s) %s: original=%s, clamped=%d", c.Op, c.Kind, c.Original, c.Clamped)
}

func saturateQuota(value float64, op string) (int, *QuotaClamp) {
	var clamp *QuotaClamp
	switch {
	case math.IsNaN(value):
		clamp = &QuotaClamp{Op: op, Kind: QuotaClampNaN, Original: "NaN", Clamped: 0}
	case value > MaxQuota:
		clamp = &QuotaClamp{Op: op, Kind: QuotaClampOverflow, Original: strconv.FormatFloat(value, 'g', -1, 64), Clamped: MaxQuota}
	case value < MinQuota:
		clamp = &QuotaClamp{Op: op, Kind: QuotaClampUnderflow, Original: strconv.FormatFloat(value, 'g', -1, 64), Clamped: MinQuota}
	default:
		return int(value), nil
	}
	return clamp.Clamped, clamp
}

func QuotaFromFloat(value float64) int {
	quota, _ := QuotaFromFloatChecked(value)
	return quota
}

func QuotaFromFloatChecked(value float64) (int, *QuotaClamp) {
	return saturateQuota(value, "QuotaFromFloat")
}

func QuotaFromFloatStrict(value float64) (int, error) {
	quota, clamp := QuotaFromFloatChecked(value)
	if clamp != nil {
		return 0, clamp
	}
	return quota, nil
}

func QuotaRound(value float64) int {
	quota, _ := QuotaRoundChecked(value)
	return quota
}

func QuotaRoundChecked(value float64) (int, *QuotaClamp) {
	return saturateQuota(math.Round(value), "QuotaRound")
}

func QuotaRoundStrict(value float64) (int, error) {
	quota, clamp := QuotaRoundChecked(value)
	if clamp != nil {
		return 0, clamp
	}
	return quota, nil
}

func QuotaFromDecimal(value decimal.Decimal) int {
	quota, _ := QuotaFromDecimalChecked(value)
	return quota
}

func QuotaFromDecimalChecked(value decimal.Decimal) (int, *QuotaClamp) {
	rounded, _ := value.Round(0).Float64()
	return saturateQuota(rounded, "QuotaFromDecimal")
}
