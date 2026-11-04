package service

import (
	"errors"
	"net/http"
	"testing"

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

// A credit failure on Lumia moves on to the next allowed channel, without the
// paused outage retry on Lumia and without cooling Lumia for the other models.
func TestHwDecideRetryMovesOnAfterSupplierCredit(t *testing.T) {
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
	assert.False(t, state.outage, "no paused Lumia retry for an empty supplier account")
	allowed, _ := hwLumiaAllows(false)
	assert.True(t, allowed, "Lumia keeps serving the other models")
	assert.Same(t, spare, state.next())
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
