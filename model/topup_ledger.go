package model

import (
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// TopUpLedgerEntry is a read-only projection of a top-up order together with
// the owning user's identity. Amount and Money are returned exactly as stored.
type TopUpLedgerEntry struct {
	Id              int     `json:"id"`
	UserId          int     `json:"user_id"`
	Username        string  `json:"username"`
	UserEmail       string  `json:"user_email"`
	Amount          int64   `json:"amount"`
	Money           float64 `json:"money"`
	TradeNo         string  `json:"trade_no"`
	PaymentMethod   string  `json:"payment_method"`
	PaymentProvider string  `json:"payment_provider"`
	CreateTime      int64   `json:"create_time"`
	CompleteTime    int64   `json:"complete_time"`
	Status          string  `json:"status"`
}

// TopUpLedgerFilter narrows the ledger query. Zero values mean "any".
type TopUpLedgerFilter struct {
	StartTime int64
	EndTime   int64
	Status    string
	Provider  string
	Keyword   string
}

// QueryTopUpLedger reads top-up orders without changing them. Filtering and
// pagination run in the database, and user identity is loaded only for the
// returned page, so this stays cheap regardless of the table size.
func QueryTopUpLedger(filter TopUpLedgerFilter, pageInfo *common.PageInfo) ([]TopUpLedgerEntry, int64, error) {
	if filter.StartTime > 0 && filter.EndTime > 0 && filter.StartTime > filter.EndTime {
		return nil, 0, common.NewMessage("Invalid date range")
	}

	query := DB.Model(&TopUp{})
	if filter.StartTime > 0 {
		query = query.Where("create_time >= ?", filter.StartTime)
	}
	if filter.EndTime > 0 {
		query = query.Where("create_time <= ?", filter.EndTime)
	}
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.Provider != "" {
		query = query.Where("payment_provider = ?", filter.Provider)
	}

	keyword := strings.TrimSpace(filter.Keyword)
	if keyword != "" {
		pattern, err := sanitizeLikePattern(keyword)
		if err != nil {
			return nil, 0, err
		}
		like := "%" + pattern + "%"
		clause := "(trade_no LIKE ? ESCAPE '!' OR payment_method LIKE ? ESCAPE '!' OR payment_provider LIKE ? ESCAPE '!')"
		args := []any{like, like, like}
		if userId, convErr := strconv.Atoi(keyword); convErr == nil && userId > 0 {
			clause += " OR user_id = ?"
			args = append(args, userId)
		}
		clause = "(" + clause + " OR user_id IN (SELECT id FROM users WHERE username LIKE ? ESCAPE '!' OR email LIKE ? ESCAPE '!'))"
		args = append(args, like, like)
		query = query.Where(clause, args...)
	}

	var total int64
	if err := query.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var topUps []TopUp
	if err := query.Session(&gorm.Session{}).
		Order("id DESC").
		Limit(pageInfo.GetPageSize()).
		Offset(pageInfo.GetStartIdx()).
		Find(&topUps).Error; err != nil {
		return nil, 0, err
	}

	entries := make([]TopUpLedgerEntry, 0, len(topUps))
	if len(topUps) == 0 {
		return entries, total, nil
	}

	userIds := make([]int, 0, len(topUps))
	seenUserIds := make(map[int]struct{}, len(topUps))
	for _, topUp := range topUps {
		if _, ok := seenUserIds[topUp.UserId]; ok {
			continue
		}
		seenUserIds[topUp.UserId] = struct{}{}
		userIds = append(userIds, topUp.UserId)
	}

	var users []User
	if err := DB.Select("id", "username", "email").Where("id IN ?", userIds).Find(&users).Error; err != nil {
		return nil, 0, err
	}
	userById := make(map[int]User, len(users))
	for _, user := range users {
		userById[user.Id] = user
	}

	for _, topUp := range topUps {
		user := userById[topUp.UserId]
		entries = append(entries, TopUpLedgerEntry{
			Id:              topUp.Id,
			UserId:          topUp.UserId,
			Username:        user.Username,
			UserEmail:       user.Email,
			Amount:          topUp.Amount,
			Money:           topUp.Money,
			TradeNo:         topUp.TradeNo,
			PaymentMethod:   topUp.PaymentMethod,
			PaymentProvider: topUp.PaymentProvider,
			CreateTime:      topUp.CreateTime,
			CompleteTime:    topUp.CompleteTime,
			Status:          topUp.Status,
		})
	}

	return entries, total, nil
}
