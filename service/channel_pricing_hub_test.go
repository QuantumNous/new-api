package service

import "testing"

func TestNormalizeGroupName_fullwidthParens(t *testing.T) {
	channel := "claude-优惠版(可 API)"
	hub := "claude-优惠版（可 API）"
	if normalizeGroupName(channel) != normalizeGroupName(hub) {
		t.Fatalf("expected %q and %q to normalize equally", channel, hub)
	}
}

func TestHubInputPrice_groupNamePunctuationVariants(t *testing.T) {
	hub := &hubResp{
		Relays: []hubRelay{{
			Name:       "DDS Hub",
			WebsiteUrl: "https://www.ddshub.cc",
			Pricing: []hubPricingEntry{{
				Model:      "claude-sonnet-4-6",
				GroupName:  "claude-优惠版（可 API）",
				InputPrice: 4.5,
			}},
		}},
	}
	price, ok := HubInputPrice(hub, "https://www.ddshub.cc", "claude-优惠版(可 API)", "claude-sonnet-4-6")
	if !ok || price != 4.5 {
		t.Fatalf("HubInputPrice() = (%v, %v), want (4.5, true)", price, ok)
	}
}
