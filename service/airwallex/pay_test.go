package airwallex

import (
	"reflect"
	"testing"
)

func TestBuildConfirmPaymentMethodIncludesRedirectMethodPayload(t *testing.T) {
	tests := []struct {
		name   string
		method string
		want   map[string]any
	}{
		{
			name:   "alipay alias uses Airwallex alipaycn payload",
			method: "alipay",
			want: map[string]any{
				"type":     "alipaycn",
				"alipaycn": map[string]any{},
			},
		},
		{
			name:   "alipaycn includes nested alipaycn payload",
			method: "alipaycn",
			want: map[string]any{
				"type":     "alipaycn",
				"alipaycn": map[string]any{},
			},
		},
		{
			name:   "alipayhk includes nested alipayhk payload",
			method: "alipayhk",
			want: map[string]any{
				"type":     "alipayhk",
				"alipayhk": map[string]any{},
			},
		},
		{
			name:   "card keeps simple payment method",
			method: "card",
			want: map[string]any{
				"type": "card",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := buildConfirmPaymentMethod(tt.method)

			if !reflect.DeepEqual(got, tt.want) {
				t.Fatalf("buildConfirmPaymentMethod(%q) = %#v, want %#v", tt.method, got, tt.want)
			}
		})
	}
}
