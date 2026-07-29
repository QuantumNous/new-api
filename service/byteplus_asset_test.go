package service

import (
	"context"
	"errors"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

type fakeBytePlusAssetClient struct {
	createGroupCalls int
	createAssetCalls int
	getAssetCalls    int

	groupID     string
	groupReqID  string
	assetID     string
	assetReqID  string
	status      BytePlusAssetStatus
	createErr   error
	getErr      error
	lastCreate  BytePlusCreateAssetRequest
	lastCreds   BytePlusCredentials
	lastGroup   string
	lastAssetID string
}

func (f *fakeBytePlusAssetClient) CreateAssetGroup(ctx context.Context, creds BytePlusCredentials, name string) (string, string, error) {
	f.createGroupCalls++
	f.lastCreds = creds
	f.lastGroup = name
	if f.createErr != nil {
		return "", "req-group-failed", f.createErr
	}
	return f.groupID, f.groupReqID, nil
}

func (f *fakeBytePlusAssetClient) CreateAsset(ctx context.Context, creds BytePlusCredentials, request BytePlusCreateAssetRequest) (string, string, error) {
	f.createAssetCalls++
	f.lastCreds = creds
	f.lastCreate = request
	if f.createErr != nil {
		return "", "req-asset-failed", f.createErr
	}
	return f.assetID, f.assetReqID, nil
}

func (f *fakeBytePlusAssetClient) GetAsset(ctx context.Context, creds BytePlusCredentials, upstreamAssetID string) (BytePlusAssetStatus, error) {
	f.getAssetCalls++
	f.lastCreds = creds
	f.lastAssetID = upstreamAssetID
	if f.getErr != nil {
		return BytePlusAssetStatus{}, f.getErr
	}
	return f.status, nil
}

func TestBytePlusAssetCreateRejectsInvalidPublicURLs(t *testing.T) {
	newBytePlusAssetServiceTestDB(t)
	fake := &fakeBytePlusAssetClient{}
	restore := installBytePlusAssetServiceTestDeps(t, fake)
	defer restore()
	insertBytePlusAssetChannel(t, 131, "default", common.ChannelStatusEnabled, structuredBytePlusKey())

	for _, rawURL := range []string{
		"",
		"ftp://example.com/a.png",
		"https://user@example.com/a.png",
		"https://localhost/a.png",
		"https://LOCALHOST./a.png",
		"http://example.com/a.png",
		"http://127.0.0.1/a.png",
		"http://10.1.2.3/a.png",
		"http://169.254.1.1/a.png",
		"http://[::1]/a.png",
		"https://example.com:81/a.png",
	} {
		t.Run(rawURL, func(t *testing.T) {
			_, err := CreateBytePlusAsset(context.Background(), 7, "default", "default", 0, dto.BytePlusAssetCreateRequest{
				URL:       rawURL,
				AssetType: "Image",
			})
			assertAssetError(t, err, types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
			assertAssetPublicErrorDoesNotLeak(t, err, rawURL)
			if fake.createGroupCalls != 0 || fake.createAssetCalls != 0 {
				t.Fatalf("invalid URL reached DB/upstream path: createGroup=%d createAsset=%d", fake.createGroupCalls, fake.createAssetCalls)
			}
		})
	}

	resp, err := CreateBytePlusAsset(context.Background(), 7, "default", "default", 0, dto.BytePlusAssetCreateRequest{
		URL:       "https://example.com/a.png",
		AssetType: "Image",
	})
	if err != nil {
		t.Fatalf("public domain should pass: %v", err)
	}
	if resp.ID == "" {
		t.Fatalf("response missing id: %+v", resp)
	}
}

func TestBytePlusAssetSourceURLStaysPublicWhenFetchSettingIsPermissive(t *testing.T) {
	original := *system_setting.GetFetchSetting()
	t.Cleanup(func() { *system_setting.GetFetchSetting() = original })
	system_setting.GetFetchSetting().EnableSSRFProtection = false
	system_setting.GetFetchSetting().AllowPrivateIp = true
	system_setting.GetFetchSetting().AllowedPorts = []string{"1-65535"}
	system_setting.GetFetchSetting().ApplyIPFilterForDomain = false

	if err := validateBytePlusAssetSourceURL("http://127.0.0.1/a.png"); err == nil {
		t.Fatal("literal private IP should remain rejected for BytePlus asset source URLs")
	}
}

func TestBytePlusAssetCreateSelectsStructuredBytePlusChannelAndPersistsProcessingAsset(t *testing.T) {
	newBytePlusAssetServiceTestDB(t)
	fake := &fakeBytePlusAssetClient{
		groupID:    "upstream-group",
		groupReqID: "req-group",
		assetID:    "upstream-asset",
		assetReqID: "req-asset",
	}
	restore := installBytePlusAssetServiceTestDeps(t, fake)
	defer restore()

	insertBytePlusAssetChannel(t, 120, "default", common.ChannelStatusEnabled, "ark-video-only")
	insertNonBytePlusAssetChannel(t, 121, "default")
	insertBytePlusAssetChannel(t, 131, "default", common.ChannelStatusEnabled, structuredBytePlusKey())

	resp, err := CreateBytePlusAsset(context.Background(), 7, "default", "default", 0, dto.BytePlusAssetCreateRequest{
		URL:       "https://example.com/portrait.mp4",
		AssetType: "Video",
	})
	if err != nil {
		t.Fatalf("CreateBytePlusAsset returned error: %v", err)
	}
	if resp.ID != "ast_fixed" || resp.Object != "asset" || resp.AssetType != "Video" || resp.Status != model.BytePlusAssetStatusProcessing {
		t.Fatalf("response = %+v", resp)
	}
	if resp.Moderation.Strategy != "Default" || resp.CreatedAt != 2000 {
		t.Fatalf("response defaults = %+v", resp)
	}
	if fake.createGroupCalls != 1 || fake.createAssetCalls != 1 {
		t.Fatalf("fake calls group=%d asset=%d", fake.createGroupCalls, fake.createAssetCalls)
	}
	if fake.lastCreate.GroupID != "upstream-group" || fake.lastCreate.URL != "https://example.com/portrait.mp4" || fake.lastCreate.AssetType != "Video" || fake.lastCreate.ModerationStrategy != "Default" {
		t.Fatalf("create request = %+v", fake.lastCreate)
	}
	if fake.lastCreds.APIKey != "ark-structured" || fake.lastCreds.ProjectName != "project3" {
		t.Fatalf("credentials = %+v", fake.lastCreds)
	}
	if !strings.HasPrefix(fake.lastGroup, "flatkey-assets-") || strings.ContainsAny(fake.lastGroup, "@:/.") {
		t.Fatalf("group name should be opaque: %q", fake.lastGroup)
	}

	var group model.BytePlusAssetGroup
	if err := model.DB.First(&group, "user_id = ? AND channel_id = ?", 7, 131).Error; err != nil {
		t.Fatalf("load group: %v", err)
	}
	if group.Status != model.BytePlusAssetGroupStatusActive || group.UpstreamGroupId != "upstream-group" || group.UpstreamRequestId != "req-group" {
		t.Fatalf("stored group = %+v", group)
	}
	var asset model.BytePlusAsset
	if err := model.DB.First(&asset, "public_id = ?", "ast_fixed").Error; err != nil {
		t.Fatalf("load asset: %v", err)
	}
	if asset.UserId != 7 || asset.ChannelId != 131 || asset.AssetGroupId != group.Id || asset.UpstreamAssetId != "upstream-asset" || asset.UpstreamRequestId != "req-asset" {
		t.Fatalf("stored asset = %+v", asset)
	}
	if asset.Status != model.BytePlusAssetStatusProcessing || asset.ModerationStrategy != "Default" {
		t.Fatalf("stored asset status = %+v", asset)
	}
}

func TestBytePlusAssetCreateDoesNotPersistSourceURLSecrets(t *testing.T) {
	newBytePlusAssetServiceTestDB(t)
	fake := &fakeBytePlusAssetClient{
		groupID:    "upstream-group",
		groupReqID: "req-group",
		assetID:    "upstream-asset",
		assetReqID: "req-asset",
	}
	restore := installBytePlusAssetServiceTestDeps(t, fake)
	defer restore()
	insertBytePlusAssetChannel(t, 131, "default", common.ChannelStatusEnabled, structuredBytePlusKey())

	signedURL := "https://example.com/private.mp4?X-Amz-Signature=secret-signature&X-Amz-Credential=secret-credential"
	resp, err := CreateBytePlusAsset(context.Background(), 7, "default", "default", 0, dto.BytePlusAssetCreateRequest{
		URL:       signedURL,
		AssetType: "Video",
	})
	if err != nil {
		t.Fatalf("CreateBytePlusAsset returned error: %v", err)
	}
	if resp.ID == "" || fake.lastCreate.URL != signedURL {
		t.Fatalf("upstream create did not receive original URL: resp=%+v lastCreate=%+v", resp, fake.lastCreate)
	}

	var asset model.BytePlusAsset
	if err := model.DB.First(&asset, "public_id = ?", "ast_fixed").Error; err != nil {
		t.Fatalf("load asset: %v", err)
	}
	if asset.SourceURL != "" {
		t.Fatalf("stored source URL leaked request URL: %q", asset.SourceURL)
	}
}

func TestBytePlusAssetCreateHonorsSpecificChannel(t *testing.T) {
	newBytePlusAssetServiceTestDB(t)
	restore := installBytePlusAssetServiceTestDeps(t, &fakeBytePlusAssetClient{groupID: "g", groupReqID: "req-g", assetID: "a", assetReqID: "req-a"})
	defer restore()
	insertBytePlusAssetChannel(t, 131, "default", common.ChannelStatusEnabled, structuredBytePlusKey())
	insertBytePlusAssetChannel(t, 132, "other", common.ChannelStatusEnabled, structuredBytePlusKey())

	_, err := CreateBytePlusAsset(context.Background(), 7, "default", "default", 132, dto.BytePlusAssetCreateRequest{
		URL:       "https://example.com/a.png",
		AssetType: "Image",
	})
	assertAssetError(t, err, types.ErrorCodeAssetChannelUnavailable, http.StatusServiceUnavailable)

	resp, err := CreateBytePlusAsset(context.Background(), 7, "default", "default", 131, dto.BytePlusAssetCreateRequest{
		URL:        "https://example.com/a.png",
		AssetType:  "Image",
		Moderation: &dto.BytePlusAssetModeration{Strategy: "Skip"},
	})
	if err != nil {
		t.Fatalf("specific channel create: code=%s status=%d message=%q", err.GetErrorCode(), err.StatusCode, err.Error())
	}
	if resp.Moderation.Strategy != "Skip" {
		t.Fatalf("moderation = %+v", resp.Moderation)
	}
}

func TestBytePlusAssetCreateReturnsInitializingForFreshGroupLeaseAndTakesOverStaleLease(t *testing.T) {
	newBytePlusAssetServiceTestDB(t)
	fake := &fakeBytePlusAssetClient{groupID: "new-group", groupReqID: "req-group", assetID: "new-asset", assetReqID: "req-asset"}
	restore := installBytePlusAssetServiceTestDeps(t, fake)
	defer restore()
	insertBytePlusAssetChannel(t, 131, "default", common.ChannelStatusEnabled, structuredBytePlusKey())
	if err := model.DB.Create(&model.BytePlusAssetGroup{
		UserId:           7,
		ChannelId:        131,
		Status:           model.BytePlusAssetGroupStatusCreating,
		LeaseUpdatedTime: 1990,
		CreatedTime:      1990,
		UpdatedTime:      1990,
	}).Error; err != nil {
		t.Fatalf("insert fresh lease: %v", err)
	}

	_, err := CreateBytePlusAsset(context.Background(), 7, "default", "default", 0, dto.BytePlusAssetCreateRequest{
		URL:       "https://example.com/a.png",
		AssetType: "Image",
	})
	assertAssetError(t, err, types.ErrorCodeAssetGroupInitializing, http.StatusServiceUnavailable)
	if fake.createGroupCalls != 0 {
		t.Fatalf("fresh lease should not call upstream, calls=%d", fake.createGroupCalls)
	}

	if err := model.DB.Model(&model.BytePlusAssetGroup{}).Where("user_id = ? AND channel_id = ?", 7, 131).Updates(map[string]any{
		"lease_updated_time": int64(100),
		"updated_time":       int64(100),
	}).Error; err != nil {
		t.Fatalf("age lease: %v", err)
	}
	resp, err := CreateBytePlusAsset(context.Background(), 7, "default", "default", 0, dto.BytePlusAssetCreateRequest{
		URL:       "https://example.com/a.png",
		AssetType: "Image",
	})
	if err != nil {
		t.Fatalf("stale takeover create: %v", err)
	}
	if resp.Status != model.BytePlusAssetStatusProcessing || fake.createGroupCalls != 1 {
		t.Fatalf("takeover resp=%+v calls=%d", resp, fake.createGroupCalls)
	}
}

func TestBytePlusAssetCreateReReadsFreshGroupLeaseAndReusesWhenItBecomesActive(t *testing.T) {
	newBytePlusAssetServiceTestDB(t)
	fake := &fakeBytePlusAssetClient{assetID: "new-asset", assetReqID: "req-asset"}
	restore := installBytePlusAssetServiceTestDeps(t, fake)
	defer restore()
	insertBytePlusAssetChannel(t, 131, "default", common.ChannelStatusEnabled, structuredBytePlusKey())
	if err := model.DB.Create(&model.BytePlusAssetGroup{
		UserId:           7,
		ChannelId:        131,
		Status:           model.BytePlusAssetGroupStatusCreating,
		LeaseUpdatedTime: 1990,
		CreatedTime:      1990,
		UpdatedTime:      1990,
	}).Error; err != nil {
		t.Fatalf("insert fresh lease: %v", err)
	}

	reloads := 0
	oldDelay := bytePlusAssetGroupRetryDelay
	bytePlusAssetGroupRetryDelay = func(attempt int) {
		reloads++
		if attempt == 2 {
			if err := model.DB.Model(&model.BytePlusAssetGroup{}).Where("user_id = ? AND channel_id = ?", 7, 131).Updates(map[string]any{
				"status":            model.BytePlusAssetGroupStatusActive,
				"upstream_group_id": "ready-group",
				"updated_time":      int64(2000),
			}).Error; err != nil {
				t.Fatalf("activate lease during retry: %v", err)
			}
		}
	}
	defer func() { bytePlusAssetGroupRetryDelay = oldDelay }()

	resp, err := CreateBytePlusAsset(context.Background(), 7, "default", "default", 0, dto.BytePlusAssetCreateRequest{
		URL:       "https://example.com/a.png",
		AssetType: "Image",
	})
	if err != nil {
		t.Fatalf("CreateBytePlusAsset after retry: %v", err)
	}
	if resp.Status != model.BytePlusAssetStatusProcessing || fake.createGroupCalls != 0 || fake.createAssetCalls != 1 {
		t.Fatalf("resp=%+v createGroup=%d createAsset=%d", resp, fake.createGroupCalls, fake.createAssetCalls)
	}
	if fake.lastCreate.GroupID != "ready-group" || reloads != 2 {
		t.Fatalf("retry reuse failed group=%q reloads=%d", fake.lastCreate.GroupID, reloads)
	}
}

func TestBytePlusAssetGroupRetryDelayDefaultUsesPositiveBoundedBackoff(t *testing.T) {
	defaultDelay := bytePlusAssetGroupRetryDelay
	oldSleep := bytePlusAssetGroupRetrySleep
	var delays []time.Duration
	bytePlusAssetGroupRetrySleep = func(delay time.Duration) {
		delays = append(delays, delay)
	}
	defer func() { bytePlusAssetGroupRetrySleep = oldSleep }()

	for attempt := 1; attempt <= 3; attempt++ {
		defaultDelay(attempt)
		delay := delays[len(delays)-1]
		if delay <= 0 {
			t.Fatalf("attempt %d delay = %s, want positive backoff", attempt, delay)
		}
		if delay >= time.Second {
			t.Fatalf("attempt %d delay = %s, want bounded short backoff", attempt, delay)
		}
	}
	if got, want := delays, []time.Duration{50 * time.Millisecond, 100 * time.Millisecond, 150 * time.Millisecond}; len(got) != len(want) || got[0] != want[0] || got[1] != want[1] || got[2] != want[2] {
		t.Fatalf("retry delays = %v, want %v", got, want)
	}
}

func TestBytePlusAssetGetRefreshesUpstreamStatusAndScopesOwnership(t *testing.T) {
	newBytePlusAssetServiceTestDB(t)
	fake := &fakeBytePlusAssetClient{
		status: BytePlusAssetStatus{
			UpstreamAssetID: "upstream-asset",
			Status:          model.BytePlusAssetStatusActive,
			RequestID:       "req-get",
		},
	}
	restore := installBytePlusAssetServiceTestDeps(t, fake)
	defer restore()
	insertBytePlusAssetChannel(t, 131, "default", common.ChannelStatusEnabled, structuredBytePlusKey())
	group := insertActiveBytePlusGroup(t, 7, 131, "upstream-group")
	insertBytePlusAssetRow(t, "ast_owned", 7, group.Id, 131, model.BytePlusAssetStatusProcessing, "upstream-asset")

	_, err := GetBytePlusAsset(context.Background(), 8, "ast_owned")
	assertAssetError(t, err, types.ErrorCodeAssetNotFound, http.StatusNotFound)

	resp, err := GetBytePlusAsset(context.Background(), 7, "ast_owned")
	if err != nil {
		t.Fatalf("GetBytePlusAsset: %v", err)
	}
	if resp.ID != "ast_owned" || resp.Status != model.BytePlusAssetStatusActive || resp.AssetType != "Video" {
		t.Fatalf("response = %+v", resp)
	}
	if fake.getAssetCalls != 1 || fake.lastAssetID != "upstream-asset" {
		t.Fatalf("get calls=%d asset=%q", fake.getAssetCalls, fake.lastAssetID)
	}
	raw, marshalErr := common.Marshal(resp)
	if marshalErr != nil {
		t.Fatalf("marshal response: %v", marshalErr)
	}
	for _, forbidden := range []string{"upstream", "group", "channel", "project", "source", "access", "secret"} {
		if strings.Contains(strings.ToLower(string(raw)), forbidden) {
			t.Fatalf("response leaked %q in %s", forbidden, raw)
		}
	}

	var stored model.BytePlusAsset
	if err := model.DB.First(&stored, "public_id = ?", "ast_owned").Error; err != nil {
		t.Fatalf("load stored asset: %v", err)
	}
	if stored.Status != model.BytePlusAssetStatusActive || stored.UpdatedTime != 2000 {
		t.Fatalf("stored after refresh = %+v", stored)
	}
}

func TestBytePlusAssetGetReturnsFailedBeforeReadinessForLocalFailure(t *testing.T) {
	newBytePlusAssetServiceTestDB(t)
	fake := &fakeBytePlusAssetClient{createErr: errors.New("upstream create failed")}
	restore := installBytePlusAssetServiceTestDeps(t, fake)
	defer restore()
	insertBytePlusAssetChannel(t, 131, "default", common.ChannelStatusEnabled, structuredBytePlusKey())
	insertActiveBytePlusGroup(t, 7, 131, "upstream-group")

	_, err := CreateBytePlusAsset(context.Background(), 7, "default", "default", 0, dto.BytePlusAssetCreateRequest{
		URL:       "https://example.com/a.png",
		AssetType: "Image",
	})
	assertAssetError(t, err, types.ErrorCodeAssetUpstreamError, http.StatusBadGateway)

	var stored model.BytePlusAsset
	if err := model.DB.First(&stored, "public_id = ?", "ast_fixed").Error; err != nil {
		t.Fatalf("load locally failed asset: %v", err)
	}
	if stored.Status != model.BytePlusAssetStatusFailed || stored.UpstreamAssetId != "" {
		t.Fatalf("stored asset = %+v", stored)
	}

	_, err = GetBytePlusAsset(context.Background(), 7, "ast_fixed")
	assertAssetError(t, err, types.ErrorCodeAssetFailed, http.StatusUnprocessableEntity)
	if fake.getAssetCalls != 0 {
		t.Fatalf("local failed asset should not call upstream, calls=%d", fake.getAssetCalls)
	}
}

func TestBytePlusAssetGetReturnsStoredTerminalStatusWhenUpstreamPollIsStale(t *testing.T) {
	newBytePlusAssetServiceTestDB(t)
	fake := &fakeBytePlusAssetClient{
		status: BytePlusAssetStatus{
			UpstreamAssetID: "upstream-asset",
			Status:          model.BytePlusAssetStatusProcessing,
			RequestID:       "req-stale",
		},
	}
	restore := installBytePlusAssetServiceTestDeps(t, fake)
	defer restore()
	insertBytePlusAssetChannel(t, 131, "default", common.ChannelStatusEnabled, structuredBytePlusKey())
	group := insertActiveBytePlusGroup(t, 7, 131, "upstream-group")
	insertBytePlusAssetRow(t, "ast_active", 7, group.Id, 131, model.BytePlusAssetStatusActive, "upstream-asset")

	resp, err := GetBytePlusAsset(context.Background(), 7, "ast_active")
	if err != nil {
		t.Fatalf("GetBytePlusAsset: %v", err)
	}
	if resp.Status != model.BytePlusAssetStatusActive {
		t.Fatalf("response status = %s, want %s", resp.Status, model.BytePlusAssetStatusActive)
	}

	var stored model.BytePlusAsset
	if err := model.DB.First(&stored, "public_id = ?", "ast_active").Error; err != nil {
		t.Fatalf("load stored asset: %v", err)
	}
	if stored.Status != model.BytePlusAssetStatusActive || stored.UpdatedTime != 1900 {
		t.Fatalf("stored asset regressed: %+v", stored)
	}
}

func TestBytePlusAssetSpecificChannelUsesCrossDatabaseAbilityHelper(t *testing.T) {
	newBytePlusAssetServiceTestDB(t)
	restore := installBytePlusAssetServiceTestDeps(t, &fakeBytePlusAssetClient{groupID: "g", assetID: "a"})
	defer restore()
	insertBytePlusAssetChannel(t, 131, "default", common.ChannelStatusEnabled, structuredBytePlusKey())
	source, err := os.ReadFile("byteplus_asset.go")
	if err != nil {
		t.Fatalf("read source: %v", err)
	}
	if strings.Contains(string(source), "`group`") {
		t.Fatalf("service must not hardcode SQL dialect quoting for group column")
	}

	resp, createErr := CreateBytePlusAsset(context.Background(), 7, "default", "default", 131, dto.BytePlusAssetCreateRequest{
		URL:       "https://example.com/a.png",
		AssetType: "Image",
	})
	if createErr != nil {
		if apiErr := createErr; apiErr != nil {
			t.Fatalf("specific channel create: code=%s status=%d message=%q", apiErr.GetErrorCode(), apiErr.StatusCode, apiErr.Error())
		}
	}
	if resp.ID == "" {
		t.Fatalf("missing response id: %+v", resp)
	}
}

func TestBytePlusAssetUpdateFailureLogsOnlySafeCorrelationFields(t *testing.T) {
	newBytePlusAssetServiceTestDB(t)
	fake := &fakeBytePlusAssetClient{
		groupID:    "upstream-group-secret",
		groupReqID: "req-group",
		assetID:    "upstream-asset-secret",
		assetReqID: "req-asset",
	}
	restore := installBytePlusAssetServiceTestDeps(t, fake)
	defer restore()
	insertBytePlusAssetChannel(t, 131, "default", common.ChannelStatusEnabled, structuredBytePlusKey())

	oldUpdate := bytePlusAssetUpdateAssetUpstreamCreated
	bytePlusAssetUpdateAssetUpstreamCreated = func(assetID int64, upstreamAssetID string, upstreamRequestID string, status string, now int64) error {
		return errors.New("sql failed for https://example.com/private.png upstream-asset-secret upstream-group-secret project3 sk-test")
	}
	defer func() { bytePlusAssetUpdateAssetUpstreamCreated = oldUpdate }()

	var logged string
	oldLog := bytePlusAssetRestrictedLog
	bytePlusAssetRestrictedLog = func(message string) { logged = message }
	defer func() { bytePlusAssetRestrictedLog = oldLog }()

	ctx := context.WithValue(context.Background(), common.RequestIdKey, "flatkey-request-id")
	_, err := CreateBytePlusAsset(ctx, 7, "default", "default", 0, dto.BytePlusAssetCreateRequest{
		URL:       "https://example.com/private.png",
		AssetType: "Image",
	})
	assertAssetError(t, err, types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	if logged == "" || !strings.Contains(logged, "flatkey-request-id") || !strings.Contains(logged, "channel_id=131") || !strings.Contains(logged, "upstream_request_id=req-asset") {
		t.Fatalf("log missing safe fields: %q", logged)
	}
	for _, forbidden := range []string{"private.png", "ast_fixed", "upstream-asset-secret", "upstream-group-secret", "project3", "sk-test", "sql failed"} {
		if strings.Contains(logged, forbidden) {
			t.Fatalf("restricted log leaked %q in %q", forbidden, logged)
		}
	}
}

func TestBytePlusAssetCreateMarksLocalAssetFailedWhenUpstreamPersistFails(t *testing.T) {
	newBytePlusAssetServiceTestDB(t)
	fake := &fakeBytePlusAssetClient{
		groupID:    "upstream-group-secret",
		groupReqID: "req-group",
		assetID:    "upstream-asset-secret",
		assetReqID: "req-asset",
	}
	restore := installBytePlusAssetServiceTestDeps(t, fake)
	defer restore()
	insertBytePlusAssetChannel(t, 131, "default", common.ChannelStatusEnabled, structuredBytePlusKey())

	oldUpdate := bytePlusAssetUpdateAssetUpstreamCreated
	bytePlusAssetUpdateAssetUpstreamCreated = func(assetID int64, upstreamAssetID string, upstreamRequestID string, status string, now int64) error {
		return errors.New("transient upstream persistence failure")
	}
	defer func() { bytePlusAssetUpdateAssetUpstreamCreated = oldUpdate }()

	_, err := CreateBytePlusAsset(context.Background(), 7, "default", "default", 0, dto.BytePlusAssetCreateRequest{
		URL:       "https://example.com/private.png?token=secret",
		AssetType: "Image",
	})
	assertAssetError(t, err, types.ErrorCodeAssetStorageError, http.StatusInternalServerError)

	var asset model.BytePlusAsset
	if err := model.DB.First(&asset, "public_id = ?", "ast_fixed").Error; err != nil {
		t.Fatalf("load asset: %v", err)
	}
	if asset.Status != model.BytePlusAssetStatusFailed || asset.UpstreamAssetId != "" || asset.SourceURL != "" {
		t.Fatalf("asset should be locally failed without persisting upstream/source secrets: %+v", asset)
	}
}

func TestBytePlusAssetErrorsUseStablePublicMessages(t *testing.T) {
	apiErr := assetError(errors.New("sql failed with sk-secret upstream-asset project3 https://internal.example"), types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	openaiErr := apiErr.ToOpenAIError()
	raw, err := common.Marshal(openaiErr)
	if err != nil {
		t.Fatalf("marshal openai error: %v", err)
	}
	text := string(raw)
	for _, forbidden := range []string{"sql failed", "sk-secret", "upstream-asset", "project3", "internal.example"} {
		if strings.Contains(openaiErr.Message, forbidden) || strings.Contains(text, forbidden) {
			t.Fatalf("public error leaked %q: message=%q raw=%s", forbidden, openaiErr.Message, text)
		}
	}
	if openaiErr.Code != types.ErrorCodeAssetStorageError || openaiErr.Message == "" {
		t.Fatalf("openai error = %+v", openaiErr)
	}
}

func assertAssetError(t *testing.T, err error, code types.ErrorCode, status int) {
	t.Helper()
	if err == nil {
		t.Fatalf("error = nil, want *types.NewAPIError %s/%d", code, status)
	}
	var apiErr *types.NewAPIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("error = %T %v, want *types.NewAPIError", err, err)
	}
	if apiErr == nil {
		t.Fatalf("error = nil *types.NewAPIError, want %s/%d", code, status)
	}
	if apiErr.GetErrorCode() != code || apiErr.StatusCode != status {
		t.Fatalf("error code/status = %s/%d, want %s/%d (%v)", apiErr.GetErrorCode(), apiErr.StatusCode, code, status, apiErr)
	}
}

func assertAssetPublicErrorDoesNotLeak(t *testing.T, apiErr *types.NewAPIError, forbidden ...string) {
	t.Helper()
	openaiErr := apiErr.ToOpenAIError()
	raw, err := common.Marshal(openaiErr)
	if err != nil {
		t.Fatalf("marshal public error: %v", err)
	}
	text := strings.ToLower(openaiErr.Message + " " + string(raw))
	for _, item := range forbidden {
		item = strings.TrimSpace(strings.ToLower(item))
		if item != "" && strings.Contains(text, item) {
			t.Fatalf("public error leaked %q: message=%q raw=%s", item, openaiErr.Message, raw)
		}
	}
	for _, item := range []string{"localhost", "127.0.0.1", "169.254", "::1", "example.com:81", "user@", "source url"} {
		if strings.Contains(text, item) {
			t.Fatalf("public error leaked internal URL detail %q: message=%q raw=%s", item, openaiErr.Message, raw)
		}
	}
}

func installBytePlusAssetServiceTestDeps(t *testing.T, fake *fakeBytePlusAssetClient) func() {
	t.Helper()
	oldNow := bytePlusAssetNow
	oldID := bytePlusAssetPublicID
	oldFactory := bytePlusAssetClientFactory
	bytePlusAssetNow = func() int64 { return 2000 }
	bytePlusAssetPublicID = func() (string, error) { return "ast_fixed", nil }
	bytePlusAssetClientFactory = func(channel *model.Channel) (bytePlusAssetAPI, error) { return fake, nil }
	return func() {
		bytePlusAssetNow = oldNow
		bytePlusAssetPublicID = oldID
		bytePlusAssetClientFactory = oldFactory
	}
}

func newBytePlusAssetServiceTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&model.Channel{}, &model.Ability{}, &model.BytePlusAssetGroup{}, &model.BytePlusAsset{}); err != nil {
		t.Fatalf("automigrate: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("get sqlite handle: %v", err)
	}
	oldDB := model.DB
	oldMemoryCache := common.MemoryCacheEnabled
	model.DB = db
	common.MemoryCacheEnabled = false
	t.Cleanup(func() {
		model.DB = oldDB
		common.MemoryCacheEnabled = oldMemoryCache
		_ = sqlDB.Close()
	})
	return db
}

func insertBytePlusAssetChannel(t *testing.T, id int, group string, status int, key string) {
	t.Helper()
	priority := int64(id)
	weight := uint(1)
	ch := model.Channel{
		Id:       id,
		Type:     constant.ChannelTypeBytePlus,
		Key:      key,
		Status:   status,
		Name:     "byteplus",
		Models:   "seedance-2.0",
		Group:    group,
		Priority: &priority,
		Weight:   &weight,
	}
	if err := model.DB.Create(&ch).Error; err != nil {
		t.Fatalf("insert channel: %v", err)
	}
	if err := model.DB.Create(&model.Ability{
		Group:     group,
		Model:     "seedance-2.0",
		ChannelId: id,
		Enabled:   status == common.ChannelStatusEnabled,
		Priority:  &priority,
		Weight:    weight,
	}).Error; err != nil {
		t.Fatalf("insert ability: %v", err)
	}
}

func insertNonBytePlusAssetChannel(t *testing.T, id int, group string) {
	t.Helper()
	priority := int64(id + 1000)
	weight := uint(1)
	ch := model.Channel{
		Id:       id,
		Type:     constant.ChannelTypeOpenAI,
		Key:      "sk-openai",
		Status:   common.ChannelStatusEnabled,
		Name:     "openai",
		Models:   "seedance-2.0",
		Group:    group,
		Priority: &priority,
		Weight:   &weight,
	}
	if err := model.DB.Create(&ch).Error; err != nil {
		t.Fatalf("insert non byteplus channel: %v", err)
	}
	if err := model.DB.Create(&model.Ability{
		Group:     group,
		Model:     "seedance-2.0",
		ChannelId: id,
		Enabled:   true,
		Priority:  &priority,
		Weight:    weight,
	}).Error; err != nil {
		t.Fatalf("insert non byteplus ability: %v", err)
	}
}

func insertActiveBytePlusGroup(t *testing.T, userID int, channelID int, upstreamGroupID string) model.BytePlusAssetGroup {
	t.Helper()
	group := model.BytePlusAssetGroup{
		UserId:           userID,
		ChannelId:        channelID,
		UpstreamGroupId:  upstreamGroupID,
		Status:           model.BytePlusAssetGroupStatusActive,
		LeaseUpdatedTime: 1900,
		CreatedTime:      1900,
		UpdatedTime:      1900,
	}
	if err := model.DB.Create(&group).Error; err != nil {
		t.Fatalf("insert group: %v", err)
	}
	return group
}

func insertBytePlusAssetRow(t *testing.T, publicID string, userID int, groupID int64, channelID int, status string, upstreamAssetID string) {
	t.Helper()
	if err := model.DB.Create(&model.BytePlusAsset{
		PublicId:           publicID,
		UserId:             userID,
		AssetGroupId:       groupID,
		ChannelId:          channelID,
		UpstreamAssetId:    upstreamAssetID,
		AssetType:          "Video",
		SourceURL:          "https://example.com/a.mp4",
		ModerationStrategy: "Skip",
		Status:             status,
		CreatedTime:        1900,
		UpdatedTime:        1900,
	}).Error; err != nil {
		t.Fatalf("insert asset: %v", err)
	}
}

func structuredBytePlusKey() string {
	return `{"api_key":"ark-structured","access_key_id":"ak-test","secret_access_key":"sk-test","project_name":"project3"}`
}
