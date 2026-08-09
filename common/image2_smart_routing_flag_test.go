package common

import "testing"

// The Image2 capability router is a switch-only rollout: it ships disabled and
// a deployment must opt in explicitly. Two things have to hold for that to be
// true, and neither was pinned before.
//
// First, the compile-time default. A process that never reaches InitEnv --
// an early configuration failure, a binary embedding this package, a test
// harness -- still reads Image2SmartRoutingEnabled, and it must read false.
func TestImage2SmartRoutingShipsDisabled(t *testing.T) {
	if Image2SmartRoutingEnabled {
		t.Fatal("Image2SmartRoutingEnabled must default to false before InitEnv runs")
	}
}

// Second, the environment cannot enable it by accident. InitEnv resolves the
// flag with GetEnvOrDefaultBool(..., false), and strconv.ParseBool accepts a
// narrow vocabulary: "yes", "on" and "enabled" are not booleans, so they fall
// back to the default rather than enabling the feature. That asymmetry is the
// property worth protecting -- a typo in an operator's env file must fail
// closed, and only an explicit boolean true may open the routing path.
func TestImage2SmartRoutingEnvResolvesFailClosed(t *testing.T) {
	const key = "IMAGE2_SMART_ROUTING_ENABLED"
	tests := []struct {
		name  string
		set   bool
		value string
		want  bool
	}{
		{name: "unset stays disabled", set: false, want: false},
		{name: "empty stays disabled", set: true, value: "", want: false},
		{name: "explicit false", set: true, value: "false", want: false},
		{name: "explicit False", set: true, value: "False", want: false},
		{name: "explicit 0", set: true, value: "0", want: false},
		{name: "yes is not a boolean and must not enable", set: true, value: "yes", want: false},
		{name: "on is not a boolean and must not enable", set: true, value: "on", want: false},
		{name: "enabled is not a boolean and must not enable", set: true, value: "enabled", want: false},
		{name: "whitespace is not a boolean and must not enable", set: true, value: " true", want: false},
		{name: "explicit true", set: true, value: "true", want: true},
		{name: "explicit TRUE", set: true, value: "TRUE", want: true},
		{name: "explicit 1", set: true, value: "1", want: true},
		{name: "explicit t", set: true, value: "t", want: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if test.set {
				t.Setenv(key, test.value)
			}
			if got := GetEnvOrDefaultBool(key, false); got != test.want {
				t.Fatalf("GetEnvOrDefaultBool(%s=%q) = %t, want %t", key, test.value, got, test.want)
			}
		})
	}
}
