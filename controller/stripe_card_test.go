package controller

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseCardBindUserId(t *testing.T) {
	cases := []struct {
		name     string
		ref      string
		expected int
	}{
		{"valid", "cardbind_42_abcd1234", 42},
		{"valid large id", "cardbind_100000_xyz", 100000},
		{"missing prefix", "ref_deadbeef", 0},
		{"topup reference", "ref_123", 0},
		{"prefix only", "cardbind_", 0},
		{"non-numeric id", "cardbind_abc_xyz", 0},
		{"no random suffix", "cardbind_7", 7},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.expected, parseCardBindUserId(tc.ref))
		})
	}
}
