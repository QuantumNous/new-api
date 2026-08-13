package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

const validSolanaSeed = "11111111111111111111111111111111"

func blockRunChannelForValidation(t *testing.T, channelType int, chain dto.BlockRunPaymentChain, baseURL, key, cap string) *model.Channel {
	t.Helper()
	settings, err := common.Marshal(dto.ChannelOtherSettings{
		BlockRunPaymentChain:     chain,
		BlockRunMaxPaymentAtomic: cap,
	})
	require.NoError(t, err)
	return &model.Channel{
		Type:          channelType,
		Key:           key,
		BaseURL:       common.GetPointer(baseURL),
		OtherSettings: string(settings),
	}
}

func TestValidateChannelBlockRunPaymentSettings(t *testing.T) {
	t.Run("missing chain keeps Base behavior", func(t *testing.T) {
		channel := blockRunChannelForValidation(t, constant.ChannelTypeBlockRun, "", "", "base-key-is-not-validated", "")
		require.NoError(t, validateChannel(channel, true))
	})

	t.Run("explicit Base ignores Solana-only fields", func(t *testing.T) {
		channel := blockRunChannelForValidation(t, constant.ChannelTypeBlockRun, dto.BlockRunPaymentChainBase, "https://custom-base.example", "base-key", "not-a-number")
		require.NoError(t, validateChannel(channel, true))
	})

	t.Run("Solana accepts the official URL with an optional trailing slash", func(t *testing.T) {
		for _, baseURL := range []string{blockRunSolanaBaseURL, blockRunSolanaBaseURL + "/"} {
			channel := blockRunChannelForValidation(t, constant.ChannelTypeBlockRun, dto.BlockRunPaymentChainSolana, baseURL, validSolanaSeed, "1000000")
			require.NoError(t, validateChannel(channel, true))
		}
	})

	t.Run("Solana requires the exact official URL", func(t *testing.T) {
		for _, baseURL := range []string{"", "https://blockrun.ai/api", blockRunSolanaBaseURL + "/v1"} {
			channel := blockRunChannelForValidation(t, constant.ChannelTypeBlockRun, dto.BlockRunPaymentChainSolana, baseURL, validSolanaSeed, "1000000")
			require.ErrorContains(t, validateChannel(channel, true), "base_url")
		}
	})

	t.Run("Solana requires a parseable wallet key", func(t *testing.T) {
		channel := blockRunChannelForValidation(t, constant.ChannelTypeBlockRun, dto.BlockRunPaymentChainSolana, blockRunSolanaBaseURL, "not-base58", "1000000")
		require.ErrorContains(t, validateChannel(channel, true), "key is invalid")
	})

	t.Run("Solana cap must be a positive decimal string", func(t *testing.T) {
		for _, cap := range []string{"", "0", "-1", "+1", "1.5", " 1"} {
			channel := blockRunChannelForValidation(t, constant.ChannelTypeBlockRun, dto.BlockRunPaymentChainSolana, blockRunSolanaBaseURL, validSolanaSeed, cap)
			require.ErrorContains(t, validateChannel(channel, true), "blockrun_max_payment_atomic")
		}
		channel := blockRunChannelForValidation(t, constant.ChannelTypeBlockRun, dto.BlockRunPaymentChainSolana, blockRunSolanaBaseURL, validSolanaSeed, "18446744073709551616")
		require.NoError(t, validateChannel(channel, true))
	})

	t.Run("unknown payment chain fails closed", func(t *testing.T) {
		channel := blockRunChannelForValidation(t, constant.ChannelTypeBlockRun, dto.BlockRunPaymentChain("polygon"), "", "", "")
		require.ErrorContains(t, validateChannel(channel, true), "unsupported BlockRun payment chain")
	})

	t.Run("BlockRun 101 and 102 are unaffected", func(t *testing.T) {
		for _, channelType := range []int{constant.ChannelTypeBlockRunVideo, constant.ChannelTypeBlockRunSeedance} {
			channel := blockRunChannelForValidation(t, channelType, dto.BlockRunPaymentChainSolana, "https://unrelated.example", "not-a-solana-key", "0")
			require.NoError(t, validateChannel(channel, true))
		}
	})
}

func TestValidateBlockRunPaymentChainTransition(t *testing.T) {
	t.Run("rejects Base to Solana", func(t *testing.T) {
		origin := blockRunChannelForValidation(t, constant.ChannelTypeBlockRun, "", "", "base-key", "")
		updated := blockRunChannelForValidation(t, constant.ChannelTypeBlockRun, dto.BlockRunPaymentChainSolana, blockRunSolanaBaseURL, validSolanaSeed, "1000000")
		require.ErrorContains(t, validateBlockRunPaymentChainTransition(origin, updated), "cannot change from base to solana")
	})

	t.Run("rejects Solana to Base", func(t *testing.T) {
		origin := blockRunChannelForValidation(t, constant.ChannelTypeBlockRun, dto.BlockRunPaymentChainSolana, blockRunSolanaBaseURL, validSolanaSeed, "1000000")
		updated := blockRunChannelForValidation(t, constant.ChannelTypeBlockRun, "", "", "base-key", "")
		require.ErrorContains(t, validateBlockRunPaymentChainTransition(origin, updated), "cannot change from solana to base")
	})

	t.Run("allows same effective chain updates", func(t *testing.T) {
		baseOrigin := blockRunChannelForValidation(t, constant.ChannelTypeBlockRun, "", "", "old-base-key", "")
		baseUpdated := blockRunChannelForValidation(t, constant.ChannelTypeBlockRun, dto.BlockRunPaymentChainBase, "https://custom-base.example", "new-base-key", "")
		require.NoError(t, validateBlockRunPaymentChainTransition(baseOrigin, baseUpdated))

		solanaOrigin := blockRunChannelForValidation(t, constant.ChannelTypeBlockRun, dto.BlockRunPaymentChainSolana, blockRunSolanaBaseURL, validSolanaSeed, "1000000")
		solanaUpdated := blockRunChannelForValidation(t, constant.ChannelTypeBlockRun, dto.BlockRunPaymentChainSolana, blockRunSolanaBaseURL+"/", validSolanaSeed, "2000000")
		require.NoError(t, validateBlockRunPaymentChainTransition(solanaOrigin, solanaUpdated))
	})

	t.Run("does not affect BlockRun video channel types", func(t *testing.T) {
		for _, channelType := range []int{constant.ChannelTypeBlockRunVideo, constant.ChannelTypeBlockRunSeedance} {
			origin := blockRunChannelForValidation(t, channelType, dto.BlockRunPaymentChainBase, "", "", "")
			updatedType := constant.ChannelTypeBlockRunVideo
			if channelType == constant.ChannelTypeBlockRunVideo {
				updatedType = constant.ChannelTypeBlockRunSeedance
			}
			updated := blockRunChannelForValidation(t, updatedType, dto.BlockRunPaymentChainSolana, "", "", "")
			require.NoError(t, validateBlockRunPaymentChainTransition(origin, updated))
		}
	})

	t.Run("rejects changing Type 100 to Type 101", func(t *testing.T) {
		origin := blockRunChannelForValidation(t, constant.ChannelTypeBlockRun, dto.BlockRunPaymentChainBase, "", "base-key", "")
		updated := blockRunChannelForValidation(t, constant.ChannelTypeBlockRunVideo, dto.BlockRunPaymentChainBase, "", "base-key", "")
		require.ErrorContains(t, validateBlockRunPaymentChainTransition(origin, updated), "cannot change type into or out of BlockRun")
	})

	t.Run("rejects changing Type 101 to Type 100", func(t *testing.T) {
		origin := blockRunChannelForValidation(t, constant.ChannelTypeBlockRunVideo, dto.BlockRunPaymentChainBase, "", "base-key", "")
		updated := blockRunChannelForValidation(t, constant.ChannelTypeBlockRun, dto.BlockRunPaymentChainSolana, blockRunSolanaBaseURL, validSolanaSeed, "1000000")
		require.ErrorContains(t, validateBlockRunPaymentChainTransition(origin, updated), "cannot change type into or out of BlockRun")
	})
}
