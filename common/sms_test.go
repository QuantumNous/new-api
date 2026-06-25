package common

import (
	"strings"
	"testing"
)

func TestNormalizeMainlandPhone(t *testing.T) {
	tests := []struct {
		name      string
		phone     string
		want      string
		wantError bool
	}{
		{name: "plain", phone: "13812345678", want: "+8613812345678"},
		{name: "country code", phone: "+8613812345678", want: "+8613812345678"},
		{name: "zero country code", phone: "008613812345678", want: "+8613812345678"},
		{name: "separators", phone: "138-1234-5678", want: "+8613812345678"},
		{name: "invalid prefix", phone: "23812345678", wantError: true},
		{name: "too short", phone: "1381234", wantError: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := NormalizeMainlandPhone(tt.phone)
			if tt.wantError {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tt.want {
				t.Fatalf("expected %q, got %q", tt.want, got)
			}
		})
	}
}

func TestGenerateNumericVerificationCode(t *testing.T) {
	code, err := GenerateNumericVerificationCode(6)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(code) != 6 {
		t.Fatalf("expected length 6, got %d", len(code))
	}
	if strings.Trim(code, "0123456789") != "" {
		t.Fatalf("expected numeric code, got %q", code)
	}
}

func TestMaskMainlandPhone(t *testing.T) {
	got := MaskMainlandPhone("+8613812345678")
	want := "+86*******5678"
	if got != want {
		t.Fatalf("expected %q, got %q", want, got)
	}
}

func TestVerifyAndDeleteCodeWithKeyConsumesCodeOnce(t *testing.T) {
	key := "sms-test-phone"
	code := "123456"
	RegisterVerificationCodeWithKey(key, code, SmsLoginPurpose)

	if !VerifyAndDeleteCodeWithKey(key, code, SmsLoginPurpose) {
		t.Fatal("expected first verification to pass")
	}
	if VerifyAndDeleteCodeWithKey(key, code, SmsLoginPurpose) {
		t.Fatal("expected consumed verification code to fail")
	}
}
