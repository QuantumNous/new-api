package common

import "testing"

func TestInitEnvReadsSessionCookieSecure(t *testing.T) {
	original := SessionCookieSecure
	t.Cleanup(func() {
		SessionCookieSecure = original
	})

	tests := []struct {
		name  string
		value string
		want  bool
	}{
		{name: "unset defaults false", want: false},
		{name: "true enables secure cookie", value: "true", want: true},
		{name: "uppercase true enables secure cookie", value: "TRUE", want: true},
		{name: "invalid value falls back false", value: "not-bool", want: false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			SessionCookieSecure = true
			t.Setenv("SESSION_COOKIE_SECURE", tc.value)

			InitEnv()

			if SessionCookieSecure != tc.want {
				t.Fatalf("SessionCookieSecure = %t, want %t", SessionCookieSecure, tc.want)
			}
		})
	}
}
