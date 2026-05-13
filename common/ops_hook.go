package common

import "context"

// EmitAsyncBillingOpsLog is an optional hook set by Lynxton (after applog.Init) to emit structured JSON
// for async task billing (worker has no *gin.Context). When nil, new-api stays silent on this channel.
var EmitAsyncBillingOpsLog func(ctx context.Context, msg string, kv map[string]any)
