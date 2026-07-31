package model

import (
	"errors"
	"strings"

	"gorm.io/gorm"
)

const (
	BytePlusRealPersonProfileStatusPendingVerification = "PendingVerification"
	BytePlusRealPersonProfileStatusVerifying           = "Verifying"
	BytePlusRealPersonProfileStatusActive              = "Active"
	BytePlusRealPersonProfileStatusFailed              = "Failed"
	BytePlusRealPersonProfileStatusExpired             = "Expired"
	BytePlusVisualValidationSessionStatusCreating      = "Creating"
	BytePlusVisualValidationSessionStatusPending       = "Pending"
	BytePlusVisualValidationSessionStatusChecking      = "Checking"
	BytePlusVisualValidationSessionStatusSucceeded     = "Succeeded"
	BytePlusVisualValidationSessionStatusFailed        = "Failed"
	BytePlusVisualValidationSessionStatusExpired       = "Expired"
)

type BytePlusRealPersonProfile struct {
	Id                         int64   `json:"id"`
	PublicId                   string  `json:"public_id" gorm:"type:varchar(64);uniqueIndex"`
	UserId                     int     `json:"user_id" gorm:"index"`
	Name                       string  `json:"name" gorm:"type:varchar(128)"`
	ChannelId                  int     `json:"-" gorm:"index;uniqueIndex:idx_byteplus_real_person_channel_group"`
	UpstreamGroupId            *string `json:"-" gorm:"type:varchar(128);uniqueIndex:idx_byteplus_real_person_channel_group"`
	CurrentValidationSessionId *int64  `json:"-" gorm:"index"`
	Status                     string  `json:"status" gorm:"type:varchar(32);index"`
	ErrorCode                  string  `json:"-" gorm:"type:varchar(64)"`
	CreatedTime                int64   `json:"created_time" gorm:"bigint;index"`
	UpdatedTime                int64   `json:"updated_time" gorm:"bigint"`
}

type BytePlusVisualValidationSession struct {
	Id                      int64  `json:"id"`
	PublicId                string `json:"-" gorm:"type:varchar(64);uniqueIndex"`
	ProfileId               int64  `json:"-" gorm:"index"`
	CallbackTokenHash       string `json:"-" gorm:"type:char(64);uniqueIndex"`
	CallbackTokenCiphertext string `json:"-" gorm:"type:text"`
	BytedTokenCiphertext    string `json:"-" gorm:"type:text"`
	H5LinkCiphertext        string `json:"-" gorm:"type:text"`
	Status                  string `json:"-" gorm:"type:varchar(32);index"`
	ExpiresAt               int64  `json:"-" gorm:"bigint;index"`
	UpstreamRequestId       string `json:"-" gorm:"type:varchar(128)"`
	LeaseUpdatedTime        int64  `json:"-" gorm:"bigint;index"`
	CreatedTime             int64  `json:"-" gorm:"bigint"`
	UpdatedTime             int64  `json:"-" gorm:"bigint"`
}

func CreateBytePlusRealPersonProfileAndSessionForIdempotency(recordID, leaseUpdatedTime int64, profile BytePlusRealPersonProfile, session BytePlusVisualValidationSession, now int64) (*BytePlusRealPersonProfile, *BytePlusVisualValidationSession, error) {
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&profile).Error; err != nil {
			return err
		}
		session.ProfileId = profile.Id
		if err := tx.Create(&session).Error; err != nil {
			return err
		}
		updated := tx.Model(&BytePlusRealPersonProfile{}).
			Where("id = ? AND current_validation_session_id IS NULL", profile.Id).
			Updates(map[string]interface{}{"current_validation_session_id": session.Id, "updated_time": now})
		if err := requireOneRealPersonCAS(updated); err != nil {
			return err
		}
		return BindAPIIdempotencyResourceTx(tx, recordID, leaseUpdatedTime, session.PublicId, now)
	})
	if err != nil {
		return nil, nil, err
	}
	profile.CurrentValidationSessionId = &session.Id
	profile.UpdatedTime = now
	return &profile, &session, nil
}

func GetBytePlusRealPersonProfileForUser(userID int, publicID string) (*BytePlusRealPersonProfile, error) {
	var profile BytePlusRealPersonProfile
	err := DB.Where("user_id = ? AND public_id = ?", userID, strings.TrimSpace(publicID)).First(&profile).Error
	return &profile, err
}

func GetBytePlusRealPersonProfileByIDForUser(userID int, profileID int64) (*BytePlusRealPersonProfile, error) {
	var profile BytePlusRealPersonProfile
	err := DB.Where("user_id = ? AND id = ?", userID, profileID).First(&profile).Error
	return &profile, err
}

func GetBytePlusRealPersonProfileByID(profileID int64) (*BytePlusRealPersonProfile, error) {
	var profile BytePlusRealPersonProfile
	err := DB.First(&profile, profileID).Error
	return &profile, err
}

func ListBytePlusRealPersonProfilesForUser(userID, limit int, afterPublicID string) ([]BytePlusRealPersonProfile, bool, error) {
	if limit <= 0 {
		return nil, false, nil
	}
	query := DB.Where("user_id = ?", userID)
	afterPublicID = strings.TrimSpace(afterPublicID)
	if afterPublicID != "" {
		var cursor BytePlusRealPersonProfile
		if err := DB.Where("user_id = ? AND public_id = ?", userID, afterPublicID).First(&cursor).Error; err != nil {
			return nil, false, err
		}
		query = query.Where("(created_time < ?) OR (created_time = ? AND id < ?)", cursor.CreatedTime, cursor.CreatedTime, cursor.Id)
	}
	var profiles []BytePlusRealPersonProfile
	if err := query.Order("created_time DESC, id DESC").Limit(limit + 1).Find(&profiles).Error; err != nil {
		return nil, false, err
	}
	hasMore := len(profiles) > limit
	if hasMore {
		profiles = profiles[:limit]
	}
	return profiles, hasMore, nil
}

func GetBytePlusVisualValidationSessionByID(sessionID int64) (*BytePlusVisualValidationSession, error) {
	var session BytePlusVisualValidationSession
	err := DB.First(&session, sessionID).Error
	return &session, err
}

func GetBytePlusVisualValidationSessionByPublicID(publicID string) (*BytePlusVisualValidationSession, error) {
	var session BytePlusVisualValidationSession
	err := DB.Where("public_id = ?", strings.TrimSpace(publicID)).First(&session).Error
	return &session, err
}

func GetBytePlusVisualValidationSessionByCallbackHash(hash string) (*BytePlusVisualValidationSession, error) {
	var session BytePlusVisualValidationSession
	err := DB.Where("callback_token_hash = ?", strings.TrimSpace(hash)).First(&session).Error
	return &session, err
}

func ActivateBytePlusRealPersonProfile(profileID, sessionID int64, groupID string, now int64) (bool, error) {
	groupID = strings.TrimSpace(groupID)
	if groupID == "" {
		return false, errors.New("byteplus real person group id is required")
	}
	return transitionBytePlusRealPersonSessionTerminal(profileID, sessionID, BytePlusRealPersonProfileStatusActive, BytePlusVisualValidationSessionStatusSucceeded, "", groupID, now)
}

func FailBytePlusRealPersonSession(profileID, sessionID int64, failureCode string, now int64) (bool, error) {
	failureCode = strings.TrimSpace(failureCode)
	if failureCode == "" {
		failureCode = "verification_failed"
	}
	return transitionBytePlusRealPersonSessionTerminal(profileID, sessionID, BytePlusRealPersonProfileStatusFailed, BytePlusVisualValidationSessionStatusFailed, failureCode, "", now)
}

func ExpireBytePlusRealPersonSession(profileID, sessionID int64, now int64) (bool, error) {
	return transitionBytePlusRealPersonSessionTerminal(profileID, sessionID, BytePlusRealPersonProfileStatusExpired, BytePlusVisualValidationSessionStatusExpired, "verification_expired", "", now)
}

func transitionBytePlusRealPersonSessionTerminal(profileID, sessionID int64, profileStatus, sessionStatus, errorCode, groupID string, now int64) (bool, error) {
	var changed bool
	err := DB.Transaction(func(tx *gorm.DB) error {
		var profile BytePlusRealPersonProfile
		if err := tx.Select("current_validation_session_id").
			Where("id = ?", profileID).
			First(&profile).Error; err != nil {
			return err
		}
		current := profile.CurrentValidationSessionId != nil && *profile.CurrentValidationSessionId == sessionID
		if current {
			profileUpdates := map[string]interface{}{
				"status":       profileStatus,
				"error_code":   errorCode,
				"updated_time": now,
			}
			if profileStatus == BytePlusRealPersonProfileStatusActive {
				profileUpdates["upstream_group_id"] = groupID
			}
			updatedProfile := tx.Model(&BytePlusRealPersonProfile{}).
				Where("id = ? AND current_validation_session_id = ? AND status IN ?", profileID, sessionID, []string{BytePlusRealPersonProfileStatusPendingVerification, BytePlusRealPersonProfileStatusVerifying}).
				Updates(profileUpdates)
			if err := requireOneRealPersonCAS(updatedProfile); err != nil {
				return err
			}
		}
		updatedSession := tx.Model(&BytePlusVisualValidationSession{}).
			Where("id = ? AND profile_id = ? AND status NOT IN ?", sessionID, profileID, realPersonTerminalSessionStatuses()).
			Updates(map[string]interface{}{
				"status":                    sessionStatus,
				"callback_token_ciphertext": "",
				"byted_token_ciphertext":    "",
				"h5_link_ciphertext":        "",
				"updated_time":              now,
			})
		if current {
			if err := requireOneRealPersonCAS(updatedSession); err != nil {
				return err
			}
			changed = true
			return nil
		}
		if updatedSession.Error != nil {
			return updatedSession.Error
		}
		return nil
	})
	return changed, err
}

func ReplaceBytePlusRealPersonCurrentSessionForIdempotency(recordID, leaseUpdatedTime int64, userID int, profileID int64, allowedStatuses []string, session BytePlusVisualValidationSession, now int64) (*BytePlusRealPersonProfile, *BytePlusVisualValidationSession, error) {
	var profile BytePlusRealPersonProfile
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("id = ? AND user_id = ? AND status IN ?", profileID, userID, allowedStatuses).First(&profile).Error; err != nil {
			return err
		}
		session.ProfileId = profile.Id
		if err := tx.Create(&session).Error; err != nil {
			return err
		}
		updated := tx.Model(&BytePlusRealPersonProfile{}).
			Where("id = ? AND user_id = ? AND status IN ?", profileID, userID, allowedStatuses).
			Updates(map[string]interface{}{
				"current_validation_session_id": session.Id,
				"status":                        BytePlusRealPersonProfileStatusPendingVerification,
				"error_code":                    "",
				"updated_time":                  now,
			})
		if err := requireOneRealPersonCAS(updated); err != nil {
			return err
		}
		return BindAPIIdempotencyResourceTx(tx, recordID, leaseUpdatedTime, session.PublicId, now)
	})
	if err != nil {
		return nil, nil, err
	}
	profile.CurrentValidationSessionId = &session.Id
	profile.Status = BytePlusRealPersonProfileStatusPendingVerification
	profile.ErrorCode = ""
	profile.UpdatedTime = now
	return &profile, &session, nil
}

func ClaimBytePlusVisualValidationSession(sessionID int64, now, staleBefore int64) (*BytePlusVisualValidationSession, bool, error) {
	var session BytePlusVisualValidationSession
	if err := DB.First(&session, sessionID).Error; err != nil {
		return nil, false, err
	}
	switch session.Status {
	case BytePlusVisualValidationSessionStatusPending:
		return claimBytePlusVisualValidationSessionFrom(session, now, []string{BytePlusVisualValidationSessionStatusPending})
	case BytePlusVisualValidationSessionStatusChecking:
		if session.LeaseUpdatedTime >= staleBefore {
			return &session, false, nil
		}
		return claimBytePlusVisualValidationSessionFrom(session, now, []string{BytePlusVisualValidationSessionStatusChecking})
	default:
		return &session, false, nil
	}
}

func ClaimDueBytePlusVisualValidationSessions(now, staleBefore int64, limit int) ([]BytePlusVisualValidationSession, error) {
	if limit <= 0 {
		return nil, nil
	}
	var candidates []BytePlusVisualValidationSession
	if err := DB.Where("status = ? OR (status = ? AND lease_updated_time < ?)",
		BytePlusVisualValidationSessionStatusPending,
		BytePlusVisualValidationSessionStatusChecking,
		staleBefore,
	).Order("updated_time ASC, id ASC").Limit(limit).Find(&candidates).Error; err != nil {
		return nil, err
	}
	claimed := make([]BytePlusVisualValidationSession, 0, len(candidates))
	for _, candidate := range candidates {
		claimedSession, owner, err := ClaimBytePlusVisualValidationSession(candidate.Id, now, staleBefore)
		if err != nil {
			return nil, err
		}
		if owner && claimedSession != nil {
			claimed = append(claimed, *claimedSession)
		}
	}
	return claimed, nil
}

func claimBytePlusVisualValidationSessionFrom(session BytePlusVisualValidationSession, now int64, statuses []string) (*BytePlusVisualValidationSession, bool, error) {
	updated := DB.Model(&BytePlusVisualValidationSession{}).
		Where("id = ? AND status IN ? AND lease_updated_time = ?", session.Id, statuses, session.LeaseUpdatedTime).
		Updates(map[string]interface{}{
			"status":             BytePlusVisualValidationSessionStatusChecking,
			"lease_updated_time": now,
			"updated_time":       now,
		})
	if updated.Error != nil {
		return nil, false, updated.Error
	}
	if updated.RowsAffected != 1 {
		reloaded, err := GetBytePlusVisualValidationSessionByID(session.Id)
		return reloaded, false, err
	}
	session.Status = BytePlusVisualValidationSessionStatusChecking
	session.LeaseUpdatedTime = now
	session.UpdatedTime = now
	return &session, true, nil
}

func CompleteBytePlusVisualValidationSession(sessionID int64, bytedCiphertext, h5Ciphertext, upstreamRequestID string, expiresAt, now int64) error {
	updated := DB.Model(&BytePlusVisualValidationSession{}).
		Where("id = ? AND status = ?", sessionID, BytePlusVisualValidationSessionStatusCreating).
		Updates(map[string]interface{}{
			"status":                    BytePlusVisualValidationSessionStatusPending,
			"byted_token_ciphertext":    bytedCiphertext,
			"h5_link_ciphertext":        h5Ciphertext,
			"callback_token_ciphertext": "",
			"upstream_request_id":       strings.TrimSpace(upstreamRequestID),
			"expires_at":                expiresAt,
			"updated_time":              now,
		})
	if updated.Error != nil {
		return updated.Error
	}
	return requireOneRealPersonCAS(updated)
}

func ClearBytePlusVisualValidationSecrets(sessionID, now int64) error {
	return DB.Model(&BytePlusVisualValidationSession{}).
		Where("id = ?", sessionID).
		Updates(map[string]interface{}{
			"callback_token_ciphertext": "",
			"byted_token_ciphertext":    "",
			"h5_link_ciphertext":        "",
			"updated_time":              now,
		}).Error
}

func MarkBytePlusRealPersonVerificationOutcomeUnknownForIdempotency(recordID, leaseUpdatedTime, profileID, sessionID int64, failureCode string, now int64) error {
	failureCode = strings.TrimSpace(failureCode)
	if failureCode == "" {
		failureCode = "verification_outcome_unknown"
	}
	if err := DB.Transaction(func(tx *gorm.DB) error {
		updatedRecord := tx.Model(&APIIdempotencyRecord{}).
			Where("id = ? AND status IN ? AND lease_updated_time = ?", recordID, []string{APIIdempotencyStatusCallingUpstream, APIIdempotencyStatusProcessing}, leaseUpdatedTime).
			Updates(map[string]interface{}{"status": APIIdempotencyStatusOutcomeUnknown, "updated_time": now})
		return requireOneAPIIdempotencyCAS(updatedRecord)
	}); err != nil {
		return err
	}
	_, err := FailBytePlusRealPersonSession(profileID, sessionID, failureCode, now)
	return err
}

func MarkBytePlusVerificationSessionOutcomeUnknown(sessionPublicID string, now int64) (bool, error) {
	session, err := GetBytePlusVisualValidationSessionByPublicID(sessionPublicID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, nil
		}
		return false, err
	}
	changed, err := FailBytePlusRealPersonSession(session.ProfileId, session.Id, "idempotency_outcome_unknown", now)
	if errors.Is(err, ErrAPIIdempotencyCASLost) {
		return false, nil
	}
	return changed || err == nil, err
}

func BytePlusRealPersonChannelHasEnabledAbility(channelID int, group, modelName string) (bool, error) {
	var count int64
	err := DB.Model(&Ability{}).
		Where(&Ability{Group: strings.TrimSpace(group), Model: strings.TrimSpace(modelName), ChannelId: channelID, Enabled: true}).
		Count(&count).Error
	return count > 0, err
}

func IsBytePlusRealPersonNotFound(err error) bool {
	return errors.Is(err, gorm.ErrRecordNotFound)
}

func realPersonTerminalSessionStatuses() []string {
	return []string{BytePlusVisualValidationSessionStatusSucceeded, BytePlusVisualValidationSessionStatusFailed, BytePlusVisualValidationSessionStatusExpired}
}

func requireOneRealPersonCAS(result *gorm.DB) error {
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return ErrAPIIdempotencyCASLost
	}
	return nil
}
