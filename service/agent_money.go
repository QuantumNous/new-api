package service

import (
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
)

const agentPointMinorUnits = int64(100)

// ParseAgentPoints converts an unsigned decimal point value to its minor-unit
// representation without using floating-point arithmetic.
func ParseAgentPoints(value string) (int64, error) {
	if value == "" {
		return 0, errors.New("agent points cannot be empty")
	}

	parts := strings.Split(value, ".")
	if len(parts) > 2 || parts[0] == "" || (len(parts) == 2 && len(parts[1]) > 2) {
		return 0, fmt.Errorf("invalid agent points %q", value)
	}

	whole, err := parseAgentPointDigits(parts[0])
	if err != nil {
		return 0, err
	}
	if whole > math.MaxInt64/agentPointMinorUnits {
		return 0, fmt.Errorf("agent points %q overflow", value)
	}

	minor := int64(0)
	if len(parts) == 2 && parts[1] != "" {
		minor, err = parseAgentPointDigits(parts[1])
		if err != nil {
			return 0, err
		}
		if len(parts[1]) == 1 {
			minor *= 10
		}
	}
	if whole == math.MaxInt64/agentPointMinorUnits && minor > math.MaxInt64%agentPointMinorUnits {
		return 0, fmt.Errorf("agent points %q overflow", value)
	}
	return whole*agentPointMinorUnits + minor, nil
}

func parseAgentPointDigits(value string) (int64, error) {
	if value == "" {
		return 0, errors.New("agent points require digits")
	}

	result := int64(0)
	for _, char := range value {
		if char < '0' || char > '9' {
			return 0, fmt.Errorf("invalid agent points %q", value)
		}
		digit := int64(char - '0')
		if result > (math.MaxInt64-digit)/10 {
			return 0, fmt.Errorf("agent points %q overflow", value)
		}
		result = result*10 + digit
	}
	return result, nil
}

// FormatAgentPoints formats minor units with exactly two decimal places.
func FormatAgentPoints(value int64) string {
	if value < 0 {
		return "-" + strconv.FormatInt(-(value/agentPointMinorUnits), 10) + "." + fmt.Sprintf("%02d", -(value%agentPointMinorUnits))
	}
	return strconv.FormatInt(value/agentPointMinorUnits, 10) + "." + fmt.Sprintf("%02d", value%agentPointMinorUnits)
}

// AgentPurchaseTotal returns the checked cost of a positive quantity of codes.
func AgentPurchaseTotal(unitPrice int64, quantity int) (int64, error) {
	if unitPrice < 0 {
		return 0, errors.New("unit price cannot be negative")
	}
	if quantity <= 0 {
		return 0, errors.New("quantity must be positive")
	}

	quantity64 := int64(quantity)
	if unitPrice > math.MaxInt64/quantity64 {
		return 0, errors.New("agent purchase total overflow")
	}
	return unitPrice * quantity64, nil
}

// AgentRefundAmount calculates a rounded fee and the remaining refund for a
// single code. Both values are stored in minor units.
func AgentRefundAmount(unitPrice int64, feeBps int) (fee int64, refund int64, err error) {
	if unitPrice < 0 {
		return 0, 0, errors.New("unit price cannot be negative")
	}
	if feeBps < 0 || feeBps > 10000 {
		return 0, 0, errors.New("refund fee basis points must be between 0 and 10000")
	}

	bps := int64(feeBps)
	whole := (unitPrice / 10000) * bps
	remainder := (unitPrice % 10000) * bps
	fee = whole + (remainder+5000)/10000
	return fee, unitPrice - fee, nil
}
