package i18n

import "testing"

func TestControllerFacingMessagesHaveEnglishTranslations(t *testing.T) {
	if err := Init(); err != nil {
		t.Fatalf("init i18n: %v", err)
	}

	cases := []struct {
		name string
		key  string
		args map[string]any
		want string
	}{
		{
			name: "login required",
			key:  MsgAuthLoginRequired,
			want: "Please log in first",
		},
		{
			name: "custom oauth discovery required",
			key:  MsgCustomOAuthDiscoveryURLRequired,
			want: "Please enter a Discovery URL or Issuer URL first",
		},
		{
			name: "custom oauth discovery fetch failed",
			key:  MsgCustomOAuthDiscoveryFetchFailed,
			args: map[string]any{"Error": "bad gateway"},
			want: "Failed to fetch Discovery configuration: bad gateway",
		},
		{
			name: "secure verification success",
			key:  MsgSecureVerificationSuccess,
			want: "Verification successful",
		},
		{
			name: "secure verification unsupported method",
			key:  MsgSecureVerificationUnsupportedMethod,
			args: map[string]any{"Method": "sms"},
			want: "Unsupported verification method: sms",
		},
		{
			name: "payment min topup",
			key:  MsgPaymentMinTopup,
			args: map[string]any{"Min": 10},
			want: "Top-up amount must be at least 10",
		},
		{
			name: "payment config error",
			key:  MsgPaymentConfigError,
			want: "Payment configuration is invalid",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := Translate(LangEn, tc.key, tc.args)
			if got != tc.want {
				t.Fatalf("Translate(%q) = %q, want %q", tc.key, got, tc.want)
			}
		})
	}
}
