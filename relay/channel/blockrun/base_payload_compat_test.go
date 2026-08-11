package blockrun

import (
	"encoding/base64"
	"reflect"
	"testing"

	blockrunSDK "github.com/BlockRunAI/blockrun-llm-go"
	"github.com/QuantumNous/new-api/common"
	ethcrypto "github.com/ethereum/go-ethereum/crypto"
)

func TestCreateBasePaymentPayloadCompatPreservesExtensions(t *testing.T) {
	privateKey, err := ethcrypto.HexToECDSA("4f3edf983ac636a65a842ce7c78d9aa706d3b113bce036f4e9d7f86f79bf5b84")
	if err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name       string
		extensions map[string]any
	}{
		{name: "nil", extensions: nil},
		{name: "empty", extensions: map[string]any{}},
		{
			name: "existing builder code",
			extensions: map[string]any{
				"builder-code": map[string]any{"info": map[string]any{"a": []any{"application"}}},
			},
		},
		{
			name:       "arbitrary extension",
			extensions: map[string]any{"custom": map[string]any{"enabled": true, "label": "kept"}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			encoded, err := CreateBasePaymentPayloadCompat(
				privateKey,
				"0xe9030014F5DAe217d0A152f02A043567b16c1aBf",
				"1000",
				expectedNetworkBase,
				"https://blockrun.ai/api/v1/chat/completions",
				"test",
				300,
				map[string]any{"name": "USD Coin", "version": "2"},
				tt.extensions,
			)
			if err != nil {
				t.Fatalf("CreateBasePaymentPayloadCompat: %v", err)
			}

			decoded, err := base64.StdEncoding.DecodeString(encoded)
			if err != nil {
				t.Fatalf("decode payload: %v", err)
			}
			var payload blockrunSDK.PaymentPayload
			if err := common.Unmarshal(decoded, &payload); err != nil {
				t.Fatalf("unmarshal payload: %v", err)
			}

			if len(tt.extensions) == 0 {
				if payload.Extensions != nil {
					t.Fatalf("empty extensions should retain v0.17 omitted-field semantics, got %#v", payload.Extensions)
				}
				return
			}
			if !reflect.DeepEqual(payload.Extensions, tt.extensions) {
				t.Fatalf("extensions changed:\n got: %#v\nwant: %#v", payload.Extensions, tt.extensions)
			}
		})
	}
}

func TestCreateBasePaymentPayloadCompatRemovesSDKBuilderCode(t *testing.T) {
	privateKey, err := ethcrypto.HexToECDSA("4f3edf983ac636a65a842ce7c78d9aa706d3b113bce036f4e9d7f86f79bf5b84")
	if err != nil {
		t.Fatal(err)
	}
	encoded, err := CreateBasePaymentPayloadCompat(
		privateKey,
		"0xe9030014F5DAe217d0A152f02A043567b16c1aBf",
		"1000",
		expectedNetworkBase,
		"https://blockrun.ai/api/v1/chat/completions",
		"test",
		300,
		nil,
		map[string]any{"trace": "original"},
	)
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		t.Fatal(err)
	}
	var payload blockrunSDK.PaymentPayload
	if err := common.Unmarshal(decoded, &payload); err != nil {
		t.Fatal(err)
	}
	if _, exists := payload.Extensions["builder-code"]; exists {
		t.Fatalf("SDK-added builder-code leaked into Base payload: %#v", payload.Extensions)
	}
}
