package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"io"
	"mime"
	"net"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"cloud.google.com/go/compute/metadata"
	"cloud.google.com/go/storage"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	perfmetrics "github.com/QuantumNous/new-api/pkg/perf_metrics"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"google.golang.org/api/googleapi"
	"google.golang.org/api/iamcredentials/v1"
)

const (
	defaultVideoResultSignedURLTTL = 15 * time.Minute
	maxVideoResultSignedURLTTL     = time.Hour
	defaultVideoResultRetention    = 24 * time.Hour
	defaultVideoResultFetchTimeout = 30 * time.Minute
	maxVideoResultFetchTimeout     = 30 * time.Minute
	defaultVideoResultMaxBytes     = int64(500 << 20)
	videoResultCacheControl        = "private, max-age=0, no-store"
	videoResultMP4ContentType      = "video/mp4"
	videoResultMP4ProbeBytes       = 64 << 10
	videoResultMP4BoxHeaderBytes   = 8
	videoResultMP4BrandBytes       = 4
	videoResultMP4FileTypeMinBytes = 2 * videoResultMP4BrandBytes
)

type VideoResultStorageConfig struct {
	Bucket              string
	ServiceAccountEmail string
	SignedURLTTL        time.Duration
	Retention           time.Duration
	FetchTimeout        time.Duration
	MaxBytes            int64
}

type VideoResultObjectStore interface {
	Create(ctx context.Context, bucket, objectKey string, body io.Reader, options VideoResultCreateOptions) (VideoResultObjectAttrs, error)
	Attrs(ctx context.Context, bucket, objectKey string) (VideoResultObjectAttrs, error)
	SignURL(ctx context.Context, bucket, objectKey string, request VideoResultSignedURLRequest) (string, error)
}

type VideoResultCreateOptions struct {
	ContentType        string
	CacheControl       string
	ContentDisposition string
}

type VideoResultObjectAttrs struct {
	ContentType string
	Size        int64
	Generation  int64
	Created     time.Time
}

type VideoResultSignedURLRequest struct {
	Method              string
	TTL                 time.Duration
	ContentType         string
	ServiceAccountEmail string
	Headers             []string
	QueryParameters     url.Values
}

var (
	ErrVideoResultConfig         = errors.New("video result storage is not configured")
	ErrVideoResultInvalidTaskID  = errors.New("invalid video result task id")
	ErrVideoResultInvalidContent = errors.New("invalid video result content")
	ErrVideoResultTooLarge       = errors.New("video result is too large")
	ErrVideoResultAlreadyExists  = errors.New("video result already exists")
	ErrVideoResultUnavailable    = errors.New("video result is unavailable")
	ErrVideoResultExpired        = errors.New("video result has expired")
	ErrVideoResultSigning        = errors.New("video result signing failed")

	videoResultObjectStore            VideoResultObjectStore = gcsVideoResultObjectStore{}
	videoResultNow                                           = time.Now
	videoResultValidateURL                                   = validateVideoResultURLWithFetchSetting
	videoResultServiceAccountEmail                           = defaultVideoResultServiceAccountEmail
	gcsVideoResultSignURL                                    = signGCSVideoResultURLWithIAM
	videoResultDirectFetchResolver    assetFetchResolver
	videoResultDirectFetchDialContext func(context.Context, string, string) (net.Conn, error)
	newGCSVideoResultObjectWriter     = defaultGCSVideoResultObjectWriter
)

var videoResultTaskIDPattern = regexp.MustCompile(`^task_[A-Za-z0-9_-]+$`)

func CurrentVideoResultStorageConfig() VideoResultStorageConfig {
	ttl := time.Duration(getEnvInt("VIDEO_RESULT_SIGNED_URL_TTL_SECONDS", int(defaultVideoResultSignedURLTTL.Seconds()))) * time.Second
	if ttl <= 0 {
		ttl = defaultVideoResultSignedURLTTL
	} else if ttl > maxVideoResultSignedURLTTL {
		ttl = maxVideoResultSignedURLTTL
	}

	retention := time.Duration(getEnvInt("VIDEO_RESULT_RETENTION_SECONDS", int(defaultVideoResultRetention.Seconds()))) * time.Second
	if retention <= 0 {
		retention = defaultVideoResultRetention
	}

	fetchTimeout := time.Duration(getEnvInt("VIDEO_RESULT_FETCH_TIMEOUT_SECONDS", int(defaultVideoResultFetchTimeout.Seconds()))) * time.Second
	if fetchTimeout <= 0 || fetchTimeout > maxVideoResultFetchTimeout {
		fetchTimeout = defaultVideoResultFetchTimeout
	}

	maxBytes := getEnvInt64("VIDEO_RESULT_MAX_BYTES", defaultVideoResultMaxBytes)
	if maxBytes <= 0 || maxBytes > defaultVideoResultMaxBytes {
		maxBytes = defaultVideoResultMaxBytes
	}

	return VideoResultStorageConfig{
		Bucket:              strings.TrimSpace(os.Getenv("VIDEO_RESULT_STORAGE_BUCKET")),
		ServiceAccountEmail: strings.TrimSpace(os.Getenv("VIDEO_RESULT_SERVICE_ACCOUNT_EMAIL")),
		SignedURLTTL:        ttl,
		Retention:           retention,
		FetchTimeout:        fetchTimeout,
		MaxBytes:            maxBytes,
	}
}

func ArchiveVideoResult(ctx context.Context, publicTaskID, upstreamURL, proxy string) (*model.VideoResult, error) {
	archiveStart := videoResultNow().UTC()
	recordArchive := func(outcome string, bytes int64) {
		perfmetrics.RecordVideoResultArchive("techmobi", outcome, bytes, videoResultNow().UTC().Sub(archiveStart))
	}
	cfg := CurrentVideoResultStorageConfig()
	if strings.TrimSpace(cfg.Bucket) == "" {
		recordArchive("failure", 0)
		return nil, ErrVideoResultConfig
	}
	objectKey, err := buildVideoResultObjectKey(publicTaskID, archiveStart)
	if err != nil {
		recordArchive("failure", 0)
		return nil, err
	}
	if err := videoResultValidateURL(upstreamURL); err != nil {
		recordArchive("failure", 0)
		return nil, ErrVideoResultInvalidContent
	}
	client, err := newVideoResultFetchHTTPClient(cfg, proxy, videoResultDirectFetchResolver, videoResultDirectFetchDialContext)
	if err != nil {
		recordArchive("failure", 0)
		return nil, ErrVideoResultInvalidContent
	}
	fetchCtx, cancel := context.WithTimeout(ctx, cfg.FetchTimeout)
	defer cancel()
	request, err := http.NewRequestWithContext(fetchCtx, http.MethodGet, upstreamURL, nil)
	if err != nil {
		recordArchive("failure", 0)
		return nil, ErrVideoResultInvalidContent
	}
	response, err := client.Do(request)
	if err != nil {
		recordArchive("failure", 0)
		return nil, ErrVideoResultInvalidContent
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		recordArchive("failure", 0)
		return nil, ErrVideoResultInvalidContent
	}
	contentType, err := normalizeVideoResultUpstreamContentType(response.Header.Get("Content-Type"))
	if err != nil {
		recordArchive("failure", 0)
		return nil, ErrVideoResultInvalidContent
	}
	contentType = videoResultMP4ContentType
	boundedBody := newVideoResultBoundedReader(response.Body, cfg.MaxBytes)
	validatedBody, err := validateAndReplayVideoResultMP4(boundedBody)
	if err != nil {
		recordArchive("failure", 0)
		return nil, err
	}
	attrs, err := videoResultObjectStore.Create(fetchCtx, cfg.Bucket, objectKey, validatedBody, VideoResultCreateOptions{
		ContentType:        contentType,
		CacheControl:       videoResultCacheControl,
		ContentDisposition: videoResultAttachmentDisposition(publicTaskID),
	})
	if err != nil {
		if errors.Is(err, ErrVideoResultAlreadyExists) {
			attrs, err = videoResultObjectStore.Attrs(ctx, cfg.Bucket, objectKey)
			if err != nil || !validReusableVideoResultAttrs(attrs) {
				recordArchive("failure", 0)
				return nil, ErrVideoResultUnavailable
			}
			recordArchive("reuse", 0)
			return videoResultModelFromAttrs(cfg, objectKey, attrs, archiveStart), nil
		}
		recordArchive("failure", 0)
		return nil, err
	}
	if !validReusableVideoResultAttrs(attrs) {
		recordArchive("failure", 0)
		return nil, ErrVideoResultUnavailable
	}
	recordArchive("success", attrs.Size)
	return videoResultModelFromAttrs(cfg, objectKey, attrs, archiveStart), nil
}

func SignVideoResultDownload(ctx context.Context, taskID string, result *model.VideoResult) (string, error) {
	if !completeVideoResultMetadata(result) {
		return "", ErrVideoResultUnavailable
	}
	if !videoResultTaskIDPattern.MatchString(taskID) {
		return "", ErrVideoResultInvalidTaskID
	}
	cfg := CurrentVideoResultStorageConfig()
	if cfg.Bucket == "" || result.Bucket != cfg.Bucket || !videoResultObjectBelongsToTask(result.Object, taskID) {
		return "", ErrVideoResultUnavailable
	}

	now := videoResultNow().UTC()
	expiresAt := time.Unix(result.ExpiresAt, 0).UTC()
	remaining := expiresAt.Sub(now)
	if remaining <= 0 {
		return "", ErrVideoResultExpired
	}

	attrs, err := videoResultObjectStore.Attrs(ctx, result.Bucket, result.Object)
	if err != nil {
		return "", ErrVideoResultUnavailable
	}
	attrsContentType, _, err := mime.ParseMediaType(attrs.ContentType)
	if err != nil {
		return "", ErrVideoResultUnavailable
	}
	attrsContentType = strings.ToLower(attrsContentType)
	resultContentType, _, err := mime.ParseMediaType(result.ContentType)
	if err != nil {
		return "", ErrVideoResultUnavailable
	}
	resultContentType = strings.ToLower(resultContentType)
	if attrsContentType != videoResultMP4ContentType || attrsContentType != resultContentType {
		return "", ErrVideoResultUnavailable
	}
	if attrs.Generation != result.Generation || attrs.Size <= 0 || attrs.Size != result.Size {
		return "", ErrVideoResultUnavailable
	}

	ttl := cfg.SignedURLTTL
	if ttl > maxVideoResultSignedURLTTL {
		ttl = maxVideoResultSignedURLTTL
	}
	if ttl > remaining {
		ttl = remaining
	}
	if ttl <= 0 {
		return "", ErrVideoResultExpired
	}

	query := url.Values{}
	query.Set("generation", strconv.FormatInt(result.Generation, 10))
	query.Set("response-content-disposition", videoResultAttachmentDisposition(taskID))
	query.Set("response-content-type", attrsContentType)
	signedURL, err := videoResultObjectStore.SignURL(ctx, result.Bucket, result.Object, VideoResultSignedURLRequest{
		Method:              http.MethodGet,
		TTL:                 ttl,
		ServiceAccountEmail: cfg.ServiceAccountEmail,
		QueryParameters:     query,
	})
	if err != nil {
		return "", ErrVideoResultSigning
	}
	return signedURL, nil
}

func completeVideoResultMetadata(result *model.VideoResult) bool {
	return result != nil &&
		strings.TrimSpace(result.Bucket) != "" &&
		strings.TrimSpace(result.Object) != "" &&
		result.Generation > 0 &&
		strings.TrimSpace(result.ContentType) != "" &&
		result.Size > 0 &&
		result.ExpiresAt > 0
}

func newVideoResultFetchHTTPClient(cfg VideoResultStorageConfig, proxy string, resolver assetFetchResolver, dialContext func(context.Context, string, string) (net.Conn, error)) (*http.Client, error) {
	var client *http.Client
	if strings.TrimSpace(proxy) == "" {
		client = newAssetFetchHTTPClient(assetFetchHTTPClientConfig{
			Timeout:     cfg.FetchTimeout,
			Resolver:    resolver,
			DialContext: dialContext,
		})
	} else {
		baseClient, err := GetHttpClientWithProxy(proxy)
		if err != nil {
			return nil, err
		}
		cloned := *baseClient
		cloned.Timeout = cfg.FetchTimeout
		client = &cloned
	}
	client.CheckRedirect = videoResultCheckRedirect
	return client, nil
}

func videoResultCheckRedirect(req *http.Request, via []*http.Request) error {
	if len(via) >= 10 {
		return ErrVideoResultInvalidContent
	}
	if err := videoResultValidateURL(req.URL.String()); err != nil {
		return ErrVideoResultInvalidContent
	}
	return nil
}

func buildVideoResultObjectKey(taskID string, archiveStart time.Time) (string, error) {
	if !videoResultTaskIDPattern.MatchString(taskID) {
		return "", ErrVideoResultInvalidTaskID
	}
	return "video-results/" + archiveStart.UTC().Format("20060102") + "/" + taskID + ".mp4", nil
}

func videoResultObjectBelongsToTask(objectKey, taskID string) bool {
	const prefix = "video-results/"
	if !strings.HasPrefix(objectKey, prefix) {
		return false
	}
	remainder := strings.TrimPrefix(objectKey, prefix)
	if len(remainder) <= 9 || remainder[8] != '/' {
		return false
	}
	for _, digit := range remainder[:8] {
		if digit < '0' || digit > '9' {
			return false
		}
	}
	return remainder[9:] == taskID+".mp4"
}

func videoResultAttachmentDisposition(taskID string) string {
	return `attachment; filename="` + taskID + `.mp4"`
}

func validReusableVideoResultAttrs(attrs VideoResultObjectAttrs) bool {
	contentType, _, err := mime.ParseMediaType(attrs.ContentType)
	return err == nil && strings.ToLower(contentType) == videoResultMP4ContentType && attrs.Size > 0 && attrs.Generation > 0
}

func videoResultModelFromAttrs(cfg VideoResultStorageConfig, objectKey string, attrs VideoResultObjectAttrs, fallbackCreated time.Time) *model.VideoResult {
	storedAt := attrs.Created
	if storedAt.IsZero() {
		storedAt = fallbackCreated
	}
	storedAt = storedAt.UTC()
	return &model.VideoResult{
		Bucket:      cfg.Bucket,
		Object:      objectKey,
		Generation:  attrs.Generation,
		ContentType: attrs.ContentType,
		Size:        attrs.Size,
		StoredAt:    storedAt.Unix(),
		ExpiresAt:   storedAt.Add(cfg.Retention).Unix(),
	}
}

type videoResultBoundedReader struct {
	reader   io.Reader
	limit    int64
	consumed int64
	tooLarge bool
}

func newVideoResultBoundedReader(reader io.Reader, maxBytes int64) io.Reader {
	return &videoResultBoundedReader{reader: reader, limit: maxBytes}
}

func validateAndReplayVideoResultMP4(body io.Reader) (io.Reader, error) {
	var prefix bytes.Buffer
	for prefix.Len() < videoResultMP4ProbeBytes {
		var header [videoResultMP4BoxHeaderBytes]byte
		if err := readVideoResultMP4Probe(body, &prefix, header[:]); err != nil {
			return nil, err
		}

		boxType := string(header[4:8])
		headerSize := uint64(videoResultMP4BoxHeaderBytes)
		boxSize := uint64(binary.BigEndian.Uint32(header[:4]))
		if boxSize == 1 {
			var extendedSize [8]byte
			if err := readVideoResultMP4Probe(body, &prefix, extendedSize[:]); err != nil {
				return nil, err
			}
			headerSize += uint64(len(extendedSize))
			boxSize = binary.BigEndian.Uint64(extendedSize[:])
		}

		if boxSize != 0 && boxSize < headerSize {
			return nil, ErrVideoResultInvalidContent
		}
		remainingProbeBytes := uint64(videoResultMP4ProbeBytes - prefix.Len())
		if boxType == "ftyp" {
			if boxSize < headerSize+videoResultMP4FileTypeMinBytes {
				return nil, ErrVideoResultInvalidContent
			}
			fileTypeSize := boxSize - headerSize
			if fileTypeSize%videoResultMP4BrandBytes != 0 || fileTypeSize > remainingProbeBytes {
				return nil, ErrVideoResultInvalidContent
			}
			fileType := make([]byte, int(fileTypeSize))
			if err := readVideoResultMP4Probe(body, &prefix, fileType); err != nil {
				return nil, err
			}
			if !validVideoResultMP4Brands(fileType) {
				return nil, ErrVideoResultInvalidContent
			}
			return io.MultiReader(bytes.NewReader(prefix.Bytes()), body), nil
		}
		if boxSize == 0 || (boxType != "free" && boxType != "skip") {
			return nil, ErrVideoResultInvalidContent
		}

		payloadSize := boxSize - headerSize
		if payloadSize > remainingProbeBytes {
			return nil, ErrVideoResultInvalidContent
		}
		if _, err := io.CopyN(&prefix, body, int64(payloadSize)); err != nil {
			if errors.Is(err, ErrVideoResultTooLarge) {
				return nil, ErrVideoResultTooLarge
			}
			return nil, ErrVideoResultInvalidContent
		}
	}
	return nil, ErrVideoResultInvalidContent
}

func validVideoResultMP4Brands(fileType []byte) bool {
	if len(fileType) < videoResultMP4FileTypeMinBytes || len(fileType)%videoResultMP4BrandBytes != 0 {
		return false
	}
	hasMP4Brand := false
	for offset := 0; offset < len(fileType); offset += videoResultMP4BrandBytes {
		if offset == videoResultMP4BrandBytes {
			continue
		}
		brand := string(fileType[offset : offset+videoResultMP4BrandBytes])
		if brand == "qt  " {
			return false
		}
		switch brand {
		case "isom", "iso2", "iso5", "iso6", "mp41", "mp42", "avc1", "hvc1", "hev1", "M4V ",
			"dash", "msdh", "msix", "cmfc", "cmfs":
			hasMP4Brand = true
		}
	}
	return hasMP4Brand
}

func normalizeVideoResultUpstreamContentType(rawContentType string) (string, error) {
	rawContentType = strings.TrimSpace(rawContentType)
	if rawContentType == "" {
		return "", nil
	}
	contentType, _, err := mime.ParseMediaType(rawContentType)
	if err != nil {
		return "", err
	}
	contentType = strings.ToLower(contentType)
	if contentType == videoResultMP4ContentType || contentType == "application/octet-stream" || strings.HasPrefix(contentType, "video/") {
		return contentType, nil
	}
	return "", ErrVideoResultInvalidContent
}

func readVideoResultMP4Probe(body io.Reader, prefix *bytes.Buffer, destination []byte) error {
	if len(destination) > videoResultMP4ProbeBytes-prefix.Len() {
		return ErrVideoResultInvalidContent
	}
	readBytes, err := io.ReadFull(body, destination)
	if readBytes > 0 {
		_, _ = prefix.Write(destination[:readBytes])
	}
	if err == nil {
		return nil
	}
	if errors.Is(err, ErrVideoResultTooLarge) {
		return ErrVideoResultTooLarge
	}
	return ErrVideoResultInvalidContent
}

func (r *videoResultBoundedReader) Read(p []byte) (int, error) {
	if r.tooLarge {
		return 0, ErrVideoResultTooLarge
	}
	if r.limit <= 0 {
		r.tooLarge = true
		return 0, ErrVideoResultTooLarge
	}
	remaining := r.limit - r.consumed
	if remaining <= 0 {
		var one [1]byte
		n, err := r.reader.Read(one[:])
		if n > 0 {
			r.tooLarge = true
			return 0, ErrVideoResultTooLarge
		}
		return 0, err
	}
	readSize := int64(len(p))
	if readSize > remaining+1 {
		readSize = remaining + 1
	}
	n, err := r.reader.Read(p[:readSize])
	if int64(n) > remaining {
		r.consumed += remaining
		r.tooLarge = true
		return int(remaining), ErrVideoResultTooLarge
	}
	r.consumed += int64(n)
	return n, err
}

func validateVideoResultURLWithFetchSetting(rawURL string) error {
	fetchSetting := system_setting.GetFetchSetting()
	return common.ValidateURLWithFetchSetting(
		rawURL,
		fetchSetting.EnableSSRFProtection,
		fetchSetting.AllowPrivateIp,
		fetchSetting.DomainFilterMode,
		fetchSetting.IpFilterMode,
		fetchSetting.DomainList,
		fetchSetting.IpList,
		fetchSetting.AllowedPorts,
		fetchSetting.ApplyIPFilterForDomain,
	)
}

type gcsVideoResultObjectStore struct{}

func (gcsVideoResultObjectStore) Create(ctx context.Context, bucket, objectKey string, body io.Reader, options VideoResultCreateOptions) (VideoResultObjectAttrs, error) {
	writer := newGCSVideoResultObjectWriter(ctx, bucket, objectKey)
	defer writer.CloseClient()
	writer.SetContentType(options.ContentType)
	writer.SetCacheControl(options.CacheControl)
	writer.SetContentDisposition(options.ContentDisposition)
	if _, err := io.Copy(writer, body); err != nil {
		_ = writer.CloseWithError(err)
		if isVideoResultPreconditionFailed(err) {
			return VideoResultObjectAttrs{}, ErrVideoResultAlreadyExists
		}
		return VideoResultObjectAttrs{}, err
	}
	if err := writer.Close(); err != nil {
		if isVideoResultPreconditionFailed(err) {
			return VideoResultObjectAttrs{}, ErrVideoResultAlreadyExists
		}
		return VideoResultObjectAttrs{}, err
	}
	attrs := writer.Attrs()
	if attrs == (VideoResultObjectAttrs{}) {
		return gcsVideoResultObjectStore{}.Attrs(ctx, bucket, objectKey)
	}
	return attrs, nil
}

func (gcsVideoResultObjectStore) Attrs(ctx context.Context, bucket, objectKey string) (VideoResultObjectAttrs, error) {
	client, err := storage.NewClient(ctx)
	if err != nil {
		return VideoResultObjectAttrs{}, err
	}
	defer client.Close()
	attrs, err := client.Bucket(bucket).Object(objectKey).Attrs(ctx)
	if err != nil {
		if errors.Is(err, storage.ErrObjectNotExist) {
			return VideoResultObjectAttrs{}, ErrVideoResultUnavailable
		}
		return VideoResultObjectAttrs{}, err
	}
	return VideoResultObjectAttrs{ContentType: attrs.ContentType, Size: attrs.Size, Generation: attrs.Generation, Created: attrs.Created}, nil
}

func (gcsVideoResultObjectStore) SignURL(ctx context.Context, bucket, objectKey string, request VideoResultSignedURLRequest) (string, error) {
	return gcsVideoResultSignURL(ctx, bucket, objectKey, request)
}

func signGCSVideoResultURLWithIAM(ctx context.Context, bucket, objectKey string, request VideoResultSignedURLRequest) (string, error) {
	serviceAccountEmail, err := resolveVideoResultSignerServiceAccount(ctx, request.ServiceAccountEmail)
	if err != nil {
		return "", err
	}
	signer, err := iamcredentials.NewService(ctx)
	if err != nil {
		return "", err
	}
	options := &storage.SignedURLOptions{
		GoogleAccessID:  serviceAccountEmail,
		Method:          request.Method,
		Expires:         videoResultNow().Add(request.TTL),
		Scheme:          storage.SigningSchemeV4,
		Headers:         append([]string(nil), request.Headers...),
		QueryParameters: cloneURLValues(request.QueryParameters),
		SignBytes: func(payload []byte) ([]byte, error) {
			response, err := signer.Projects.ServiceAccounts.SignBlob(
				"projects/-/serviceAccounts/"+serviceAccountEmail,
				&iamcredentials.SignBlobRequest{Payload: base64.StdEncoding.EncodeToString(payload)},
			).Context(ctx).Do()
			if err != nil {
				return nil, err
			}
			return base64.StdEncoding.DecodeString(response.SignedBlob)
		},
	}
	if request.ContentType != "" {
		options.ContentType = request.ContentType
	}
	return storage.SignedURL(bucket, objectKey, options)
}

func resolveVideoResultSignerServiceAccount(ctx context.Context, requestedEmail string) (string, error) {
	serviceAccountEmail := strings.TrimSpace(requestedEmail)
	if serviceAccountEmail != "" {
		return serviceAccountEmail, nil
	}
	serviceAccountEmail, err := videoResultServiceAccountEmail(ctx)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(serviceAccountEmail), nil
}

func defaultVideoResultServiceAccountEmail(ctx context.Context) (string, error) {
	return metadata.EmailWithContext(ctx, "default")
}

func isVideoResultPreconditionFailed(err error) bool {
	var apiErr *googleapi.Error
	return errors.As(err, &apiErr) && apiErr.Code == http.StatusPreconditionFailed
}

type videoResultObjectWriter interface {
	io.Writer
	Close() error
	CloseWithError(error) error
	CloseClient() error
	SetContentType(string)
	SetCacheControl(string)
	SetContentDisposition(string)
	Attrs() VideoResultObjectAttrs
}

func defaultGCSVideoResultObjectWriter(ctx context.Context, bucket, objectKey string) videoResultObjectWriter {
	client, err := storage.NewClient(ctx)
	if err != nil {
		return errorVideoResultObjectWriter{err: err}
	}
	writer := client.Bucket(bucket).Object(objectKey).If(storage.Conditions{DoesNotExist: true}).NewWriter(ctx)
	return &gcsVideoResultObjectWriterAdapter{client: client, writer: writer}
}

type gcsVideoResultObjectWriterAdapter struct {
	client *storage.Client
	writer *storage.Writer
}

func (w *gcsVideoResultObjectWriterAdapter) Write(p []byte) (int, error) {
	return w.writer.Write(p)
}

func (w *gcsVideoResultObjectWriterAdapter) Close() error {
	return w.writer.Close()
}

func (w *gcsVideoResultObjectWriterAdapter) CloseWithError(err error) error {
	return w.writer.CloseWithError(err)
}

func (w *gcsVideoResultObjectWriterAdapter) CloseClient() error {
	return w.client.Close()
}

func (w *gcsVideoResultObjectWriterAdapter) SetContentType(contentType string) {
	w.writer.ContentType = contentType
}

func (w *gcsVideoResultObjectWriterAdapter) SetCacheControl(cacheControl string) {
	w.writer.CacheControl = cacheControl
}

func (w *gcsVideoResultObjectWriterAdapter) SetContentDisposition(contentDisposition string) {
	w.writer.ContentDisposition = contentDisposition
}

func (w *gcsVideoResultObjectWriterAdapter) Attrs() VideoResultObjectAttrs {
	attrs := w.writer.Attrs()
	if attrs == nil {
		return VideoResultObjectAttrs{}
	}
	return VideoResultObjectAttrs{ContentType: attrs.ContentType, Size: attrs.Size, Generation: attrs.Generation, Created: attrs.Created}
}

type errorVideoResultObjectWriter struct {
	err error
}

func (w errorVideoResultObjectWriter) Write([]byte) (int, error) {
	return 0, w.err
}

func (w errorVideoResultObjectWriter) Close() error {
	return w.err
}

func (w errorVideoResultObjectWriter) CloseWithError(error) error {
	return nil
}

func (w errorVideoResultObjectWriter) CloseClient() error {
	return nil
}

func (w errorVideoResultObjectWriter) SetContentType(string) {}

func (w errorVideoResultObjectWriter) SetCacheControl(string) {}

func (w errorVideoResultObjectWriter) SetContentDisposition(string) {}

func (w errorVideoResultObjectWriter) Attrs() VideoResultObjectAttrs {
	return VideoResultObjectAttrs{}
}
