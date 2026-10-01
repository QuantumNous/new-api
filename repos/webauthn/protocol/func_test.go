package protocol

import (
	"errors"
	"regexp"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func AssertIsProtocolError(t *testing.T, err error, errType, errDetails, errInfo any) {
	var e *Error

	require.True(t, errors.As(err, &e))

	switch et := errType.(type) {
	case string:
		assert.Equal(t, et, e.Type)
	case *regexp.Regexp:
		assert.Regexp(t, et, e.Type)
	default:
		t.Fatalf("%T is not a known type", errType)
	}

	switch ed := errDetails.(type) {
	case string:
		assert.Equal(t, ed, e.Details)
	case *regexp.Regexp:
		assert.Regexp(t, ed, e.Details)
	default:
		t.Fatalf("%T is not a known type", errDetails)
	}

	switch ed := errInfo.(type) {
	case string:
		assert.Equal(t, ed, e.DevInfo)
	case *regexp.Regexp:
		assert.Regexp(t, ed, e.DevInfo)
	default:
		t.Fatalf("%T is not a known type", errInfo)
	}
}
