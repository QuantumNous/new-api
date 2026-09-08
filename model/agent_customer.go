package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
)

// TryBindUserToAgent atomically assigns the first agent that owns a customer.
// A non-zero existing owner is never replaced.
func TryBindUserToAgent(userID int, agentID int) (bool, error) {
	if userID <= 0 || agentID <= 0 {
		return false, nil
	}

	result := DB.Model(&User{}).
		Where("id = ? AND bound_agent_id = 0", userID).
		Updates(map[string]interface{}{
			"bound_agent_id": agentID,
			"bound_at":       common.GetTimestamp(),
		})
	if result.Error != nil {
		return false, result.Error
	}
	if result.RowsAffected != 1 {
		return false, nil
	}
	if err := InvalidateUserCache(userID); err != nil {
		return true, err
	}
	return true, nil
}

// GetBoundAgentId returns the immutable owner of a customer, or zero when the
// customer has not been assigned to an agent.
func GetBoundAgentId(userID int) (int, error) {
	if userID <= 0 {
		return 0, errors.New("invalid user id")
	}
	var boundAgentID int
	if err := DB.Model(&User{}).Where("id = ?", userID).Select("bound_agent_id").Scan(&boundAgentID).Error; err != nil {
		return 0, err
	}
	return boundAgentID, nil
}
