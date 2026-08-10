package service

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/require"
)

func imageMessage(urls ...string) dto.Message {
	parts := make([]dto.MediaContent, 0, len(urls))
	for _, u := range urls {
		parts = append(parts, dto.MediaContent{Type: dto.ContentTypeImageURL, ImageUrl: dto.MessageImageUrl{Url: u}})
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
