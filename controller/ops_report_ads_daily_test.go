package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func adsTestKw(date, adGroup, criterion, keyword string, snapshot bool, bid, cost float64, clicks int, status string) *model.AdsDailyKeyword {
	return &model.AdsDailyKeyword{
		Date: date, AdGroupId: adGroup, CriterionId: criterion,
		CampaignName: "flatkey-EN-Search", AdGroupName: "ag", Keyword: keyword,
		MatchType: "PHRASE", Status: status, CpcBidUSD: bid, Snapshot: snapshot,
		CostUSD: cost, Clicks: clicks,
	}
}

func adsTestAd(date, adId string, snapshot bool, headlines string, cost float64) *model.AdsDailyCreative {
	return &model.AdsDailyCreative{
		Date: date, AdId: adId, CampaignName: "flatkey-EN-Search", AdGroupName: "ag",
		AdType: "RESPONSIVE_SEARCH_AD", Status: "ENABLED", Snapshot: snapshot,
		Headlines: headlines, Descriptions: `["d1"]`, ImageUrls: "[]",
		FinalUrls: `["https://flatkey.ai/x"]`, CostUSD: cost,
	}
}

func adsDailyFindDay(t *testing.T, days []*adsDailyDay, date string) *adsDailyDay {
	t.Helper()
	for _, d := range days {
		if d.Date == date {
			return d
		}
	}
	t.Fatalf("day %s not found", date)
	return nil
}

func TestBuildAdsDailyDaysDiffs(t *testing.T) {
	keywords := []*model.AdsDailyKeyword{
		// day 1: first snapshot — no changes expected (no previous snapshot)
		adsTestKw("2026-07-18", "g1", "k1", "claude api", true, 0.5, 1.2, 3, "ENABLED"),
		adsTestKw("2026-07-18", "g1", "k2", "gpt api", true, 0.8, 2.0, 4, "ENABLED"),
		// day 2: k1 bid raised, k2 gone from snapshot (still has metrics), k3 added
		adsTestKw("2026-07-19", "g1", "k1", "claude api", true, 0.7, 1.5, 2, "ENABLED"),
		adsTestKw("2026-07-19", "g1", "k2", "gpt api", false, 0, 0.4, 1, ""),
		adsTestKw("2026-07-19", "g1", "k3", "gemini api", true, 0.6, 0, 0, "PAUSED"),
	}
	creatives := []*model.AdsDailyCreative{
		adsTestAd("2026-07-18", "a1", true, `["h1","h2"]`, 3.0),
		adsTestAd("2026-07-19", "a1", true, `["h1","h2-edited"]`, 2.5),
	}
	days := buildAdsDailyDays(keywords, creatives, nil)
	if len(days) != 2 {
		t.Fatalf("expected 2 days, got %d", len(days))
	}
	if days[0].Date != "2026-07-19" {
		t.Fatalf("days not newest-first: %s", days[0].Date)
	}

	d1 := adsDailyFindDay(t, days, "2026-07-18")
	if !d1.Snapshot {
		t.Error("day1 should be a snapshot day")
	}
	if d1.Changes != (adsDailyChangeSummary{}) {
		t.Errorf("first snapshot day must report no changes, got %+v", d1.Changes)
	}
	// totals sum the per-ad metrics
	if d1.CostUSD != 3.0 {
		t.Errorf("day1 cost = %v, want 3.0", d1.CostUSD)
	}

	d2 := adsDailyFindDay(t, days, "2026-07-19")
	want := adsDailyChangeSummary{KeywordsAdded: 1, KeywordsRemoved: 1, BidChanges: 1, CreativeChanges: 1}
	if d2.Changes != want {
		t.Errorf("day2 changes = %+v, want %+v", d2.Changes, want)
	}
	byKw := map[string]adsDailyKeywordRow{}
	for _, r := range d2.Keywords {
		byKw[r.Keyword] = r
	}
	if r := byKw["claude api"]; r.Change != "bid_changed" || r.PrevBidUSD != 0.5 || r.CpcBidUSD != 0.7 {
		t.Errorf("k1 = %+v, want bid_changed 0.5→0.7", r)
	}
	if r := byKw["gpt api"]; r.Change != "removed" || r.Clicks != 1 {
		t.Errorf("k2 = %+v, want removed with its metrics kept", r)
	}
	if r := byKw["gemini api"]; r.Change != "added" || r.Status != "PAUSED" {
		t.Errorf("k3 = %+v, want added", r)
	}
	if len(d2.Creatives) != 1 || d2.Creatives[0].Change != "content_changed" {
		t.Errorf("creatives = %+v, want a1 content_changed", d2.Creatives)
	}
}

func TestBuildAdsDailyDaysMetricsOnlyHistory(t *testing.T) {
	// pre-feature history: metrics rows exist but no snapshots — no changes,
	// and days render with metrics only.
	keywords := []*model.AdsDailyKeyword{
		adsTestKw("2026-07-01", "g1", "k1", "claude api", false, 0, 1.0, 2, ""),
		adsTestKw("2026-07-02", "g1", "k1", "claude api", false, 0, 2.0, 3, ""),
	}
	days := buildAdsDailyDays(keywords, nil, nil)
	if len(days) != 2 {
		t.Fatalf("expected 2 days, got %d", len(days))
	}
	for _, d := range days {
		if d.Snapshot {
			t.Errorf("day %s should not be a snapshot day", d.Date)
		}
		if d.Changes != (adsDailyChangeSummary{}) {
			t.Errorf("day %s changes = %+v, want none", d.Date, d.Changes)
		}
	}
}

func TestAdsDailyFlatkeyFilter(t *testing.T) {
	kws := adsDailyFilterKeywords([]*model.AdsDailyKeyword{
		{CampaignName: "flatkey-PT-Search", Keyword: "kimi 3.0"},
		{CampaignName: "VOC-API-MCP-Dev-US", Keyword: "amazon review api"},
		{CampaignName: "solvea-USCA-Search-Verticals", Keyword: "ai receptionist"},
		{CampaignName: "flatkeyboard-US", Keyword: "mechanical keyboard"},
	})
	if len(kws) != 1 || kws[0].Keyword != "kimi 3.0" {
		t.Errorf("keyword filter = %+v, want flatkey only", kws)
	}
	ads := adsDailyFilterCreatives([]*model.AdsDailyCreative{
		{CampaignName: "flatkey-SEA-Search", AdId: "a1"},
		{CampaignName: "Android US App Installs - AI Receptionist Translation", AdId: "a2"},
	})
	if len(ads) != 1 || ads[0].AdId != "a1" {
		t.Errorf("creative filter = %+v, want flatkey only", ads)
	}
	lps := adsDailyFilterLandings([]*model.AdsDailyLanding{
		{Url: "https://flatkey.ai/pt/models/gemini-api"},
		{Url: "https://www.flatkey.ai/chinese-ai"},
		{Url: "https://www.voc.ai/api/amazon-data"},
		{Url: "https://solvea.cx/receptionist"},
		{Url: "https://evilflatkey.ai/phish"},
		{Url: "https://not-flatkey.ai/path?next=flatkey.ai"},
		{Url: "https://evil.example/?u=https://flatkey.ai"},
		{Url: "javascript://flatkey.ai/%0aalert(1)"},
		{Url: "file://flatkey.ai/etc/passwd"},
		{Url: "//flatkey.ai/scheme-relative"},
	})
	if len(lps) != 2 ||
		lps[0].Url != "https://flatkey.ai/pt/models/gemini-api" ||
		lps[1].Url != "https://www.flatkey.ai/chinese-ai" {
		t.Errorf("landing filter = %+v, want exact flatkey.ai hosts only", lps)
	}
}

func TestBuildAdsDailyLandingsDiff(t *testing.T) {
	curAds := map[string]*model.AdsDailyCreative{
		"a1": {Snapshot: true, FinalUrls: `["https://flatkey.ai/new"]`},
	}
	prevAds := map[string]*model.AdsDailyCreative{
		"a1": {Snapshot: true, FinalUrls: `["https://flatkey.ai/old"]`},
	}
	day := &adsDailyDay{Snapshot: true}
	rows := buildAdsDailyLandings([]*model.AdsDailyLanding{
		{Url: "https://flatkey.ai/new", Clicks: 5, CostUSD: 2.5},
	}, curAds, prevAds, day)
	byUrl := map[string]adsDailyLandingRow{}
	for _, r := range rows {
		byUrl[r.Url] = r
	}
	if r := byUrl["https://flatkey.ai/new"]; r.Change != "added" || r.Clicks != 5 {
		t.Errorf("new url = %+v, want added with metrics", r)
	}
	if r := byUrl["https://flatkey.ai/old"]; r.Change != "removed" {
		t.Errorf("old url = %+v, want removed", r)
	}
	if day.Changes.LandingChanges != 2 {
		t.Errorf("landing changes = %d, want 2", day.Changes.LandingChanges)
	}
}

func TestAdsThumbTarget(t *testing.T) {
	got := adsThumbTarget("https://flatkey.ai/sign-up?lng=pt&a=b#frag one")
	want := "https://flatkey.ai/sign-up%3Flng%3Dpt%26a%3Db%23frag%20one"
	if got != want {
		t.Errorf("adsThumbTarget = %q, want %q", got, want)
	}
}
