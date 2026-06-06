package conversationarchive

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestResolveSessionID(t *testing.T) {
	require.Equal(t, "from-header", ResolveSessionID(" from-header ", []byte(`{"metadata":{"session_id":"from-meta"}}`), "fallback"))
	require.Equal(t, "from-meta", ResolveSessionID("", []byte(`{"metadata":{"session_id":"from-meta"}}`), "fallback"))
	require.Equal(t, "from-root", ResolveSessionID("", []byte(`{"session_id":"from-root"}`), "fallback"))
	require.Equal(t, "from-conversation", ResolveSessionID("", []byte(`{"conversation_id":"from-conversation"}`), "fallback"))
	require.Equal(t, "fallback", ResolveSessionID("", []byte(`{"metadata":{"session_id":123}}`), "fallback"))
}

func TestCompressBytesRoundTrip(t *testing.T) {
	origin := []byte(`{"model":"gpt-test","messages":[{"role":"user","content":"hello"}]}`)
	compressed, err := CompressBytes(origin)
	require.NoError(t, err)
	require.NotEmpty(t, compressed)

	decompressed, err := DecompressBytes(compressed)
	require.NoError(t, err)
	require.Equal(t, origin, decompressed)
}

func TestDecompressOptionalBytesAllowsEmptyLegacyField(t *testing.T) {
	decompressed, err := DecompressOptionalBytes(nil)
	require.NoError(t, err)
	require.Empty(t, decompressed)
	require.Equal(t, map[string][]string{}, headersForExport(decompressed))
}

func TestBodyForExport(t *testing.T) {
	jsonBody := bodyForExport([]byte(`{"ok":true}`))
	require.IsType(t, json.RawMessage{}, jsonBody)
	rendered, err := jsonBody.(json.RawMessage).MarshalJSON()
	require.NoError(t, err)
	require.Equal(t, []byte(`{"ok":true}`), rendered)

	streamBody := bodyForExport([]byte("data: {\"ok\":true}\n\n"))
	require.Equal(t, "data: {\"ok\":true}\n\n", streamBody)
}

func TestValidArchiveTableName(t *testing.T) {
	require.True(t, validArchiveTableName("conversation_archive_20260606"))
	require.False(t, validArchiveTableName("conversation_archive_202606"))
	require.False(t, validArchiveTableName("conversation_archive_2026060a"))
	require.False(t, validArchiveTableName("other_20260606"))
}

func TestTableNameForRecordPrefersResponseTime(t *testing.T) {
	record := Record{
		RequestTime:  time.Date(2026, 6, 6, 23, 59, 0, 0, time.UTC),
		ResponseTime: time.Date(2026, 6, 7, 0, 1, 0, 0, time.UTC),
	}
	require.Equal(t, "conversation_archive_20260607", tableNameForRecord(record))
}

func TestQueueByteReservation(t *testing.T) {
	svc := &service{queueMaxBytes: 10}
	require.True(t, svc.tryReserve(6))
	require.Equal(t, int64(6), svc.queuedBytes.Load())
	require.False(t, svc.tryReserve(5))
	svc.releaseQueuedBytes(6)
	require.Equal(t, int64(0), svc.queuedBytes.Load())
}

func TestQueuedTableCount(t *testing.T) {
	svc := &service{queuedTables: map[string]int{}}
	record := Record{RequestTime: time.Date(2026, 6, 6, 8, 0, 0, 0, time.UTC)}
	tableName := tableNameFor(record.RequestTime)

	svc.trackQueuedTable(record)
	svc.trackQueuedTable(record)
	require.Equal(t, 2, svc.queuedTableCount(tableName))

	svc.releaseQueuedTable(record)
	require.Equal(t, 1, svc.queuedTableCount(tableName))
	svc.releaseQueuedTable(record)
	require.Equal(t, 0, svc.queuedTableCount(tableName))
}

func TestR2ObjectKey(t *testing.T) {
	svc := &service{cfg: Config{R2Prefix: "archive-root"}}
	date := time.Date(2026, 6, 6, 8, 0, 0, 0, time.UTC)
	require.Equal(t, "archive-root/2026/06/06/conversation_archive_20260606.jsonl.gz", svc.r2ObjectKey(date, "conversation_archive_20260606.jsonl.gz"))
}
