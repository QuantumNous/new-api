package service

import (
	"archive/zip"
	"encoding/base64"
	"io"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
)

func TestCreateCreativeCenterAssetArchiveWithDataURLs(t *testing.T) {
	imageContent := []byte("image-binary")
	videoContent := []byte("video-binary")

	archive, err := CreateCreativeCenterAssetArchive([]*dto.CreativeCenterAsset{
		{
			AssetID:     "cc:image:1:s1:r1:0",
			AssetType:   "image",
			ModelName:   "nano-banana",
			SessionName: "Image Session",
			MediaURL:    "data:image/png;base64," + base64.StdEncoding.EncodeToString(imageContent),
		},
		{
			AssetID:     "cc:video:2:s2:r2:0",
			AssetType:   "video",
			ModelName:   "veo-3",
			SessionName: "Video Session",
			MediaURL:    "data:video/mp4;base64," + base64.StdEncoding.EncodeToString(videoContent),
		},
	}, "")
	if err != nil {
		t.Fatalf("expected archive creation to succeed, got error: %v", err)
	}
	defer CleanupCreativeCenterArchiveFile(archive.FilePath)

	if archive.SuccessCount != 2 {
		t.Fatalf("expected 2 successful assets, got %d", archive.SuccessCount)
	}
	if archive.FailureCount != 0 {
		t.Fatalf("expected 0 failed assets, got %d", archive.FailureCount)
	}

	reader, err := zip.OpenReader(archive.FilePath)
	if err != nil {
		t.Fatalf("failed to open zip: %v", err)
	}
	defer reader.Close()

	if len(reader.File) != 2 {
		t.Fatalf("expected 2 zip entries, got %d", len(reader.File))
	}

	names := []string{reader.File[0].Name, reader.File[1].Name}
	joined := strings.Join(names, ",")
	if !strings.Contains(joined, "image-nano-banana-image-session-1.png") {
		t.Fatalf("expected image file name in archive, got %v", names)
	}
	if !strings.Contains(joined, "video-veo-3-video-session-2.mp4") {
		t.Fatalf("expected video file name in archive, got %v", names)
	}
}

func TestCreateCreativeCenterAssetArchiveKeepsFailuresList(t *testing.T) {
	validContent := []byte("valid-image")
	archive, err := CreateCreativeCenterAssetArchive([]*dto.CreativeCenterAsset{
		{
			AssetID:     "cc:image:1:s1:r1:0",
			AssetType:   "image",
			ModelName:   "nano",
			SessionName: "Session One",
			MediaURL:    "data:image/png;base64," + base64.StdEncoding.EncodeToString(validContent),
		},
		{
			AssetID:     "cc:image:1:s1:r1:1",
			AssetType:   "image",
			ModelName:   "nano",
			SessionName: "Session One",
			MediaURL:    "data:image/png,not-base64",
		},
	}, "")
	if err != nil {
		t.Fatalf("expected partial archive creation to succeed, got error: %v", err)
	}
	defer CleanupCreativeCenterArchiveFile(archive.FilePath)

	if archive.SuccessCount != 1 {
		t.Fatalf("expected 1 successful asset, got %d", archive.SuccessCount)
	}
	if archive.FailureCount != 1 {
		t.Fatalf("expected 1 failed asset, got %d", archive.FailureCount)
	}

	reader, err := zip.OpenReader(archive.FilePath)
	if err != nil {
		t.Fatalf("failed to open zip: %v", err)
	}
	defer reader.Close()

	var hasFailureFile bool
	for _, file := range reader.File {
		if file.Name == "failed-assets.txt" {
			hasFailureFile = true
			rc, openErr := file.Open()
			if openErr != nil {
				t.Fatalf("failed to open failure file: %v", openErr)
			}
			contentBytes, readErr := io.ReadAll(rc)
			rc.Close()
			if readErr != nil {
				t.Fatalf("failed to read failure file: %v", readErr)
			}
			if !strings.Contains(string(contentBytes), "cc:image:1:s1:r1:1") {
				t.Fatalf("expected failed asset id in report, got %s", string(contentBytes))
			}
		}
	}

	if !hasFailureFile {
		t.Fatal("expected failed-assets.txt to exist")
	}
}
