package blockrun

import (
	"math/big"
	"strings"
	"testing"

	blockrunSDK "github.com/BlockRunAI/blockrun-llm-go"
)

// validOption returns a payment option that should pass all checks; tests then
// mutate one field at a time to exercise each rejection branch.
func validOption() blockrunSDK.PaymentOption {
	return blockrunSDK.PaymentOption{
		Scheme:            "exact",
		Network:           "eip155:8453",
		Amount:            "21615", // ~$0.022 USDC
		Asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
		PayTo:             "0xe9030014F5DAe217d0A152f02A043567b16c1aBf",
		MaxTimeoutSeconds: 300,
		Extra:             map[string]any{"name": "USD Coin", "version": "2"},
	}
}

func TestValidatePaymentOption_Accepts_Baseline(t *testing.T) {
	opt := validOption()
	if err := validatePaymentOption(&opt); err != nil {
		t.Fatalf("baseline option rejected: %v", err)
	}
}

func TestValidatePaymentOption_Accepts_BaseSepolia(t *testing.T) {
	opt := validOption()
	opt.Network = "eip155:84532"
	if err := validatePaymentOption(&opt); err != nil {
		t.Fatalf("base-sepolia network rejected: %v", err)
	}
}

func TestValidatePaymentOption_Accepts_ChecksummedAsset(t *testing.T) {
	opt := validOption()
	opt.Asset = "0x833589FCD6EDB6E08F4C7C32D4F71B54BDA02913" // upper case still equal-fold
	if err := validatePaymentOption(&opt); err != nil {
		t.Fatalf("upper-case asset rejected: %v", err)
	}
}

func TestValidatePaymentOption_Accepts_LowercaseAsset(t *testing.T) {
	opt := validOption()
	opt.Asset = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
	if err := validatePaymentOption(&opt); err != nil {
		t.Fatalf("lower-case asset rejected: %v", err)
	}
}

func TestValidatePaymentOption_Rejects(t *testing.T) {
	cases := []struct {
		name    string
		mutate  func(*blockrunSDK.PaymentOption)
		wantSub string
	}{
		{"timeout zero", func(o *blockrunSDK.PaymentOption) { o.MaxTimeoutSeconds = 0 }, "authorization window"},
		{"timeout negative", func(o *blockrunSDK.PaymentOption) { o.MaxTimeoutSeconds = -1 }, "authorization window"},
		{"timeout over cap (one year)", func(o *blockrunSDK.PaymentOption) { o.MaxTimeoutSeconds = 31536000 }, "authorization window"},
		{"timeout just over cap (301)", func(o *blockrunSDK.PaymentOption) { o.MaxTimeoutSeconds = 301 }, "authorization window"},
		{"network mainnet ethereum", func(o *blockrunSDK.PaymentOption) { o.Network = "eip155:1" }, "unexpected network"},
		{"network upper case", func(o *blockrunSDK.PaymentOption) { o.Network = "EIP155:8453" }, "unexpected network"},
		{"network with trailing whitespace", func(o *blockrunSDK.PaymentOption) { o.Network = "eip155:8453 " }, "unexpected network"},
		{"network with zero-width space", func(o *blockrunSDK.PaymentOption) { o.Network = "eip155:8453​" }, "unexpected network"},
		{"network empty", func(o *blockrunSDK.PaymentOption) { o.Network = "" }, "unexpected network"},
		{"asset other erc20", func(o *blockrunSDK.PaymentOption) { o.Asset = "0xdAC17F958D2ee523a2206206994597C13D831ec7" }, "unexpected asset"},
		{"asset with leading space", func(o *blockrunSDK.PaymentOption) { o.Asset = " 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" }, "unexpected asset"},
		{"asset with trailing null", func(o *blockrunSDK.PaymentOption) { o.Asset = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913\x00" }, "unexpected asset"},
		{"asset empty", func(o *blockrunSDK.PaymentOption) { o.Asset = "" }, "unexpected asset"},
		{"payTo missing 0x", func(o *blockrunSDK.PaymentOption) { o.PayTo = "e9030014F5DAe217d0A152f02A043567b16c1aBf" }, "valid ethereum address"},
		{"payTo too short", func(o *blockrunSDK.PaymentOption) { o.PayTo = "0xe903" }, "valid ethereum address"},
		{"payTo non-hex", func(o *blockrunSDK.PaymentOption) { o.PayTo = "0xZZZZ0014F5DAe217d0A152f02A043567b16c1aBf" }, "valid ethereum address"},
		{"payTo with trailing space", func(o *blockrunSDK.PaymentOption) { o.PayTo = "0xe9030014F5DAe217d0A152f02A043567b16c1aBf " }, "valid ethereum address"},
		{"amount zero", func(o *blockrunSDK.PaymentOption) { o.Amount = "0" }, "positive decimal integer"},
		{"amount negative", func(o *blockrunSDK.PaymentOption) { o.Amount = "-1000" }, "positive decimal integer"},
		{"amount empty", func(o *blockrunSDK.PaymentOption) { o.Amount = "" }, "amount is empty"},
		{"amount scientific notation", func(o *blockrunSDK.PaymentOption) { o.Amount = "1e6" }, "positive decimal integer"},
		{"amount hex", func(o *blockrunSDK.PaymentOption) { o.Amount = "0xF4240" }, "positive decimal integer"},
		{"amount trailing space", func(o *blockrunSDK.PaymentOption) { o.Amount = "1000 " }, "positive decimal integer"},
		{"amount over cap by one", func(o *blockrunSDK.PaymentOption) { o.Amount = "1000001" }, "exceeds per-call cap"},
		{"amount one year drain", func(o *blockrunSDK.PaymentOption) { o.Amount = "999999999999" }, "exceeds per-call cap"},
		// "+1000000" is numerically equivalent to "1000000" and at the cap, so big.Int parses + sign and it passes — covered by the
		// "accepts" tests above implicitly. Document here so future readers don't try to "fix" it by rejecting +.
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			opt := validOption()
			tc.mutate(&opt)
			err := validatePaymentOption(&opt)
			if err == nil {
				t.Fatalf("expected rejection, got nil")
			}
			if !strings.Contains(err.Error(), tc.wantSub) {
				t.Fatalf("error %q did not contain %q", err.Error(), tc.wantSub)
			}
		})
	}
}

func TestValidatePaymentOption_AtCapBoundary(t *testing.T) {
	opt := validOption()
	opt.Amount = "1000000" // exactly the cap → must be accepted (Cmp > 0 only)
	if err := validatePaymentOption(&opt); err != nil {
		t.Fatalf("amount at cap rejected: %v", err)
	}
}

func TestValidatePaymentOption_AtTimeoutBoundary(t *testing.T) {
	opt := validOption()
	opt.MaxTimeoutSeconds = 300 // exactly the cap → must be accepted
	if err := validatePaymentOption(&opt); err != nil {
		t.Fatalf("timeout at cap rejected: %v", err)
	}
}

func TestValidatePaymentOptionWithCap_AllowsAboveOneUSDC(t *testing.T) {
	opt := &blockrunSDK.PaymentOption{
		Network:           expectedNetworkBase,
		Asset:             expectedAssetUSDCBase,
		PayTo:             "0x000000000000000000000000000000000000dEaD",
		Amount:            "3000000", // 3 USDC
		MaxTimeoutSeconds: 60,
	}
	// 默认 $1 上限必须拒绝
	if err := validatePaymentOptionWithCap(opt, maxAmountAtomicUSDC); err == nil {
		t.Fatal("expected 3 USDC to be rejected under 1 USDC cap")
	}
	// $10 上限必须放行
	if err := validatePaymentOptionWithCap(opt, big.NewInt(10_000_000)); err != nil {
		t.Fatalf("expected 3 USDC allowed under 10 USDC cap, got %v", err)
	}
}

// TestValidatePaymentOptionWithCaps_ImageWindow asserts the synchronous image
// path can accept BlockRun's longer 600s authorization window via a raised
// per-call window cap, while the default chat cap (300s) still rejects it and
// anything beyond the image cap is still refused.
func TestValidatePaymentOptionWithCaps_ImageWindow(t *testing.T) {
	opt := validOption()
	opt.MaxTimeoutSeconds = 600 // BlockRun's image endpoint window

	// Default 300s cap (chat) must still reject it.
	if err := validatePaymentOption(&opt); err == nil {
		t.Fatal("expected 600s window rejected under default 300s cap")
	}

	// Image cap (900s) must allow it.
	if err := validatePaymentOptionWithCaps(&opt, maxAmountAtomicUSDC, maxImageAuthorizationWindowSeconds); err != nil {
		t.Fatalf("expected 600s window allowed under image cap, got %v", err)
	}

	// Beyond the image cap is still refused (no unbounded widening).
	opt.MaxTimeoutSeconds = maxImageAuthorizationWindowSeconds + 1
	if err := validatePaymentOptionWithCaps(&opt, maxAmountAtomicUSDC, maxImageAuthorizationWindowSeconds); err == nil {
		t.Fatalf("expected %ds window rejected under %ds image cap", maxImageAuthorizationWindowSeconds+1, maxImageAuthorizationWindowSeconds)
	}

	// The image window cap must cover BlockRun's observed 600s.
	if maxImageAuthorizationWindowSeconds < 600 {
		t.Fatalf("image window cap %ds is below BlockRun's 600s window", maxImageAuthorizationWindowSeconds)
	}
}

func TestLooksLikeEthAddress(t *testing.T) {
	good := []string{
		"0x0000000000000000000000000000000000000000",
		"0xe9030014F5DAe217d0A152f02A043567b16c1aBf",
		"0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
	}
	bad := []string{
		"",
		"0x",
		"0xshort",
		"e9030014F5DAe217d0A152f02A043567b16c1aBf",    // no 0x
		"0xe9030014F5DAe217d0A152f02A043567b16c1aBf0", // 41 chars after 0x
		"0xZZ030014F5DAe217d0A152f02A043567b16c1aBf",  // non-hex
		"0xe9030014F5DAe217d0A152f02A043567b16c1aBf ", // trailing space
	}
	for _, a := range good {
		if !looksLikeEthAddress(a) {
			t.Errorf("rejected valid address %q", a)
		}
	}
	for _, a := range bad {
		if looksLikeEthAddress(a) {
			t.Errorf("accepted invalid address %q", a)
		}
	}
}

func TestParsePrivateKey(t *testing.T) {
	t.Run("accepts 0x-prefixed 64-hex", func(t *testing.T) {
		_, err := parsePrivateKey("0x" + strings.Repeat("a", 64))
		if err != nil {
			t.Fatalf("rejected valid key: %v", err)
		}
	})
	t.Run("accepts unprefixed 64-hex", func(t *testing.T) {
		_, err := parsePrivateKey(strings.Repeat("a", 64))
		if err != nil {
			t.Fatalf("rejected unprefixed key: %v", err)
		}
	})
	t.Run("strips surrounding whitespace", func(t *testing.T) {
		_, err := parsePrivateKey("  0x" + strings.Repeat("a", 64) + "  ")
		if err != nil {
			t.Fatalf("rejected key with whitespace: %v", err)
		}
	})
	t.Run("rejects wrong length", func(t *testing.T) {
		_, err := parsePrivateKey("0xabc")
		if err == nil || !strings.Contains(err.Error(), "64 hex chars") {
			t.Fatalf("expected length error, got %v", err)
		}
	})
	t.Run("rejects non-hex with fixed message and no key content", func(t *testing.T) {
		secret := "ZZ" + strings.Repeat("a", 62)
		_, err := parsePrivateKey(secret)
		if err == nil {
			t.Fatal("expected error on non-hex input")
		}
		// Critical: error message MUST NOT include any substring of the input
		// (which in production would be a private key).
		if strings.Contains(err.Error(), secret) {
			t.Fatalf("error leaked input key material: %q", err.Error())
		}
		if !strings.Contains(err.Error(), "not valid secp256k1 hex") {
			t.Fatalf("unexpected error message: %q", err.Error())
		}
	})
}
