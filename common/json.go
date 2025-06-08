package common

import (
	"bytes"
	"unsafe"

	jsoniter "github.com/json-iterator/go"
)

var (
	// Create a custom jsoniter instance with fault-tolerant configuration
	tolerantJson = jsoniter.Config{
		EscapeHTML:             false,
		SortMapKeys:            false,
		ValidateJsonRawMessage: true,
		UseNumber:              false,
		DisallowUnknownFields:  false,
		TagKey:                 "json",
		OnlyTaggedField:        false,
		CaseSensitive:          true,
	}.Froze()
)

func init() {
	// Register a custom decoder for int64 fields that can handle float64 inputs
	jsoniter.RegisterTypeDecoder("int64", &int64Decoder{})
}

// int64Decoder is a custom decoder that can handle float64 to int64 conversion
type int64Decoder struct{}

func (decoder *int64Decoder) Decode(ptr unsafe.Pointer, iter *jsoniter.Iterator) {
	switch iter.WhatIsNext() {
	case jsoniter.NumberValue:
		// Try to read as float64 first, then convert to int64
		floatVal := iter.ReadFloat64()
		*(*int64)(ptr) = int64(floatVal)
	case jsoniter.StringValue:
		// Handle string numbers
		str := iter.ReadString()
		if num := jsoniter.Get([]byte(str)); num.ValueType() == jsoniter.NumberValue {
			*(*int64)(ptr) = int64(num.ToFloat64())
		} else {
			iter.ReportError("decode int64", "invalid number format: "+str)
		}
	default:
		iter.ReportError("decode int64", "expect number or string")
	}
}

func DecodeJson(data []byte, v any) error {
	return tolerantJson.NewDecoder(bytes.NewReader(data)).Decode(v)
}

func DecodeJsonStr(data string, v any) error {
	return tolerantJson.UnmarshalFromString(data, v)
}

func EncodeJson(v any) ([]byte, error) {
	return tolerantJson.Marshal(v)
}
