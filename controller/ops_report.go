package controller

import (
	"net/http"
	"net/netip"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/phuslu/iploc"
)

// Ops daily report: PLG registration / activation / payment funnel for the
// admin console (管理员 → 运营日报).
//
// Metric definitions (mirrors the offline analysis that shaped them):
//   - real browse:  playground chats excluding the auto-fired onboarding
//     request (signup flow fires one call within seconds of registration);
//     approximated as playground_count >= 2 OR first chat >= 60s after signup.
//   - manual key:   token created >= 120s after registration (earlier ones are
//     auto-provisioned by signup integrations: main-key/auto/default).
//   - key used:     any API-key request (token_id > 0), auto keys included.
//   - paid:         top_ups status = success.
//
// The report is a full recompute over ~thousands of plg users and their log
// aggregates; results are cached per node for opsReportCacheTTL. The cache is
// node-local by design (Rule 11): the data is read-only statistics, so brief
// cross-node divergence is harmless.

const (
	opsReportCacheTTL    = 10 * time.Minute
	opsAutoBrowseWindow  = 60  // seconds after signup treated as auto-fired playground call
	opsAutoTokenWindow   = 120 // seconds after signup treated as auto-provisioned token
	opsReportTopPayers   = 20
	opsReportMaxDays     = 180
	opsReportDefaultDays = 30
)

type opsFunnelRow struct {
	Key           string  `json:"key"`
	Registrations int     `json:"registrations"`
	RealBrowse    int     `json:"real_browse"`
	ManualKeys    int     `json:"manual_keys"`
	KeyUsers      int     `json:"key_users"`
	PayIntent     int     `json:"pay_intent"`
	Paid          int     `json:"paid"`
	PaidUSD       float64 `json:"paid_usd"`
}

type opsNameCount struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

type opsCampaignRow struct {
	opsFunnelRow
	Keywords     []string       `json:"keywords"`
	Languages    []string       `json:"languages"`
	LandingPages []opsNameCount `json:"landing_pages"`
	MatchTypes   []opsNameCount `json:"match_types"`
	Trend        []int          `json:"trend"`
}

type opsKeywordRow struct {
	opsFunnelRow
	Campaigns []string `json:"campaigns"`
}

type opsDauRow struct {
	Date        string  `json:"date"`
	ActiveUsers int     `json:"active_users"`
	Requests    int     `json:"requests"`
	QuotaUSD    float64 `json:"quota_usd"`
}

type opsPayerRow struct {
	UserId       int      `json:"user_id"`
	Username     string   `json:"username"`
	DisplayName  string   `json:"display_name"`
	Email        string   `json:"email"`
	PaidUSD      float64  `json:"paid_usd"`
	Orders       int      `json:"orders"`
	FirstPaidAt  int64    `json:"first_paid_at"`
	RegisteredAt int64    `json:"registered_at"`
	Campaign     string   `json:"campaign"`
	Keyword      string   `json:"keyword"`
	Lng          string   `json:"lng"`
	Landing      string   `json:"landing"`
	SignupMethod string   `json:"signup_method"`
	Currencies   []string `json:"currencies"`
	LastIP       string   `json:"last_ip"`
	IPCountry    string   `json:"ip_country"`
	BalanceUSD   float64  `json:"balance_usd"`
	ConsumedUSD  float64  `json:"consumed_usd"`
	Requests     int      `json:"requests"`
	LastActiveAt int64    `json:"last_active_at"`
	TopModels    []string `json:"top_models"`
}

type opsPaymentRow struct {
	Key       string  `json:"key"`
	Intent    int     `json:"intent"`
	Unpaid    int     `json:"unpaid"`
	First     int     `json:"first"`
	FirstUSD  float64 `json:"first_usd"`
	Repeat    int     `json:"repeat"`
	RepeatUSD float64 `json:"repeat_usd"`
}

type opsReportData struct {
	GeneratedAt    int64            `json:"generated_at"`
	Days           int              `json:"days"`
	DauScope       string           `json:"dau_scope"`
	Daily          []opsFunnelRow   `json:"daily"`
	WeeklyFunnel   []opsFunnelRow   `json:"weekly_funnel"`
	CampaignFunnel []opsCampaignRow `json:"campaign_funnel"`
	KeywordFunnel  []opsKeywordRow  `json:"keyword_funnel"`
	PaymentWeekly  []opsPaymentRow  `json:"payment_weekly"`
	Dau            []opsDauRow      `json:"dau"`
	TotalPaidUsers int              `json:"total_paid_users"`
	TotalPaidUSD   float64          `json:"total_paid_usd"`
	TopPayers      []opsPayerRow    `json:"top_payers"`
}

var (
	opsReportCache   *opsReportData
	opsReportCacheAt time.Time
	opsReportMutex   sync.Mutex
)

// GetOpsReport handles GET /api/ops_report?days=N&dau_scope=plg|all (admin only).
func GetOpsReport(c *gin.Context) {
	days, _ := strconv.Atoi(c.Query("days"))
	if days <= 0 {
		days = opsReportDefaultDays
	}
	if days > opsReportMaxDays {
		days = opsReportMaxDays
	}
	dauScope := c.Query("dau_scope")
	if dauScope != "all" {
		dauScope = "plg"
	}

	opsReportMutex.Lock()
	defer opsReportMutex.Unlock()
	if opsReportCache != nil && opsReportCache.Days == days &&
		opsReportCache.DauScope == dauScope &&
		time.Since(opsReportCacheAt) < opsReportCacheTTL {
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": opsReportCache})
		return
	}

	report, err := buildOpsReport(days, dauScope)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	opsReportCache = report
	opsReportCacheAt = time.Now()
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": report})
}

type opsUserAgg struct {
	user       *model.OpsPlgUser
	logStats   *model.OpsUserLogStats
	tokenStats *model.OpsUserTokenStats
	campaign   string
	keyword    string
	lng        string
	landing    string
	referrer   string
	matchType  string
	paidOrders []*model.OpsTopUp
	hasIntent  bool
}

// opsIPCountry resolves an IP to an ISO country code via the embedded iploc
// database; private/unparseable addresses map to "?".
func opsIPCountry(ip string) string {
	if ip == "" {
		return "?"
	}
	addr, err := netip.ParseAddr(ip)
	if err != nil {
		return "?"
	}
	country := iploc.IPCountry(addr)
	if country == "" || country == "ZZ" {
		return "?"
	}
	return country
}

func buildOpsReport(days int, dauScope string) (*opsReportData, error) {
	users, err := model.GetOpsPlgUsers()
	if err != nil {
		return nil, err
	}
	ids := make([]int, 0, len(users))
	aggs := make(map[int]*opsUserAgg, len(users))
	for _, u := range users {
		ids = append(ids, u.Id)
		agg := &opsUserAgg{user: u}
		parseOpsAttribution(agg)
		aggs[u.Id] = agg
	}

	logStats, err := model.GetOpsUserLogStats(ids)
	if err != nil {
		return nil, err
	}
	for _, s := range logStats {
		if a, ok := aggs[s.UserId]; ok {
			a.logStats = s
		}
	}

	tokenStats, err := model.GetOpsUserTokenStats(opsAutoTokenWindow)
	if err != nil {
		return nil, err
	}
	for _, s := range tokenStats {
		if a, ok := aggs[s.UserId]; ok {
			a.tokenStats = s
		}
	}

	topUps, err := model.GetOpsTopUps()
	if err != nil {
		return nil, err
	}
	for _, t := range topUps {
		a, ok := aggs[t.UserId]
		if !ok {
			continue
		}
		a.hasIntent = true
		if t.Status == common.TopUpStatusSuccess {
			a.paidOrders = append(a.paidOrders, t)
		}
	}

	now := time.Now().Unix()
	startTs := (now/86400)*86400 - int64(days-1)*86400

	report := &opsReportData{GeneratedAt: now, Days: days, DauScope: dauScope}
	if dauScope == "all" {
		allDaily, err := model.GetOpsAllKeyDailyUsage(startTs)
		if err != nil {
			return nil, err
		}
		report.Dau = opsRollupDauDays(allDaily, days, startTs)
	} else {
		keyDaily, err := model.GetOpsKeyDailyUsage(ids, startTs)
		if err != nil {
			return nil, err
		}
		report.Dau = opsRollupDau(keyDaily, days, startTs)
	}
	report.Daily = opsRollupFunnel(aggs, func(a *opsUserAgg) string {
		if a.user.CreatedAt < startTs {
			return ""
		}
		return opsDay(a.user.CreatedAt)
	}, true)
	report.WeeklyFunnel = opsRollupFunnel(aggs, func(a *opsUserAgg) string {
		return opsWeek(a.user.CreatedAt)
	}, true)
	campaignRows := opsRollupFunnel(aggs, func(a *opsUserAgg) string {
		return a.campaign
	}, false)
	report.CampaignFunnel = opsEnrichCampaigns(campaignRows, aggs, startTs, days)
	report.KeywordFunnel = opsRollupKeywords(aggs, 50)
	report.PaymentWeekly = opsRollupPayment(aggs)
	report.TopPayers, report.TotalPaidUsers, report.TotalPaidUSD = opsTopPayers(aggs)
	return report, nil
}

func parseOpsAttribution(a *opsUserAgg) {
	a.campaign = "(organic)"
	if a.user.AdsAttribution == "" {
		return
	}
	var attr map[string]interface{}
	if err := common.UnmarshalJsonStr(a.user.AdsAttribution, &attr); err != nil {
		return
	}
	str := func(k string) string {
		if v, ok := attr[k].(string); ok {
			return v
		}
		return ""
	}
	if v := str("utm_campaign"); v != "" {
		a.campaign = v
	} else if v := str("utm_source"); v != "" {
		a.campaign = v
	}
	a.keyword = str("hsa_kw")
	if a.keyword == "" {
		a.keyword = str("utm_term")
	}
	a.lng = str("lng")
	a.landing = str("landing_path")
	a.referrer = str("referrer")
	a.matchType = str("hsa_mt")
}

func (a *opsUserAgg) realBrowse() bool {
	s := a.logStats
	if s == nil || s.PlaygroundCount == 0 {
		return false
	}
	return s.PlaygroundCount >= 2 ||
		s.FirstPlaygroundAt >= a.user.CreatedAt+opsAutoBrowseWindow
}

func (a *opsUserAgg) usedKey() bool {
	return a.logStats != nil && a.logStats.ApiKeyCount > 0
}

func (a *opsUserAgg) manualKey() bool {
	return a.tokenStats != nil && a.tokenStats.ManualTokenCount > 0
}

func (a *opsUserAgg) paidUSD() float64 {
	total := 0.0
	for _, t := range a.paidOrders {
		total += t.Money
	}
	return total
}

func opsDay(ts int64) string {
	return time.Unix(ts, 0).UTC().Format("2006-01-02")
}

func opsWeek(ts int64) string {
	t := time.Unix(ts, 0).UTC()
	monday := t.AddDate(0, 0, -(int(t.Weekday())+6)%7)
	return monday.Format("2006-01-02")
}

func opsRollupFunnel(aggs map[int]*opsUserAgg, keyFn func(*opsUserAgg) string, sortDesc bool) []opsFunnelRow {
	groups := map[string]*opsFunnelRow{}
	for _, a := range aggs {
		key := keyFn(a)
		if key == "" {
			continue
		}
		row, ok := groups[key]
		if !ok {
			row = &opsFunnelRow{Key: key}
			groups[key] = row
		}
		row.Registrations++
		if a.realBrowse() {
			row.RealBrowse++
		}
		if a.manualKey() {
			row.ManualKeys++
		}
		if a.usedKey() {
			row.KeyUsers++
		}
		if a.hasIntent {
			row.PayIntent++
		}
		if len(a.paidOrders) > 0 {
			row.Paid++
			row.PaidUSD += a.paidUSD()
		}
	}
	rows := make([]opsFunnelRow, 0, len(groups))
	for _, row := range groups {
		rows = append(rows, *row)
	}
	sort.Slice(rows, func(i, j int) bool {
		if sortDesc {
			return rows[i].Key > rows[j].Key
		}
		return rows[i].Key < rows[j].Key
	})
	return rows
}

func opsSortedCounts(m map[string]int, n int) []opsNameCount {
	list := make([]opsNameCount, 0, len(m))
	for k, v := range m {
		list = append(list, opsNameCount{Name: k, Count: v})
	}
	sort.Slice(list, func(i, j int) bool {
		if list[i].Count != list[j].Count {
			return list[i].Count > list[j].Count
		}
		return list[i].Name < list[j].Name
	})
	if len(list) > n {
		list = list[:n]
	}
	return list
}

func opsTopNames(m map[string]int, n int) []string {
	counts := opsSortedCounts(m, n)
	out := make([]string, len(counts))
	for i, item := range counts {
		out[i] = item.Name
	}
	return out
}

func opsEnrichCampaigns(rows []opsFunnelRow, aggs map[int]*opsUserAgg, startTs int64, days int) []opsCampaignRow {
	type extras struct {
		keywords, languages, landings, matchTypes map[string]int
		trend                                     []int
	}
	byCampaign := map[string]*extras{}
	for _, a := range aggs {
		e, ok := byCampaign[a.campaign]
		if !ok {
			e = &extras{
				keywords: map[string]int{}, languages: map[string]int{},
				landings: map[string]int{}, matchTypes: map[string]int{},
				trend: make([]int, days),
			}
			byCampaign[a.campaign] = e
		}
		if a.keyword != "" {
			e.keywords[a.keyword]++
		}
		if a.lng != "" {
			e.languages[a.lng]++
		}
		if a.landing != "" {
			e.landings[a.landing]++
		}
		if a.matchType != "" {
			e.matchTypes[a.matchType]++
		}
		if idx := (a.user.CreatedAt - startTs) / 86400; idx >= 0 && idx < int64(days) {
			e.trend[idx]++
		}
	}
	result := make([]opsCampaignRow, 0, len(rows))
	for _, row := range rows {
		cr := opsCampaignRow{opsFunnelRow: row}
		if e, ok := byCampaign[row.Key]; ok {
			cr.Keywords = opsTopNames(e.keywords, 5)
			cr.Languages = opsTopNames(e.languages, 3)
			cr.LandingPages = opsSortedCounts(e.landings, 3)
			cr.MatchTypes = opsSortedCounts(e.matchTypes, 3)
			cr.Trend = e.trend
		}
		result = append(result, cr)
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].Registrations > result[j].Registrations
	})
	return result
}

// opsRollupKeywords builds a per-search-term funnel (keyword = hsa_kw or
// utm_term) across all campaigns, sorted by registrations.
func opsRollupKeywords(aggs map[int]*opsUserAgg, limit int) []opsKeywordRow {
	type kwAcc struct {
		row       opsFunnelRow
		campaigns map[string]int
	}
	groups := map[string]*kwAcc{}
	for _, a := range aggs {
		if a.keyword == "" {
			continue
		}
		acc, ok := groups[a.keyword]
		if !ok {
			acc = &kwAcc{row: opsFunnelRow{Key: a.keyword}, campaigns: map[string]int{}}
			groups[a.keyword] = acc
		}
		acc.campaigns[a.campaign]++
		acc.row.Registrations++
		if a.realBrowse() {
			acc.row.RealBrowse++
		}
		if a.manualKey() {
			acc.row.ManualKeys++
		}
		if a.usedKey() {
			acc.row.KeyUsers++
		}
		if a.hasIntent {
			acc.row.PayIntent++
		}
		if len(a.paidOrders) > 0 {
			acc.row.Paid++
			acc.row.PaidUSD += a.paidUSD()
		}
	}
	rows := make([]opsKeywordRow, 0, len(groups))
	for _, acc := range groups {
		rows = append(rows, opsKeywordRow{
			opsFunnelRow: acc.row,
			Campaigns:    opsTopNames(acc.campaigns, 3),
		})
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].Registrations != rows[j].Registrations {
			return rows[i].Registrations > rows[j].Registrations
		}
		return rows[i].Key < rows[j].Key
	})
	if len(rows) > limit {
		rows = rows[:limit]
	}
	return rows
}

func opsRollupPayment(aggs map[int]*opsUserAgg) []opsPaymentRow {
	groups := map[string]*opsPaymentRow{}
	for _, a := range aggs {
		if !a.hasIntent {
			continue
		}
		key := opsWeek(a.user.CreatedAt)
		row, ok := groups[key]
		if !ok {
			row = &opsPaymentRow{Key: key}
			groups[key] = row
		}
		row.Intent++
		if len(a.paidOrders) == 0 {
			row.Unpaid++
			continue
		}
		row.First++
		row.FirstUSD += a.paidOrders[0].Money
		if len(a.paidOrders) > 1 {
			row.Repeat++
			for _, t := range a.paidOrders[1:] {
				row.RepeatUSD += t.Money
			}
		}
	}
	rows := make([]opsPaymentRow, 0, len(groups))
	for _, row := range groups {
		rows = append(rows, *row)
	}
	sort.Slice(rows, func(i, j int) bool { return rows[i].Key > rows[j].Key })
	return rows
}

func opsRollupDau(keyDaily []*model.OpsKeyDaily, days int, startTs int64) []opsDauRow {
	type acc struct {
		users    map[int]bool
		requests int
		quota    int64
	}
	byDay := map[int64]*acc{}
	for _, r := range keyDaily {
		a, ok := byDay[r.DayTs]
		if !ok {
			a = &acc{users: map[int]bool{}}
			byDay[r.DayTs] = a
		}
		a.users[r.UserId] = true
		a.requests += r.ReqCount
		a.quota += r.Quota
	}
	rows := make([]opsDauRow, 0, days)
	for i := days - 1; i >= 0; i-- {
		ts := startTs + int64(i)*86400
		row := opsDauRow{Date: opsDay(ts)}
		if a, ok := byDay[ts]; ok {
			row.ActiveUsers = len(a.users)
			row.Requests = a.requests
			row.QuotaUSD = float64(a.quota) / common.QuotaPerUnit
		}
		rows = append(rows, row)
	}
	return rows
}

func opsRollupDauDays(days []*model.OpsDauDay, n int, startTs int64) []opsDauRow {
	byDay := map[int64]*model.OpsDauDay{}
	for _, d := range days {
		byDay[d.DayTs] = d
	}
	rows := make([]opsDauRow, 0, n)
	for i := n - 1; i >= 0; i-- {
		ts := startTs + int64(i)*86400
		row := opsDauRow{Date: opsDay(ts)}
		if d, ok := byDay[ts]; ok {
			row.ActiveUsers = d.ActiveUsers
			row.Requests = d.ReqCount
			row.QuotaUSD = float64(d.Quota) / common.QuotaPerUnit
		}
		rows = append(rows, row)
	}
	return rows
}

func opsTopPayers(aggs map[int]*opsUserAgg) ([]opsPayerRow, int, float64) {
	var payers []opsPayerRow
	total := 0.0
	for _, a := range aggs {
		if len(a.paidOrders) == 0 {
			continue
		}
		paid := a.paidUSD()
		total += paid
		currencySet := map[string]bool{}
		var currencies []string
		for _, t := range a.paidOrders {
			ccy := strings.ToUpper(t.PaymentCurrency)
			if ccy == "" {
				ccy = "USD"
			}
			if !currencySet[ccy] {
				currencySet[ccy] = true
				currencies = append(currencies, ccy)
			}
		}
		lastActive := a.user.LastLoginAt
		if a.logStats != nil && a.logStats.LastRequestAt > lastActive {
			lastActive = a.logStats.LastRequestAt
		}
		payers = append(payers, opsPayerRow{
			UserId:       a.user.Id,
			Username:     a.user.Username,
			DisplayName:  a.user.DisplayName,
			Email:        a.user.Email,
			PaidUSD:      paid,
			Orders:       len(a.paidOrders),
			FirstPaidAt:  a.paidOrders[0].CreateTime,
			RegisteredAt: a.user.CreatedAt,
			Campaign:     a.campaign,
			Keyword:      a.keyword,
			Lng:          a.lng,
			Landing:      a.landing,
			SignupMethod: a.user.OauthKind,
			Currencies:   currencies,
			BalanceUSD:   float64(a.user.Quota) / common.QuotaPerUnit,
			ConsumedUSD:  float64(a.user.UsedQuota) / common.QuotaPerUnit,
			Requests:     a.user.RequestCount,
			LastActiveAt: lastActive,
		})
	}
	count := len(payers)
	sort.Slice(payers, func(i, j int) bool { return payers[i].PaidUSD > payers[j].PaidUSD })
	if len(payers) > opsReportTopPayers {
		payers = payers[:opsReportTopPayers]
	}
	// last IP / country resolved only for the displayed payers (<= 20 ids)
	ids := make([]int, len(payers))
	for i := range payers {
		ids[i] = payers[i].UserId
	}
	if ips, err := model.GetOpsUsersLastIP(ids); err == nil {
		byUser := map[int]string{}
		for _, r := range ips {
			byUser[r.UserId] = r.Ip
		}
		for i := range payers {
			payers[i].LastIP = byUser[payers[i].UserId]
			payers[i].IPCountry = opsIPCountry(payers[i].LastIP)
		}
	}
	if usage, err := model.GetOpsUsersModelUsage(ids); err == nil {
		type mc struct {
			name  string
			count int
		}
		byUser := map[int][]mc{}
		for _, r := range usage {
			byUser[r.UserId] = append(byUser[r.UserId], mc{r.ModelName, r.Count})
		}
		for i := range payers {
			models := byUser[payers[i].UserId]
			sort.Slice(models, func(x, y int) bool { return models[x].count > models[y].count })
			if len(models) > 3 {
				models = models[:3]
			}
			names := make([]string, len(models))
			for j, m := range models {
				names[j] = m.name
			}
			payers[i].TopModels = names
		}
	}
	return payers, count, total
}
