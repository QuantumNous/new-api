package modelroute

import (
	"container/heap"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/model"
)

// probeHeap implements heap.Interface for ProbeQueueItem (PRD §15).
// Order: next_probe_at ASC → manual_priority DESC → backoff_level ASC → last_success_at DESC → last_probe_at ASC.
type probeHeap []model.ProbeQueueItem

func (h probeHeap) Len() int { return len(h) }
func (h probeHeap) Less(i, j int) bool {
	a, b := h[i], h[j]
	if !a.NextProbeAt.Equal(b.NextProbeAt) {
		return a.NextProbeAt.Before(b.NextProbeAt)
	}
	if a.ManualPriority != b.ManualPriority {
		return a.ManualPriority > b.ManualPriority
	}
	if a.BackoffLevel != b.BackoffLevel {
		return a.BackoffLevel < b.BackoffLevel
	}
	if !a.LastSuccessAt.Equal(b.LastSuccessAt) {
		return a.LastSuccessAt.After(b.LastSuccessAt)
	}
	return a.LastProbeAt.Before(b.LastProbeAt)
}
func (h probeHeap) Swap(i, j int) { h[i], h[j] = h[j], h[i] }
func (h *probeHeap) Push(x any)   { *h = append(*h, x.(model.ProbeQueueItem)) }
func (h *probeHeap) Pop() any {
	old := *h
	n := len(old)
	item := old[n-1]
	*h = old[:n-1]
	return item
}

// ProbeQueue is a process-local priority queue of PROBING routes (PRD §15).
type ProbeQueue struct {
	mu    sync.Mutex
	items probeHeap
	index map[string]int // metrics key string → heap index (rebuilt on ops for simplicity)
}

// GlobalProbeQueue is the singleton probe queue.
var GlobalProbeQueue = NewProbeQueue()

func NewProbeQueue() *ProbeQueue {
	q := &ProbeQueue{index: make(map[string]int)}
	heap.Init(&q.items)
	return q
}

func (q *ProbeQueue) Len() int {
	q.mu.Lock()
	defer q.mu.Unlock()
	return q.items.Len()
}

// Upsert inserts or replaces an item for the same MetricsKey.
func (q *ProbeQueue) Upsert(item model.ProbeQueueItem) {
	q.mu.Lock()
	defer q.mu.Unlock()
	key := item.MetricsKey.String()
	for i := range q.items {
		if q.items[i].MetricsKey.String() == key {
			q.items[i] = item
			heap.Fix(&q.items, i)
			return
		}
	}
	heap.Push(&q.items, item)
}

// Peek returns the head without removing; ok=false if empty.
func (q *ProbeQueue) Peek() (model.ProbeQueueItem, bool) {
	q.mu.Lock()
	defer q.mu.Unlock()
	if q.items.Len() == 0 {
		return model.ProbeQueueItem{}, false
	}
	return q.items[0], true
}

// PopDue pops head if NextProbeAt <= now; otherwise returns ok=false.
func (q *ProbeQueue) PopDue(now time.Time) (model.ProbeQueueItem, bool) {
	q.mu.Lock()
	defer q.mu.Unlock()
	if q.items.Len() == 0 {
		return model.ProbeQueueItem{}, false
	}
	if q.items[0].NextProbeAt.After(now) {
		return model.ProbeQueueItem{}, false
	}
	item := heap.Pop(&q.items).(model.ProbeQueueItem)
	return item, true
}

// PopForced pops head regardless of NextProbeAt (for tests / admin force).
func (q *ProbeQueue) PopForced() (model.ProbeQueueItem, bool) {
	q.mu.Lock()
	defer q.mu.Unlock()
	if q.items.Len() == 0 {
		return model.ProbeQueueItem{}, false
	}
	return heap.Pop(&q.items).(model.ProbeQueueItem), true
}

// Clear empties the queue.
func (q *ProbeQueue) Clear() {
	q.mu.Lock()
	defer q.mu.Unlock()
	q.items = nil
	heap.Init(&q.items)
	q.index = make(map[string]int)
}

// EnqueueFromMetrics builds a ProbeQueueItem from metrics + manual priority.
func EnqueueFromMetrics(m *model.ChannelModelMetrics, manualPriority int) {
	if m == nil {
		return
	}
	next := m.CooldownUntilTime()
	if next.IsZero() {
		next = now()
	}
	item := model.ProbeQueueItem{
		MetricsKey:     m.MetricsKey(),
		NextProbeAt:    next,
		ManualPriority: manualPriority,
		BackoffLevel:   m.BackoffLevel,
	}
	if m.LastSuccessAt != nil {
		item.LastSuccessAt = time.Unix(*m.LastSuccessAt, 0)
	}
	if m.LastProbeAt != nil {
		item.LastProbeAt = time.Unix(*m.LastProbeAt, 0)
	}
	GlobalProbeQueue.Upsert(item)
}
