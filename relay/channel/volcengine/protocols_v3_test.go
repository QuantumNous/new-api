package volcengine

import (
	"bytes"
	"encoding/binary"
	"io"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
)

// roundTripFrame builds a Message, marshals it, then parses it back, and
// returns the parsed message for assertion convenience.
func roundTripFrame(t *testing.T, build func() *Message) *Message {
	t.Helper()
	src := build()
	frame, err := src.Marshal()
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}
	parsed, err := NewMessageFromBytes(frame)
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}
	return parsed
}

func newEventMessage(evt EventType, sessionID string, payload []byte) *Message {
	m, _ := NewMessage(MsgTypeFullClientRequest, MsgTypeFlagWithEvent)
	m.EventType = evt
	m.SessionID = sessionID
	if len(payload) == 0 {
		payload = []byte("{}")
	}
	m.Payload = payload
	return m
}

func TestRoundTrip_StartConnection(t *testing.T) {
	parsed := roundTripFrame(t, func() *Message {
		return newEventMessage(EventType_StartConnection, "", nil)
	})
	if parsed.EventType != EventType_StartConnection {
		t.Fatalf("event mismatch: got %v", parsed.EventType)
	}
	if parsed.SessionID != "" {
		t.Fatalf("connection-class events MUST NOT carry sessionID, got %q", parsed.SessionID)
	}
	if string(parsed.Payload) != "{}" {
		t.Fatalf("payload mismatch: %q", parsed.Payload)
	}
}

func TestRoundTrip_StartSession_WithSessionID(t *testing.T) {
	const sid = "11111111-2222-3333-4444-555555555555"
	body := []byte(`{"event":100,"namespace":"BidirectionalTTS","req_params":{"speaker":"x","audio_params":{"format":"mp3"}}}`)
	parsed := roundTripFrame(t, func() *Message {
		return newEventMessage(EventType_StartSession, sid, body)
	})
	if parsed.EventType != EventType_StartSession {
		t.Fatalf("event mismatch: got %v", parsed.EventType)
	}
	if parsed.SessionID != sid {
		t.Fatalf("sessionID mismatch: got %q want %q", parsed.SessionID, sid)
	}
	if !bytes.Equal(parsed.Payload, body) {
		t.Fatalf("payload mismatch")
	}
}

func TestRoundTrip_TaskRequest(t *testing.T) {
	const sid = "session-abc"
	body := []byte(`{"event":200,"req_params":{"text":"你好"}}`)
	parsed := roundTripFrame(t, func() *Message {
		return newEventMessage(EventType_TaskRequest, sid, body)
	})
	if parsed.EventType != EventType_TaskRequest {
		t.Fatalf("event mismatch")
	}
	if parsed.SessionID != sid {
		t.Fatalf("sessionID mismatch: got %q", parsed.SessionID)
	}
	if !bytes.Equal(parsed.Payload, body) {
		t.Fatalf("payload mismatch")
	}
}

func TestRoundTrip_FinishSession_EmptyBody(t *testing.T) {
	const sid = "abcdef"
	parsed := roundTripFrame(t, func() *Message {
		return newEventMessage(EventType_FinishSession, sid, nil) // payload defaults to "{}"
	})
	if parsed.EventType != EventType_FinishSession {
		t.Fatalf("event mismatch")
	}
	if parsed.SessionID != sid {
		t.Fatalf("sessionID mismatch")
	}
	if string(parsed.Payload) != "{}" {
		t.Fatalf("payload mismatch: %q", parsed.Payload)
	}
}

// AudioOnlyServer + WithEvent (no sequence flag) — the wire shape used by
// EventType_TTSResponse on v3 endpoints.
func TestRoundTrip_AudioOnlyServer_TTSResponse(t *testing.T) {
	const sid = "session-audio"
	audio := []byte{0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE, 0xFD}
	parsed := roundTripFrame(t, func() *Message {
		m, _ := NewMessage(MsgTypeAudioOnlyServer, MsgTypeFlagWithEvent)
		m.EventType = EventType_TTSResponse
		m.SessionID = sid
		m.Payload = audio
		return m
	})
	if parsed.MsgType != MsgTypeAudioOnlyServer {
		t.Fatalf("msg type mismatch")
	}
	if parsed.EventType != EventType_TTSResponse {
		t.Fatalf("event mismatch")
	}
	if parsed.SessionID != sid {
		t.Fatalf("sessionID mismatch")
	}
	if !bytes.Equal(parsed.Payload, audio) {
		t.Fatalf("audio bytes mismatch")
	}
}

// FullServerResponse + WithEvent + SessionFinished payload carrying usage.text_words.
func TestRoundTrip_SessionFinished_WithUsage(t *testing.T) {
	const sid = "session-fin"
	body := []byte(`{"status_code":20000000,"message":"ok","usage":{"text_words":42}}`)
	parsed := roundTripFrame(t, func() *Message {
		m, _ := NewMessage(MsgTypeFullServerResponse, MsgTypeFlagWithEvent)
		m.EventType = EventType_SessionFinished
		m.SessionID = sid
		m.Payload = body
		return m
	})
	env := parseV3SessionResult(parsed.Payload)
	if env == nil {
		t.Fatalf("envelope nil")
	}
	if env.StatusCode != 20000000 {
		t.Fatalf("status mismatch: %d", env.StatusCode)
	}
	if env.Usage == nil || env.Usage.TextWords != 42 {
		t.Fatalf("usage mismatch: %+v", env.Usage)
	}
}

// ConnectionStarted is an inbound-only frame (server → client) with this wire
// shape:
//   header(4) | event(4) | uint32(connectID len) | connectID | uint32(payload len) | payload
// We exercise the parser by hand-crafting that wire layout, since the writer
// path never produces ConnectionStarted (clients only consume it).
func TestParse_ConnectionStarted_CarriesConnectID(t *testing.T) {
	const cid = "connect-XYZ"
	body := []byte("{}")

	frame := new(bytes.Buffer)
	frame.WriteByte(byte(uint8(Version1)<<4 | uint8(HeaderSize4)))
	frame.WriteByte(byte(uint8(MsgTypeFullServerResponse)<<4 | uint8(MsgTypeFlagWithEvent)))
	frame.WriteByte(byte(uint8(SerializationJSON)<<4 | uint8(CompressionNone)))
	frame.WriteByte(0x00) // reserved
	_ = binary.Write(frame, binary.BigEndian, EventType_ConnectionStarted)
	_ = binary.Write(frame, binary.BigEndian, uint32(len(cid)))
	frame.WriteString(cid)
	_ = binary.Write(frame, binary.BigEndian, uint32(len(body)))
	frame.Write(body)

	parsed, err := NewMessageFromBytes(frame.Bytes())
	if err != nil {
		t.Fatalf("parse failed: %v", err)
	}
	if parsed.EventType != EventType_ConnectionStarted {
		t.Fatalf("event mismatch")
	}
	if parsed.SessionID != "" {
		t.Fatalf("connection-class MUST NOT carry sessionID, got %q", parsed.SessionID)
	}
	if parsed.ConnectID != cid {
		t.Fatalf("connectID mismatch: got %q want %q", parsed.ConnectID, cid)
	}
}

// ReadOneFrame must consume exactly one frame from a streaming reader and
// leave subsequent bytes untouched, so consecutive calls can drain a chunked
// HTTP body.
func TestReadOneFrame_StreamingChunked(t *testing.T) {
	// Build two frames: a TTSResponse audio frame, then a SessionFinished frame.
	audio := []byte("chunk-1-audio-bytes")
	frame1, err := (&Message{
		Version:       Version1,
		HeaderSize:    HeaderSize4,
		MsgType:       MsgTypeAudioOnlyServer,
		MsgTypeFlag:   MsgTypeFlagWithEvent,
		Serialization: SerializationJSON,
		Compression:   CompressionNone,
		EventType:     EventType_TTSResponse,
		SessionID:     "sid",
		Payload:       audio,
	}).Marshal()
	if err != nil {
		t.Fatalf("marshal frame1: %v", err)
	}
	frame2Body := []byte(`{"status_code":20000000,"message":"ok","usage":{"text_words":7}}`)
	frame2, err := (&Message{
		Version:       Version1,
		HeaderSize:    HeaderSize4,
		MsgType:       MsgTypeFullServerResponse,
		MsgTypeFlag:   MsgTypeFlagWithEvent,
		Serialization: SerializationJSON,
		Compression:   CompressionNone,
		EventType:     EventType_SessionFinished,
		SessionID:     "sid",
		Payload:       frame2Body,
	}).Marshal()
	if err != nil {
		t.Fatalf("marshal frame2: %v", err)
	}
	stream := bytes.NewReader(append(frame1, frame2...))

	first, err := ReadOneFrame(stream)
	if err != nil {
		t.Fatalf("first frame: %v", err)
	}
	if first.MsgType != MsgTypeAudioOnlyServer || first.EventType != EventType_TTSResponse {
		t.Fatalf("first frame fields wrong: %+v", first)
	}
	if !bytes.Equal(first.Payload, audio) {
		t.Fatalf("first audio mismatch")
	}

	second, err := ReadOneFrame(stream)
	if err != nil {
		t.Fatalf("second frame: %v", err)
	}
	if second.EventType != EventType_SessionFinished {
		t.Fatalf("second event wrong: %v", second.EventType)
	}
	env := parseV3SessionResult(second.Payload)
	if env == nil || env.Usage == nil || env.Usage.TextWords != 7 {
		t.Fatalf("usage parse failed: %+v", env)
	}

	// Reader should now be exhausted.
	if _, err := ReadOneFrame(stream); err != io.EOF {
		t.Fatalf("expected EOF after draining, got %v", err)
	}
}

// Sanity: writers and readers MUST emit/consume bytes in the same order so
// every frame round-trips without leftover bytes.
func TestWritersReadersSymmetry_NoLeftovers(t *testing.T) {
	cases := []*Message{
		newEventMessage(EventType_StartConnection, "", nil),
		newEventMessage(EventType_StartSession, "sid-A", []byte(`{"k":"v"}`)),
		newEventMessage(EventType_TaskRequest, "sid-A", []byte(`{"event":200}`)),
		newEventMessage(EventType_FinishSession, "sid-A", nil),
		newEventMessage(EventType_FinishConnection, "", nil),
	}
	for i, src := range cases {
		frame, err := src.Marshal()
		if err != nil {
			t.Fatalf("case %d marshal: %v", i, err)
		}
		// NewMessageFromBytes already enforces "no leftover bytes" via Unmarshal's
		// trailing ReadByte check — that's the symmetry guarantee we rely on.
		if _, err := NewMessageFromBytes(frame); err != nil {
			t.Fatalf("case %d round-trip (likely byte-order mismatch): %v", i, err)
		}
	}
}

// NOTE: combining PositiveSeq | WithEvent flags is intentionally NOT supported
// by Marshal/Unmarshal (the existing code uses == comparisons, not bitwise &).
// Volcengine's v3 protocol does not mix the two flags either: AudioOnly + event
// frames omit sequence, and sequence-tagged audio frames omit event. If a
// future wire format requires both, both writers() and readers() must adopt
// bitwise checks and add a paired writer/reader for sequence-with-event.

// SSE side-channel parser: the handler triggers usage capture on either an
// "event: SessionFinished" line OR a payload containing `"event":152`. Both
// shapes occur in the wild.
func TestSSESideChannel_DetectsUsage(t *testing.T) {
	// Replicate the minimum branching logic used by handleTTSV3HTTPSSE without
	// running an HTTP server: two fake events, second one has the finish marker.
	scenarios := []struct {
		name      string
		eventName string
		dataJSON  string
		want      int
	}{
		{
			name:      "explicit event name",
			eventName: "SessionFinished",
			dataJSON:  `{"status_code":20000000,"message":"ok","usage":{"text_words":11}}`,
			want:      11,
		},
		{
			name:      "embedded event:152",
			eventName: "tts_response",
			dataJSON:  `{"event":152,"usage":{"text_words":5}}`,
			want:      5,
		},
		{
			name:      "no usage",
			eventName: "tts_response",
			dataJSON:  `{"event":352,"data":"AAA"}`,
			want:      0,
		},
	}
	for _, sc := range scenarios {
		t.Run(sc.name, func(t *testing.T) {
			var captured int
			match := strings.TrimSpace(sc.eventName) == "SessionFinished" || strings.Contains(sc.dataJSON, "\"event\":152")
			if match {
				if env := parseV3SessionResult([]byte(sc.dataJSON)); env != nil && env.Usage != nil {
					captured = env.Usage.TextWords
				}
			}
			if captured != sc.want {
				t.Fatalf("captured=%d want=%d", captured, sc.want)
			}
		})
	}
}

// Auth header construction: new console mode emits X-Api-Key only; legacy mode
// emits X-Api-App-Id + X-Api-Access-Key.
func TestBuildV3Headers_Modes(t *testing.T) {
	const key = "12345|secret-token"

	t.Run("new_console default", func(t *testing.T) {
		h, err := buildV3Headers(volcCfg("", "seed-tts-2.0", "", nil), key, "cid-1")
		if err != nil {
			t.Fatalf("build: %v", err)
		}
		if h.Get("X-Api-Key") != "secret-token" {
			t.Fatalf("X-Api-Key wrong: %q", h.Get("X-Api-Key"))
		}
		if h.Get("X-Api-App-Id") != "" || h.Get("X-Api-Access-Key") != "" {
			t.Fatalf("legacy headers must be absent in new_console mode")
		}
		if h.Get("X-Api-Resource-Id") != "seed-tts-2.0" {
			t.Fatalf("resource id wrong: %q", h.Get("X-Api-Resource-Id"))
		}
		if h.Get("X-Api-Connect-Id") != "cid-1" {
			t.Fatalf("connect id wrong")
		}
		if h.Get("X-Control-Require-Usage-Tokens-Return") != "*" {
			t.Fatalf("usage control flag missing")
		}
	})

	t.Run("legacy", func(t *testing.T) {
		h, err := buildV3Headers(volcCfg("legacy", "", "legacy", nil), key, "cid-2")
		if err != nil {
			t.Fatalf("build: %v", err)
		}
		if h.Get("X-Api-App-Id") != "12345" || h.Get("X-Api-Access-Key") != "secret-token" {
			t.Fatalf("legacy headers wrong: app=%q access=%q",
				h.Get("X-Api-App-Id"), h.Get("X-Api-Access-Key"))
		}
		if h.Get("X-Api-Key") != "" {
			t.Fatalf("X-Api-Key must be absent in legacy mode")
		}
		// Default resource id when blank — must align with the default
		// OpenAI->Volcengine voice map (alloy/echo/... -> *_mars_bigtts, v1.0).
		if h.Get("X-Api-Resource-Id") != dto.VolcTTSDefaultResourceID {
			t.Fatalf("default resource id wrong: got %q want %q",
				h.Get("X-Api-Resource-Id"), dto.VolcTTSDefaultResourceID)
		}
	})

	t.Run("usage opt-out", func(t *testing.T) {
		off := false
		h, err := buildV3Headers(volcCfg("", "", "", &off), key, "cid-3")
		if err != nil {
			t.Fatalf("build: %v", err)
		}
		if h.Get("X-Control-Require-Usage-Tokens-Return") != "" {
			t.Fatalf("usage control flag must be absent when require_usage=false")
		}
	})

	t.Run("new_console single-segment key", func(t *testing.T) {
		// new-console flow: operator pastes the API Key as a single string
		// (no `|` separator). It MUST be sent verbatim as X-Api-Key.
		h, err := buildV3Headers(volcCfg("", "seed-tts-2.0", "", nil), "console-issued-key-XYZ", "cid-1b")
		if err != nil {
			t.Fatalf("build: %v", err)
		}
		if h.Get("X-Api-Key") != "console-issued-key-XYZ" {
			t.Fatalf("single-segment key not forwarded verbatim: %q", h.Get("X-Api-Key"))
		}
		if h.Get("X-Api-App-Id") != "" || h.Get("X-Api-Access-Key") != "" {
			t.Fatalf("legacy headers must be absent for single-segment key")
		}
	})

	t.Run("new_console with legacy-format key takes second segment", func(t *testing.T) {
		h, err := buildV3Headers(volcCfg("", "", "", nil), "12345|legacy-token", "cid-1c")
		if err != nil {
			t.Fatalf("build: %v", err)
		}
		// Backwards-compat: when operator pasted "appid|token" but selected
		// new_console, we still pick the second segment so older configs keep
		// roughly working (the upstream may still 401 if the access_token is
		// not a valid X-Api-Key, which is a separate documented caveat).
		if h.Get("X-Api-Key") != "legacy-token" {
			t.Fatalf("expected second segment as X-Api-Key, got %q", h.Get("X-Api-Key"))
		}
	})

	t.Run("legacy mode rejects single-segment key", func(t *testing.T) {
		if _, err := buildV3Headers(volcCfg("legacy", "", "legacy", nil), "no-pipe-here", "cid-4"); err == nil {
			t.Fatalf("expected error: legacy mode requires app_id|access_token")
		}
	})

	t.Run("empty key rejected", func(t *testing.T) {
		if _, err := buildV3Headers(volcCfg("", "", "", nil), "  ", "cid-5"); err == nil {
			t.Fatalf("expected error for empty key")
		}
	})
}

func volcCfg(protocol, resource, auth string, requireUsage *bool) dto.VolcTTSConfig {
	return dto.VolcTTSConfig{
		Protocol:     protocol,
		ResourceID:   resource,
		AuthMode:     auth,
		RequireUsage: requireUsage,
	}
}

// Helper for assertions involving binary.BigEndian (kept to mirror the wire
// format spec in case future tests need raw int32 inspection).
var _ = binary.BigEndian
