package service

import (
	"fmt"
	"strconv"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
	privacyfilter "privacyfilter/filter"
)

const PrivacyFilterRedactedCountContextKey = "privacy_filter_redacted_count"

type PrivacyFilterStats struct {
	Hit   bool
	Count int
}

var privacyFilterCache struct {
	sync.Mutex
	path   string
	filter *privacyfilter.Filter
}

func IsPrivacyFilterEnabled() bool {
	return operation_setting.GetPrivacyFilterSetting().Enabled
}

func RedactPrivacyText(text string) (string, PrivacyFilterStats, error) {
	if !IsPrivacyFilterEnabled() || text == "" {
		return text, PrivacyFilterStats{}, nil
	}
	f, err := getPrivacyFilter()
	if err != nil {
		return "", PrivacyFilterStats{}, err
	}
	res := f.Redact(text)
	return res.Redacted, PrivacyFilterStats{
		Hit:   res.Hit,
		Count: res.Count,
	}, nil
}

func ApplyPrivacyFilterToJSON(c *gin.Context, data []byte) ([]byte, error) {
	redacted, stats, err := RedactPrivacyJSON(data)
	if err != nil {
		return nil, err
	}
	RecordPrivacyFilterStats(c, stats)
	return redacted, nil
}

func RedactPrivacyJSON(data []byte) ([]byte, PrivacyFilterStats, error) {
	if !IsPrivacyFilterEnabled() || len(data) == 0 {
		return data, PrivacyFilterStats{}, nil
	}
	if !gjson.ValidBytes(data) {
		return nil, PrivacyFilterStats{}, fmt.Errorf("invalid json")
	}

	root := gjson.ParseBytes(data)
	stats, replacements, err := collectPrivacyJSONReplacements(root, "", "")
	if err != nil {
		return nil, PrivacyFilterStats{}, err
	}
	if !stats.Hit {
		return data, stats, nil
	}

	redacted := data
	for _, replacement := range replacements {
		redacted, err = sjson.SetBytes(redacted, replacement.path, replacement.value)
		if err != nil {
			return nil, PrivacyFilterStats{}, err
		}
	}
	return redacted, stats, nil
}

func ApplyPrivacyFilterToFormValues(c *gin.Context, values map[string][]string) error {
	if !IsPrivacyFilterEnabled() || len(values) == 0 {
		return nil
	}
	var total PrivacyFilterStats
	for key, items := range values {
		if !shouldRedactPrivacyValue(key) {
			continue
		}
		for i := range items {
			redacted, stats, err := RedactPrivacyText(items[i])
			if err != nil {
				return err
			}
			items[i] = redacted
			total.Add(stats)
		}
		values[key] = items
	}
	RecordPrivacyFilterStats(c, total)
	return nil
}

func RecordPrivacyFilterStats(c *gin.Context, stats PrivacyFilterStats) {
	if c == nil || !stats.Hit {
		return
	}
	prevCount := c.GetInt(PrivacyFilterRedactedCountContextKey)
	c.Set(PrivacyFilterRedactedCountContextKey, prevCount+stats.Count)
}

func PrivacyFilterError(err error) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("privacy filter failed: %w", err)
}

func getPrivacyFilter() (*privacyfilter.Filter, error) {
	setting := operation_setting.GetPrivacyFilterSetting()
	path := strings.TrimSpace(setting.GitleaksTOML)

	privacyFilterCache.Lock()
	defer privacyFilterCache.Unlock()

	if privacyFilterCache.filter != nil && privacyFilterCache.path == path {
		return privacyFilterCache.filter, nil
	}

	f, err := privacyfilter.New(path)
	if err != nil {
		return nil, err
	}
	privacyFilterCache.path = path
	privacyFilterCache.filter = f
	return f, nil
}

func (s *PrivacyFilterStats) Add(other PrivacyFilterStats) {
	if other.Hit {
		s.Hit = true
	}
	s.Count += other.Count
}

type privacyJSONReplacement struct {
	path  string
	value string
}

func collectPrivacyJSONReplacements(value gjson.Result, path string, parentKey string) (PrivacyFilterStats, []privacyJSONReplacement, error) {
	if value.IsObject() {
		var total PrivacyFilterStats
		var replacements []privacyJSONReplacement
		var walkErr error
		value.ForEach(func(key, child gjson.Result) bool {
			keyName := key.String()
			childStats, childReplacements, err := collectPrivacyJSONReplacements(child, joinPrivacyJSONPath(path, escapeSJSONPathSegment(keyName)), keyName)
			if err != nil {
				walkErr = err
				return false
			}
			total.Add(childStats)
			replacements = append(replacements, childReplacements...)
			return true
		})
		return total, replacements, walkErr
	}

	if value.IsArray() {
		var total PrivacyFilterStats
		var replacements []privacyJSONReplacement
		var walkErr error
		index := 0
		value.ForEach(func(_, child gjson.Result) bool {
			childStats, childReplacements, err := collectPrivacyJSONReplacements(child, joinPrivacyJSONPath(path, strconv.Itoa(index)), parentKey)
			index++
			if err != nil {
				walkErr = err
				return false
			}
			total.Add(childStats)
			replacements = append(replacements, childReplacements...)
			return true
		})
		return total, replacements, walkErr
	}

	if value.Type == gjson.String && shouldRedactPrivacyValue(parentKey) {
		redacted, stats, err := RedactPrivacyText(value.String())
		if err != nil {
			return PrivacyFilterStats{}, nil, err
		}
		if stats.Hit {
			return stats, []privacyJSONReplacement{{path: path, value: redacted}}, nil
		}
		return stats, nil, nil
	}

	return PrivacyFilterStats{}, nil, nil
}

func joinPrivacyJSONPath(parent string, child string) string {
	if parent == "" {
		return child
	}
	return parent + "." + child
}

func escapeSJSONPathSegment(segment string) string {
	if !strings.ContainsAny(segment, ".*?\\") {
		return segment
	}
	var builder strings.Builder
	builder.Grow(len(segment) + 4)
	for i := 0; i < len(segment); i++ {
		switch segment[i] {
		case '.', '*', '?', '\\':
			builder.WriteByte('\\')
		}
		builder.WriteByte(segment[i])
	}
	return builder.String()
}

func shouldRedactPrivacyValue(key string) bool {
	switch strings.ToLower(key) {
	case "content", "text", "input", "prompt", "prefix", "suffix",
		"instruction", "instructions", "query", "document", "documents",
		"system", "title", "tags", "gpt_description_prompt", "description",
		"negative_prompt", "ref_text":
		return true
	default:
		return false
	}
}
