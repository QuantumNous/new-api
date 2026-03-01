package controller

import (
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/go-fuego/fuego"
)

// GetAllVendors 获取供应商列表（分页）
func GetAllVendors(c fuego.ContextNoBody) (*dto.Response[dto.PageData[*model.Vendor]], error) {
	pageInfo := dto.PageInfo(c)
	vendors, err := model.GetAllVendors(pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		return dto.FailPage[*model.Vendor](err.Error())
	}
	var total int64
	model.DB.Model(&model.Vendor{}).Count(&total)
	return dto.OkPage(pageInfo, vendors, int(total))
}

// SearchVendors 搜索供应商
func SearchVendors(c fuego.ContextWithParams[dto.SearchVendorsParams]) (*dto.Response[dto.PageData[*model.Vendor]], error) {
	p, _ := dto.ParseParams[dto.SearchVendorsParams](c)
	pageInfo := dto.PageInfo(c)
	vendors, total, err := model.SearchVendors(p.Keyword, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		return dto.FailPage[*model.Vendor](err.Error())
	}
	return dto.OkPage(pageInfo, vendors, int(total))
}

// GetVendorMeta 根据 ID 获取供应商
func GetVendorMeta(c fuego.ContextNoBody) (*dto.Response[model.Vendor], error) {
	id, err := c.PathParamIntErr("id")
	if err != nil {
		return dto.Fail[model.Vendor](err.Error())
	}
	v, err := model.GetVendorByID(id)
	if err != nil {
		return dto.Fail[model.Vendor](err.Error())
	}
	return dto.Ok(*v)
}

// CreateVendorMeta 新建供应商
func CreateVendorMeta(c fuego.ContextWithBody[model.Vendor]) (*dto.Response[model.Vendor], error) {
	v, err := c.Body()
	if err != nil {
		return dto.Fail[model.Vendor](err.Error())
	}
	if v.Name == "" {
		return dto.Fail[model.Vendor]("供应商名称不能为空")
	}
	// 创建前先检查名称
	if dup, err := model.IsVendorNameDuplicated(0, v.Name); err != nil {
		return dto.Fail[model.Vendor](err.Error())
	} else if dup {
		return dto.Fail[model.Vendor]("供应商名称已存在")
	}

	if err := v.Insert(); err != nil {
		return dto.Fail[model.Vendor](err.Error())
	}
	return dto.Ok(v)
}

// UpdateVendorMeta 更新供应商
func UpdateVendorMeta(c fuego.ContextWithBody[model.Vendor]) (*dto.Response[model.Vendor], error) {
	v, err := c.Body()
	if err != nil {
		return dto.Fail[model.Vendor](err.Error())
	}
	if v.Id == 0 {
		return dto.Fail[model.Vendor]("缺少供应商 ID")
	}
	// 名称冲突检查
	if dup, err := model.IsVendorNameDuplicated(v.Id, v.Name); err != nil {
		return dto.Fail[model.Vendor](err.Error())
	} else if dup {
		return dto.Fail[model.Vendor]("供应商名称已存在")
	}

	if err := v.Update(); err != nil {
		return dto.Fail[model.Vendor](err.Error())
	}
	return dto.Ok(v)
}

// DeleteVendorMeta 删除供应商
func DeleteVendorMeta(c fuego.ContextNoBody) (dto.MessageResponse, error) {
	id, err := c.PathParamIntErr("id")
	if err != nil {
		return dto.FailMsg(err.Error())
	}
	if err := model.DB.Delete(&model.Vendor{}, id).Error; err != nil {
		return dto.FailMsg(err.Error())
	}
	return dto.Msg("")
}
