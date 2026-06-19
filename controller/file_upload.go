/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
package controller

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/QuantumNous/new-api/service"
)

// Allowed file types
var allowedImageTypes = map[string]bool{
	".png": true, ".jpg": true, ".jpeg": true, ".gif": true, ".webp": true, ".svg": true,
}
var allowedTextTypes = map[string]bool{
	".txt": true, ".md": true, ".csv": true, ".json": true, ".xml": true, ".yaml": true, ".yml": true,
	".log": true, ".py": true, ".js": true, ".ts": true, ".go": true, ".html": true, ".css": true,
}

const maxUploadSize = 10 << 20 // 10 MB

func UploadFile(c *gin.Context) {
	if !service.IsR2Configured() {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"message": "File upload service is not configured",
		})
		return
	}

	// Limit request body size
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxUploadSize)

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": fmt.Sprintf("Failed to read file: %v", err),
		})
		return
	}
	defer file.Close()

	// Validate file extension
	ext := strings.ToLower(filepath.Ext(header.Filename))
	isImage := allowedImageTypes[ext]
	isText := allowedTextTypes[ext]

	if !isImage && !isText {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "File type not allowed. Allowed: images (png, jpg, gif, webp, svg) and text files (txt, md, csv, json, etc.)",
		})
		return
	}

	// Determine content type
	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		if isImage {
			contentType = "image/" + strings.TrimPrefix(ext, ".")
			if ext == ".jpg" {
				contentType = "image/jpeg"
			} else if ext == ".svg" {
				contentType = "image/svg+xml"
			}
		} else {
			contentType = "text/plain"
		}
	}

	// Upload to R2
	fileBytes, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": fmt.Sprintf("Failed to read file content: %v", err),
		})
		return
	}

	publicURL, err := service.UploadToR2(bytes.NewReader(fileBytes), header.Filename, contentType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": fmt.Sprintf("Failed to upload file: %v", err),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"url":          publicURL,
			"filename":     header.Filename,
			"content_type": contentType,
			"is_image":     isImage,
			"size":         header.Size,
		},
	})
}
