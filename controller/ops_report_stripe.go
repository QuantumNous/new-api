package controller

import (
	"errors"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
	"golang.org/x/sync/errgroup"
	"golang.org/x/sync/singleflight"

	"github.com/stripe/stripe-go/v81"
	"github.com/stripe/stripe-go/v81/charge"
	checkoutsession "github.com/stripe/stripe-go/v81/checkout/session"
)

// Stripe payment-conversion supplement for the ops daily report (管理员 →
// 运营日报 → 支付转化). Pulls checkout sessions and charges straight from the
// Stripe API (setting.StripeApiSecret) and joins them to PLG users by email,
// producing one row per person: who tried to pay, how many times, with what
// card, and where they got stuck. This surfaces what the local top_ups table
// never sees: abandoned sessions, decline reasons, and Radar blocks.
//
// Read-only Stripe GETs; results are cached per node for opsReportCacheTTL
// (Rule 11: read-only statistics, brief cross-node divergence is harmless).

const opsStripeMaxObjects = 3000 // per list; guards runaway pagination

// person-level stuck categories (frontend translates)
const (
	opsStripeStatusPaid     = "paid"      // at least one successful charge
	opsStripeStatusFailed   = "failed"    // entered a card, every charge failed
	opsStripeStatusNoAction = "no_action" // opened checkout, never submitted
	opsStripeStatusSetup    = "setup"     // only 0-amount (card binding) sessions
)

type opsStripePersonRow struct {
	UserId       int            `json:"user_id"`
	Email        string         `json:"email"`
	DisplayName  string         `json:"display_name"`
	BillingNames []string       `json:"billing_names"` // cardholder names from charge billing details
	Locales      []string       `json:"locales"`       // Checkout UI locales — browser-language proxy
	Campaign     string         `json:"campaign"`
	Keyword      string         `json:"keyword"`
	Lng          string         `json:"lng"`
	Landing      string         `json:"landing"`
	Referrer     string         `json:"referrer"`
	SignupMethod string         `json:"signup_method"`
	RegisteredAt int64          `json:"registered_at"`
	BalanceUSD   float64        `json:"balance_usd"`
	LastIP       string         `json:"last_ip"`
	IPCountry    string         `json:"ip_country"`
	Requests     int            `json:"requests"`
	ConsumedUSD  float64        `json:"consumed_usd"`
	FirstAt      int64          `json:"first_at"`
	LastAt       int64          `json:"last_at"`
	Sessions     int            `json:"sessions"`
	Completed    int            `json:"completed"`
	Attempts     int            `json:"attempts"`
	Succeeded    int            `json:"succeeded"`
	Amounts      []opsNameCount `json:"amounts"`      // e.g. {"USD 20": 5}
	Methods      []string       `json:"methods"`      // union of offered types
	CardCountry  []string       `json:"card_country"` // issuing country of attempted cards
	CardBrands   []string       `json:"card_brands"`  // brand/funding of attempted cards
	BillingCC    []string       `json:"billing_cc"`
	FailReasons  []opsNameCount `json:"fail_reasons"`
	Status       string         `json:"status"`
}

type opsStripeReport struct {
	GeneratedAt       int64                `json:"generated_at"`
	Days              int                  `json:"days"`
	SessionsCreated   int                  `json:"sessions_created"`
	SessionsCompleted int                  `json:"sessions_completed"`
	SessionsExpired   int                  `json:"sessions_expired"`
	ChargesSucceeded  int                  `json:"charges_succeeded"`
	ChargesFailed     int                  `json:"charges_failed"`
	ChargesBlocked    int                  `json:"charges_blocked"`
	Persons           []opsStripePersonRow `json:"persons"`
	UnmatchedSessions int                  `json:"unmatched_sessions"`
	Capped            bool                 `json:"capped"`
}

var (
	opsStripeCache   *opsStripeReport
	opsStripeCacheAt time.Time
	opsStripeMutex   sync.Mutex
	// collapses concurrent cache misses into one Stripe fetch; the mutex only guards
	// the cache fields and is never held across the (slow, remote) report build.
	opsStripeGroup singleflight.Group
)

// GetOpsStripeReport handles GET /api/data/ops_report_stripe?days=N (admin only).
func GetOpsStripeReport(c *gin.Context) {
	days, _ := strconv.Atoi(c.Query("days"))
	if days <= 0 {
		days = opsReportDefaultDays
	}
	if days > opsReportMaxDays {
		days = opsReportMaxDays
	}
	if setting.StripeApiSecret == "" {
		common.ApiError(c, errors.New("stripe api secret is not configured"))
		return
	}

	opsStripeMutex.Lock()
	if opsStripeCache != nil && opsStripeCache.Days == days &&
		time.Since(opsStripeCacheAt) < opsReportCacheTTL {
		report := opsStripeCache
		opsStripeMutex.Unlock()
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": report})
		return
	}
	opsStripeMutex.Unlock()

	v, err, _ := opsStripeGroup.Do(strconv.Itoa(days), func() (interface{}, error) {
		report, err := buildOpsStripeReport(days)
		if err != nil {
			return nil, err
		}
		opsStripeMutex.Lock()
		opsStripeCache = report
		opsStripeCacheAt = time.Now()
		opsStripeMutex.Unlock()
		return report, nil
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": v.(*opsStripeReport)})
}

// zero-decimal currencies per Stripe docs: amounts arrive in whole units.
var opsStripeZeroDecimal = map[string]bool{
	"bif": true, "clp": true, "djf": true, "gnf": true, "jpy": true,
	"kmf": true, "krw": true, "mga": true, "pyg": true, "rwf": true,
	"ugx": true, "vnd": true, "vuv": true, "xaf": true, "xof": true, "xpf": true,
}

func opsStripeMajorAmount(currency string, minor int64) float64 {
	if opsStripeZeroDecimal[strings.ToLower(currency)] {
		return float64(minor)
	}
	return float64(minor) / 100
}

// opsStripePersonAcc accumulates one user's sessions and charges.
type opsStripePersonAcc struct {
	row        opsStripePersonRow
	amounts    map[string]int
	methods    map[string]bool
	cardCC     map[string]bool
	cardBrands map[string]bool
	billingCC  map[string]bool
	names      map[string]bool
	locales    map[string]bool
	fails      map[string]int
	nonZero    int // sessions with amount > 0
}

func opsStripeStatus(a *opsStripePersonAcc) string {
	switch {
	case a.row.Succeeded > 0:
		return opsStripeStatusPaid
	case a.row.Attempts > 0:
		return opsStripeStatusFailed
	case a.nonZero == 0 && a.row.Sessions > 0:
		return opsStripeStatusSetup
	default:
		return opsStripeStatusNoAction
	}
}

func buildOpsStripeReport(days int) (*opsStripeReport, error) {
	stripe.Key = setting.StripeApiSecret
	now := time.Now().Unix()
	startTs := (now/86400)*86400 - int64(days-1)*86400
	report := &opsStripeReport{GeneratedAt: now, Days: days}

	users, err := model.GetOpsPlgUsers()
	if err != nil {
		return nil, err
	}
	byEmail := map[string]*model.OpsPlgUser{}
	byId := map[int]*model.OpsPlgUser{}
	for _, u := range users {
		byId[u.Id] = u
		if u.Email != "" {
			byEmail[strings.ToLower(strings.TrimSpace(u.Email))] = u
		}
	}

	persons := map[int]*opsStripePersonAcc{}
	acc := func(u *model.OpsPlgUser) *opsStripePersonAcc {
		a, ok := persons[u.Id]
		if !ok {
			a = &opsStripePersonAcc{
				amounts: map[string]int{}, methods: map[string]bool{},
				cardCC: map[string]bool{}, cardBrands: map[string]bool{},
				billingCC: map[string]bool{}, fails: map[string]int{},
				names: map[string]bool{}, locales: map[string]bool{},
			}
			a.row.UserId = u.Id
			a.row.Email = strings.ToLower(strings.TrimSpace(u.Email))
			a.row.DisplayName = u.DisplayName
			if a.row.DisplayName == "" {
				a.row.DisplayName = u.Username
			}
			a.row.Requests = u.RequestCount
			a.row.ConsumedUSD = float64(u.UsedQuota) / common.QuotaPerUnit
			a.row.BalanceUSD = float64(u.Quota) / common.QuotaPerUnit
			a.row.SignupMethod = u.OauthKind
			a.row.RegisteredAt = u.CreatedAt
			agg := &opsUserAgg{user: u}
			parseOpsAttribution(agg)
			a.row.Campaign = agg.campaign
			a.row.Keyword = agg.keyword
			a.row.Lng = agg.lng
			a.row.Landing = agg.landing
			a.row.Referrer = agg.referrer
			persons[u.Id] = a
		}
		return a
	}
	seen := func(a *opsStripePersonAcc, ts int64) {
		if a.row.FirstAt == 0 || ts < a.row.FirstAt {
			a.row.FirstAt = ts
		}
		if ts > a.row.LastAt {
			a.row.LastAt = ts
		}
	}

	// --- fetch sessions and charges concurrently (API pagination dominates
	// wall time), then fold sequentially into the persons map ---
	var (
		sessions     []*stripe.CheckoutSession
		charges      []*stripe.Charge
		sessErr      error
		chargeErr    error
		sessCapped   bool
		chargeCapped bool
		fetchGroup   errgroup.Group
	)
	fetchGroup.Go(func() error {
		sessionParams := &stripe.CheckoutSessionListParams{
			CreatedRange: &stripe.RangeQueryParams{GreaterThanOrEqual: startTs},
		}
		sessionParams.Limit = stripe.Int64(100)
		it := checkoutsession.List(sessionParams)
		for it.Next() {
			if len(sessions) >= opsStripeMaxObjects {
				sessCapped = true
				break
			}
			sessions = append(sessions, it.CheckoutSession())
		}
		sessErr = it.Err()
		return nil
	})
	fetchGroup.Go(func() error {
		chargeParams := &stripe.ChargeListParams{
			CreatedRange: &stripe.RangeQueryParams{GreaterThanOrEqual: startTs},
		}
		chargeParams.Limit = stripe.Int64(100)
		cit := charge.List(chargeParams)
		for cit.Next() {
			if len(charges) >= opsStripeMaxObjects {
				chargeCapped = true
				break
			}
			charges = append(charges, cit.Charge())
		}
		chargeErr = cit.Err()
		return nil
	})
	_ = fetchGroup.Wait()
	report.Capped = sessCapped || chargeCapped
	if sessErr != nil {
		return nil, sessErr
	}
	if chargeErr != nil {
		return nil, chargeErr
	}

	// --- attribute sessions via client_reference_id (our trade_no) first ---
	// Abandoned checkouts usually have no CustomerDetails, and sessions created for an
	// existing Stripe Customer can lack CustomerEmail, so email-only matching drops the
	// exact no_action/abandoned population this report exists to surface. The trade_no
	// was written by us at session creation and resolves through top_ups regardless of
	// whether the checkout was ever submitted. Email stays as fallback (e.g. setup-mode
	// card-bind sessions, which carry no client_reference_id).
	tradeNos := make([]string, 0, len(sessions))
	seenTradeNos := map[string]bool{}
	for _, s := range sessions {
		crid := strings.TrimSpace(s.ClientReferenceID)
		if crid != "" && !seenTradeNos[crid] {
			seenTradeNos[crid] = true
			tradeNos = append(tradeNos, crid)
		}
	}
	userIdByTradeNo := map[string]int{}
	if len(tradeNos) > 0 {
		tradeUsers, err := model.GetOpsTopUpUsersByTradeNos(tradeNos)
		if err != nil {
			return nil, err
		}
		for _, r := range tradeUsers {
			userIdByTradeNo[r.TradeNo] = r.UserId
		}
	}
	sessionUser := func(s *stripe.CheckoutSession) *model.OpsPlgUser {
		if uid, ok := userIdByTradeNo[strings.TrimSpace(s.ClientReferenceID)]; ok {
			if u := byId[uid]; u != nil {
				return u
			}
		}
		email := ""
		if s.CustomerDetails != nil && s.CustomerDetails.Email != "" {
			email = s.CustomerDetails.Email
		} else {
			email = s.CustomerEmail
		}
		return byEmail[strings.ToLower(strings.TrimSpace(email))]
	}

	// --- checkout sessions ---
	// payment_intent → user, so charges can be scoped to our checkouts below.
	userByPaymentIntent := map[string]*model.OpsPlgUser{}
	for _, s := range sessions {
		report.SessionsCreated++
		switch s.Status {
		case stripe.CheckoutSessionStatusComplete:
			report.SessionsCompleted++
		case stripe.CheckoutSessionStatusExpired:
			report.SessionsExpired++
		}
		u := sessionUser(s)
		if u == nil {
			report.UnmatchedSessions++
			continue
		}
		if s.PaymentIntent != nil && s.PaymentIntent.ID != "" {
			userByPaymentIntent[s.PaymentIntent.ID] = u
		}
		a := acc(u)
		seen(a, s.Created)
		a.row.Sessions++
		if s.Status == stripe.CheckoutSessionStatusComplete {
			a.row.Completed++
		}
		if s.AmountTotal > 0 {
			a.nonZero++
			key := strings.ToUpper(string(s.Currency)) + " " +
				strconv.FormatFloat(opsStripeMajorAmount(string(s.Currency), s.AmountTotal), 'f', -1, 64)
			a.amounts[key]++
		}
		for _, t := range s.PaymentMethodTypes {
			a.methods[t] = true
		}
		if s.Locale != "" && s.Locale != "auto" {
			a.locales[string(s.Locale)] = true
		}
	}

	// --- charges: real payment attempts, scoped to OUR checkout sessions ---
	// The Stripe account may also carry subscriptions, manual charges, or other
	// products; matching by billing email alone would count those as top-up attempts.
	// Only charges whose payment_intent came from a session attributed above are
	// counted — including in the report-level charge totals.
	for _, ch := range charges {
		var u *model.OpsPlgUser
		if ch.PaymentIntent != nil && ch.PaymentIntent.ID != "" {
			u = userByPaymentIntent[ch.PaymentIntent.ID]
		}
		if u == nil {
			continue
		}
		blocked := ch.Outcome != nil && ch.Outcome.Reason == "highest_risk_level"
		if ch.Paid {
			report.ChargesSucceeded++
		} else {
			report.ChargesFailed++
			if blocked {
				report.ChargesBlocked++
			}
		}
		a := acc(u)
		seen(a, ch.Created)
		a.row.Attempts++
		if ch.Paid {
			a.row.Succeeded++
		} else {
			reason := "?"
			if ch.Outcome != nil && ch.Outcome.Reason != "" {
				reason = ch.Outcome.Reason
			} else if ch.FailureCode != "" {
				reason = ch.FailureCode
			}
			a.fails[reason]++
		}
		if ch.BillingDetails != nil {
			if ch.BillingDetails.Name != "" {
				a.names[ch.BillingDetails.Name] = true
			}
			if ch.BillingDetails.Address != nil && ch.BillingDetails.Address.Country != "" {
				a.billingCC[ch.BillingDetails.Address.Country] = true
			}
		}
		if ch.PaymentMethodDetails != nil && ch.PaymentMethodDetails.Card != nil {
			card := ch.PaymentMethodDetails.Card
			if card.Country != "" {
				a.cardCC[card.Country] = true
			}
			brand := string(card.Brand)
			if card.Funding != "" {
				brand += "/" + string(card.Funding)
			}
			if brand != "" {
				a.cardBrands[brand] = true
			}
		}
	}

	keys := func(m map[string]bool) []string {
		out := make([]string, 0, len(m))
		for k := range m {
			out = append(out, k)
		}
		sort.Strings(out)
		return out
	}
	// last request IP (any log row, playground included) as an identity hint
	personIds := make([]int, 0, len(persons))
	for _, a := range persons {
		personIds = append(personIds, a.row.UserId)
	}
	ipByUser := map[int]string{}
	if ips, err := model.GetOpsUsersLastIP(personIds); err == nil {
		for _, r := range ips {
			ipByUser[r.UserId] = r.Ip
		}
	}
	for _, a := range persons {
		a.row.Amounts = opsSortedCounts(a.amounts, 6)
		a.row.FailReasons = opsSortedCounts(a.fails, 6)
		a.row.Methods = keys(a.methods)
		a.row.CardCountry = keys(a.cardCC)
		a.row.CardBrands = keys(a.cardBrands)
		a.row.BillingCC = keys(a.billingCC)
		a.row.BillingNames = keys(a.names)
		a.row.Locales = keys(a.locales)
		a.row.LastIP = ipByUser[a.row.UserId]
		a.row.IPCountry = opsIPCountry(a.row.LastIP)
		a.row.Status = opsStripeStatus(a)
		report.Persons = append(report.Persons, a.row)
	}
	sort.Slice(report.Persons, func(i, j int) bool {
		return report.Persons[i].LastAt > report.Persons[j].LastAt
	})
	return report, nil
}
