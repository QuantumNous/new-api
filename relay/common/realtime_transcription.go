package common

import (
	"sync"

	basecommon "github.com/QuantumNous/new-api/common"

	"github.com/shopspring/decimal"
)

// RealtimeTranscriptionState keeps ASR billing state synchronized between the
// client reader, upstream reader, and final websocket settlement.
type RealtimeTranscriptionState struct {
	mu       sync.RWMutex
	model    string
	hasUsage bool
	quota    decimal.Decimal
}

func (info *RelayInfo) InitRealtimeTranscriptionState() {
	if info == nil {
		return
	}
	if info.RealtimeTranscription == nil {
		info.RealtimeTranscription = &RealtimeTranscriptionState{}
	}
}

func (info *RelayInfo) SetRealtimeTranscriptionModel(model string) {
	if info == nil || model == "" {
		return
	}
	info.InitRealtimeTranscriptionState()
	info.RealtimeTranscription.mu.Lock()
	info.RealtimeTranscription.model = model
	info.RealtimeTranscription.mu.Unlock()
}

func (info *RelayInfo) GetRealtimeTranscriptionModel() string {
	if info == nil || info.RealtimeTranscription == nil {
		return ""
	}
	info.RealtimeTranscription.mu.RLock()
	defer info.RealtimeTranscription.mu.RUnlock()
	return info.RealtimeTranscription.model
}

func (info *RelayInfo) AddRealtimeTranscriptionQuota(quota int) {
	if info == nil {
		return
	}
	info.InitRealtimeTranscriptionState()
	info.RealtimeTranscription.mu.Lock()
	info.RealtimeTranscription.hasUsage = true
	info.RealtimeTranscription.quota = info.RealtimeTranscription.quota.Add(decimal.NewFromInt(int64(quota)))
	info.RealtimeTranscription.mu.Unlock()
}

func (info *RelayInfo) GetRealtimeTranscriptionBilling() (bool, int, *basecommon.QuotaClamp) {
	if info == nil || info.RealtimeTranscription == nil {
		return false, 0, nil
	}
	info.RealtimeTranscription.mu.RLock()
	defer info.RealtimeTranscription.mu.RUnlock()
	quota, clamp := basecommon.QuotaFromDecimalChecked(info.RealtimeTranscription.quota)
	return info.RealtimeTranscription.hasUsage, quota, clamp
}
