package dto

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strconv"
)

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

type UnixTimestamp int64

func (t *UnixTimestamp) UnmarshalJSON(data []byte) error {
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 || bytes.Equal(trimmed, []byte("null")) {
		return nil
	}
	if trimmed[0] == '"' {
		return fmt.Errorf("timestamp must be json number, got string")
	}

	var n json.Number
	if err := json.Unmarshal(trimmed, &n); err != nil {
		return err
	}
	if i, err := n.Int64(); err == nil {
		*t = UnixTimestamp(i)
		return nil
	}
	f, err := n.Float64()
	if err != nil {
		return err
	}
	*t = UnixTimestamp(int64(f))
	return nil
}

func (t UnixTimestamp) MarshalJSON() ([]byte, error) {
	return json.Marshal(int64(t))
}

func (t UnixTimestamp) Int64() int64 {
	return int64(t)
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
