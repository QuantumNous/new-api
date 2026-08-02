package taskcommon

import (
	"math"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/tidwall/gjson"
)

// DefaultPerSecondPrechargeSeconds is used when the client omits duration/seconds.
// Final charge is settled against upstream actual duration (refund / top-up).
const DefaultPerSecondPrechargeSeconds = 15

// ExtractDurationSecondsFromJSON reads actual video duration (seconds) from common
// async-video poll / result payloads (7tai, OpenAI Videos, Volcengine wrappers, etc.).
func ExtractDurationSecondsFromJSON(raw []byte) float64 {
	if len(raw) == 0 {
		return 0
	}
	for _, path := range []string{
		"data.data.duration",
		"data.duration",
		"duration",
		"data.data.seconds",
		"data.seconds",
		"seconds",
		"data.metadata.duration",
		"metadata.duration",
		"data.data.metadata.duration",
	} {
		if sec := durationNumber(gjson.GetBytes(raw, path)); sec > 0 {
			return sec
		}
	}
	return 0
}

func durationNumber(v gjson.Result) float64 {
	if !v.Exists() {
		return 0
	}
	switch v.Type {
	case gjson.Number:
		if n := v.Float(); n > 0 {
			return n
		}
	case gjson.String:
		s := strings.TrimSpace(v.String())
		if s == "" {
			return 0
		}
		if n, err := strconv.ParseFloat(s, 64); err == nil && n > 0 {
			return n
		}
	}
	return 0
}

// QuotaFromPerSecondModelPrice computes wallet quota for ModelPrice × seconds × group × other ratios.
// The "seconds" key in otherRatios is ignored (replaced by actualSeconds).
func QuotaFromPerSecondModelPrice(modelPrice, actualSeconds, groupRatio float64, otherRatios map[string]float64) int {
	if modelPrice <= 0 || actualSeconds <= 0 {
		return 0
	}
	if groupRatio <= 0 {
		groupRatio = 1
	}
	mult := actualSeconds
	for k, r := range otherRatios {
		if k == "seconds" || r <= 0 || r == 1 {
			continue
		}
		mult *= r
	}
	q := modelPrice * groupRatio * mult * common.QuotaPerUnit
	if q <= 0 {
		return 0
	}
	return int(math.Round(q))
}
