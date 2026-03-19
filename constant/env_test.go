package constant

import "testing"

func TestEffectiveMaxRequestBodyMB(t *testing.T) {
	original := MaxRequestBodyMB
	t.Cleanup(func() {
		MaxRequestBodyMB = original
	})

	tests := []struct {
		name  string
		value int
		want  int
	}{
		{name: "positive value", value: 64, want: 64},
		{name: "zero falls back to default", value: 0, want: DefaultMaxRequestBodyMB},
		{name: "negative falls back to default", value: -1, want: DefaultMaxRequestBodyMB},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			MaxRequestBodyMB = tt.value
			if got := EffectiveMaxRequestBodyMB(); got != tt.want {
				t.Fatalf("EffectiveMaxRequestBodyMB() = %d, want %d", got, tt.want)
			}
		})
	}
}
