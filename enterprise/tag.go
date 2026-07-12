/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
package enterprise

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func createTag(c *gin.Context) {
	var request createTagRequest
	if err := c.ShouldBindJSON(&request); err != nil || strings.TrimSpace(request.Name) == "" || len([]rune(request.Name)) > 64 {
		failureI18n(c, http.StatusBadRequest, i18n.MsgEnterpriseInvalidTag)
		return
	}
	tag := Tag{EnterpriseId: enterpriseID(c), Name: strings.TrimSpace(request.Name), CreatedTime: now()}
	if err := model.DB.Create(&tag).Error; err != nil {
		if isDuplicateError(err) {
			failureI18n(c, http.StatusBadRequest, i18n.MsgEnterpriseTagExists)
			return
		}
		failureI18n(c, http.StatusInternalServerError, i18n.MsgEnterpriseTagCreateFailed)
		return
	}
	success(c, tag)
}

func listTags(c *gin.Context) {
	var tags []Tag
	if err := model.DB.Where("enterprise_id = ?", enterpriseID(c)).Order("name ASC").Find(&tags).Error; err != nil {
		failureI18n(c, http.StatusInternalServerError, i18n.MsgEnterpriseTagListFailed)
		return
	}
	success(c, tags)
}

func deleteTag(c *gin.Context) {
	tagID, ok := parseID(c, "id")
	if !ok {
		return
	}
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		result := tx.Where("id = ? AND enterprise_id = ?", tagID, enterpriseID(c)).Delete(&Tag{})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return tx.Where("tag_id = ?", tagID).Delete(&MemberTag{}).Error
	})
	if err != nil {
		writeEnterpriseError(c, err)
		return
	}
	success(c, gin.H{"id": tagID})
}

func assignTags(c *gin.Context) {
	userID, ok := parseID(c, "uid")
	if !ok {
		return
	}
	var request assignTagsRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		failureI18n(c, http.StatusBadRequest, i18n.MsgEnterpriseTagAssignInvalid)
		return
	}
	tagIDs := []int{}
	var err error
	if len(request.TagIds) > 0 {
		tagIDs, err = sortedUniqueIDs(request.TagIds)
		if err != nil {
			memberIDError(c, err)
			return
		}
	}
	err = model.DB.Transaction(func(tx *gorm.DB) error {
		member, err := memberForUser(tx, enterpriseID(c), userID)
		if err != nil {
			return err
		}
		if len(tagIDs) > 0 {
			var count int64
			if err := tx.Model(&Tag{}).Where("enterprise_id = ? AND id IN ?", enterpriseID(c), tagIDs).Count(&count).Error; err != nil {
				return err
			}
			if count != int64(len(tagIDs)) {
				return gorm.ErrRecordNotFound
			}
			if err := tx.Where("member_id = ? AND tag_id NOT IN ?", member.Id, tagIDs).Delete(&MemberTag{}).Error; err != nil {
				return err
			}
		} else if err := tx.Where("member_id = ?", member.Id).Delete(&MemberTag{}).Error; err != nil {
			return err
		}
		for _, tagID := range tagIDs {
			binding := MemberTag{MemberId: member.Id, TagId: tagID, CreatedTime: now()}
			if err := tx.Where("member_id = ? AND tag_id = ?", member.Id, tagID).FirstOrCreate(&binding).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		writeEnterpriseError(c, err)
		return
	}
	success(c, gin.H{"user_id": userID, "tag_ids": tagIDs})
}

func removeTag(c *gin.Context) {
	userID, ok := parseID(c, "uid")
	if !ok {
		return
	}
	tagID, ok := parseID(c, "tid")
	if !ok {
		return
	}
	member, err := memberForUser(model.DB, enterpriseID(c), userID)
	if err != nil {
		writeEnterpriseError(c, err)
		return
	}
	result := model.DB.Where("member_id = ? AND tag_id = ?", member.Id, tagID).Delete(&MemberTag{})
	if result.Error != nil {
		failureI18n(c, http.StatusInternalServerError, i18n.MsgEnterpriseTagRemoveFailed)
		return
	}
	success(c, gin.H{"user_id": userID, "tag_id": tagID})
}
