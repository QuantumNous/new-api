package controller

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

func setupQuotaDataControllerTestDB(t *testing.T) *model.Token {
	t.Helper()

	db := setupTokenControllerTestDB(t)
	if err := db.AutoMigrate(&model.QuotaData{}); err != nil {
		t.Fatalf("failed to migrate quota_data table: %v", err)
	}
	return seedToken(t, db, 1, "owned-token", "owned1234token5678")
}

func decodeQuotaDataResponse(t *testing.T, response tokenAPIResponse) []model.QuotaData {
	t.Helper()

	var rows []model.QuotaData
	if err := common.Unmarshal(response.Data, &rows); err != nil {
		t.Fatalf("failed to decode quota data response: %v", err)
	}
	return rows
}

func TestGetUserQuotaDatesFiltersByOwnedToken(t *testing.T) {
	ownedToken := setupQuotaDataControllerTestDB(t)
	db := model.DB

	bucket := int64(1710000000)
	requireRows := []model.QuotaData{
		{UserID: 1, Username: "alice", TokenID: 0, ModelName: "gpt-test", CreatedAt: bucket, Count: 1, Quota: 50, TokenUsed: 5},
		{UserID: 1, Username: "alice", TokenID: ownedToken.Id, TokenName: ownedToken.Name, ModelName: "gpt-test", CreatedAt: bucket, Count: 2, Quota: 100, TokenUsed: 10},
	}
	for _, row := range requireRows {
		if err := db.Create(&row).Error; err != nil {
			t.Fatalf("failed to seed quota row: %v", err)
		}
	}

	ctx, recorder := newAuthenticatedContext(t, http.MethodGet, fmt.Sprintf("/api/data/self?start_timestamp=%d&end_timestamp=%d&token_id=%d", bucket, bucket, ownedToken.Id), nil, 1)
	GetUserQuotaDates(ctx)

	response := decodeAPIResponse(t, recorder)
	if !response.Success {
		t.Fatalf("expected token-filtered quota query to succeed, got message: %s", response.Message)
	}
	rows := decodeQuotaDataResponse(t, response)
	if len(rows) != 1 {
		t.Fatalf("expected one token-filtered row, got %d", len(rows))
	}
	if rows[0].Quota != 100 || rows[0].TokenUsed != 10 || rows[0].Count != 2 {
		t.Fatalf("unexpected token-filtered aggregate: %+v", rows[0])
	}

	allCtx, allRecorder := newAuthenticatedContext(t, http.MethodGet, fmt.Sprintf("/api/data/self?start_timestamp=%d&end_timestamp=%d", bucket, bucket), nil, 1)
	GetUserQuotaDates(allCtx)
	allResponse := decodeAPIResponse(t, allRecorder)
	if !allResponse.Success {
		t.Fatalf("expected all-token quota query to succeed, got message: %s", allResponse.Message)
	}
	allRows := decodeQuotaDataResponse(t, allResponse)
	if len(allRows) != 1 {
		t.Fatalf("expected one all-token row, got %d", len(allRows))
	}
	if allRows[0].Quota != 150 || allRows[0].TokenUsed != 15 || allRows[0].Count != 3 {
		t.Fatalf("unexpected all-token aggregate: %+v", allRows[0])
	}
}

func TestGetUserQuotaDatesRejectsOtherUsersToken(t *testing.T) {
	setupQuotaDataControllerTestDB(t)
	otherToken := seedToken(t, model.DB, 2, "other-token", "other1234token5678")

	ctx, recorder := newAuthenticatedContext(t, http.MethodGet, fmt.Sprintf("/api/data/self?start_timestamp=1710000000&end_timestamp=1710000000&token_id=%d", otherToken.Id), nil, 1)
	GetUserQuotaDates(ctx)

	response := decodeAPIResponse(t, recorder)
	if response.Success {
		t.Fatalf("expected other-user token query to fail")
	}
}

func TestGetAllQuotaDatesAppliesUsernameAndTokenFiltersTogether(t *testing.T) {
	ownedToken := setupQuotaDataControllerTestDB(t)
	otherToken := seedToken(t, model.DB, 2, "other-token", "other1234token5678")
	bucket := int64(1710000000)

	for _, row := range []model.QuotaData{
		{UserID: 1, Username: "alice", TokenID: ownedToken.Id, TokenName: ownedToken.Name, ModelName: "gpt-test", CreatedAt: bucket, Count: 1, Quota: 100, TokenUsed: 10},
		{UserID: 2, Username: "bob", TokenID: otherToken.Id, TokenName: otherToken.Name, ModelName: "gpt-test", CreatedAt: bucket, Count: 1, Quota: 200, TokenUsed: 20},
	} {
		if err := model.DB.Create(&row).Error; err != nil {
			t.Fatalf("failed to seed quota row: %v", err)
		}
	}

	ctx, recorder := newAuthenticatedContext(t, http.MethodGet, fmt.Sprintf("/api/data?start_timestamp=%d&end_timestamp=%d&username=alice&token_id=%d", bucket, bucket, otherToken.Id), nil, 1)
	GetAllQuotaDates(ctx)

	response := decodeAPIResponse(t, recorder)
	if !response.Success {
		t.Fatalf("expected admin quota query to succeed, got message: %s", response.Message)
	}
	rows := decodeQuotaDataResponse(t, response)
	if len(rows) != 0 {
		t.Fatalf("expected mismatched username and token filters to return no rows, got %+v", rows)
	}
}
