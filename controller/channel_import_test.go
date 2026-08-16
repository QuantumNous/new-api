/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type clipboardImportTestResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Results []ClipboardChannelImportResult `json:"results"`
		Summary ClipboardChannelImportSummary  `json:"summary"`
	} `json:"data"`
}

func executeClipboardChannelImport(t *testing.T, request ClipboardChannelImportRequest) clipboardImportTestResponse {
	t.Helper()
	body, err := common.Marshal(request)
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/import", bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	ImportClipboardChannels(ctx)

	var response clipboardImportTestResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response), recorder.Body.String())
	require.True(t, response.Success, recorder.Body.String())
	return response
}

func TestImportClipboardChannelsCreatesVerifiedMultiKeyChannel(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Log{}))
	authorization := make(chan string, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authorization <- r.Header.Get("Authorization")
		assert.Equal(t, "/v1/models", r.URL.Path)
		_, _ = w.Write([]byte(`{"data":[{"id":"gpt-4.1"},{"id":"gpt-4.1-mini"}]}`))
	}))
	defer server.Close()

	probe := true
	request := ClipboardChannelImportRequest{
		BatchID:          "batch-create-verified",
		NamePrefix:       "Temporary",
		Type:             constant.ChannelTypeOpenAI,
		Group:            "default",
		Tag:              "clipboard-import",
		MultiKeyMode:     constant.MultiKeyModeRandom,
		ExpiresInSeconds: 3600,
		ProbeModels:      &probe,
		Items: []ClipboardChannelImportItem{{
			ItemID:  "provider-one",
			BaseURL: server.URL + "/v1/chat/completions?ignored=1",
			Keys: []string{
				"sk-first-import-key",
				"sk-second-import-key",
				"sk-first-import-key",
			},
		}},
	}

	response := executeClipboardChannelImport(t, request)

	require.Len(t, response.Data.Results, 1)
	result := response.Data.Results[0]
	assert.Equal(t, ClipboardChannelImportStatusCreated, result.Status)
	assert.True(t, result.Enabled)
	assert.Equal(t, 2, result.KeyCount)
	assert.Equal(t, []string{"gpt-4.1", "gpt-4.1-mini"}, result.Models)
	// Random multi-key mode picks any imported key for the probe, so the
	// contract is that one of the imported keys is used with Bearer auth.
	assert.Contains(t, []string{
		"Bearer sk-first-import-key",
		"Bearer sk-second-import-key",
	}, <-authorization)

	var stored model.Channel
	require.NoError(t, db.First(&stored, result.ChannelID).Error)
	assert.Equal(t, server.URL, stored.GetBaseURL())
	assert.Equal(t, "sk-first-import-key\nsk-second-import-key", stored.Key)
	assert.Equal(t, "gpt-4.1,gpt-4.1-mini", stored.Models)
	assert.Equal(t, common.ChannelStatusEnabled, stored.Status)
	assert.True(t, stored.ChannelInfo.IsMultiKey)
	assert.Equal(t, 2, stored.ChannelInfo.MultiKeySize)
	assert.Equal(t, model.ChannelImportSourceClipboard, stored.ImportSource)
	assert.Greater(t, stored.ExpiresAt, common.GetTimestamp())
	require.NotNil(t, stored.ImportID)

	secondResponse := executeClipboardChannelImport(t, request)
	require.Len(t, secondResponse.Data.Results, 1)
	assert.Equal(t, ClipboardChannelImportStatusExisting, secondResponse.Data.Results[0].Status)
	assert.True(t, secondResponse.Data.Results[0].Idempotent)
	assert.Equal(t, stored.Id, secondResponse.Data.Results[0].ChannelID)

	var count int64
	require.NoError(t, db.Model(&model.Channel{}).Count(&count).Error)
	assert.Equal(t, int64(1), count)
}

func TestImportClipboardChannelsSkipsExistingKeysAndCreatesOnlyNewOnes(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	baseURL := "https://duplicate.example.com"
	existing := model.Channel{
		Type:    constant.ChannelTypeOpenAI,
		Name:    "existing",
		BaseURL: &baseURL,
		Key:     "sk-already-imported-key",
		Status:  common.ChannelStatusEnabled,
	}
	require.NoError(t, db.Create(&existing).Error)

	probe := false
	response := executeClipboardChannelImport(t, ClipboardChannelImportRequest{
		BatchID:      "batch-with-duplicate",
		NamePrefix:   "Temporary",
		Type:         constant.ChannelTypeOpenAI,
		Models:       []string{"gpt-test"},
		ProbeModels:  &probe,
		MultiKeyMode: constant.MultiKeyModePolling,
		Items: []ClipboardChannelImportItem{{
			ItemID:  "duplicate-provider",
			BaseURL: baseURL + "/v1",
			Keys: []string{
				"sk-already-imported-key",
				"sk-new-provider-key",
			},
		}},
	})

	result := response.Data.Results[0]
	assert.Equal(t, ClipboardChannelImportStatusCreated, result.Status)
	assert.Equal(t, 1, result.KeyCount)
	assert.Equal(t, 1, result.SkippedDuplicateKeys)

	var created model.Channel
	require.NoError(t, db.First(&created, result.ChannelID).Error)
	assert.Equal(t, "sk-new-provider-key", created.Key)
	assert.Equal(t, constant.MultiKeyModePolling, created.ChannelInfo.MultiKeyMode)
}

func TestImportClipboardChannelsKeepsUnverifiedChannelDisabledAndRedactsErrors(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	secret := "sk-secret-must-not-leak"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer server.Close()

	probe := true
	response := executeClipboardChannelImport(t, ClipboardChannelImportRequest{
		BatchID:      "batch-probe-failure",
		NamePrefix:   "Temporary",
		Type:         constant.ChannelTypeOpenAI,
		ProbeModels:  &probe,
		MultiKeyMode: constant.MultiKeyModeRandom,
		Items: []ClipboardChannelImportItem{{
			ItemID:  "unverified-provider",
			BaseURL: server.URL,
			Keys:    []string{secret},
		}},
	})

	result := response.Data.Results[0]
	assert.Equal(t, ClipboardChannelImportStatusNeedsConfiguration, result.Status)
	assert.False(t, result.Enabled)
	assert.NotEmpty(t, result.Message)
	assert.NotContains(t, result.Message, secret)

	var stored model.Channel
	require.NoError(t, db.First(&stored, result.ChannelID).Error)
	assert.Equal(t, common.ChannelStatusAutoDisabled, stored.Status)
	assert.Empty(t, stored.Models)
}

func TestImportClipboardChannelsRetriesAnUnverifiedIdempotentItem(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	allowModels := false
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		if !allowModels {
			w.WriteHeader(http.StatusBadGateway)
			return
		}
		_, _ = w.Write([]byte(`{"data":[{"id":"gpt-recovered"}]}`))
	}))
	defer server.Close()

	probe := true
	request := ClipboardChannelImportRequest{
		BatchID:      "batch-retry-unverified",
		Type:         constant.ChannelTypeOpenAI,
		ProbeModels:  &probe,
		MultiKeyMode: constant.MultiKeyModeRandom,
		Items: []ClipboardChannelImportItem{{
			ItemID:  "retry-provider",
			BaseURL: server.URL,
			Keys:    []string{"sk-retry-provider-key"},
		}},
	}
	first := executeClipboardChannelImport(t, request)
	assert.Equal(t, ClipboardChannelImportStatusNeedsConfiguration, first.Data.Results[0].Status)

	allowModels = true
	request.RetryUnverified = true
	second := executeClipboardChannelImport(t, request)

	result := second.Data.Results[0]
	assert.Equal(t, ClipboardChannelImportStatusExisting, result.Status)
	assert.True(t, result.Enabled)
	assert.Equal(t, []string{"gpt-recovered"}, result.Models)
	var stored model.Channel
	require.NoError(t, db.First(&stored, result.ChannelID).Error)
	assert.Equal(t, common.ChannelStatusEnabled, stored.Status)
	assert.Equal(t, "gpt-recovered", stored.Models)
}

func TestRollbackClipboardChannelImportDeletesOnlyChannelsFromTheBatch(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Log{}))
	batchID := "batch-to-rollback"
	otherBatchID := "batch-to-keep"
	importSource := model.ChannelImportSourceClipboard
	channels := []model.Channel{
		{Name: "first", Key: "sk-first", ImportSource: importSource, ImportBatchID: &batchID},
		{Name: "second", Key: "sk-second", ImportSource: importSource, ImportBatchID: &batchID},
		{Name: "keep", Key: "sk-keep", ImportSource: importSource, ImportBatchID: &otherBatchID},
	}
	require.NoError(t, db.Create(&channels).Error)
	body, err := common.Marshal(ClipboardChannelImportRollbackRequest{BatchID: batchID})
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/channel/import/rollback", bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	RollbackClipboardChannelImport(ctx)

	var response struct {
		Success bool  `json:"success"`
		Data    int64 `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success)
	assert.Equal(t, int64(2), response.Data)
	var remaining []model.Channel
	require.NoError(t, db.Find(&remaining).Error)
	require.Len(t, remaining, 1)
	assert.Equal(t, "keep", remaining[0].Name)
}

func TestImportClipboardChannelsReportsInvalidItemWithoutCreatingChannel(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	probe := false

	response := executeClipboardChannelImport(t, ClipboardChannelImportRequest{
		BatchID:     "batch-invalid-url",
		NamePrefix:  "Temporary",
		Type:        constant.ChannelTypeOpenAI,
		Models:      []string{"gpt-test"},
		ProbeModels: &probe,
		Items: []ClipboardChannelImportItem{{
			ItemID:  "invalid-provider",
			BaseURL: "file:///tmp/upstream",
			Keys:    []string{"sk-valid-looking-key"},
		}},
	})

	require.Len(t, response.Data.Results, 1)
	assert.Equal(t, ClipboardChannelImportStatusFailed, response.Data.Results[0].Status)
	var count int64
	require.NoError(t, db.Model(&model.Channel{}).Count(&count).Error)
	assert.Zero(t, count)
}
