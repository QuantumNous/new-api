package model

import (
	"errors"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	logRequestPathBackfillStatusKey     = "LogRequestPathBackfillStatus"
	logRequestPathBackfillCursorKey     = "LogRequestPathBackfillCursor"
	logRequestPathBackfillScannedKey    = "LogRequestPathBackfillScanned"
	logRequestPathBackfillUpdatedKey    = "LogRequestPathBackfillUpdated"
	logRequestPathBackfillMissingKey    = "LogRequestPathBackfillMissing"
	logRequestPathBackfillFailedKey     = "LogRequestPathBackfillFailed"
	logRequestPathBackfillFinishedAtKey = "LogRequestPathBackfillFinishedAt"

	logRequestPathBackfillStatusRunning   = "running"
	logRequestPathBackfillStatusCompleted = "completed"
)

type BackfillResult struct {
	Status     string `json:"status"`
	Cursor     int    `json:"cursor"`
	Scanned    int64  `json:"scanned"`
	Updated    int64  `json:"updated"`
	Missing    int64  `json:"missing"`
	Failed     int64  `json:"failed"`
	FinishedAt int64  `json:"finished_at"`
}

func BackfillLogRequestPath(batchSize int) (BackfillResult, error) {
	if batchSize <= 0 {
		batchSize = 100
	}

	result, err := loadLogRequestPathBackfillResult()
	if err != nil {
		return result, err
	}
	if result.Status == logRequestPathBackfillStatusCompleted {
		return result, nil
	}

	result.Status = logRequestPathBackfillStatusRunning
	if err = saveLogRequestPathBackfillResult(result); err != nil {
		return result, err
	}

	for {
		var logs []Log
		err = LOG_DB.Where("id > ? AND request_path = ?", result.Cursor, "").Order("id asc").Limit(batchSize).Find(&logs).Error
		if err != nil {
			return result, err
		}
		if len(logs) == 0 {
			result.Status = logRequestPathBackfillStatusCompleted
			if result.FinishedAt == 0 {
				result.FinishedAt = common.GetTimestamp()
			}
			err = saveLogRequestPathBackfillResult(result)
			return result, err
		}

		for _, log := range logs {
			if log.Id > result.Cursor {
				result.Cursor = log.Id
			}
			result.Scanned++

			requestPath, extractErr := extractRequestPathFromLogOther(log.Other)
			if extractErr != nil {
				result.Failed++
				continue
			}
			if requestPath == "" {
				result.Missing++
				continue
			}

			updateErr := LOG_DB.Model(&Log{}).Where("id = ?", log.Id).Update("request_path", requestPath).Error
			if updateErr != nil {
				result.Failed++
				continue
			}
			result.Updated++
		}

		if err = saveLogRequestPathBackfillResult(result); err != nil {
			return result, err
		}
	}
}

func extractRequestPathFromLogOther(other string) (string, error) {
	if other == "" {
		return "", nil
	}
	var payload map[string]interface{}
	if err := common.UnmarshalJsonStr(other, &payload); err != nil {
		return "", err
	}
	return resolveLogRequestPath("", payload), nil
}

func loadLogRequestPathBackfillResult() (BackfillResult, error) {
	result := BackfillResult{}
	var err error

	result.Status, err = getLogBackfillOptionValue(logRequestPathBackfillStatusKey)
	if err != nil {
		return result, err
	}
	result.Cursor, err = getLogBackfillOptionInt(logRequestPathBackfillCursorKey)
	if err != nil {
		return result, err
	}
	result.Scanned, err = getLogBackfillOptionInt64(logRequestPathBackfillScannedKey)
	if err != nil {
		return result, err
	}
	result.Updated, err = getLogBackfillOptionInt64(logRequestPathBackfillUpdatedKey)
	if err != nil {
		return result, err
	}
	result.Missing, err = getLogBackfillOptionInt64(logRequestPathBackfillMissingKey)
	if err != nil {
		return result, err
	}
	result.Failed, err = getLogBackfillOptionInt64(logRequestPathBackfillFailedKey)
	if err != nil {
		return result, err
	}
	result.FinishedAt, err = getLogBackfillOptionInt64(logRequestPathBackfillFinishedAtKey)
	if err != nil {
		return result, err
	}
	return result, nil
}

func saveLogRequestPathBackfillResult(result BackfillResult) error {
	if err := UpdateOption(logRequestPathBackfillStatusKey, result.Status); err != nil {
		return err
	}
	if err := UpdateOption(logRequestPathBackfillCursorKey, strconv.Itoa(result.Cursor)); err != nil {
		return err
	}
	if err := UpdateOption(logRequestPathBackfillScannedKey, strconv.FormatInt(result.Scanned, 10)); err != nil {
		return err
	}
	if err := UpdateOption(logRequestPathBackfillUpdatedKey, strconv.FormatInt(result.Updated, 10)); err != nil {
		return err
	}
	if err := UpdateOption(logRequestPathBackfillMissingKey, strconv.FormatInt(result.Missing, 10)); err != nil {
		return err
	}
	if err := UpdateOption(logRequestPathBackfillFailedKey, strconv.FormatInt(result.Failed, 10)); err != nil {
		return err
	}
	return UpdateOption(logRequestPathBackfillFinishedAtKey, strconv.FormatInt(result.FinishedAt, 10))
}

func getLogBackfillOptionValue(key string) (string, error) {
	var option Option
	err := DB.Where("key = ?", key).First(&option).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return option.Value, nil
}

func getLogBackfillOptionInt(key string) (int, error) {
	value, err := getLogBackfillOptionValue(key)
	if err != nil || value == "" {
		return 0, err
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return 0, err
	}
	return parsed, nil
}

func getLogBackfillOptionInt64(key string) (int64, error) {
	value, err := getLogBackfillOptionValue(key)
	if err != nil || value == "" {
		return 0, err
	}
	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		return 0, err
	}
	return parsed, nil
}
