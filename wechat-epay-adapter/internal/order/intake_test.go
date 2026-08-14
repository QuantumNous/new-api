package order

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestParseAmountFenPreservesDecimalPrecision(t *testing.T) {
	tests := []struct {
		raw  string
		fen  int64
		text string
	}{
		{raw: "0.01", fen: 1, text: "0.01"},
		{raw: "0.10", fen: 10, text: "0.10"},
		{raw: "1.01", fen: 101, text: "1.01"},
	}
	for _, test := range tests {
		fen, text, err := ParseAmountFen(test.raw, "5000.00")
		assert.NoError(t, err)
		assert.Equal(t, test.fen, fen)
		assert.Equal(t, test.text, text)
	}
}

func TestParseAmountFenRejectsAmbiguousOrInvalidValues(t *testing.T) {
	for _, raw := range []string{"1.001", "1e2", "+1.00", "-1.00", " 1.00", "0", "5000.01"} {
		_, _, err := ParseAmountFen(raw, "5000.00")
		assert.Error(t, err, raw)
	}
}

func TestFingerprintSeparatesFields(t *testing.T) {
	assert.NotEqual(t, Fingerprint("a", "bc"), Fingerprint("ab", "c"))
	assert.Equal(t, Fingerprint("pid", "wxpay"), Fingerprint("pid", "wxpay"))
}
