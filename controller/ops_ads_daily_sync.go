package controller

import (
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// Cloud-side Google Ads detail sync for the ops 广告日报 (Ads Daily) board.
//
// Same pattern and credentials as ops_ads_sync.go, but pulls per-day keyword,
// creative and landing-page detail into the ads_daily_* tables:
//   - date-segmented metrics for the whole report window (re-upserted freely;
//     past-day metrics only accumulate conversion lag), and
//   - a snapshot of the account's current attributes (bids, statuses, creative
//     content, final URLs) stored under today's ads-account date. The API has
//     no attribute history, so change detection compares accumulated daily
//     snapshots (see model/ads_daily.go).
//
// Runs lazily from the report endpoint when data is older than opsAdsSyncTTL;
// failures only log and the report renders the last synced rows. Multi-node
// safe per Rule 11: concurrent syncs upsert equivalent rows.

// opsAdsDailyRow is the GAQL result-row subset shared by every ads-daily
// query; int64 metrics arrive as JSON strings.
type opsAdsDailyRow struct {
	Segments struct {
		Date string `json:"date"`
	} `json:"segments"`
	Metrics struct {
		CostMicros  string  `json:"costMicros"`
		Clicks      string  `json:"clicks"`
		Impressions string  `json:"impressions"`
		Conversions float64 `json:"conversions"`
	} `json:"metrics"`
	Customer struct {
		TimeZone string `json:"timeZone"`
	} `json:"customer"`
	Campaign struct {
		Id   string `json:"id"`
		Name string `json:"name"`
	} `json:"campaign"`
	AdGroup struct {
		Id   string `json:"id"`
		Name string `json:"name"`
	} `json:"adGroup"`
	AdGroupCriterion struct {
		CriterionId           string `json:"criterionId"`
		Status                string `json:"status"`
		EffectiveCpcBidMicros string `json:"effectiveCpcBidMicros"`
		Keyword               struct {
			Text      string `json:"text"`
			MatchType string `json:"matchType"`
		} `json:"keyword"`
	} `json:"adGroupCriterion"`
	AdGroupAd struct {
		Status string `json:"status"`
		Ad     struct {
			Id                 string   `json:"id"`
			Type               string   `json:"type"`
			FinalUrls          []string `json:"finalUrls"`
			ResponsiveSearchAd struct {
				Headlines []struct {
					Text string `json:"text"`
				} `json:"headlines"`
				Descriptions []struct {
					Text string `json:"text"`
				} `json:"descriptions"`
				Path1 string `json:"path1"`
				Path2 string `json:"path2"`
			} `json:"responsiveSearchAd"`
			ImageAd struct {
				ImageUrl string `json:"imageUrl"`
			} `json:"imageAd"`
		} `json:"ad"`
	} `json:"adGroupAd"`
	AdGroupAdAssetView struct {
		AdGroupAd string `json:"adGroupAd"`
		FieldType string `json:"fieldType"`
	} `json:"adGroupAdAssetView"`
	Asset struct {
		ImageAsset struct {
			FullSize struct {
				Url string `json:"url"`
			} `json:"fullSize"`
		} `json:"imageAsset"`
	} `json:"asset"`
	LandingPageView struct {
		UnexpandedFinalUrl string `json:"unexpandedFinalUrl"`
	} `json:"landingPageView"`
}

type opsAdsDailySearchResponse struct {
	Results       []opsAdsDailyRow `json:"results"`
	NextPageToken string           `json:"nextPageToken"`
}

// opsAdsDailySearch runs one GAQL query and returns all pages of result rows.
func opsAdsDailySearch(creds opsAdsCreds, client *http.Client, accessToken, query string) ([]opsAdsDailyRow, error) {
	endpoint := fmt.Sprintf("https://googleads.googleapis.com/%s/customers/%s/googleAds:search",
		creds.apiVersion, creds.customerId)
	var rows []opsAdsDailyRow
	pageToken := ""
	for {
		payload := map[string]string{"query": query}
		if pageToken != "" {
			payload["pageToken"] = pageToken
		}
		body, err := common.Marshal(payload)
		if err != nil {
			return nil, err
		}
		req, err := http.NewRequest(http.MethodPost, endpoint, strings.NewReader(string(body)))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+accessToken)
		req.Header.Set("developer-token", creds.developerToken)
		if creds.loginCustomerId != "" {
			req.Header.Set("login-customer-id", creds.loginCustomerId)
		}
		resp, err := client.Do(req)
		if err != nil {
			return nil, fmt.Errorf("googleAds:search request: %w", err)
		}
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 32<<20))
		resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			msg := string(respBody)
			if len(msg) > 500 {
				msg = msg[:500]
			}
			return nil, fmt.Errorf("googleAds:search status %d: %s", resp.StatusCode, msg)
		}
		var page opsAdsDailySearchResponse
		if err := common.Unmarshal(respBody, &page); err != nil {
			return nil, fmt.Errorf("googleAds:search response: %w", err)
		}
		rows = append(rows, page.Results...)
		pageToken = page.NextPageToken
		if pageToken == "" {
			break
		}
	}
	return rows, nil
}

// opsSyncAdsDaily refreshes the ads_daily_* tables when they are older than
// opsAdsSyncTTL. Callers serialize via opsAdsDailyReportMutex.
func opsSyncAdsDaily() {
	creds, ok := opsAdsCredsFromEnv()
	if !ok {
		return
	}
	lastSync, err := model.GetAdsDailyLastUpdated()
	if err != nil {
		common.SysError("ops ads daily sync: freshness check failed: " + err.Error())
		return
	}
	if time.Since(time.Unix(lastSync, 0)) < opsAdsSyncTTL {
		return
	}
	if err := opsFetchAdsDaily(creds); err != nil {
		common.SysError("ops ads daily sync: " + err.Error())
		return
	}
	common.SysLog("ops ads daily sync: completed")
}

func opsAdsMicrosToUSD(micros string) float64 {
	v, _ := strconv.ParseInt(micros, 10, 64)
	return float64(v) / 1e6
}

func opsAdsInt(s string) int {
	v, _ := strconv.Atoi(s)
	return v
}

// opsAdsAccountToday resolves "today" in the ads account's own timezone — the
// timezone segments.date is bucketed in — so the attribute snapshot lands on
// the same date as that day's metrics.
func opsAdsAccountToday(creds opsAdsCreds, client *http.Client, accessToken string) (string, error) {
	rows, err := opsAdsDailySearch(creds, client, accessToken,
		"SELECT customer.time_zone FROM customer")
	if err != nil {
		return "", err
	}
	tz := ""
	if len(rows) > 0 {
		tz = rows[0].Customer.TimeZone
	}
	loc, err := time.LoadLocation(tz)
	if err != nil || tz == "" {
		loc = opsLoc
	}
	return time.Now().In(loc).Format("2006-01-02"), nil
}

func opsFetchAdsDaily(creds opsAdsCreds) error {
	client := &http.Client{Timeout: opsAdsHTTPTimeout}
	accessToken, err := opsAdsAccessToken(creds, client)
	if err != nil {
		return err
	}
	today, err := opsAdsAccountToday(creds, client, accessToken)
	if err != nil {
		return err
	}
	// window end is the ads account's "today" so current-day metrics are
	// fetched even when the account timezone is ahead of the report timezone
	start := time.Now().In(opsLoc).AddDate(0, 0, -(opsAdsSyncDays - 1))
	window := fmt.Sprintf("segments.date BETWEEN '%s' AND '%s'",
		start.Format("2006-01-02"), today)
	now := time.Now().Unix()

	// 1. keyword metrics per day
	rows, err := opsAdsDailySearch(creds, client, accessToken, fmt.Sprintf(`
		SELECT segments.date, campaign.id, campaign.name, ad_group.id, ad_group.name,
			ad_group_criterion.criterion_id, ad_group_criterion.keyword.text,
			ad_group_criterion.keyword.match_type,
			metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions
		FROM keyword_view WHERE %s`, window))
	if err != nil {
		return fmt.Errorf("keyword metrics: %w", err)
	}
	kwMetrics := make([]*model.AdsDailyKeyword, 0, len(rows))
	for _, r := range rows {
		if r.Segments.Date == "" || r.AdGroupCriterion.CriterionId == "" {
			continue
		}
		kwMetrics = append(kwMetrics, &model.AdsDailyKeyword{
			Date:         r.Segments.Date,
			AdGroupId:    r.AdGroup.Id,
			CriterionId:  r.AdGroupCriterion.CriterionId,
			CampaignId:   r.Campaign.Id,
			CampaignName: r.Campaign.Name,
			AdGroupName:  r.AdGroup.Name,
			Keyword:      r.AdGroupCriterion.Keyword.Text,
			MatchType:    r.AdGroupCriterion.Keyword.MatchType,
			CostUSD:      opsAdsMicrosToUSD(r.Metrics.CostMicros),
			Clicks:       opsAdsInt(r.Metrics.Clicks),
			Impressions:  opsAdsInt(r.Metrics.Impressions),
			Conversions:  r.Metrics.Conversions,
			UpdatedAt:    now,
		})
	}
	if err := model.UpsertAdsDailyKeywordMetrics(kwMetrics); err != nil {
		return fmt.Errorf("keyword metrics upsert: %w", err)
	}

	// 2. keyword attribute snapshot (current bids/statuses) under today's date
	rows, err = opsAdsDailySearch(creds, client, accessToken, `
		SELECT campaign.id, campaign.name, ad_group.id, ad_group.name,
			ad_group_criterion.criterion_id, ad_group_criterion.keyword.text,
			ad_group_criterion.keyword.match_type, ad_group_criterion.status,
			ad_group_criterion.effective_cpc_bid_micros
		FROM keyword_view
		WHERE campaign.status = 'ENABLED' AND ad_group.status != 'REMOVED'
			AND ad_group_criterion.status != 'REMOVED'`)
	if err != nil {
		return fmt.Errorf("keyword snapshot: %w", err)
	}
	kwSnap := make([]*model.AdsDailyKeyword, 0, len(rows))
	for _, r := range rows {
		if r.AdGroupCriterion.CriterionId == "" {
			continue
		}
		kwSnap = append(kwSnap, &model.AdsDailyKeyword{
			Date:         today,
			AdGroupId:    r.AdGroup.Id,
			CriterionId:  r.AdGroupCriterion.CriterionId,
			CampaignId:   r.Campaign.Id,
			CampaignName: r.Campaign.Name,
			AdGroupName:  r.AdGroup.Name,
			Keyword:      r.AdGroupCriterion.Keyword.Text,
			MatchType:    r.AdGroupCriterion.Keyword.MatchType,
			Status:       r.AdGroupCriterion.Status,
			CpcBidUSD:    opsAdsMicrosToUSD(r.AdGroupCriterion.EffectiveCpcBidMicros),
			Snapshot:     true,
			UpdatedAt:    now,
		})
	}
	if err := model.UpsertAdsDailyKeywordSnapshot(kwSnap); err != nil {
		return fmt.Errorf("keyword snapshot upsert: %w", err)
	}

	// 3. creative metrics per day
	rows, err = opsAdsDailySearch(creds, client, accessToken, fmt.Sprintf(`
		SELECT segments.date, campaign.id, campaign.name, ad_group.id, ad_group.name,
			ad_group_ad.ad.id, ad_group_ad.ad.type,
			metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions
		FROM ad_group_ad WHERE %s`, window))
	if err != nil {
		return fmt.Errorf("creative metrics: %w", err)
	}
	adMetrics := make([]*model.AdsDailyCreative, 0, len(rows))
	for _, r := range rows {
		if r.Segments.Date == "" || r.AdGroupAd.Ad.Id == "" {
			continue
		}
		adMetrics = append(adMetrics, &model.AdsDailyCreative{
			Date:         r.Segments.Date,
			AdId:         r.AdGroupAd.Ad.Id,
			CampaignId:   r.Campaign.Id,
			CampaignName: r.Campaign.Name,
			AdGroupId:    r.AdGroup.Id,
			AdGroupName:  r.AdGroup.Name,
			AdType:       r.AdGroupAd.Ad.Type,
			CostUSD:      opsAdsMicrosToUSD(r.Metrics.CostMicros),
			Clicks:       opsAdsInt(r.Metrics.Clicks),
			Impressions:  opsAdsInt(r.Metrics.Impressions),
			Conversions:  r.Metrics.Conversions,
			UpdatedAt:    now,
		})
	}
	if err := model.UpsertAdsDailyCreativeMetrics(adMetrics); err != nil {
		return fmt.Errorf("creative metrics upsert: %w", err)
	}

	// 4. image assets attached to ads (for the creative snapshot below)
	rows, err = opsAdsDailySearch(creds, client, accessToken, `
		SELECT ad_group_ad_asset_view.ad_group_ad, ad_group_ad_asset_view.field_type,
			asset.image_asset.full_size.url
		FROM ad_group_ad_asset_view
		WHERE ad_group_ad_asset_view.field_type IN ('MARKETING_IMAGE', 'SQUARE_MARKETING_IMAGE')`)
	if err != nil {
		return fmt.Errorf("ad image assets: %w", err)
	}
	// resource name format: customers/X/adGroupAds/{adGroupId}~{adId}
	imagesByAd := map[string][]string{}
	for _, r := range rows {
		url := r.Asset.ImageAsset.FullSize.Url
		if url == "" {
			continue
		}
		res := r.AdGroupAdAssetView.AdGroupAd
		if i := strings.LastIndex(res, "~"); i >= 0 {
			adId := res[i+1:]
			imagesByAd[adId] = append(imagesByAd[adId], url)
		}
	}

	// 5. creative content snapshot under today's date
	rows, err = opsAdsDailySearch(creds, client, accessToken, `
		SELECT campaign.id, campaign.name, ad_group.id, ad_group.name,
			ad_group_ad.ad.id, ad_group_ad.ad.type, ad_group_ad.status,
			ad_group_ad.ad.final_urls,
			ad_group_ad.ad.responsive_search_ad.headlines,
			ad_group_ad.ad.responsive_search_ad.descriptions,
			ad_group_ad.ad.responsive_search_ad.path1,
			ad_group_ad.ad.responsive_search_ad.path2
		FROM ad_group_ad
		WHERE campaign.status = 'ENABLED' AND ad_group.status != 'REMOVED'
			AND ad_group_ad.status != 'REMOVED'`)
	if err != nil {
		return fmt.Errorf("creative snapshot: %w", err)
	}
	adSnap := make([]*model.AdsDailyCreative, 0, len(rows))
	for _, r := range rows {
		if r.AdGroupAd.Ad.Id == "" {
			continue
		}
		headlines := make([]string, 0, len(r.AdGroupAd.Ad.ResponsiveSearchAd.Headlines))
		for _, h := range r.AdGroupAd.Ad.ResponsiveSearchAd.Headlines {
			headlines = append(headlines, h.Text)
		}
		descriptions := make([]string, 0, len(r.AdGroupAd.Ad.ResponsiveSearchAd.Descriptions))
		for _, d := range r.AdGroupAd.Ad.ResponsiveSearchAd.Descriptions {
			descriptions = append(descriptions, d.Text)
		}
		images := imagesByAd[r.AdGroupAd.Ad.Id]
		if r.AdGroupAd.Ad.ImageAd.ImageUrl != "" {
			images = append(images, r.AdGroupAd.Ad.ImageAd.ImageUrl)
		}
		adSnap = append(adSnap, &model.AdsDailyCreative{
			Date:         today,
			AdId:         r.AdGroupAd.Ad.Id,
			CampaignId:   r.Campaign.Id,
			CampaignName: r.Campaign.Name,
			AdGroupId:    r.AdGroup.Id,
			AdGroupName:  r.AdGroup.Name,
			AdType:       r.AdGroupAd.Ad.Type,
			Status:       r.AdGroupAd.Status,
			Headlines:    opsAdsJsonList(headlines),
			Descriptions: opsAdsJsonList(descriptions),
			ImageUrls:    opsAdsJsonList(images),
			FinalUrls:    opsAdsJsonList(r.AdGroupAd.Ad.FinalUrls),
			Path1:        r.AdGroupAd.Ad.ResponsiveSearchAd.Path1,
			Path2:        r.AdGroupAd.Ad.ResponsiveSearchAd.Path2,
			Snapshot:     true,
			UpdatedAt:    now,
		})
	}
	if err := model.UpsertAdsDailyCreativeSnapshot(adSnap); err != nil {
		return fmt.Errorf("creative snapshot upsert: %w", err)
	}

	// 6. landing-page metrics per day
	rows, err = opsAdsDailySearch(creds, client, accessToken, fmt.Sprintf(`
		SELECT segments.date, landing_page_view.unexpanded_final_url,
			metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions
		FROM landing_page_view WHERE %s`, window))
	if err != nil {
		return fmt.Errorf("landing metrics: %w", err)
	}
	landings := make([]*model.AdsDailyLanding, 0, len(rows))
	for _, r := range rows {
		url := r.LandingPageView.UnexpandedFinalUrl
		if r.Segments.Date == "" || url == "" {
			continue
		}
		if len(url) > 500 {
			url = url[:500]
		}
		landings = append(landings, &model.AdsDailyLanding{
			Date:        r.Segments.Date,
			Url:         url,
			CostUSD:     opsAdsMicrosToUSD(r.Metrics.CostMicros),
			Clicks:      opsAdsInt(r.Metrics.Clicks),
			Impressions: opsAdsInt(r.Metrics.Impressions),
			Conversions: r.Metrics.Conversions,
			UpdatedAt:   now,
		})
	}
	if err := model.UpsertAdsDailyLandings(landings); err != nil {
		return fmt.Errorf("landing upsert: %w", err)
	}
	return nil
}

func opsAdsJsonList(items []string) string {
	if len(items) == 0 {
		return "[]"
	}
	b, err := common.Marshal(items)
	if err != nil {
		return "[]"
	}
	return string(b)
}
