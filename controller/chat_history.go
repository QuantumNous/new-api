/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// GetChatSessions returns all chat sessions for the current user
func GetChatSessions(c *gin.Context) {
	userID := c.GetInt("id")
	sessions, err := model.GetChatSessionsByUserID(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to get chat sessions",
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    sessions,
	})
}

// CreateChatSession creates a new chat session
func CreateChatSession(c *gin.Context) {
	userID := c.GetInt("id")

	var req struct {
		Title string `json:"title"`
		Model string `json:"model"`
		Group string `json:"group"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid request",
		})
		return
	}

	now := common.GetTimestamp()
	session := &model.ChatSession{
		ID:        uuid.New().String(),
		UserID:    userID,
		Title:     req.Title,
		Model:     req.Model,
		GroupName: req.Group,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := model.CreateChatSession(session); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to create chat session",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    session,
	})
}

// GetChatMessages returns all messages for a chat session
func GetChatMessages(c *gin.Context) {
	userID := c.GetInt("id")
	sessionID := c.Param("id")

	messages, err := model.GetChatMessagesBySessionID(sessionID, userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "Chat session not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    messages,
	})
}

// UpdateChatSessionTitle updates the title of a chat session
func UpdateChatSessionTitle(c *gin.Context) {
	userID := c.GetInt("id")
	sessionID := c.Param("id")

	var req struct {
		Title string `json:"title"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid request",
		})
		return
	}

	if err := model.UpdateChatSessionTitle(sessionID, userID, req.Title); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to update chat session",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
	})
}

// DeleteChatSession deletes a chat session
func DeleteChatSession(c *gin.Context) {
	userID := c.GetInt("id")
	sessionID := c.Param("id")

	if err := model.DeleteChatSession(sessionID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to delete chat session",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
	})
}

// SaveChatMessage saves a message to a chat session
func SaveChatMessage(c *gin.Context) {
	userID := c.GetInt("id")
	sessionID := c.Param("id")

	var req struct {
		Role      string `json:"role"`
		Content   string `json:"content"`
		ImageURLs string `json:"image_urls,omitempty"`
		Reasoning string `json:"reasoning,omitempty"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid request",
		})
		return
	}

	message := &model.ChatMessage{
		ID:        uuid.New().String(),
		SessionID: sessionID,
		Role:      req.Role,
		Content:   req.Content,
		ImageURLs: req.ImageURLs,
		Reasoning: req.Reasoning,
		CreatedAt: common.GetTimestamp(),
	}

	if err := model.CreateChatMessage(message, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to save message",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    message,
	})
}
