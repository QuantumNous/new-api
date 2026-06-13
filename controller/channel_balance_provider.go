package controller

import (
	"bytes"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// 下游平台余额查询 provider —— 按 base_url / channel.Other hint 路由（不依赖 channel.Type），
// 与视频 provider 模式（relay/channel/task/openaivideo）同构。
// 调研结论与三档语义详见 docs/channel-balance-query.md。

// 余额可查性三档
const (
	BalanceKindBalance     = "balance"      // 真实剩余余额
	BalanceKindSpendOnly   = "spend_only"   // 仅累计消费（无限额度 key 查不到钱包余额）
	BalanceKindConsoleOnly = "console_only" // 仅 web 控制台可查
)

// new-api 无限额度令牌在 /v1/dashboard/billing/subscription 返回的哨兵额度
const newapiUnlimitedSentinel = 100000000.0

// new-api 内部 quota → USD 换算单位（common.QuotaPerUnit 同值，避免 import 循环风险这里直接取常量）
const newapiQuotaPerUnit = 500000.0

// BalanceQueryResult 余额查询统一结果
type BalanceQueryResult struct {
	Kind      string  `json:"kind"`                 // balance | spend_only | console_only
	Remaining float64 `json:"remaining"`            // 剩余（Kind=balance 时有效）
	Used      float64 `json:"used"`                 // 累计消费（尽量填）
	Unit      string  `json:"unit"`                 // USD | CNY | 算力 | credits
	ExpiresAt int64   `json:"expires_at,omitempty"` // 订阅到期（listenhub 等）
	Provider  string  `json:"provider"`             // 命中的 provider 名
}

type balanceProvider struct {
	name  string
	match func(ch *model.Channel) bool
	query func(ch *model.Channel) (*BalanceQueryResult, error)
}

var balanceProviders = []balanceProvider{
	{name: "lk888", match: matchLK888, query: queryLK888Balance},
	{name: "listenhub", match: matchListenHub, query: queryListenHubBalance},
	{name: "newapi", match: matchNewAPIStation, query: queryNewAPIStationBalance},
}

// resolveBalanceProvider 按渠道特征解析余额 provider；未命中返回 nil（由调用方退回 type switch）。
func resolveBalanceProvider(ch *model.Channel) *balanceProvider {
	if ch.GetSetting().BalanceQuery != nil && ch.GetSetting().BalanceQuery.Mode == "disabled" {
		return nil
	}
	for i := range balanceProviders {
		if balanceProviders[i].match(ch) {
			return &balanceProviders[i]
		}
	}
	return nil
}

// queryBalanceByProvider 尝试用 provider 查询余额；handled=false 表示未命中任何 provider。
func queryBalanceByProvider(ch *model.Channel) (result *BalanceQueryResult, handled bool, err error) {
	p := resolveBalanceProvider(ch)
	if p == nil {
		return nil, false, nil
	}
	result, err = p.query(ch)
	if err != nil {
		return nil, true, err
	}
	result.Provider = p.name
	storeBalanceResult(ch, result)
	return result, true, nil
}

// storeBalanceResult 把结果写回渠道：Balance 列存"可对外排序的数值"，明细存 OtherInfo。
func storeBalanceResult(ch *model.Channel, r *BalanceQueryResult) {
	display := r.Remaining
	if r.Kind == BalanceKindSpendOnly {
		// 拿不到钱包余额：若用户填了累计充值，估算剩余；否则用累计消费占位（保持为正，避免被余额<=0 自动禁用逻辑误伤）
		if rc := rechargedOf(ch); rc > 0 {
			display = rc - r.Used
		} else {
			display = r.Used
		}
	}
	ch.UpdateBalance(display)

	info := ch.GetOtherInfo()
	info["balance_kind"] = r.Kind
	info["balance_unit"] = r.Unit
	info["balance_used"] = r.Used
	info["balance_remaining"] = r.Remaining
	info["balance_provider"] = r.Provider
	info["balance_expires_at"] = r.ExpiresAt
	info["balance_checked_time"] = time.Now().Unix()
	ch.SetOtherInfo(info)
	_ = ch.SaveChannelInfo()
}

func rechargedOf(ch *model.Channel) float64 {
	if bq := ch.GetSetting().BalanceQuery; bq != nil {
		return bq.Recharged
	}
	return 0
}

// ---------------- 通用 HTTP 工具 ----------------

// balanceHTTPGet 发 GET 请求，返回 body 与状态码（不像 GetResponseBody 那样把非 200 当错误，
// 便于上层按状态码判断"该上游是否支持此接口"）。
func balanceHTTPGet(ch *model.Channel, url string, headers http.Header) ([]byte, int, error) {
	return balanceHTTPDo(ch, http.MethodGet, url, headers, nil)
}

func balanceHTTPDo(ch *model.Channel, method, url string, headers http.Header, body []byte) ([]byte, int, error) {
	var reqBody *bytes.Reader
	if body != nil {
		reqBody = bytes.NewReader(body)
	} else {
		reqBody = bytes.NewReader(nil)
	}
	req, err := http.NewRequest(method, url, reqBody)
	if err != nil {
		return nil, 0, err
	}
	for k := range headers {
		req.Header.Set(k, headers.Get(k))
	}
	client, err := service.NewProxyHttpClient(ch.GetSetting().Proxy)
	if err != nil {
		return nil, 0, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	respBody, err := readAllLimited(resp)
	if err != nil {
		return nil, resp.StatusCode, err
	}
	return respBody, resp.StatusCode, nil
}

func readAllLimited(resp *http.Response) ([]byte, error) {
	const max = 1 << 20 // 1MB 足够余额响应
	buf := make([]byte, 0, 4096)
	tmp := make([]byte, 4096)
	for {
		n, err := resp.Body.Read(tmp)
		if n > 0 {
			buf = append(buf, tmp[:n]...)
			if len(buf) > max {
				break
			}
		}
		if err != nil {
			break
		}
	}
	return buf, nil
}

// apiBaseOf 去掉 base_url 末尾的 /v1 后缀，得到站点根（控制台与 billing 接口都挂在站点根下）。
func apiBaseOf(base string) string {
	b := strings.TrimRight(base, "/")
	b = strings.TrimSuffix(b, "/v1")
	return strings.TrimRight(b, "/")
}

// ---------------- lk888（A 档：真实余额，单位算力） ----------------

func matchLK888(ch *model.Channel) bool {
	other := strings.ToLower(strings.TrimSpace(ch.Other))
	if other == "lk888" {
		return true
	}
	return strings.Contains(strings.ToLower(ch.GetBaseURL()), "lk888")
}

func queryLK888Balance(ch *model.Channel) (*BalanceQueryResult, error) {
	// lk888 的 base_url 已含 /api，余额接口为 {base}/v1/skills/balance
	url := fmt.Sprintf("%s/v1/skills/balance", strings.TrimRight(ch.GetBaseURL(), "/"))
	body, status, err := balanceHTTPGet(ch, url, GetAuthHeader(ch.Key))
	if err != nil {
		return nil, err
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("lk888 余额接口返回状态码 %d: %s", status, snippet(body))
	}
	var resp struct {
		Balance     float64 `json:"balance"`
		Unit        string  `json:"unit"`
		APIKeyQuota struct {
			Limit float64 `json:"limit"`
			Used  float64 `json:"used"`
		} `json:"api_key_quota"`
	}
	if err := common.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("lk888 余额响应解析失败: %v (%s)", err, snippet(body))
	}
	unit := resp.Unit
	if unit == "" {
		unit = "算力"
	}
	return &BalanceQueryResult{
		Kind:      BalanceKindBalance,
		Remaining: resp.Balance,
		Used:      resp.APIKeyQuota.Used,
		Unit:      unit,
	}, nil
}

// ---------------- listenhub / marswave（A 档：真实余额，单位 credits） ----------------

func matchListenHub(ch *model.Channel) bool {
	if ch.Type == constant.ChannelTypeListenHub {
		return true
	}
	other := strings.ToLower(strings.TrimSpace(ch.Other))
	if other == "listenhub" || other == "marswave" {
		return true
	}
	return strings.Contains(strings.ToLower(ch.GetBaseURL()), "marswave.ai")
}

func queryListenHubBalance(ch *model.Channel) (*BalanceQueryResult, error) {
	// base_url 为 https://api.marswave.ai/openapi，余额接口为 {base}/v1/user/subscription
	url := fmt.Sprintf("%s/v1/user/subscription", strings.TrimRight(ch.GetBaseURL(), "/"))
	body, status, err := balanceHTTPGet(ch, url, GetAuthHeader(ch.Key))
	if err != nil {
		return nil, err
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("listenhub 余额接口返回状态码 %d: %s", status, snippet(body))
	}
	var resp struct {
		Code int `json:"code"`
		Data struct {
			TotalAvailableCredits float64 `json:"totalAvailableCredits"`
			SubscriptionExpiresAt int64   `json:"subscriptionExpiresAt"`
		} `json:"data"`
		Message string `json:"message"`
	}
	if err := common.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("listenhub 余额响应解析失败: %v (%s)", err, snippet(body))
	}
	if resp.Code != 0 {
		return nil, fmt.Errorf("listenhub 余额接口返回 code=%d message=%s", resp.Code, resp.Message)
	}
	return &BalanceQueryResult{
		Kind:      BalanceKindBalance,
		Remaining: resp.Data.TotalAvailableCredits,
		Unit:      "credits",
		ExpiresAt: resp.Data.SubscriptionExpiresAt / 1000, // 毫秒→秒
	}, nil
}

// ---------------- new-api 套壳站（B 档 spend_only / 登录态 balance） ----------------

// matchNewAPIStation 匹配 new-api/one-api 套壳中转站：
//   - 显式配了 BalanceQuery（console/system_token/auto）；或
//   - 渠道是中转常见类型（OpenAI / Custom / Gemini / OpenAI Video）且配了 base_url。
//
// 这样不靠厂商域名硬编码即可覆盖 bltcy/apexer/xgapi/qilin/manxiaobai；
// 非 new-api 上游（如 hongniao）billing 接口会 404，query 优雅降级为 console_only。
func matchNewAPIStation(ch *model.Channel) bool {
	if bq := ch.GetSetting().BalanceQuery; bq != nil && bq.Mode != "" && bq.Mode != "auto" {
		return true
	}
	if ch.GetBaseURL() == "" {
		return false
	}
	switch ch.Type {
	case constant.ChannelTypeOpenAI, constant.ChannelTypeCustom,
		constant.ChannelTypeGemini, constant.ChannelTypeOpenAIVideo:
		return true
	}
	return false
}

func queryNewAPIStationBalance(ch *model.Channel) (*BalanceQueryResult, error) {
	// 配了登录凭据 → 走登录态拿真实钱包余额
	if bq := ch.GetSetting().BalanceQuery; bq != nil {
		switch bq.Mode {
		case "newapi_console":
			return queryNewAPIConsoleBalance(ch, bq.Username, bq.Password)
		case "system_token":
			return nil, fmt.Errorf("system_token 模式暂未实现，请使用 newapi_console（账密）")
		}
	}
	// 否则仅凭 API key：只能拿累计消费
	return queryNewAPISpend(ch)
}

// queryNewAPISpend 仅凭 API key 查 /v1/dashboard/billing/subscription + usage。
// 无限额度令牌 → spend_only（只报累计消费）；正常额度 → balance（hardLimit - used）。
func queryNewAPISpend(ch *model.Channel) (*BalanceQueryResult, error) {
	apiBase := apiBaseOf(ch.GetBaseURL())
	subBody, status, err := balanceHTTPGet(ch, apiBase+"/v1/dashboard/billing/subscription", GetAuthHeader(ch.Key))
	if err != nil {
		return nil, err
	}
	if status == http.StatusNotFound {
		return &BalanceQueryResult{Kind: BalanceKindConsoleOnly, Unit: "USD"}, nil
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("billing/subscription 返回状态码 %d: %s", status, snippet(subBody))
	}
	var sub OpenAISubscriptionResponse
	if err := common.Unmarshal(subBody, &sub); err != nil || sub.Object != "billing_subscription" {
		// 不是 new-api billing 结构（如 hongniao 用 200 返回 {"code":"404"} 错误体或 SPA HTML）→ 仅控制台可查
		return &BalanceQueryResult{Kind: BalanceKindConsoleOnly, Unit: "USD"}, nil
	}

	// 拉累计消费
	now := time.Now()
	startDate := fmt.Sprintf("%s-01", now.Format("2006-01"))
	endDate := now.Format("2006-01-02")
	if !sub.HasPaymentMethod {
		startDate = now.AddDate(0, 0, -100).Format("2006-01-02")
	}
	usageURL := fmt.Sprintf("%s/v1/dashboard/billing/usage?start_date=%s&end_date=%s", apiBase, startDate, endDate)
	usageBody, _, err := balanceHTTPGet(ch, usageURL, GetAuthHeader(ch.Key))
	if err != nil {
		return nil, err
	}
	var usage OpenAIUsageResponse
	_ = common.Unmarshal(usageBody, &usage)
	used := usage.TotalUsage / 100 // total_usage 单位 0.01 USD

	if sub.HardLimitUSD >= newapiUnlimitedSentinel {
		// 无限额度令牌：钱包余额查不到，只能报累计消费
		return &BalanceQueryResult{Kind: BalanceKindSpendOnly, Used: used, Unit: "USD"}, nil
	}
	return &BalanceQueryResult{
		Kind:      BalanceKindBalance,
		Remaining: sub.HardLimitUSD - used,
		Used:      used,
		Unit:      "USD",
	}, nil
}

// queryNewAPIConsoleBalance 用账密登录 new-api 套壳站控制台，再查 /api/user/self 拿真实钱包余额。
func queryNewAPIConsoleBalance(ch *model.Channel, username, password string) (*BalanceQueryResult, error) {
	if username == "" || password == "" {
		return nil, fmt.Errorf("newapi_console 模式需要配置 username 和 password")
	}
	apiBase := apiBaseOf(ch.GetBaseURL())

	loginBody, _ := common.Marshal(map[string]string{"username": username, "password": password})
	headers := http.Header{}
	headers.Set("Content-Type", "application/json")
	respBody, status, err := balanceHTTPDo(ch, http.MethodPost, apiBase+"/api/user/login", headers, loginBody)
	if err != nil {
		return nil, err
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("登录 %s 失败，状态码 %d: %s", apiBase, status, snippet(respBody))
	}
	// 解析登录响应拿 user id（/api/user/self 需要 New-Api-User 头）
	var login struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
		Data    struct {
			Id int `json:"id"`
		} `json:"data"`
	}
	if err := common.Unmarshal(respBody, &login); err != nil {
		return nil, fmt.Errorf("登录响应解析失败: %v (%s)", err, snippet(respBody))
	}
	if !login.Success {
		return nil, fmt.Errorf("登录失败: %s", login.Message)
	}

	// 需要把登录返回的 session cookie 带到 /api/user/self
	// balanceHTTPDo 用的是共享 client（无 cookie jar），这里单独发一次带 cookie 的请求。
	cookie, err := loginSessionCookie(ch, apiBase, loginBody)
	if err != nil {
		return nil, err
	}
	selfHeaders := http.Header{}
	selfHeaders.Set("New-Api-User", fmt.Sprintf("%d", login.Data.Id))
	if cookie != "" {
		selfHeaders.Set("Cookie", cookie)
	}
	selfBody, selfStatus, err := balanceHTTPGet(ch, apiBase+"/api/user/self", selfHeaders)
	if err != nil {
		return nil, err
	}
	if selfStatus != http.StatusOK {
		return nil, fmt.Errorf("/api/user/self 返回状态码 %d: %s", selfStatus, snippet(selfBody))
	}
	var self struct {
		Success bool `json:"success"`
		Data    struct {
			Quota     int64 `json:"quota"`
			UsedQuota int64 `json:"used_quota"`
		} `json:"data"`
		Message string `json:"message"`
	}
	if err := common.Unmarshal(selfBody, &self); err != nil {
		return nil, fmt.Errorf("/api/user/self 解析失败: %v (%s)", err, snippet(selfBody))
	}
	if !self.Success {
		return nil, fmt.Errorf("/api/user/self 失败: %s", self.Message)
	}
	return &BalanceQueryResult{
		Kind:      BalanceKindBalance,
		Remaining: float64(self.Data.Quota) / newapiQuotaPerUnit,
		Used:      float64(self.Data.UsedQuota) / newapiQuotaPerUnit,
		Unit:      "USD",
	}, nil
}

// loginSessionCookie 发一次登录请求并从 Set-Cookie 提取会话 cookie。
func loginSessionCookie(ch *model.Channel, apiBase string, loginBody []byte) (string, error) {
	req, err := http.NewRequest(http.MethodPost, apiBase+"/api/user/login", bytes.NewReader(loginBody))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	client, err := service.NewProxyHttpClient(ch.GetSetting().Proxy)
	if err != nil {
		return "", err
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var parts []string
	for _, c := range resp.Cookies() {
		parts = append(parts, c.Name+"="+c.Value)
	}
	return strings.Join(parts, "; "), nil
}

// ---------------- 余额总览聚合接口 ----------------

// ChannelBalanceOverviewItem 一个上游账号（按 base_url+key 去重）的余额概览
type ChannelBalanceOverviewItem struct {
	BaseURL      string   `json:"base_url"`
	ChannelIds   []int    `json:"channel_ids"`
	ChannelNames []string `json:"channel_names"`
	Provider     string   `json:"provider,omitempty"`
	Kind         string   `json:"kind"` // balance | spend_only | console_only | unknown
	Remaining    float64  `json:"remaining"`
	Used         float64  `json:"used"`
	Unit         string   `json:"unit"`
	ExpiresAt    int64    `json:"expires_at,omitempty"`
	Recharged    float64  `json:"recharged,omitempty"`
	EstRemaining *float64 `json:"est_remaining,omitempty"` // spend_only 档：recharged - used
	CheckedTime  int64    `json:"checked_time"`
	Error        string   `json:"error,omitempty"`
}

// GetChannelBalanceOverview 一次性查出所有下游平台余额（按 base_url+key 去重，避免同账号多渠道重复查询）。
// GET /api/channel/balance_overview
//
//	?cached=true   只读已存储的余额（不发起上游请求，秒回）
//	?include_disabled=true  连同已禁用渠道一起查（默认仅启用）
func GetChannelBalanceOverview(c *gin.Context) {
	cached := c.Query("cached") == "true"
	includeDisabled := c.Query("include_disabled") == "true"

	channels, err := model.GetAllChannels(0, 0, true, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	type group struct {
		rep   *model.Channel
		ids   []int
		names []string
	}
	groups := make(map[string]*group)
	var order []string
	for _, ch := range channels {
		if ch.ChannelInfo.IsMultiKey {
			continue // 多密钥渠道不支持余额查询
		}
		if !includeDisabled && ch.Status != common.ChannelStatusEnabled {
			continue
		}
		dedupKey := ch.GetBaseURL() + "\x00" + ch.Key
		g, ok := groups[dedupKey]
		if !ok {
			g = &group{rep: ch}
			groups[dedupKey] = g
			order = append(order, dedupKey)
		}
		g.ids = append(g.ids, ch.Id)
		g.names = append(g.names, ch.Name)
	}

	items := make([]ChannelBalanceOverviewItem, 0, len(order))
	for _, k := range order {
		g := groups[k]
		item := ChannelBalanceOverviewItem{
			BaseURL:      g.rep.GetBaseURL(),
			ChannelIds:   g.ids,
			ChannelNames: g.names,
			Recharged:    rechargedOf(g.rep),
		}
		if !cached {
			if _, qErr := updateChannelBalance(g.rep); qErr != nil {
				item.Error = qErr.Error()
			}
		}
		fillOverviewFromChannel(&item, g.rep)
		items = append(items, item)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    items,
	})
}

// fillOverviewFromChannel 从渠道存储的余额元数据（OtherInfo）填充概览项。
// provider 路径会写入 balance_* 元数据；type switch 路径只更新 Balance 列，此处兜底为 balance/USD。
func fillOverviewFromChannel(item *ChannelBalanceOverviewItem, ch *model.Channel) {
	info := ch.GetOtherInfo()
	kind, _ := info["balance_kind"].(string)
	if kind == "" {
		// 未经 provider（如 siliconflow/deepseek 等 type switch 渠道）：以 Balance 列为剩余余额
		item.Kind = BalanceKindBalance
		item.Remaining = ch.Balance
		item.Unit = "USD"
		item.CheckedTime = ch.BalanceUpdatedTime
		if item.Error == "" && ch.BalanceUpdatedTime == 0 {
			item.Kind = "unknown"
		}
		return
	}
	item.Kind = kind
	item.Provider, _ = info["balance_provider"].(string)
	item.Unit, _ = info["balance_unit"].(string)
	item.Remaining = otherInfoFloat(info, "balance_remaining")
	item.Used = otherInfoFloat(info, "balance_used")
	item.ExpiresAt = int64(otherInfoFloat(info, "balance_expires_at"))
	item.CheckedTime = int64(otherInfoFloat(info, "balance_checked_time"))
	if kind == BalanceKindSpendOnly && item.Recharged > 0 {
		est := item.Recharged - item.Used
		item.EstRemaining = &est
	}
}

func otherInfoFloat(info map[string]interface{}, key string) float64 {
	switch v := info[key].(type) {
	case float64:
		return v
	case int64:
		return float64(v)
	case int:
		return float64(v)
	}
	return 0
}

func snippet(b []byte) string {
	s := strings.TrimSpace(string(b))
	if len(s) > 160 {
		return s[:160]
	}
	return s
}
