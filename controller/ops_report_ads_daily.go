package controller

import (
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// 广告日报 (Ads Daily) board for the ops daily report: per-day keywords with
// CPC, rendered creatives, landing pages, and what changed vs the previous
// snapshot day (keywords added/paused, bid moves, creative edits, landing-page
// swaps). Data comes from the ads_daily_* tables the app syncs itself
// (ops_ads_daily_sync.go); day totals reuse ads_spend_daily.

const (
	adsDailyKeywordCap  = 200 // per day, changed rows always kept
	adsDailyCreativeCap = 50
	// The ads account is shared with other business lines (voc.ai, solvea.cx);
	// this report only covers flatkey, so rows are filtered to flatkey-*
	// campaigns and flatkey.ai landing URLs. Day totals sum the filtered
	// creative metrics — intentionally narrower than the account-wide spend
	// column on the overview tab.
	adsDailyCampaignPrefix = "flatkey"
	adsDailyLandingHost    = "flatkey.ai"
)

var opsAdsDailySyncMutex sync.Mutex

type adsDailyKeywordRow struct {
	AdGroupId    string  `json:"ad_group_id"`
	CriterionId  string  `json:"criterion_id"`
	CampaignName string  `json:"campaign_name"`
	AdGroupName  string  `json:"ad_group_name"`
	Keyword      string  `json:"keyword"`
	MatchType    string  `json:"match_type"`
	Status       string  `json:"status"`
	CpcBidUSD    float64 `json:"cpc_bid_usd"`
	CostUSD      float64 `json:"cost_usd"`
	Clicks       int     `json:"clicks"`
	Impressions  int     `json:"impressions"`
	Conversions  float64 `json:"conversions"`
	Change       string  `json:"change"` // "" | added | removed | bid_changed | status_changed
	PrevBidUSD   float64 `json:"prev_bid_usd"`
	PrevStatus   string  `json:"prev_status"`
}

type adsDailyCreativeRow struct {
	AdId         string   `json:"ad_id"`
	CampaignName string   `json:"campaign_name"`
	AdGroupName  string   `json:"ad_group_name"`
	AdType       string   `json:"ad_type"`
	Status       string   `json:"status"`
	Headlines    []string `json:"headlines"`
	Descriptions []string `json:"descriptions"`
	ImageUrls    []string `json:"image_urls"`
	FinalUrls    []string `json:"final_urls"`
	Path1        string   `json:"path1"`
	Path2        string   `json:"path2"`
	CostUSD      float64  `json:"cost_usd"`
	Clicks       int      `json:"clicks"`
	Impressions  int      `json:"impressions"`
	Conversions  float64  `json:"conversions"`
	Change       string   `json:"change"` // "" | added | removed | content_changed | status_changed
}

type adsDailyLandingRow struct {
	Url         string  `json:"url"`
	CostUSD     float64 `json:"cost_usd"`
	Clicks      int     `json:"clicks"`
	Impressions int     `json:"impressions"`
	Conversions float64 `json:"conversions"`
	Change      string  `json:"change"` // "" | added | removed
}

type adsDailyChangeSummary struct {
	KeywordsAdded   int `json:"keywords_added"`
	KeywordsRemoved int `json:"keywords_removed"`
	BidChanges      int `json:"bid_changes"`
	StatusChanges   int `json:"status_changes"`
	CreativeChanges int `json:"creative_changes"`
	LandingChanges  int `json:"landing_changes"`
}

type adsDailyDay struct {
	Date        string                `json:"date"`
	CostUSD     float64               `json:"cost_usd"`
	Clicks      int                   `json:"clicks"`
	Impressions int                   `json:"impressions"`
	Conversions float64               `json:"conversions"`
	Snapshot    bool                  `json:"snapshot"` // config snapshot exists → changes are meaningful
	Keywords    []adsDailyKeywordRow  `json:"keywords"`
	Creatives   []adsDailyCreativeRow `json:"creatives"`
	Landings    []adsDailyLandingRow  `json:"landings"`
	Changes     adsDailyChangeSummary `json:"changes"`
}

type adsDailyReport struct {
	GeneratedAt int64          `json:"generated_at"`
	Days        int            `json:"days"`
	LastSyncAt  int64          `json:"last_sync_at"`
	Configured  bool           `json:"configured"`
	DaysList    []*adsDailyDay `json:"days_list"`
}

// GetOpsAdsDailyReport handles GET /api/data/ops_report_ads_daily?days=N
// (admin only).
func GetOpsAdsDailyReport(c *gin.Context) {
	days, _ := strconv.Atoi(c.Query("days"))
	if days <= 0 {
		days = opsReportDefaultDays
	}
	if days > opsReportMaxDays {
		days = opsReportMaxDays
	}
	_, configured := opsAdsCredsFromEnv()
	if configured {
		opsAdsDailySyncMutex.Lock()
		opsSyncAdsDaily()
		opsAdsDailySyncMutex.Unlock()
	}

	now := time.Now()
	since := now.In(opsLoc).AddDate(0, 0, -(days - 1)).Format("2006-01-02")
	keywords, err := model.GetAdsDailyKeywords(since)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	creatives, err := model.GetAdsDailyCreatives(since)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	landings, err := model.GetAdsDailyLandings(since)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	lastSync, err := model.GetAdsDailyLastUpdated()
	if err != nil {
		common.ApiError(c, err)
		return
	}

	report := &adsDailyReport{
		GeneratedAt: now.Unix(),
		Days:        days,
		LastSyncAt:  lastSync,
		Configured:  configured,
		DaysList: buildAdsDailyDays(
			adsDailyFilterKeywords(keywords),
			adsDailyFilterCreatives(creatives),
			adsDailyFilterLandings(landings),
		),
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": report})
}

func adsDailyIsFlatkeyCampaign(name string) bool {
	// "flatkey-" with the dash, so unrelated names sharing the prefix
	// (e.g. "flatkeyboard") can never slip in
	return strings.HasPrefix(strings.ToLower(name), adsDailyCampaignPrefix+"-")
}

func adsDailyFilterKeywords(rows []*model.AdsDailyKeyword) []*model.AdsDailyKeyword {
	out := rows[:0:0]
	for _, r := range rows {
		if adsDailyIsFlatkeyCampaign(r.CampaignName) {
			out = append(out, r)
		}
	}
	return out
}

func adsDailyFilterCreatives(rows []*model.AdsDailyCreative) []*model.AdsDailyCreative {
	out := rows[:0:0]
	for _, r := range rows {
		if adsDailyIsFlatkeyCampaign(r.CampaignName) {
			out = append(out, r)
		}
	}
	return out
}

// adsDailyIsFlatkeyLanding accepts only http(s) URLs whose exact host is the
// flatkey.ai bare domain or www — no substring matching ("evilflatkey.ai",
// "?next=flatkey.ai") and no other schemes ("javascript://flatkey.ai/…" and
// "file://flatkey.ai/…" parse a hostname too). Also the thumbnail proxy's
// allowlist, so it must reject everything that is not a real landing URL.
func adsDailyIsFlatkeyLanding(rawUrl string) bool {
	u, err := url.Parse(rawUrl)
	if err != nil {
		return false
	}
	scheme := strings.ToLower(u.Scheme)
	if scheme != "http" && scheme != "https" {
		return false
	}
	host := strings.ToLower(u.Hostname())
	return host == adsDailyLandingHost || host == "www."+adsDailyLandingHost
}

func adsDailyFilterLandings(rows []*model.AdsDailyLanding) []*model.AdsDailyLanding {
	out := rows[:0:0]
	for _, r := range rows {
		if adsDailyIsFlatkeyLanding(r.Url) {
			out = append(out, r)
		}
	}
	return out
}

func buildAdsDailyDays(
	keywords []*model.AdsDailyKeyword,
	creatives []*model.AdsDailyCreative,
	landings []*model.AdsDailyLanding,
) []*adsDailyDay {
	kwByDate := map[string]map[string]*model.AdsDailyKeyword{}
	for _, k := range keywords {
		if kwByDate[k.Date] == nil {
			kwByDate[k.Date] = map[string]*model.AdsDailyKeyword{}
		}
		kwByDate[k.Date][k.AdGroupId+"~"+k.CriterionId] = k
	}
	adByDate := map[string]map[string]*model.AdsDailyCreative{}
	for _, a := range creatives {
		if adByDate[a.Date] == nil {
			adByDate[a.Date] = map[string]*model.AdsDailyCreative{}
		}
		adByDate[a.Date][a.AdId] = a
	}
	landByDate := map[string][]*model.AdsDailyLanding{}
	for _, l := range landings {
		landByDate[l.Date] = append(landByDate[l.Date], l)
	}

	dateSet := map[string]bool{}
	for d := range kwByDate {
		dateSet[d] = true
	}
	for d := range adByDate {
		dateSet[d] = true
	}
	for d := range landByDate {
		dateSet[d] = true
	}
	dates := make([]string, 0, len(dateSet))
	for d := range dateSet {
		dates = append(dates, d)
	}
	sort.Strings(dates) // ascending; walked in order so each day sees the previous snapshot

	// prevSnapDate tracking: a day counts as a snapshot day when any of its
	// keyword or creative rows carry snapshot=true.
	isSnapshotDay := func(d string) bool {
		for _, k := range kwByDate[d] {
			if k.Snapshot {
				return true
			}
		}
		for _, a := range adByDate[d] {
			if a.Snapshot {
				return true
			}
		}
		return false
	}

	result := make([]*adsDailyDay, 0, len(dates))
	prevSnap := ""
	for _, d := range dates {
		day := &adsDailyDay{Date: d, Snapshot: isSnapshotDay(d)}
		// totals = sum of the (flatkey-filtered) per-ad metrics, so the day
		// row matches the detail below it
		for _, a := range adByDate[d] {
			day.CostUSD += a.CostUSD
			day.Clicks += a.Clicks
			day.Impressions += a.Impressions
			day.Conversions += a.Conversions
		}
		day.Keywords = buildAdsDailyKeywords(kwByDate[d], kwByDate[prevSnap], day)
		day.Creatives = buildAdsDailyCreatives(adByDate[d], adByDate[prevSnap], day)
		day.Landings = buildAdsDailyLandings(landByDate[d], adByDate[d], adByDate[prevSnap], day)
		result = append(result, day)
		if day.Snapshot {
			prevSnap = d
		}
	}
	// newest first for display
	for i, j := 0, len(result)-1; i < j; i, j = i+1, j-1 {
		result[i], result[j] = result[j], result[i]
	}
	return result
}

func buildAdsDailyKeywords(cur, prev map[string]*model.AdsDailyKeyword, day *adsDailyDay) []adsDailyKeywordRow {
	rows := make([]adsDailyKeywordRow, 0, len(cur))
	for key, k := range cur {
		row := adsDailyKeywordRow{
			AdGroupId:    k.AdGroupId,
			CriterionId:  k.CriterionId,
			CampaignName: k.CampaignName,
			AdGroupName:  k.AdGroupName,
			Keyword:      k.Keyword,
			MatchType:    k.MatchType,
			Status:       k.Status,
			CpcBidUSD:    k.CpcBidUSD,
			CostUSD:      k.CostUSD,
			Clicks:       k.Clicks,
			Impressions:  k.Impressions,
			Conversions:  k.Conversions,
		}
		if day.Snapshot {
			p := prev[key]
			prevHas := p != nil && p.Snapshot
			switch {
			case k.Snapshot && !prevHas:
				if prev != nil {
					row.Change = "added"
					day.Changes.KeywordsAdded++
				}
			case !k.Snapshot && prevHas:
				// had a snapshot yesterday, gone from today's → removed
				row.Change = "removed"
				row.Status = p.Status
				row.CpcBidUSD = p.CpcBidUSD
				day.Changes.KeywordsRemoved++
			case k.Snapshot && prevHas && p.CpcBidUSD != k.CpcBidUSD:
				row.Change = "bid_changed"
				row.PrevBidUSD = p.CpcBidUSD
				day.Changes.BidChanges++
			case k.Snapshot && prevHas && p.Status != k.Status:
				row.Change = "status_changed"
				row.PrevStatus = p.Status
				day.Changes.StatusChanges++
			}
		}
		rows = append(rows, row)
	}
	// keywords present in the previous snapshot but absent from today entirely
	if day.Snapshot {
		for key, p := range prev {
			if !p.Snapshot {
				continue
			}
			if _, ok := cur[key]; ok {
				continue
			}
			rows = append(rows, adsDailyKeywordRow{
				AdGroupId:    p.AdGroupId,
				CriterionId:  p.CriterionId,
				CampaignName: p.CampaignName,
				AdGroupName:  p.AdGroupName,
				Keyword:      p.Keyword,
				MatchType:    p.MatchType,
				Status:       p.Status,
				CpcBidUSD:    p.CpcBidUSD,
				Change:       "removed",
			})
			day.Changes.KeywordsRemoved++
		}
	}
	sort.SliceStable(rows, func(i, j int) bool {
		if (rows[i].Change != "") != (rows[j].Change != "") {
			return rows[i].Change != ""
		}
		if rows[i].CostUSD != rows[j].CostUSD {
			return rows[i].CostUSD > rows[j].CostUSD
		}
		return rows[i].Clicks > rows[j].Clicks
	})
	if len(rows) > adsDailyKeywordCap {
		rows = rows[:adsDailyKeywordCap]
	}
	return rows
}

func adsDailyCreativeContentChanged(cur, prev *model.AdsDailyCreative) bool {
	return cur.Headlines != prev.Headlines ||
		cur.Descriptions != prev.Descriptions ||
		cur.ImageUrls != prev.ImageUrls ||
		cur.FinalUrls != prev.FinalUrls ||
		cur.Path1 != prev.Path1 ||
		cur.Path2 != prev.Path2
}

func adsDailyParseList(s string) []string {
	if s == "" {
		return []string{}
	}
	var items []string
	if err := common.UnmarshalJsonStr(s, &items); err != nil {
		return []string{}
	}
	return items
}

func buildAdsDailyCreatives(cur, prev map[string]*model.AdsDailyCreative, day *adsDailyDay) []adsDailyCreativeRow {
	rows := make([]adsDailyCreativeRow, 0, len(cur))
	for id, a := range cur {
		row := adsDailyCreativeRow{
			AdId:         a.AdId,
			CampaignName: a.CampaignName,
			AdGroupName:  a.AdGroupName,
			AdType:       a.AdType,
			Status:       a.Status,
			Headlines:    adsDailyParseList(a.Headlines),
			Descriptions: adsDailyParseList(a.Descriptions),
			ImageUrls:    adsDailyParseList(a.ImageUrls),
			FinalUrls:    adsDailyParseList(a.FinalUrls),
			Path1:        a.Path1,
			Path2:        a.Path2,
			CostUSD:      a.CostUSD,
			Clicks:       a.Clicks,
			Impressions:  a.Impressions,
			Conversions:  a.Conversions,
		}
		if day.Snapshot {
			p := prev[id]
			prevHas := p != nil && p.Snapshot
			switch {
			case a.Snapshot && !prevHas:
				if prev != nil {
					row.Change = "added"
					day.Changes.CreativeChanges++
				}
			case !a.Snapshot && prevHas:
				row.Change = "removed"
				row.Status = p.Status
				row.Headlines = adsDailyParseList(p.Headlines)
				row.Descriptions = adsDailyParseList(p.Descriptions)
				row.ImageUrls = adsDailyParseList(p.ImageUrls)
				row.FinalUrls = adsDailyParseList(p.FinalUrls)
				day.Changes.CreativeChanges++
			case a.Snapshot && prevHas && adsDailyCreativeContentChanged(a, p):
				row.Change = "content_changed"
				day.Changes.CreativeChanges++
			case a.Snapshot && prevHas && p.Status != a.Status:
				row.Change = "status_changed"
				day.Changes.CreativeChanges++
			}
		}
		rows = append(rows, row)
	}
	if day.Snapshot {
		for id, p := range prev {
			if !p.Snapshot {
				continue
			}
			if _, ok := cur[id]; ok {
				continue
			}
			rows = append(rows, adsDailyCreativeRow{
				AdId:         p.AdId,
				CampaignName: p.CampaignName,
				AdGroupName:  p.AdGroupName,
				AdType:       p.AdType,
				Status:       p.Status,
				Headlines:    adsDailyParseList(p.Headlines),
				Descriptions: adsDailyParseList(p.Descriptions),
				ImageUrls:    adsDailyParseList(p.ImageUrls),
				FinalUrls:    adsDailyParseList(p.FinalUrls),
				Path1:        p.Path1,
				Path2:        p.Path2,
				Change:       "removed",
			})
			day.Changes.CreativeChanges++
		}
	}
	sort.SliceStable(rows, func(i, j int) bool {
		if (rows[i].Change != "") != (rows[j].Change != "") {
			return rows[i].Change != ""
		}
		if rows[i].CostUSD != rows[j].CostUSD {
			return rows[i].CostUSD > rows[j].CostUSD
		}
		return rows[i].Clicks > rows[j].Clicks
	})
	if len(rows) > adsDailyCreativeCap {
		rows = rows[:adsDailyCreativeCap]
	}
	return rows
}

// buildAdsDailyLandings merges landing_page_view metrics with the configured
// landing set (final URLs from creative snapshots) to flag added/removed URLs.
func buildAdsDailyLandings(metricRows []*model.AdsDailyLanding, curAds, prevAds map[string]*model.AdsDailyCreative, day *adsDailyDay) []adsDailyLandingRow {
	finalUrlSet := func(ads map[string]*model.AdsDailyCreative) map[string]bool {
		set := map[string]bool{}
		for _, a := range ads {
			if !a.Snapshot {
				continue
			}
			for _, u := range adsDailyParseList(a.FinalUrls) {
				set[u] = true
			}
		}
		return set
	}
	curSet := finalUrlSet(curAds)
	prevSet := finalUrlSet(prevAds)

	rows := make([]adsDailyLandingRow, 0, len(metricRows))
	seen := map[string]bool{}
	for _, l := range metricRows {
		row := adsDailyLandingRow{
			Url:         l.Url,
			CostUSD:     l.CostUSD,
			Clicks:      l.Clicks,
			Impressions: l.Impressions,
			Conversions: l.Conversions,
		}
		if day.Snapshot && len(prevSet) > 0 && curSet[l.Url] && !prevSet[l.Url] {
			row.Change = "added"
			day.Changes.LandingChanges++
		}
		seen[l.Url] = true
		rows = append(rows, row)
	}
	if day.Snapshot && len(prevSet) > 0 {
		// configured URLs with no traffic yet, plus URLs dropped since the
		// previous snapshot
		for u := range curSet {
			if seen[u] {
				continue
			}
			row := adsDailyLandingRow{Url: u}
			if !prevSet[u] {
				row.Change = "added"
				day.Changes.LandingChanges++
			}
			rows = append(rows, row)
			seen[u] = true
		}
		for u := range prevSet {
			if seen[u] || curSet[u] {
				continue
			}
			rows = append(rows, adsDailyLandingRow{Url: u, Change: "removed"})
			day.Changes.LandingChanges++
		}
	}
	sort.SliceStable(rows, func(i, j int) bool {
		if rows[i].Clicks != rows[j].Clicks {
			return rows[i].Clicks > rows[j].Clicks
		}
		return rows[i].Url < rows[j].Url
	})
	return rows
}
