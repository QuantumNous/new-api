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
	Campaign     string         `json:"campaign"`
	Keyword      string         `json:"keyword"`
	Lng          string         `json:"lng"`
	SignupMethod string         `json:"signup_method"`
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
	defer opsStripeMutex.Unlock()
	if opsStripeCache != nil && opsStripeCache.Days == days &&
		time.Since(opsStripeCacheAt) < opsReportCacheTTL {
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": opsStripeCache})
		return
	}

	report, err := buildOpsStripeReport(days)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	opsStripeCache = report
	opsStripeCacheAt = time.Now()
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": report})
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
	for _, u := range users {
		if u.Email != "" {
			byEmail[strings.ToLower(u.Email)] = u
		}
	}

	persons := map[string]*opsStripePersonAcc{}
	acc := func(email string) *opsStripePersonAcc {
		a, ok := persons[email]
		if !ok {
			a = &opsStripePersonAcc{
				amounts: map[string]int{}, methods: map[string]bool{},
				cardCC: map[string]bool{}, cardBrands: map[string]bool{},
				billingCC: map[string]bool{}, fails: map[string]int{},
			}
			u := byEmail[email]
			a.row.UserId = u.Id
			a.row.Email = email
			a.row.Requests = u.RequestCount
			a.row.ConsumedUSD = float64(u.UsedQuota) / common.QuotaPerUnit
			a.row.SignupMethod = u.OauthKind
			agg := &opsUserAgg{user: u}
			parseOpsAttribution(agg)
			a.row.Campaign = agg.campaign
			a.row.Keyword = agg.keyword
			a.row.Lng = agg.lng
			persons[email] = a
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

	// --- checkout sessions ---
	sessionParams := &stripe.CheckoutSessionListParams{
		CreatedRange: &stripe.RangeQueryParams{GreaterThanOrEqual: startTs},
	}
	sessionParams.Limit = stripe.Int64(100)
	count := 0
	it := checkoutsession.List(sessionParams)
	for it.Next() {
		s := it.CheckoutSession()
		count++
		if count > opsStripeMaxObjects {
			report.Capped = true
			break
		}
		report.SessionsCreated++
		switch s.Status {
		case stripe.CheckoutSessionStatusComplete:
			report.SessionsCompleted++
		case stripe.CheckoutSessionStatusExpired:
			report.SessionsExpired++
		}
		email := ""
		if s.CustomerDetails != nil && s.CustomerDetails.Email != "" {
			email = s.CustomerDetails.Email
		} else {
			email = s.CustomerEmail
		}
		email = strings.ToLower(email)
		if _, ok := byEmail[email]; !ok {
			report.UnmatchedSessions++
			continue
		}
		a := acc(email)
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
	}
	if err := it.Err(); err != nil {
		return nil, err
	}

	// --- charges: real card attempts ---
	chargeParams := &stripe.ChargeListParams{
		CreatedRange: &stripe.RangeQueryParams{GreaterThanOrEqual: startTs},
	}
	chargeParams.Limit = stripe.Int64(100)
	count = 0
	cit := charge.List(chargeParams)
	for cit.Next() {
		ch := cit.Charge()
		count++
		if count > opsStripeMaxObjects {
			report.Capped = true
			break
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
		email := ""
		if ch.BillingDetails != nil && ch.BillingDetails.Email != "" {
			email = ch.BillingDetails.Email
		} else {
			email = ch.ReceiptEmail
		}
		email = strings.ToLower(email)
		if _, ok := byEmail[email]; !ok {
			continue
		}
		a := acc(email)
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
		if ch.BillingDetails != nil && ch.BillingDetails.Address != nil &&
			ch.BillingDetails.Address.Country != "" {
			a.billingCC[ch.BillingDetails.Address.Country] = true
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
	if err := cit.Err(); err != nil {
		return nil, err
	}

	keys := func(m map[string]bool) []string {
		out := make([]string, 0, len(m))
		for k := range m {
			out = append(out, k)
		}
		sort.Strings(out)
		return out
	}
	for _, a := range persons {
		a.row.Amounts = opsSortedCounts(a.amounts, 6)
		a.row.FailReasons = opsSortedCounts(a.fails, 6)
		a.row.Methods = keys(a.methods)
		a.row.CardCountry = keys(a.cardCC)
		a.row.CardBrands = keys(a.cardBrands)
		a.row.BillingCC = keys(a.billingCC)
		a.row.Status = opsStripeStatus(a)
		report.Persons = append(report.Persons, a.row)
	}
	sort.Slice(report.Persons, func(i, j int) bool {
		return report.Persons[i].LastAt > report.Persons[j].LastAt
	})
	return report, nil
}
