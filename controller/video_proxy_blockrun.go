package controller

import (
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/task/blockrunvideo"
)

// extractBlockRunVideoURL resolves the real upstream MP4 URL for a BlockRunVideo
// (api2/blockrun) task. The real blockrun.ai URL is preserved inside task.Data
// (the api2 response body); the customer-facing ResultURL is the new-api proxy
// URL, so VideoProxy needs this lookup to fetch the actual file server-side.
func extractBlockRunVideoURL(task *model.Task) string {
	return blockrunvideo.ExtractUpstreamVideoURL(task.Data)
}
