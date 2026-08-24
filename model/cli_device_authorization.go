package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	CliDeviceAuthorizationStatusPending  = "pending"
	CliDeviceAuthorizationStatusApproved = "approved"
	CliDeviceAuthorizationStatusDenied   = "denied"
	CliDeviceAuthorizationStatusExpired  = "expired"
)

type CliDeviceAuthorization struct {
	Id             int    `json:"id"`
	DeviceCodeHash string `json:"-" gorm:"type:char(64);uniqueIndex"`
	UserCodeHash   string `json:"-" gorm:"type:char(64);uniqueIndex"`
	Status         string `json:"status" gorm:"type:varchar(16);index;default:'pending'"`
	UserId         int    `json:"user_id" gorm:"index;default:0"`
	TokenId        int    `json:"token_id" gorm:"default:0"`
	ClientName     string `json:"client_name" gorm:"default:''"`
	ClientVersion  string `json:"client_version" gorm:"default:''"`
	DeviceIdHash   string `json:"device_id_hash" gorm:"index;default:''"`
	CreatedTime    int64  `json:"created_time" gorm:"bigint"`
	ExpiresAt      int64  `json:"expires_at" gorm:"bigint;index"`
	ApprovedAt     int64  `json:"approved_at" gorm:"bigint;default:0"`
	ConsumedAt     int64  `json:"consumed_at" gorm:"bigint;default:0"`
	LastPollAt     int64  `json:"last_poll_at" gorm:"bigint;default:0"`
}

type CliDeviceAuthorizationApproval struct {
	Authorization        CliDeviceAuthorization
	Token                Token
	TokenCreated         bool
	AuthorizationUpdated bool
}

type CliDeviceAuthorizationConsumption struct {
	Authorization CliDeviceAuthorization
	Token         Token
	Consumed      bool
}

func CreateCliDeviceAuthorization(auth *CliDeviceAuthorization) error {
	if auth == nil {
		return errors.New("cli device authorization is nil")
	}
	return DB.Create(auth).Error
}

func GetCliDeviceAuthorizationByUserCodeHash(userCodeHash string) (*CliDeviceAuthorization, error) {
	if userCodeHash == "" {
		return nil, errors.New("user code is empty")
	}
	var auth CliDeviceAuthorization
	if err := DB.Where("user_code_hash = ?", userCodeHash).First(&auth).Error; err != nil {
		return nil, err
	}
	return &auth, nil
}

func GetCliDeviceAuthorizationByDeviceCodeHash(deviceCodeHash string) (*CliDeviceAuthorization, error) {
	if deviceCodeHash == "" {
		return nil, errors.New("device code is empty")
	}
	var auth CliDeviceAuthorization
	if err := DB.Where("device_code_hash = ?", deviceCodeHash).First(&auth).Error; err != nil {
		return nil, err
	}
	return &auth, nil
}

func ExpireCliDeviceAuthorization(id int, now int64) (*CliDeviceAuthorization, error) {
	result := &CliDeviceAuthorization{}
	err := DB.Transaction(func(tx *gorm.DB) error {
		var auth CliDeviceAuthorization
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&auth, id).Error; err != nil {
			return err
		}
		if auth.Status != CliDeviceAuthorizationStatusPending || auth.ExpiresAt > now {
			*result = auth
			return nil
		}
		if err := tx.Model(&auth).Update("status", CliDeviceAuthorizationStatusExpired).Error; err != nil {
			return err
		}
		if err := tx.First(&auth, id).Error; err != nil {
			return err
		}
		*result = auth
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

func ApproveCliDeviceAuthorizationWithToken(id int, userId int, token Token, maxTokens int, triggerType string, now int64) (*CliDeviceAuthorizationApproval, error) {
	if userId == 0 {
		return nil, errors.New("userId 为空！")
	}
	if token.Source != TokenSourceCLI || token.DeviceIdHash == "" {
		return nil, errors.New("cli token metadata invalid")
	}

	result := &CliDeviceAuthorizationApproval{}
	err := DB.Transaction(func(tx *gorm.DB) error {
		var auth CliDeviceAuthorization
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&auth, id).Error; err != nil {
			return err
		}
		if auth.Status != CliDeviceAuthorizationStatusPending {
			result.Authorization = auth
			if auth.TokenId > 0 {
				_ = tx.First(&result.Token, auth.TokenId).Error
			}
			return nil
		}
		if auth.ExpiresAt <= now {
			if err := tx.Model(&auth).Update("status", CliDeviceAuthorizationStatusExpired).Error; err != nil {
				return err
			}
			auth.Status = CliDeviceAuthorizationStatusExpired
			result.Authorization = auth
			return nil
		}

		var user User
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Select("id").
			Where("id = ?", userId).
			First(&user).Error; err != nil {
			return err
		}

		var stored Token
		err := tx.Where("user_id = ? AND source = ? AND device_id_hash = ? AND status = ?",
			userId, TokenSourceCLI, token.DeviceIdHash, common.TokenStatusEnabled).
			Order("id desc").
			First(&stored).Error
		if err == nil {
			updates := map[string]any{
				"client_name":         token.ClientName,
				"client_version":      token.ClientVersion,
				"last_used_client_at": token.LastUsedClientAt,
				"accessed_time":       token.AccessedTime,
			}
			if err := tx.Model(&stored).Updates(updates).Error; err != nil {
				return err
			}
			stored.ClientName = token.ClientName
			stored.ClientVersion = token.ClientVersion
			stored.LastUsedClientAt = token.LastUsedClientAt
			stored.AccessedTime = token.AccessedTime
		} else if errors.Is(err, gorm.ErrRecordNotFound) {
			var total int64
			if err := tx.Model(&Token{}).Where("user_id = ?", userId).Count(&total).Error; err != nil {
				return err
			}
			if int(total) >= maxTokens {
				return ErrUserTokenLimitReached
			}
			token.UserId = userId
			if err := tx.Create(&token).Error; err != nil {
				return err
			}
			if err := validateTokenCreateInviteRewardTrigger(triggerType); err != nil {
				return err
			}
			stored = token
			result.TokenCreated = true
		} else {
			return err
		}

		if err := tx.Model(&auth).Updates(map[string]any{
			"status":      CliDeviceAuthorizationStatusApproved,
			"user_id":     userId,
			"token_id":    stored.Id,
			"approved_at": now,
		}).Error; err != nil {
			return err
		}
		auth.Status = CliDeviceAuthorizationStatusApproved
		auth.UserId = userId
		auth.TokenId = stored.Id
		auth.ApprovedAt = now
		result.Authorization = auth
		result.Token = stored
		result.AuthorizationUpdated = true
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

func ConsumeCliDeviceAuthorization(deviceCodeHash string, now int64) (*CliDeviceAuthorizationConsumption, error) {
	if deviceCodeHash == "" {
		return nil, errors.New("device code is empty")
	}
	result := &CliDeviceAuthorizationConsumption{}
	err := DB.Transaction(func(tx *gorm.DB) error {
		var auth CliDeviceAuthorization
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("device_code_hash = ?", deviceCodeHash).
			First(&auth).Error; err != nil {
			return err
		}
		result.Authorization = auth
		if auth.ExpiresAt <= now && (auth.Status == CliDeviceAuthorizationStatusPending || auth.Status == CliDeviceAuthorizationStatusApproved) && auth.ConsumedAt == 0 {
			if err := tx.Model(&auth).Updates(map[string]any{
				"status": CliDeviceAuthorizationStatusExpired,
			}).Error; err != nil {
				return err
			}
			auth.Status = CliDeviceAuthorizationStatusExpired
			result.Authorization = auth
			return nil
		}
		if auth.Status != CliDeviceAuthorizationStatusApproved || auth.TokenId == 0 || auth.ConsumedAt != 0 {
			return nil
		}

		var token Token
		if err := tx.First(&token, auth.TokenId).Error; err != nil {
			return err
		}
		update := tx.Model(&CliDeviceAuthorization{}).
			Where("id = ? AND status = ? AND consumed_at = 0 AND expires_at > ?", auth.Id, CliDeviceAuthorizationStatusApproved, now).
			Update("consumed_at", now)
		if update.Error != nil {
			return update.Error
		}
		if update.RowsAffected == 0 {
			if err := tx.First(&auth, auth.Id).Error; err != nil {
				return err
			}
			result.Authorization = auth
			return nil
		}
		if err := tx.First(&auth, auth.Id).Error; err != nil {
			return err
		}
		result.Authorization = auth
		result.Token = token
		result.Consumed = true
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

func DenyCliDeviceAuthorization(id int, now int64) (*CliDeviceAuthorization, error) {
	result := &CliDeviceAuthorization{}
	err := DB.Transaction(func(tx *gorm.DB) error {
		var auth CliDeviceAuthorization
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&auth, id).Error; err != nil {
			return err
		}
		if auth.Status != CliDeviceAuthorizationStatusPending {
			*result = auth
			return nil
		}
		if auth.ExpiresAt <= now {
			if err := tx.Model(&auth).Update("status", CliDeviceAuthorizationStatusExpired).Error; err != nil {
				return err
			}
			auth.Status = CliDeviceAuthorizationStatusExpired
			*result = auth
			return nil
		}
		if err := tx.Model(&auth).Updates(map[string]any{
			"status":      CliDeviceAuthorizationStatusDenied,
			"approved_at": now,
		}).Error; err != nil {
			return err
		}
		auth.Status = CliDeviceAuthorizationStatusDenied
		auth.ApprovedAt = now
		*result = auth
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

func CleanupExpiredCliDeviceAuthorizations(before int64, limit int) (int64, error) {
	if limit <= 0 {
		return 0, nil
	}
	var ids []int
	if err := DB.Model(&CliDeviceAuthorization{}).
		Where("expires_at < ?", before).
		Order("id asc").
		Limit(limit).
		Pluck("id", &ids).Error; err != nil {
		return 0, err
	}
	if len(ids) == 0 {
		return 0, nil
	}
	result := DB.Where("id IN ?", ids).Delete(&CliDeviceAuthorization{})
	return result.RowsAffected, result.Error
}
