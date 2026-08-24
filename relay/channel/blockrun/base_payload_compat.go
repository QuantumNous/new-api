package blockrun

import (
	"crypto/ecdsa"
	"encoding/base64"
	"fmt"

	blockrunSDK "github.com/BlockRunAI/blockrun-llm-go"
	"github.com/QuantumNous/new-api/common"
)

// CreateBasePaymentPayloadCompat delegates all signing to the BlockRun SDK,
// then restores the caller-supplied extensions. SDK v0.19.5 adds an unsigned
// builder-code extension; removing only that SDK-added envelope field preserves
// the Base wire semantics used by existing Type 100 and Type 102 channels.
func CreateBasePaymentPayloadCompat(
	privateKey *ecdsa.PrivateKey,
	recipient string,
	amount string,
	network string,
	resourceURL string,
	resourceDescription string,
	maxTimeoutSeconds int,
	extra map[string]any,
	extensions map[string]any,
) (string, error) {
	paymentB64, err := blockrunSDK.CreatePaymentPayload(
		privateKey,
		recipient,
		amount,
		network,
		resourceURL,
		resourceDescription,
		maxTimeoutSeconds,
		extra,
		extensions,
	)
	if err != nil {
		return "", err
	}

	paymentJSON, err := base64.StdEncoding.DecodeString(paymentB64)
	if err != nil {
		return "", fmt.Errorf("blockrun: decode Base x402 payload: %w", err)
	}
	var payload blockrunSDK.PaymentPayload
	if err := common.Unmarshal(paymentJSON, &payload); err != nil {
		return "", fmt.Errorf("blockrun: parse Base x402 payload: %w", err)
	}
	payload.Extensions = extensions
	paymentJSON, err = common.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("blockrun: encode Base x402 payload: %w", err)
	}
	return base64.StdEncoding.EncodeToString(paymentJSON), nil
}
