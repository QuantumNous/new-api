package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// hwAssistantShortWaits shrinks the attempt waits so a test does not spend
// the real 12 and 13 seconds, and restores them afterwards.
func hwAssistantShortWaits(t *testing.T) {
	t.Helper()
	attempt, fallback, sticky := hwAssistantAttemptTimeout, hwAssistantFallbackTimeout, hwAssistantFallbackSticky
	hwAssistantAttemptTimeout, hwAssistantFallbackTimeout, hwAssistantFallbackSticky = 80*time.Millisecond, 80*time.Millisecond, time.Hour
	hwAssistantSlow.mu.Lock()
	hwAssistantSlow.streak, hwAssistantSlow.untilMono = 0, time.Time{}
	hwAssistantSlow.mu.Unlock()
	t.Cleanup(func() {
		hwAssistantAttemptTimeout, hwAssistantFallbackTimeout, hwAssistantFallbackSticky = attempt, fallback, sticky
		hwAssistantSlow.mu.Lock()
		hwAssistantSlow.streak, hwAssistantSlow.untilMono = 0, time.Time{}
		hwAssistantSlow.mu.Unlock()
	})
}

// hwAssistantStubGateway answers for the wanted model and hangs the other, so
// a test can see which model the assistant actually asked.
func hwAssistantStubGateway(t *testing.T, answerModel string) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request hwChatRequest
		if err := common.DecodeJson(r.Body, &request); err != nil || request.Model != answerModel {
			<-r.Context().Done()
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"answered by ` + answerModel + `"}}],"usage":{"completion_tokens":5}}`))
	}))
	t.Cleanup(server.Close)
	return server
}

func TestHwAssistantFallbackWhenFirstModelHangs(t *testing.T) {
	hwAssistantShortWaits(t)
	server := hwAssistantStubGateway(t, "grok-4-fast")
	config := HwAdminAgentConfig{BaseURL: server.URL, APIKey: "sk-test", Model: "claude-haiku-5-5", FallbackModel: "grok-4-fast"}
	turns := []HwAdminAgentTurn{{Role: "user", Content: "hoe stel ik Claude Code in?"}}

	started := time.Now()
	text, _, err := hwAssistantCall(context.Background(), config, "instruction", "Owner message:", turns)
	require.NoError(t, err)
	assert.Contains(t, text, "grok-4-fast")
	assert.Less(t, time.Since(started), 5*time.Second)
}

func TestHwAssistantTwoTimeoutsSwitchTheOrder(t *testing.T) {
	hwAssistantShortWaits(t)
	server := hwAssistantStubGateway(t, "grok-4-fast")
	config := HwAdminAgentConfig{BaseURL: server.URL, APIKey: "sk-test", Model: "claude-haiku-5-5", FallbackModel: "grok-4-fast"}
	turns := []HwAdminAgentTurn{{Role: "user", Content: "hoe stel ik Claude Code in?"}}

	// Two questions time out on the primary model first; the backup then
	// decides the wait in the third one.
	for range 2 {
		_, _, err := hwAssistantCall(context.Background(), config, "instruction", "Owner message:", turns)
		require.NoError(t, err)
	}
	started := time.Now()
	text, _, err := hwAssistantCall(context.Background(), config, "instruction", "Owner message:", turns)
	require.NoError(t, err)
	assert.Contains(t, text, "grok-4-fast")
	// Only one wait, not two: the backup went first.
	assert.Less(t, time.Since(started), 300*time.Millisecond)
}

func TestHwAssistantBothModelsHangGivesTheFallback(t *testing.T) {
	hwAssistantShortWaits(t)
	// A handler that waits far past the attempt waits, then answers; the
	// client gave up long before, and the handler returns on its own so the
	// test never waits for a connection that Windows keeps open.
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(time.Second)
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"too late"}}]}`))
	}))
	t.Cleanup(server.Close)
	config := HwAdminAgentConfig{BaseURL: server.URL, APIKey: "sk-test", Model: "claude-haiku-5-5", FallbackModel: "grok-4-fast"}
	turns := []HwAdminAgentTurn{{Role: "user", Content: "hoe stel ik Claude Code in?"}}

	reply, ok := HwAssistantChat(context.Background(), config, HwAssistantChannelWidget, "nl", turns)
	assert.False(t, ok)
	assert.True(t, strings.TrimSpace(reply) != "")
}
