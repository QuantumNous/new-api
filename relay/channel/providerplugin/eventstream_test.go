package providerplugin

import (
	"bytes"
	"encoding/binary"
	"hash/crc32"
	"io"
	"testing"

	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// eventStreamMessage encodes one AWS event stream message with string
// headers.
func eventStreamMessage(headers [][2]string, payload string) []byte {
	var encoded bytes.Buffer
	for _, header := range headers {
		encoded.WriteByte(byte(len(header[0])))
		encoded.WriteString(header[0])
		encoded.WriteByte(7)
		_ = binary.Write(&encoded, binary.BigEndian, uint16(len(header[1])))
		encoded.WriteString(header[1])
	}
	total := eventStreamPreludeBytes + encoded.Len() + len(payload) + 4
	message := make([]byte, 0, total)
	message = binary.BigEndian.AppendUint32(message, uint32(total))
	message = binary.BigEndian.AppendUint32(message, uint32(encoded.Len()))
	message = binary.BigEndian.AppendUint32(message, crc32.ChecksumIEEE(message))
	message = append(message, encoded.Bytes()...)
	message = append(message, payload...)
	return binary.BigEndian.AppendUint32(message, crc32.ChecksumIEEE(message))
}

func TestEventStreamReaderDecodesMessages(t *testing.T) {
	var stream bytes.Buffer
	stream.Write(eventStreamMessage([][2]string{{":message-type", "event"}, {":event-type", "chunk"}, {":content-type", "application/json"}}, `{"bytes":"aGk="}`))
	stream.Write(eventStreamMessage([][2]string{{":message-type", "exception"}, {":exception-type", "throttlingException"}}, `{"message":"slow down"}`))
	stream.Write(eventStreamMessage([][2]string{{":message-type", "error"}, {":error-code", "InternalFailure"}, {":error-message", "boom"}}, ""))
	reader := &eventStreamReader{reader: &stream, limit: 1 << 20}

	var events []jsplugin.StreamEvent
	for {
		event, more, err := reader.next()
		require.NoError(t, err)
		if !more {
			break
		}
		events = append(events, event)
	}
	assert.Equal(t, []jsplugin.StreamEvent{
		{Event: "chunk", Data: `{"bytes":"aGk="}`},
		{Event: "throttlingException", Data: `{"message":"slow down"}`},
		{Event: "InternalFailure", Data: "boom"},
	}, events)
}

func TestEventStreamReaderRejectsBadFraming(t *testing.T) {
	valid := eventStreamMessage([][2]string{{":event-type", "chunk"}}, "payload")
	read := func(stream []byte, limit int) error {
		reader := &eventStreamReader{reader: bytes.NewReader(stream), limit: limit}
		for {
			_, more, err := reader.next()
			if err != nil || !more {
				return err
			}
		}
	}
	require.NoError(t, read(valid, 1<<20))

	badMessageCRC := bytes.Clone(valid)
	badMessageCRC[len(badMessageCRC)-1] ^= 0xff
	assert.ErrorIs(t, read(badMessageCRC, 1<<20), errEventStreamFraming)
	assert.ErrorContains(t, read(badMessageCRC, 1<<20), "message CRC mismatch")

	badPayload := bytes.Clone(valid)
	badPayload[len(badPayload)-6] ^= 0xff
	assert.ErrorContains(t, read(badPayload, 1<<20), "message CRC mismatch", "the CRC covers the payload")

	badPreludeCRC := bytes.Clone(valid)
	badPreludeCRC[0] ^= 0x01
	assert.ErrorContains(t, read(badPreludeCRC, 1<<20), "prelude CRC mismatch")

	assert.ErrorContains(t, read(valid[:len(valid)-3], 1<<20), "truncated message")
	assert.ErrorContains(t, read(valid[:5], 1<<20), "truncated message")
	assert.ErrorContains(t, read(valid, len(valid)-1), "exceeds")

	_, _, err := (&eventStreamReader{reader: io.MultiReader(bytes.NewReader(valid), bytes.NewReader(valid[:4])), limit: 1 << 20}).next()
	require.NoError(t, err, "the first message reads before the broken one")
}
