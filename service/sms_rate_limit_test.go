package service

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestCheckSMSRateLimitBlocksByPhoneWithinScene(t *testing.T) {
	resetSMSRateLimitGlobals(t)
	common.SMSRateLimitEnabled = true
	common.SMSRateLimitWindowSeconds = 60
	common.SMSRateLimitPhoneCount = 1
	ResetSMSRateLimiterForTest()

	input := SMSRateLimitInput{
		Phone: "13800138000",
		IP:    "203.0.113.9",
		Scene: common.SMSSceneRegister,
	}
	if err := CheckSMSRateLimit(input); err != nil {
		t.Fatalf("first request should be allowed: %v", err)
	}
	err := CheckSMSRateLimit(input)
	if err == nil || !strings.Contains(err.Error(), "phone") {
		t.Fatalf("expected phone rate limit error, got %v", err)
	}
}

func TestCheckSMSRateLimitSeparatesPhoneBucketsByScene(t *testing.T) {
	resetSMSRateLimitGlobals(t)
	common.SMSRateLimitEnabled = true
	common.SMSRateLimitWindowSeconds = 60
	common.SMSRateLimitPhoneCount = 1
	ResetSMSRateLimiterForTest()

	first := SMSRateLimitInput{Phone: "13800138000", Scene: common.SMSSceneRegister}
	second := SMSRateLimitInput{Phone: "13800138000", Scene: common.SMSSceneLogin}
	if err := CheckSMSRateLimit(first); err != nil {
		t.Fatalf("first scene request should be allowed: %v", err)
	}
	if err := CheckSMSRateLimit(second); err != nil {
		t.Fatalf("different scene should use a separate phone bucket: %v", err)
	}
}

func TestCheckSMSRateLimitBlocksByIPAccountAndScene(t *testing.T) {
	tests := []struct {
		name      string
		configure func()
		first     SMSRateLimitInput
		second    SMSRateLimitInput
		want      string
	}{
		{
			name: "ip",
			configure: func() {
				common.SMSRateLimitIPCount = 1
			},
			first:  SMSRateLimitInput{Phone: "13800138000", IP: "203.0.113.9", Scene: common.SMSSceneRegister},
			second: SMSRateLimitInput{Phone: "13900139000", IP: "203.0.113.9", Scene: common.SMSSceneRegister},
			want:   "ip",
		},
		{
			name: "account",
			configure: func() {
				common.SMSRateLimitAccountCount = 1
			},
			first:  SMSRateLimitInput{Phone: "13800138000", AccountID: "42", Scene: common.SMSSceneRegister},
			second: SMSRateLimitInput{Phone: "13900139000", AccountID: "42", Scene: common.SMSSceneRegister},
			want:   "account",
		},
		{
			name: "scene",
			configure: func() {
				common.SMSRateLimitSceneCount = 1
			},
			first:  SMSRateLimitInput{Phone: "13800138000", Scene: common.SMSSceneRegister},
			second: SMSRateLimitInput{Phone: "13900139000", Scene: common.SMSSceneRegister},
			want:   "scene",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resetSMSRateLimitGlobals(t)
			common.SMSRateLimitEnabled = true
			common.SMSRateLimitWindowSeconds = 60
			tt.configure()
			ResetSMSRateLimiterForTest()

			if err := CheckSMSRateLimit(tt.first); err != nil {
				t.Fatalf("first request should be allowed: %v", err)
			}
			err := CheckSMSRateLimit(tt.second)
			if err == nil || !strings.Contains(err.Error(), tt.want) {
				t.Fatalf("expected %s rate limit error, got %v", tt.want, err)
			}
		})
	}
}

func resetSMSRateLimitGlobals(t *testing.T) {
	t.Helper()
	originalEnabled := common.SMSRateLimitEnabled
	originalWindow := common.SMSRateLimitWindowSeconds
	originalPhone := common.SMSRateLimitPhoneCount
	originalIP := common.SMSRateLimitIPCount
	originalAccount := common.SMSRateLimitAccountCount
	originalScene := common.SMSRateLimitSceneCount
	t.Cleanup(func() {
		common.SMSRateLimitEnabled = originalEnabled
		common.SMSRateLimitWindowSeconds = originalWindow
		common.SMSRateLimitPhoneCount = originalPhone
		common.SMSRateLimitIPCount = originalIP
		common.SMSRateLimitAccountCount = originalAccount
		common.SMSRateLimitSceneCount = originalScene
		ResetSMSRateLimiterForTest()
	})
	common.SMSRateLimitEnabled = false
	common.SMSRateLimitWindowSeconds = 60
	common.SMSRateLimitPhoneCount = 0
	common.SMSRateLimitIPCount = 0
	common.SMSRateLimitAccountCount = 0
	common.SMSRateLimitSceneCount = 0
}
