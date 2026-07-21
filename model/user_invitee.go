package model

import (
	"errors"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

type UserInvitee struct {
	Id          int    `json:"id"`
	DisplayName string `json:"display_name"`
	CreatedAt   int64  `json:"created_at"`
	IsNew       bool   `json:"is_new" gorm:"-"`
}

func maskInviteeDisplayName(displayName string) string {
	runes := []rune(strings.TrimSpace(displayName))
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

func GetUserInvitees(inviterId int, pageInfo *common.PageInfo) (invitees []*UserInvitee, total int64, err error) {
	if inviterId == 0 {
		return nil, 0, errors.New("invalid inviter id")
	}

	query := DB.Unscoped().Model(&User{}).Where("inviter_id = ?", inviterId)
	if err = query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err = query.
		Select("id", "display_name", "created_at").
		Order("created_at DESC").
		Order("id DESC").
		Limit(pageInfo.GetPageSize()).
		Offset(pageInfo.GetStartIdx()).
		Find(&invitees).Error
	if err != nil {
		return nil, 0, err
	}

	now := time.Now().In(time.Local)
	startOfToday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.Local)
	startOfTomorrow := startOfToday.AddDate(0, 0, 1)
	for _, invitee := range invitees {
		invitee.DisplayName = maskInviteeDisplayName(invitee.DisplayName)
		invitee.IsNew = invitee.CreatedAt >= startOfToday.Unix() && invitee.CreatedAt < startOfTomorrow.Unix()
	}
	return invitees, total, nil
}
