package model

import (
	"context"
	"errors"
	"sort"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type AgentCustomerBackfillReport struct {
	Bound      int `json:"bound"`
	Preserved  int `json:"preserved"`
	Unresolved int `json:"unresolved"`
}

type agentCustomerBindingCandidate struct {
	UserID   int
	AgentID  int
	EventAt  int64
	Source   int
	SourceID int
}

// BackfillAgentCustomerBindings reconstructs first-bind ownership from the
// existing invitation and redeemed-code history. Existing ownership is never
// overwritten, so repeated and concurrent executions are safe.
func BackfillAgentCustomerBindings(ctx context.Context, batchSize int) (AgentCustomerBackfillReport, error) {
	if batchSize <= 0 {
		return AgentCustomerBackfillReport{}, errors.New("invalid agent customer backfill batch size")
	}

	var agentIDs []int
	if err := DB.WithContext(ctx).Model(&AgentAccount{}).Pluck("user_id", &agentIDs).Error; err != nil {
		return AgentCustomerBackfillReport{}, err
	}
	validAgents := make(map[int]struct{}, len(agentIDs))
	for _, agentID := range agentIDs {
		validAgents[agentID] = struct{}{}
	}

	var redemptions []Redemption
	if err := DB.WithContext(ctx).
		Select("id, used_user_id, agent_user_id, created_time, redeemed_time").
		Where("status = ? AND used_user_id > 0 AND agent_user_id > 0", common.RedemptionCodeStatusUsed).
		Order("redeemed_time ASC").Order("id ASC").Find(&redemptions).Error; err != nil {
		return AgentCustomerBackfillReport{}, err
	}
	codeCandidates := make(map[int][]agentCustomerBindingCandidate)
	for _, redemption := range redemptions {
		eventAt := redemption.RedeemedTime
		if eventAt == 0 {
			eventAt = redemption.CreatedTime
		}
		codeCandidates[redemption.UsedUserId] = append(codeCandidates[redemption.UsedUserId], agentCustomerBindingCandidate{
			UserID: redemption.UsedUserId, AgentID: redemption.AgentUserId,
			EventAt: eventAt, Source: 1, SourceID: redemption.Id,
		})
	}

	var users []User
	if err := DB.WithContext(ctx).
		Select("id, inviter_id, bound_agent_id, bound_at, created_at").
		Find(&users).Error; err != nil {
		return AgentCustomerBackfillReport{}, err
	}

	report := AgentCustomerBackfillReport{}
	selected := make([]agentCustomerBindingCandidate, 0)
	for _, user := range users {
		if user.BoundAgentId > 0 {
			report.Preserved++
			continue
		}
		candidates := make([]agentCustomerBindingCandidate, 0, 1+len(codeCandidates[user.Id]))
		if user.InviterId > 0 {
			candidates = append(candidates, agentCustomerBindingCandidate{
				UserID: user.Id, AgentID: user.InviterId, EventAt: user.CreatedAt,
				Source: 0, SourceID: user.Id,
			})
		}
		candidates = append(candidates, codeCandidates[user.Id]...)
		if len(candidates) == 0 {
			continue
		}
		valid := candidates[:0]
		for _, candidate := range candidates {
			if candidate.UserID == candidate.AgentID {
				continue
			}
			if _, ok := validAgents[candidate.AgentID]; ok {
				valid = append(valid, candidate)
			}
		}
		if len(valid) == 0 {
			report.Unresolved++
			continue
		}
		sort.SliceStable(valid, func(i, j int) bool {
			left, right := valid[i], valid[j]
			if left.EventAt != right.EventAt {
				return left.EventAt < right.EventAt
			}
			if left.Source != right.Source {
				return left.Source < right.Source
			}
			return left.SourceID < right.SourceID
		})
		selected = append(selected, valid[0])
	}

	for start := 0; start < len(selected); start += batchSize {
		end := start + batchSize
		if end > len(selected) {
			end = len(selected)
		}
		if err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			for _, candidate := range selected[start:end] {
				result := tx.Model(&User{}).
					Where("id = ? AND bound_agent_id = 0", candidate.UserID).
					Updates(map[string]interface{}{
						"bound_agent_id": candidate.AgentID,
						"bound_at":       candidate.EventAt,
					})
				if result.Error != nil {
					return result.Error
				}
				if result.RowsAffected == 1 {
					report.Bound++
					continue
				}
				report.Preserved++
			}
			return nil
		}); err != nil {
			return report, err
		}
	}
	return report, nil
}
