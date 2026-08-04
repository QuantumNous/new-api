package common

import "testing"

func TestSafeFailoverMaxAttemptsConfigSemantics(t *testing.T) {
	tests := []struct {
		name string
		env  string
		want int
	}{
		{name: "unset uses bounded default", env: "", want: DefaultSafeFailoverMaxAttempts},
		{name: "explicit zero exhausts candidates", env: "0", want: 0},
		{name: "positive value is hard upper bound", env: "3", want: 3},
		{name: "negative value falls back to bounded default", env: "-1", want: DefaultSafeFailoverMaxAttempts},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Setenv("SAFE_FAILOVER_MAX_ATTEMPTS", test.env)
			if got := safeFailoverMaxAttemptsFromEnv(); got != test.want {
				t.Fatalf("safeFailoverMaxAttemptsFromEnv() = %d, want %d", got, test.want)
			}
		})
	}
}
