package controller

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// Cloud-side Google Ads spend sync for the ops daily report.
//
// The app itself pulls per-day account totals (spend/clicks) from the Google
// Ads REST API and upserts them into ads_spend_daily, so the daily report
// never depends on any operator machine being online. (The AdPilot board's
// ads_pilot_* tables are separate and stay fed by the ops machine's pipeline,
// which also owns all mutations.) The sync runs lazily inside the
// (mutex-serialized) report rebuild when the stored data is older than
// opsAdsSyncTTL; a failed sync only logs — the report still renders with the
// last synced rows.
//
// Multi-node (Rule 11): concurrent syncs across nodes are harmless — they
// upsert identical rows keyed by date, and the freshness check makes extras
// rare. No cross-node lock is needed.
//
// Required env (values live with the ads account owner; see PR notes):
//   GOOGLE_ADS_DEVELOPER_TOKEN   Google Ads API developer token
//   GOOGLE_ADS_CLIENT_ID         OAuth client id
//   GOOGLE_ADS_CLIENT_SECRET     OAuth client secret
//   GOOGLE_ADS_REFRESH_TOKEN     OAuth refresh token (ads-account Google user)
//   GOOGLE_ADS_CUSTOMER_ID       client account id, digits only (e.g. 2752299046)
// Optional:
//   GOOGLE_ADS_LOGIN_CUSTOMER_ID MCC id when the account sits under a manager
//   GOOGLE_ADS_API_VERSION       REST version, default v24
// When the required vars are absent the sync is a no-op (self-hosted installs).

const (
	opsAdsSyncTTL     = 6 * time.Hour
	opsAdsSyncDays    = opsReportMaxDays
	opsAdsHTTPTimeout = 30 * time.Second
)

type opsAdsCreds struct {
	developerToken  string
	clientId        string
	clientSecret    string
	refreshToken    string
	customerId      string
	loginCustomerId string
	apiVersion      string
}

func opsAdsCredsFromEnv() (opsAdsCreds, bool) {
	c := opsAdsCreds{
		developerToken:  strings.TrimSpace(os.Getenv("GOOGLE_ADS_DEVELOPER_TOKEN")),
		clientId:        strings.TrimSpace(os.Getenv("GOOGLE_ADS_CLIENT_ID")),
		clientSecret:    strings.TrimSpace(os.Getenv("GOOGLE_ADS_CLIENT_SECRET")),
		refreshToken:    strings.TrimSpace(os.Getenv("GOOGLE_ADS_REFRESH_TOKEN")),
		customerId:      strings.ReplaceAll(strings.TrimSpace(os.Getenv("GOOGLE_ADS_CUSTOMER_ID")), "-", ""),
		loginCustomerId: strings.ReplaceAll(strings.TrimSpace(os.Getenv("GOOGLE_ADS_LOGIN_CUSTOMER_ID")), "-", ""),
		apiVersion:      strings.TrimSpace(os.Getenv("GOOGLE_ADS_API_VERSION")),
	}
	if c.apiVersion == "" {
		c.apiVersion = "v24"
	}
	ok := c.developerToken != "" && c.clientId != "" && c.clientSecret != "" &&
		c.refreshToken != "" && c.customerId != ""
	return c, ok
}

// opsSyncAdsSpend refreshes ads_spend_daily from the Google Ads API when the
// stored rows are older than opsAdsSyncTTL. Callers run inside opsReportMutex,
// so a node never fires two syncs at once.
func opsSyncAdsSpend() {
	creds, ok := opsAdsCredsFromEnv()
	if !ok {
		return
	}
	lastSync, err := model.GetOpsAdsSpendLastUpdated()
	if err != nil {
		common.SysError("ops ads sync: freshness check failed: " + err.Error())
		return
	}
	if time.Since(time.Unix(lastSync, 0)) < opsAdsSyncTTL {
		return
	}
	rows, err := opsFetchAdsSpendDaily(creds)
	if err != nil {
		common.SysError("ops ads sync: " + err.Error())
		return
	}
	if err := model.UpsertAdsSpendDaily(rows); err != nil {
		common.SysError("ops ads sync: upsert failed: " + err.Error())
		return
	}
	common.SysLog(fmt.Sprintf("ops ads sync: upserted %d days", len(rows)))
}

type opsAdsTokenResponse struct {
	AccessToken string `json:"access_token"`
	Error       string `json:"error"`
	ErrorDesc   string `json:"error_description"`
}

func opsAdsAccessToken(creds opsAdsCreds, client *http.Client) (string, error) {
	form := url.Values{
		"grant_type":    {"refresh_token"},
		"client_id":     {creds.clientId},
		"client_secret": {creds.clientSecret},
		"refresh_token": {creds.refreshToken},
	}
	resp, err := client.PostForm("https://oauth2.googleapis.com/token", form)
	if err != nil {
		return "", fmt.Errorf("oauth token request: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	var tok opsAdsTokenResponse
	if err := common.Unmarshal(body, &tok); err != nil {
		return "", fmt.Errorf("oauth token response: %w", err)
	}
	if tok.AccessToken == "" {
		return "", fmt.Errorf("oauth token refresh failed (%d): %s %s", resp.StatusCode, tok.Error, tok.ErrorDesc)
	}
	return tok.AccessToken, nil
}

// GAQL search response subset. int64 metrics arrive as JSON strings.
type opsAdsSearchResponse struct {
	Results []struct {
		Segments struct {
			Date string `json:"date"`
		} `json:"segments"`
		Metrics struct {
			CostMicros  string  `json:"costMicros"`
			Clicks      string  `json:"clicks"`
			Impressions string  `json:"impressions"`
			Conversions float64 `json:"conversions"`
		} `json:"metrics"`
	} `json:"results"`
	NextPageToken string `json:"nextPageToken"`
}

// opsFetchAdsSpendDaily pulls flatkey-campaign daily totals for the last
// opsAdsSyncDays report-timezone days. The ads account is shared with other
// business lines (voc.ai, solvea.cx), so rows are filtered to flatkey-*
// campaigns and summed per day — this keeps the report's ads columns on the
// same scope as the registrations they sit next to (and as the 广告日报
// board). Google Ads segments.date is the ads account's timezone —
// America/New_York for this account — while the report buckets Pacific days,
// so rows join by date string with a 3-hour edge skew (spend between 9pm and
// midnight PT lands on the next date). Acceptable for day-level trend stats;
// exact alignment would need hourly segmentation.
func opsFetchAdsSpendDaily(creds opsAdsCreds) ([]*model.AdsSpendDaily, error) {
	client := &http.Client{Timeout: opsAdsHTTPTimeout}
	accessToken, err := opsAdsAccessToken(creds, client)
	if err != nil {
		return nil, err
	}
	end := time.Now().In(opsLoc)
	start := end.AddDate(0, 0, -(opsAdsSyncDays - 1))
	query := fmt.Sprintf(`SELECT segments.date, metrics.cost_micros, metrics.clicks,
		metrics.impressions, metrics.conversions
		FROM campaign WHERE campaign.name LIKE 'flatkey-%%'
		AND segments.date BETWEEN '%s' AND '%s'`,
		start.Format("2006-01-02"), end.Format("2006-01-02"))
	endpoint := fmt.Sprintf("https://googleads.googleapis.com/%s/customers/%s/googleAds:search",
		creds.apiVersion, creds.customerId)

	now := time.Now().Unix()
	// one result row per campaign per day — aggregate to day totals
	byDate := map[string]*model.AdsSpendDaily{}
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
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
		resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			msg := string(respBody)
			if len(msg) > 500 {
				msg = msg[:500]
			}
			return nil, fmt.Errorf("googleAds:search status %d: %s", resp.StatusCode, msg)
		}
		var page opsAdsSearchResponse
		if err := common.Unmarshal(respBody, &page); err != nil {
			return nil, fmt.Errorf("googleAds:search response: %w", err)
		}
		for _, r := range page.Results {
			if r.Segments.Date == "" {
				continue
			}
			row, ok := byDate[r.Segments.Date]
			if !ok {
				row = &model.AdsSpendDaily{Date: r.Segments.Date, UpdatedAt: now}
				byDate[r.Segments.Date] = row
			}
			costMicros, _ := strconv.ParseInt(r.Metrics.CostMicros, 10, 64)
			clicks, _ := strconv.Atoi(r.Metrics.Clicks)
			impressions, _ := strconv.Atoi(r.Metrics.Impressions)
			row.CostUSD += float64(costMicros) / 1e6
			row.Clicks += clicks
			row.Impressions += impressions
			row.Conversions += r.Metrics.Conversions
		}
		pageToken = page.NextPageToken
		if pageToken == "" {
			break
		}
	}
	// emit a row for every day in the window, zero-filled when no flatkey
	// campaign had activity — otherwise stale rows from before the flatkey
	// scoping (account-wide totals) would survive in ads_spend_daily on days
	// the filtered query no longer returns
	rows := make([]*model.AdsSpendDaily, 0, opsAdsSyncDays)
	for d := start; !d.After(end); d = d.AddDate(0, 0, 1) {
		date := d.Format("2006-01-02")
		row, ok := byDate[date]
		if !ok {
			row = &model.AdsSpendDaily{Date: date, UpdatedAt: now}
		}
		rows = append(rows, row)
	}
	return rows, nil
}
