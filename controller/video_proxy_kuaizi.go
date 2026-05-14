package controller

import (
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/task/kuaizi"
)

// extractKuaiziVideoURL resolves the real upstream MP4 URL for a Kuaizi video
// task. The URL is preserved inside task.Data (the upstream {code,message,data}
// envelope from /status); customer-facing ResultURL is the new-api proxy URL,
// so VideoProxy needs this lookup to fetch the actual file server-side.
func extractKuaiziVideoURL(task *model.Task) string {
	return kuaizi.ExtractUpstreamVideoURL(task.Data)
}
