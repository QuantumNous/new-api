package service

import (
	"context"
	"fmt"
	"time"

	"one-api/common"
	"one-api/model"

	"gorm.io/gorm"
)

// JobService 作业服务
type JobService struct {
	db *gorm.DB
}

// NewJobService 创建作业服务实例
func NewJobService(db *gorm.DB) *JobService {
	return &JobService{db: db}
}

// CreateJob 创建作业
func (s *JobService) CreateJob(ctx context.Context, job *model.Job) error {
	if job.JobID == "" {
		return fmt.Errorf("job_id is required")
	}
	if job.JobName == "" {
		return fmt.Errorf("job_name is required")
	}
	if job.UserID == 0 {
		return fmt.Errorf("user_id is required")
	}

	// 设置默认状态
	if job.Status == "" {
		job.Status = model.JobStatusPending
	}

	// 检查job_id是否已存在
	var count int64
	if err := s.db.Model(&model.Job{}).Where("job_id = ?", job.JobID).Count(&count).Error; err != nil {
		return fmt.Errorf("failed to check job_id existence: %w", err)
	}
	if count > 0 {
		return fmt.Errorf("job_id %s already exists", job.JobID)
	}

	if err := s.db.Create(job).Error; err != nil {
		common.LogError(ctx, "failed to create job: "+err.Error())
		return fmt.Errorf("failed to create job: %w", err)
	}

	common.LogInfo(ctx, fmt.Sprintf("Created job: %s (ID: %d)", job.JobName, job.ID))
	return nil
}

// GetJobByID 根据ID获取作业
func (s *JobService) GetJobByID(ctx context.Context, id int64) (*model.Job, error) {
	var job model.Job
	if err := s.db.Where("id = ?", id).First(&job).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("job not found with id: %d", id)
		}
		return nil, fmt.Errorf("failed to get job: %w", err)
	}
	return &job, nil
}

// GetJobByJobID 根据JobID获取作业
func (s *JobService) GetJobByJobID(ctx context.Context, jobID string) (*model.Job, error) {
	var job model.Job
	if err := s.db.Where("job_id = ?", jobID).First(&job).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("job not found with job_id: %s", jobID)
		}
		return nil, fmt.Errorf("failed to get job: %w", err)
	}
	return &job, nil
}

// UpdateJob 更新作业
func (s *JobService) UpdateJob(ctx context.Context, job *model.Job) error {
	if job.ID == 0 {
		return fmt.Errorf("job id is required")
	}

	// 验证状态
	if job.Status != "" && !model.IsValidStatus(job.Status) {
		return fmt.Errorf("invalid status: %s", job.Status)
	}

	job.UpdatedAt = time.Now()
	if err := s.db.Save(job).Error; err != nil {
		common.LogError(ctx, "failed to update job: "+err.Error())
		return fmt.Errorf("failed to update job: %w", err)
	}

	common.LogInfo(ctx, fmt.Sprintf("Updated job: %s (ID: %d)", job.JobName, job.ID))
	return nil
}

// UpdateJobStatus 更新作业状态
func (s *JobService) UpdateJobStatus(ctx context.Context, id int64, status string) error {
	if !model.IsValidStatus(status) {
		return fmt.Errorf("invalid status: %s", status)
	}

	if err := s.db.Model(&model.Job{}).Where("id = ?", id).Update("status", status).Error; err != nil {
		common.LogError(ctx, "failed to update job status: "+err.Error())
		return fmt.Errorf("failed to update job status: %w", err)
	}

	common.LogInfo(ctx, fmt.Sprintf("Updated job status: ID %d -> %s", id, status))
	return nil
}

// ListJobs 列出作业
func (s *JobService) ListJobs(ctx context.Context, userID int64, status string, limit, offset int) ([]*model.Job, int64, error) {
	var jobs []*model.Job
	var total int64

	query := s.db.Model(&model.Job{})

	// 按用户ID过滤
	if userID > 0 {
		query = query.Where("user_id = ?", userID)
	}

	// 按状态过滤
	if status != "" && model.IsValidStatus(status) {
		query = query.Where("status = ?", status)
	}

	// 获取总数
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count jobs: %w", err)
	}

	// 获取分页数据
	if err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&jobs).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list jobs: %w", err)
	}

	return jobs, total, nil
}

// DeleteJob 删除作业
func (s *JobService) DeleteJob(ctx context.Context, id int64) error {
	if err := s.db.Where("id = ?", id).Delete(&model.Job{}).Error; err != nil {
		common.LogError(ctx, "failed to delete job: "+err.Error())
		return fmt.Errorf("failed to delete job: %w", err)
	}

	common.LogInfo(ctx, fmt.Sprintf("Deleted job with ID: %d", id))
	return nil
}

// GetJobsByStatus 根据状态获取作业列表
func (s *JobService) GetJobsByStatus(ctx context.Context, status string) ([]*model.Job, error) {
	var jobs []*model.Job
	if err := s.db.Where("status = ?", status).Find(&jobs).Error; err != nil {
		return nil, fmt.Errorf("failed to get jobs by status: %w", err)
	}
	return jobs, nil
}

// GetJobsByUserID 根据用户ID获取作业列表
func (s *JobService) GetJobsByUserID(ctx context.Context, userID int64) ([]*model.Job, error) {
	var jobs []*model.Job
	if err := s.db.Where("user_id = ?", userID).Order("created_at DESC").Find(&jobs).Error; err != nil {
		return nil, fmt.Errorf("failed to get jobs by user_id: %w", err)
	}
	return jobs, nil
}
