package billingexpr_test

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/stretchr/testify/require"
)

func TestComputeTieredQuotaRejectsInvalidRuntimeAmounts(t *testing.T) {
	const secret = "sk-sensitive-settlement-input"

	tests := []struct {
		name         string
		expr         string
		params       billingexpr.TokenParams
		quotaPerUnit float64
		groupRatio   float64
		wantStage    string
	}{
		{
			name:         "negative expression cost",
			expr:         `tier("base", p - 1)`,
			params:       billingexpr.TokenParams{},
			quotaPerUnit: 500_000,
			groupRatio:   1,
			wantStage:    "cost",
		},
		{
			name:         "NaN expression cost",
			expr:         `tier("base", p)`,
			params:       billingexpr.TokenParams{P: math.NaN()},
			quotaPerUnit: 500_000,
			groupRatio:   1,
			wantStage:    "cost",
		},
		{
			name:         "infinite expression cost",
			expr:         `tier("base", p)`,
			params:       billingexpr.TokenParams{P: math.Inf(1)},
			quotaPerUnit: 500_000,
			groupRatio:   1,
			wantStage:    "cost",
		},
		{
			name:         "negative quota conversion",
			expr:         `tier("base", p)`,
			params:       billingexpr.TokenParams{P: 1},
			quotaPerUnit: -1,
			groupRatio:   1,
			wantStage:    "quota before group",
		},
		{
			name:         "infinite quota conversion",
			expr:         `tier("base", p)`,
			params:       billingexpr.TokenParams{P: 1},
			quotaPerUnit: math.Inf(1),
			groupRatio:   1,
			wantStage:    "quota before group",
		},
		{
			name:         "negative group ratio",
			expr:         `tier("base", p)`,
			params:       billingexpr.TokenParams{P: 1},
			quotaPerUnit: 500_000,
			groupRatio:   -1,
			wantStage:    "group ratio",
		},
		{
			name:         "NaN group ratio",
			expr:         `tier("base", p)`,
			params:       billingexpr.TokenParams{P: 1},
			quotaPerUnit: 500_000,
			groupRatio:   math.NaN(),
			wantStage:    "group ratio",
		},
		{
			name:         "infinite group ratio",
			expr:         `tier("base", p)`,
			params:       billingexpr.TokenParams{P: 1},
			quotaPerUnit: 500_000,
			groupRatio:   math.Inf(1),
			wantStage:    "group ratio",
		},
		{
			name:         "group combination overflows",
			expr:         `tier("base", p)`,
			params:       billingexpr.TokenParams{P: 2},
			quotaPerUnit: 1_000_000,
			groupRatio:   math.MaxFloat64,
			wantStage:    "quota after group",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			snapshot := &billingexpr.BillingSnapshot{
				BillingMode:  "tiered_expr",
				ExprString:   tt.expr,
				ExprHash:     billingexpr.ExprHashString(tt.expr),
				GroupRatio:   tt.groupRatio,
				QuotaPerUnit: tt.quotaPerUnit,
			}

			_, err := billingexpr.ComputeTieredQuotaWithRequest(
				snapshot,
				tt.params,
				billingexpr.RequestInput{Body: []byte(`{"api_key":"` + secret + `"}`)},
			)

			require.Error(t, err)
			require.ErrorContains(t, err, tt.wantStage)
			require.NotContains(t, err.Error(), secret)
		})
	}
}

func TestComputeTieredQuotaRedactsExpressionErrors(t *testing.T) {
	const safeError = "tiered billing expression evaluation failed"

	t.Run("compile error", func(t *testing.T) {
		const secret = "compile-secret-value"
		exprString := `tier("` + secret + `",`
		snapshot := &billingexpr.BillingSnapshot{
			ExprString:   exprString,
			ExprHash:     billingexpr.ExprHashString(exprString),
			GroupRatio:   1,
			QuotaPerUnit: 500_000,
		}

		_, err := billingexpr.ComputeTieredQuota(snapshot, billingexpr.TokenParams{})

		require.EqualError(t, err, safeError)
		require.NotContains(t, err.Error(), secret)
	})

	t.Run("runtime error after reading dynamic secrets", func(t *testing.T) {
		const (
			bodySecret   = "body-secret-value"
			headerSecret = "Bearer header-secret-value"
		)
		exprString := `has(header("authorization"), "Bearer") ? (param("payload") > 0 ? tier("base", p) : tier("base", c)) : tier("base", 0)`
		snapshot := &billingexpr.BillingSnapshot{
			ExprString:   exprString,
			ExprHash:     billingexpr.ExprHashString(exprString),
			GroupRatio:   1,
			QuotaPerUnit: 500_000,
		}

		_, err := billingexpr.ComputeTieredQuotaWithRequest(
			snapshot,
			billingexpr.TokenParams{P: 1},
			billingexpr.RequestInput{
				Headers: map[string]string{"Authorization": headerSecret},
				Body:    []byte(`{"payload":"` + bodySecret + `"}`),
			},
		)

		require.EqualError(t, err, safeError)
		require.NotContains(t, err.Error(), bodySecret)
		require.NotContains(t, err.Error(), headerSecret)
	})
}
