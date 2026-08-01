package service

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/csv"
	"fmt"
	"io"
	"net/mail"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

const (
	recallExclusionMaxCSVBytes        = 5 << 20
	recallExclusionMaxDataRows        = 100_000
	recallExclusionProblemSampleLimit = 20
)

type RecallExclusionService struct {
	now func() time.Time
}

var recallExclusionSysLog = common.SysLog

type RecallExclusionPreview struct {
	BatchID        int64                    `json:"batch_id"`
	TotalRows      int64                    `json:"total_rows"`
	ResolvedUsers  int64                    `json:"resolved_users"`
	DuplicateRows  int64                    `json:"duplicate_rows"`
	UnresolvedRows int64                    `json:"unresolved_rows"`
	ConflictRows   int64                    `json:"conflict_rows"`
	BlockingErrors []RecallExclusionProblem `json:"blocking_errors"`
	Warnings       []RecallExclusionProblem `json:"warnings"`
	CancelableWork int64                    `json:"cancelable_work"`
	Confirmable    bool                     `json:"confirmable"`
}

type RecallExclusionProblem struct {
	Row     int64  `json:"row"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

func NewRecallExclusionService() *RecallExclusionService {
	return &RecallExclusionService{now: time.Now}
}

func (s *RecallExclusionService) Preview(ctx context.Context, campaignID int64, actorID int, reader io.Reader) (RecallExclusionPreview, error) {
	preview := RecallExclusionPreview{
		BlockingErrors: []RecallExclusionProblem{},
		Warnings:       []RecallExclusionProblem{},
	}
	if campaignID <= 0 || actorID <= 0 {
		return preview, fmt.Errorf("recall exclusion preview requires campaign and actor")
	}
	if reader == nil {
		return preview, fmt.Errorf("recall exclusion CSV is required")
	}
	campaign, err := model.GetRecallCampaignByIDWithContext(ctx, campaignID)
	if err != nil {
		return preview, err
	}
	data, digest, err := readRecallExclusionCSV(reader)
	if err != nil {
		return preview, err
	}
	rows, err := parseRecallExclusionCSV(data)
	if err != nil {
		return preview, err
	}
	if len(rows) > recallExclusionMaxDataRows {
		return preview, fmt.Errorf("recall exclusion CSV supports at most %d data rows", recallExclusionMaxDataRows)
	}
	preview.TotalRows = int64(len(rows))
	if len(rows) == 0 {
		return s.persistPreview(ctx, campaignID, actorID, digest, preview, nil, false, 0)
	}
	resolution, err := resolveRecallExclusionRows(ctx, rows)
	if err != nil {
		return preview, err
	}
	preview.ResolvedUsers = int64(len(resolution.userIDs))
	preview.DuplicateRows = resolution.duplicateRows
	preview.UnresolvedRows = resolution.unresolvedRows
	preview.ConflictRows = resolution.conflictRows
	preview.BlockingErrors = resolution.blockingErrors
	preview.Warnings = resolution.warnings
	preview.CancelableWork, err = model.CountRecallExclusionCancelableMessagesWithContext(ctx, campaignID, resolution.userIDs)
	if err != nil {
		return preview, err
	}
	blocked := resolution.blockingCount > 0
	preview.Confirmable = preview.ResolvedUsers > 0 && !blocked && model.RecallExclusionCampaignStatusConfirmable(campaign.Status)
	return s.persistPreview(ctx, campaignID, actorID, digest, preview, resolution.userIDs, blocked, resolution.blockingCount)
}

func (s *RecallExclusionService) GetBatch(ctx context.Context, campaignID int64, batchID int64) (RecallExclusionPreview, error) {
	batch, err := model.GetRecallExclusionBatchWithContext(ctx, campaignID, batchID)
	if err != nil {
		return RecallExclusionPreview{}, err
	}
	return recallExclusionPreviewFromBatch(ctx, *batch)
}

func (s *RecallExclusionService) Confirm(ctx context.Context, campaignID int64, batchID int64, actorID int) (RecallExclusionPreview, error) {
	now := time.Now
	if s != nil && s.now != nil {
		now = s.now
	}
	outcome, err := model.ApplyRecallExclusionBatchWithContext(ctx, campaignID, batchID, actorID, now().Unix())
	if err != nil {
		return RecallExclusionPreview{}, err
	}
	batch, err := model.GetRecallExclusionBatchWithContext(ctx, campaignID, outcome.BatchID)
	if err != nil {
		return RecallExclusionPreview{}, err
	}
	preview, err := recallExclusionPreviewFromBatch(ctx, *batch)
	if err != nil {
		return RecallExclusionPreview{}, err
	}
	logRecallExclusionConfirm(campaignID, outcome.BatchID, batch.ResolvedUsers, batch.CancelledMessages)
	return preview, nil
}

type recallExclusionCSVRow struct {
	row    int64
	userID string
	email  string
}

type recallExclusionResolution struct {
	userIDs        []int
	duplicateRows  int64
	unresolvedRows int64
	conflictRows   int64
	blockingCount  int64
	blockingErrors []RecallExclusionProblem
	warnings       []RecallExclusionProblem
}

func readRecallExclusionCSV(reader io.Reader) ([]byte, string, error) {
	data, err := io.ReadAll(io.LimitReader(reader, recallExclusionMaxCSVBytes+1))
	if err != nil {
		return nil, "", err
	}
	if len(data) > recallExclusionMaxCSVBytes {
		return nil, "", fmt.Errorf("recall exclusion CSV exceeds maximum of %d bytes", recallExclusionMaxCSVBytes)
	}
	sum := sha256.Sum256(data)
	return data, fmt.Sprintf("%x", sum), nil
}

func parseRecallExclusionCSV(data []byte) ([]recallExclusionCSVRow, error) {
	reader := csv.NewReader(bytes.NewReader(data))
	reader.FieldsPerRecord = -1
	reader.TrimLeadingSpace = true
	header, err := reader.Read()
	if err == io.EOF {
		return nil, fmt.Errorf("recall exclusion CSV requires a header")
	}
	if err != nil {
		return nil, err
	}
	userIDIndex, emailIndex := -1, -1
	for i, value := range header {
		switch strings.ToLower(strings.TrimSpace(value)) {
		case "user_id":
			userIDIndex = i
		case "email":
			emailIndex = i
		}
	}
	if userIDIndex < 0 && emailIndex < 0 {
		return nil, fmt.Errorf("recall exclusion CSV requires user_id or email header")
	}
	rows := make([]recallExclusionCSVRow, 0)
	rowNumber := int64(1)
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		rowNumber++
		if len(rows) >= recallExclusionMaxDataRows+1 {
			return rows, nil
		}
		row := recallExclusionCSVRow{row: rowNumber}
		if userIDIndex >= 0 && userIDIndex < len(record) {
			row.userID = strings.TrimSpace(record[userIDIndex])
		}
		if emailIndex >= 0 && emailIndex < len(record) {
			row.email = strings.ToLower(strings.TrimSpace(record[emailIndex]))
		}
		rows = append(rows, row)
	}
	return rows, nil
}

func resolveRecallExclusionRows(ctx context.Context, rows []recallExclusionCSVRow) (recallExclusionResolution, error) {
	result := recallExclusionResolution{
		blockingErrors: []RecallExclusionProblem{},
		warnings:       []RecallExclusionProblem{},
	}
	requestedIDs := make([]int, 0)
	requestedEmails := make([]string, 0)
	parsed := make([]struct {
		row       int64
		userID    int
		hasUserID bool
		email     string
		hasEmail  bool
		blocking  bool
	}, len(rows))
	for i, row := range rows {
		parsed[i].row = row.row
		if row.userID != "" {
			userID, err := strconv.Atoi(row.userID)
			if err != nil || userID <= 0 {
				result.blockingCount++
				result.blockingErrors = appendRecallExclusionProblemSample(result.blockingErrors, recallExclusionProblem(row.row, "malformed_user_id", "user_id must be a positive integer"))
				parsed[i].blocking = true
			} else {
				parsed[i].userID = userID
				parsed[i].hasUserID = true
				requestedIDs = append(requestedIDs, userID)
			}
		}
		if row.email != "" {
			email, ok := normalizeRecallExclusionEmail(row.email)
			if !ok {
				result.blockingCount++
				result.blockingErrors = appendRecallExclusionProblemSample(result.blockingErrors, recallExclusionProblem(row.row, "malformed_email", "email must be valid"))
				parsed[i].blocking = true
			} else {
				parsed[i].email = email
				parsed[i].hasEmail = true
				requestedEmails = append(requestedEmails, email)
			}
		}
		if row.userID == "" && row.email == "" {
			result.unresolvedRows++
			result.warnings = appendRecallExclusionProblemSample(result.warnings, recallExclusionProblem(row.row, "missing_identity", "row has no user_id or email"))
		}
	}
	users, err := model.ListUsersByRecallExclusionIdentifiersWithContext(ctx, requestedIDs, requestedEmails)
	if err != nil {
		return result, err
	}
	usersByID := make(map[int]model.User, len(users))
	usersByEmail := make(map[string]model.User, len(users))
	for _, user := range users {
		usersByID[user.Id] = user
		if email := strings.ToLower(strings.TrimSpace(user.Email)); email != "" {
			usersByEmail[email] = user
		}
	}
	seenResolved := map[int]struct{}{}
	resolved := make([]int, 0)
	for _, row := range parsed {
		if row.blocking {
			continue
		}
		var byID *model.User
		var byEmail *model.User
		if row.hasUserID {
			if user, ok := usersByID[row.userID]; ok {
				copy := user
				byID = &copy
			}
		}
		if row.hasEmail {
			if user, ok := usersByEmail[row.email]; ok {
				copy := user
				byEmail = &copy
			}
		}
		if row.hasUserID && row.hasEmail {
			switch {
			case byID == nil || byEmail == nil:
				result.unresolvedRows++
				result.warnings = appendRecallExclusionProblemSample(result.warnings, recallExclusionProblem(row.row, "unknown_user", "identity did not resolve to an existing user"))
				continue
			case byID.Id != byEmail.Id:
				result.conflictRows++
				result.blockingCount++
				result.blockingErrors = appendRecallExclusionProblemSample(result.blockingErrors, recallExclusionProblem(row.row, "identity_conflict", "user_id and email resolve to different users"))
				continue
			}
		}
		userID := 0
		switch {
		case byID != nil:
			userID = byID.Id
		case byEmail != nil:
			userID = byEmail.Id
		case row.hasUserID || row.hasEmail:
			result.unresolvedRows++
			result.warnings = appendRecallExclusionProblemSample(result.warnings, recallExclusionProblem(row.row, "unknown_user", "identity did not resolve to an existing user"))
			continue
		default:
			continue
		}
		if _, exists := seenResolved[userID]; exists {
			result.duplicateRows++
			result.warnings = appendRecallExclusionProblemSample(result.warnings, recallExclusionProblem(row.row, "duplicate_identity", "duplicate identity collapsed"))
			continue
		}
		seenResolved[userID] = struct{}{}
		resolved = append(resolved, userID)
	}
	sort.Ints(resolved)
	result.userIDs = resolved
	return result, nil
}

func normalizeRecallExclusionEmail(email string) (string, bool) {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return "", false
	}
	parsed, err := mail.ParseAddress(email)
	if err != nil || parsed.Address != email {
		return "", false
	}
	return email, true
}

func (s *RecallExclusionService) persistPreview(ctx context.Context, campaignID int64, actorID int, digest string, preview RecallExclusionPreview, userIDs []int, blocked bool, blockingCount int64) (RecallExclusionPreview, error) {
	snapshot, err := model.EncodeRecallExclusionUserIDs(userIDs)
	if err != nil {
		return preview, err
	}
	batch, err := model.CreateRecallExclusionBatchWithContext(ctx, model.RecallExclusionBatchInput{
		CampaignID:              campaignID,
		FileSHA256:              digest,
		TotalRows:               preview.TotalRows,
		ResolvedUsers:           preview.ResolvedUsers,
		DuplicateRows:           preview.DuplicateRows,
		UnresolvedRows:          preview.UnresolvedRows,
		ConflictRows:            preview.ConflictRows,
		ResolvedUserIDsSnapshot: snapshot,
		UploadedBy:              actorID,
		Blocked:                 blocked,
	})
	if err != nil {
		return preview, err
	}
	preview.BatchID = batch.Id
	logRecallExclusionPreview(campaignID, batch.Id, preview, blockingCount)
	return preview, nil
}

func recallExclusionPreviewFromBatch(ctx context.Context, batch model.RecallExclusionBatch) (RecallExclusionPreview, error) {
	campaign, err := model.GetRecallCampaignByIDWithContext(ctx, batch.CampaignId)
	if err != nil {
		return RecallExclusionPreview{}, err
	}
	blockingErrors := []RecallExclusionProblem{}
	if batch.Status == model.RecallExclusionBatchPreviewBlocked {
		blockingErrors = append(blockingErrors, recallExclusionProblem(0, "stored_blocking_errors", "batch contains blocking errors from preview"))
	}
	cancelableWork := batch.CancelledMessages
	if batch.Status != model.RecallExclusionBatchApplied {
		userIDs, err := model.DecodeRecallExclusionUserIDs(batch.ResolvedUserIDsSnapshot)
		if err != nil {
			return RecallExclusionPreview{}, err
		}
		cancelableWork, err = model.CountRecallExclusionCancelableMessagesWithContext(ctx, batch.CampaignId, userIDs)
		if err != nil {
			return RecallExclusionPreview{}, err
		}
	}
	return RecallExclusionPreview{
		BatchID:        batch.Id,
		TotalRows:      batch.TotalRows,
		ResolvedUsers:  batch.ResolvedUsers,
		DuplicateRows:  batch.DuplicateRows,
		UnresolvedRows: batch.UnresolvedRows,
		ConflictRows:   batch.ConflictRows,
		BlockingErrors: blockingErrors,
		Warnings:       []RecallExclusionProblem{},
		CancelableWork: cancelableWork,
		Confirmable:    batch.Status == model.RecallExclusionBatchPreviewed && batch.ResolvedUsers > 0 && batch.ConflictRows == 0 && model.RecallExclusionCampaignStatusConfirmable(campaign.Status),
	}, nil
}

func recallExclusionProblem(row int64, code string, message string) RecallExclusionProblem {
	return RecallExclusionProblem{Row: row, Code: code, Message: message}
}

func appendRecallExclusionProblemSample(samples []RecallExclusionProblem, problem RecallExclusionProblem) []RecallExclusionProblem {
	if len(samples) >= recallExclusionProblemSampleLimit {
		return samples
	}
	return append(samples, problem)
}

func logRecallExclusionPreview(campaignID int64, batchID int64, preview RecallExclusionPreview, blockingCount int64) {
	recallExclusionSysLog(fmt.Sprintf(
		"recall exclusion preview persisted campaign_id=%d batch_id=%d total_rows=%d resolved_users=%d duplicate_rows=%d unresolved_rows=%d conflict_rows=%d blocking_errors=%d warnings=%d cancelable_work=%d confirmable=%t",
		campaignID,
		batchID,
		preview.TotalRows,
		preview.ResolvedUsers,
		preview.DuplicateRows,
		preview.UnresolvedRows,
		preview.ConflictRows,
		blockingCount,
		preview.DuplicateRows+preview.UnresolvedRows,
		preview.CancelableWork,
		preview.Confirmable,
	))
}

func logRecallExclusionConfirm(campaignID int64, batchID int64, resolvedUsers int64, cancelledMessages int64) {
	recallExclusionSysLog(fmt.Sprintf(
		"recall exclusion batch applied campaign_id=%d batch_id=%d resolved_users=%d applied_users=%d cancelled_messages=%d",
		campaignID,
		batchID,
		resolvedUsers,
		resolvedUsers,
		cancelledMessages,
	))
}
