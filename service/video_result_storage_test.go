package service

import (
	"bytes"
	"context"
	"encoding/binary"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	perfmetrics "github.com/QuantumNous/new-api/pkg/perf_metrics"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/stretchr/testify/require"
	"google.golang.org/api/googleapi"
)

func TestVideoResultStorageConfigDefaultsAndOverrides(t *testing.T) {
	cfg := CurrentVideoResultStorageConfig()
	require.Equal(t, "", cfg.Bucket)
	require.Equal(t, 15*time.Minute, cfg.SignedURLTTL)
	require.Equal(t, 24*time.Hour, cfg.Retention)
	require.Equal(t, 30*time.Minute, cfg.FetchTimeout)
	require.Equal(t, int64(500<<20), cfg.MaxBytes)
	require.Equal(t, "", cfg.ServiceAccountEmail)

	t.Setenv("VIDEO_RESULT_STORAGE_BUCKET", "video-results")
	t.Setenv("VIDEO_RESULT_SIGNED_URL_TTL_SECONDS", "120")
	t.Setenv("VIDEO_RESULT_RETENTION_SECONDS", "7200")
	t.Setenv("VIDEO_RESULT_FETCH_TIMEOUT_SECONDS", "60")
	t.Setenv("VIDEO_RESULT_MAX_BYTES", "1024")
	t.Setenv("VIDEO_RESULT_SERVICE_ACCOUNT_EMAIL", "video-signer@example.iam.gserviceaccount.com")

	cfg = CurrentVideoResultStorageConfig()
	require.Equal(t, "video-results", cfg.Bucket)
	require.Equal(t, 2*time.Minute, cfg.SignedURLTTL)
	require.Equal(t, 2*time.Hour, cfg.Retention)
	require.Equal(t, time.Minute, cfg.FetchTimeout)
	require.Equal(t, int64(1024), cfg.MaxBytes)
	require.Equal(t, "video-signer@example.iam.gserviceaccount.com", cfg.ServiceAccountEmail)
}

func TestVideoResultStorageConfigBounds(t *testing.T) {
	t.Setenv("VIDEO_RESULT_STORAGE_BUCKET", "video-results")
	t.Setenv("VIDEO_RESULT_SIGNED_URL_TTL_SECONDS", "0")
	t.Setenv("VIDEO_RESULT_RETENTION_SECONDS", "-1")
	t.Setenv("VIDEO_RESULT_FETCH_TIMEOUT_SECONDS", "0")
	t.Setenv("VIDEO_RESULT_MAX_BYTES", "0")

	cfg := CurrentVideoResultStorageConfig()
	require.Equal(t, 15*time.Minute, cfg.SignedURLTTL)
	require.Equal(t, 24*time.Hour, cfg.Retention)
	require.Equal(t, 30*time.Minute, cfg.FetchTimeout)
	require.Equal(t, int64(500<<20), cfg.MaxBytes)

	t.Setenv("VIDEO_RESULT_SIGNED_URL_TTL_SECONDS", "7200")
	t.Setenv("VIDEO_RESULT_FETCH_TIMEOUT_SECONDS", "3600")
	t.Setenv("VIDEO_RESULT_MAX_BYTES", "1073741824")

	cfg = CurrentVideoResultStorageConfig()
	require.Equal(t, time.Hour, cfg.SignedURLTTL)
	require.Equal(t, 30*time.Minute, cfg.FetchTimeout)
	require.Equal(t, int64(500<<20), cfg.MaxBytes)
}

func TestVideoResultObjectKey(t *testing.T) {
	now := time.Date(2026, 8, 6, 23, 59, 0, 0, time.FixedZone("CST", 8*3600))
	key, err := buildVideoResultObjectKey("task_Abc-123_ok", now)
	require.NoError(t, err)
	require.Equal(t, "video-results/20260806/task_Abc-123_ok.mp4", key)

	for _, taskID := range []string{"", "abc", "task_", "task_../x", "task_a/b", "../task_a", "task_ space"} {
		_, err := buildVideoResultObjectKey(taskID, now)
		require.ErrorIs(t, err, ErrVideoResultInvalidTaskID)
	}
}

func TestVideoResultBoundedReader(t *testing.T) {
	reader := newVideoResultBoundedReader(strings.NewReader("12345"), 5)
	body, err := io.ReadAll(reader)
	require.NoError(t, err)
	require.Equal(t, "12345", string(body))

	reader = newVideoResultBoundedReader(strings.NewReader("123456"), 5)
	_, err = io.ReadAll(reader)
	require.ErrorIs(t, err, ErrVideoResultTooLarge)
}

func TestArchiveVideoResult(t *testing.T) {
	t.Run("archives upstream video into private create-only object", func(t *testing.T) {
		resetVideoResultMetricsForServiceTest(t)
		start := time.Date(2026, 8, 6, 1, 2, 3, 0, time.UTC)
		store := newFakeVideoResultStore()
		restore := installVideoResultArchiveTestHooks(t, store, start)
		defer restore()
		t.Setenv("VIDEO_RESULT_STORAGE_BUCKET", "video-bucket")
		t.Setenv("VIDEO_RESULT_RETENTION_SECONDS", "3600")
		payload := minimalMP4Fixture()
		t.Setenv("VIDEO_RESULT_MAX_BYTES", "16")

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			require.Equal(t, http.MethodGet, r.Method)
			w.Header().Set("Content-Type", "video/mp4; charset=binary")
			_, _ = w.Write(payload)
		}))
		defer server.Close()

		result, err := ArchiveVideoResult(context.Background(), "task_archive-1", server.URL, "")
		require.NoError(t, err)
		require.Equal(t, &model.VideoResult{
			Bucket:      "video-bucket",
			Object:      "video-results/20260806/task_archive-1.mp4",
			Generation:  1,
			ContentType: "video/mp4",
			Size:        int64(len(payload)),
			StoredAt:    start.Unix(),
			ExpiresAt:   start.Add(time.Hour).Unix(),
		}, result)

		created := store.created["video-bucket/video-results/20260806/task_archive-1.mp4"]
		require.Equal(t, payload, created.body)
		require.Equal(t, "video/mp4", created.options.ContentType)
		require.Equal(t, "private, max-age=0, no-store", created.options.CacheControl)
		require.Equal(t, `attachment; filename="task_archive-1.mp4"`, created.options.ContentDisposition)
		require.True(t, store.validatedURLs[server.URL])
		text, err := perfmetrics.BuildPrometheusText(context.Background())
		require.NoError(t, err)
		require.Contains(t, text, `newapi_video_result_archive_total{channel="techmobi",outcome="success"} 1`)
		require.Contains(t, text, `newapi_video_result_archive_bytes_total{channel="techmobi"} 16`)
	})

	for _, testCase := range []struct {
		name        string
		taskID      string
		contentType string
	}{
		{name: "missing content type", taskID: "task_missing_type", contentType: ""},
		{name: "generic binary content type", taskID: "task_octet_stream", contentType: "application/octet-stream"},
		{name: "other video content type", taskID: "task_video_subtype", contentType: "video/webm; codecs=vp9"},
	} {
		t.Run("accepts "+testCase.name+" when content is mp4", func(t *testing.T) {
			start := time.Date(2026, 8, 6, 0, 0, 0, 0, time.UTC)
			store := newFakeVideoResultStore()
			installVideoResultArchiveTestHooks(t, store, start)
			t.Setenv("VIDEO_RESULT_STORAGE_BUCKET", "video-bucket")
			payload := minimalMP4Fixture()

			server := newVideoResultTestServer(t, http.StatusOK, testCase.contentType, string(payload))
			defer server.Close()

			result, err := ArchiveVideoResult(context.Background(), testCase.taskID, server.URL, "")
			require.NoError(t, err)
			require.Equal(t, videoResultMP4ContentType, result.ContentType)
			created := store.created["video-bucket/"+result.Object]
			require.Equal(t, payload, created.body)
			require.Equal(t, videoResultMP4ContentType, created.options.ContentType)
		})
	}

	for _, testCase := range []struct {
		name    string
		taskID  string
		payload []byte
	}{
		{
			name:    "leading free box",
			taskID:  "task_leading_free",
			payload: append(mp4FixtureBox("free", nil, false), minimalMP4Fixture()...),
		},
		{
			name:    "leading skip box",
			taskID:  "task_leading_skip",
			payload: append(mp4FixtureBox("skip", nil, false), minimalMP4Fixture()...),
		},
		{
			name:    "leading extended-size free box",
			taskID:  "task_extended_free",
			payload: append(mp4FixtureBox("free", nil, true), minimalMP4Fixture()...),
		},
		{
			name:    "extended-size ftyp box",
			taskID:  "task_extended_ftyp",
			payload: mp4FixtureBox("ftyp", []byte{'i', 's', 'o', 'm', 0, 0, 0, 0}, true),
		},
	} {
		t.Run("accepts "+testCase.name+" and replays the complete payload", func(t *testing.T) {
			start := time.Date(2026, 8, 6, 0, 0, 0, 0, time.UTC)
			store := newFakeVideoResultStore()
			installVideoResultArchiveTestHooks(t, store, start)
			t.Setenv("VIDEO_RESULT_STORAGE_BUCKET", "video-bucket")
			t.Setenv("VIDEO_RESULT_MAX_BYTES", "131072")

			server := newVideoResultTestServer(t, http.StatusOK, videoResultMP4ContentType, string(testCase.payload))
			defer server.Close()

			result, err := ArchiveVideoResult(context.Background(), testCase.taskID, server.URL, "")
			require.NoError(t, err)
			created := store.created["video-bucket/"+result.Object]
			require.Equal(t, testCase.payload, created.body)
		})
	}

	for _, testCase := range []struct {
		name        string
		taskID      string
		contentType string
		payload     []byte
	}{
		{
			name:        "quicktime brand",
			taskID:      "task_quicktime_brand",
			contentType: "video/quicktime",
			payload:     mp4FixtureWithBrands("qt  "),
		},
		{
			name:        "unknown brand",
			taskID:      "task_unknown_brand",
			contentType: "application/octet-stream",
			payload:     mp4FixtureWithBrands("xxxx"),
		},
		{
			name:        "heif-only brands",
			taskID:      "task_heif_only_brands",
			contentType: videoResultMP4ContentType,
			payload:     mp4FixtureWithBrands("heic", "mif1"),
		},
		{
			name:        "quicktime compatible brand",
			taskID:      "task_quicktime_compatible_brand",
			contentType: videoResultMP4ContentType,
			payload:     mp4FixtureWithBrands("isom", "qt  "),
		},
		{
			name:        "truncated ftyp payload",
			taskID:      "task_truncated_ftyp",
			contentType: videoResultMP4ContentType,
			payload:     mp4FixtureBox("ftyp", []byte{'i', 's', 'o', 'm'}, false),
		},
		{
			name:        "misaligned compatible brands",
			taskID:      "task_misaligned_brands",
			contentType: videoResultMP4ContentType,
			payload:     mp4FixtureBox("ftyp", []byte{'i', 's', 'o', 'm', 0, 0, 0, 0, 'x'}, false),
		},
	} {
		t.Run("rejects "+testCase.name, func(t *testing.T) {
			start := time.Date(2026, 8, 6, 0, 0, 0, 0, time.UTC)
			store := newFakeVideoResultStore()
			installVideoResultArchiveTestHooks(t, store, start)
			t.Setenv("VIDEO_RESULT_STORAGE_BUCKET", "video-bucket")

			server := newVideoResultTestServer(t, http.StatusOK, testCase.contentType, string(testCase.payload))
			defer server.Close()

			_, err := ArchiveVideoResult(context.Background(), testCase.taskID, server.URL, "")
			require.ErrorIs(t, err, ErrVideoResultInvalidContent)
			require.Empty(t, store.created)
		})
	}

	t.Run("accepts an mp4 compatible brand when the major brand is unknown", func(t *testing.T) {
		start := time.Date(2026, 8, 6, 0, 0, 0, 0, time.UTC)
		store := newFakeVideoResultStore()
		installVideoResultArchiveTestHooks(t, store, start)
		t.Setenv("VIDEO_RESULT_STORAGE_BUCKET", "video-bucket")
		payload := mp4FixtureWithBrands("xxxx", "mp42")

		server := newVideoResultTestServer(t, http.StatusOK, "application/octet-stream", string(payload))
		defer server.Close()

		result, err := ArchiveVideoResult(context.Background(), "task_compatible_mp42", server.URL, "")
		require.NoError(t, err)
		require.Equal(t, videoResultMP4ContentType, result.ContentType)
		created := store.created["video-bucket/"+result.Object]
		require.Equal(t, payload, created.body)
	})

	for _, brand := range []string{"iso5", "iso6", "dash", "msdh", "msix", "hvc1", "hev1", "cmfc", "cmfs"} {
		t.Run("accepts common mp4 brand "+brand, func(t *testing.T) {
			start := time.Date(2026, 8, 6, 0, 0, 0, 0, time.UTC)
			store := newFakeVideoResultStore()
			installVideoResultArchiveTestHooks(t, store, start)
			t.Setenv("VIDEO_RESULT_STORAGE_BUCKET", "video-bucket")
			payload := mp4FixtureWithBrands(brand)

			server := newVideoResultTestServer(t, http.StatusOK, "application/octet-stream", string(payload))
			defer server.Close()

			result, err := ArchiveVideoResult(context.Background(), "task_common_"+brand, server.URL, "")
			require.NoError(t, err)
			require.Equal(t, videoResultMP4ContentType, result.ContentType)
			created := store.created["video-bucket/"+result.Object]
			require.Equal(t, payload, created.body)
			require.Equal(t, videoResultMP4ContentType, created.options.ContentType)
		})
	}

	t.Run("allows exactly max bytes", func(t *testing.T) {
		start := time.Date(2026, 8, 6, 0, 0, 0, 0, time.UTC)
		store := newFakeVideoResultStore()
		restore := installVideoResultArchiveTestHooks(t, store, start)
		defer restore()
		t.Setenv("VIDEO_RESULT_STORAGE_BUCKET", "video-bucket")
		payload := minimalMP4Fixture()
		t.Setenv("VIDEO_RESULT_MAX_BYTES", "16")

		server := newVideoResultTestServer(t, http.StatusOK, "video/mp4", string(payload))
		defer server.Close()

		result, err := ArchiveVideoResult(context.Background(), "task_exact", server.URL, "")
		require.NoError(t, err)
		require.Equal(t, int64(len(payload)), result.Size)
		require.False(t, store.closedWithError)
	})

	t.Run("aborts writer and does not finalize oversized object", func(t *testing.T) {
		start := time.Date(2026, 8, 6, 0, 0, 0, 0, time.UTC)
		store := newFakeVideoResultStore()
		restore := installVideoResultArchiveTestHooks(t, store, start)
		defer restore()
		t.Setenv("VIDEO_RESULT_STORAGE_BUCKET", "video-bucket")
		t.Setenv("VIDEO_RESULT_MAX_BYTES", "16")

		server := newVideoResultTestServer(t, http.StatusOK, "video/mp4", string(append(minimalMP4Fixture(), 'x')))
		defer server.Close()

		_, err := ArchiveVideoResult(context.Background(), "task_too_large", server.URL, "")
		require.ErrorIs(t, err, ErrVideoResultTooLarge)
		require.True(t, store.closedWithError)
		require.Empty(t, store.created)
	})

	t.Run("rejects spoofed mp4 content type with a non-mp4 payload", func(t *testing.T) {
		start := time.Date(2026, 8, 6, 0, 0, 0, 0, time.UTC)
		store := newFakeVideoResultStore()
		installVideoResultArchiveTestHooks(t, store, start)
		t.Setenv("VIDEO_RESULT_STORAGE_BUCKET", "video-bucket")

		server := newVideoResultTestServer(t, http.StatusOK, "video/mp4", "not-an-mp4-payload")
		defer server.Close()

		_, err := ArchiveVideoResult(context.Background(), "task_spoofed", server.URL, "")
		require.ErrorIs(t, err, ErrVideoResultInvalidContent)
		require.Empty(t, store.created)
	})

	t.Run("rejects an incompatible content type even when payload looks like mp4", func(t *testing.T) {
		start := time.Date(2026, 8, 6, 0, 0, 0, 0, time.UTC)
		store := newFakeVideoResultStore()
		installVideoResultArchiveTestHooks(t, store, start)
		t.Setenv("VIDEO_RESULT_STORAGE_BUCKET", "video-bucket")

		server := newVideoResultTestServer(t, http.StatusOK, "text/plain", string(minimalMP4Fixture()))
		defer server.Close()

		_, err := ArchiveVideoResult(context.Background(), "task_incompatible_type", server.URL, "")
		require.ErrorIs(t, err, ErrVideoResultInvalidContent)
		require.Empty(t, store.created)
	})

	t.Run("rejects malformed leading box size", func(t *testing.T) {
		start := time.Date(2026, 8, 6, 0, 0, 0, 0, time.UTC)
		store := newFakeVideoResultStore()
		installVideoResultArchiveTestHooks(t, store, start)
		t.Setenv("VIDEO_RESULT_STORAGE_BUCKET", "video-bucket")
		payload := append([]byte{0, 0, 0, 4, 'f', 'r', 'e', 'e'}, minimalMP4Fixture()...)

		server := newVideoResultTestServer(t, http.StatusOK, videoResultMP4ContentType, string(payload))
		defer server.Close()

		_, err := ArchiveVideoResult(context.Background(), "task_malformed_box", server.URL, "")
		require.ErrorIs(t, err, ErrVideoResultInvalidContent)
		require.Empty(t, store.created)
	})

	t.Run("rejects zero-size ftyp box", func(t *testing.T) {
		start := time.Date(2026, 8, 6, 0, 0, 0, 0, time.UTC)
		store := newFakeVideoResultStore()
		installVideoResultArchiveTestHooks(t, store, start)
		t.Setenv("VIDEO_RESULT_STORAGE_BUCKET", "video-bucket")
		payload := []byte{0, 0, 0, 0, 'f', 't', 'y', 'p', 'i', 's', 'o', 'm'}

		server := newVideoResultTestServer(t, http.StatusOK, videoResultMP4ContentType, string(payload))
		defer server.Close()

		_, err := ArchiveVideoResult(context.Background(), "task_zero_size_ftyp", server.URL, "")
		require.ErrorIs(t, err, ErrVideoResultInvalidContent)
		require.Empty(t, store.created)
	})

	t.Run("rejects ftyp beyond the bounded probe window", func(t *testing.T) {
		start := time.Date(2026, 8, 6, 0, 0, 0, 0, time.UTC)
		store := newFakeVideoResultStore()
		installVideoResultArchiveTestHooks(t, store, start)
		t.Setenv("VIDEO_RESULT_STORAGE_BUCKET", "video-bucket")
		payload := append(mp4FixtureBox("free", make([]byte, 64<<10), false), minimalMP4Fixture()...)

		server := newVideoResultTestServer(t, http.StatusOK, videoResultMP4ContentType, string(payload))
		defer server.Close()

		_, err := ArchiveVideoResult(context.Background(), "task_ftyp_beyond_probe", server.URL, "")
		require.ErrorIs(t, err, ErrVideoResultInvalidContent)
		require.Empty(t, store.created)
	})

	t.Run("rejects non video content type", func(t *testing.T) {
		resetVideoResultMetricsForServiceTest(t)
		start := time.Date(2026, 8, 6, 0, 0, 0, 0, time.UTC)
		store := newFakeVideoResultStore()
		restore := installVideoResultArchiveTestHooks(t, store, start)
		defer restore()
		t.Setenv("VIDEO_RESULT_STORAGE_BUCKET", "video-bucket")

		server := newVideoResultTestServer(t, http.StatusOK, "text/plain; charset=utf-8", "hello")
		defer server.Close()

		_, err := ArchiveVideoResult(context.Background(), "task_text", server.URL, "")
		require.ErrorIs(t, err, ErrVideoResultInvalidContent)
		require.Empty(t, store.created)
		text, err := perfmetrics.BuildPrometheusText(context.Background())
		require.NoError(t, err)
		require.Contains(t, text, `newapi_video_result_archive_total{channel="techmobi",outcome="failure"} 1`)
		require.Contains(t, text, `newapi_video_result_archive_bytes_total{channel="techmobi"} 0`)
	})

	t.Run("rejects non 2xx upstream status", func(t *testing.T) {
		start := time.Date(2026, 8, 6, 0, 0, 0, 0, time.UTC)
		store := newFakeVideoResultStore()
		restore := installVideoResultArchiveTestHooks(t, store, start)
		defer restore()
		t.Setenv("VIDEO_RESULT_STORAGE_BUCKET", "video-bucket")

		server := newVideoResultTestServer(t, http.StatusBadGateway, "video/mp4", "bad")
		defer server.Close()

		_, err := ArchiveVideoResult(context.Background(), "task_bad_status", server.URL, "")
		require.ErrorIs(t, err, ErrVideoResultInvalidContent)
		require.Empty(t, store.created)
	})

	t.Run("rejects invalid task id before fetching", func(t *testing.T) {
		start := time.Date(2026, 8, 6, 0, 0, 0, 0, time.UTC)
		store := newFakeVideoResultStore()
		restore := installVideoResultArchiveTestHooks(t, store, start)
		defer restore()
		t.Setenv("VIDEO_RESULT_STORAGE_BUCKET", "video-bucket")

		_, err := ArchiveVideoResult(context.Background(), "task_bad/id", "https://example.com/video.mp4", "")
		require.ErrorIs(t, err, ErrVideoResultInvalidTaskID)
		require.Empty(t, store.validatedURLs)
	})

	t.Run("returns config error for empty bucket", func(t *testing.T) {
		start := time.Date(2026, 8, 6, 0, 0, 0, 0, time.UTC)
		store := newFakeVideoResultStore()
		restore := installVideoResultArchiveTestHooks(t, store, start)
		defer restore()

		_, err := ArchiveVideoResult(context.Background(), "task_no_bucket", "https://example.com/video.mp4", "")
		require.ErrorIs(t, err, ErrVideoResultConfig)
	})

	t.Run("reuses valid existing object after create conflict", func(t *testing.T) {
		resetVideoResultMetricsForServiceTest(t)
		start := time.Date(2026, 8, 6, 0, 0, 0, 0, time.UTC)
		created := start.Add(-time.Minute)
		store := newFakeVideoResultStore()
		restore := installVideoResultArchiveTestHooks(t, store, start)
		defer restore()
		t.Setenv("VIDEO_RESULT_STORAGE_BUCKET", "video-bucket")
		t.Setenv("VIDEO_RESULT_RETENTION_SECONDS", "7200")
		key := "video-bucket/video-results/20260806/task_conflict.mp4"
		store.createErr = ErrVideoResultAlreadyExists
		store.attrs[key] = VideoResultObjectAttrs{
			ContentType: "video/mp4",
			Size:        42,
			Generation:  7,
			Created:     created,
		}

		server := newVideoResultTestServer(t, http.StatusOK, "video/mp4", string(minimalMP4Fixture()))
		defer server.Close()

		result, err := ArchiveVideoResult(context.Background(), "task_conflict", server.URL, "")
		require.NoError(t, err)
		require.Equal(t, int64(7), result.Generation)
		require.Equal(t, int64(42), result.Size)
		require.Equal(t, created.Unix(), result.StoredAt)
		require.Equal(t, created.Add(2*time.Hour).Unix(), result.ExpiresAt)
		text, err := perfmetrics.BuildPrometheusText(context.Background())
		require.NoError(t, err)
		require.Contains(t, text, `newapi_video_result_archive_total{channel="techmobi",outcome="reuse"} 1`)
		require.Contains(t, text, `newapi_video_result_archive_bytes_total{channel="techmobi"} 0`)
	})

	t.Run("rejects invalid existing object after create conflict", func(t *testing.T) {
		start := time.Date(2026, 8, 6, 0, 0, 0, 0, time.UTC)
		store := newFakeVideoResultStore()
		restore := installVideoResultArchiveTestHooks(t, store, start)
		defer restore()
		t.Setenv("VIDEO_RESULT_STORAGE_BUCKET", "video-bucket")
		key := "video-bucket/video-results/20260806/task_invalid_existing.mp4"
		store.createErr = ErrVideoResultAlreadyExists
		store.attrs[key] = VideoResultObjectAttrs{ContentType: "application/octet-stream", Size: 42, Generation: 7, Created: start}

		server := newVideoResultTestServer(t, http.StatusOK, "video/mp4", string(minimalMP4Fixture()))
		defer server.Close()

		_, err := ArchiveVideoResult(context.Background(), "task_invalid_existing", server.URL, "")
		require.ErrorIs(t, err, ErrVideoResultUnavailable)
	})

	t.Run("rejects invalid fresh create attrs", func(t *testing.T) {
		start := time.Date(2026, 8, 6, 0, 0, 0, 0, time.UTC)
		store := newFakeVideoResultStore()
		store.nextAttrs = VideoResultObjectAttrs{ContentType: "video/mp4", Size: 0, Generation: 0, Created: start}
		installVideoResultArchiveTestHooks(t, store, start)
		t.Setenv("VIDEO_RESULT_STORAGE_BUCKET", "video-bucket")

		server := newVideoResultTestServer(t, http.StatusOK, "video/mp4", string(minimalMP4Fixture()))
		defer server.Close()

		_, err := ArchiveVideoResult(context.Background(), "task_zero_fresh", server.URL, "")
		require.ErrorIs(t, err, ErrVideoResultUnavailable)
	})

	t.Run("sanitizes redirect validation errors", func(t *testing.T) {
		start := time.Date(2026, 8, 6, 0, 0, 0, 0, time.UTC)
		store := newFakeVideoResultStore()
		installVideoResultArchiveTestHooks(t, store, start)
		t.Setenv("VIDEO_RESULT_STORAGE_BUCKET", "video-bucket")
		privateURL := "http://127.0.0.1/private"

		originalValidate := videoResultValidateURL
		videoResultValidateURL = func(rawURL string) error {
			if rawURL == privateURL {
				return errors.New("blocked " + rawURL)
			}
			return nil
		}
		t.Cleanup(func() { videoResultValidateURL = originalValidate })

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Redirect(w, r, privateURL, http.StatusFound)
		}))
		defer server.Close()
		videoResultDirectFetchResolver = assetFetchResolverFunc(func(context.Context, string) ([]net.IP, error) {
			return []net.IP{net.ParseIP("93.184.216.34")}, nil
		})
		dialer := &net.Dialer{Timeout: time.Second}
		videoResultDirectFetchDialContext = func(ctx context.Context, network, address string) (net.Conn, error) {
			return dialer.DialContext(ctx, network, server.Listener.Addr().String())
		}

		_, err := ArchiveVideoResult(context.Background(), "task_redirect", server.URL, "")
		require.ErrorIs(t, err, ErrVideoResultInvalidContent)
		require.NotContains(t, err.Error(), privateURL)
		require.NotContains(t, err.Error(), server.URL)
	})
}

func TestSignVideoResultDownload(t *testing.T) {
	now := time.Date(2026, 8, 6, 12, 0, 0, 0, time.UTC)

	t.Run("clamps signed url ttl to remaining retention and signs generation get attachment", func(t *testing.T) {
		store := newFakeVideoResultStore()
		restore := installVideoResultArchiveTestHooks(t, store, now)
		defer restore()
		t.Setenv("VIDEO_RESULT_STORAGE_BUCKET", "video-bucket")
		t.Setenv("VIDEO_RESULT_SIGNED_URL_TTL_SECONDS", "900")
		t.Setenv("VIDEO_RESULT_SERVICE_ACCOUNT_EMAIL", "video-signer@example.iam.gserviceaccount.com")
		result := &model.VideoResult{
			Bucket:      "video-bucket",
			Object:      "video-results/20260806/task_signed.mp4",
			Generation:  7,
			ContentType: "video/mp4; charset=binary",
			Size:        42,
			ExpiresAt:   now.Add(5 * time.Minute).Unix(),
		}
		store.attrs["video-bucket/video-results/20260806/task_signed.mp4"] = VideoResultObjectAttrs{
			ContentType: "video/mp4; charset=binary",
			Size:        42,
			Generation:  7,
			Created:     now.Add(-time.Minute),
		}
		store.signedURL = "https://storage.googleapis.com/video-bucket/video-results/20260806/task_signed.mp4?X-Goog-Signature=secret"

		signed, err := SignVideoResultDownload(context.Background(), "task_signed", result)
		require.NoError(t, err)
		require.Equal(t, store.signedURL, signed)
		require.Equal(t, 1, store.attrsCalls)
		require.Equal(t, 1, store.signCalls)
		require.Len(t, store.signRequests, 1)
		req := store.signRequests[0]
		require.Equal(t, http.MethodGet, req.Method)
		require.Equal(t, 5*time.Minute, req.TTL)
		require.Empty(t, req.ContentType)
		require.Equal(t, "video-signer@example.iam.gserviceaccount.com", req.ServiceAccountEmail)
		require.Equal(t, "7", req.QueryParameters.Get("generation"))
		require.Equal(t, `attachment; filename="task_signed.mp4"`, req.QueryParameters.Get("response-content-disposition"))
		require.Equal(t, "video/mp4", req.QueryParameters.Get("response-content-type"))
	})

	t.Run("requires attrs content type to match persisted media type", func(t *testing.T) {
		store := newFakeVideoResultStore()
		installVideoResultArchiveTestHooks(t, store, now)
		t.Setenv("VIDEO_RESULT_STORAGE_BUCKET", "video-bucket")
		result := validVideoResultForSign(now.Add(time.Hour).Unix())
		result.ContentType = "video/mp4; charset=binary"
		store.attrs["video-bucket/"+result.Object] = VideoResultObjectAttrs{ContentType: "video/webm", Size: result.Size, Generation: result.Generation}

		_, err := SignVideoResultDownload(context.Background(), "task_signed", result)
		require.ErrorIs(t, err, ErrVideoResultUnavailable)
		require.Zero(t, store.signCalls)
	})

	t.Run("rejects an unconfigured or mismatched persisted bucket before object access", func(t *testing.T) {
		for _, tt := range []struct {
			name             string
			configuredBucket string
			persistedBucket  string
		}{
			{name: "unconfigured", configuredBucket: "", persistedBucket: "video-bucket"},
			{name: "mismatch", configuredBucket: "video-bucket", persistedBucket: "other-bucket"},
		} {
			t.Run(tt.name, func(t *testing.T) {
				store := newFakeVideoResultStore()
				installVideoResultArchiveTestHooks(t, store, now)
				t.Setenv("VIDEO_RESULT_STORAGE_BUCKET", tt.configuredBucket)
				result := validVideoResultForSign(now.Add(time.Hour).Unix())
				result.Bucket = tt.persistedBucket
				store.attrs[result.Bucket+"/"+result.Object] = VideoResultObjectAttrs{ContentType: result.ContentType, Size: result.Size, Generation: result.Generation}

				_, err := SignVideoResultDownload(context.Background(), "task_signed", result)
				require.ErrorIs(t, err, ErrVideoResultUnavailable)
				require.Zero(t, store.attrsCalls)
				require.Zero(t, store.signCalls)
			})
		}
	})

	t.Run("rejects object paths not bound to the requested task before object access", func(t *testing.T) {
		for _, objectKey := range []string{
			"video-results/20260806/task_other.mp4",
			"video-results/20260806/task_signed.webm",
			"video-results/2026080/task_signed.mp4",
			"video-results/20260806/nested/task_signed.mp4",
			"other/20260806/task_signed.mp4",
		} {
			t.Run(objectKey, func(t *testing.T) {
				store := newFakeVideoResultStore()
				installVideoResultArchiveTestHooks(t, store, now)
				t.Setenv("VIDEO_RESULT_STORAGE_BUCKET", "video-bucket")
				result := validVideoResultForSign(now.Add(time.Hour).Unix())
				result.Object = objectKey
				store.attrs[result.Bucket+"/"+result.Object] = VideoResultObjectAttrs{ContentType: result.ContentType, Size: result.Size, Generation: result.Generation}

				_, err := SignVideoResultDownload(context.Background(), "task_signed", result)
				require.ErrorIs(t, err, ErrVideoResultUnavailable)
				require.Zero(t, store.attrsCalls)
				require.Zero(t, store.signCalls)
			})
		}
	})

	t.Run("rejects unsafe task ids before signing", func(t *testing.T) {
		for _, taskID := range []string{"", "task_", "task_bad/id", "task_bad\"quote", "task_bad\r\nheader", "legacy-task"} {
			t.Run(taskID, func(t *testing.T) {
				store := newFakeVideoResultStore()
				installVideoResultArchiveTestHooks(t, store, now)
				t.Setenv("VIDEO_RESULT_STORAGE_BUCKET", "video-bucket")
				result := validVideoResultForSign(now.Add(time.Hour).Unix())
				store.attrs["video-bucket/"+result.Object] = VideoResultObjectAttrs{ContentType: result.ContentType, Size: result.Size, Generation: result.Generation}

				_, err := SignVideoResultDownload(context.Background(), taskID, result)
				require.Error(t, err)
				require.True(t, errors.Is(err, ErrVideoResultUnavailable) || errors.Is(err, ErrVideoResultInvalidTaskID))
				require.Zero(t, store.signCalls)
			})
		}
	})

	t.Run("clamps configured ttl at one hour", func(t *testing.T) {
		store := newFakeVideoResultStore()
		installVideoResultArchiveTestHooks(t, store, now)
		t.Setenv("VIDEO_RESULT_STORAGE_BUCKET", "video-bucket")
		t.Setenv("VIDEO_RESULT_SIGNED_URL_TTL_SECONDS", "7200")
		result := validVideoResultForSign(now.Add(2 * time.Hour).Unix())
		store.attrs["video-bucket/"+result.Object] = VideoResultObjectAttrs{ContentType: result.ContentType, Size: result.Size, Generation: result.Generation, Created: now}

		_, err := SignVideoResultDownload(context.Background(), "task_signed", result)
		require.NoError(t, err)
		require.Equal(t, time.Hour, store.signRequests[0].TTL)
	})

	t.Run("expired result does not touch object store", func(t *testing.T) {
		store := newFakeVideoResultStore()
		installVideoResultArchiveTestHooks(t, store, now)
		t.Setenv("VIDEO_RESULT_STORAGE_BUCKET", "video-bucket")
		result := validVideoResultForSign(now.Unix())

		signed, err := SignVideoResultDownload(context.Background(), "task_signed", result)
		require.Empty(t, signed)
		require.ErrorIs(t, err, ErrVideoResultExpired)
		require.Zero(t, store.attrsCalls)
		require.Zero(t, store.signCalls)
	})

	t.Run("nil or incomplete metadata is unavailable", func(t *testing.T) {
		store := newFakeVideoResultStore()
		installVideoResultArchiveTestHooks(t, store, now)
		t.Setenv("VIDEO_RESULT_STORAGE_BUCKET", "video-bucket")

		_, err := SignVideoResultDownload(context.Background(), "task_signed", nil)
		require.ErrorIs(t, err, ErrVideoResultUnavailable)

		_, err = SignVideoResultDownload(context.Background(), "task_signed", &model.VideoResult{Bucket: "video-bucket"})
		require.ErrorIs(t, err, ErrVideoResultUnavailable)
		require.Zero(t, store.attrsCalls)
		require.Zero(t, store.signCalls)
	})

	t.Run("object attr missing mismatch zero or nonvideo is unavailable", func(t *testing.T) {
		cases := []struct {
			name  string
			attrs VideoResultObjectAttrs
		}{
			{name: "missing"},
			{name: "generation mismatch", attrs: VideoResultObjectAttrs{ContentType: "video/mp4", Size: 42, Generation: 8}},
			{name: "size zero", attrs: VideoResultObjectAttrs{ContentType: "video/mp4", Size: 0, Generation: 7}},
			{name: "size mismatch", attrs: VideoResultObjectAttrs{ContentType: "video/mp4", Size: 41, Generation: 7}},
			{name: "nonvideo", attrs: VideoResultObjectAttrs{ContentType: "application/octet-stream", Size: 42, Generation: 7}},
		}
		for _, tt := range cases {
			t.Run(tt.name, func(t *testing.T) {
				store := newFakeVideoResultStore()
				installVideoResultArchiveTestHooks(t, store, now)
				t.Setenv("VIDEO_RESULT_STORAGE_BUCKET", "video-bucket")
				result := validVideoResultForSign(now.Add(time.Hour).Unix())
				if tt.attrs != (VideoResultObjectAttrs{}) {
					store.attrs["video-bucket/"+result.Object] = tt.attrs
				}

				_, err := SignVideoResultDownload(context.Background(), "task_signed", result)
				require.ErrorIs(t, err, ErrVideoResultUnavailable)
				require.Zero(t, store.signCalls)
			})
		}
	})

	t.Run("sign failure is sanitized signing error", func(t *testing.T) {
		store := newFakeVideoResultStore()
		installVideoResultArchiveTestHooks(t, store, now)
		t.Setenv("VIDEO_RESULT_STORAGE_BUCKET", "video-bucket")
		result := validVideoResultForSign(now.Add(time.Hour).Unix())
		store.attrs["video-bucket/"+result.Object] = VideoResultObjectAttrs{ContentType: result.ContentType, Size: result.Size, Generation: result.Generation}
		store.signErr = errors.New("secret https://storage.googleapis.com/video-bucket/object?X-Goog-Signature=abc")

		signed, err := SignVideoResultDownload(context.Background(), "task_signed", result)
		require.Empty(t, signed)
		require.ErrorIs(t, err, ErrVideoResultSigning)
		require.NotContains(t, err.Error(), "storage.googleapis.com")
		require.NotContains(t, err.Error(), "secret")
	})
}

func validVideoResultForSign(expiresAt int64) *model.VideoResult {
	return &model.VideoResult{
		Bucket:      "video-bucket",
		Object:      "video-results/20260806/task_signed.mp4",
		Generation:  7,
		ContentType: "video/mp4",
		Size:        42,
		ExpiresAt:   expiresAt,
	}
}

func minimalMP4Fixture() []byte {
	return []byte{0, 0, 0, 16, 'f', 't', 'y', 'p', 'i', 's', 'o', 'm', 0, 0, 0, 0}
}

func mp4FixtureWithBrands(majorBrand string, compatibleBrands ...string) []byte {
	payload := make([]byte, 8+len(compatibleBrands)*4)
	copy(payload[:4], majorBrand)
	for index, brand := range compatibleBrands {
		copy(payload[8+index*4:], brand)
	}
	return mp4FixtureBox("ftyp", payload, false)
}

func mp4FixtureBox(boxType string, payload []byte, extendedSize bool) []byte {
	headerSize := 8
	if extendedSize {
		headerSize = 16
	}
	box := make([]byte, headerSize+len(payload))
	if extendedSize {
		binary.BigEndian.PutUint32(box[:4], 1)
		binary.BigEndian.PutUint64(box[8:16], uint64(len(box)))
	} else {
		binary.BigEndian.PutUint32(box[:4], uint32(len(box)))
	}
	copy(box[4:8], boxType)
	copy(box[headerSize:], payload)
	return box
}

func TestVideoResultDirectFetchClientRejectsDialTimePrivateIP(t *testing.T) {
	original := *system_setting.GetFetchSetting()
	t.Cleanup(func() { *system_setting.GetFetchSetting() = original })
	system_setting.GetFetchSetting().EnableSSRFProtection = true
	system_setting.GetFetchSetting().AllowPrivateIp = false
	system_setting.GetFetchSetting().DomainFilterMode = false
	system_setting.GetFetchSetting().IpFilterMode = false
	system_setting.GetFetchSetting().AllowedPorts = []string{"80", "443"}
	system_setting.GetFetchSetting().ApplyIPFilterForDomain = true

	dialed := false
	start := time.Date(2026, 8, 6, 0, 0, 0, 0, time.UTC)
	store := newFakeVideoResultStore()
	installVideoResultArchiveTestHooks(t, store, start)
	t.Setenv("VIDEO_RESULT_STORAGE_BUCKET", "video-bucket")
	videoResultDirectFetchResolver = assetFetchResolverFunc(func(ctx context.Context, host string) ([]net.IP, error) {
		require.Equal(t, "video.example", host)
		return []net.IP{net.ParseIP("127.0.0.1")}, nil
	})
	videoResultDirectFetchDialContext = func(ctx context.Context, network, address string) (net.Conn, error) {
		dialed = true
		return nil, errors.New("should not dial")
	}

	_, err := ArchiveVideoResult(context.Background(), "task_rebind", "http://video.example/video.mp4", "")
	require.ErrorIs(t, err, ErrVideoResultInvalidContent)
	require.False(t, dialed)
	require.NotContains(t, err.Error(), "video.example")
	require.NotContains(t, err.Error(), "127.0.0.1")
}

func TestGCSVideoResult(t *testing.T) {
	t.Run("sign url forwards request", func(t *testing.T) {
		var capturedBucket, capturedKey string
		var captured VideoResultSignedURLRequest
		restore := installGCSVideoResultSignURLHook(t, func(_ context.Context, bucket, objectKey string, request VideoResultSignedURLRequest) (string, error) {
			capturedBucket = bucket
			capturedKey = objectKey
			captured = request
			return "https://signed.example/video", nil
		})
		defer restore()

		store := gcsVideoResultObjectStore{}
		values := url.Values{"response-content-disposition": []string{"attachment"}}
		signed, err := store.SignURL(context.Background(), "bucket", "video-results/20260806/task_a.mp4", VideoResultSignedURLRequest{
			Method:              http.MethodGet,
			TTL:                 time.Minute,
			ServiceAccountEmail: "svc@example.iam.gserviceaccount.com",
			QueryParameters:     values,
		})
		require.NoError(t, err)
		require.Equal(t, "https://signed.example/video", signed)
		require.Equal(t, "bucket", capturedBucket)
		require.Equal(t, "video-results/20260806/task_a.mp4", capturedKey)
		require.Equal(t, http.MethodGet, captured.Method)
		require.Equal(t, time.Minute, captured.TTL)
		require.Equal(t, "svc@example.iam.gserviceaccount.com", captured.ServiceAccountEmail)
		require.Equal(t, values, captured.QueryParameters)
	})

	t.Run("maps write time precondition failure to already exists", func(t *testing.T) {
		restore := installGCSVideoResultWriterHook(t, func(context.Context, string, string) videoResultObjectWriter {
			return &fakeVideoResultWriter{writeErr: &googleapi.Error{Code: http.StatusPreconditionFailed, Message: "precondition"}}
		})
		defer restore()

		store := gcsVideoResultObjectStore{}
		_, err := store.Create(context.Background(), "bucket", "video-results/20260806/task_a.mp4", strings.NewReader("video"), VideoResultCreateOptions{ContentType: "video/mp4"})
		require.ErrorIs(t, err, ErrVideoResultAlreadyExists)
	})
}

type fakeVideoResultStore struct {
	created         map[string]fakeVideoResultObject
	attrs           map[string]VideoResultObjectAttrs
	createErr       error
	attrsErr        error
	signErr         error
	signedURL       string
	attrsCalls      int
	signCalls       int
	signRequests    []VideoResultSignedURLRequest
	nextAttrs       VideoResultObjectAttrs
	closedWithError bool
	validatedURLs   map[string]bool
}

type fakeVideoResultObject struct {
	body    []byte
	options VideoResultCreateOptions
}

func newFakeVideoResultStore() *fakeVideoResultStore {
	return &fakeVideoResultStore{
		created:       map[string]fakeVideoResultObject{},
		attrs:         map[string]VideoResultObjectAttrs{},
		validatedURLs: map[string]bool{},
	}
}

func (f *fakeVideoResultStore) Create(_ context.Context, bucket, objectKey string, body io.Reader, options VideoResultCreateOptions) (VideoResultObjectAttrs, error) {
	data, err := io.ReadAll(body)
	if err != nil {
		f.closedWithError = true
		return VideoResultObjectAttrs{}, err
	}
	if f.createErr != nil {
		return VideoResultObjectAttrs{}, f.createErr
	}
	key := bucket + "/" + objectKey
	f.created[key] = fakeVideoResultObject{body: append([]byte(nil), data...), options: options}
	created := videoResultNow()
	attrs := VideoResultObjectAttrs{
		ContentType: options.ContentType,
		Size:        int64(len(data)),
		Generation:  1,
		Created:     created,
	}
	if f.nextAttrs != (VideoResultObjectAttrs{}) {
		attrs = f.nextAttrs
	}
	f.attrs[key] = attrs
	return attrs, nil
}

func (f *fakeVideoResultStore) Attrs(_ context.Context, bucket, objectKey string) (VideoResultObjectAttrs, error) {
	f.attrsCalls++
	if f.attrsErr != nil {
		return VideoResultObjectAttrs{}, f.attrsErr
	}
	attrs, ok := f.attrs[bucket+"/"+objectKey]
	if !ok {
		return VideoResultObjectAttrs{}, ErrVideoResultUnavailable
	}
	return attrs, nil
}

func (f *fakeVideoResultStore) SignURL(_ context.Context, _ string, _ string, request VideoResultSignedURLRequest) (string, error) {
	f.signCalls++
	f.signRequests = append(f.signRequests, request)
	if f.signErr != nil {
		return "", f.signErr
	}
	if f.signedURL != "" {
		return f.signedURL, nil
	}
	return "https://signed.example/video", nil
}

func installVideoResultArchiveTestHooks(t *testing.T, store *fakeVideoResultStore, now time.Time) func() {
	t.Helper()
	originalStore := videoResultObjectStore
	originalNow := videoResultNow
	originalValidate := videoResultValidateURL
	originalClient := httpClient
	originalResolver := videoResultDirectFetchResolver
	originalDialContext := videoResultDirectFetchDialContext
	originalFetchSetting := *system_setting.GetFetchSetting()
	videoResultObjectStore = store
	videoResultNow = func() time.Time { return now }
	videoResultValidateURL = func(rawURL string) error {
		store.validatedURLs[rawURL] = true
		return nil
	}
	httpClient = &http.Client{Transport: http.DefaultTransport}
	videoResultDirectFetchResolver = assetFetchResolverFunc(func(context.Context, string) ([]net.IP, error) {
		return []net.IP{net.ParseIP("93.184.216.34")}, nil
	})
	videoResultDirectFetchDialContext = func(ctx context.Context, network, address string) (net.Conn, error) {
		_, port, err := net.SplitHostPort(address)
		if err != nil {
			return nil, err
		}
		dialer := &net.Dialer{Timeout: time.Second}
		return dialer.DialContext(ctx, network, net.JoinHostPort("127.0.0.1", port))
	}
	system_setting.GetFetchSetting().AllowedPorts = []string{"1-65535"}
	t.Cleanup(func() {
		videoResultObjectStore = originalStore
		videoResultNow = originalNow
		videoResultValidateURL = originalValidate
		httpClient = originalClient
		videoResultDirectFetchResolver = originalResolver
		videoResultDirectFetchDialContext = originalDialContext
		*system_setting.GetFetchSetting() = originalFetchSetting
	})
	return func() {
		videoResultObjectStore = originalStore
		videoResultNow = originalNow
		videoResultValidateURL = originalValidate
		httpClient = originalClient
		videoResultDirectFetchResolver = originalResolver
		videoResultDirectFetchDialContext = originalDialContext
		*system_setting.GetFetchSetting() = originalFetchSetting
	}
}

func installGCSVideoResultSignURLHook(t *testing.T, hook func(context.Context, string, string, VideoResultSignedURLRequest) (string, error)) func() {
	t.Helper()
	original := gcsVideoResultSignURL
	gcsVideoResultSignURL = hook
	t.Cleanup(func() { gcsVideoResultSignURL = original })
	return func() { gcsVideoResultSignURL = original }
}

func installGCSVideoResultWriterHook(t *testing.T, hook func(context.Context, string, string) videoResultObjectWriter) func() {
	t.Helper()
	original := newGCSVideoResultObjectWriter
	newGCSVideoResultObjectWriter = hook
	t.Cleanup(func() { newGCSVideoResultObjectWriter = original })
	return func() { newGCSVideoResultObjectWriter = original }
}

func resetVideoResultMetricsForServiceTest(t *testing.T) {
	t.Helper()
	perfmetrics.ResetVideoResultMetricsForTest()
	t.Cleanup(perfmetrics.ResetVideoResultMetricsForTest)
}

func newVideoResultTestServer(t *testing.T, status int, contentType, body string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", contentType)
		w.WriteHeader(status)
		_, err := io.Copy(w, bytes.NewBufferString(body))
		require.NoError(t, err)
	}))
}

var _ VideoResultObjectStore = (*fakeVideoResultStore)(nil)
var _ = errors.Is

type fakeVideoResultWriter struct {
	writeErr       error
	closeErr       error
	closeWithError bool
}

func (f *fakeVideoResultWriter) Write([]byte) (int, error) {
	if f.writeErr != nil {
		return 0, f.writeErr
	}
	return 0, nil
}

func (f *fakeVideoResultWriter) Close() error {
	return f.closeErr
}

func (f *fakeVideoResultWriter) CloseWithError(error) error {
	f.closeWithError = true
	return nil
}

func (f *fakeVideoResultWriter) CloseClient() error {
	return nil
}

func (f *fakeVideoResultWriter) SetContentType(string) {}

func (f *fakeVideoResultWriter) SetCacheControl(string) {}

func (f *fakeVideoResultWriter) SetContentDisposition(string) {}

func (f *fakeVideoResultWriter) Attrs() VideoResultObjectAttrs {
	return VideoResultObjectAttrs{ContentType: "video/mp4", Size: 1, Generation: 1, Created: videoResultNow()}
}
