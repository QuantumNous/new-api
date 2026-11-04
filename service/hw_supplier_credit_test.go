package service

import (
	"errors"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// A supplier whose own account ran out of credit answers 400, but that is no
// mistake of the customer: an exhausted route answers 503 with the model one
// step lower, never the supplier wording and never "The request is invalid."
// (Playground, claude-fable-5-1, 4 Nov 2026).
func TestHwTerminalErrorTurnsSupplierCreditIntoModelUnavailable(t *testing.T) {
	credit := types.NewErrorWithStatusCode(errors.New("Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."), "invalid_request_error", http.StatusBadRequest)
	stop := PolicyDecision{Action: "stop"}
	for _, lang := range []string{"", "tr-TR"} {
		c := hwClientErrorContext(lang)
		state := hwPolicyRoute(nil, nil)
		state.model = "claude-fable-5-1"
		c.Set(hwRouteContextKey, state)

		replaced := HwTerminalError(c, credit, stop)
		require.NotNil(t, replaced, lang)
		assert.Equal(t, http.StatusServiceUnavailable, replaced.StatusCode)
		assert.Equal(t, HwErrorCodeModelUnavailable, replaced.GetErrorCode())
		assert.True(t, HwIsOwnErrorCode(string(replaced.GetErrorCode())), "the mask must keep this text")
		message := replaced.Error()
		assert.Contains(t, message, "claude-opus-5-5")
		for _, leak := range []string{"Anthropic", "Plans & Billing", "credit balance", "Lumia", "invalid"} {
			assert.NotContains(t, message, leak)
		}
	}

	c := hwClientErrorContext("")
	c.Set(hwRouteContextKey, hwPolicyRoute(nil, nil))
	assert.Nil(t, HwTerminalError(c, hwPolicyError(http.StatusBadRequest, "invalid_request"), stop), "a real client error keeps its class")
	for _, message := range []string{"insufficient_quota", "You exceeded your current quota, please check your plan and billing details", "Insufficient balance"} {
		assert.True(t, hwIsSupplierCreditError(types.NewErrorWithStatusCode(errors.New(message), "x", http.StatusBadRequest)), message)
	}
	assert.False(t, hwIsSupplierCreditError(hwPolicyError(http.StatusBadRequest, "invalid_request")))
	assert.False(t, hwIsSupplierCreditError(types.NewErrorWithStatusCode(errors.New("insufficient user quota"), types.ErrorCodeInsufficientUserQuota, http.StatusForbidden)), "our own quota refusal belongs to the customer")
}

// A credit failure on Lumia is intermittent (4 Nov 2026: good rows between the
// failures), so the same Lumia channel gets one more attempt after a short
// pause; only a second failure moves on to the next allowed channel. Lumia is
// not cooled for the other models.
func TestHwDecideRetryRetriesSupplierCreditOnceThenMovesOn(t *testing.T) {
	previous := hwSupplierCreditPause
	hwSupplierCreditPause = 0
	t.Cleanup(func() { hwSupplierCreditPause = previous; hwResetModelHealth() })
	lumia := hwPolicyChannel(9101, HwProviderLumia, "")
	spare := hwPolicyChannel(9102, HwProviderPortix, "")
	credit := types.NewErrorWithStatusCode(errors.New("Your credit balance is too low"), "invalid_request_error", http.StatusBadRequest)
	c := hwClientErrorContext("")
	state := hwPolicyRoute([]*model.Channel{lumia}, []*model.Channel{spare})
	c.Set(hwRouteContextKey, state)
	require.Same(t, lumia, state.next())

	decision, handled := HwDecideRetry(c, credit)
	require.True(t, handled)
	assert.Equal(t, "retry", decision.Action)
	assert.False(t, state.outage, "no outage cooldown for an empty supplier account")
	allowed, _ := hwLumiaAllows(false)
	assert.True(t, allowed, "Lumia keeps serving the other models")
	assert.Same(t, lumia, state.next(), "one more attempt on the same Lumia channel")

	decision, _ = HwDecideRetry(c, credit)
	assert.Equal(t, "retry", decision.Action)
	assert.Same(t, spare, state.next(), "the second failure moves on")

	free := hwPolicyRoute([]*model.Channel{lumia}, nil)
	c.Set(hwRouteContextKey, free)
	require.Same(t, lumia, free.next())
	decision, _ = HwDecideRetry(c, credit)
	assert.Equal(t, "retry", decision.Action, "a route with Lumia only still gets the retry")
	assert.Same(t, lumia, free.next())
	decision, _ = HwDecideRetry(c, credit)
	assert.Equal(t, "stop", decision.Action)
}

// The alternative named in the 503 must be a model that works now: a model
// with a supplier credit failure in the last minutes is skipped, and when the
// whole vendor is sick the best healthy model of another vendor is named. The
// first good answer makes a model healthy again.
func TestHwHealthyAlternativeSkipsSickModels(t *testing.T) {
	t.Cleanup(hwResetModelHealth)
	hwResetModelHealth()
	assert.Equal(t, "claude-opus-5-5", HwHealthyAlternative("claude-fable-5-1"))

	HwNoteModelCreditFailure("claude-opus-5-5")
	HwNoteModelCreditFailure("claude-sonnet-5-5")
	assert.True(t, HwModelSick("claude-opus-5-5"))
	assert.Equal(t, "claude-haiku-5-5", HwHealthyAlternative("claude-fable-5-1"))

	HwNoteModelCreditFailure("claude-haiku-5-5")
	HwNoteModelCreditFailure("claude-fable-5-1")
	assert.Equal(t, "gpt-6-astra", HwHealthyAlternative("claude-fable-5-1"), "same price, other vendor")
	assert.Equal(t, "gpt-6.1-sol", HwHealthyAlternative("claude-opus-5-5"), "best other model not above the price")
	assert.Equal(t, "gpt-6-luna", HwHealthyAlternative("claude-haiku-5-5"))

	message := HwModelUnavailableError(hwClientErrorContext(""), "claude-opus-5-5").Error()
	assert.Contains(t, message, "gpt-6.1-sol")
	assert.NotContains(t, message, "claude-sonnet-5-5", "never point at a sick model")

	HwNoteModelHealthy("claude-sonnet-5-5")
	assert.False(t, HwModelSick("claude-sonnet-5-5"))
	assert.Equal(t, "claude-sonnet-5-5", HwHealthyAlternative("claude-opus-5-5"))

	previous := hwModelHealthClock
	hwModelHealthClock = func() time.Time { return time.Now().Add(hwModelSickFor + time.Second) }
	t.Cleanup(func() { hwModelHealthClock = previous })
	assert.False(t, HwModelSick("claude-opus-5-5"), "sickness wears off by itself")
	assert.False(t, HwModelSick("claude-fable-5-1"))
}

func TestHwSickModelAlternativesNamesEachSickModelWithAHealthyChoice(t *testing.T) {
	t.Cleanup(hwResetModelHealth)
	hwResetModelHealth()
	assert.Empty(t, HwSickModelAlternatives())

	HwNoteModelCreditFailure("claude-fable-5-1")
	HwNoteModelCreditFailure("claude-opus-5-5")
	assert.Equal(t, map[string]string{
		"claude-fable-5-1": "claude-sonnet-5-5",
		"claude-opus-5-5":  "claude-sonnet-5-5",
	}, HwSickModelAlternatives())

	previous := hwModelHealthClock
	hwModelHealthClock = func() time.Time { return time.Now().Add(hwModelSickFor + time.Second) }
	t.Cleanup(func() { hwModelHealthClock = previous })
	assert.Empty(t, HwSickModelAlternatives(), "a model whose sickness wore off is not listed")
}

func TestHwModelStepDown(t *testing.T) {
	for name, want := range map[string]string{
		"claude-fable-5-1": "claude-opus-5-5",
		"claude-opus-5-5":  "claude-sonnet-5-5",
		"claude-haiku-5-5": "",
		"gpt-6-astra":      "gpt-6.1-sol",
		"unknown-model":    "",
	} {
		assert.Equal(t, want, HwModelStepDown(name), name)
	}
}

// Five supplier credit failures within an hour file one card for the CEO route
// with the counts; more failures that day file nothing, older failures do not
// count, and the next day can file again (4 Nov 2026, Lumia's Anthropic credit).
func TestHwSupplierCreditFailuresFileOneCardADay(t *testing.T) {
	require.NoError(t, model.DB.AutoMigrate(&model.Option{}))
	common.OptionMapRWMutex.Lock()
	if common.OptionMap == nil {
		common.OptionMap = map[string]string{}
	}
	common.OptionMapRWMutex.Unlock()
	var cards []hwBureauIssueRequest
	var mu sync.Mutex
	previous := hwSupplierCreditPostCard
	clean := func() {
		model.DB.Where("key = ?", HwOptionSupplierCreditCardDay).Delete(&model.Option{})
		common.OptionMapRWMutex.Lock()
		delete(common.OptionMap, HwOptionSupplierCreditCardDay)
		common.OptionMapRWMutex.Unlock()
		hwSupplierCredit.Lock()
		hwSupplierCredit.failures, hwSupplierCredit.posting, hwSupplierCredit.retryAt = nil, false, time.Time{}
		hwSupplierCredit.Unlock()
	}
	clean()
	t.Cleanup(func() { hwSupplierCreditPostCard = previous; clean() })
	hwSupplierCreditPostCard = func(issue hwBureauIssueRequest) error {
		mu.Lock()
		defer mu.Unlock()
		cards = append(cards, issue)
		return nil
	}
	settled := func() bool {
		hwSupplierCredit.Lock()
		defer hwSupplierCredit.Unlock()
		return !hwSupplierCredit.posting
	}
	start := time.Date(2026, 11, 4, 10, 0, 0, 0, time.UTC)

	HwCountSupplierCreditFailure(1, "claude-opus-5-5", start.Add(-2*time.Hour))
	for i := range 4 {
		HwCountSupplierCreditFailure(1, "claude-fable-5-1", start.Add(time.Duration(i)*time.Minute))
	}
	require.Eventually(t, settled, time.Second, 10*time.Millisecond)
	assert.Empty(t, cards, "four failures in the hour and one older failure stay below the threshold")

	HwCountSupplierCreditFailure(5, "claude-opus-5-5", start.Add(10*time.Minute))
	require.Eventually(t, func() bool { mu.Lock(); defer mu.Unlock(); return len(cards) == 1 && settled() }, time.Second, 10*time.Millisecond)
	assert.Equal(t, "Lumia: Anthropic-tegoed wisselvallig leeg (2026-11-04)", cards[0].Title)
	assert.Equal(t, HwBureauAgentCEO, cards[0].AssigneeAgentID)
	assert.Contains(t, cards[0].Description, "- claude-fable-5-1 op kanaal 1: 4\n")
	assert.Contains(t, cards[0].Description, "- claude-opus-5-5 op kanaal 5: 1\n")
	assert.NotContains(t, cards[0].Description, "Your credit balance")

	for i := range 6 {
		HwCountSupplierCreditFailure(1, "claude-fable-5-1", start.Add(time.Duration(20+i)*time.Minute))
	}
	require.Eventually(t, settled, time.Second, 10*time.Millisecond)
	assert.Len(t, cards, 1, "the same day files no second card")

	next := start.Add(24 * time.Hour)
	for i := range 5 {
		HwCountSupplierCreditFailure(1, "claude-fable-5-1", next.Add(time.Duration(i)*time.Minute))
	}
	require.Eventually(t, func() bool { mu.Lock(); defer mu.Unlock(); return len(cards) == 2 && settled() }, time.Second, 10*time.Millisecond)
	assert.Equal(t, "Lumia: Anthropic-tegoed wisselvallig leeg (2026-11-05)", cards[1].Title)
}
