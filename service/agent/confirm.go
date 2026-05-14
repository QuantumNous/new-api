package agent

import (
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

var confirmStore = struct {
	sync.Mutex
	items map[string]PendingConfirmation
}{items: make(map[string]PendingConfirmation)}

func CreateConfirmation(userId int, sessionId int, toolName string, args map[string]interface{}) PendingConfirmation {
	token := uuid.NewString()
	pending := PendingConfirmation{
		Token:     token,
		UserId:    userId,
		SessionId: sessionId,
		ToolName:  toolName,
		Args:      args,
		ExpiresAt: time.Now().Add(5 * time.Minute),
	}
	confirmStore.Lock()
	confirmStore.items[token] = pending
	confirmStore.Unlock()
	return pending
}

func TakeConfirmation(userId int, sessionId int, token string) (PendingConfirmation, error) {
	confirmStore.Lock()
	defer confirmStore.Unlock()
	pending, ok := confirmStore.items[token]
	if !ok {
		return PendingConfirmation{}, errors.New("confirm token not found")
	}
	delete(confirmStore.items, token)
	if pending.UserId != userId || pending.SessionId != sessionId {
		return PendingConfirmation{}, errors.New("confirm token mismatch")
	}
	if time.Now().After(pending.ExpiresAt) {
		return PendingConfirmation{}, errors.New("confirm token expired")
	}
	return pending, nil
}
