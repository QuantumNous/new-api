package service

import (
	"bytes"
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"hash"
	"io"
	"mime/multipart"
	"net/http"
	"path"
	"path/filepath"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"
)

const (
	bytePlusImageMaxBytes            = int64(30 << 20)
	bytePlusVideoMaxBytes            = int64(50 << 20)
	bytePlusAudioMaxBytes            = int64(15 << 20)
	bytePlusAssetEnvelopeAllowance   = 1 << 20
	bytePlusAssetRequestHardMaxBytes = bytePlusVideoMaxBytes + bytePlusAssetEnvelopeAllowance
	bytePlusSignedURLTTL             = 12 * time.Hour
	bytePlusAssetMaxFieldBytes       = 8 << 10
	bytePlusAssetSniffBytes          = 512
	bytePlusAssetTempObjectKeyPrefix = "real-person-assets"
)

var bytePlusAssetUploadNow = common.GetTimestamp
var bytePlusAssetUploadRandomKey = common.GenerateRandomCharsKey

type BytePlusUploadedAsset struct {
	TempObject    *model.BytePlusAssetTempObject
	AssetType     string
	Name          string
	MimeType      string
	ContentSHA256 string
	SizeBytes     int64
}

type bytePlusMultipartMetadata struct {
	assetType string
	name      string
	nameSet   bool
	seen      map[string]bool
}

func readBytePlusMultipartAsset(ctx context.Context, request *http.Request, profile *model.BytePlusRealPersonProfile, channel *model.Channel, store BytePlusTempObjectStore) (*BytePlusUploadedAsset, *types.NewAPIError) {
	if request == nil || profile == nil || channel == nil || store == nil {
		return nil, assetError(errors.New("invalid multipart upload"), types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
	}
	if request.Body != nil {
		request.Body = &bytePlusMaxBodyReader{r: request.Body, remaining: bytePlusAssetRequestHardMaxBytes}
	}
	reader, err := request.MultipartReader()
	if err != nil {
		return nil, assetError(err, types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
	}

	meta := bytePlusMultipartMetadata{seen: map[string]bool{}}
	var uploaded *BytePlusUploadedAsset
	for {
		part, err := reader.NextPart()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			if uploaded != nil && uploaded.TempObject != nil {
				_ = deleteOrQueueBytePlusTempObject(ctx, uploaded.TempObject, store)
			}
			return nil, multipartReadError(err)
		}
		if part.FileName() == "" {
			if apiErr := readBytePlusMultipartField(part, &meta); apiErr != nil {
				if uploaded != nil && uploaded.TempObject != nil {
					_ = deleteOrQueueBytePlusTempObject(ctx, uploaded.TempObject, store)
				}
				return nil, apiErr
			}
			continue
		}
		if part.FormName() != "file" {
			if uploaded != nil && uploaded.TempObject != nil {
				_ = deleteOrQueueBytePlusTempObject(ctx, uploaded.TempObject, store)
			}
			return nil, assetError(errors.New("invalid file field"), types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
		}
		if uploaded != nil {
			_ = deleteOrQueueBytePlusTempObject(ctx, uploaded.TempObject, store)
			return nil, assetError(errors.New("only one file is allowed"), types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
		}
		var uploadErr *types.NewAPIError
		uploaded, uploadErr = uploadBytePlusMultipartFile(ctx, part, profile, channel, store)
		if uploadErr != nil {
			if uploaded != nil && uploaded.TempObject != nil {
				_ = deleteOrQueueBytePlusTempObject(ctx, uploaded.TempObject, store)
			}
			return nil, uploadErr
		}
	}
	if uploaded == nil {
		return nil, assetError(errors.New("file is required"), types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
	}
	if meta.assetType == "" {
		_ = deleteOrQueueBytePlusTempObject(ctx, uploaded.TempObject, store)
		return nil, assetError(errors.New("asset_type is required"), types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
	}
	uploaded.AssetType = meta.assetType
	if meta.nameSet {
		uploaded.Name = meta.name
	}
	if apiErr := validateBytePlusUploadedMedia(uploaded.AssetType, uploaded.MimeType, uploaded.SizeBytes); apiErr != nil {
		_ = deleteOrQueueBytePlusTempObject(ctx, uploaded.TempObject, store)
		return nil, apiErr
	}
	return uploaded, nil
}

func readBytePlusMultipartField(part *multipart.Part, meta *bytePlusMultipartMetadata) *types.NewAPIError {
	name := strings.TrimSpace(part.FormName())
	switch name {
	case "asset_type", "name":
	default:
		return assetError(errors.New("unknown multipart field"), types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
	}
	if meta.seen[name] {
		return assetError(errors.New("duplicate multipart field"), types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
	}
	meta.seen[name] = true
	var buffer bytes.Buffer
	written, err := io.CopyN(&buffer, part, bytePlusAssetMaxFieldBytes+1)
	if err != nil && !errors.Is(err, io.EOF) {
		return multipartReadError(err)
	}
	if written > bytePlusAssetMaxFieldBytes {
		return assetError(errors.New("multipart field too large"), types.ErrorCodeAssetFileTooLarge, http.StatusRequestEntityTooLarge)
	}
	value := buffer.String()
	switch name {
	case "asset_type":
		switch strings.TrimSpace(value) {
		case "Image", "Video", "Audio":
			meta.assetType = strings.TrimSpace(value)
		default:
			return assetError(errors.New("invalid asset_type"), types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
		}
	case "name":
		meta.name = value
		meta.nameSet = true
	}
	return nil
}

func uploadBytePlusMultipartFile(ctx context.Context, part *multipart.Part, profile *model.BytePlusRealPersonProfile, channel *model.Channel, store BytePlusTempObjectStore) (*BytePlusUploadedAsset, *types.NewAPIError) {
	header, err := readBytePlusSniffHeader(part)
	if err != nil {
		return nil, multipartReadError(err)
	}
	if len(header) == 0 {
		return nil, assetError(errors.New("file is empty"), types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
	}
	mimeType := sniffBytePlusMediaType(header)
	objectKey, err := buildBytePlusTempObjectKey(profile.UserId)
	if err != nil {
		return nil, assetError(err, types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	}
	bucket, apiErr := bytePlusTempObjectBucket(store)
	if apiErr != nil {
		return nil, apiErr
	}
	now := bytePlusAssetUploadNow()
	tempObject, err := model.CreateBytePlusAssetTempObject(model.BytePlusAssetTempObject{
		UserId:                  profile.UserId,
		ChannelId:               channel.Id,
		Bucket:                  bucket,
		ObjectKey:               objectKey,
		CleanupStatus:           model.BytePlusTempObjectCleanupPending,
		NextCleanupAt:           now,
		CleanupLeaseUpdatedTime: now,
		CreatedTime:             now,
		UpdatedTime:             now,
	})
	if err != nil {
		return nil, assetError(err, types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	}
	remaining := bytePlusVideoMaxBytes + 1 - int64(len(header))
	if remaining < 0 {
		remaining = 0
	}
	limited := &io.LimitedReader{R: part, N: remaining}
	counter := &bytePlusHashCountingReader{r: io.MultiReader(bytes.NewReader(header), limited), h: sha256.New()}
	if err := store.PutObject(ctx, objectKey, counter, mimeType, 0); err != nil {
		return &BytePlusUploadedAsset{TempObject: tempObject}, assetError(err, types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	}
	if counter.n > bytePlusVideoMaxBytes {
		return &BytePlusUploadedAsset{TempObject: tempObject, SizeBytes: counter.n}, assetError(errors.New("file too large"), types.ErrorCodeAssetFileTooLarge, http.StatusRequestEntityTooLarge)
	}
	shaHex := fmt.Sprintf("%x", counter.h.Sum(nil))
	metadataNow := bytePlusAssetUploadNow()
	if err := model.UpdateBytePlusAssetTempObjectMetadata(tempObject.Id, shaHex, counter.n, mimeType, metadataNow); err != nil {
		return &BytePlusUploadedAsset{TempObject: tempObject}, assetError(err, types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	}
	tempObject.ContentSHA256 = shaHex
	tempObject.SizeBytes = counter.n
	tempObject.MimeType = mimeType
	tempObject.CleanupLeaseUpdatedTime = metadataNow
	tempObject.UpdatedTime = metadataNow
	return &BytePlusUploadedAsset{
		TempObject:    tempObject,
		Name:          defaultBytePlusUploadedName(part.FileName()),
		MimeType:      mimeType,
		ContentSHA256: shaHex,
		SizeBytes:     counter.n,
	}, nil
}

type bytePlusTempObjectBucketProvider interface {
	TempObjectBucket() string
}

func bytePlusTempObjectBucket(store BytePlusTempObjectStore) (string, *types.NewAPIError) {
	if provider, ok := store.(bytePlusTempObjectBucketProvider); ok {
		bucket := strings.TrimSpace(provider.TempObjectBucket())
		if bucket == "" {
			return "", assetError(errors.New("temp object bucket is unavailable"), types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
		}
		return bucket, nil
	}
	if tosStore, ok := store.(*bytePlusTOSStore); ok {
		bucket := strings.TrimSpace(tosStore.bucket)
		if bucket == "" {
			return "", assetError(errors.New("temp object bucket is unavailable"), types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
		}
		return bucket, nil
	}
	return "", assetError(errors.New("temp object bucket is unavailable"), types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
}

func readBytePlusSniffHeader(reader io.Reader) ([]byte, error) {
	buf := make([]byte, bytePlusAssetSniffBytes)
	n, err := io.ReadFull(reader, buf)
	if err != nil && !errors.Is(err, io.ErrUnexpectedEOF) && !errors.Is(err, io.EOF) {
		return nil, err
	}
	return buf[:n], nil
}

func validateBytePlusUploadedMedia(assetType, mimeType string, size int64) *types.NewAPIError {
	if size <= 0 {
		return assetError(errors.New("file is empty"), types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
	}
	switch assetType {
	case "Image":
		if !strings.HasPrefix(mimeType, "image/") {
			return assetError(errors.New("unsupported media type"), types.ErrorCodeAssetMediaUnsupported, http.StatusUnsupportedMediaType)
		}
		if size >= bytePlusImageMaxBytes {
			return assetError(errors.New("image too large"), types.ErrorCodeAssetFileTooLarge, http.StatusRequestEntityTooLarge)
		}
	case "Video":
		if !strings.HasPrefix(mimeType, "video/") {
			return assetError(errors.New("unsupported media type"), types.ErrorCodeAssetMediaUnsupported, http.StatusUnsupportedMediaType)
		}
		if size > bytePlusVideoMaxBytes {
			return assetError(errors.New("video too large"), types.ErrorCodeAssetFileTooLarge, http.StatusRequestEntityTooLarge)
		}
	case "Audio":
		if !strings.HasPrefix(mimeType, "audio/") {
			return assetError(errors.New("unsupported media type"), types.ErrorCodeAssetMediaUnsupported, http.StatusUnsupportedMediaType)
		}
		if size > bytePlusAudioMaxBytes {
			return assetError(errors.New("audio too large"), types.ErrorCodeAssetFileTooLarge, http.StatusRequestEntityTooLarge)
		}
	default:
		return assetError(errors.New("invalid asset_type"), types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
	}
	return nil
}

func sniffBytePlusMediaType(header []byte) string {
	if len(header) >= 3 && header[0] == 0xff && header[1] == 0xd8 && header[2] == 0xff {
		return "image/jpeg"
	}
	if bytes.HasPrefix(header, []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}) {
		return "image/png"
	}
	if len(header) >= 12 && bytes.Equal(header[:4], []byte("RIFF")) && bytes.Equal(header[8:12], []byte("WEBP")) {
		return "image/webp"
	}
	if bytes.HasPrefix(header, []byte("BM")) {
		return "image/bmp"
	}
	if bytes.HasPrefix(header, []byte("II*\x00")) || bytes.HasPrefix(header, []byte("MM\x00*")) {
		return "image/tiff"
	}
	if bytes.HasPrefix(header, []byte("GIF87a")) || bytes.HasPrefix(header, []byte("GIF89a")) {
		return "image/gif"
	}
	if len(header) >= 12 && bytes.Equal(header[4:8], []byte("ftyp")) {
		brand := string(header[8:12])
		switch brand {
		case "heic", "heix", "hevc", "hevx":
			return "image/heic"
		case "mif1", "msf1", "heim", "heis", "heif":
			return "image/heif"
		case "qt  ":
			return "video/quicktime"
		case "isom", "iso2", "mp41", "mp42", "avc1", "M4V ", "M4A ":
			return "video/mp4"
		default:
			return ""
		}
	}
	if len(header) >= 12 && bytes.Equal(header[:4], []byte("RIFF")) && bytes.Equal(header[8:12], []byte("WAVE")) {
		return "audio/wav"
	}
	if bytes.HasPrefix(header, []byte("ID3")) || isBytePlusMP3FrameSync(header) {
		return "audio/mpeg"
	}
	return ""
}

func isBytePlusMP3FrameSync(header []byte) bool {
	if len(header) < 2 || header[0] != 0xff || (header[1]&0xe0) != 0xe0 {
		return false
	}
	version := (header[1] >> 3) & 0x03
	layer := (header[1] >> 1) & 0x03
	return version != 0x01 && layer != 0x00
}

func deleteOrQueueBytePlusTempObject(ctx context.Context, object *model.BytePlusAssetTempObject, store BytePlusTempObjectStore) error {
	if object == nil || store == nil {
		return nil
	}
	now := bytePlusAssetUploadNow()
	if err := store.DeleteObject(ctx, object.ObjectKey); err != nil {
		_, retryErr := model.RetryBytePlusAssetTempObjectCleanup(object.Id, object.CleanupLeaseUpdatedTime, now, now)
		if retryErr != nil {
			return retryErr
		}
		return err
	}
	_, err := model.CompleteBytePlusAssetTempObjectCleanup(object.Id, object.CleanupLeaseUpdatedTime, now)
	return err
}

type bytePlusHashCountingReader struct {
	r io.Reader
	h hash.Hash
	n int64
}

func (r *bytePlusHashCountingReader) Read(p []byte) (int, error) {
	n, err := r.r.Read(p)
	if n > 0 {
		_, _ = r.h.Write(p[:n])
		r.n += int64(n)
	}
	return n, err
}

type bytePlusMaxBodyReader struct {
	r         io.Reader
	remaining int64
}

func (r *bytePlusMaxBodyReader) Read(p []byte) (int, error) {
	if len(p) == 0 {
		return 0, nil
	}
	if r.remaining <= 0 {
		var one [1]byte
		n, err := r.r.Read(one[:])
		if n > 0 {
			return 0, errors.New("multipart request too large")
		}
		return 0, err
	}
	if int64(len(p)) > r.remaining {
		p = p[:r.remaining]
	}
	n, err := r.r.Read(p)
	r.remaining -= int64(n)
	return n, err
}

func (r *bytePlusMaxBodyReader) Close() error {
	if closer, ok := r.r.(io.Closer); ok {
		return closer.Close()
	}
	return nil
}

func buildBytePlusTempObjectKey(userID int) (string, error) {
	random, err := bytePlusAssetUploadRandomKey(24)
	if err != nil {
		return "", err
	}
	return path.Join(bytePlusAssetTempObjectKeyPrefix, fmt.Sprintf("%d", userID), time.Unix(bytePlusAssetUploadNow(), 0).UTC().Format("20060102"), random), nil
}

func defaultBytePlusUploadedName(filename string) string {
	name := filepath.Base(filename)
	name = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return -1
		}
		return r
	}, name)
	if utf8.RuneCountInString(name) <= 128 {
		return name
	}
	var builder strings.Builder
	count := 0
	for _, r := range name {
		if count >= 128 {
			break
		}
		builder.WriteRune(r)
		count++
	}
	return builder.String()
}

func multipartReadError(err error) *types.NewAPIError {
	if strings.Contains(strings.ToLower(err.Error()), "too large") {
		return assetError(err, types.ErrorCodeAssetFileTooLarge, http.StatusRequestEntityTooLarge)
	}
	return assetError(err, types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
}
