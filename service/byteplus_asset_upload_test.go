package service

import (
	"bytes"
	"context"
	"crypto/sha256"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

type fakeBytePlusTempObjectStore struct {
	puts        []fakeTempPut
	deletes     []string
	presignTTLs []time.Duration
	putErr      error
	afterPut    func(key string)
	deleteErr   error
}

type fakeTempPut struct {
	key         string
	contentType string
	size        int64
	body        []byte
}

func (f *fakeBytePlusTempObjectStore) PutObject(_ context.Context, key string, body io.Reader, contentType string, size int64) error {
	payload, err := io.ReadAll(body)
	if err != nil {
		return err
	}
	f.puts = append(f.puts, fakeTempPut{key: key, contentType: contentType, size: size, body: payload})
	if f.afterPut != nil {
		f.afterPut(key)
	}
	if f.putErr != nil {
		return f.putErr
	}
	return nil
}

func (f *fakeBytePlusTempObjectStore) PresignGet(_ context.Context, key string, ttl time.Duration) (string, error) {
	f.presignTTLs = append(f.presignTTLs, ttl)
	return "https://signed.example/" + key, nil
}

func (f *fakeBytePlusTempObjectStore) DeleteObject(_ context.Context, key string) error {
	f.deletes = append(f.deletes, key)
	return f.deleteErr
}

func (f *fakeBytePlusTempObjectStore) TempObjectBucket() string {
	return "real-person-bucket"
}

func TestBytePlusMultipartAllowsMetadataAfterFileAndStreamsUnknownLength(t *testing.T) {
	newBytePlusMultipartTestDB(t)
	store := &fakeBytePlusTempObjectStore{}
	payload := append([]byte{}, pngHeader()...)
	payload = append(payload, bytes.Repeat([]byte{0x7f}, 2048)...)
	req := newBytePlusMultipartRequest(t, []multipartTestPart{
		filePart("file", "C:\\secret\\portrait.png", payload),
		fieldPart("asset_type", "Image"),
	})

	asset, apiErr := readBytePlusMultipartAsset(context.Background(), req, testRealPersonProfile(), testBytePlusChannel(), store)
	require.Nil(t, apiErr)
	require.NotNil(t, asset)
	require.Equal(t, "Image", asset.AssetType)
	require.Equal(t, "portrait.png", asset.Name)
	require.Equal(t, "image/png", asset.MimeType)
	require.Equal(t, int64(len(payload)), asset.SizeBytes)
	require.Equal(t, fmt.Sprintf("%x", sha256.Sum256(payload)), asset.ContentSHA256)
	require.NotNil(t, asset.TempObject)
	require.NotContains(t, asset.TempObject.ObjectKey, "portrait")
	require.NotContains(t, asset.TempObject.ObjectKey, "secret")
	require.Len(t, store.puts, 1)
	require.Equal(t, int64(0), store.puts[0].size)
	require.Equal(t, payload, store.puts[0].body)
	require.Equal(t, "image/png", store.puts[0].contentType)
	require.Empty(t, store.presignTTLs)

	var stored model.BytePlusAssetTempObject
	require.NoError(t, model.DB.First(&stored, asset.TempObject.Id).Error)
	require.Nil(t, stored.AssetId)
	require.Equal(t, model.BytePlusTempObjectCleanupPending, stored.CleanupStatus)
	require.Equal(t, int64(2000), stored.CleanupLeaseUpdatedTime)
}

func TestBytePlusMultipartSecondNonFileFieldFileCleansFirstUpload(t *testing.T) {
	newBytePlusMultipartTestDB(t)
	store := &fakeBytePlusTempObjectStore{}
	req := newBytePlusMultipartRequest(t, []multipartTestPart{
		fieldPart("asset_type", "Image"),
		filePart("file", "first.png", pngHeader()),
		filePart("avatar", "second.png", pngHeader()),
	})

	_, apiErr := readBytePlusMultipartAsset(context.Background(), req, testRealPersonProfile(), testBytePlusChannel(), store)
	assertAssetError(t, apiErr, types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
	require.Len(t, store.puts, 1)
	require.Len(t, store.deletes, 1)
}

func TestBytePlusMultipartCleanupUsesSingleMetadataLeaseTimestamp(t *testing.T) {
	newBytePlusMultipartTestDB(t)
	tick := int64(1999)
	bytePlusAssetUploadNow = func() int64 {
		tick++
		return tick
	}
	store := &fakeBytePlusTempObjectStore{}
	req := newBytePlusMultipartRequest(t, []multipartTestPart{
		fieldPart("asset_type", "Video"),
		filePart("file", "image.png", pngHeader()),
	})

	_, apiErr := readBytePlusMultipartAsset(context.Background(), req, testRealPersonProfile(), testBytePlusChannel(), store)
	assertAssetError(t, apiErr, types.ErrorCodeAssetMediaUnsupported, http.StatusUnsupportedMediaType)
	require.Len(t, store.puts, 1)
	var stored model.BytePlusAssetTempObject
	require.NoError(t, model.DB.First(&stored, "object_key = ?", store.puts[0].key).Error)
	require.Equal(t, model.BytePlusTempObjectCleanupCleaned, stored.CleanupStatus)
}

func TestBytePlusMultipartOversizeFileWinsOverMissingPostFileMetadata(t *testing.T) {
	newBytePlusMultipartTestDB(t)
	store := &fakeBytePlusTempObjectStore{}
	req := newBytePlusMultipartRequest(t, []multipartTestPart{
		filePart("file", "large.mp4", makeMediaPayload(mp4Header(), bytePlusVideoMaxBytes+1)),
	})

	_, apiErr := readBytePlusMultipartAsset(context.Background(), req, testRealPersonProfile(), testBytePlusChannel(), store)
	assertAssetError(t, apiErr, types.ErrorCodeAssetFileTooLarge, http.StatusRequestEntityTooLarge)
	require.Len(t, store.puts, 1)
	require.Len(t, store.deletes, 1)
}

func TestBytePlusMultipartOversizeFileWinsOverInvalidTrailingMetadata(t *testing.T) {
	newBytePlusMultipartTestDB(t)
	store := &fakeBytePlusTempObjectStore{}
	req := newBytePlusMultipartRequest(t, []multipartTestPart{
		filePart("file", "large.mp4", makeMediaPayload(mp4Header(), bytePlusVideoMaxBytes+1)),
		fieldPart("unknown", "x"),
	})

	_, apiErr := readBytePlusMultipartAsset(context.Background(), req, testRealPersonProfile(), testBytePlusChannel(), store)
	assertAssetError(t, apiErr, types.ErrorCodeAssetFileTooLarge, http.StatusRequestEntityTooLarge)
	require.Len(t, store.puts, 1)
	require.Len(t, store.deletes, 1)
}

func TestBytePlusMultipartPreservesExplicitEmptyName(t *testing.T) {
	newBytePlusMultipartTestDB(t)
	asset, apiErr := readBytePlusMultipartAsset(context.Background(), newBytePlusMultipartRequest(t, []multipartTestPart{
		fieldPart("asset_type", "Image"),
		fieldPart("name", ""),
		filePart("file", "filename.png", pngHeader()),
	}), testRealPersonProfile(), testBytePlusChannel(), &fakeBytePlusTempObjectStore{})
	require.Nil(t, apiErr)
	require.Equal(t, "", asset.Name)
}

func TestBytePlusMultipartRejectsTypeMismatchAndQueuesCleanup(t *testing.T) {
	newBytePlusMultipartTestDB(t)
	store := &fakeBytePlusTempObjectStore{}
	req := newBytePlusMultipartRequest(t, []multipartTestPart{
		fieldPart("asset_type", "Video"),
		filePart("file", "image.png", pngHeader()),
	})

	_, apiErr := readBytePlusMultipartAsset(context.Background(), req, testRealPersonProfile(), testBytePlusChannel(), store)
	assertAssetError(t, apiErr, types.ErrorCodeAssetMediaUnsupported, http.StatusUnsupportedMediaType)
	require.Len(t, store.puts, 1)
	require.Len(t, store.deletes, 1)

	var stored model.BytePlusAssetTempObject
	require.NoError(t, model.DB.First(&stored, "object_key = ?", store.puts[0].key).Error)
	require.Equal(t, model.BytePlusTempObjectCleanupCleaned, stored.CleanupStatus)
}

func TestBytePlusMultipartMapsUploadStorageFailuresToStorageError(t *testing.T) {
	tests := []struct {
		name    string
		store   *fakeBytePlusTempObjectStore
		broken  bool
		hookKey func() func()
	}{
		{
			name:  "tos put failure",
			store: &fakeBytePlusTempObjectStore{putErr: fmt.Errorf("tos put failed")},
		},
		{
			name: "metadata cas failure",
			store: &fakeBytePlusTempObjectStore{afterPut: func(key string) {
				require.NoError(t, model.DB.Model(&model.BytePlusAssetTempObject{}).
					Where("object_key = ?", key).
					Update("cleanup_status", model.BytePlusTempObjectCleanupCleaned).Error)
			}},
		},
		{
			name:   "db create failure",
			store:  &fakeBytePlusTempObjectStore{},
			broken: true,
		},
		{
			name:  "random key failure",
			store: &fakeBytePlusTempObjectStore{},
			hookKey: func() func() {
				old := bytePlusAssetUploadRandomKey
				bytePlusAssetUploadRandomKey = func(int) (string, error) { return "", fmt.Errorf("random failed") }
				return func() { bytePlusAssetUploadRandomKey = old }
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			newBytePlusMultipartTestDB(t)
			if tt.broken {
				require.NoError(t, model.DB.Migrator().DropTable(&model.BytePlusAssetTempObject{}))
			}
			if tt.hookKey != nil {
				cleanup := tt.hookKey()
				t.Cleanup(cleanup)
			}
			req := newBytePlusMultipartRequest(t, []multipartTestPart{
				fieldPart("asset_type", "Image"),
				filePart("file", "image.png", pngHeader()),
			})

			_, apiErr := readBytePlusMultipartAsset(context.Background(), req, testRealPersonProfile(), testBytePlusChannel(), tt.store)
			assertAssetError(t, apiErr, types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
		})
	}
}

func TestBytePlusMultipartSecondFileDoesNotUploadSecondAndCleanupFailureLeavesPending(t *testing.T) {
	newBytePlusMultipartTestDB(t)
	store := &fakeBytePlusTempObjectStore{deleteErr: fmt.Errorf("tos delete failed")}
	req := newBytePlusMultipartRequest(t, []multipartTestPart{
		fieldPart("asset_type", "Image"),
		filePart("file", "first.png", pngHeader()),
		filePart("file", "second.png", pngHeader()),
	})

	_, apiErr := readBytePlusMultipartAsset(context.Background(), req, testRealPersonProfile(), testBytePlusChannel(), store)
	assertAssetError(t, apiErr, types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
	require.Len(t, store.puts, 1)
	require.Len(t, store.deletes, 1)

	var stored model.BytePlusAssetTempObject
	require.NoError(t, model.DB.First(&stored, "object_key = ?", store.puts[0].key).Error)
	require.Nil(t, stored.AssetId)
	require.Equal(t, model.BytePlusTempObjectCleanupPending, stored.CleanupStatus)
	require.LessOrEqual(t, stored.NextCleanupAt, bytePlusAssetUploadNow())
	require.Equal(t, int64(0), stored.CleanupLeaseUpdatedTime)
}

func TestBytePlusMultipartSizeBoundaries(t *testing.T) {
	tests := []struct {
		name      string
		assetType string
		header    []byte
		size      int64
		wantCode  types.ErrorCode
		wantHTTP  int
	}{
		{name: "image just under 30MiB accepted", assetType: "Image", header: pngHeader(), size: 30<<20 - 1},
		{name: "image exactly 30MiB rejected", assetType: "Image", header: pngHeader(), size: 30 << 20, wantCode: types.ErrorCodeAssetFileTooLarge, wantHTTP: http.StatusRequestEntityTooLarge},
		{name: "video exactly 50MiB accepted", assetType: "Video", header: mp4Header(), size: 50 << 20},
		{name: "video one over rejected", assetType: "Video", header: mp4Header(), size: 50<<20 + 1, wantCode: types.ErrorCodeAssetFileTooLarge, wantHTTP: http.StatusRequestEntityTooLarge},
		{name: "audio exactly 15MiB accepted", assetType: "Audio", header: wavHeader(), size: 15 << 20},
		{name: "audio one over rejected", assetType: "Audio", header: wavHeader(), size: 15<<20 + 1, wantCode: types.ErrorCodeAssetFileTooLarge, wantHTTP: http.StatusRequestEntityTooLarge},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			newBytePlusMultipartTestDB(t)
			store := &fakeBytePlusTempObjectStore{}
			payload := makeMediaPayload(tt.header, tt.size)
			req := newBytePlusMultipartRequest(t, []multipartTestPart{
				fieldPart("asset_type", tt.assetType),
				filePart("file", "media.bin", payload),
			})
			asset, apiErr := readBytePlusMultipartAsset(context.Background(), req, testRealPersonProfile(), testBytePlusChannel(), store)
			if tt.wantCode == "" {
				require.Nil(t, apiErr)
				require.NotNil(t, asset)
				require.Equal(t, tt.size, asset.SizeBytes)
				return
			}
			assertAssetError(t, apiErr, tt.wantCode, tt.wantHTTP)
			require.Len(t, store.puts, 1)
			require.Len(t, store.deletes, 1)
		})
	}
}

func TestBytePlusMultipartRequestHardLimitAllowsExactEnvelopeAndRejectsOneOver(t *testing.T) {
	tests := []struct {
		name       string
		bodySize   int64
		wantCode   types.ErrorCode
		wantStatus int
	}{
		{name: "exact hard limit is allowed", bodySize: bytePlusAssetRequestHardMaxBytes},
		{name: "one byte over hard limit is rejected as too large", bodySize: bytePlusAssetRequestHardMaxBytes + 1, wantCode: types.ErrorCodeAssetFileTooLarge, wantStatus: http.StatusRequestEntityTooLarge},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reader := &bytePlusMaxBodyReader{r: io.LimitReader(zeroReader{}, tt.bodySize), remaining: bytePlusAssetRequestHardMaxBytes}
			_, err := io.Copy(io.Discard, reader)
			if tt.wantCode == "" {
				require.NoError(t, err)
				return
			}
			assertAssetError(t, multipartReadError(err), tt.wantCode, tt.wantStatus)
		})
	}
}

func TestBytePlusMultipartRejectsFieldContracts(t *testing.T) {
	tests := []struct {
		name  string
		parts []multipartTestPart
		code  types.ErrorCode
		http  int
	}{
		{name: "missing file", parts: []multipartTestPart{fieldPart("asset_type", "Image")}, code: types.ErrorCodeInvalidAssetRequest, http: http.StatusBadRequest},
		{name: "empty file", parts: []multipartTestPart{fieldPart("asset_type", "Image"), filePart("file", "empty.png", nil)}, code: types.ErrorCodeInvalidAssetRequest, http: http.StatusBadRequest},
		{name: "unknown field", parts: []multipartTestPart{fieldPart("asset_type", "Image"), fieldPart("unknown", "x"), filePart("file", "a.png", pngHeader())}, code: types.ErrorCodeInvalidAssetRequest, http: http.StatusBadRequest},
		{name: "duplicate field", parts: []multipartTestPart{fieldPart("asset_type", "Image"), fieldPart("asset_type", "Image"), filePart("file", "a.png", pngHeader())}, code: types.ErrorCodeInvalidAssetRequest, http: http.StatusBadRequest},
		{name: "oversize field", parts: []multipartTestPart{fieldPart("asset_type", "Image"), fieldPart("name", strings.Repeat("a", 8<<10+1)), filePart("file", "a.png", pngHeader())}, code: types.ErrorCodeAssetFileTooLarge, http: http.StatusRequestEntityTooLarge},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			newBytePlusMultipartTestDB(t)
			_, apiErr := readBytePlusMultipartAsset(context.Background(), newBytePlusMultipartRequest(t, tt.parts), testRealPersonProfile(), testBytePlusChannel(), &fakeBytePlusTempObjectStore{})
			assertAssetError(t, apiErr, tt.code, tt.http)
		})
	}
}

func TestBytePlusMultipartMediaSniffAndValidation(t *testing.T) {
	tests := []struct {
		name string
		data []byte
		mime string
	}{
		{name: "jpeg", data: []byte{0xff, 0xd8, 0xff, 0xdb}, mime: "image/jpeg"},
		{name: "png", data: pngHeader(), mime: "image/png"},
		{name: "webp", data: []byte("RIFF\x10\x00\x00\x00WEBPVP8 "), mime: "image/webp"},
		{name: "bmp", data: []byte("BMxxxx"), mime: "image/bmp"},
		{name: "tiff le", data: []byte("II*\x00"), mime: "image/tiff"},
		{name: "gif", data: []byte("GIF89a"), mime: "image/gif"},
		{name: "heic", data: []byte("\x00\x00\x00\x18ftypheic"), mime: "image/heic"},
		{name: "hevc", data: []byte("\x00\x00\x00\x18ftyphevc"), mime: "image/heic"},
		{name: "hevx", data: []byte("\x00\x00\x00\x18ftyphevx"), mime: "image/heic"},
		{name: "heif", data: []byte("\x00\x00\x00\x18ftypmif1"), mime: "image/heif"},
		{name: "heif sequence", data: []byte("\x00\x00\x00\x18ftypmsf1"), mime: "image/heif"},
		{name: "mp4", data: mp4Header(), mime: "video/mp4"},
		{name: "m4v", data: []byte("\x00\x00\x00\x18ftypM4V "), mime: "video/mp4"},
		{name: "mov", data: []byte("\x00\x00\x00\x18ftypqt  "), mime: "video/quicktime"},
		{name: "wav", data: wavHeader(), mime: "audio/wav"},
		{name: "mp3", data: []byte{0xff, 0xfb, 0x90, 0x64}, mime: "audio/mpeg"},
		{name: "unknown ftyp", data: []byte("\x00\x00\x00\x18ftypxxxx"), mime: ""},
		{name: "mp3 reserved layer", data: []byte{0xff, 0xf9, 0x90, 0x64}, mime: ""},
		{name: "unknown", data: []byte("not media"), mime: ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.mime, sniffBytePlusMediaType(tt.data))
		})
	}
	require.Nil(t, validateBytePlusUploadedMedia("Image", "image/png", 30<<20-1))
	assertAssetError(t, validateBytePlusUploadedMedia("Image", "video/mp4", 100), types.ErrorCodeAssetMediaUnsupported, http.StatusUnsupportedMediaType)
	assertAssetError(t, validateBytePlusUploadedMedia("Video", "video/mp4", 50<<20+1), types.ErrorCodeAssetFileTooLarge, http.StatusRequestEntityTooLarge)
}

func TestBytePlusMultipartPlannedConstantAliases(t *testing.T) {
	require.Equal(t, int64(30<<20), bytePlusImageMaxBytes)
	require.Equal(t, int64(50<<20), bytePlusVideoMaxBytes)
	require.Equal(t, int64(15<<20), bytePlusAudioMaxBytes)
	require.Equal(t, 12*time.Hour, bytePlusSignedURLTTL)
}

func TestBytePlusMultipartNameUsesBaseAndRuneLimit(t *testing.T) {
	newBytePlusMultipartTestDB(t)
	long := strings.Repeat("界", 140)
	req := newBytePlusMultipartRequest(t, []multipartTestPart{
		fieldPart("asset_type", "Image"),
		filePart("file", "../"+long+".png", pngHeader()),
	})
	asset, apiErr := readBytePlusMultipartAsset(context.Background(), req, testRealPersonProfile(), testBytePlusChannel(), &fakeBytePlusTempObjectStore{})
	require.Nil(t, apiErr)
	require.NotContains(t, asset.Name, "/")
	require.NotContains(t, asset.Name, "\\")
	require.Equal(t, 128, utf8.RuneCountInString(asset.Name))
}

func TestBytePlusMultipartPersistsWrappedStoreBucket(t *testing.T) {
	newBytePlusMultipartTestDB(t)
	store := &bucketForwardingTempObjectStore{
		fakeBytePlusTempObjectStore: &fakeBytePlusTempObjectStore{},
		bucket:                      "wrapped-real-person-bucket",
	}
	req := newBytePlusMultipartRequest(t, []multipartTestPart{
		fieldPart("asset_type", "Image"),
		filePart("file", "image.png", pngHeader()),
	})

	asset, apiErr := readBytePlusMultipartAsset(context.Background(), req, testRealPersonProfile(), testBytePlusChannel(), store)
	require.Nil(t, apiErr)
	require.Equal(t, "wrapped-real-person-bucket", asset.TempObject.Bucket)

	var stored model.BytePlusAssetTempObject
	require.NoError(t, model.DB.First(&stored, asset.TempObject.Id).Error)
	require.Equal(t, "wrapped-real-person-bucket", stored.Bucket)
}

type multipartTestPart struct {
	field    string
	fileName string
	value    []byte
}

func fieldPart(name, value string) multipartTestPart {
	return multipartTestPart{field: name, value: []byte(value)}
}

func filePart(name, fileName string, payload []byte) multipartTestPart {
	return multipartTestPart{field: name, fileName: fileName, value: payload}
}

func newBytePlusMultipartRequest(t *testing.T, parts []multipartTestPart) *http.Request {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	for _, part := range parts {
		if part.fileName == "" {
			w, err := writer.CreateFormField(part.field)
			require.NoError(t, err)
			_, err = w.Write(part.value)
			require.NoError(t, err)
			continue
		}
		w, err := writer.CreateFormFile(part.field, part.fileName)
		require.NoError(t, err)
		_, err = w.Write(part.value)
		require.NoError(t, err)
	}
	require.NoError(t, writer.Close())
	req := httptest.NewRequest(http.MethodPost, "/v1/real-person/assets", io.NopCloser(&readOnlyReader{r: bytes.NewReader(body.Bytes())}))
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.ContentLength = -1
	return req
}

type readOnlyReader struct {
	r io.Reader
}

func (r *readOnlyReader) Read(p []byte) (int, error) {
	return r.r.Read(p)
}

type zeroReader struct{}

func (zeroReader) Read(p []byte) (int, error) {
	for i := range p {
		p[i] = 0
	}
	return len(p), nil
}

type bucketForwardingTempObjectStore struct {
	*fakeBytePlusTempObjectStore
	bucket string
}

func (s *bucketForwardingTempObjectStore) TempObjectBucket() string {
	return s.bucket
}

func newBytePlusMultipartTestDB(t *testing.T) {
	t.Helper()
	newBytePlusAssetServiceTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.BytePlusAssetTempObject{}))
	oldNow := bytePlusAssetUploadNow
	bytePlusAssetUploadNow = func() int64 { return 2000 }
	t.Cleanup(func() { bytePlusAssetUploadNow = oldNow })
}

func testRealPersonProfile() *model.BytePlusRealPersonProfile {
	return &model.BytePlusRealPersonProfile{Id: 99, UserId: 7, ChannelId: 131}
}

func testBytePlusChannel() *model.Channel {
	return &model.Channel{Id: 131}
}

func pngHeader() []byte {
	return []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}
}

func mp4Header() []byte {
	return []byte("\x00\x00\x00\x18ftypisom")
}

func wavHeader() []byte {
	return []byte("RIFF\x24\x00\x00\x00WAVE")
}

func makeMediaPayload(header []byte, size int64) []byte {
	if int64(len(header)) > size {
		return header[:size]
	}
	payload := make([]byte, size)
	copy(payload, header)
	return payload
}
