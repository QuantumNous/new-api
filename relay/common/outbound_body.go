package common

import (
	"io"

	"github.com/QuantumNous/new-api/common"
)

// NewOutboundJSONBody wraps the already-marshaled upstream request body into a
// BodyStorage. When disk cache is enabled and the payload exceeds the configured
// threshold, the data is written to a temp file and the original []byte can be
// GC'd, significantly reducing the heap residency while waiting for the
// upstream provider to respond (the dominant cost for large base64 payloads).
//
// In memory mode the underlying memoryStorage reuses the same backing array,
// so this is equivalent to bytes.NewReader(data) in terms of memory usage.
//
// The caller MUST invoke closer.Close() once the upstream call has finished
// (typically via defer) to release the disk file / memory accounting.
//
// The returned reader is wrapped with common.ReaderOnly to prevent the HTTP
// transport from prematurely closing the underlying BodyStorage. The returned
// size is meant to be propagated to http.Request.ContentLength because the
// type-erased io.Reader prevents net/http from auto-detecting it.
//
// The returned getBody hands out a new, independent reader over the full body
// on every call, per the http.Request.GetBody contract of returning a fresh
// copy of the body. It is meant to be propagated to http.Request.GetBody
// (which net/http likewise cannot derive from a type-erased io.Reader) so the
// HTTP/2 transport can transparently retry the request when the upstream
// resets the stream after the body was already written ("http2: Transport:
// cannot retry err ... after Request.Body was written"). Each reader has its
// own cursor — in memory mode a fresh bytes.Reader over the shared immutable
// backing array, in disk mode a separate file descriptor — so replays never
// share seek state with the primary body or with each other, and closing a
// replayed reader never releases the underlying storage.
func NewOutboundJSONBody(data []byte) (body io.Reader, size int64, getBody func() (io.ReadCloser, error), closer io.Closer, err error) {
	storage, err := common.CreateBodyStorage(data)
	if err != nil {
		return nil, 0, nil, nil, err
	}
	return common.ReaderOnly(storage), storage.Size(), storage.NewReader, storage, nil
}
