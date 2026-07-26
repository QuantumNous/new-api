package dto

import (
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
)

type StringValue string

func (s *StringValue) UnmarshalJSON(data []byte) error {
	var str string
	if err := json.Unmarshal(data, &str); err == nil {
		*s = StringValue(str)
		return nil
	}

	var raw json.Number
	if err := json.Unmarshal(data, &raw); err == nil {
		*s = StringValue(raw.String())
		return nil
	}

	return json.Unmarshal(data, &str)
}

func (s StringValue) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(s))
}

type IntValue int

func (i *IntValue) UnmarshalJSON(b []byte) error {
	var n int
	if err := json.Unmarshal(b, &n); err == nil {
		*i = IntValue(n)
		return nil
	}
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return err
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return err
	}
	*i = IntValue(v)
	return nil
}

func (i IntValue) MarshalJSON() ([]byte, error) {
	return json.Marshal(int(i))
}

type BoolValue bool

func (b *BoolValue) UnmarshalJSON(data []byte) error {
	var boolean bool
	if err := json.Unmarshal(data, &boolean); err == nil {
		*b = BoolValue(boolean)
		return nil
	}
	var str string
	if err := json.Unmarshal(data, &str); err != nil {
		return err
	}
	if str == "true" {
		*b = BoolValue(true)
	} else if str == "false" {
		*b = BoolValue(false)
	} else {
		return json.Unmarshal(data, &boolean)
	}
	return nil
}
func (b BoolValue) MarshalJSON() ([]byte, error) {
	return json.Marshal(bool(b))
}

// UnixTimestamp stores epoch seconds and accepts integer, float, and numeric string JSON values.
// Fractional values are truncated toward zero.
type UnixTimestamp int64

func (u *UnixTimestamp) UnmarshalJSON(data []byte) error {
	value, err := parseUnixTimestampJSON(data)
	if err != nil {
		return err
	}
	*u = UnixTimestamp(value)
	return nil
}

func (u UnixTimestamp) MarshalJSON() ([]byte, error) {
	return json.Marshal(int64(u))
}

func parseUnixTimestampJSON(data []byte) (int64, error) {
	trimmed := strings.TrimSpace(string(data))
	if trimmed == "" {
		return 0, fmt.Errorf("empty timestamp")
	}
	if trimmed == "null" {
		return 0, nil
	}

	var number json.Number
	if err := json.Unmarshal(data, &number); err == nil {
		if parsed, parseErr := number.Int64(); parseErr == nil {
			return parsed, nil
		}
		parsed, parseErr := strconv.ParseFloat(number.String(), 64)
		if parseErr != nil {
			return 0, parseErr
		}
		if math.IsNaN(parsed) || math.IsInf(parsed, 0) {
			return 0, fmt.Errorf("invalid timestamp number: %s", number.String())
		}
		if parsed >= float64(math.MaxInt64) || parsed < math.MinInt64 {
			return 0, fmt.Errorf("timestamp out of int64 range: %s", number.String())
		}
		return int64(math.Trunc(parsed)), nil
	}

	var str string
	if err := json.Unmarshal(data, &str); err != nil {
		return 0, err
	}
	str = strings.TrimSpace(str)
	if str == "" {
		return 0, fmt.Errorf("empty timestamp string")
	}
	if parsed, err := strconv.ParseInt(str, 10, 64); err == nil {
		return parsed, nil
	}
	parsed, err := strconv.ParseFloat(str, 64)
	if err != nil {
		return 0, err
	}
	if math.IsNaN(parsed) || math.IsInf(parsed, 0) {
		return 0, fmt.Errorf("invalid timestamp string: %s", str)
	}
	if parsed >= float64(math.MaxInt64) || parsed < math.MinInt64 {
		return 0, fmt.Errorf("timestamp out of int64 range: %s", str)
	}
	return int64(math.Trunc(parsed)), nil
}
