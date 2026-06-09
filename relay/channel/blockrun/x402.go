package blockrun

import (
	"bytes"
	"crypto/ecdsa"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"

	blockrunSDK "github.com/BlockRunAI/blockrun-llm-go"
	ethcrypto "github.com/ethereum/go-ethereum/crypto"
)

// x402 v2 HTTP transport header names. HTTP headers are case-insensitive but
// BlockRun emits multiple compatibility variants — we probe canonical first.
const (
	headerPaymentRequired     = "Payment-Required"
	headerXPaymentRequired    = "X-Payment-Required"
	headerWWWAuthenticate     = "Www-Authenticate"
	headerPaymentSignature    = "Payment-Signature"
	wwwAuthenticateX402Prefix = "X402 requirements="
)

// Trust-boundary guard rails for what we are willing to sign. The 402 response
// is produced by the same party we are paying — if BlockRun is compromised, or
// a MITM injects a forged 402, an attacker could otherwise request an absurdly
// long-lived authorization for an arbitrary `payTo` and drain the wallet on
// chain. We refuse to sign anything outside these bounds.
const (
	// maxAuthorizationWindowSeconds caps the validBefore window. ERC-3009
	// authorizations can be settled any time before validBefore, so a long
	// window equals a long-term standing transfer order. 5 minutes is enough
	// for one HTTP retry plus generous clock skew on the fast (chat) path.
	maxAuthorizationWindowSeconds = 300

	// maxImageAuthorizationWindowSeconds is the raised window cap for the
	// SYNCHRONOUS image endpoints (/v1/images/generations, /v1/images/image2image).
	// BlockRun keeps the request open while it generates and advertises a longer
	// validBefore (observed 600s) to cover generation time, so the 300s chat cap
	// would reject every image 402. 15 minutes covers the observed window with
	// margin. The extra exposure is bounded: an ERC-3009 authorization is
	// single-use (nonce) and the amount is still capped at maxAmountAtomicUSDC,
	// so a longer window cannot be replayed for repeated drains.
	maxImageAuthorizationWindowSeconds = 900

	// USDC asset on Base mainnet (the only token/chain BlockRun uses today).
	// CAIP-2 networks BlockRun advertises: eip155:8453 (Base) / eip155:84532
	// (Base Sepolia). If they ever add a new network, expand the allowlist here
	// (security-sensitive — do not auto-widen).
	expectedAssetUSDCBase     = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
	expectedNetworkBase       = "eip155:8453"
	expectedNetworkBaseSepoli = "eip155:84532"
)

// maxAmountAtomicUSDC caps the per-call charge to 1 USDC (6 decimals).
// Any single Chat Completions call charging >$1 indicates a bug or an
// attempt at fund extraction — refuse to sign. Tune if you legitimately
// run high-cost models per call. Stored as a *big.Int constructed once at
// package init so we never have to handle a parse failure at request time.
var maxAmountAtomicUSDC = big.NewInt(1_000_000)

// SignX402Payment parses the 402 response's payment requirements, validates
// the upstream-supplied parameters against this gateway's trust policy, signs
// an EIP-712 / ERC-3009 TransferWithAuthorization with privateKeyHex, and
// returns the base64 value to place in the PAYMENT-SIGNATURE header.
// resourceURLFallback is used only if the 402 payload does not echo a URL.
//
// Exported so the (separate) BlockRun video channel session can reuse the exact
// same trust-boundary validation + signing path without duplicating it.
func SignX402Payment(resp *http.Response, privateKeyHex, resourceURLFallback string) (string, error) {
	return SignX402PaymentWithCaps(resp, privateKeyHex, resourceURLFallback, maxAmountAtomicUSDC, maxAuthorizationWindowSeconds)
}

// SignX402PaymentWithLimits is SignX402Payment with a caller-supplied per-call
// USDC cap (atomic units, 6 decimals). Video calls legitimately exceed the $1
// chat cap, so the video channel passes a higher ceiling here while reusing the
// exact same network/asset/window/payTo trust-boundary checks (default window).
func SignX402PaymentWithLimits(resp *http.Response, privateKeyHex, resourceURLFallback string, maxAmountAtomic *big.Int) (string, error) {
	return SignX402PaymentWithCaps(resp, privateKeyHex, resourceURLFallback, maxAmountAtomic, maxAuthorizationWindowSeconds)
}

// SignX402PaymentWithCaps is the single implementation behind SignX402Payment and
// its variants: it parses the 402, validates the upstream-supplied parameters
// against caller-supplied per-call amount and authorization-window caps, signs an
// EIP-712 / ERC-3009 TransferWithAuthorization, and returns the base64
// PAYMENT-SIGNATURE value. The synchronous image path passes a higher window cap
// (maxImageAuthorizationWindowSeconds) because BlockRun holds the request open
// while generating; chat/video keep the default 300s window.
func SignX402PaymentWithCaps(resp *http.Response, privateKeyHex, resourceURLFallback string, maxAmountAtomic *big.Int, maxWindowSeconds int) (string, error) {
	payReq, err := extractPaymentRequired(resp)
	if err != nil {
		return "", err
	}
	if len(payReq.Accepts) == 0 {
		return "", fmt.Errorf("blockrun: 402 response has no payment options")
	}
	opt := payReq.Accepts[0]
	if err := validatePaymentOptionWithCaps(&opt, maxAmountAtomic, maxWindowSeconds); err != nil {
		return "", err
	}
	privKey, err := parsePrivateKey(privateKeyHex)
	if err != nil {
		return "", err
	}
	resourceURL := payReq.Resource.URL
	if resourceURL == "" {
		resourceURL = resourceURLFallback
	}
	paymentB64, err := blockrunSDK.CreatePaymentPayload(
		privKey, opt.PayTo, opt.Amount, opt.Network, resourceURL,
		payReq.Resource.Description, opt.MaxTimeoutSeconds, opt.Extra, payReq.Extensions,
	)
	if err != nil {
		return "", fmt.Errorf("blockrun: build x402 payload: %w", err)
	}
	return paymentB64, nil
}

// validatePaymentOption rejects any 402 advertisement outside our trust policy
// using the default $1 chat cap. Centralised here so the rules are easy to audit
// and bypass-impossible.
func validatePaymentOption(opt *blockrunSDK.PaymentOption) error {
	return validatePaymentOptionWithCap(opt, maxAmountAtomicUSDC)
}

// validatePaymentOptionWithCap runs the same trust-boundary checks as
// validatePaymentOption but against a caller-supplied amount cap, so higher-value
// flows (e.g. video) can raise only the amount ceiling without weakening any of
// the network/asset/window/payTo guard rails.
func validatePaymentOptionWithCap(opt *blockrunSDK.PaymentOption, maxAmountAtomic *big.Int) error {
	return validatePaymentOptionWithCaps(opt, maxAmountAtomic, maxAuthorizationWindowSeconds)
}

// validatePaymentOptionWithCaps is validatePaymentOptionWithCap with a
// caller-supplied authorization-window cap too, so the synchronous image path can
// accept BlockRun's longer window without weakening the chat/video bound.
func validatePaymentOptionWithCaps(opt *blockrunSDK.PaymentOption, maxAmountAtomic *big.Int, maxWindowSeconds int) error {
	if opt.MaxTimeoutSeconds <= 0 || opt.MaxTimeoutSeconds > maxWindowSeconds {
		return fmt.Errorf("blockrun: refusing %ds authorization window (cap %ds) — possible upstream tampering",
			opt.MaxTimeoutSeconds, maxWindowSeconds)
	}
	if opt.Network != expectedNetworkBase && opt.Network != expectedNetworkBaseSepoli {
		return fmt.Errorf("blockrun: unexpected network %q (allowed: %s, %s)", opt.Network, expectedNetworkBase, expectedNetworkBaseSepoli)
	}
	if !strings.EqualFold(opt.Asset, expectedAssetUSDCBase) {
		return fmt.Errorf("blockrun: unexpected asset %q (only Base USDC %s allowed)", opt.Asset, expectedAssetUSDCBase)
	}
	if !looksLikeEthAddress(opt.PayTo) {
		return fmt.Errorf("blockrun: payTo %q is not a valid ethereum address", opt.PayTo)
	}
	return assertAmountWithinCap(opt.Amount, maxAmountAtomic)
}

func looksLikeEthAddress(addr string) bool {
	if !strings.HasPrefix(addr, "0x") || len(addr) != 42 {
		return false
	}
	for _, r := range addr[2:] {
		isHex := (r >= '0' && r <= '9') || (r >= 'a' && r <= 'f') || (r >= 'A' && r <= 'F')
		if !isHex {
			return false
		}
	}
	return true
}

// assertAmountWithinCap parses a decimal atomic-units string and rejects values
// exceeding cap (already a *big.Int). Decimal-string + arbitrary-precision so
// USDC's 6 decimals and any plausible future per-call cap work safely.
func assertAmountWithinCap(amount string, cap *big.Int) error {
	if amount == "" {
		return fmt.Errorf("blockrun: 402 amount is empty")
	}
	amt, ok := new(big.Int).SetString(amount, 10)
	if !ok || amt.Sign() <= 0 {
		return fmt.Errorf("blockrun: 402 amount %q is not a positive decimal integer", amount)
	}
	if amt.Cmp(cap) > 0 {
		return fmt.Errorf("blockrun: 402 amount %s exceeds per-call cap %s atomic units — refusing to sign", amount, cap.String())
	}
	return nil
}

// extractPaymentRequired reads payment requirements from any of the three
// header variants BlockRun emits. We prefer the canonical x402 v2 header
// (Payment-Required) over the legacy X- alias to stay forward-compatible.
func extractPaymentRequired(resp *http.Response) (*blockrunSDK.PaymentRequirement, error) {
	candidates := []string{
		resp.Header.Get(headerPaymentRequired),
		resp.Header.Get(headerXPaymentRequired),
	}
	if wwwAuth := resp.Header.Get(headerWWWAuthenticate); strings.HasPrefix(wwwAuth, wwwAuthenticateX402Prefix) {
		v := strings.TrimPrefix(wwwAuth, wwwAuthenticateX402Prefix)
		v = strings.Trim(v, `"`)
		candidates = append(candidates, v)
	}
	for _, c := range candidates {
		if c != "" {
			return blockrunSDK.ParsePaymentRequired(c)
		}
	}
	return nil, fmt.Errorf("blockrun: no payment-required header in 402 response")
}

// parsePrivateKey validates the wallet key has the expected 32-byte secp256k1
// shape before handing it to go-ethereum, which would otherwise emit terse
// errors. We never include the key (or any substring of it) in returned errors.
func parsePrivateKey(hexStr string) (*ecdsa.PrivateKey, error) {
	clean := strings.TrimPrefix(strings.TrimSpace(hexStr), "0x")
	if len(clean) != 64 {
		return nil, fmt.Errorf("blockrun: wallet private key must be 64 hex chars (got %d)", len(clean))
	}
	key, err := ethcrypto.HexToECDSA(clean)
	if err != nil {
		return nil, fmt.Errorf("blockrun: wallet private key is not valid secp256k1 hex")
	}
	return key, nil
}

// bodyReader returns a fresh io.Reader over the cached body bytes; nil if empty.
func bodyReader(b []byte) io.Reader {
	if len(b) == 0 {
		return nil
	}
	return bytes.NewReader(b)
}

// cacheRequestBody fully reads r into a byte slice. Used to snapshot the
// request body before the first attempt so we can replay it after signing.
func cacheRequestBody(r io.Reader) ([]byte, error) {
	if r == nil {
		return nil, nil
	}
	b, err := io.ReadAll(r)
	if err != nil {
		return nil, fmt.Errorf("blockrun: cache request body: %w", err)
	}
	return b, nil
}
