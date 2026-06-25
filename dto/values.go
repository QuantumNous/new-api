package dto

import (
	"encoding/json"
	"fmt"
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
	// 1. Try direct bool (true/false)
	var boolean bool
	if err := json.Unmarshal(data, &boolean); err == nil {
		*b = BoolValue(boolean)
		return nil
	}

	// 2. Try as number (1 / 0 / 1.0 etc)
	var num json.Number
	if err := json.Unmarshal(data, &num); err == nil {
		if i, err := num.Int64(); err == nil {
			*b = BoolValue(i != 0)
			return nil
		}
		if f, err := num.Float64(); err == nil {
			*b = BoolValue(f != 0)
			return nil
		}
	}

	// 3. Try as string ("true", "false", "1", "0", "yes"...)
	var str string
	if err := json.Unmarshal(data, &str); err != nil {
		// last resort: force bool
		return json.Unmarshal(data, &boolean)
	}
	ls := strings.ToLower(strings.TrimSpace(str))
	switch ls {
	case "1", "true", "yes", "on":
		*b = BoolValue(true)
		return nil
	case "0", "false", "no", "off", "":
		*b = BoolValue(false)
		return nil
	}

	// try parse the string as number
	if i, err := strconv.ParseInt(ls, 10, 64); err == nil {
		*b = BoolValue(i != 0)
		return nil
	}
	if f, err := strconv.ParseFloat(ls, 64); err == nil {
		*b = BoolValue(f != 0)
		return nil
	}

	// fallback
	if err := json.Unmarshal(data, &boolean); err == nil {
		*b = BoolValue(boolean)
		return nil
	}
	return fmt.Errorf("cannot parse %q as bool", str)
}
func (b BoolValue) MarshalJSON() ([]byte, error) {
	return json.Marshal(bool(b))
}
