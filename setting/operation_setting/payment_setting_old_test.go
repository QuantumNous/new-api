package operation_setting

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIsEpaySignedTimestampEnabled(t *testing.T) {
	originalPayMethods := PayMethods
	t.Cleanup(func() {
		PayMethods = originalPayMethods
	})

	tests := []struct {
		name       string
		payMethods []map[string]string
		method     string
		want       bool
	}{
		{
			name:       "no configured methods",
			payMethods: nil,
			method:     "nowpayment",
			want:       false,
		},
		{
			name: "missing option defaults off",
			payMethods: []map[string]string{{
				"type": "nowpayment",
			}},
			method: "nowpayment",
			want:   false,
		},
		{
			name: "false string stays off",
			payMethods: []map[string]string{{
				"type":                  "nowpayment",
				"epay_signed_timestamp": "false",
			}},
			method: "nowpayment",
			want:   false,
		},
		{
			name: "noncanonical true stays off",
			payMethods: []map[string]string{{
				"type":                  "nowpayment",
				"epay_signed_timestamp": "TRUE",
			}},
			method: "nowpayment",
			want:   false,
		},
		{
			name: "enabled option on another type stays off",
			payMethods: []map[string]string{{
				"type":                  "alipay",
				"epay_signed_timestamp": "true",
			}},
			method: "nowpayment",
			want:   false,
		},
		{
			name: "matching true string enables option",
			payMethods: []map[string]string{{
				"type":                  "nowpayment",
				"epay_signed_timestamp": "true",
			}},
			method: "nowpayment",
			want:   true,
		},
		{
			name: "one enabled duplicate enables the type",
			payMethods: []map[string]string{
				{"type": "nowpayment"},
				{
					"type":                  "nowpayment",
					"epay_signed_timestamp": "true",
				},
			},
			method: "nowpayment",
			want:   true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			PayMethods = test.payMethods
			require.Equal(t, test.want, IsEpaySignedTimestampEnabled(test.method))
		})
	}
}
