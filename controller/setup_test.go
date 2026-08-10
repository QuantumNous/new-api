package controller

import "testing"

func TestValidateSetupCredentialsUsesUnicodeCharacterCounts(t *testing.T) {
	tests := []struct {
		name    string
		request SetupRequest
		message string
	}{
		{
			name: "accepts twelve unicode username characters",
			request: SetupRequest{
				Username:        "一二三四五六七八九十甲乙",
				Password:        "密码一二三四五六",
				ConfirmPassword: "密码一二三四五六",
			},
		},
		{
			name: "rejects thirteen unicode username characters",
			request: SetupRequest{
				Username:        "一二三四五六七八九十甲乙丙",
				Password:        "password123",
				ConfirmPassword: "password123",
			},
			message: "用户名长度不能超过12个字符",
		},
		{
			name: "accepts eight unicode password characters",
			request: SetupRequest{
				Username:        "admin",
				Password:        "密码一二三四五六",
				ConfirmPassword: "密码一二三四五六",
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if message := validateSetupCredentials(test.request); message != test.message {
				t.Fatalf("validateSetupCredentials() = %q, want %q", message, test.message)
			}
		})
	}
}
