package service

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/assert"
)

// TestConstrainRetryGroupForBilling verifies scoped subscription retries stay
// inside the purchased group while wallet and unscoped funding retain auto routing.
func TestConstrainRetryGroupForBilling(t *testing.T) {
	tests := []struct {
		name       string
		funding    FundingSource
		retryGroup string
		want       string
	}{
		{
			name:       "scoped subscription pins retry group",
			funding:    &SubscriptionFunding{UpgradeGroup: "premium"},
			retryGroup: "auto",
			want:       "premium",
		},
		{
			name:       "unscoped subscription keeps auto failover",
			funding:    &SubscriptionFunding{},
			retryGroup: "auto",
			want:       "auto",
		},
		{
			name:       "wallet keeps auto failover",
			funding:    &WalletFunding{},
			retryGroup: "auto",
			want:       "auto",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			info := &relaycommon.RelayInfo{}
			info.Billing = &BillingSession{relayInfo: info, funding: tt.funding}
			assert.Equal(t, tt.want, ConstrainRetryGroupForBilling(info, tt.retryGroup))
		})
	}
}
