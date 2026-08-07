package model

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDirectQuotaMutationGuard(t *testing.T) {
	root := ".."
	forbidden := []string{
		"UPDATE users SET quota",
		`gorm.Expr("quota +`,
		`gorm.Expr("quota -`,
		"AmountUsed +",
		"AmountUsed -",
		"amount_used +",
		"amount_used -",
	}
	allowed := map[string]bool{
		filepath.Clean("model/quota_lifecycle.go"):                  true,
		filepath.Clean("model/direct_quota_mutation_guard_test.go"): true,
	}
	legacyProductionOccurrences := map[string]int{
		"model/checkin.go":                       1,
		"model/data_tool_call.go":                4,
		"model/invite_reward.go":                 2,
		"model/redemption.go":                    1,
		"model/stripe_card.go":                   1,
		"model/temporary_channel_spend.go":       1,
		"model/topup.go":                         6,
		"model/usedata.go":                       2,
		"service/subscription_compensation.go":   2,
		"service/subscription_contract.go":       1,
		"service/subscription_term_refund.go":    1,
		"service/subscription_wallet_renewal.go": 1,
	}
	seenLegacyOccurrences := map[string]int{}
	var violations []string
	err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			switch d.Name() {
			case ".git", ".omx", "node_modules", "web", "website", "docs":
				return filepath.SkipDir
			}
			return nil
		}
		if filepath.Ext(path) != ".go" {
			return nil
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		rel = filepath.ToSlash(rel)
		if allowed[filepath.Clean(rel)] {
			return nil
		}
		content, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		text := string(content)
		for _, needle := range forbidden {
			if strings.Contains(text, needle) {
				if _, legacy := legacyProductionOccurrences[rel]; legacy {
					seenLegacyOccurrences[rel] += strings.Count(text, needle)
					continue
				}
				violations = append(violations, rel+": "+needle)
			}
		}
		return nil
	})
	require.NoError(t, err)
	for rel, want := range legacyProductionOccurrences {
		require.Equal(t, want, seenLegacyOccurrences[rel], "legacy direct quota mutation count changed in %s", rel)
	}
	require.Empty(t, violations, "direct quota/subscription balance arithmetic must route through quota_lifecycle.go")
}
