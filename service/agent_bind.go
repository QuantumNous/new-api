package service

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

// TryBindUserToAgent validates an agent account and performs an atomic first
// bind. Binding errors are returned to tests/callers but should not be used to
// fail registration or redemption flows.
func TryBindUserToAgent(userID int, agentID int) (bool, error) {
	if userID <= 0 || agentID <= 0 || userID == agentID {
		return false, nil
	}

	var account model.AgentAccount
	if err := model.DB.Select("user_id, status").Where("user_id = ?", agentID).First(&account).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, nil
		}
		common.SysLog(fmt.Sprintf("failed to validate agent account %d for customer %d: %v", agentID, userID, err))
		return false, err
	}
	if account.Status != model.AgentAccountStatusActive {
		return false, nil
	}

	bound, err := model.TryBindUserToAgent(userID, agentID)
	if err != nil {
		common.SysLog(fmt.Sprintf("failed to bind customer %d to agent %d: %v", userID, agentID, err))
		return false, err
	}
	if bound {
		common.SysLog(fmt.Sprintf("customer %d bound to agent %d", userID, agentID))
	}
	return bound, nil
}
