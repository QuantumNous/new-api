package controller

import (
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/go-fuego/fuego"
)

// GetPrefillGroups 获取预填组列表，可通过 ?type=xxx 过滤
func GetPrefillGroups(c fuego.ContextWithParams[dto.GetPrefillGroupsParams]) (*dto.Response[[]*model.PrefillGroup], error) {
	p, _ := dto.ParseParams[dto.GetPrefillGroupsParams](c)
	groups, err := model.GetAllPrefillGroups(p.Type)
	if err != nil {
		return dto.Fail[[]*model.PrefillGroup](err.Error())
	}
	return dto.Ok(groups)
}

// CreatePrefillGroup 创建新的预填组
func CreatePrefillGroup(c fuego.ContextWithBody[model.PrefillGroup]) (*dto.Response[model.PrefillGroup], error) {
	g, err := c.Body()
	if err != nil {
		return dto.Fail[model.PrefillGroup](err.Error())
	}
	if g.Name == "" || g.Type == "" {
		return dto.Fail[model.PrefillGroup]("组名称和类型不能为空")
	}
	// 创建前检查名称
	dup, err := model.IsPrefillGroupNameDuplicated(0, g.Name)
	if err != nil {
		return dto.Fail[model.PrefillGroup](err.Error())
	}
	if dup {
		return dto.Fail[model.PrefillGroup]("组名称已存在")
	}

	if err := g.Insert(); err != nil {
		return dto.Fail[model.PrefillGroup](err.Error())
	}
	return dto.Ok(g)
}

// UpdatePrefillGroup 更新预填组
func UpdatePrefillGroup(c fuego.ContextWithBody[model.PrefillGroup]) (*dto.Response[model.PrefillGroup], error) {
	g, err := c.Body()
	if err != nil {
		return dto.Fail[model.PrefillGroup](err.Error())
	}
	if g.Id == 0 {
		return dto.Fail[model.PrefillGroup]("缺少组 ID")
	}
	// 名称冲突检查
	dup, err := model.IsPrefillGroupNameDuplicated(g.Id, g.Name)
	if err != nil {
		return dto.Fail[model.PrefillGroup](err.Error())
	}
	if dup {
		return dto.Fail[model.PrefillGroup]("组名称已存在")
	}

	if err := g.Update(); err != nil {
		return dto.Fail[model.PrefillGroup](err.Error())
	}
	return dto.Ok(g)
}

// DeletePrefillGroup 删除预填组
func DeletePrefillGroup(c fuego.ContextNoBody) (dto.MessageResponse, error) {
	id, err := c.PathParamIntErr("id")
	if err != nil {
		return dto.FailMsg(err.Error())
	}
	if err := model.DeletePrefillGroupByID(id); err != nil {
		return dto.FailMsg(err.Error())
	}
	return dto.Msg("")
}
