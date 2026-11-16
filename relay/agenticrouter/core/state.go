package core

import "sync"

// State —— 飞轮状态（JSON 序列化后可经 Wasm shared data / Redis 持久化）。
// 字段与 js freshState() 一一对应；decisions 不在其中（宿主各自持有）。

type Arm struct {
	N    int     `json:"n"`
	Mean float64 `json:"mean"`
}

type Exp struct {
	F    []float64 `json:"f"`
	Tier string    `json:"tier"`
	R    float64   `json:"r"`
}

type UCBState struct {
	Total int             `json:"total"`
	Arms  map[string]*Arm `json:"arms"`
}

type LinState struct {
	Total int                  `json:"total"`
	TierN map[string]int       `json:"tierN"`
	TierW map[string][]float64 `json:"tierW"`
}

type KNNState struct {
	Pool []Exp `json:"pool"`
}

type Exp3State struct {
	Total        int                `json:"total"`
	LinGraduated bool               `json:"linGraduated"`
	KnnGraduated bool               `json:"knnGraduated"`
	Gamma        float64            `json:"gamma,omitempty"` // 0 → 默认 Gamma
	Weights      map[string]float64 `json:"weights"`
}

// Gamma 是 EXP3 元选择器的 γ 混合率（每位专家保底 Gamma/K 采样概率）。
const Gamma = 0.05

type State struct {
	Mode string    `json:"mode"` // shadow | active
	Seq  int       `json:"seq"`
	UCB  UCBState  `json:"ucb"`
	Lin  LinState  `json:"lin"`
	KNN  KNNState  `json:"knn"`
	Exp3 Exp3State `json:"exp3"`
}

// FreshState 全新飞轮状态。
func FreshState() *State {
	return &State{
		Mode: "shadow",
		Seq:  0,
		UCB:  UCBState{Total: 0, Arms: map[string]*Arm{}},
		Lin: LinState{
			Total: 0,
			TierN: map[string]int{"fast": 0, "mid": 0, "strong": 0},
			TierW: map[string][]float64{
				"fast":   make([]float64, 9),
				"mid":    make([]float64, 9),
				"strong": make([]float64, 9),
			},
		},
		KNN: KNNState{Pool: []Exp{}},
		Exp3: Exp3State{
			Total:   0,
			Weights: map[string]float64{"ucb": 1, "linucb": 1, "knn": 1, "rule": 2.5},
		},
	}
}

// SafeState 带锁的状态容器（Wasm worker 内并发回调安全）。
type SafeState struct {
	mu sync.Mutex
	s  *State
}

func NewSafeState(s *State) *SafeState {
	if s == nil {
		s = FreshState()
	}
	return &SafeState{s: s}
}

func (c *SafeState) Get() *State {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.s
}

func (c *SafeState) With(fn func(s *State)) {
	c.mu.Lock()
	defer c.mu.Unlock()
	fn(c.s)
}
