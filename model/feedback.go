package model

import (
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"
)

// 用户工单（建议及咨询）——"用户发帖 + 管理员回复"的轻量工单。
// 设计文档：docs/feedback-consult-design.md

// ─── 枚举 ─────────────────────────────────────────────────────────────────────

// 工单状态。转移规则见设计文档 §三 / AddFeedbackMessage。
const (
	FeedbackStatusPending    = 1 // 待处理
	FeedbackStatusProcessing = 2 // 处理中
	FeedbackStatusReplied    = 3 // 已回复
	FeedbackStatusClosed     = 4 // 已关闭
)

// 工单分类。
const (
	FeedbackCategorySuggestion = 1 // 建议
	FeedbackCategoryConsult    = 2 // 咨询
	FeedbackCategoryBug        = 3 // Bug 反馈
	FeedbackCategoryBilling    = 4 // 充值与账单
	FeedbackCategoryOther      = 5 // 其他
)

// 发言者角色：与 user.role 对齐（1=普通用户，10=管理员），决定气泡"视角相对"对齐。
const (
	FeedbackAuthorUser  = 1
	FeedbackAuthorAdmin = 10
)

// 配额与体积上限（详见设计文档 §4.3）。
const (
	FeedbackMaxOpenTopics       = 10      // 单用户未关闭工单上限
	FeedbackMaxDailyTopics      = 20      // 单用户单日新建工单上限
	FeedbackMaxImagesPerMessage = 3       // 每条消息图片数上限
	FeedbackMaxContentLen       = 5000    // 正文字符上限
	FeedbackMaxTitleLen         = 128     // 标题字符上限
	FeedbackMaxImageBase64Len   = 2300000 // 单张压缩图 base64 长度上限（≈1.7MB 原始）
)

func IsValidFeedbackCategory(c int) bool {
	return c >= FeedbackCategorySuggestion && c <= FeedbackCategoryOther
}

var (
	ErrFeedbackOpenLimit    = errors.New("未关闭的工单数量已达上限，请先处理已有工单或关闭部分工单")
	ErrFeedbackDailyLimit   = errors.New("今日创建的工单数量已达上限，请明天再试")
	ErrFeedbackEmptyMessage = errors.New("消息内容不能为空")
	ErrFeedbackImageTooMany = errors.New("图片数量超过上限")
	ErrFeedbackImageTooBig  = errors.New("图片体积超过上限")
)

// ─── 表结构 ───────────────────────────────────────────────────────────────────

// FeedbackTopic 工单主题。首帖与后续回复统一存为 FeedbackMessage，标题/分类存本表。
type FeedbackTopic struct {
	Id            int            `json:"id"              gorm:"primaryKey;autoIncrement"`
	UserId        int            `json:"user_id"         gorm:"index:idx_feedback_user_status,priority:1;not null"`
	Category      int            `json:"category"        gorm:"type:int;not null;default:1"`
	Title         string         `json:"title"           gorm:"type:varchar(128);not null"`
	Status        int            `json:"status"          gorm:"type:int;not null;default:1;index:idx_feedback_user_status,priority:2;index:idx_feedback_status_reply,priority:1"`
	MessageCount  int            `json:"message_count"   gorm:"type:int;not null;default:0"`
	LastReplyAt   time.Time      `json:"last_reply_at"   gorm:"index:idx_feedback_status_reply,priority:2"`
	LastReplyRole int            `json:"last_reply_role" gorm:"type:int;not null;default:1"`
	UserUnread    bool           `json:"user_unread"     gorm:"not null;default:false"`
	AdminUnread   bool           `json:"admin_unread"    gorm:"not null;default:true"`
	ClosedBy      int            `json:"closed_by,omitempty" gorm:"type:int"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `json:"-" gorm:"index"`
}

// FeedbackMessage 对话消息。UserId 为发言者（用户或具体某个管理员）。
type FeedbackMessage struct {
	Id         int       `json:"id"          gorm:"primaryKey;autoIncrement"`
	TopicId    int       `json:"topic_id"    gorm:"index:idx_feedback_msg_topic,priority:1;not null"`
	UserId     int       `json:"user_id"     gorm:"index;not null"`
	AuthorRole int       `json:"author_role" gorm:"type:int;not null"`
	Content    string    `json:"content"     gorm:"type:varchar(5000)"`
	CreatedAt  time.Time `json:"created_at"  gorm:"index:idx_feedback_msg_topic,priority:2"`

	// 非持久化，详情接口填充
	ImageIds   []int  `json:"image_ids"   gorm:"-"`
	AuthorName string `json:"author_name" gorm:"-"`
}

// FeedbackImage 图片附件。Data 为压缩后 base64（不打 type:text，跨库走 longtext/text）。
type FeedbackImage struct {
	Id        int       `json:"id"         gorm:"primaryKey;autoIncrement"`
	MessageId int       `json:"message_id" gorm:"index;not null"`
	TopicId   int       `json:"topic_id"   gorm:"index;not null"`
	UserId    int       `json:"user_id"    gorm:"index;not null"`
	Data      string    `json:"-"          gorm:"not null"`
	CreatedAt time.Time `json:"created_at"`
}

// ─── 写操作（均在事务内，保证计数/状态/未读一致）─────────────────────────────────

// CreateFeedbackTopic 新建工单：配额校验 + 建主题 + 首帖 + 图片，原子提交。
func CreateFeedbackTopic(userId, category int, title, content string, images []string) (*FeedbackTopic, error) {
	title = strings.TrimSpace(title)
	content = strings.TrimSpace(content)
	if content == "" && len(images) == 0 {
		return nil, ErrFeedbackEmptyMessage
	}
	if len(images) > FeedbackMaxImagesPerMessage {
		return nil, ErrFeedbackImageTooMany
	}

	now := time.Now()
	topic := &FeedbackTopic{
		UserId:        userId,
		Category:      category,
		Title:         title,
		Status:        FeedbackStatusPending,
		MessageCount:  1,
		LastReplyAt:   now,
		LastReplyRole: FeedbackAuthorUser,
		UserUnread:    false,
		AdminUnread:   true,
	}

	err := DB.Transaction(func(tx *gorm.DB) error {
		// 配额：未关闭工单数
		var openCount int64
		if err := tx.Model(&FeedbackTopic{}).
			Where("user_id = ? AND status != ?", userId, FeedbackStatusClosed).
			Count(&openCount).Error; err != nil {
			return err
		}
		if openCount >= FeedbackMaxOpenTopics {
			return ErrFeedbackOpenLimit
		}
		// 配额：单日新建数
		startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		var dailyCount int64
		if err := tx.Unscoped().Model(&FeedbackTopic{}).
			Where("user_id = ? AND created_at >= ?", userId, startOfDay).
			Count(&dailyCount).Error; err != nil {
			return err
		}
		if dailyCount >= FeedbackMaxDailyTopics {
			return ErrFeedbackDailyLimit
		}

		if err := tx.Create(topic).Error; err != nil {
			return err
		}
		_, err := insertMessageTx(tx, topic.Id, userId, FeedbackAuthorUser, content, images)
		return err
	})
	if err != nil {
		return nil, err
	}
	invalidateAdminUnreadCache()
	return topic, nil
}

// AddFeedbackMessage 回复工单：插消息 + 图片 + 按转移表更新主题，原子提交。
// 返回更新后的主题（含 owner，用于缓存失效）。
func AddFeedbackMessage(topicId, authorId, authorRole int, content string, images []string) (*FeedbackMessage, *FeedbackTopic, error) {
	content = strings.TrimSpace(content)
	if content == "" && len(images) == 0 {
		return nil, nil, ErrFeedbackEmptyMessage
	}
	if len(images) > FeedbackMaxImagesPerMessage {
		return nil, nil, ErrFeedbackImageTooMany
	}

	var msg *FeedbackMessage
	var topic FeedbackTopic
	now := time.Now()

	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.First(&topic, topicId).Error; err != nil {
			return err
		}

		updates := map[string]interface{}{
			"message_count":   gorm.Expr("message_count + 1"),
			"last_reply_at":   now,
			"last_reply_role": authorRole,
		}
		if authorRole == FeedbackAuthorAdmin {
			updates["status"] = FeedbackStatusReplied
			updates["user_unread"] = true
			updates["admin_unread"] = false
		} else {
			updates["admin_unread"] = true
			// 用户发了回复即意味着已读本工单，清自己的未读位（与管理员回复清
			// admin_unread 对称），避免回复后侧边栏仍显示未读。
			updates["user_unread"] = false
			switch topic.Status {
			case FeedbackStatusReplied:
				updates["status"] = FeedbackStatusPending
			case FeedbackStatusClosed:
				updates["status"] = FeedbackStatusPending
				updates["closed_by"] = 0 // 重开，清 ClosedBy
			}
		}
		if err := tx.Model(&FeedbackTopic{}).Where("id = ?", topicId).Updates(updates).Error; err != nil {
			return err
		}

		var err error
		msg, err = insertMessageTx(tx, topicId, authorId, authorRole, content, images)
		return err
	})
	if err != nil {
		return nil, nil, err
	}

	if authorRole == FeedbackAuthorAdmin {
		invalidateUserUnreadCache(topic.UserId)
	} else {
		// 用户回复同时改了 admin_unread 与自己的 user_unread，两侧缓存都失效
		invalidateAdminUnreadCache()
		invalidateUserUnreadCache(topic.UserId)
	}
	return msg, &topic, nil
}

// insertMessageTx 在事务内插入一条消息及其图片。
func insertMessageTx(tx *gorm.DB, topicId, authorId, authorRole int, content string, images []string) (*FeedbackMessage, error) {
	msg := &FeedbackMessage{
		TopicId:    topicId,
		UserId:     authorId,
		AuthorRole: authorRole,
		Content:    content,
		CreatedAt:  time.Now(),
	}
	if err := tx.Create(msg).Error; err != nil {
		return nil, err
	}
	for _, data := range images {
		img := &FeedbackImage{
			MessageId: msg.Id,
			TopicId:   topicId,
			UserId:    authorId,
			Data:      data,
		}
		if err := tx.Create(img).Error; err != nil {
			return nil, err
		}
	}
	return msg, nil
}

// CloseFeedbackTopic 关闭工单：置已关闭、记 ClosedBy、清两侧未读位。
func CloseFeedbackTopic(topicId, closerId int) (*FeedbackTopic, error) {
	var topic FeedbackTopic
	if err := DB.First(&topic, topicId).Error; err != nil {
		return nil, err
	}
	err := DB.Model(&FeedbackTopic{}).Where("id = ?", topicId).Updates(map[string]interface{}{
		"status":       FeedbackStatusClosed,
		"closed_by":    closerId,
		"user_unread":  false,
		"admin_unread": false,
	}).Error
	if err != nil {
		return nil, err
	}
	invalidateUserUnreadCache(topic.UserId)
	invalidateAdminUnreadCache()
	return &topic, nil
}

// AdminUpdateFeedbackStatus 管理员变更状态（仅允许 处理中 / 已关闭）。
func AdminUpdateFeedbackStatus(topicId, status, operatorId int) (*FeedbackTopic, error) {
	var topic FeedbackTopic
	if err := DB.First(&topic, topicId).Error; err != nil {
		return nil, err
	}
	updates := map[string]interface{}{"status": status}
	if status == FeedbackStatusClosed {
		updates["closed_by"] = operatorId
		updates["user_unread"] = false
		updates["admin_unread"] = false
	}
	if err := DB.Model(&FeedbackTopic{}).Where("id = ?", topicId).Updates(updates).Error; err != nil {
		return nil, err
	}
	invalidateUserUnreadCache(topic.UserId)
	invalidateAdminUnreadCache()
	return &topic, nil
}

// MarkFeedbackUserRead 用户打开详情：清 user_unread。
func MarkFeedbackUserRead(topicId, userId int) {
	res := DB.Model(&FeedbackTopic{}).
		Where("id = ? AND user_id = ? AND user_unread = ?", topicId, userId, true).
		Update("user_unread", false)
	if res.RowsAffected > 0 {
		invalidateUserUnreadCache(userId)
	}
}

// MarkFeedbackAdminRead 管理员打开详情：清 admin_unread（全局共享位）。
func MarkFeedbackAdminRead(topicId int) {
	res := DB.Model(&FeedbackTopic{}).
		Where("id = ? AND admin_unread = ?", topicId, true).
		Update("admin_unread", false)
	if res.RowsAffected > 0 {
		invalidateAdminUnreadCache()
	}
}

// ─── 读操作 ───────────────────────────────────────────────────────────────────

// GetUserFeedbackTopicById 取工单并强制归属校验（非本人返回 ErrRecordNotFound）。
func GetUserFeedbackTopicById(topicId, userId int) (*FeedbackTopic, error) {
	var topic FeedbackTopic
	err := DB.Where("id = ? AND user_id = ?", topicId, userId).First(&topic).Error
	if err != nil {
		return nil, err
	}
	return &topic, nil
}

// GetFeedbackTopicById 取工单（管理员，无归属限制）。
func GetFeedbackTopicById(topicId int) (*FeedbackTopic, error) {
	var topic FeedbackTopic
	if err := DB.First(&topic, topicId).Error; err != nil {
		return nil, err
	}
	return &topic, nil
}

// GetUserFeedbackTopics 我的工单列表，按 last_reply_at DESC（最新置顶）。status/category=0 表示不过滤。
func GetUserFeedbackTopics(userId, status, category int, keyword string, page, pageSize int) ([]*FeedbackTopic, int64, error) {
	query := DB.Model(&FeedbackTopic{}).Where("user_id = ?", userId)
	if status != 0 {
		query = query.Where("status = ?", status)
	}
	if category != 0 {
		query = query.Where("category = ?", category)
	}
	if keyword != "" {
		query = query.Where("title LIKE ?", "%"+keyword+"%")
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var topics []*FeedbackTopic
	offset := (page - 1) * pageSize
	err := query.Order("last_reply_at DESC").Offset(offset).Limit(pageSize).Find(&topics).Error
	if err != nil {
		return nil, 0, err
	}
	return topics, total, nil
}

// FeedbackAdminRow 管理员列表行：工单 + 所属用户名。
type FeedbackAdminRow struct {
	FeedbackTopic
	Username string `gorm:"column:username"`
}

// GetFeedbackAdminTopics 全量工单列表，支持按用户(id/用户名)、状态、分类、标题筛选；last_reply_at DESC。
func GetFeedbackAdminTopics(filterUserId, status, category int, username, keyword string, page, pageSize int) ([]*FeedbackAdminRow, int64, error) {
	build := func(db *gorm.DB) *gorm.DB {
		q := db.Model(&FeedbackTopic{}).
			Joins("LEFT JOIN users u1 ON u1.id = feedback_topics.user_id")
		if filterUserId != 0 {
			q = q.Where("feedback_topics.user_id = ?", filterUserId)
		}
		if status != 0 {
			q = q.Where("feedback_topics.status = ?", status)
		}
		if category != 0 {
			q = q.Where("feedback_topics.category = ?", category)
		}
		if username != "" {
			q = q.Where("u1.username LIKE ?", "%"+username+"%")
		}
		if keyword != "" {
			q = q.Where("feedback_topics.title LIKE ?", "%"+keyword+"%")
		}
		return q
	}

	var total int64
	if err := build(DB).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var rows []*FeedbackAdminRow
	offset := (page - 1) * pageSize
	err := build(DB).
		Select("feedback_topics.*, u1.username AS username").
		Order("feedback_topics.last_reply_at DESC").
		Offset(offset).Limit(pageSize).Scan(&rows).Error
	if err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

// GetFeedbackMessages 取某工单的消息（分页，created_at ASC），并回填 ImageIds 与 AuthorName。
// maskAdmin=true（用户侧）时不回填管理员消息的真名，避免向终端用户暴露管理员账号
// （撞库/猜密码风险，见 docs/feedback-consult-design.md §2.2）；控制器再把 AuthorId 置 0。
func GetFeedbackMessages(topicId, page, pageSize int, maskAdmin bool) ([]*FeedbackMessage, int64, error) {
	query := DB.Model(&FeedbackMessage{}).Where("topic_id = ?", topicId)

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var messages []*FeedbackMessage
	offset := (page - 1) * pageSize
	if err := query.Order("created_at ASC").Offset(offset).Limit(pageSize).Find(&messages).Error; err != nil {
		return nil, 0, err
	}
	if len(messages) == 0 {
		return messages, total, nil
	}

	// 回填图片 id
	msgIds := make([]int, 0, len(messages))
	authorIds := make([]int, 0, len(messages))
	for _, m := range messages {
		msgIds = append(msgIds, m.Id)
		authorIds = append(authorIds, m.UserId)
	}
	var imgs []FeedbackImage
	DB.Model(&FeedbackImage{}).Select("id, message_id").Where("message_id IN ?", msgIds).Find(&imgs)
	imgMap := make(map[int][]int)
	for _, img := range imgs {
		imgMap[img.MessageId] = append(imgMap[img.MessageId], img.Id)
	}
	// 回填发言者名
	nameMap := loadUsernames(authorIds)
	for _, m := range messages {
		m.ImageIds = imgMap[m.Id]
		// 用户侧脱敏：管理员消息不回填真名（前端固定显示「官方客服」）。
		if maskAdmin && m.AuthorRole == FeedbackAuthorAdmin {
			continue
		}
		m.AuthorName = nameMap[m.UserId]
	}
	return messages, total, nil
}

// GetFeedbackImageForUser 按图片 id 取图，强制该图所属工单归属该用户。
func GetFeedbackImageForUser(imageId, userId int) (*FeedbackImage, error) {
	img, err := getFeedbackImage(imageId)
	if err != nil {
		return nil, err
	}
	// 校验该图所属工单归属请求者（图可能是管理员在该用户工单里上传的，故按 topic.user_id 判定）
	var topic FeedbackTopic
	if err := DB.Select("user_id").First(&topic, img.TopicId).Error; err != nil {
		return nil, err
	}
	if topic.UserId != userId {
		return nil, gorm.ErrRecordNotFound
	}
	return img, nil
}

// GetFeedbackImage 按图片 id 取图（管理员，无归属限制）。
func GetFeedbackImage(imageId int) (*FeedbackImage, error) {
	return getFeedbackImage(imageId)
}

func getFeedbackImage(imageId int) (*FeedbackImage, error) {
	var img FeedbackImage
	if err := DB.First(&img, imageId).Error; err != nil {
		return nil, err
	}
	return &img, nil
}

// ─── 未读计数（带 Redis 缓存，见 feedback_cache.go）──────────────────────────────

// countUserUnread 直查 DB：我的未读未关闭工单数。
func countUserUnread(userId int) int64 {
	var count int64
	DB.Model(&FeedbackTopic{}).
		Where("user_id = ? AND user_unread = ? AND status != ?", userId, true, FeedbackStatusClosed).
		Count(&count)
	return count
}

// countAdminUnread 直查 DB：全局未读未关闭工单数。
func countAdminUnread() int64 {
	var count int64
	DB.Model(&FeedbackTopic{}).
		Where("admin_unread = ? AND status != ?", true, FeedbackStatusClosed).
		Count(&count)
	return count
}

// UserHasFeedbackTopics 用户是否有过任何工单（供前端决定是否挂轮询）。
func UserHasFeedbackTopics(userId int) bool {
	var count int64
	DB.Model(&FeedbackTopic{}).Where("user_id = ?", userId).Limit(1).Count(&count)
	return count > 0
}

// loadUsernames 批量加载 user_id → username。
func loadUsernames(ids []int) map[int]string {
	result := make(map[int]string)
	if len(ids) == 0 {
		return result
	}
	type row struct {
		Id       int
		Username string
	}
	var rows []row
	DB.Model(&User{}).Select("id, username").Where("id IN ?", ids).Find(&rows)
	for _, r := range rows {
		result[r.Id] = r.Username
	}
	return result
}
