package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestParseOpsAttributionPrefersFirstValidLanding(t *testing.T) {
	agg := &opsUserAgg{user: &model.OpsPlgUser{AdsAttribution: `{"utm_campaign":"pt","first_landing_path":"/pt","landing_path":"/oauth/google"}`}}
	parseOpsAttribution(agg)
	if agg.landing != "/pt" {
		t.Fatalf("landing = %q, want /pt", agg.landing)
	}

	agg = &opsUserAgg{user: &model.OpsPlgUser{AdsAttribution: `{"landing_path":"/oauth/google"}`}}
	parseOpsAttribution(agg)
	if agg.landing != "" {
		t.Fatalf("OAuth callback must not be reported as a lander, got %q", agg.landing)
	}
}

func opsTestAgg(id int, createdAt int64, campaign, keyword, matchType, landing string, apiKeyCount int) *opsUserAgg {
	return &opsUserAgg{
		user:      &model.OpsPlgUser{Id: id, CreatedAt: createdAt},
		campaign:  campaign,
		keyword:   keyword,
		matchType: matchType,
		landing:   landing,
		logStats:  &model.OpsUserLogStats{UserId: id, ApiKeyCount: apiKeyCount},
	}
}

func TestOpsEnrichCampaignsTrendAndExtras(t *testing.T) {
	const days = 3
	startTs := int64(86400 * 100)
	aggs := map[int]*opsUserAgg{
		// day 0
		1: opsTestAgg(1, startTs+10, "camp-a", "claude api", "p", "/sign-up", 1),
		// day 2
		2: opsTestAgg(2, startTs+2*86400+10, "camp-a", "gpt api", "e", "/sign-up", 0),
		// before the window: excluded from trend but counted in extras
		3: opsTestAgg(3, startTs-86400, "camp-a", "claude api", "p", "/zh", 0),
	}
	rows := []opsFunnelRow{{Key: "camp-a", Registrations: 3}}
	result := opsEnrichCampaigns(rows, aggs, startTs, days)
	if len(result) != 1 {
		t.Fatalf("expected 1 row, got %d", len(result))
	}
	r := result[0]
	if len(r.Trend) != days {
		t.Fatalf("trend length = %d, want %d", len(r.Trend), days)
	}
	if r.Trend[0] != 1 || r.Trend[1] != 0 || r.Trend[2] != 1 {
		t.Errorf("trend = %v, want [1 0 1]", r.Trend)
	}
	if len(r.MatchTypes) != 2 || r.MatchTypes[0].Name != "p" || r.MatchTypes[0].Count != 2 {
		t.Errorf("match types = %v, want p:2 first", r.MatchTypes)
	}
	if len(r.LandingPages) != 2 || r.LandingPages[0].Name != "/sign-up" || r.LandingPages[0].Count != 2 {
		t.Errorf("landing pages = %v, want /sign-up:2 first", r.LandingPages)
	}
}

func TestOpsRollupKeywords(t *testing.T) {
	aggs := map[int]*opsUserAgg{
		1: opsTestAgg(1, 0, "camp-a", "claude api", "p", "/sign-up", 1),
		2: opsTestAgg(2, 0, "camp-b", "claude api", "e", "/sign-up", 0),
		3: opsTestAgg(3, 0, "camp-a", "gpt api", "p", "/sign-up", 0),
		4: opsTestAgg(4, 0, "(organic)", "", "", "/sign-up", 1), // no keyword: excluded
	}
	rows := opsRollupKeywords(aggs, 50)
	if len(rows) != 2 {
		t.Fatalf("expected 2 keyword rows, got %d", len(rows))
	}
	top := rows[0]
	if top.Key != "claude api" || top.Registrations != 2 || top.KeyUsers != 1 {
		t.Errorf("top row = %+v, want claude api reg=2 keyUsers=1", top.opsFunnelRow)
	}
	if len(top.Campaigns) != 2 {
		t.Errorf("campaigns = %v, want both camp-a and camp-b", top.Campaigns)
	}
	if rows[1].Key != "gpt api" {
		t.Errorf("second row = %s, want gpt api", rows[1].Key)
	}

	limited := opsRollupKeywords(aggs, 1)
	if len(limited) != 1 || limited[0].Key != "claude api" {
		t.Errorf("limit=1 should keep top registrations row, got %v", limited)
	}
}

func TestOpsIPCountry(t *testing.T) {
	cases := map[string]string{
		"8.8.8.8":      "US",
		"":             "?",
		"not-an-ip":    "?",
		"192.168.1.1":  "?",  // private
		"2400:3200::1": "CN", // Alibaba DNS
		"127.0.0.1":    "?",
	}
	for ip, want := range cases {
		if got := opsIPCountry(ip); got != want {
			t.Errorf("opsIPCountry(%q) = %q, want %q", ip, got, want)
		}
	}
}

func TestOpsStripeMajorAmount(t *testing.T) {
	if got := opsStripeMajorAmount("usd", 1050); got != 10.5 {
		t.Errorf("usd 1050 minor = %v, want 10.5", got)
	}
	if got := opsStripeMajorAmount("jpy", 3000); got != 3000 {
		t.Errorf("jpy 3000 = %v, want 3000 (zero-decimal)", got)
	}
	if got := opsStripeMajorAmount("KRW", 5000); got != 5000 {
		t.Errorf("KRW should be case-insensitive zero-decimal, got %v", got)
	}
}

func TestOpsSubscriptionOrdersAsTopUps(t *testing.T) {
	orders := []*model.OpsSubscriptionOrder{
		// USD plan purchase: valued at charged money via the USD fast path.
		{UserId: 1, Money: 30, Status: "success", CreateTime: 100, PaymentCurrency: "USD", PaymentProvider: "stripe", PlanUSD: 30},
		// Local-currency plan (Pix BRL pricing): money holds BRL, USD value
		// must come from the plan's USD list price via BonusTier.
		{UserId: 2, Money: 49.9, Status: "success", CreateTime: 200, PaymentCurrency: "BRL", PaymentProvider: "stripe", PlanUSD: 10},
		// Invitee first-subscription discount reduces the USD valuation.
		{UserId: 3, Money: 24.95, Status: "success", CreateTime: 300, PaymentCurrency: "BRL", PaymentProvider: "epay", PlanUSD: 10, DiscountUSD: 5},
	}
	converted := opsSubscriptionOrdersAsTopUps(orders)
	if len(converted) != 3 {
		t.Fatalf("expected 3 converted rows, got %d", len(converted))
	}
	if usd, ok := opsTopUpUSD(converted[0]); !ok || usd != 30 {
		t.Errorf("USD subscription order should value at charged money, got %v ok=%v", usd, ok)
	}
	if usd, ok := opsTopUpUSD(converted[1]); !ok || usd != 10 {
		t.Errorf("BRL subscription order should value at plan USD price, got %v ok=%v", usd, ok)
	}
	if usd, ok := opsTopUpUSD(converted[2]); !ok || usd != 5 {
		t.Errorf("discounted subscription order should value at plan minus discount, got %v ok=%v", usd, ok)
	}
	if converted[1].PaymentCurrency != "BRL" {
		t.Errorf("original currency must survive for the payer-table badges, got %q", converted[1].PaymentCurrency)
	}
	// Converted rows must never masquerade as stripe_auto: they carry payment
	// intent in the funnel exactly like user-initiated top-ups.
	for i, c := range converted {
		if c.PaymentProvider == model.PaymentProviderStripeAuto {
			t.Errorf("row %d must not be stripe_auto", i)
		}
	}
}
