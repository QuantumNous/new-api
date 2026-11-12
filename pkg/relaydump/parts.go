package relaydump

import (
	"encoding/base64"
	"io"
	"net/http"
	"net/textproto"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// buildRedactedHeaders returns the canonical header set to redact: the
// built-in list (optional) plus the administrator's custom list.
func buildRedactedHeaders(setting *operation_setting.RelayDumpSetting) map[string]struct{} {
	set := make(map[string]struct{})
	if setting == nil {
		return set
	}
	if setting.RedactHeaders {
		for _, name := range defaultRedactedHeaders {
			set[textproto.CanonicalMIMEHeaderKey(name)] = struct{}{}
		}
	}
	for _, name := range setting.ExtraRedactHeaders() {
		set[name] = struct{}{}
	}
	return set
}

// redactHeader converts an http.Header to a plain map with configured values
// replaced by <redacted>.
func redactHeader(header http.Header, redacted map[string]struct{}) map[string][]string {
	result := make(map[string][]string, len(header))
	for name, values := range header {
		canonical := textproto.CanonicalMIMEHeaderKey(name)
		copied := make([]string, 0, len(values))
		for _, value := range values {
			if _, hit := redacted[canonical]; hit {
				copied = append(copied, redactedValue)
			} else {
				copied = append(copied, value)
			}
		}
		if len(copied) > 0 {
			result[canonical] = copied
		}
	}
	return result
}

// captureRequestSide snapshots the outgoing request without consuming the
// live transport body: the body is re-read through req.GetBody so the actual
// body and retry replay stay untouched.
func captureRequestSide(req *http.Request, redacted map[string]struct{}, maxBody int64) *DumpSide {
	side := &DumpSide{Headers: map[string][]string{}}
	if req == nil {
		return side
	}
	side.Method = req.Method
	if req.URL != nil {
		side.URL = req.URL.String()
	}
	side.Headers = redactHeader(req.Header, redacted)
	if req.Body == nil {
		return side
	}
	if req.GetBody == nil {
		// Bodies that cannot be replayed must not be consumed here.
		side.BodyMissing = true
		return side
	}
	reader, err := req.GetBody()
	if err != nil {
		side.BodyMissing = true
		return side
	}
	defer reader.Close()
	fillBodyFromReader(side, reader, maxBody)
	return side
}

func fillBodyFromReader(side *DumpSide, reader io.Reader, maxBody int64) {
	data, err := io.ReadAll(io.LimitReader(reader, maxBody+1))
	if err != nil {
		side.BodyMissing = true
		return
	}
	side.BodyTruncated = int64(len(data)) > maxBody
	if side.BodyTruncated {
		data = data[:maxBody]
	}
	if len(data) == 0 {
		return
	}
	if utf8.Valid(data) {
		side.Body = string(data)
	} else {
		side.Body = base64.StdEncoding.EncodeToString(data)
		side.BodyBase64 = true
	}
}
