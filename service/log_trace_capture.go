package service

import (
	"io"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func CaptureTraceRequestFromBytes(info *relaycommon.RelayInfo, contentType string, body []byte) {
	if info == nil {
		return
	}
	truncated := false
	preview := body
	if len(preview) > relaycommon.LogTraceInlineLimit {
		preview = preview[:relaycommon.LogTraceInlineLimit]
		truncated = true
	}
	info.SetTraceRequestBodyPreview(contentType, preview, int64(len(body)), truncated)
}

func CaptureTraceRequestFromStorage(info *relaycommon.RelayInfo, contentType string, storage common.BodyStorage) {
	if info == nil || storage == nil {
		return
	}
	if _, err := storage.Seek(0, io.SeekStart); err != nil {
		return
	}
	buf := make([]byte, relaycommon.LogTraceInlineLimit+1)
	n, readErr := io.ReadFull(storage, buf)
	if readErr != nil && readErr != io.ErrUnexpectedEOF && readErr != io.EOF {
		_, _ = storage.Seek(0, io.SeekStart)
		return
	}
	truncated := storage.Size() > int64(n) || n > relaycommon.LogTraceInlineLimit
	if n > relaycommon.LogTraceInlineLimit {
		n = relaycommon.LogTraceInlineLimit
	}
	info.SetTraceRequestBodyPreview(contentType, buf[:n], storage.Size(), truncated)
	_, _ = storage.Seek(0, io.SeekStart)
}

func CaptureTraceResponseFromBytes(info *relaycommon.RelayInfo, resp *http.Response, body []byte) {
	if info == nil {
		return
	}
	contentType := ""
	if resp != nil {
		info.SetTraceResponseHeaders(resp)
		contentType = resp.Header.Get("Content-Type")
	}
	truncated := false
	preview := body
	if len(preview) > relaycommon.LogTraceInlineLimit {
		preview = preview[:relaycommon.LogTraceInlineLimit]
		truncated = true
	}
	info.SetTraceResponseBodyPreview(contentType, preview, int64(len(body)), truncated)
}

func EnsureTraceResponseBodyFromBytes(info *relaycommon.RelayInfo, contentType string, body []byte) {
	if info == nil {
		return
	}
	if info.TracePayload != nil && info.TracePayload.Response != nil {
		part := info.TracePayload.Response
		if part.Body != "" || part.BodySize > 0 || part.StorageKind != "" {
			return
		}
	}
	truncated := false
	preview := body
	if len(preview) > relaycommon.LogTraceInlineLimit {
		preview = preview[:relaycommon.LogTraceInlineLimit]
		truncated = true
	}
	info.SetTraceResponseBodyPreview(contentType, preview, int64(len(body)), truncated)
}
