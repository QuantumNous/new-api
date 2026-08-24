package controller

import (
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/task/byteplus"
)

func extractBytePlusVideoURL(task *model.Task) string {
	return byteplus.ExtractUpstreamVideoURL(task.Data)
}
