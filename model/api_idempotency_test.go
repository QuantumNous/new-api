package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAPIIdempotencySchemaScopesKeyByUserRouteAndHash(t *testing.T) {
	db := newBytePlusRealPersonTestDB(t)

	first := APIIdempotencyRecord{
		UserId: 7, Route: "/v1/byteplus/real-person/profiles", KeyHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		RequestHash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
		Status:      APIIdempotencyStatusProcessing,
	}
	require.NoError(t, db.Create(&first).Error)

	sameKeyDifferentRoute := APIIdempotencyRecord{
		UserId: 7, Route: "/v1/byteplus/visual-validation/sessions", KeyHash: first.KeyHash,
		RequestHash: first.RequestHash, Status: APIIdempotencyStatusReceiving,
	}
	require.NoError(t, db.Create(&sameKeyDifferentRoute).Error)

	duplicate := APIIdempotencyRecord{
		UserId: 7, Route: first.Route, KeyHash: first.KeyHash,
		RequestHash: first.RequestHash, Status: APIIdempotencyStatusReceiving,
	}
	require.Error(t, db.Create(&duplicate).Error)
}
