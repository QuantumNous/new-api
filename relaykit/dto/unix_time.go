package dto

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strconv"

	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
)

// UnixTime stores an OpenAI-protocol Unix timestamp as raw JSON so integers,
// floats, and scientific notation all unmarshal. Empty values marshal as 0.
type UnixTime json.RawMessage

func (t UnixTime) MarshalJSON() ([]byte, error) {
	if UnixTimeEmpty(t) {
		return []byte("0"), nil
	}
	out := make([]byte, len(t))
	copy(out, t)
	return out, nil
}

func (t *UnixTime) UnmarshalJSON(data []byte) error {
	if t == nil {
		return nil
	}
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 || bytes.Equal(trimmed, []byte("null")) {
		*t = nil
		return nil
	}
	if kitutil.GetJsonType(trimmed) != "number" {
		return fmt.Errorf("cannot unmarshal %s into UnixTime", trimmed)
	}
	var n json.Number
	if err := kitutil.Unmarshal(trimmed, &n); err != nil {
		return fmt.Errorf("cannot unmarshal %s into UnixTime", trimmed)
	}
	*t = append((*t)[:0], trimmed...)
	return nil
}

// UnixTimeRaw encodes a Unix-second timestamp as a JSON number.
func UnixTimeRaw(sec int64) UnixTime {
	return UnixTime(strconv.FormatInt(sec, 10))
}

// UnixTimeRawNonZero is UnixTimeRaw, or nil when sec is 0 so omitempty fields stay omitted.
func UnixTimeRawNonZero(sec int64) UnixTime {
	if sec == 0 {
		return nil
	}
	return UnixTimeRaw(sec)
}

// UnixTimeEmpty reports whether raw is missing or JSON null.
func UnixTimeEmpty(raw UnixTime) bool {
	trimmed := bytes.TrimSpace(raw)
	return len(trimmed) == 0 || bytes.Equal(trimmed, []byte("null"))
}
