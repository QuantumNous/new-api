package operation_setting

import (
	"sync"

	"github.com/QuantumNous/new-api/common"
)

// Task async failover settings (submit retry + polling same/cross-channel).
var (
	TaskSameChannelMaxRetries       = 2
	TaskCrossChannelFailoverEnabled = true

	taskModelChannelOrderMu sync.RWMutex
	// taskModelChannelOrder: origin model name → ordered channel IDs
	taskModelChannelOrder = map[string][]int{}
)

func GetTaskSameChannelMaxRetries() int {
	if TaskSameChannelMaxRetries < 0 {
		return 0
	}
	return TaskSameChannelMaxRetries
}

func IsTaskCrossChannelFailoverEnabled() bool {
	return TaskCrossChannelFailoverEnabled
}

// GetTaskModelChannelOrder returns a copy of the ordered channel IDs for a model.
// Empty / missing → caller should fall back to Priority.
func GetTaskModelChannelOrder(modelName string) []int {
	taskModelChannelOrderMu.RLock()
	defer taskModelChannelOrderMu.RUnlock()
	ids := taskModelChannelOrder[modelName]
	if len(ids) == 0 {
		return nil
	}
	out := make([]int, len(ids))
	copy(out, ids)
	return out
}

// GetAllTaskModelChannelOrder returns a deep copy of the full map (for admin UI).
func GetAllTaskModelChannelOrder() map[string][]int {
	taskModelChannelOrderMu.RLock()
	defer taskModelChannelOrderMu.RUnlock()
	out := make(map[string][]int, len(taskModelChannelOrder))
	for k, v := range taskModelChannelOrder {
		cp := make([]int, len(v))
		copy(cp, v)
		out[k] = cp
	}
	return out
}

func TaskModelChannelOrderToJSONString() string {
	taskModelChannelOrderMu.RLock()
	defer taskModelChannelOrderMu.RUnlock()
	b, err := common.Marshal(taskModelChannelOrder)
	if err != nil {
		return "{}"
	}
	return string(b)
}

func UpdateTaskModelChannelOrderByJSONString(s string) error {
	if s == "" {
		s = "{}"
	}
	parsed := map[string][]int{}
	if err := common.Unmarshal([]byte(s), &parsed); err != nil {
		return err
	}
	if parsed == nil {
		parsed = map[string][]int{}
	}
	taskModelChannelOrderMu.Lock()
	taskModelChannelOrder = parsed
	taskModelChannelOrderMu.Unlock()
	return nil
}
