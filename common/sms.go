package common

import (
	"errors"
	"strings"
)

func NormalizeMainlandPhone(phone string) (string, error) {
	normalized := strings.TrimSpace(phone)
	normalized = strings.ReplaceAll(normalized, " ", "")
	normalized = strings.ReplaceAll(normalized, "-", "")
	normalized = strings.ReplaceAll(normalized, "(", "")
	normalized = strings.ReplaceAll(normalized, ")", "")

	if strings.HasPrefix(normalized, "0086") {
		normalized = "+86" + strings.TrimPrefix(normalized, "0086")
	} else if strings.HasPrefix(normalized, "86") && len(normalized) == 13 {
		normalized = "+86" + strings.TrimPrefix(normalized, "86")
	}

	normalized = strings.TrimPrefix(normalized, "+86")
	if len(normalized) != 11 || normalized[0] != '1' {
		return "", errors.New("invalid mainland phone number")
	}
	for _, ch := range normalized {
		if ch < '0' || ch > '9' {
			return "", errors.New("invalid mainland phone number")
		}
	}
	return "+86" + normalized, nil
}

func MainlandPhoneForSms(normalizedPhone string) string {
	return strings.TrimPrefix(normalizedPhone, "+86")
}

func MaskMainlandPhone(normalizedPhone string) string {
	phone := strings.TrimPrefix(normalizedPhone, "+86")
	if len(phone) <= 4 {
		return "***"
	}
	return "+86*******" + phone[len(phone)-4:]
}
