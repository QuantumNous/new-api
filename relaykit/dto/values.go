package dto

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math/big"
	"strconv"

	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
)

type StringValue string

func (s *StringValue) UnmarshalJSON(data []byte) error {
	var str string
	if err := kitutil.Unmarshal(data, &str); err == nil {
		*s = StringValue(str)
		return nil
	}

	var raw json.Number
	if err := kitutil.Unmarshal(data, &raw); err == nil {
		*s = StringValue(raw.String())
		return nil
	}

	return kitutil.Unmarshal(data, &str)
}

func (s StringValue) MarshalJSON() ([]byte, error) {
	return kitutil.Marshal(string(s))
}

type IntValue int

func (i *IntValue) UnmarshalJSON(b []byte) error {
	var n int
	if err := kitutil.Unmarshal(b, &n); err == nil {
		*i = IntValue(n)
		return nil
	}
	var s string
	if err := kitutil.Unmarshal(b, &s); err != nil {
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
	return kitutil.Marshal(int(i))
}

// UnixTimestamp accepts integer and scientific-notation JSON timestamps while
// preserving an integer Unix timestamp for downstream consumers.
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
	rational, ok := new(big.Rat).SetString(n.String())
	if !ok {
		return fmt.Errorf("invalid timestamp %s", n.String())
	}
	i := new(big.Int).Quo(rational.Num(), rational.Denom())
	if !i.IsInt64() {
		return fmt.Errorf("timestamp %s is out of int64 range", n.String())
	}
	*t = UnixTimestamp(i.Int64())
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
	if err := kitutil.Unmarshal(data, &boolean); err == nil {
		*b = BoolValue(boolean)
		return nil
	}
	var str string
	if err := kitutil.Unmarshal(data, &str); err != nil {
		return err
	}
	if str == "true" {
		*b = BoolValue(true)
	} else if str == "false" {
		*b = BoolValue(false)
	} else {
		return kitutil.Unmarshal(data, &boolean)
	}
	return nil
}
func (b BoolValue) MarshalJSON() ([]byte, error) {
	return kitutil.Marshal(bool(b))
}
