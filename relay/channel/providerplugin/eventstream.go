package providerplugin

import (
	"encoding/binary"
	"errors"
	"fmt"
	"hash/crc32"
	"io"
	"strings"

	"github.com/QuantumNous/new-api/pkg/jsplugin"
)

// eventStreamContentType is the media type of an AWS event stream.
const eventStreamContentType = "application/vnd.amazon.eventstream"

// eventStreamPreludeBytes is the prelude of an event stream message: its
// total length, its headers length and the prelude CRC. The message CRC
// follows the payload.
const eventStreamPreludeBytes = 12

var errEventStreamFraming = errors.New("invalid upstream event stream framing")

// eventStreamReader decodes an AWS event stream: each message is a prelude,
// typed headers, a payload and a CRC32 over the whole message.
type eventStreamReader struct {
	reader io.Reader
	limit  int
}

// next reads one message as convertStreamEvent gets it: event is the
// :event-type header, or :exception-type or :error-code for an exception or
// an error, and data the payload as text. more is false at the end of the
// stream; a bad length or CRC fails it.
func (r *eventStreamReader) next() (jsplugin.StreamEvent, bool, error) {
	prelude := make([]byte, eventStreamPreludeBytes)
	if n, err := io.ReadFull(r.reader, prelude); err != nil {
		if errors.Is(err, io.EOF) && n == 0 {
			return jsplugin.StreamEvent{}, false, nil
		}
		if errors.Is(err, io.ErrUnexpectedEOF) {
			return jsplugin.StreamEvent{}, false, fmt.Errorf("%w: truncated message", errEventStreamFraming)
		}
		return jsplugin.StreamEvent{}, false, err
	}
	totalLength := int(binary.BigEndian.Uint32(prelude[0:4]))
	headersLength := int(binary.BigEndian.Uint32(prelude[4:8]))
	if crc32.ChecksumIEEE(prelude[:8]) != binary.BigEndian.Uint32(prelude[8:12]) {
		return jsplugin.StreamEvent{}, false, fmt.Errorf("%w: prelude CRC mismatch", errEventStreamFraming)
	}
	if totalLength < eventStreamPreludeBytes+4 || headersLength > totalLength-eventStreamPreludeBytes-4 {
		return jsplugin.StreamEvent{}, false, fmt.Errorf("%w: bad message length", errEventStreamFraming)
	}
	if totalLength > r.limit {
		return jsplugin.StreamEvent{}, false, fmt.Errorf("upstream event stream message exceeds %d bytes", r.limit)
	}
	message := make([]byte, totalLength)
	copy(message, prelude)
	if _, err := io.ReadFull(r.reader, message[eventStreamPreludeBytes:]); err != nil {
		if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
			return jsplugin.StreamEvent{}, false, fmt.Errorf("%w: truncated message", errEventStreamFraming)
		}
		return jsplugin.StreamEvent{}, false, err
	}
	if crc32.ChecksumIEEE(message[:totalLength-4]) != binary.BigEndian.Uint32(message[totalLength-4:]) {
		return jsplugin.StreamEvent{}, false, fmt.Errorf("%w: message CRC mismatch", errEventStreamFraming)
	}
	headers, err := eventStreamHeaders(message[eventStreamPreludeBytes : eventStreamPreludeBytes+headersLength])
	if err != nil {
		return jsplugin.StreamEvent{}, false, err
	}
	event := headers[":event-type"]
	switch headers[":message-type"] {
	case "exception":
		event = headers[":exception-type"]
	case "error":
		event = headers[":error-code"]
	}
	payload := message[eventStreamPreludeBytes+headersLength : totalLength-4]
	data := string(payload)
	if len(payload) == 0 && headers[":message-type"] == "error" {
		data = headers[":error-message"]
	}
	return jsplugin.StreamEvent{Event: strings.TrimSpace(event), Data: data}, true, nil
}

// eventStreamHeaders reads the string headers of a message and skips the
// values of the other types.
func eventStreamHeaders(raw []byte) (map[string]string, error) {
	headers := make(map[string]string)
	for len(raw) > 0 {
		nameLength := int(raw[0])
		if len(raw) < 1+nameLength+1 {
			return nil, fmt.Errorf("%w: truncated header", errEventStreamFraming)
		}
		name := string(raw[1 : 1+nameLength])
		valueType := raw[1+nameLength]
		raw = raw[2+nameLength:]
		size := 0
		switch valueType {
		case 0, 1: // boolean true, false
		case 2: // byte
			size = 1
		case 3: // short
			size = 2
		case 4: // integer
			size = 4
		case 5, 8: // long, timestamp
			size = 8
		case 9: // uuid
			size = 16
		case 6, 7: // bytes, string
			if len(raw) < 2 {
				return nil, fmt.Errorf("%w: truncated header", errEventStreamFraming)
			}
			length := int(binary.BigEndian.Uint16(raw[:2]))
			if len(raw) < 2+length {
				return nil, fmt.Errorf("%w: truncated header", errEventStreamFraming)
			}
			if valueType == 7 {
				headers[name] = string(raw[2 : 2+length])
			}
			raw = raw[2+length:]
			continue
		default:
			return nil, fmt.Errorf("%w: unknown header type %d", errEventStreamFraming, valueType)
		}
		if len(raw) < size {
			return nil, fmt.Errorf("%w: truncated header", errEventStreamFraming)
		}
		raw = raw[size:]
	}
	return headers, nil
}
