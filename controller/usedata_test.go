package controller

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestValidateTokenQuotaRange(t *testing.T) {
	cases := []struct {
		name     string
		start    int64
		end      int64
		maxRange int64
		ok       bool
	}{
		{"valid 7d", 1_000_000, 1_000_000 + 7*86400, tokenQuotaAdminMaxRangeSec, true},
		{"valid edge max", 1_000_000, 1_000_000 + tokenQuotaUserMaxRangeSec, tokenQuotaUserMaxRangeSec, true},
		{"missing start", 0, 1_000_000, tokenQuotaUserMaxRangeSec, false},
		{"missing end", 1_000_000, 0, tokenQuotaUserMaxRangeSec, false},
		{"both zero", 0, 0, tokenQuotaUserMaxRangeSec, false},
		{"negative start", -1, 1_000_000, tokenQuotaUserMaxRangeSec, false},
		{"reversed range", 1_000_000, 999, tokenQuotaUserMaxRangeSec, false},
		{"user 31d exceeds cap", 1_000_000, 1_000_000 + 31*86400, tokenQuotaUserMaxRangeSec, false},
		{"admin 31d ok under admin cap", 1_000_000, 1_000_000 + 31*86400, tokenQuotaAdminMaxRangeSec, true},
		{"admin 91d exceeds admin cap", 1_000_000, 1_000_000 + 91*86400, tokenQuotaAdminMaxRangeSec, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			ok, msg := validateTokenQuotaRange(tc.start, tc.end, tc.maxRange)
			assert.Equal(t, tc.ok, ok)
			if !tc.ok {
				assert.NotEmpty(t, msg, "rejection should include a reason")
			}
		})
	}
}
