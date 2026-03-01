package dto

import (
	"fmt"
	"reflect"
	"strconv"
)

// ParseParams parses query/header params from a fuego context into struct P.
// Fields are matched via `query:"param_name"` and `header:"header_name"` struct tags.
// Supports string, int*, uint*, float*, bool, and slices of those types.
//
// This replicates fuego's netHttpContext.Params() logic because fuegogin's
// Params() is a stub that returns zero values.
func ParseParams[P any](c FuegoCtx) (P, error) {
	p := new(P)

	paramsType := reflect.TypeFor[P]()
	if paramsType.Kind() != reflect.Struct {
		return *p, fmt.Errorf("params must be a struct, got %T", *p)
	}
	paramsValue := reflect.ValueOf(p).Elem()

	for i := range paramsType.NumField() {
		field := paramsType.Field(i)
		fieldValue := paramsValue.Field(i)

		if tag := field.Tag.Get("query"); tag != "" {
			switch field.Type.Kind() {
			case reflect.Slice, reflect.Array:
				paramValues := c.QueryParamArr(tag)
				if len(paramValues) == 0 {
					continue
				}
				sliceType := field.Type.Elem()
				slice := reflect.MakeSlice(field.Type, len(paramValues), len(paramValues))
				for j, paramValue := range paramValues {
					if err := setParamValue(slice.Index(j), paramValue, sliceType.Kind()); err != nil {
						return *p, err
					}
				}
				fieldValue.Set(slice)
			default:
				paramValue := c.QueryParam(tag)
				if paramValue == "" {
					continue
				}
				if err := setParamValue(fieldValue, paramValue, field.Type.Kind()); err != nil {
					return *p, err
				}
			}
		} else if tag := field.Tag.Get("header"); tag != "" {
			paramValue := c.Header(tag)
			if paramValue == "" {
				continue
			}
			if err := setParamValue(fieldValue, paramValue, field.Type.Kind()); err != nil {
				return *p, err
			}
		}
	}

	return *p, nil
}

func setParamValue(value reflect.Value, paramValue string, kind reflect.Kind) error {
	switch kind {
	case reflect.String:
		value.SetString(paramValue)
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		intValue, err := strconv.ParseInt(paramValue, 10, bitSize(kind))
		if err != nil {
			return fmt.Errorf("cannot convert %s to %s: %w", paramValue, kind, err)
		}
		value.SetInt(intValue)
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		uintValue, err := strconv.ParseUint(paramValue, 10, bitSize(kind))
		if err != nil {
			return fmt.Errorf("cannot convert %s to %s: %w", paramValue, kind, err)
		}
		value.SetUint(uintValue)
	case reflect.Float32, reflect.Float64:
		floatValue, err := strconv.ParseFloat(paramValue, bitSize(kind))
		if err != nil {
			return fmt.Errorf("cannot convert %s to %s: %w", paramValue, kind, err)
		}
		value.SetFloat(floatValue)
	case reflect.Bool:
		boolValue, err := strconv.ParseBool(paramValue)
		if err != nil {
			return fmt.Errorf("cannot convert %s to bool: %w", paramValue, err)
		}
		value.SetBool(boolValue)
	default:
		return fmt.Errorf("unsupported type %s", kind)
	}
	return nil
}

func bitSize(kind reflect.Kind) int {
	switch kind {
	case reflect.Uint8, reflect.Int8:
		return 8
	case reflect.Uint16, reflect.Int16:
		return 16
	case reflect.Uint32, reflect.Int32, reflect.Float32:
		return 32
	case reflect.Uint, reflect.Int:
		return strconv.IntSize
	}
	return 64
}
