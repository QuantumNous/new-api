package service

import (
	"bytes"
	"context"
	"crypto/sha256"
	"crypto/tls"
	"encoding/hex"
	"errors"
	"fmt"
	"hash"
	"io"
	"mime"
	"net"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"gorm.io/gorm"
)

const (
	assetPublicIDPrefix    = "ast_"
	assetUploadIDPrefix    = "upl_"
	assetPublicIDRandomLen = 32
	assetRedirectLimit     = 5
	assetCleanupLeaseTTL   = 5 * time.Minute
	assetFetchDialTimeout  = 10 * time.Second
	assetFetchTLSHandshake = 10 * time.Second
	assetFetchHeaderWait   = 30 * time.Second
)

var (
	ErrAssetInvalidSourceURL     = errors.New("invalid asset source url")
	ErrAssetUnsupportedMediaType = errors.New("unsupported asset media type")
	ErrAssetTooLarge             = errors.New("asset too large")
	ErrAssetStorageDisabled      = errors.New("asset storage is disabled")
	ErrAssetUploadNotFound       = errors.New("asset upload not found")
	ErrAssetUploadValidation     = errors.New("asset upload validation failed")
	ErrAssetFileRequired         = errors.New("asset file is required")
	ErrAssetExpired              = errors.New("asset expired")
	ErrAssetTypeMismatch         = errors.New("asset type mismatch")
	assetNow                     = time.Now
	assetHTTPClient              = http.DefaultClient
	assetValidateURL             = validateAssetURLWithFetchSetting
	assetPublicID                = func() (string, error) { return randomAssetID(assetPublicIDPrefix) }
	assetUploadID                = func() (string, error) { return randomAssetID(assetUploadIDPrefix) }
	assetRandomSuffix            = func() (string, error) { return common.GenerateRandomCharsKey(24) }
)

type assetFetchResolver interface {
	LookupIP(ctx context.Context, host string) ([]net.IP, error)
}

type assetFetchResolverFunc func(ctx context.Context, host string) ([]net.IP, error)

func (f assetFetchResolverFunc) LookupIP(ctx context.Context, host string) ([]net.IP, error) {
	return f(ctx, host)
}

type assetFetchHTTPClientConfig struct {
	Timeout     time.Duration
	Resolver    assetFetchResolver
	DialContext func(ctx context.Context, network, address string) (net.Conn, error)
}

type AssetFromURLRequest struct {
	UserID    int
	AssetType string
	URL       string
}

type AssetUploadRequest struct {
	UserID    int
	AssetType string
	Filename  string
	Body      io.Reader
}

type AssetUploadSessionRequest struct {
	UserID      int
	Owner       string
	AssetType   string
	ContentType string
	SizeBytes   int64
}

type AssetCompleteUploadRequest struct {
	UploadID string
	Owner    string
}

type CleanupExpiredAssetSourcesRequest struct {
	Owner string
	Limit int
}

type CleanupExpiredAssetSourcesResult struct {
	Claimed int
	Deleted int
}

type AssetResult struct {
	PublicID        string
	AssetType       string
	Status          string
	AvailableModels []string
	SignedURL       string
	ContentType     string
	SizeBytes       int64
	SHA256          string
	CreatedAt       int64
	SourceExpiresAt int64
}

type AssetUploadSessionResult struct {
	UploadID      string
	PublicID      string
	ObjectKey     string
	SignedURL     string
	UploadHeaders map[string]string
	ExpiresAt     int64
}

func CreateAssetFromURL(ctx context.Context, request AssetFromURLRequest) (*AssetResult, error) {
	cfg := CurrentAssetStorageConfig()
	if strings.TrimSpace(cfg.Bucket) == "" {
		return nil, ErrAssetStorageDisabled
	}
	request.AssetType = normalizeAssetType(request.AssetType)
	limit, ok := cfg.TypeLimits[request.AssetType]
	if !ok {
		return nil, ErrAssetUnsupportedMediaType
	}
	finalResp, err := fetchAssetSource(ctx, request.URL)
	if err != nil {
		return nil, err
	}
	defer finalResp.Body.Close()
	detected, prefixReader, err := detectAssetMediaPrefix(finalResp.Body, request.AssetType, limit)
	if err != nil {
		return nil, err
	}
	publicID, objectKey, err := newAssetObjectKey(cfg, request.UserID, request.AssetType, detected)
	if err != nil {
		return nil, err
	}
	detected, sha, size, objectGeneration, err := putAndValidateAssetMedia(ctx, cfg.Bucket, objectKey, prefixReader, request.AssetType, limit)
	if err != nil {
		return nil, err
	}
	now := assetNow()
	asset, err := model.CreateAsset(model.Asset{
		PublicId:         publicID,
		UserId:           request.UserID,
		AssetType:        request.AssetType,
		Status:           model.AssetStatusActive,
		SourceStatus:     model.AssetSourceStatusAvailable,
		StorageBackend:   defaultAssetStorageBackend,
		StorageBucket:    cfg.Bucket,
		ObjectKey:        objectKey,
		ObjectGeneration: objectGeneration,
		ContentType:      detected,
		SizeBytes:        size,
		SHA256:           sha,
		SourceExpiresAt:  now.Add(cfg.SourceRetention).Unix(),
		CreatedAt:        now.Unix(),
		UpdatedAt:        now.Unix(),
	})
	if err != nil {
		_ = assetObjectStore.Delete(ctx, cfg.Bucket, objectKey, objectGeneration)
		return nil, err
	}
	return resultFromAsset(asset), nil
}

func UploadAsset(ctx context.Context, request AssetUploadRequest) (*AssetResult, error) {
	cfg := CurrentAssetStorageConfig()
	if request.Body == nil {
		return nil, ErrAssetFileRequired
	}
	request.AssetType = normalizeAssetType(request.AssetType)
	typeLimit, ok := cfg.TypeLimits[request.AssetType]
	if !ok {
		return nil, ErrAssetUnsupportedMediaType
	}
	limit := typeLimit
	if cfg.MultipartMaxBytes < limit {
		limit = cfg.MultipartMaxBytes
	}
	detected, prefixReader, err := detectAssetMediaPrefix(request.Body, request.AssetType, limit)
	if err != nil {
		return nil, err
	}
	publicID, objectKey, err := newAssetObjectKey(cfg, request.UserID, request.AssetType, detected)
	if err != nil {
		return nil, err
	}
	detected, sha, size, objectGeneration, err := putAndValidateAssetMedia(ctx, cfg.Bucket, objectKey, prefixReader, request.AssetType, limit)
	if err != nil {
		return nil, err
	}
	now := assetNow()
	asset, err := model.CreateAsset(model.Asset{
		PublicId:         publicID,
		UserId:           request.UserID,
		AssetType:        request.AssetType,
		Status:           model.AssetStatusActive,
		SourceStatus:     model.AssetSourceStatusAvailable,
		StorageBackend:   defaultAssetStorageBackend,
		StorageBucket:    cfg.Bucket,
		ObjectKey:        objectKey,
		ObjectGeneration: objectGeneration,
		ContentType:      detected,
		SizeBytes:        size,
		SHA256:           sha,
		SourceExpiresAt:  now.Add(cfg.SourceRetention).Unix(),
		CreatedAt:        now.Unix(),
		UpdatedAt:        now.Unix(),
	})
	if err != nil {
		_ = assetObjectStore.Delete(ctx, cfg.Bucket, objectKey, objectGeneration)
		return nil, err
	}
	return resultFromAsset(asset), nil
}

func CreateAssetUploadSession(ctx context.Context, request AssetUploadSessionRequest) (*AssetUploadSessionResult, error) {
	cfg := CurrentAssetStorageConfig()
	request.AssetType = normalizeAssetType(request.AssetType)
	limit, ok := cfg.TypeLimits[request.AssetType]
	if !ok {
		return nil, ErrAssetUnsupportedMediaType
	}
	if request.SizeBytes <= 0 || request.SizeBytes > limit {
		return nil, ErrAssetTooLarge
	}
	contentType, ext := normalizeAssetContentType(request.AssetType, request.ContentType)
	if contentType == "" {
		if category := supportedAssetContentTypeCategory(request.ContentType); category != "" && category != request.AssetType {
			return nil, ErrAssetTypeMismatch
		}
		return nil, ErrAssetUnsupportedMediaType
	}
	publicID, err := assetPublicID()
	if err != nil {
		return nil, err
	}
	random, err := assetRandomSuffix()
	if err != nil {
		return nil, err
	}
	objectKey := buildAssetObjectKey(cfg.KeyPrefix, request.UserID, publicID, random, ext)
	uploadID, err := assetUploadID()
	if err != nil {
		return nil, err
	}
	now := assetNow()
	uploadHeaders := createOnlyAssetUploadHeaders()
	signedURL, err := assetObjectStore.SignURL(ctx, cfg.Bucket, objectKey, AssetSignedURLRequest{
		Method:              http.MethodPut,
		TTL:                 cfg.SignedURLTTL,
		ContentType:         contentType,
		ServiceAccountEmail: cfg.ServiceAccountEmail,
		Headers:             assetSignedHeaderLines(uploadHeaders),
	})
	if err != nil {
		return nil, err
	}
	asset, err := model.CreateAssetWithUploadSession(model.Asset{
		PublicId:       publicID,
		UserId:         request.UserID,
		AssetType:      request.AssetType,
		Status:         model.AssetStatusCreating,
		SourceStatus:   model.AssetSourceStatusUnavailable,
		StorageBackend: defaultAssetStorageBackend,
		StorageBucket:  cfg.Bucket,
		ObjectKey:      objectKey,
		ContentType:    contentType,
		SizeBytes:      request.SizeBytes,
		CreatedAt:      now.Unix(),
		UpdatedAt:      now.Unix(),
	}, model.AssetUpload{
		UploadId:    uploadID,
		Owner:       request.Owner,
		ContentType: contentType,
		SizeBytes:   request.SizeBytes,
		ExpiresAt:   now.Add(cfg.SignedURLTTL).Unix(),
		Status:      model.AssetUploadStatusPending,
		CreatedAt:   now.Unix(),
		UpdatedAt:   now.Unix(),
	})
	if err != nil {
		return nil, err
	}
	return &AssetUploadSessionResult{
		UploadID:      uploadID,
		PublicID:      asset.PublicId,
		ObjectKey:     objectKey,
		SignedURL:     signedURL,
		UploadHeaders: uploadHeaders,
		ExpiresAt:     now.Add(cfg.SignedURLTTL).Unix(),
	}, nil
}

func CompleteAssetUpload(ctx context.Context, request AssetCompleteUploadRequest) (*AssetResult, error) {
	upload, err := model.GetAssetUploadForOwner(request.UploadID, request.Owner)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrAssetUploadNotFound
		}
		return nil, err
	}
	if upload.Status != model.AssetUploadStatusPending {
		if upload.Status == model.AssetUploadStatusExpired {
			return nil, ErrAssetExpired
		}
		return nil, ErrAssetUploadValidation
	}
	now := assetNow()
	if upload.ExpiresAt <= now.Unix() {
		expired, err := expireCompletedAssetUpload(ctx, upload, now)
		if err != nil {
			return nil, err
		}
		if !expired {
			return nil, ErrAssetUploadValidation
		}
		return nil, ErrAssetExpired
	}
	attrs, err := assetObjectStore.Attrs(ctx, upload.StorageBucket, upload.ObjectKey)
	if err != nil {
		_ = failAssetUploadValidation(ctx, upload, 0)
		return nil, ErrAssetUploadValidation
	}
	if attrs.Size != upload.SizeBytes {
		_ = failAssetUploadValidation(ctx, upload, attrs.Generation)
		return nil, ErrAssetUploadValidation
	}
	reader, err := assetObjectStore.Open(ctx, upload.StorageBucket, upload.ObjectKey, attrs.Generation)
	if err != nil {
		_ = failAssetUploadValidation(ctx, upload, attrs.Generation)
		return nil, ErrAssetUploadValidation
	}
	defer reader.Close()
	cfg := CurrentAssetStorageConfig()
	detected, sha, size, err := hashAndValidateAssetMedia(reader, upload.AssetType, cfg.TypeLimits[upload.AssetType])
	if err != nil {
		_ = failAssetUploadValidation(ctx, upload, attrs.Generation)
		if errors.Is(err, ErrAssetTypeMismatch) {
			return nil, ErrAssetTypeMismatch
		}
		return nil, ErrAssetUploadValidation
	}
	if size != attrs.Size {
		_ = failAssetUploadValidation(ctx, upload, attrs.Generation)
		return nil, ErrAssetUploadValidation
	}
	if detected != upload.ContentType || detected != attrs.ContentType {
		_ = failAssetUploadValidation(ctx, upload, attrs.Generation)
		return nil, ErrAssetTypeMismatch
	}
	activationNow := assetNow()
	completed, expired, err := model.CompleteAssetUploadCAS(upload.UploadId, request.Owner, model.AssetUploadCompletion{
		ContentType:      detected,
		SizeBytes:        size,
		SHA256:           sha,
		ObjectGeneration: attrs.Generation,
		SourceExpiresAt:  activationNow.Add(cfg.SourceRetention).Unix(),
		Now:              activationNow.Unix(),
	})
	if err != nil {
		return nil, err
	}
	if expired {
		_, err := expireCompletedAssetUploadGeneration(ctx, upload, attrs.Generation, activationNow)
		if err != nil {
			return nil, err
		}
		return nil, ErrAssetExpired
	}
	if !completed {
		return nil, ErrAssetUploadNotFound
	}
	asset, err := model.GetAssetByIDForUser(upload.AssetId, upload.UserId)
	if err != nil {
		return nil, err
	}
	return resultFromAsset(asset), nil
}

func GetAsset(ctx context.Context, userID int, publicID string) (*AssetResult, error) {
	publicID = strings.TrimSpace(publicID)
	if publicID == "" {
		return nil, ErrAssetUploadNotFound
	}
	var asset model.Asset
	if err := model.DB.Where("user_id = ? AND public_id = ?", userID, publicID).First(&asset).Error; err == nil {
		result := publicResultFromAsset(&asset)
		result.Status = projectedAssetStatus(&asset)
		return result, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	var legacy model.BytePlusAsset
	if err := model.DB.Where("user_id = ? AND public_id = ?", userID, publicID).First(&legacy).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) || model.IsBytePlusAssetNotFound(err) {
			return nil, ErrAssetUploadNotFound
		}
		return nil, err
	}
	return &AssetResult{
		PublicID:  legacy.PublicId,
		AssetType: legacy.AssetType,
		Status:    legacy.Status,
		CreatedAt: legacy.CreatedTime,
	}, nil
}

// projectedAssetStatus keeps the public read contract consistent with the
// submit path: an asset whose recoverable source has lapsed is only still
// Active while some provider binding survives. The stored row is left alone;
// the cleanup worker owns durable status transitions.
func projectedAssetStatus(asset *model.Asset) string {
	if asset.Status != model.AssetStatusActive {
		return asset.Status
	}
	reference := assetReferenceAsset{
		SourceStatus:    asset.SourceStatus,
		StorageBackend:  asset.StorageBackend,
		StorageBucket:   asset.StorageBucket,
		ObjectKey:       asset.ObjectKey,
		SourceExpiresAt: asset.SourceExpiresAt,
	}
	if !assetReferenceSourceExpired(reference) {
		return asset.Status
	}
	var activeBindings int64
	if err := model.DB.Model(&model.AssetBinding{}).
		Where("asset_id = ? AND status = ?", asset.Id, model.AssetStatusActive).
		Where("upstream_asset_id <> ?", "").
		Count(&activeBindings).Error; err != nil || activeBindings > 0 {
		return asset.Status
	}
	return model.AssetStatusExpired
}

func expireCompletedAssetUpload(ctx context.Context, upload *model.AssetUpload, now time.Time) (bool, error) {
	attrs, err := assetObjectStore.Attrs(ctx, upload.StorageBucket, upload.ObjectKey)
	if err != nil {
		if isAssetObjectNotFound(err) {
			return model.ExpireAssetUploadCAS(upload.UploadId, upload.Owner, model.AssetUploadExpiration{
				SourceStatus: model.AssetSourceStatusExpired,
				ClearStorage: true,
				Now:          now.Unix(),
			})
		}
		return false, nil
	}
	if err := assetObjectStore.Delete(ctx, upload.StorageBucket, upload.ObjectKey, attrs.Generation); err != nil && !isAssetObjectNotFound(err) {
		return model.ExpireAssetUploadCAS(upload.UploadId, upload.Owner, model.AssetUploadExpiration{
			SourceStatus:     model.AssetSourceStatusCleanupPending,
			ObjectGeneration: attrs.Generation,
			ClearStorage:     false,
			Now:              now.Unix(),
		})
	}
	return model.ExpireAssetUploadCAS(upload.UploadId, upload.Owner, model.AssetUploadExpiration{
		SourceStatus: model.AssetSourceStatusExpired,
		ClearStorage: true,
		Now:          now.Unix(),
	})
}

func expireCompletedAssetUploadGeneration(ctx context.Context, upload *model.AssetUpload, generation int64, now time.Time) (bool, error) {
	clearStorage := true
	sourceStatus := model.AssetSourceStatusExpired
	if err := assetObjectStore.Delete(ctx, upload.StorageBucket, upload.ObjectKey, generation); err != nil && !isAssetObjectNotFound(err) {
		clearStorage = false
		sourceStatus = model.AssetSourceStatusCleanupPending
	}
	return model.ExpireAssetUploadCAS(upload.UploadId, upload.Owner, model.AssetUploadExpiration{
		SourceStatus:     sourceStatus,
		ObjectGeneration: generation,
		ClearStorage:     clearStorage,
		Now:              now.Unix(),
	})
}

func failAssetUploadValidation(ctx context.Context, upload *model.AssetUpload, generation int64) error {
	clearStorage := true
	sourceStatus := model.AssetSourceStatusUnavailable
	if generation > 0 {
		if err := assetObjectStore.Delete(ctx, upload.StorageBucket, upload.ObjectKey, generation); err != nil && !isAssetObjectNotFound(err) {
			clearStorage = false
			sourceStatus = model.AssetSourceStatusCleanupPending
		}
	}
	_, err := model.FailAssetUploadCAS(upload.UploadId, upload.Owner, model.AssetUploadFailure{
		SourceStatus:     sourceStatus,
		ObjectGeneration: generation,
		ClearStorage:     clearStorage,
		Now:              assetNow().Unix(),
	})
	return err
}

func CleanupExpiredAssetSources(ctx context.Context, request CleanupExpiredAssetSourcesRequest) (CleanupExpiredAssetSourcesResult, error) {
	now := assetNow()
	claimed, err := model.ClaimExpiredAssetSources(request.Owner, now.Unix(), now.Add(assetCleanupLeaseTTL).Unix(), request.Limit)
	if err != nil {
		return CleanupExpiredAssetSourcesResult{}, err
	}
	result := CleanupExpiredAssetSourcesResult{Claimed: len(claimed)}
	for _, asset := range claimed {
		err := assetObjectStore.Delete(ctx, asset.StorageBucket, asset.ObjectKey, asset.ObjectGeneration)
		if err != nil && !isAssetObjectNotFound(err) {
			continue
		}
		ok, err := model.MarkAssetSourceExpiredIfCleanupLease(asset.Id, request.Owner, asset.CleanupGeneration, now.Unix())
		if err != nil {
			return result, err
		}
		if ok {
			result.Deleted++
		}
	}
	pending, err := model.ClaimExpiredPendingAssetUploads(request.Owner, now.Unix(), now.Add(assetCleanupLeaseTTL).Unix(), request.Limit)
	if err != nil {
		return result, err
	}
	result.Claimed += len(pending)
	for _, candidate := range pending {
		generation := int64(0)
		attrs, err := assetObjectStore.Attrs(ctx, candidate.Upload.StorageBucket, candidate.Upload.ObjectKey)
		if err == nil {
			generation = attrs.Generation
			err = assetObjectStore.Delete(ctx, candidate.Upload.StorageBucket, candidate.Upload.ObjectKey, generation)
		}
		if err != nil && !isAssetObjectNotFound(err) {
			continue
		}
		ok, err := model.MarkExpiredPendingAssetUploadIfCleanupLease(candidate.Upload.UploadId, request.Owner, candidate.Asset.CleanupGeneration, generation, now.Unix())
		if err != nil {
			return result, err
		}
		if ok {
			result.Deleted++
		}
	}
	return result, nil
}

func SignAssetSourceURL(ctx context.Context, asset model.Asset, cfg AssetStorageConfig) (string, error) {
	query := url.Values{}
	if asset.ObjectGeneration > 0 {
		query.Set("generation", strconv.FormatInt(asset.ObjectGeneration, 10))
	}
	return assetObjectStore.SignURL(ctx, asset.StorageBucket, asset.ObjectKey, AssetSignedURLRequest{
		Method:              http.MethodGet,
		TTL:                 cfg.SignedURLTTL,
		ServiceAccountEmail: cfg.ServiceAccountEmail,
		QueryParameters:     query,
	})
}

func fetchAssetSource(ctx context.Context, rawURL string) (*http.Response, error) {
	if err := validateAssetSourceURL(rawURL); err != nil {
		return nil, err
	}
	baseClient := assetHTTPClient
	if baseClient == nil || baseClient == http.DefaultClient {
		cfg := CurrentAssetStorageConfig()
		baseClient = newAssetFetchHTTPClient(assetFetchHTTPClientConfig{Timeout: cfg.FetchTimeout})
	}
	client := *baseClient
	redirects := 0
	client.CheckRedirect = func(req *http.Request, via []*http.Request) error {
		redirects++
		if redirects > assetRedirectLimit {
			return errors.New("asset source redirect limit exceeded")
		}
		return validateAssetSourceURL(req.URL.String())
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, ErrAssetInvalidSourceURL
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		_ = resp.Body.Close()
		return nil, fmt.Errorf("asset source returned status %d", resp.StatusCode)
	}
	return resp, nil
}

func newAssetFetchHTTPClient(cfg assetFetchHTTPClientConfig) *http.Client {
	timeout := cfg.Timeout
	if timeout <= 0 || timeout > maxAssetFetchTimeout {
		timeout = defaultAssetFetchTimeout
	}
	resolver := cfg.Resolver
	if resolver == nil {
		resolver = assetFetchResolverFunc(func(ctx context.Context, host string) ([]net.IP, error) {
			return net.DefaultResolver.LookupIP(ctx, "ip", host)
		})
	}
	dialContext := cfg.DialContext
	if dialContext == nil {
		dialer := &net.Dialer{Timeout: assetFetchDialTimeout}
		dialContext = dialer.DialContext
	}
	transport := &http.Transport{
		Proxy:                 func(*http.Request) (*url.URL, error) { return nil, nil },
		DialContext:           assetFetchDialContext(resolver, dialContext),
		TLSClientConfig:       &tls.Config{MinVersion: tls.VersionTLS12},
		TLSHandshakeTimeout:   assetFetchTLSHandshake,
		ResponseHeaderTimeout: assetFetchHeaderWait,
		ExpectContinueTimeout: time.Second,
		ForceAttemptHTTP2:     true,
	}
	return &http.Client{Transport: transport, Timeout: timeout}
}

func assetFetchDialContext(resolver assetFetchResolver, dialContext func(context.Context, string, string) (net.Conn, error)) func(context.Context, string, string) (net.Conn, error) {
	return func(ctx context.Context, network, address string) (net.Conn, error) {
		host, port, err := net.SplitHostPort(address)
		if err != nil {
			return nil, ErrAssetInvalidSourceURL
		}
		ips, err := resolver.LookupIP(ctx, strings.TrimSuffix(host, "."))
		if err != nil {
			return nil, ErrAssetInvalidSourceURL
		}
		for _, ip := range ips {
			if ip == nil {
				continue
			}
			if err := validateAssetDialIP(ip, port); err != nil {
				return nil, err
			}
			conn, err := dialContext(ctx, network, net.JoinHostPort(ip.String(), port))
			if err == nil {
				return conn, nil
			}
		}
		return nil, ErrAssetInvalidSourceURL
	}
}

func validateAssetDialIP(ip net.IP, port string) error {
	if parsedPort, err := strconv.Atoi(port); err != nil || parsedPort <= 0 || parsedPort > 65535 {
		return ErrAssetInvalidSourceURL
	}
	fetchSetting := system_setting.GetFetchSetting()
	rawURL := "https://" + net.JoinHostPort(ip.String(), port)
	if err := common.ValidateURLWithFetchSetting(
		rawURL,
		true,
		false,
		false,
		fetchSetting.IpFilterMode,
		nil,
		fetchSetting.IpList,
		fetchSetting.AllowedPorts,
		true,
	); err != nil {
		return ErrAssetInvalidSourceURL
	}
	return nil
}

func validateAssetSourceURL(rawURL string) error {
	parsed, err := url.Parse(rawURL)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" || parsed.User != nil || strings.ToLower(parsed.Scheme) != "https" {
		return ErrAssetInvalidSourceURL
	}
	if strings.TrimSuffix(strings.ToLower(parsed.Hostname()), ".") == "localhost" {
		return ErrAssetInvalidSourceURL
	}
	if err := assetValidateURL(rawURL); err != nil {
		return ErrAssetInvalidSourceURL
	}
	return nil
}

func validateAssetURLWithFetchSetting(rawURL string) error {
	fetchSetting := system_setting.GetFetchSetting()
	return common.ValidateURLWithFetchSetting(
		rawURL,
		true,
		false,
		fetchSetting.DomainFilterMode,
		fetchSetting.IpFilterMode,
		fetchSetting.DomainList,
		fetchSetting.IpList,
		fetchSetting.AllowedPorts,
		true,
	)
}

func putAndValidateAssetMedia(ctx context.Context, bucket, objectKey string, reader io.Reader, assetType string, maxBytes int64) (string, string, int64, int64, error) {
	detected, prefixReader, err := detectAssetMediaPrefix(reader, assetType, maxBytes)
	if err != nil {
		return "", "", 0, 0, err
	}
	validator := newAssetStreamingValidator(prefixReader, maxBytes)
	if err := assetObjectStore.Put(ctx, bucket, objectKey, validator, AssetObjectPutOptions{ContentType: detected}); err != nil {
		_ = assetObjectStore.Delete(ctx, bucket, objectKey, 0)
		return "", "", 0, 0, err
	}
	attrs, err := assetObjectStore.Attrs(ctx, bucket, objectKey)
	if err != nil {
		_ = assetObjectStore.Delete(ctx, bucket, objectKey, 0)
		return "", "", 0, 0, err
	}
	return detected, validator.shaHex(), validator.size, attrs.Generation, nil
}

func hashAndValidateAssetMedia(reader io.Reader, assetType string, maxBytes int64) (string, string, int64, error) {
	detected, prefixReader, err := detectAssetMediaPrefix(reader, assetType, maxBytes)
	if err != nil {
		return "", "", 0, err
	}
	validator := newAssetStreamingValidator(prefixReader, maxBytes)
	if _, err := io.Copy(io.Discard, validator); err != nil {
		return "", "", 0, err
	}
	return detected, validator.shaHex(), validator.size, nil
}

func detectAssetMediaPrefix(reader io.Reader, assetType string, maxBytes int64) (string, io.Reader, error) {
	if maxBytes <= 0 {
		return "", nil, ErrAssetTooLarge
	}
	prefixLimit := int64(512)
	if maxBytes < prefixLimit {
		prefixLimit = maxBytes
	}
	var prefix bytes.Buffer
	scratch := make([]byte, prefixLimit)
	for int64(prefix.Len()) < prefixLimit {
		remaining := prefixLimit - int64(prefix.Len())
		if int64(len(scratch)) > remaining {
			scratch = scratch[:int(remaining)]
		}
		n, err := reader.Read(scratch)
		if n > 0 {
			_, _ = prefix.Write(scratch[:n])
		}
		if err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return "", nil, err
		}
	}
	if prefix.Len() == 0 {
		return "", nil, ErrAssetUnsupportedMediaType
	}
	contentType := http.DetectContentType(prefix.Bytes())
	normalized, _ := normalizeAssetContentType(assetType, contentType)
	if normalized == "" {
		if int64(prefix.Len()) >= maxBytes && maxBytes < 512 {
			return "", nil, ErrAssetTooLarge
		}
		if category := supportedAssetContentTypeCategory(contentType); category != "" && category != assetType {
			return "", nil, ErrAssetTypeMismatch
		}
		return "", nil, ErrAssetUnsupportedMediaType
	}
	return normalized, io.MultiReader(bytes.NewReader(prefix.Bytes()), reader), nil
}

type assetStreamingValidator struct {
	reader   io.Reader
	maxBytes int64
	hash     hash.Hash
	size     int64
}

func newAssetStreamingValidator(reader io.Reader, maxBytes int64) *assetStreamingValidator {
	return &assetStreamingValidator{reader: reader, maxBytes: maxBytes, hash: sha256.New()}
}

func (r *assetStreamingValidator) Read(p []byte) (int, error) {
	// Read at most one byte past the budget so the overflow is detected on this
	// call without shrinking the caller's buffer. Clamping every read to a few
	// bytes would turn a 500MiB upload into tens of millions of round trips.
	if remaining := r.maxBytes - r.size; remaining >= 0 && int64(len(p)) > remaining+1 {
		p = p[:remaining+1]
	}
	n, err := r.reader.Read(p)
	if n > 0 {
		r.size += int64(n)
		if r.size > r.maxBytes {
			return n, ErrAssetTooLarge
		}
		_, _ = r.hash.Write(p[:n])
	}
	return n, err
}

func (r *assetStreamingValidator) shaHex() string {
	return hex.EncodeToString(r.hash.Sum(nil))
}

func newAssetObjectKey(cfg AssetStorageConfig, userID int, assetType string, contentType string) (string, string, error) {
	publicID, err := assetPublicID()
	if err != nil {
		return "", "", err
	}
	random, err := assetRandomSuffix()
	if err != nil {
		return "", "", err
	}
	_, ext := normalizeAssetContentType(assetType, contentType)
	return publicID, buildAssetObjectKey(cfg.KeyPrefix, userID, publicID, random, ext), nil
}

func buildAssetObjectKey(prefix string, userID int, publicID string, random string, ext string) string {
	cleanPrefix := strings.Trim(path.Clean("/"+strings.TrimSpace(prefix)), "/")
	if cleanPrefix == "." || cleanPrefix == "" {
		cleanPrefix = defaultAssetKeyPrefix
	}
	return path.Join(cleanPrefix, fmt.Sprintf("%d", userID), assetNow().UTC().Format("20060102"), publicID, random+ext)
}

func normalizeAssetType(assetType string) string {
	switch strings.ToLower(strings.TrimSpace(assetType)) {
	case "image":
		return "Image"
	case "video":
		return "Video"
	case "audio":
		return "Audio"
	default:
		return strings.TrimSpace(assetType)
	}
}

func normalizeAssetContentType(assetType string, contentType string) (string, string) {
	contentType = strings.ToLower(strings.TrimSpace(strings.Split(contentType, ";")[0]))
	if parsed, _, err := mime.ParseMediaType(contentType); err == nil {
		contentType = parsed
	}
	switch assetType {
	case "Image":
		switch contentType {
		case "image/jpeg", "image/jpg":
			return "image/jpeg", ".jpg"
		case "image/png":
			return "image/png", ".png"
		case "image/webp":
			return "image/webp", ".webp"
		}
	case "Video":
		switch contentType {
		case "video/mp4":
			return "video/mp4", ".mp4"
		case "video/webm":
			return "video/webm", ".webm"
		case "video/quicktime":
			return "video/quicktime", ".mov"
		}
	case "Audio":
		switch contentType {
		case "audio/mpeg", "audio/mp3":
			return "audio/mpeg", ".mp3"
		case "audio/wav", "audio/x-wav":
			return "audio/wav", ".wav"
		case "audio/ogg":
			return "audio/ogg", ".ogg"
		case "audio/mp4":
			return "audio/mp4", ".m4a"
		}
	}
	return "", ""
}

func supportedAssetContentTypeCategory(contentType string) string {
	for _, assetType := range []string{"Image", "Video", "Audio"} {
		if normalized, _ := normalizeAssetContentType(assetType, contentType); normalized != "" {
			return assetType
		}
	}
	return ""
}

func randomAssetID(prefix string) (string, error) {
	random, err := common.GenerateRandomCharsKey(assetPublicIDRandomLen)
	if err != nil {
		return "", err
	}
	return prefix + random, nil
}

func resultFromAsset(asset *model.Asset) *AssetResult {
	return &AssetResult{
		PublicID:        asset.PublicId,
		AssetType:       asset.AssetType,
		Status:          asset.Status,
		AvailableModels: []string{},
		ContentType:     asset.ContentType,
		SizeBytes:       asset.SizeBytes,
		SHA256:          asset.SHA256,
		CreatedAt:       asset.CreatedAt,
		SourceExpiresAt: asset.SourceExpiresAt,
	}
}

func publicResultFromAsset(asset *model.Asset) *AssetResult {
	result := resultFromAsset(asset)
	result.SHA256 = ""
	return result
}

func createOnlyAssetUploadHeaders() map[string]string {
	return map[string]string{assetUploadGenerationMatchHeader: "0"}
}

func assetSignedHeaderLines(headers map[string]string) []string {
	if len(headers) == 0 {
		return nil
	}
	lines := make([]string, 0, len(headers))
	for name, value := range headers {
		lines = append(lines, name+":"+value)
	}
	return lines
}
