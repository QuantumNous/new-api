package blockrun

import (
	"bytes"
	"crypto/ed25519"
	"encoding/base64"
	"math/big"
	"net/http"
	"strings"
	"testing"

	blockrunSDK "github.com/BlockRunAI/blockrun-llm-go"
	"github.com/QuantumNous/new-api/common"
	"github.com/mr-tron/base58"
)

func TestSignSolanaX402PaymentSelectsSolanaFromMixedAccepts(t *testing.T) {
	key, payer, payTo, recentBlockhash := solanaTestKeys()
	solanaOption := validSolanaOption(payer, payTo, recentBlockhash)
	resp := solanaPaymentRequiredResponse(t, []blockrunSDK.PaymentOption{validOption(), solanaOption})

	encoded, err := SignSolanaX402Payment(resp, key, "https://fallback.invalid", big.NewInt(1000))
	if err != nil {
		t.Fatalf("SignSolanaX402Payment: %v", err)
	}
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		t.Fatal(err)
	}
	var envelope struct {
		Accepted blockrunSDK.PaymentOption `json:"accepted"`
		Payload  map[string]string         `json:"payload"`
	}
	if err := common.Unmarshal(decoded, &envelope); err != nil {
		t.Fatal(err)
	}
	if envelope.Accepted.Network != expectedNetworkSolana || envelope.Accepted.Asset != blockrunSDK.USDCSolanaMainnet {
		t.Fatalf("wrong payment option selected: %#v", envelope.Accepted)
	}
	if envelope.Payload["transaction"] == "" {
		t.Fatal("signed Solana transaction is empty")
	}
}

func TestSignSolanaX402PaymentTrimsPrivateKey(t *testing.T) {
	key, payer, payTo, recentBlockhash := solanaTestKeys()
	resp := solanaPaymentRequiredResponse(t, []blockrunSDK.PaymentOption{
		validSolanaOption(payer, payTo, recentBlockhash),
	})

	encoded, err := SignSolanaX402Payment(resp, " \n\t"+key+"\r ", "https://fallback.invalid", big.NewInt(1000))
	if err != nil {
		t.Fatalf("SignSolanaX402Payment with surrounding whitespace: %v", err)
	}
	if encoded == "" {
		t.Fatal("signed Solana payment payload is empty")
	}
}

func TestSelectSolanaPaymentOptionRejectsMissingAndAmbiguousOptions(t *testing.T) {
	_, payer, payTo, recentBlockhash := solanaTestKeys()
	valid := validSolanaOption(payer, payTo, recentBlockhash)

	tests := []struct {
		name    string
		accepts []blockrunSDK.PaymentOption
		want    string
	}{
		{name: "empty", accepts: nil, want: "no exact Solana USDC"},
		{name: "wrong scheme", accepts: []blockrunSDK.PaymentOption{withSolanaOption(valid, func(o *blockrunSDK.PaymentOption) { o.Scheme = "upto" })}, want: "no exact Solana USDC"},
		{name: "wrong network", accepts: []blockrunSDK.PaymentOption{withSolanaOption(valid, func(o *blockrunSDK.PaymentOption) { o.Network = "solana-devnet" })}, want: "no exact Solana USDC"},
		{name: "wrong asset", accepts: []blockrunSDK.PaymentOption{withSolanaOption(valid, func(o *blockrunSDK.PaymentOption) { o.Asset = payTo })}, want: "no exact Solana USDC"},
		{
			name: "different matching options",
			accepts: []blockrunSDK.PaymentOption{
				valid,
				withSolanaOption(valid, func(o *blockrunSDK.PaymentOption) { o.Amount = "3" }),
			},
			want: "ambiguous",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := selectSolanaPaymentOption(tt.accepts)
			if err == nil || !strings.Contains(err.Error(), tt.want) {
				t.Fatalf("error = %v, want substring %q", err, tt.want)
			}
		})
	}

	selected, err := selectSolanaPaymentOption([]blockrunSDK.PaymentOption{valid, valid})
	if err != nil {
		t.Fatalf("identical duplicate options should not be ambiguous: %v", err)
	}
	if selected.Amount != valid.Amount {
		t.Fatalf("selected option = %#v", selected)
	}
}

func TestSignSolanaX402PaymentRejectsInvalidTrustBoundaryInputs(t *testing.T) {
	key, payer, payTo, recentBlockhash := solanaTestKeys()
	valid := validSolanaOption(payer, payTo, recentBlockhash)

	tests := []struct {
		name   string
		key    string
		cap    *big.Int
		mutate func(*blockrunSDK.PaymentOption)
		want   string
	}{
		{name: "missing cap", key: key, cap: nil, want: "cap must be configured"},
		{name: "zero cap", key: key, cap: big.NewInt(0), want: "cap must be configured"},
		{name: "amount zero", key: key, cap: big.NewInt(1000), mutate: func(o *blockrunSDK.PaymentOption) { o.Amount = "0" }, want: "positive decimal integer"},
		{name: "amount malformed", key: key, cap: big.NewInt(1000), mutate: func(o *blockrunSDK.PaymentOption) { o.Amount = "1.5" }, want: "positive decimal integer"},
		{name: "amount over cap", key: key, cap: big.NewInt(1), want: "exceeds per-call cap"},
		{name: "timeout zero", key: key, cap: big.NewInt(1000), mutate: func(o *blockrunSDK.PaymentOption) { o.MaxTimeoutSeconds = 0 }, want: "authorization window"},
		{name: "timeout over cap", key: key, cap: big.NewInt(1000), mutate: func(o *blockrunSDK.PaymentOption) { o.MaxTimeoutSeconds = 301 }, want: "authorization window"},
		{name: "invalid payTo", key: key, cap: big.NewInt(1000), mutate: func(o *blockrunSDK.PaymentOption) { o.PayTo = "invalid" }, want: "valid Solana public key"},
		{name: "missing fee payer", key: key, cap: big.NewInt(1000), mutate: func(o *blockrunSDK.PaymentOption) { delete(o.Extra, "feePayer") }, want: "feePayer"},
		{name: "invalid fee payer", key: key, cap: big.NewInt(1000), mutate: func(o *blockrunSDK.PaymentOption) { o.Extra["feePayer"] = "invalid" }, want: "feePayer"},
		{name: "invalid wallet key", key: "not-base58!", cap: big.NewInt(1000), want: "wallet key is invalid"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			option := valid
			option.Extra = cloneAnyMap(valid.Extra)
			if tt.mutate != nil {
				tt.mutate(&option)
			}
			resp := solanaPaymentRequiredResponse(t, []blockrunSDK.PaymentOption{option})
			_, err := SignSolanaX402Payment(resp, tt.key, "https://fallback.invalid", tt.cap)
			if err == nil || !strings.Contains(err.Error(), tt.want) {
				t.Fatalf("error = %v, want substring %q", err, tt.want)
			}
		})
	}
}

func validSolanaOption(feePayer, payTo, recentBlockhash string) blockrunSDK.PaymentOption {
	return blockrunSDK.PaymentOption{
		Scheme:            "exact",
		Network:           expectedNetworkSolana,
		Amount:            "2",
		Asset:             blockrunSDK.USDCSolanaMainnet,
		PayTo:             payTo,
		MaxTimeoutSeconds: 300,
		Extra: map[string]any{
			"feePayer":        feePayer,
			"recentBlockhash": recentBlockhash,
		},
	}
}

func solanaPaymentRequiredResponse(t *testing.T, accepts []blockrunSDK.PaymentOption) *http.Response {
	t.Helper()
	requirement := blockrunSDK.PaymentRequirement{
		X402Version: 2,
		Accepts:     accepts,
		Resource: blockrunSDK.ResourceInfo{
			URL:         "https://sol.blockrun.ai/api/v1/chat/completions",
			Description: "test",
		},
		Extensions: map[string]any{"test": true},
	}
	encodedJSON, err := common.Marshal(requirement)
	if err != nil {
		t.Fatal(err)
	}
	resp := &http.Response{Header: make(http.Header)}
	resp.Header.Set(headerPaymentRequired, base64.StdEncoding.EncodeToString(encodedJSON))
	return resp
}

func solanaTestKeys() (privateKey, feePayer, payTo, recentBlockhash string) {
	wallet := ed25519.NewKeyFromSeed(bytes.Repeat([]byte{1}, ed25519.SeedSize))
	feePayerKey := ed25519.NewKeyFromSeed(bytes.Repeat([]byte{2}, ed25519.SeedSize))
	payToKey := ed25519.NewKeyFromSeed(bytes.Repeat([]byte{3}, ed25519.SeedSize))
	hash := bytes.Repeat([]byte{4}, 32)
	return base58.Encode(wallet), base58.Encode(feePayerKey.Public().(ed25519.PublicKey)), base58.Encode(payToKey.Public().(ed25519.PublicKey)), base58.Encode(hash)
}

func withSolanaOption(option blockrunSDK.PaymentOption, mutate func(*blockrunSDK.PaymentOption)) blockrunSDK.PaymentOption {
	option.Extra = cloneAnyMap(option.Extra)
	mutate(&option)
	return option
}

func cloneAnyMap(input map[string]any) map[string]any {
	cloned := make(map[string]any, len(input))
	for key, value := range input {
		cloned[key] = value
	}
	return cloned
}
