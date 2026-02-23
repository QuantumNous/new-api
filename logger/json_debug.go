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
	requestID := getRequestIDFromContext(ctx)
	if ctx == nil {
		ctx = context.WithValue(context.Background(), common.RequestIdKey, requestID)
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
		"%s: json unmarshal failed: %v (request_id=%s, body_len=%d, truncated=%t, preview=%q)",
		scope,
		err,
		requestID,
		len(body),
		truncated,
		previewStr,
	))
}

func getRequestIDFromContext(ctx context.Context) string {
	if ctx == nil {
		return "SYSTEM"
	}
	if id := ctx.Value(common.RequestIdKey); id != nil {
		if idStr, ok := id.(string); ok && idStr != "" {
			return idStr
		}
		idStr := fmt.Sprintf("%v", id)
		if idStr != "" && idStr != "<nil>" {
			return idStr
		}
	}
	return "SYSTEM"
}
