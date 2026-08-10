package service

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/require"
)

func imageMessage(urls ...string) dto.Message {
	parts := make([]dto.MediaContent, 0, len(urls))
	for _, u := range urls {
		url := u // capture loop variable
		parts = append(parts, dto.MediaContent{Type: dto.ContentTypeImageURL, ImageUrl: &dto.MessageImageUrl{Url: url}})
	}
	m := dto.Message{Role: "user"}
	m.SetMediaContent(parts)
	return m
}

// imageMessageWithPointerType constructs a message with pointer-type ImageUrl,
// which is what ParseContent() produces from inbound JSON requests.
func imageMessageWithPointerType(urls ...string) dto.Message {
	parts := make([]dto.MediaContent, 0, len(urls))
	for _, u := range urls {
		url := u // capture loop variable
		parts = append(parts, dto.MediaContent{Type: dto.ContentTypeImageURL, ImageUrl: &dto.MessageImageUrl{Url: url}})
	}
	m := dto.Message{Role: "user"}
	m.SetMediaContent(parts)
	return m
}

func TestImageHashesReturnsOneHashPerDistinctImage(t *testing.T) {
	msgs := []dto.Message{imageMessage("data:image/png;base64,AAAA", "data:image/png;base64,BBBB")}

	require.Len(t, ImageHashes(msgs), 2)
}

// A document operation re-sends the same image every turn. Counting those again
// would make a 100-image allowance mean four documents.
func TestImageHashesDedupesTheSameImageAcrossTurns(t *testing.T) {
	msgs := []dto.Message{
		imageMessage("data:image/png;base64,AAAA"),
		imageMessage("data:image/png;base64,AAAA"),
		imageMessage("data:image/png;base64,AAAA"),
	}

	require.Len(t, ImageHashes(msgs), 1)
}

func TestImageHashesIsStableForTheSameBytes(t *testing.T) {
	a := ImageHashes([]dto.Message{imageMessage("data:image/png;base64,AAAA")})
	b := ImageHashes([]dto.Message{imageMessage("data:image/png;base64,AAAA")})

	require.Equal(t, a, b, "a retry must hash identically or it would count twice")
	require.Len(t, a[0], 64, "SHA-256 hex")
}

func TestImageHashesIgnoresTextOnlyMessages(t *testing.T) {
	m := dto.Message{Role: "user"}
	m.SetStringContent("just text")

	require.Empty(t, ImageHashes([]dto.Message{m}))
}

func TestImageHashesSkipsEmptyUrls(t *testing.T) {
	require.Empty(t, ImageHashes([]dto.Message{imageMessage("")}))
}

// Production requests yield pointer-type ImageUrl via ParseContent(). This test
// ensures the production shape works end-to-end.
func TestImageHashesHandlesProductionPointerType(t *testing.T) {
	msgs := []dto.Message{imageMessageWithPointerType("data:image/png;base64,AAAA", "data:image/png;base64,BBBB")}

	hashes := ImageHashes(msgs)
	require.Len(t, hashes, 2)
	require.Len(t, hashes[0], 64, "SHA-256 hex")
	require.Len(t, hashes[1], 64, "SHA-256 hex")
	require.NotEqual(t, hashes[0], hashes[1], "different images must have different hashes")
}

// Deduplication must work across both struct and pointer representations.
func TestImageHashesDedupesPointerTypeAcrossTurns(t *testing.T) {
	msgs := []dto.Message{
		imageMessageWithPointerType("data:image/png;base64,AAAA"),
		imageMessageWithPointerType("data:image/png;base64,AAAA"),
	}

	require.Len(t, ImageHashes(msgs), 1)
}
