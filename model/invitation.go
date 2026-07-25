package model

import "strings"

type InvitationRecord struct {
	Id             int    `json:"id"`
	MaskedIdentity string `json:"masked_identity"`
	RegisteredAt   int64  `json:"registered_at"`
	Status         string `json:"status"`
	GrantedAt      int64  `json:"granted_at"`
	RewardQuota    int    `json:"reward_quota"`
	Reason         string `json:"reason"`
	// v2 (subscription-mode) fields; zero for legacy records
	UnlockAt int64 `json:"unlock_at"`
}

// v2 display statuses layered on top of the legacy pending/granted/blocked set
const (
	InvitationRecordStatusLocked  = "locked"
	InvitationRecordStatusRevoked = "revoked"
)

type InvitationPage struct {
	Items        []InvitationRecord
	Total        int64
	PendingCount int64
}

type invitationUserRow struct {
	Id                      int
	Username                string
	Email                   string
	CreatedAt               int64
	InviteRewardStatus      string
	InviteRewardGrantedAt   int64
	InviteRewardBlockReason string
}

func MaskInvitationIdentity(email, username string) string {
	if local, domain, ok := strings.Cut(email, "@"); ok && local != "" && domain != "" && !strings.Contains(domain, "@") {
		return string([]rune(local)[0]) + "***@" + domain
	}

	runes := []rune(username)
	switch len(runes) {
	case 0:
		return "***"
	case 1:
		return "*"
	case 2:
		return string(runes[0]) + "*"
	default:
		return string(runes[0]) + "***" + string(runes[len(runes)-1])
	}
}

func GetInvitationPage(inviterId, offset, limit int) (*InvitationPage, error) {
	page := &InvitationPage{Items: make([]InvitationRecord, 0)}
	invitees := DB.Model(&User{}).Where("inviter_id = ?", inviterId)
	if err := invitees.Count(&page.Total).Error; err != nil {
		return nil, err
	}
	if err := DB.Model(&User{}).
		Where("inviter_id = ? AND invite_reward_status = ?", inviterId, InviteRewardStatusPending).
		Count(&page.PendingCount).Error; err != nil {
		return nil, err
	}

	var rows []invitationUserRow
	if err := DB.Model(&User{}).
		Select("id", "username", "email", "created_at", "invite_reward_status", "invite_reward_granted_at", "invite_reward_block_reason").
		Where("inviter_id = ?", inviterId).
		Order("created_at DESC").
		Order("id DESC").
		Offset(offset).
		Limit(limit).
		Scan(&rows).Error; err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return page, nil
	}

	inviteeIds := make([]int, 0, len(rows))
	for _, row := range rows {
		inviteeIds = append(inviteeIds, row.Id)
	}
	var events []InviteRewardEvent
	if err := DB.Model(&InviteRewardEvent{}).
		Select("invitee_id", "inviter_reward_quota", "reason").
		Where("inviter_id = ? AND invitee_id IN ?", inviterId, inviteeIds).
		Find(&events).Error; err != nil {
		return nil, err
	}
	eventsByInviteeId := make(map[int]InviteRewardEvent, len(events))
	for _, event := range events {
		eventsByInviteeId[event.InviteeId] = event
	}
	subRewardsByInviteeId, err := GetInviteSubscriptionRewardsByInviteeIds(inviterId, inviteeIds)
	if err != nil {
		return nil, err
	}

	for _, row := range rows {
		record := InvitationRecord{
			Id:             row.Id,
			MaskedIdentity: MaskInvitationIdentity(row.Email, row.Username),
			RegisteredAt:   row.CreatedAt,
			GrantedAt:      row.InviteRewardGrantedAt,
		}
		if subReward, ok := subRewardsByInviteeId[row.Id]; ok {
			applyInviteSubscriptionReward(&record, subReward)
		} else {
			normalizeInvitationRecord(&record, row, eventsByInviteeId)
		}
		page.Items = append(page.Items, record)
	}
	return page, nil
}

// applyInviteSubscriptionReward overlays a v2 (subscription-mode) reward onto
// the invitation record; v2 rows are authoritative for their invitee.
func applyInviteSubscriptionReward(record *InvitationRecord, reward InviteSubscriptionReward) {
	record.RewardQuota = reward.RewardQuota
	record.UnlockAt = reward.UnlockAt
	switch reward.Status {
	case InviteSubRewardStatusPending:
		record.Status = InvitationRecordStatusLocked
	case InviteSubRewardStatusGranted:
		record.Status = InviteRewardStatusGranted
		record.GrantedAt = reward.GrantedAt
	case InviteSubRewardStatusRevoked:
		record.Status = InvitationRecordStatusRevoked
		record.Reason = reward.Reason
	case InviteSubRewardStatusBlocked:
		record.Status = InviteRewardStatusBlocked
		record.Reason = normalizeBlockedInvitationReason(reward.Reason)
	default:
		record.Status = InviteRewardStatusBlocked
		record.Reason = "unavailable"
	}
}

func normalizeInvitationRecord(record *InvitationRecord, row invitationUserRow, eventsByInviteeId map[int]InviteRewardEvent) {
	switch row.InviteRewardStatus {
	case InviteRewardStatusPending:
		record.Status = InviteRewardStatusPending
	case InviteRewardStatusGranted:
		record.Status = InviteRewardStatusGranted
		event, ok := eventsByInviteeId[row.Id]
		if !ok {
			record.Reason = "unavailable"
			return
		}
		record.RewardQuota = event.InviterRewardQuota
		record.Reason = normalizeInvitationReason(event.Reason)
	case InviteRewardStatusBlocked:
		record.Status = InviteRewardStatusBlocked
		record.Reason = normalizeBlockedInvitationReason(row.InviteRewardBlockReason)
	default:
		record.Status = InviteRewardStatusBlocked
		record.Reason = "unavailable"
	}
}

func normalizeBlockedInvitationReason(reason string) string {
	switch reason {
	case InviteRewardBlockReasonInviterLimitReached, InviteRewardBlockReasonInviterMissing, "unavailable":
		return reason
	default:
		return "unavailable"
	}
}

func normalizeInvitationReason(reason string) string {
	switch reason {
	case "":
		return ""
	case InviteRewardBlockReasonInviterLimitReached, InviteRewardBlockReasonInviterMissing, "unavailable":
		return reason
	default:
		return "unavailable"
	}
}
