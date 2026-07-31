package model

import (
	"errors"
	"fmt"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	APIIdempotencyStatusReceiving       = "Receiving"
	APIIdempotencyStatusProcessing      = "Processing"
	APIIdempotencyStatusCallingUpstream = "CallingUpstream"
	APIIdempotencyStatusCompleted       = "Completed"
	APIIdempotencyStatusFailed          = "Failed"
	APIIdempotencyStatusOutcomeUnknown  = "OutcomeUnknown"

	APIIdempotencyResourceTypeVerificationSession = "verification_session"
	APIIdempotencyResourceTypeAsset               = "asset"

	APIIdempotencyResourceVerificationSession = APIIdempotencyResourceTypeVerificationSession
	APIIdempotencyResourceAsset               = APIIdempotencyResourceTypeAsset
)

type APIIdempotencyDecision string

const (
	APIIdempotencyDecisionOwner          APIIdempotencyDecision = "owner"
	APIIdempotencyDecisionInProgress     APIIdempotencyDecision = "in_progress"
	APIIdempotencyDecisionResume         APIIdempotencyDecision = "resume"
	APIIdempotencyDecisionReplay         APIIdempotencyDecision = "replay"
	APIIdempotencyDecisionConflict       APIIdempotencyDecision = "conflict"
	APIIdempotencyDecisionOutcomeUnknown APIIdempotencyDecision = "outcome_unknown"

	DecisionOwner          = APIIdempotencyDecisionOwner
	DecisionInProgress     = APIIdempotencyDecisionInProgress
	DecisionResume         = APIIdempotencyDecisionResume
	DecisionReplay         = APIIdempotencyDecisionReplay
	DecisionConflict       = APIIdempotencyDecisionConflict
	DecisionOutcomeUnknown = APIIdempotencyDecisionOutcomeUnknown
)

var ErrAPIIdempotencyCASLost = errors.New("api idempotency lease was superseded")
var ErrAPIIdempotencyBlankResourcePublicID = errors.New("api idempotency resource public id is required")
var ErrAPIIdempotencyTransactionRequired = errors.New("api idempotency transaction is required")

type APIIdempotencyClaim struct {
	Record   *APIIdempotencyRecord
	Decision APIIdempotencyDecision
}

type APIIdempotencyRecord struct {
	Id                    int64  `json:"-"`
	UserId                int    `json:"-" gorm:"uniqueIndex:idx_api_idempotency_user_route_key"`
	Route                 string `json:"-" gorm:"type:varchar(96);uniqueIndex:idx_api_idempotency_user_route_key"`
	KeyHash               string `json:"-" gorm:"type:char(64);uniqueIndex:idx_api_idempotency_user_route_key"`
	RequestHash           string `json:"-" gorm:"type:char(64)"`
	Status                string `json:"-" gorm:"type:varchar(32);index"`
	ResourceType          string `json:"-" gorm:"type:varchar(32)"`
	ResourcePublicId      string `json:"-" gorm:"type:varchar(64);index"`
	ResponseStatus        int    `json:"-"`
	ResponsePayload       string `json:"-" gorm:"type:text"`
	UpstreamCallStartedAt int64  `json:"-" gorm:"bigint"`
	LeaseUpdatedTime      int64  `json:"-" gorm:"bigint;index"`
	ExpiresAt             int64  `json:"-" gorm:"bigint;index"`
	CreatedTime           int64  `json:"-" gorm:"bigint"`
	UpdatedTime           int64  `json:"-" gorm:"bigint"`
}

func ClaimAPIIdempotency(userID int, route, keyHash, requestHash, resourceType string, now, staleBefore, expiresAt int64) (*APIIdempotencyClaim, error) {
	record := APIIdempotencyRecord{
		UserId:           userID,
		Route:            route,
		KeyHash:          keyHash,
		RequestHash:      requestHash,
		Status:           APIIdempotencyStatusReceiving,
		ResourceType:     resourceType,
		LeaseUpdatedTime: now,
		ExpiresAt:        expiresAt,
		CreatedTime:      now,
		UpdatedTime:      now,
	}
	insert := DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&record)
	if insert.Error != nil {
		return nil, insert.Error
	}
	return claimExistingAPIIdempotency(userID, route, keyHash, requestHash, now, staleBefore)
}

func claimExistingAPIIdempotency(userID int, route, keyHash, requestHash string, now, staleBefore int64) (*APIIdempotencyClaim, error) {
	var record APIIdempotencyRecord
	if err := DB.Where("user_id = ? AND route = ? AND key_hash = ?", userID, route, keyHash).First(&record).Error; err != nil {
		return nil, err
	}
	if record.RequestHash != requestHash {
		return &APIIdempotencyClaim{Record: &record, Decision: DecisionConflict}, nil
	}
	switch record.Status {
	case APIIdempotencyStatusReceiving:
		updated := DB.Model(&APIIdempotencyRecord{}).
			Where("id = ? AND status = ? AND lease_updated_time = ?", record.Id, APIIdempotencyStatusReceiving, record.LeaseUpdatedTime).
			Updates(map[string]interface{}{
				"status":             APIIdempotencyStatusProcessing,
				"lease_updated_time": now,
				"updated_time":       now,
			})
		if updated.Error != nil {
			return nil, updated.Error
		}
		if updated.RowsAffected == 1 {
			record.Status = APIIdempotencyStatusProcessing
			record.LeaseUpdatedTime = now
			record.UpdatedTime = now
			return &APIIdempotencyClaim{Record: &record, Decision: DecisionOwner}, nil
		}
		return claimExistingAPIIdempotency(userID, route, keyHash, requestHash, now, staleBefore)
	case APIIdempotencyStatusCompleted, APIIdempotencyStatusFailed:
		return &APIIdempotencyClaim{Record: &record, Decision: DecisionReplay}, nil
	case APIIdempotencyStatusOutcomeUnknown:
		return &APIIdempotencyClaim{Record: &record, Decision: DecisionOutcomeUnknown}, nil
	case APIIdempotencyStatusCallingUpstream:
		if apiIdempotencyCallingUpstreamStalenessTime(record) >= staleBefore {
			return &APIIdempotencyClaim{Record: &record, Decision: DecisionInProgress}, nil
		}
		updated := DB.Model(&APIIdempotencyRecord{}).
			Where("id = ? AND status = ? AND lease_updated_time = ?", record.Id, APIIdempotencyStatusCallingUpstream, record.LeaseUpdatedTime).
			Updates(map[string]interface{}{
				"status":             APIIdempotencyStatusOutcomeUnknown,
				"lease_updated_time": now,
				"updated_time":       now,
			})
		if updated.Error != nil {
			return nil, updated.Error
		}
		if updated.RowsAffected == 1 {
			record.Status = APIIdempotencyStatusOutcomeUnknown
			record.LeaseUpdatedTime = now
			record.UpdatedTime = now
			return &APIIdempotencyClaim{Record: &record, Decision: DecisionOutcomeUnknown}, nil
		}
		return claimExistingAPIIdempotency(userID, route, keyHash, requestHash, now, staleBefore)
	case APIIdempotencyStatusProcessing:
		if record.LeaseUpdatedTime >= staleBefore {
			return &APIIdempotencyClaim{Record: &record, Decision: DecisionInProgress}, nil
		}
		updated := DB.Model(&APIIdempotencyRecord{}).
			Where("id = ? AND status = ? AND lease_updated_time = ?", record.Id, APIIdempotencyStatusProcessing, record.LeaseUpdatedTime).
			Updates(map[string]interface{}{
				"status":             APIIdempotencyStatusProcessing,
				"lease_updated_time": now,
				"updated_time":       now,
			})
		if updated.Error != nil {
			return nil, updated.Error
		}
		if updated.RowsAffected == 1 {
			record.Status = APIIdempotencyStatusProcessing
			record.LeaseUpdatedTime = now
			record.UpdatedTime = now
			if record.ResourcePublicId != "" {
				return &APIIdempotencyClaim{Record: &record, Decision: DecisionResume}, nil
			}
			return &APIIdempotencyClaim{Record: &record, Decision: DecisionOwner}, nil
		}
		return claimExistingAPIIdempotency(userID, route, keyHash, requestHash, now, staleBefore)
	default:
		return nil, fmt.Errorf("unknown api idempotency status %q", record.Status)
	}
}

func BindAPIIdempotencyResourceTx(tx *gorm.DB, recordID int64, leaseUpdatedTime int64, publicID string, now int64) error {
	if tx == nil {
		return ErrAPIIdempotencyTransactionRequired
	}
	if strings.TrimSpace(publicID) == "" {
		return ErrAPIIdempotencyBlankResourcePublicID
	}
	updated := tx.Model(&APIIdempotencyRecord{}).
		Where("id = ? AND status = ? AND lease_updated_time = ? AND resource_public_id = ?", recordID, APIIdempotencyStatusProcessing, leaseUpdatedTime, "").
		Updates(map[string]interface{}{
			"resource_public_id": publicID,
			"updated_time":       now,
		})
	if updated.Error != nil {
		return updated.Error
	}
	if updated.RowsAffected != 1 {
		return ErrAPIIdempotencyCASLost
	}
	return nil
}

func MarkAPIIdempotencyCallingUpstream(recordID int64, leaseUpdatedTime int64, now int64) error {
	updated := DB.Model(&APIIdempotencyRecord{}).
		Where("id = ? AND status = ? AND lease_updated_time = ?", recordID, APIIdempotencyStatusProcessing, leaseUpdatedTime).
		Updates(map[string]interface{}{
			"status":                   APIIdempotencyStatusCallingUpstream,
			"upstream_call_started_at": now,
			"updated_time":             now,
		})
	return requireOneAPIIdempotencyCAS(updated)
}

func CompleteAPIIdempotency(recordID int64, leaseUpdatedTime int64, publicID string, responseStatus int, responsePayload string, now int64) error {
	if strings.TrimSpace(publicID) == "" {
		return ErrAPIIdempotencyBlankResourcePublicID
	}
	return finishAPIIdempotency(recordID, leaseUpdatedTime, publicID, responseStatus, responsePayload, now, APIIdempotencyStatusCompleted)
}

func FailAPIIdempotency(recordID int64, leaseUpdatedTime int64, publicID string, responseStatus int, responsePayload string, now int64) error {
	return finishAPIIdempotency(recordID, leaseUpdatedTime, publicID, responseStatus, responsePayload, now, APIIdempotencyStatusFailed)
}

func finishAPIIdempotency(recordID int64, leaseUpdatedTime int64, publicID string, responseStatus int, responsePayload string, now int64, status string) error {
	updated := DB.Model(&APIIdempotencyRecord{}).
		Where("id = ? AND status IN ? AND lease_updated_time = ? AND (resource_public_id = ? OR resource_public_id = ?)", recordID, []string{APIIdempotencyStatusProcessing, APIIdempotencyStatusCallingUpstream}, leaseUpdatedTime, "", publicID).
		Updates(map[string]interface{}{
			"status":             status,
			"resource_public_id": publicID,
			"response_status":    responseStatus,
			"response_payload":   responsePayload,
			"updated_time":       now,
		})
	return requireOneAPIIdempotencyCAS(updated)
}

func MarkStaleAPIIdempotencyOutcomeUnknown(staleBefore int64, now int64, limit int) ([]APIIdempotencyRecord, error) {
	if limit <= 0 {
		return nil, nil
	}
	var candidates []APIIdempotencyRecord
	if err := DB.Where(
		"status = ? AND ((upstream_call_started_at > ? AND upstream_call_started_at < ?) OR (upstream_call_started_at <= ? AND lease_updated_time < ?))",
		APIIdempotencyStatusCallingUpstream, int64(0), staleBefore, int64(0), staleBefore,
	).
		Order("id").
		Limit(limit).
		Find(&candidates).Error; err != nil {
		return nil, err
	}
	updatedRecords := make([]APIIdempotencyRecord, 0, len(candidates))
	for _, candidate := range candidates {
		updated := DB.Model(&APIIdempotencyRecord{}).
			Where("id = ? AND status = ? AND lease_updated_time = ?", candidate.Id, APIIdempotencyStatusCallingUpstream, candidate.LeaseUpdatedTime).
			Updates(map[string]interface{}{
				"status":             APIIdempotencyStatusOutcomeUnknown,
				"lease_updated_time": now,
				"updated_time":       now,
			})
		if updated.Error != nil {
			return nil, updated.Error
		}
		if updated.RowsAffected == 1 {
			candidate.Status = APIIdempotencyStatusOutcomeUnknown
			candidate.LeaseUpdatedTime = now
			candidate.UpdatedTime = now
			updatedRecords = append(updatedRecords, candidate)
		}
	}
	return updatedRecords, nil
}

func DeleteExpiredSafeAPIIdempotencyRecords(now int64, limit int) (int, error) {
	if limit <= 0 {
		return 0, nil
	}
	var ids []int64
	if err := DB.Model(&APIIdempotencyRecord{}).
		Where("status IN ? AND expires_at > ? AND expires_at <= ?", []string{APIIdempotencyStatusCompleted, APIIdempotencyStatusFailed}, int64(0), now).
		Order("id").
		Limit(limit).
		Pluck("id", &ids).Error; err != nil {
		return 0, err
	}
	if len(ids) == 0 {
		return 0, nil
	}
	deleted := DB.Where("id IN ? AND status IN ? AND expires_at > ? AND expires_at <= ?", ids, []string{APIIdempotencyStatusCompleted, APIIdempotencyStatusFailed}, int64(0), now).
		Delete(&APIIdempotencyRecord{})
	if deleted.Error != nil {
		return 0, deleted.Error
	}
	return int(deleted.RowsAffected), nil
}

func requireOneAPIIdempotencyCAS(result *gorm.DB) error {
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return ErrAPIIdempotencyCASLost
	}
	return nil
}

func apiIdempotencyCallingUpstreamStalenessTime(record APIIdempotencyRecord) int64 {
	if record.UpstreamCallStartedAt > 0 {
		return record.UpstreamCallStartedAt
	}
	return record.LeaseUpdatedTime
}
