package service

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
)

// BackupExportResult 导出结果（包含 ZIP 字节流）。
type BackupExportResult struct {
	ZipBytes   []byte
	Rows       map[string]int
	Categories []dto.BackupCategory
}

// ExportBackup 将选定类别导出为通用 ZIP 包（内含 manifest.json + 各类别 *.json）。
func ExportBackup(req dto.BackupExportRequest) (*BackupExportResult, error) {
	if len(req.Categories) == 0 {
		return nil, fmt.Errorf("at least one category is required")
	}
	rows := make(map[string]int, len(req.Categories))
	for _, c := range req.Categories {
		count, err := backupExportOne(c, req.IncludeSecret, nil)
		if err != nil {
			return nil, fmt.Errorf("export %s: %w", c, err)
		}
		rows[string(c)] = count
	}

	buf := &bytes.Buffer{}
	zw := zip.NewWriter(buf)

	manifest := dto.BackupMeta{
		Version:       common.Version,
		Categories:    req.Categories,
		Timestamp:     time.Now().Unix(),
		Rows:          rows,
		IncludeSecret: req.IncludeSecret,
	}
	if err := writeZipJSON(zw, "manifest.json", manifest); err != nil {
		return nil, err
	}

	for _, c := range req.Categories {
		data, err := backupExportOneAsJSON(c, req.IncludeSecret)
		if err != nil {
			return nil, fmt.Errorf("export %s: %w", c, err)
		}
		if err := writeZipJSON(zw, string(c)+".json", data); err != nil {
			return nil, err
		}
	}
	if err := zw.Close(); err != nil {
		return nil, err
	}

	return &BackupExportResult{
		ZipBytes:   buf.Bytes(),
		Rows:       rows,
		Categories: req.Categories,
	}, nil
}

// BackupImportResult 导入结果汇总。
type BackupImportResult struct {
	Results []dto.BackupImportResult
}

// ImportBackup 从 ZIP 包导入数据。categories 为空表示全部导入。
func ImportBackup(zipBytes []byte, req dto.BackupImportRequest) (*BackupImportResult, error) {
	zr, err := zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
	if err != nil {
		return nil, fmt.Errorf("invalid zip: %w", err)
	}

	files := make(map[dto.BackupCategory][]byte, len(zr.File))
	var manifest dto.BackupMeta
	for _, f := range zr.File {
		if f.FileInfo().IsDir() {
			continue
		}
		name := strings.TrimSuffix(f.Name, ".json")
		if name == "manifest" {
			raw, err := readZipFile(f)
			if err != nil {
				return nil, err
			}
			if err := json.Unmarshal(raw, &manifest); err != nil {
				return nil, fmt.Errorf("invalid manifest.json: %w", err)
			}
			continue
		}
		raw, err := readZipFile(f)
		if err != nil {
			return nil, err
		}
		files[dto.BackupCategory(name)] = raw
	}

	selected := req.Categories
	if len(selected) == 0 {
		for cat := range files {
			selected = append(selected, cat)
		}
	}

	result := &BackupImportResult{}
	for _, cat := range selected {
		raw, ok := files[cat]
		if !ok {
			result.Results = append(result.Results, dto.BackupImportResult{
				Category: string(cat),
				Skipped:  0,
				ErrorMsg: "category not present in backup",
			})
			continue
		}
		imported, skipped, errs, err := backupImportOne(cat, raw, req.SkipExisting, req.OverwriteSecret)
		ir := dto.BackupImportResult{
			Category: string(cat),
			Imported: imported,
			Skipped:  skipped,
			Errors:   errs,
		}
		if err != nil {
			ir.ErrorMsg = err.Error()
		}
		result.Results = append(result.Results, ir)
	}
	return result, nil
}

// =====================================================================
// Per-category export / import dispatch
// =====================================================================

func backupExportOne(cat dto.BackupCategory, includeSecret bool, dst interface{}) (int, error) {
	switch cat {
	case dto.BackupCategoryUsers:
		var users []model.User
		if err := model.DB.Find(&users).Error; err != nil {
			return 0, err
		}
		if !includeSecret {
			for i := range users {
				users[i].Password = ""
			}
		}
		return saveOrCount(users, dst)
	case dto.BackupCategoryChannels:
		var chs []model.Channel
		if err := model.DB.Find(&chs).Error; err != nil {
			return 0, err
		}
		if !includeSecret {
			for i := range chs {
				chs[i].Key = ""
			}
		}
		return saveOrCount(chs, dst)
	case dto.BackupCategoryTokens:
		var toks []model.Token
		if err := model.DB.Find(&toks).Error; err != nil {
			return 0, err
		}
		if !includeSecret {
			for i := range toks {
				toks[i].Key = ""
			}
		}
		return saveOrCount(toks, dst)
	case dto.BackupCategoryModels:
		var ms []model.Model
		if err := model.DB.Find(&ms).Error; err != nil {
			return 0, err
		}
		return saveOrCount(ms, dst)
	case dto.BackupCategoryVendors:
		var vs []model.Vendor
		if err := model.DB.Find(&vs).Error; err != nil {
			return 0, err
		}
		return saveOrCount(vs, dst)
	case dto.BackupCategoryAbilities:
		var abs []model.Ability
		if err := model.DB.Find(&abs).Error; err != nil {
			return 0, err
		}
		return saveOrCount(abs, dst)
	case dto.BackupCategoryDeployments:
		var deps []model.DeployedModel
		if err := model.DB.Find(&deps).Error; err != nil {
			return 0, err
		}
		return saveOrCount(deps, dst)
	case dto.BackupCategoryModelSources:
		var ms []model.ModelSource
		if err := model.DB.Find(&ms).Error; err != nil {
			return 0, err
		}
		if !includeSecret {
			for i := range ms {
				ms[i].Config = ""
			}
		}
		return saveOrCount(ms, dst)
	case dto.BackupCategoryPrefillGroups:
		var pgs []model.PrefillGroup
		if err := model.DB.Find(&pgs).Error; err != nil {
			return 0, err
		}
		return saveOrCount(pgs, dst)
	case dto.BackupCategoryLogs:
		var logs []model.Log
		if err := model.DB.Limit(100000).Order("id DESC").Find(&logs).Error; err != nil {
			return 0, err
		}
		return saveOrCount(logs, dst)
	case dto.BackupCategoryOptions:
		var opts []model.Option
		if err := model.DB.Find(&opts).Error; err != nil {
			return 0, err
		}
		return saveOrCount(opts, dst)
	case dto.BackupCategoryHealthChecks:
		var pms []model.PerfMetric
		if err := model.DB.Limit(100000).Order("id DESC").Find(&pms).Error; err != nil {
			return 0, err
		}
		return saveOrCount(pms, dst)
	default:
		return 0, fmt.Errorf("unsupported category: %s", cat)
	}
}

// saveOrCount 把 rows 拷贝到 dst（如果 dst 非 nil），返回行数。
func saveOrCount(rows interface{}, dst interface{}) (int, error) {
	if dst == nil {
		// 通过 JSON 序列化再反序列化到匿名 slice 来计数。
		buf, err := json.Marshal(rows)
		if err != nil {
			return 0, err
		}
		var sl []json.RawMessage
		if err := json.Unmarshal(buf, &sl); err != nil {
			return 0, err
		}
		return len(sl), nil
	}
	// 把 rows 拷贝到 dst 的目标 slice 类型。
	src, err := json.Marshal(rows)
	if err != nil {
		return 0, err
	}
	if err := json.Unmarshal(src, dst); err != nil {
		return 0, err
	}
	// 简单计数
	buf, err := json.Marshal(rows)
	if err != nil {
		return 0, err
	}
	var sl []json.RawMessage
	if err := json.Unmarshal(buf, &sl); err != nil {
		return 0, err
	}
	return len(sl), nil
}

func backupExportOneAsJSON(cat dto.BackupCategory, includeSecret bool) (interface{}, error) {
	switch cat {
	case dto.BackupCategoryUsers:
		var v []model.User
		_, err := backupExportOne(cat, includeSecret, &v)
		if !includeSecret {
			for i := range v {
				v[i].Password = ""
			}
		}
		return v, err
	case dto.BackupCategoryChannels:
		var v []model.Channel
		_, err := backupExportOne(cat, includeSecret, &v)
		if !includeSecret {
			for i := range v {
				v[i].Key = ""
			}
		}
		return v, err
	case dto.BackupCategoryTokens:
		var v []model.Token
		_, err := backupExportOne(cat, includeSecret, &v)
		if !includeSecret {
			for i := range v {
				v[i].Key = ""
			}
		}
		return v, err
	case dto.BackupCategoryModels:
		var v []model.Model
		_, err := backupExportOne(cat, includeSecret, &v)
		return v, err
	case dto.BackupCategoryVendors:
		var v []model.Vendor
		_, err := backupExportOne(cat, includeSecret, &v)
		return v, err
	case dto.BackupCategoryAbilities:
		var v []model.Ability
		_, err := backupExportOne(cat, includeSecret, &v)
		return v, err
	case dto.BackupCategoryDeployments:
		var v []model.DeployedModel
		_, err := backupExportOne(cat, includeSecret, &v)
		return v, err
	case dto.BackupCategoryModelSources:
		var v []model.ModelSource
		_, err := backupExportOne(cat, includeSecret, &v)
		if !includeSecret {
			for i := range v {
				v[i].Config = ""
			}
		}
		return v, err
	case dto.BackupCategoryPrefillGroups:
		var v []model.PrefillGroup
		_, err := backupExportOne(cat, includeSecret, &v)
		return v, err
	case dto.BackupCategoryLogs:
		var v []model.Log
		_, err := backupExportOne(cat, includeSecret, &v)
		return v, err
	case dto.BackupCategoryOptions:
		var v []model.Option
		_, err := backupExportOne(cat, includeSecret, &v)
		return v, err
	case dto.BackupCategoryHealthChecks:
		var v []model.PerfMetric
		_, err := backupExportOne(cat, includeSecret, &v)
		return v, err
	}
	return nil, fmt.Errorf("unsupported category: %s", cat)
}

// backupImportOne 导入单个类别。
func backupImportOne(cat dto.BackupCategory, raw []byte, skipExisting, overwriteSecret bool) (imported, skipped, errs int, err error) {
	switch cat {
	case dto.BackupCategoryUsers:
		var rows []model.User
		if e := json.Unmarshal(raw, &rows); e != nil {
			return 0, 0, 0, e
		}
		for _, r := range rows {
			var existing model.User
			ex := model.DB.Where("username = ?", r.Username).First(&existing).Error
			if ex == nil {
				if skipExisting {
					skipped++
					continue
				}
				r.Id = 0
				r.AuthVersion = 1
				if e := model.DB.Create(&r).Error; e != nil {
					errs++
					continue
				}
				imported++
			} else {
				skipped++
			}
		}
		return imported, skipped, errs, nil
	case dto.BackupCategoryChannels:
		var rows []model.Channel
		if e := json.Unmarshal(raw, &rows); e != nil {
			return 0, 0, 0, e
		}
		for _, r := range rows {
			var existing model.Channel
			ex := model.DB.Where("name = ?", r.Name).First(&existing).Error
			if ex == nil {
				r.Id = 0
				if !overwriteSecret {
					r.Key = ""
				}
				if e := model.DB.Create(&r).Error; e != nil {
					errs++
					continue
				}
				imported++
			} else if skipExisting {
				skipped++
			} else {
				if !overwriteSecret {
					r.Key = existing.Key
				}
				r.Id = existing.Id
				if e := model.DB.Save(&r).Error; e != nil {
					errs++
					continue
				}
				imported++
			}
		}
		return imported, skipped, errs, nil
	case dto.BackupCategoryTokens:
		var rows []model.Token
		if e := json.Unmarshal(raw, &rows); e != nil {
			return 0, 0, 0, e
		}
		for _, r := range rows {
			r.Id = 0
			if !overwriteSecret {
				r.Key = ""
			}
			if e := model.DB.Create(&r).Error; e != nil {
				errs++
				continue
			}
			imported++
		}
		return imported, skipped, errs, nil
	case dto.BackupCategoryModels:
		var rows []model.Model
		if e := json.Unmarshal(raw, &rows); e != nil {
			return 0, 0, 0, e
		}
		for _, r := range rows {
			var existing model.Model
			ex := model.DB.Where("model_name = ?", r.ModelName).First(&existing).Error
			if ex == nil {
				r.Id = 0
				if e := model.DB.Create(&r).Error; e != nil {
					errs++
					continue
				}
				imported++
			} else if skipExisting {
				skipped++
			} else {
				r.Id = existing.Id
				if e := model.DB.Save(&r).Error; e != nil {
					errs++
					continue
				}
				imported++
			}
		}
		return imported, skipped, errs, nil
	case dto.BackupCategoryVendors:
		var rows []model.Vendor
		if e := json.Unmarshal(raw, &rows); e != nil {
			return 0, 0, 0, e
		}
		for _, r := range rows {
			var existing model.Vendor
			ex := model.DB.Where("name = ?", r.Name).First(&existing).Error
			if ex == nil {
				r.Id = 0
				if e := model.DB.Create(&r).Error; e != nil {
					errs++
					continue
				}
				imported++
			} else if skipExisting {
				skipped++
			} else {
				r.Id = existing.Id
				if e := model.DB.Save(&r).Error; e != nil {
					errs++
					continue
				}
				imported++
			}
		}
		return imported, skipped, errs, nil
	case dto.BackupCategoryAbilities:
		// 清空重建
		if e := model.DB.Where("1=1").Delete(&model.Ability{}).Error; e != nil {
			return 0, 0, 0, e
		}
		var rows []model.Ability
		if e := json.Unmarshal(raw, &rows); e != nil {
			return 0, 0, 0, e
		}
		for i := range rows {
			rows[i].Id = 0
			if e := model.DB.Create(&rows[i]).Error; e != nil {
				errs++
				continue
			}
			imported++
		}
		return imported, skipped, errs, nil
	case dto.BackupCategoryDeployments:
		var rows []model.DeployedModel
		if e := json.Unmarshal(raw, &rows); e != nil {
			return 0, 0, 0, e
		}
		for _, r := range rows {
			var existing model.DeployedModel
			ex := model.DB.Where("source_id = ? AND source_type = ? AND repo_id = ?",
				r.SourceId, r.SourceType, r.RepoId).First(&existing).Error
			if ex == nil {
				r.Id = 0
				r.DeploymentStatus = "idle"
				if e := model.DB.Create(&r).Error; e != nil {
					errs++
					continue
				}
				imported++
			} else if skipExisting {
				skipped++
			} else {
				r.Id = existing.Id
				if e := model.DB.Save(&r).Error; e != nil {
					errs++
					continue
				}
				imported++
			}
		}
		return imported, skipped, errs, nil
	case dto.BackupCategoryModelSources:
		var rows []model.ModelSource
		if e := json.Unmarshal(raw, &rows); e != nil {
			return 0, 0, 0, e
		}
		for _, r := range rows {
			var existing model.ModelSource
			ex := model.DB.Where("source_type = ? AND label = ?", r.SourceType, r.Label).First(&existing).Error
			if ex == nil {
				r.Id = 0
				if !overwriteSecret {
					r.Config = ""
				}
				if e := model.DB.Create(&r).Error; e != nil {
					errs++
					continue
				}
				imported++
			} else if skipExisting {
				skipped++
			} else {
				if !overwriteSecret {
					r.Config = existing.Config
				}
				r.Id = existing.Id
				if e := model.DB.Save(&r).Error; e != nil {
					errs++
					continue
				}
				imported++
			}
		}
		return imported, skipped, errs, nil
	case dto.BackupCategoryPrefillGroups:
		var rows []model.PrefillGroup
		if e := json.Unmarshal(raw, &rows); e != nil {
			return 0, 0, 0, e
		}
		for _, r := range rows {
			r.Id = 0
			if e := model.DB.Create(&r).Error; e != nil {
				errs++
				continue
			}
			imported++
		}
		return imported, skipped, errs, nil
	case dto.BackupCategoryLogs:
		var rows []model.Log
		if e := json.Unmarshal(raw, &rows); e != nil {
			return 0, 0, 0, e
		}
		// 日志追加而非覆盖
		for i := range rows {
			rows[i].Id = 0
			if e := model.DB.Create(&rows[i]).Error; e != nil {
				errs++
				continue
			}
			imported++
		}
		return imported, skipped, errs, nil
	case dto.BackupCategoryOptions:
		var rows []model.Option
		if e := json.Unmarshal(raw, &rows); e != nil {
			return 0, 0, 0, e
		}
		for _, r := range rows {
			var existing model.Option
			ex := model.DB.Where("key = ?", r.Key).First(&existing).Error
			if ex == nil {
				r.Id = 0
				if e := model.DB.Create(&r).Error; e != nil {
					errs++
					continue
				}
				imported++
			} else if skipExisting {
				skipped++
			} else {
				r.Id = existing.Id
				if e := model.DB.Save(&r).Error; e != nil {
					errs++
					continue
				}
				imported++
			}
		}
		return imported, skipped, errs, nil
	case dto.BackupCategoryHealthChecks:
		// 健康检查历史指标追加
		var rows []model.PerfMetric
		if e := json.Unmarshal(raw, &rows); e != nil {
			return 0, 0, 0, e
		}
		for i := range rows {
			rows[i].Id = 0
			if e := model.DB.Create(&rows[i]).Error; e != nil {
				errs++
				continue
			}
			imported++
		}
		return imported, skipped, errs, nil
	}
	return 0, 0, 0, fmt.Errorf("unsupported category: %s", cat)
}

// =====================================================================
// Helpers
// =====================================================================

func writeZipJSON(zw *zip.Writer, name string, payload interface{}) error {
	buf, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return err
	}
	w, err := zw.Create(name)
	if err != nil {
		return err
	}
	_, err = w.Write(buf)
	return err
}

func readZipFile(f *zip.File) ([]byte, error) {
	rc, err := f.Open()
	if err != nil {
		return nil, err
	}
	defer rc.Close()
	return io.ReadAll(rc)
}

// Helper exported for callers that want to format file sizes.
func formatBytes(n int64) string {
	const (
		kb = 1024
		mb = 1024 * kb
		gb = 1024 * mb
	)
	switch {
	case n >= gb:
		return strconv.FormatFloat(float64(n)/float64(gb), 'f', 2, 64) + " GB"
	case n >= mb:
		return strconv.FormatFloat(float64(n)/float64(mb), 'f', 2, 64) + " MB"
	case n >= kb:
		return strconv.FormatFloat(float64(n)/float64(kb), 'f', 2, 64) + " KB"
	}
	return strconv.FormatInt(n, 10) + " B"
}

// PreviewCategoryCount 快速统计某类别行数（不导出数据）。
func PreviewCategoryCount(cat dto.BackupCategory) (int, error) {
	var count int64
	var err error
	switch cat {
	case dto.BackupCategoryUsers:
		err = model.DB.Model(&model.User{}).Count(&count).Error
	case dto.BackupCategoryChannels:
		err = model.DB.Model(&model.Channel{}).Count(&count).Error
	case dto.BackupCategoryTokens:
		err = model.DB.Model(&model.Token{}).Count(&count).Error
	case dto.BackupCategoryModels:
		err = model.DB.Model(&model.Model{}).Count(&count).Error
	case dto.BackupCategoryVendors:
		err = model.DB.Model(&model.Vendor{}).Count(&count).Error
	case dto.BackupCategoryAbilities:
		err = model.DB.Model(&model.Ability{}).Count(&count).Error
	case dto.BackupCategoryDeployments:
		err = model.DB.Model(&model.DeployedModel{}).Count(&count).Error
	case dto.BackupCategoryModelSources:
		err = model.DB.Model(&model.ModelSource{}).Count(&count).Error
	case dto.BackupCategoryPrefillGroups:
		err = model.DB.Model(&model.PrefillGroup{}).Count(&count).Error
	case dto.BackupCategoryLogs:
		err = model.DB.Model(&model.Log{}).Count(&count).Error
	case dto.BackupCategoryOptions:
		err = model.DB.Model(&model.Option{}).Count(&count).Error
	case dto.BackupCategoryHealthChecks:
		err = model.DB.Model(&model.PerfMetric{}).Count(&count).Error
	default:
		return 0, fmt.Errorf("unsupported category: %s", cat)
	}
	return int(count), err
}
