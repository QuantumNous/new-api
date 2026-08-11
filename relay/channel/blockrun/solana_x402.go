package blockrun

import (
	"fmt"
	"math/big"
	"net/http"
	"reflect"

	blockrunSDK "github.com/BlockRunAI/blockrun-llm-go"
	"github.com/gagliardetto/solana-go"
)

const expectedNetworkSolana = "solana"

// SignSolanaX402Payment signs only an unambiguous exact-scheme Solana USDC
// option. It is intentionally separate from the shared Base signer so existing
// Type 100 Base and Type 102 callers cannot enter the Solana payment path.
func SignSolanaX402Payment(resp *http.Response, privateKey, resourceURLFallback string, maxAmountAtomic *big.Int) (string, error) {
	payReq, err := extractPaymentRequired(resp)
	if err != nil {
		return "", err
	}
	opt, err := selectSolanaPaymentOption(payReq.Accepts)
	if err != nil {
		return "", err
	}
	if err := validateSolanaPaymentOption(opt, maxAmountAtomic); err != nil {
		return "", err
	}
	if _, err := blockrunSDK.GetSolanaPublicKey(privateKey); err != nil {
		return "", fmt.Errorf("blockrun: Solana wallet key is invalid")
	}

	resourceURL := payReq.Resource.URL
	if resourceURL == "" {
		resourceURL = resourceURLFallback
	}
	paymentB64, err := blockrunSDK.CreateSolanaPaymentPayload(
		privateKey,
		opt,
		resourceURL,
		payReq.Resource.Description,
		payReq.Extensions,
		blockrunSDK.DefaultSolanaRPCURL,
	)
	if err != nil {
		return "", fmt.Errorf("blockrun: build Solana x402 payload: %w", err)
	}
	return paymentB64, nil
}

func selectSolanaPaymentOption(accepts []blockrunSDK.PaymentOption) (*blockrunSDK.PaymentOption, error) {
	var selected *blockrunSDK.PaymentOption
	for i := range accepts {
		candidate := &accepts[i]
		if candidate.Scheme != "exact" || candidate.Network != expectedNetworkSolana || candidate.Asset != blockrunSDK.USDCSolanaMainnet {
			continue
		}
		if selected == nil {
			selected = candidate
			continue
		}
		if !reflect.DeepEqual(*selected, *candidate) {
			return nil, fmt.Errorf("blockrun: ambiguous Solana payment options")
		}
	}
	if selected == nil {
		return nil, fmt.Errorf("blockrun: no exact Solana USDC payment option")
	}
	return selected, nil
}

func validateSolanaPaymentOption(opt *blockrunSDK.PaymentOption, maxAmountAtomic *big.Int) error {
	if opt.MaxTimeoutSeconds <= 0 || opt.MaxTimeoutSeconds > maxAuthorizationWindowSeconds {
		return fmt.Errorf("blockrun: refusing %ds Solana authorization window (cap %ds)", opt.MaxTimeoutSeconds, maxAuthorizationWindowSeconds)
	}
	if maxAmountAtomic == nil || maxAmountAtomic.Sign() <= 0 {
		return fmt.Errorf("blockrun: Solana per-call payment cap must be configured as a positive integer")
	}
	if err := assertAmountWithinCap(opt.Amount, maxAmountAtomic); err != nil {
		return err
	}
	if _, err := solana.PublicKeyFromBase58(opt.PayTo); err != nil {
		return fmt.Errorf("blockrun: payTo %q is not a valid Solana public key", opt.PayTo)
	}
	feePayer, _ := opt.Extra["feePayer"].(string)
	if _, err := solana.PublicKeyFromBase58(feePayer); err != nil {
		return fmt.Errorf("blockrun: feePayer is not a valid Solana public key")
	}
	return nil
}
