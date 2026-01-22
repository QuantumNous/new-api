package logger

import (
	"context"
	"encoding/hex"
	"fmt"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
)

func LogJSONUnmarshalError(ctx context.Context, scope string, err error, body []byte) {
	if err == nil {
		return
	}

	limit := 8 << 10 // 8KB
	if common.DebugEnabled {
		limit = 64 << 10 // 64KB
	}

	preview := body
	truncated := false
	if len(preview) > limit {
		preview = preview[:limit]
		truncated = true
	}

	var previewStr string
	if utf8.Valid(preview) {
		previewStr = string(preview)
	} else {
		previewStr = hex.EncodeToString(preview)
	}
	previewStr = common.MaskSensitiveInfo(previewStr)

	LogError(ctx, fmt.Sprintf(
		"%s: json unmarshal failed: %v (body_len=%d, truncated=%t, preview=%q)",
		scope,
		err,
		len(body),
		truncated,
		previewStr,
	))
}
