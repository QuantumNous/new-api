package core

import (
	"math"
	"sort"
	"strconv"
)

// 四专家策略 + 奖励计算 + 飞轮更新（纯函数）。与 js/src/strategies.js 逐行对拍。

// Recommendation 单个专家的推荐。
type Recommendation struct {
	Tier   string // fast / mid / strong；k-NN 冷启动为空串
	Reason string
	Conf   float64
}

// ModelTiers 模型目录：providers 顺序即跨 provider 择优顺序。
type ModelTiers struct {
	Providers []ProviderEntry     `json:"providers"`
	Tiers     map[string][]string `json:"tiers"`
}

type ProviderEntry struct {
	Provider string `json:"provider"`
}

func (mt ModelTiers) Ready() bool { return len(mt.Tiers) > 0 }

func tierTarget(tier, provider string, mt ModelTiers) string {
	for _, s := range mt.Tiers[tier] {
		if provider != "" && len(s) > len(provider)+1 && s[:len(provider)+1] == provider+"/" {
			return s[len(provider)+1:]
		}
	}
	return ""
}

func tierHasAny(tier string, mt ModelTiers) bool {
	return len(mt.Tiers[tier]) > 0
}

// Resolution 是 ResolveTier 的返回值。
type Resolution struct {
	Target   string
	Provider string
	Used     string
	Note     string
}

// ResolveTier 档位 → 模型 id 解析（同 provider 优先、支持跨 provider 与 mid 回退）。
func ResolveTier(tier, provider string, mt ModelTiers, cross bool) Resolution {
	if !mt.Ready() {
		return Resolution{Target: "", Provider: "", Used: tier, Note: "tiers-not-ready"}
	}
	same := func(t string) *Resolution {
		m := tierTarget(t, provider, mt)
		if m == "" {
			return nil
		}
		return &Resolution{Target: m, Provider: provider, Used: t, Note: ""}
	}
	crossPick := func(t string) *Resolution {
		if !cross {
			return nil
		}
		for _, p := range mt.Providers {
			pid := p.Provider
			if pid == "" || pid == provider {
				continue
			}
			m := tierTarget(t, pid, mt)
			if m != "" {
				return &Resolution{Target: m, Provider: pid, Used: t, Note: "cross-provider"}
			}
		}
		return nil
	}
	if direct := same(tier); direct != nil {
		return *direct
	}
	if direct := crossPick(tier); direct != nil {
		return *direct
	}
	if tier == "mid" {
		if strong := same("strong"); strong != nil {
			return Resolution{strong.Target, strong.Provider, "strong", "mid->strong fallback"}
		}
		if strong := crossPick("strong"); strong != nil {
			return Resolution{strong.Target, strong.Provider, "strong", "mid->strong fallback [cross-provider]"}
		}
		if fast := same("fast"); fast != nil {
			return Resolution{fast.Target, fast.Provider, "fast", "mid->fast fallback"}
		}
		if fast := crossPick("fast"); fast != nil {
			return Resolution{fast.Target, fast.Provider, "fast", "mid->fast fallback [cross-provider]"}
		}
	}
	return Resolution{Target: "", Provider: "", Used: tier, Note: "no-candidate"}
}

// RecommendRule 确定性阈值表（冷启动先验与兜底）。
func RecommendRule(cls Classification) Recommendation {
	want := "mid"
	if cls.Complexity >= 0.7 {
		want = "strong"
	} else if cls.Complexity <= 0.3 {
		want = "fast"
	}
	return Recommendation{
		Tier:   want,
		Reason: "rule threshold complexity=" + formatFloat(cls.Complexity),
		Conf:   0.5,
	}
}

func formatFloat(x float64) string {
	// 与 JS number→string 的常见形态对齐（两位小数内去掉多余零）
	v := Round2(x)
	if v == math.Trunc(v) {
		return formatInt(int64(v))
	}
	return trimZero(v)
}

// RecommendUcb UCB：mean + 1.2·√(lnN/n)；未探索臂上界∞，多个∞平局按总拉动数轮转。
func RecommendUcb(cls Classification, ucb *UCBState, availableTiers []string) Recommendation {
	tiers := availableTiers
	if len(tiers) == 0 {
		tiers = []string{"fast", "mid", "strong"}
	}
	type scored struct {
		tier string
		ucb  float64
		arm  *Arm
	}
	var scores []scored
	for _, tier := range tiers {
		arm := ucb.Arms[cls.Type+":"+tier]
		if arm == nil {
			arm = &Arm{}
		}
		var u float64
		if arm.N > 0 {
			u = arm.Mean + 1.2*math.Sqrt(math.Log(float64(ucb.Total+1))/float64(arm.N))
		} else {
			u = math.Inf(1)
		}
		scores = append(scores, scored{tier, u, arm})
	}
	best := scores[0]
	for _, s := range scores {
		if s.ucb > best.ucb {
			best = s
		}
	}
	var infs []scored
	for _, s := range scores {
		if math.IsInf(s.ucb, 1) {
			infs = append(infs, s)
		}
	}
	if len(infs) > 1 {
		best = infs[ucb.Total%len(infs)]
	}
	bound := "inf"
	if isFinite(best.ucb) {
		bound = trimZero(Round2(best.ucb))
	}
	conf := 0.2
	if isFinite(best.ucb) {
		conf = 0.6
	}
	return Recommendation{
		Tier:   best.tier,
		Reason: "ucb " + cls.Type + " n=" + formatInt(int64(best.arm.N)) + " mean=" + trimZero(Round2(best.arm.Mean)) + " bound=" + bound,
		Conf:   conf,
	}
}

// RecommendLin 近似 LinUCB：每档线性权重 w·f + 探索项（tn=0 时 0.3，否则 0.8·√(ln total/tn)）。
func RecommendLin(cls Classification, f []float64, lin *LinState, availableTiers []string) Recommendation {
	tiers := availableTiers
	if len(tiers) == 0 {
		tiers = []string{"fast", "mid", "strong"}
	}
	bestTier := ""
	bestScore, bestDot := math.Inf(-1), 0.0
	for _, tier := range tiers {
		w := lin.TierW[tier]
		if w == nil {
			w = make([]float64, 9)
		}
		dot := 0.0
		for i := 0; i < len(f) && i < len(w); i++ {
			dot += w[i] * f[i]
		}
		bonus := 0.3
		if n := lin.TierN[tier]; n > 0 {
			bonus = 0.8 * math.Sqrt(math.Log(float64(lin.Total+1))/float64(n))
		}
		score := dot + bonus
		if score > bestScore {
			bestScore, bestTier, bestDot = score, tier, dot
		}
	}
	conf := 0.1
	if lin.Total >= 50 {
		conf = 0.7
	}
	return Recommendation{
		Tier:   bestTier,
		Reason: "linucb score=" + trimZero(Round2(bestScore)) + " (dot=" + trimZero(Round2(bestDot)) + ")",
		Conf:   conf,
	}
}

// RecommendKnn k-NN：欧氏距离取 k=5 邻居，按邻居平均奖励选档；经验 <5 时 Tier 为空。
func RecommendKnn(cls Classification, f []float64, knn *KNNState, availableTiers []string) Recommendation {
	tiers := availableTiers
	if len(tiers) == 0 {
		tiers = []string{"fast", "mid", "strong"}
	}
	pool := knn.Pool
	if len(pool) < 5 {
		return Recommendation{Tier: "", Reason: "knn cold (" + formatInt(int64(len(pool))) + "/5 seed)", Conf: 0}
	}
	type pair struct {
		d float64
		e Exp
	}
	scored := make([]pair, 0, len(pool))
	for _, e := range pool {
		d := 0.0
		for i := 0; i < len(f) && i < len(e.F); i++ {
			d += (e.F[i] - f[i]) * (e.F[i] - f[i])
		}
		scored = append(scored, pair{d, e})
	}
	sort.SliceStable(scored, func(i, j int) bool { return scored[i].d < scored[j].d })
	k := 5
	if len(scored) < k {
		k = len(scored)
	}
	agg := map[string]*struct {
		n int
		s float64
	}{"fast": {}, "mid": {}, "strong": {}}
	for i := 0; i < k; i++ {
		t := scored[i].e.Tier
		if a := agg[t]; a != nil {
			a.n++
			a.s += scored[i].e.R
		}
	}
	bestTier, bestScore := "", -1.0
	first := true
	for _, tier := range tiers {
		a := agg[tier]
		avg := -1.0
		has := a != nil && a.n > 0
		if has {
			avg = a.s / float64(a.n)
		}
		// 与 JS 一致：首个档位无条件成为候选（无邻居时 score=-1），之后仅在
		// 有邻居且均值更优时替换。
		if first || (has && avg > bestScore) {
			first = false
			bestTier, bestScore = tier, avg
		}
	}
	return Recommendation{
		Tier:   bestTier,
		Reason: "knn k=" + formatInt(int64(k)) + " neighbors score=" + trimZero(Round2(bestScore)),
		Conf:   math.Min(0.8, float64(len(pool))/100),
	}
}

// Outcome 结果回传信号。
type Outcome struct {
	Success    bool
	DtMs       int64
	CostYuan   float64
	ToolErrors int
	Retries    int
	CostCap    float64 // 0 → 默认 0.5
	CostWeight float64 // 0 → 默认 20
}

// Breakdown 奖励分解（可解释落盘）。
type Breakdown struct {
	Base         int     `json:"base"`
	ToolErrors   int     `json:"toolErrors"`
	ToolPenalty  float64 `json:"toolPenalty"`
	Retries      int     `json:"retries"`
	RetryPenalty float64 `json:"retryPenalty"`
	CostYuan     float64 `json:"costYuan"`
	CostPenalty  float64 `json:"costPenalty"`
	DtMs         int64   `json:"dtMs"`
}

// RewardOf 质量代理奖励：干净收尾 1 分起，扣工具失败(0.2/次，封顶 0.6)、
// 模型重试(0.2/次，封顶 0.4)、延迟(>90s −0.3, >30s −0.1)、成本。
func RewardOf(o Outcome, cleanClose bool) (float64, Breakdown) {
	if !cleanClose {
		return 0, Breakdown{ToolErrors: o.ToolErrors, Retries: o.Retries, DtMs: o.DtMs, CostYuan: o.CostYuan}
	}
	reward := 1.0
	toolPenalty := math.Min(0.6, 0.2*float64(o.ToolErrors))
	retryPenalty := math.Min(0.4, 0.2*float64(o.Retries))
	costCap, costWeight := o.CostCap, o.CostWeight
	if costCap == 0 {
		costCap = 0.5
	}
	if costWeight == 0 {
		costWeight = 20
	}
	costPenalty := math.Min(costCap, costWeight*o.CostYuan)
	reward -= toolPenalty
	reward -= retryPenalty
	reward -= costPenalty
	if o.DtMs > 90000 {
		reward -= 0.3
	} else if o.DtMs > 30000 {
		reward -= 0.1
	}
	if reward < 0 {
		reward = 0
	}
	bd := Breakdown{
		Base: 1, ToolErrors: o.ToolErrors, ToolPenalty: toolPenalty,
		Retries: o.Retries, RetryPenalty: retryPenalty,
		CostYuan: o.CostYuan, CostPenalty: costPenalty, DtMs: o.DtMs,
	}
	return Round2(reward), bd
}

// RewardRec 一条待应用的奖励记录。
type RewardRec struct {
	ClsType string
	UcbTier string
	LinTier string
	F       []float64
	Reward  float64
	Chosen  string
	PChosen float64
	Pool    []string
	LinLr   float64
}

// ApplyReward 把一条奖励记录应用到飞轮（UCB/LinUCB/k-NN/EXP3）。
func ApplyReward(s *State, rec *RewardRec) {
	rec.LinLr = 1.0 / (1.0 + float64(s.Lin.TierN[rec.LinTier]))

	key := rec.ClsType + ":" + rec.UcbTier
	arm := s.UCB.Arms[key]
	if arm == nil {
		arm = &Arm{}
		s.UCB.Arms[key] = arm
	}
	arm.N++
	arm.Mean = arm.Mean + (rec.Reward-arm.Mean)/float64(arm.N)
	s.UCB.Total++

	lw := s.Lin.TierW[rec.LinTier]
	if lw == nil || len(lw) < len(rec.F) {
		nw := make([]float64, len(rec.F))
		copy(nw, lw)
		lw = nw
	}
	lr := 1.0 / (1.0 + float64(s.Lin.TierN[rec.LinTier]))
	dot := 0.0
	for i := 0; i < len(rec.F); i++ {
		dot += lw[i] * rec.F[i]
	}
	for i := 0; i < len(rec.F); i++ {
		lw[i] += lr * (rec.Reward - dot) * rec.F[i]
	}
	s.Lin.TierW[rec.LinTier] = lw
	s.Lin.TierN[rec.LinTier]++
	s.Lin.Total++

	s.KNN.Pool = append(s.KNN.Pool, Exp{F: rec.F, Tier: rec.UcbTier, R: rec.Reward})
	if len(s.KNN.Pool) > 400 {
		s.KNN.Pool = s.KNN.Pool[1:]
	}

	poolLen := float64(len(rec.Pool))
	if rec.PChosen > 0 && poolLen > 0 {
		s.Exp3.Weights[rec.Chosen] = s.Exp3.Weights[rec.Chosen] *
			math.Exp(0.3*(rec.Reward/rec.PChosen)/poolLen)
	}
	s.Exp3.Total++

	// 权重防爆保险：整体除以最大值（γ 混合已保证采样下限；此处防 float 溢出）。
	// 关键是"地板"：反复归一化会让小权重下溢到精确 0（0×任何数=0，永久不可恢复）。
	// 地板把最大权重比钳在 1e6 内——比例过宽（如 1e12）时，被冷落专家靠 γ 地板
	// 采样翻身需要上千轮，主导权振荡周期过长；1e6 让恢复以百轮计。
	if m := maxWeight(s.Exp3.Weights); m > 1e50 {
		for k := range s.Exp3.Weights {
			w := s.Exp3.Weights[k] / m
			if w < 1e-6 {
				w = 1e-6
			}
			s.Exp3.Weights[k] = w
		}
	}
}

func maxWeight(w map[string]float64) float64 {
	m := 0.0
	for _, v := range w {
		if v > m {
			m = v
		}
	}
	return m
}

// CorrectReward 反馈结算修正：把已应用奖励改为 newReward。
func CorrectReward(s *State, rec *RewardRec, newReward float64) float64 {
	delta := newReward - rec.Reward
	if delta == 0 {
		return 0
	}
	if arm := s.UCB.Arms[rec.ClsType+":"+rec.UcbTier]; arm != nil && arm.N > 0 {
		arm.Mean += delta / float64(arm.N)
	}
	lw := s.Lin.TierW[rec.LinTier]
	if lw != nil && len(lw) >= len(rec.F) {
		lr := rec.LinLr
		if lr == 0 {
			lr = 1.0 / (1.0 + float64(s.Lin.TierN[rec.LinTier]))
		}
		for i := 0; i < len(rec.F); i++ {
			lw[i] += lr * delta * rec.F[i]
		}
	}
	s.KNN.Pool = append(s.KNN.Pool, Exp{F: rec.F, Tier: rec.UcbTier, R: newReward})
	poolLen := float64(len(rec.Pool))
	if rec.PChosen > 0 && poolLen > 0 {
		s.Exp3.Weights[rec.Chosen] = s.Exp3.Weights[rec.Chosen] *
			math.Exp(0.3*delta/(rec.PChosen*poolLen))
	}
	rec.Reward = newReward
	return delta
}

// MetaResult EXP3 采样结果。
type MetaResult struct {
	Chosen string
	Ps     map[string]float64
	Pool   []string
	Rec    Recommendation // 被选中专家的推荐（byName[chosen]）
}

// MetaPick EXP3 元选择器：把 {UCB, LinUCB, k-NN, rule} 当臂，按权重软最大采样，
// 被选策略按重要性加权更新（reward / p_chosen）。
//
// v0.2：标准 EXP3 的 γ 混合——p_n = (1−γ)·w_n/Σw + γ/K，保证每位专家
// 至少 γ/K 的采样概率。没有它，早期复合增长的专家权重会指数爆炸
// （仿真复现过 2e141 量级），其余专家概率永久归零、无法恢复。
func MetaPick(recs map[string]Recommendation, e *Exp3State, r float64) MetaResult {
	pool := buildPool(e, recs)

	total := 0.0
	for _, n := range pool {
		total += e.Weights[n]
	}
	k := float64(len(pool))
	gamma := Gamma
	if e.Gamma > 0 {
		gamma = e.Gamma
	}
	ps := map[string]float64{}
	for _, n := range pool {
		raw := 1 / k
		if total > 0 {
			raw = e.Weights[n] / total
		}
		ps[n] = (1-gamma)*raw + gamma/k
	}
	chosen := "rule"
	for _, n := range pool {
		if r < ps[n] {
			chosen = n
			break
		}
		r -= ps[n]
	}
	return MetaResult{Chosen: chosen, Ps: ps, Pool: pool, Rec: recs[chosen]}
}

// buildPool 按 JS 语义构建臂池：[ucb, (linucb), (knn), rule]，
// linucb/knn 需已"毕业"且给出有效档位。
func buildPool(e *Exp3State, recs map[string]Recommendation) []string {
	pool := []string{"ucb"}
	if e.LinGraduated && recs["lin"].Tier != "" {
		pool = append(pool, "linucb")
	}
	if e.KnnGraduated && recs["knn"].Tier != "" {
		pool = append(pool, "knn")
	}
	pool = append(pool, "rule")
	return pool
}

func isFinite(v float64) bool {
	return !math.IsInf(v, 0) && !math.IsNaN(v)
}

func formatInt(v int64) string {
	return strconv.FormatInt(v, 10)
}

func trimZero(v float64) string {
	s := strconv.FormatFloat(v, 'f', -1, 64)
	return s
}
