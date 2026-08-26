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

	"gorm.io/gorm"
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
	buf, err := json.Marshal(rows)
	if err != nil {
		return 0, err
	}
	if dst != nil {
		if err := json.Unmarshal(buf, dst); err != nil {
			return 0, err
		}
	}
	var sl []json.RawMessage
	if err := json.Unmarshal(buf, &sl); err != nil {
		return 0, err
	}
	return len(sl), nil
}

// backupExportOneAsJSON 导出单个类别到 interface{}（用于 zip writer）。
// 直接复用 backupExportOne 的 dst 参数，避免重复 SQL。
func backupExportOneAsJSON(cat dto.BackupCategory, includeSecret bool) (interface{}, error) {
	switch cat {
	case dto.BackupCategoryUsers:
		var v []model.User
		if _, err := backupExportOne(cat, includeSecret, &v); err != nil {
			return nil, err
		}
		if !includeSecret {
			for i := range v {
				v[i].Password = ""
			}
		}
		return v, nil
	case dto.BackupCategoryChannels:
		var v []model.Channel
		if _, err := backupExportOne(cat, includeSecret, &v); err != nil {
			return nil, err
		}
		if !includeSecret {
			for i := range v {
				v[i].Key = ""
			}
		}
		return v, nil
	case dto.BackupCategoryTokens:
		var v []model.Token
		if _, err := backupExportOne(cat, includeSecret, &v); err != nil {
			return nil, err
		}
		if !includeSecret {
			for i := range v {
				v[i].Key = ""
			}
		}
		return v, nil
	case dto.BackupCategoryModels:
		var v []model.Model
		if _, err := backupExportOne(cat, includeSecret, &v); err != nil {
			return nil, err
		}
		return v, nil
	case dto.BackupCategoryVendors:
		var v []model.Vendor
		if _, err := backupExportOne(cat, includeSecret, &v); err != nil {
			return nil, err
		}
		return v, nil
	case dto.BackupCategoryAbilities:
		var v []model.Ability
		if _, err := backupExportOne(cat, includeSecret, &v); err != nil {
			return nil, err
		}
		return v, nil
	case dto.BackupCategoryDeployments:
		var v []model.DeployedModel
		if _, err := backupExportOne(cat, includeSecret, &v); err != nil {
			return nil, err
		}
		return v, nil
	case dto.BackupCategoryModelSources:
		var v []model.ModelSource
		if _, err := backupExportOne(cat, includeSecret, &v); err != nil {
			return nil, err
		}
		if !includeSecret {
			for i := range v {
				v[i].Config = ""
			}
		}
		return v, nil
	case dto.BackupCategoryPrefillGroups:
		var v []model.PrefillGroup
		if _, err := backupExportOne(cat, includeSecret, &v); err != nil {
			return nil, err
		}
		return v, nil
	case dto.BackupCategoryLogs:
		var v []model.Log
		if _, err := backupExportOne(cat, includeSecret, &v); err != nil {
			return nil, err
		}
		return v, nil
	case dto.BackupCategoryOptions:
		var v []model.Option
		if _, err := backupExportOne(cat, includeSecret, &v); err != nil {
			return nil, err
		}
		return v, nil
	case dto.BackupCategoryHealthChecks:
		var v []model.PerfMetric
		if _, err := backupExportOne(cat, includeSecret, &v); err != nil {
			return nil, err
		}
		return v, nil
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
				txErr := model.DB.Transaction(func(tx *gorm.DB) error {
					r.Id = 0
					r.AuthVersion = 1
					// 重新生成 aff_code（避免与现有用户冲突）
					r.AffCode = common.GetRandomString(4)
					// OAuth 绑定字段清空，避免和外站用户冲突。
					r.GitHubId = ""
					r.DiscordId = ""
					r.OidcId = ""
					r.WeChatId = ""
					r.TelegramId = ""
					r.LinuxDOId = ""
					// User.Insert 内部会重新 hash 密码（仅当非空），并校验邮箱唯一性。
					// 导入时 inviterId 设为 0。
					return r.InsertWithTx(tx, 0)
				})
				if txErr != nil {
					errs++
					common.SysLog(fmt.Sprintf("backup import user %s failed: %v", r.Username, txErr))
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
				// 新建：清零敏感字段（除非显式覆盖）
				r.Id = 0
				if !overwriteSecret {
					r.Key = ""
				}
				if e := model.DB.Create(&r).Error; e != nil {
					errs++
					common.SysLog(fmt.Sprintf("backup import channel %s failed: %v", r.Name, e))
					continue
				}
				imported++
			} else if skipExisting {
				skipped++
			} else {
				// 覆盖：复用 r.Id，但通过 Channel.Update() 走完整的多 Key 计数 / Ability 重建逻辑。
				// 不更新 balance / used_quota / response_time / test_time 等运行期字段。
				r.Id = existing.Id
				if !overwriteSecret {
					r.Key = existing.Key
				}
				r.Balance = existing.Balance
				r.UsedQuota = existing.UsedQuota
				r.ResponseTime = existing.ResponseTime
				r.TestTime = existing.TestTime
				if e := r.Update(); e != nil {
					errs++
					common.SysLog(fmt.Sprintf("backup import channel %s update failed: %v", r.Name, e))
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
			// 跳过同名 token（防止重复创建；用户想覆盖请通过 channels 之类的入口）
			var existing model.Token
			if ex := model.DB.Where("user_id = ? AND name = ?", r.UserId, r.Name).First(&existing).Error; ex == nil {
				skipped++
				continue
			}
			r.Id = 0
			if !overwriteSecret {
				r.Key = ""
			}
			if e := r.Insert(); e != nil {
				errs++
				common.SysLog(fmt.Sprintf("backup import token %s failed: %v", r.Name, e))
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
				if e := r.Insert(); e != nil {
					errs++
					common.SysLog(fmt.Sprintf("backup import model %s failed: %v", r.ModelName, e))
					continue
				}
				imported++
			} else if skipExisting {
				skipped++
			} else {
				// 用 Model.Update() 走完整字段更新（含零值）
				r.Id = existing.Id
				if e := r.Update(); e != nil {
					errs++
					common.SysLog(fmt.Sprintf("backup import model %s update failed: %v", r.ModelName, e))
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
				if e := r.Insert(); e != nil {
					errs++
					common.SysLog(fmt.Sprintf("backup import vendor %s failed: %v", r.Name, e))
					continue
				}
				imported++
			} else if skipExisting {
				skipped++
			} else {
				r.Id = existing.Id
				if e := r.Update(); e != nil {
					errs++
					common.SysLog(fmt.Sprintf("backup import vendor %s update failed: %v", r.Name, e))
					continue
				}
				imported++
			}
		}
		return imported, skipped, errs, nil
	case dto.BackupCategoryAbilities:
		// 清空重建（abilities 是 channel↔model 的多对多映射，必须配套恢复）
		if e := model.DB.Session(&gorm.Session{AllowGlobalUpdate: false}).Where("1 = 1").Delete(&model.Ability{}).Error; e != nil {
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
				common.SysLog(fmt.Sprintf("backup import ability failed: %v", e))
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
		// 导入端也设上限，避免把 100 万行日志一次性 INSERT。
		const maxLogImport = 50000
		if len(rows) > maxLogImport {
			rows = rows[:maxLogImport]
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
		var rows []model.PerfMetric
		if e := json.Unmarshal(raw, &rows); e != nil {
			return 0, 0, 0, e
		}
		const maxPerfImport = 50000
		if len(rows) > maxPerfImport {
			rows = rows[:maxPerfImport]
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
