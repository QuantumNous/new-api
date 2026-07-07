package common

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// 图片/视频"模型尺寸/参数"配置(超管在系统设置里维护,存 OptionMap 的
// ImageModelSizeConfig / VideoModelConfig 两个 JSON 键)。这份配置原本只驱动
// 前端体验区的可选值,这里额外把它作为**后端接口参数校验**的来源:某模型显式
// 配了 sizes/durations 时,请求值必须落在允许集内,否则报错并列出允许值;模型
// 未配置(或该维度为空)则不做任何限制(沿用调用方的默认校验)。
//
// JSON 结构(与前端 parseImageSizeConfig / parseVideoModelConfig 对应):
//
//	Image: { "default":[...], "models": { "name": {"sizes":[],"capabilities":[]} | [sizes...] } }
//	Video: { "default": {"sizes":[],"durations":[]},
//	         "models": { "name": {"sizes":[],"durations":[],"capabilities":[]} } }
//
// 注意:default 段仅供前端兜底,后端**不**用它做校验(未配置的模型不加限制)。

var digitsPrefixRe = regexp.MustCompile(`^\d+`)
var pOnlyRe = regexp.MustCompile(`^\d+p$`)

// normalizeSizeToken 与前端 normalizeVideoSize 对齐:小写、去空格、分隔符统一为 x,
// 纯 "\d+p" 形态转大写(如 720p -> 720P)。图片尺寸("1024x1024")同样适用。
func normalizeSizeToken(s string) string {
	v := strings.ToLower(strings.TrimSpace(s))
	v = strings.ReplaceAll(v, " ", "")
	for _, sep := range []string{"×", "✕", "╳", "*"} {
		v = strings.ReplaceAll(v, sep, "x")
	}
	if pOnlyRe.MatchString(v) {
		return strings.ToUpper(v)
	}
	return v
}

func containsNormalizedSize(allowed []string, size string) bool {
	target := normalizeSizeToken(size)
	for _, a := range allowed {
		if normalizeSizeToken(a) == target {
			return true
		}
	}
	return false
}

// toStringList 把 JSON 数组([]any of string/number)转成去空字符串列表。
func toStringList(v any) []string {
	arr, ok := v.([]any)
	if !ok {
		return nil
	}
	out := make([]string, 0, len(arr))
	for _, item := range arr {
		var s string
		switch t := item.(type) {
		case string:
			s = strings.TrimSpace(t)
		case float64:
			s = strconv.FormatFloat(t, 'f', -1, 64)
		}
		if s != "" {
			out = append(out, s)
		}
	}
	return out
}

func normalizeSizeSet(list []string) []string {
	out := make([]string, 0, len(list))
	for _, s := range list {
		if n := normalizeSizeToken(s); n != "" {
			out = append(out, n)
		}
	}
	return out
}

// modelEntrySizes 取某模型条目的 sizes:兼容新形态({sizes:[...]})与旧形态(值直接是数组)。
func modelEntrySizes(entry any) []string {
	switch e := entry.(type) {
	case []any: // 旧形态:值为尺寸数组
		return toStringList(e)
	case map[string]any:
		return toStringList(e["sizes"])
	}
	return nil
}

func modelEntryDurations(entry any) []string {
	if e, ok := entry.(map[string]any); ok {
		return toStringList(e["durations"])
	}
	return nil
}

// modelsMap 从原始配置里取 models 子对象。
func modelsMap(raw string) map[string]any {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	var cfg map[string]any
	if err := UnmarshalJsonStr(raw, &cfg); err != nil {
		return nil
	}
	models, _ := cfg["models"].(map[string]any)
	return models
}

// ---- 图片尺寸配置 ----

// ImageSizeAllowedForModel 返回该模型配置的允许尺寸集及是否已配置(非空)。
func ImageSizeAllowedForModel(candidates ...string) (allowed []string, configured bool) {
	OptionMapRWMutex.RLock()
	raw := OptionMap["ImageModelSizeConfig"]
	OptionMapRWMutex.RUnlock()
	models := modelsMap(raw)
	if models == nil {
		return nil, false
	}
	for _, name := range candidates {
		if entry, ok := models[name]; ok {
			if sizes := normalizeSizeSet(modelEntrySizes(entry)); len(sizes) > 0 {
				return sizes, true
			}
		}
	}
	return nil, false
}

// ValidateImageSizeForModel 校验图片尺寸:模型未配置尺寸则放行;配置了则要求
// size 落在允许集内,否则返回带允许值的错误。size 为空时不校验(无值可校验)。
func ValidateImageSizeForModel(size string, candidates ...string) error {
	if strings.TrimSpace(size) == "" {
		return nil
	}
	allowed, configured := ImageSizeAllowedForModel(candidates...)
	if !configured || containsNormalizedSize(allowed, size) {
		return nil
	}
	return fmt.Errorf("模型 %s 不支持尺寸 %q,仅支持: %s",
		firstNonEmptyStr(candidates...), size, strings.Join(allowed, ", "))
}

// ---- 视频参数配置 ----

func normalizeDurationSet(list []string) []string {
	out := make([]string, 0, len(list))
	for _, d := range list {
		if t := strings.TrimSpace(d); t != "" {
			out = append(out, t)
		}
	}
	return out
}

// durationMatches 先按 trim 后字符串精确匹配(体验区下拉即取配置原值),再退化到
// 前导整数相等(兼容 "5" / "5s" / "5秒" 与请求的整数秒),减少误拒。
func durationMatches(allowed []string, candidates []string) bool {
	for _, want := range candidates {
		w := strings.TrimSpace(want)
		if w == "" {
			continue
		}
		wi := digitsPrefixRe.FindString(w)
		for _, a := range allowed {
			if a == w {
				return true
			}
			if wi != "" && digitsPrefixRe.FindString(a) == wi {
				return true
			}
		}
	}
	return false
}

// VideoParamsAllowedForModel 返回该模型配置的允许尺寸/时长集及是否已配置任一维度。
func VideoParamsAllowedForModel(candidates ...string) (sizes, durations []string, configured bool) {
	OptionMapRWMutex.RLock()
	raw := OptionMap["VideoModelConfig"]
	OptionMapRWMutex.RUnlock()
	models := modelsMap(raw)
	if models == nil {
		return nil, nil, false
	}
	for _, name := range candidates {
		entry, ok := models[name]
		if !ok {
			continue
		}
		s := normalizeSizeSet(modelEntrySizes(entry))
		d := normalizeDurationSet(modelEntryDurations(entry))
		if len(s) > 0 || len(d) > 0 {
			return s, d, true
		}
	}
	return nil, nil, false
}

// ValidateVideoParamsForModel 校验视频尺寸与时长:模型未配置则放行;配置了对应维度
// 则要求请求值落在允许集内。size 为空或 seconds 无值的维度跳过(无值可校验)。
func ValidateVideoParamsForModel(size string, seconds int, secondsStr string, candidates ...string) error {
	allowedSizes, allowedDurations, configured := VideoParamsAllowedForModel(candidates...)
	if !configured {
		return nil
	}
	if len(allowedSizes) > 0 && strings.TrimSpace(size) != "" && !containsNormalizedSize(allowedSizes, size) {
		return fmt.Errorf("模型 %s 不支持尺寸 %q,仅支持: %s",
			firstNonEmptyStr(candidates...), size, strings.Join(allowedSizes, ", "))
	}
	if len(allowedDurations) > 0 {
		var cands []string
		if seconds > 0 {
			cands = append(cands, strconv.Itoa(seconds))
		}
		if strings.TrimSpace(secondsStr) != "" {
			cands = append(cands, secondsStr)
		}
		if len(cands) > 0 && !durationMatches(allowedDurations, cands) {
			return fmt.Errorf("模型 %s 不支持时长 %s,仅支持: %s",
				firstNonEmptyStr(candidates...), strings.Join(cands, "/"), strings.Join(allowedDurations, ", "))
		}
	}
	return nil
}

func firstNonEmptyStr(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return "model"
}

var wxhRe = regexp.MustCompile(`^(\d+)x(\d+)$`)

// AspectRatioFromSize 把 "WxH" 化简为 "W:H"(约分);无法解析(如 "720P")返回空串。
func AspectRatioFromSize(size string) string {
	m := wxhRe.FindStringSubmatch(normalizeSizeToken(size))
	if m == nil {
		return ""
	}
	w, _ := strconv.Atoi(m[1])
	h, _ := strconv.Atoi(m[2])
	if w <= 0 || h <= 0 {
		return ""
	}
	g := w
	for b := h; b != 0; {
		g, b = b, g%b
	}
	return fmt.Sprintf("%d:%d", w/g, h/g)
}
