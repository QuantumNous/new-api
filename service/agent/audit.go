package agent

import (
	"context"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

func WriteAudit(ctx context.Context, userId int, sessionId int, toolName string, args interface{}, result interface{}, status string, errMsg string, needsConfirm bool, confirmed bool, start time.Time) {
	argsBytes, _ := common.Marshal(args)
	resultBytes, _ := common.Marshal(result)
	log := &model.AgentAuditLog{
		UserId:       userId,
		SessionId:    sessionId,
		ToolName:     toolName,
		Args:         Sanitize(string(argsBytes)),
		Result:       Sanitize(string(resultBytes)),
		Status:       status,
		ErrorMsg:     Sanitize(errMsg),
		NeedsConfirm: needsConfirm,
		Confirmed:    confirmed,
		DurationMs:   int(time.Since(start).Milliseconds()),
	}
	_ = model.DB.WithContext(ctx).Create(log).Error
}
