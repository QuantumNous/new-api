package service

import (
	"errors"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	AffiliateInviteSourceNone      = "none"
	AffiliateInviteSourceNormal    = "normal"
	AffiliateInviteSourceAffiliate = "affiliate"

	AffiliateRegisterMethodPassword = "password"
	AffiliateRegisterMethodOAuth    = "oauth"
	AffiliateRegisterMethodWeChat   = "wechat"
	AffiliateRegisterMethodSMS      = "sms"

	AffiliateScopeNone      = "none"
	AffiliateScopeGlobal    = "global"
	AffiliateScopeAffiliate = "affiliate"

	AffiliateAuditActionCreateProfile  = "create_profile"
	AffiliateAuditActionUpdateProfile  = "update_profile"
	AffiliateAuditActionEnableProfile  = "enable_profile"
	AffiliateAuditActionDisableProfile = "disable_profile"
	AffiliateAuditActionUpdateInviter  = "update_inviter"
)

type AffiliateInviteInput struct {
	ModuleEnabled          bool
	InviteCode             string
	InviterUserId          int
	InviterAffiliateStatus string
	InviterAffiliateLevel  int
}

type AffiliateInviteResolution struct {
	Source        string
	InviterUserId int
	InviteCode    string
}

type AffiliateInviteContextInput struct {
	ModuleEnabled  bool
	InviteCode     string
	RegisterMethod string
	Provider       string
}

type AffiliateInviteContext struct {
	Source         string
	InviterUserId  int
	InviteCode     string
	RegisterMethod string
	Provider       string
}

type AffiliateInviteEventInput struct {
	InviteeUserId      int
	InviterUserId      int
	InviteCode         string
	InviteSource       string
	RegisterMethod     string
	Provider           string
	RuleSetId          int
	InitialQuota       int64
	InitialAmountCents int64
	InitialQuotaRule   string
	Metadata           string
}

func ResolveAffiliateInviteSource(input AffiliateInviteInput) AffiliateInviteResolution {
	inviteCode := strings.TrimSpace(input.InviteCode)
	if inviteCode == "" || input.InviterUserId <= 0 {
		return AffiliateInviteResolution{Source: AffiliateInviteSourceNone}
	}

	resolution := AffiliateInviteResolution{
		Source:        AffiliateInviteSourceNormal,
		InviterUserId: input.InviterUserId,
		InviteCode:    inviteCode,
	}

	if !input.ModuleEnabled {
		return resolution
	}

	if input.InviterAffiliateStatus != model.AffiliateProfileStatusActive {
		return resolution
	}

	if input.InviterAffiliateLevel != 1 && input.InviterAffiliateLevel != 2 {
		return resolution
	}

	resolution.Source = AffiliateInviteSourceAffiliate
	return resolution
}

func ResolveInviteContext(db *gorm.DB, input AffiliateInviteContextInput) (*AffiliateInviteContext, error) {
	ctx := &AffiliateInviteContext{
		Source:         AffiliateInviteSourceNone,
		InviteCode:     strings.TrimSpace(input.InviteCode),
		RegisterMethod: strings.TrimSpace(input.RegisterMethod),
		Provider:       strings.TrimSpace(input.Provider),
	}
	if db == nil {
		return nil, errors.New("nil db")
	}
	if ctx.InviteCode == "" {
		return ctx, nil
	}

	var inviter model.User
	err := db.Select("id").Where("aff_code = ?", ctx.InviteCode).First(&inviter).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return ctx, nil
	}
	if err != nil {
		return nil, err
	}

	var profile model.AffiliateProfile
	err = db.
		Where("user_id = ? AND status = ?", inviter.Id, model.AffiliateProfileStatusActive).
		First(&profile).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	resolution := ResolveAffiliateInviteSource(AffiliateInviteInput{
		ModuleEnabled:          input.ModuleEnabled,
		InviteCode:             ctx.InviteCode,
		InviterUserId:          inviter.Id,
		InviterAffiliateStatus: profile.Status,
		InviterAffiliateLevel:  profile.Level,
	})
	ctx.Source = resolution.Source
	ctx.InviterUserId = resolution.InviterUserId
	ctx.InviteCode = resolution.InviteCode
	return ctx, nil
}

func RecordAffiliateInviteEvent(db *gorm.DB, input AffiliateInviteEventInput) (*model.AffiliateInviteEvent, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}
	if input.InviteeUserId <= 0 {
		return nil, errors.New("invalid invitee user id")
	}

	source := strings.TrimSpace(input.InviteSource)
	if source == "" {
		source = AffiliateInviteSourceNone
	}
	event := &model.AffiliateInviteEvent{
		InviteeUserId:      input.InviteeUserId,
		InviterUserId:      input.InviterUserId,
		InviteCode:         strings.TrimSpace(input.InviteCode),
		InviteSource:       source,
		RegisterMethod:     strings.TrimSpace(input.RegisterMethod),
		Provider:           strings.TrimSpace(input.Provider),
		RuleSetId:          input.RuleSetId,
		InitialQuota:       input.InitialQuota,
		InitialAmountCents: input.InitialAmountCents,
		InitialQuotaRule:   strings.TrimSpace(input.InitialQuotaRule),
		Status:             model.AffiliateEventStatusReady,
		Metadata:           input.Metadata,
	}
	if err := db.Create(event).Error; err != nil {
		return nil, err
	}
	return event, nil
}

type AffiliateScopeInput struct {
	UserId        int
	Role          int
	ProfileStatus string
	ProfileLevel  int
}

type AffiliateScope struct {
	Kind           string
	UserId         int
	AffiliateLevel int
	MaxDepth       int
}

type AffiliateVisibleUserIds struct {
	Global  bool
	UserIds []int
}

type AffiliateTeamTree struct {
	Items []AffiliateTeamTreeNode `json:"items"`
	Total int                     `json:"total"`
}

type AffiliateTeamTreeNode struct {
	UserId          int                     `json:"user_id"`
	Username        string                  `json:"username"`
	AffiliateLevel  int                     `json:"affiliate_level"`
	ParentUserId    int                     `json:"parent_user_id"`
	DirectInviterId int                     `json:"direct_inviter_id"`
	Depth           int                     `json:"depth"`
	Source          string                  `json:"source"`
	EffectiveAt     int64                   `json:"effective_at"`
	Children        []AffiliateTeamTreeNode `json:"children"`
}

type affiliateTeamEdge struct {
	UserId          int
	DirectInviterId int
	Depth           int
	Source          string
	EffectiveAt     int64
	Sidecar         bool
}

func ResolveAffiliateAccessScope(input AffiliateScopeInput) AffiliateScope {
	if input.Role == common.RoleRootUser || input.Role == common.RoleAdminUser {
		return AffiliateScope{
			Kind:   AffiliateScopeGlobal,
			UserId: input.UserId,
		}
	}

	scope := AffiliateScope{
		Kind:   AffiliateScopeNone,
		UserId: input.UserId,
	}

	if input.ProfileStatus != model.AffiliateProfileStatusActive {
		return scope
	}

	switch input.ProfileLevel {
	case 1:
		scope.Kind = AffiliateScopeAffiliate
		scope.AffiliateLevel = 1
		scope.MaxDepth = 2
	case 2:
		scope.Kind = AffiliateScopeAffiliate
		scope.AffiliateLevel = 2
		scope.MaxDepth = 1
	}

	return scope
}

func ListAffiliateVisibleUserIds(db *gorm.DB, scope AffiliateScope) (AffiliateVisibleUserIds, error) {
	if scope.Kind == AffiliateScopeGlobal {
		return AffiliateVisibleUserIds{Global: true}, nil
	}
	if scope.Kind != AffiliateScopeAffiliate {
		return AffiliateVisibleUserIds{}, errors.New("affiliate scope unavailable")
	}
	if db == nil {
		return AffiliateVisibleUserIds{}, errors.New("nil db")
	}
	if scope.UserId <= 0 || scope.MaxDepth <= 0 {
		return AffiliateVisibleUserIds{}, errors.New("invalid affiliate scope")
	}

	var relations []model.AffiliateRelation
	if err := db.
		Select("descendant_user_id").
		Where(
			"ancestor_user_id = ? AND status = ? AND depth >= ? AND depth <= ?",
			scope.UserId,
			model.AffiliateProfileStatusActive,
			1,
			scope.MaxDepth,
		).
		Order("depth asc, descendant_user_id asc").
		Find(&relations).Error; err != nil {
		return AffiliateVisibleUserIds{}, err
	}

	seen := make(map[int]bool, len(relations))
	userIds := make([]int, 0, len(relations))
	for _, relation := range relations {
		if relation.DescendantUserId <= 0 || seen[relation.DescendantUserId] {
			continue
		}
		seen[relation.DescendantUserId] = true
		userIds = append(userIds, relation.DescendantUserId)
	}

	legacyUserIds, err := listLegacyAffiliateVisibleUserIds(db, scope)
	if err != nil {
		return AffiliateVisibleUserIds{}, err
	}
	for _, userId := range legacyUserIds {
		if userId <= 0 || seen[userId] {
			continue
		}
		seen[userId] = true
		userIds = append(userIds, userId)
	}

	return AffiliateVisibleUserIds{UserIds: userIds}, nil
}

func listLegacyAffiliateVisibleUserIds(db *gorm.DB, scope AffiliateScope) ([]int, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}
	if scope.Kind != AffiliateScopeAffiliate || scope.UserId <= 0 || scope.MaxDepth <= 0 {
		return []int{}, nil
	}

	seen := map[int]bool{scope.UserId: true}
	current := []int{scope.UserId}
	result := make([]int, 0)
	for depth := 1; depth <= scope.MaxDepth && len(current) > 0; depth++ {
		var users []model.User
		if err := db.
			Select("id").
			Where("inviter_id IN ?", current).
			Order("id asc").
			Find(&users).Error; err != nil {
			return nil, err
		}

		next := make([]int, 0, len(users))
		for _, user := range users {
			if user.Id <= 0 || seen[user.Id] {
				continue
			}
			seen[user.Id] = true
			result = append(result, user.Id)
			next = append(next, user.Id)
		}
		current = next
	}
	return result, nil
}

func BuildAffiliateTeamTree(db *gorm.DB, scope AffiliateScope) (AffiliateTeamTree, error) {
	if db == nil {
		return AffiliateTeamTree{}, errors.New("nil db")
	}
	if scope.Kind == AffiliateScopeGlobal {
		return buildGlobalAffiliateTeamTree(db)
	}
	if scope.Kind != AffiliateScopeAffiliate {
		return AffiliateTeamTree{}, errors.New("affiliate scope unavailable")
	}
	if scope.UserId <= 0 || scope.MaxDepth <= 0 {
		return AffiliateTeamTree{}, errors.New("invalid affiliate scope")
	}

	edges, err := collectAffiliateTeamEdges(db, scope.UserId, scope.MaxDepth)
	if err != nil {
		return AffiliateTeamTree{}, err
	}
	return buildAffiliateTeamTreeFromEdges(db, scope.UserId, edges)
}

func buildGlobalAffiliateTeamTree(db *gorm.DB) (AffiliateTeamTree, error) {
	var profiles []model.AffiliateProfile
	if err := db.
		Where("level = ? AND status = ?", 1, model.AffiliateProfileStatusActive).
		Order("user_id asc").
		Find(&profiles).Error; err != nil {
		return AffiliateTeamTree{}, err
	}
	items := make([]AffiliateTeamTreeNode, 0, len(profiles))
	total := 0
	for _, profile := range profiles {
		scope := AffiliateScope{
			Kind:           AffiliateScopeAffiliate,
			UserId:         profile.UserId,
			AffiliateLevel: 1,
			MaxDepth:       2,
		}
		tree, err := BuildAffiliateTeamTree(db, scope)
		if err != nil {
			return AffiliateTeamTree{}, err
		}
		root := AffiliateTeamTreeNode{
			UserId:         profile.UserId,
			AffiliateLevel: profile.Level,
			ParentUserId:   profile.ParentUserId,
			Depth:          0,
			Children:       tree.Items,
		}
		fillAffiliateTeamNodeUsers(db, []int{root.UserId}, map[int]*AffiliateTeamTreeNode{root.UserId: &root})
		items = append(items, root)
		total += 1 + tree.Total
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].UserId < items[j].UserId
	})
	return AffiliateTeamTree{Items: items, Total: total}, nil
}

func collectAffiliateTeamEdges(db *gorm.DB, rootUserId int, maxDepth int) (map[int]affiliateTeamEdge, error) {
	edges := make(map[int]affiliateTeamEdge)

	var relations []model.AffiliateRelation
	if err := db.
		Where(
			"ancestor_user_id = ? AND status = ? AND depth >= ? AND depth <= ?",
			rootUserId,
			model.AffiliateProfileStatusActive,
			1,
			maxDepth,
		).
		Order("depth asc, descendant_user_id asc").
		Find(&relations).Error; err != nil {
		return nil, err
	}
	for _, relation := range relations {
		if relation.DescendantUserId <= 0 {
			continue
		}
		directInviterId := relation.DirectInviterId
		if directInviterId <= 0 {
			if relation.Depth == 1 {
				directInviterId = rootUserId
			} else {
				directInviterId = rootUserId
			}
		}
		mergeAffiliateTeamEdge(edges, affiliateTeamEdge{
			UserId:          relation.DescendantUserId,
			DirectInviterId: directInviterId,
			Depth:           relation.Depth,
			Source:          relation.Source,
			EffectiveAt:     relation.EffectiveAt,
			Sidecar:         true,
		})
	}

	seen := map[int]bool{rootUserId: true}
	current := []int{rootUserId}
	for depth := 1; depth <= maxDepth && len(current) > 0; depth++ {
		var users []model.User
		if err := db.
			Select("id, inviter_id").
			Where("inviter_id IN ?", current).
			Order("id asc").
			Find(&users).Error; err != nil {
			return nil, err
		}
		next := make([]int, 0, len(users))
		for _, user := range users {
			if user.Id <= 0 || seen[user.Id] {
				continue
			}
			seen[user.Id] = true
			next = append(next, user.Id)
			mergeAffiliateTeamEdge(edges, affiliateTeamEdge{
				UserId:          user.Id,
				DirectInviterId: user.InviterId,
				Depth:           depth,
				Source:          "legacy_inviter",
			})
		}
		current = next
	}

	return edges, nil
}

func mergeAffiliateTeamEdge(edges map[int]affiliateTeamEdge, edge affiliateTeamEdge) {
	if edge.UserId <= 0 || edge.Depth <= 0 {
		return
	}
	existing, ok := edges[edge.UserId]
	if !ok || edge.Depth < existing.Depth || (edge.Depth == existing.Depth && edge.Sidecar && !existing.Sidecar) {
		edges[edge.UserId] = edge
	}
}

func buildAffiliateTeamTreeFromEdges(db *gorm.DB, rootUserId int, edges map[int]affiliateTeamEdge) (AffiliateTeamTree, error) {
	if len(edges) == 0 {
		return AffiliateTeamTree{Items: []AffiliateTeamTreeNode{}, Total: 0}, nil
	}

	nodes := make(map[int]*AffiliateTeamTreeNode, len(edges))
	userIds := make([]int, 0, len(edges))
	for userId, edge := range edges {
		edgeCopy := edge
		nodes[userId] = &AffiliateTeamTreeNode{
			UserId:          edgeCopy.UserId,
			DirectInviterId: edgeCopy.DirectInviterId,
			Depth:           edgeCopy.Depth,
			Source:          edgeCopy.Source,
			EffectiveAt:     edgeCopy.EffectiveAt,
			Children:        []AffiliateTeamTreeNode{},
		}
		userIds = append(userIds, userId)
	}
	fillAffiliateTeamNodeUsers(db, userIds, nodes)

	childrenByParent := make(map[int][]*AffiliateTeamTreeNode)
	for _, node := range nodes {
		parentId := node.DirectInviterId
		if parentId <= 0 {
			parentId = rootUserId
		}
		childrenByParent[parentId] = append(childrenByParent[parentId], node)
	}

	var buildChildren func(parentId int) []AffiliateTeamTreeNode
	buildChildren = func(parentId int) []AffiliateTeamTreeNode {
		children := childrenByParent[parentId]
		sort.Slice(children, func(i, j int) bool {
			if children[i].Depth != children[j].Depth {
				return children[i].Depth < children[j].Depth
			}
			return children[i].UserId < children[j].UserId
		})
		result := make([]AffiliateTeamTreeNode, 0, len(children))
		for _, child := range children {
			childCopy := *child
			childCopy.Children = buildChildren(child.UserId)
			result = append(result, childCopy)
		}
		return result
	}

	items := buildChildren(rootUserId)
	return AffiliateTeamTree{Items: items, Total: len(edges)}, nil
}

func fillAffiliateTeamNodeUsers(db *gorm.DB, userIds []int, nodes map[int]*AffiliateTeamTreeNode) {
	if len(userIds) == 0 {
		return
	}
	var users []model.User
	if err := db.Select("id, username").Where("id IN ?", userIds).Find(&users).Error; err == nil {
		for _, user := range users {
			if node := nodes[user.Id]; node != nil {
				node.Username = user.Username
			}
		}
	}

	var profiles []model.AffiliateProfile
	if err := db.Select("user_id, level, parent_user_id").Where("user_id IN ? AND status = ?", userIds, model.AffiliateProfileStatusActive).Find(&profiles).Error; err == nil {
		for _, profile := range profiles {
			if node := nodes[profile.UserId]; node != nil {
				node.AffiliateLevel = profile.Level
				node.ParentUserId = profile.ParentUserId
			}
		}
	}
}

type AffiliateProfileCreateInput struct {
	UserId       int
	Level        int
	ParentUserId int
	InviteCode   string
	ActorUserId  int
	Reason       string
}

type AffiliateProfileSetInput struct {
	UserId       int
	Level        int
	ParentUserId int
	InviteCode   string
	ActorUserId  int
	Reason       string
}

type AffiliateProfileStatusInput struct {
	UserId      int
	ActorUserId int
	Reason      string
}

type AffiliateProfileListInput struct {
	UserId   int
	Level    int
	Status   string
	StartIdx int
	PageSize int
}

func ListAffiliateProfiles(db *gorm.DB, input AffiliateProfileListInput) ([]model.AffiliateProfile, int64, error) {
	if db == nil {
		return nil, 0, errors.New("nil db")
	}

	tx := db.Model(&model.AffiliateProfile{})
	if input.UserId > 0 {
		tx = tx.Where("user_id = ?", input.UserId)
	}
	if input.Level == 1 || input.Level == 2 {
		tx = tx.Where("level = ?", input.Level)
	}
	switch strings.ToLower(strings.TrimSpace(input.Status)) {
	case model.AffiliateProfileStatusActive, model.AffiliateProfileStatusDisabled:
		tx = tx.Where("status = ?", strings.ToLower(strings.TrimSpace(input.Status)))
	}

	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	pageSize := input.PageSize
	if pageSize <= 0 {
		pageSize = common.ItemsPerPage
	}
	if pageSize > 100 {
		pageSize = 100
	}
	startIdx := input.StartIdx
	if startIdx < 0 {
		startIdx = 0
	}

	var profiles []model.AffiliateProfile
	if err := tx.
		Order("updated_at desc, id desc").
		Offset(startIdx).
		Limit(pageSize).
		Find(&profiles).Error; err != nil {
		return nil, 0, err
	}
	fillAffiliateProfileInviteCodes(db, profiles)
	return profiles, total, nil
}

func fillAffiliateProfileInviteCodes(db *gorm.DB, profiles []model.AffiliateProfile) {
	if db == nil || len(profiles) == 0 || !db.Migrator().HasTable(&model.User{}) {
		return
	}

	userIds := make([]int, 0, len(profiles))
	seen := make(map[int]struct{}, len(profiles))
	for _, profile := range profiles {
		for _, userId := range []int{profile.UserId, profile.ParentUserId} {
			if userId <= 0 {
				continue
			}
			if _, ok := seen[userId]; ok {
				continue
			}
			seen[userId] = struct{}{}
			userIds = append(userIds, userId)
		}
	}
	if len(userIds) == 0 {
		return
	}

	var users []model.User
	if err := db.Select("id", "username", "aff_code").Where("id IN ?", userIds).Find(&users).Error; err != nil {
		return
	}
	codes := make(map[int]string, len(users))
	usernames := make(map[int]string, len(users))
	for _, user := range users {
		usernames[user.Id] = user.Username
		if code := resolveOrCreateUserAffiliateCode(db, user); code != "" {
			codes[user.Id] = code
		}
	}
	for index := range profiles {
		profiles[index].Username = usernames[profiles[index].UserId]
		profiles[index].ParentUsername = usernames[profiles[index].ParentUserId]
		if strings.TrimSpace(profiles[index].InviteCode) == "" {
			profiles[index].InviteCode = codes[profiles[index].UserId]
		}
	}
}

func resolveAffiliateProfileInviteCode(db *gorm.DB, userId int, inputCode string) string {
	code := strings.TrimSpace(inputCode)
	if code != "" || db == nil || userId <= 0 || !db.Migrator().HasTable(&model.User{}) {
		return code
	}

	var user model.User
	if err := db.Select("id", "aff_code").Where("id = ?", userId).First(&user).Error; err != nil {
		return ""
	}
	return resolveOrCreateUserAffiliateCode(db, user)
}

func resolveOrCreateUserAffiliateCode(db *gorm.DB, user model.User) string {
	if code := strings.TrimSpace(user.AffCode); code != "" {
		return code
	}
	if db == nil || user.Id <= 0 {
		return ""
	}
	for attempt := 0; attempt < 8; attempt++ {
		code := common.GetRandomString(4)
		if strings.TrimSpace(code) == "" {
			continue
		}
		result := db.Model(&model.User{}).
			Where("id = ? AND (aff_code = '' OR aff_code IS NULL)", user.Id).
			Update("aff_code", code)
		if result.Error == nil && result.RowsAffected > 0 {
			return code
		}
		var refreshed model.User
		if err := db.Select("id", "aff_code").Where("id = ?", user.Id).First(&refreshed).Error; err == nil {
			if refreshedCode := strings.TrimSpace(refreshed.AffCode); refreshedCode != "" {
				return refreshedCode
			}
		}
	}
	return ""
}

func CreateAffiliateProfile(db *gorm.DB, input AffiliateProfileCreateInput) (*model.AffiliateProfile, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}
	if input.UserId <= 0 {
		return nil, errors.New("invalid affiliate user id")
	}
	if input.Level != 1 && input.Level != 2 {
		return nil, errors.New("invalid affiliate level")
	}
	if err := validateAffiliateProfileHierarchy(db, input.UserId, input.Level, input.ParentUserId); err != nil {
		return nil, err
	}

	now := common.GetTimestamp()
	profile := &model.AffiliateProfile{
		UserId:       input.UserId,
		Level:        input.Level,
		ParentUserId: input.ParentUserId,
		InviteCode:   resolveAffiliateProfileInviteCode(db, input.UserId, input.InviteCode),
		Status:       model.AffiliateProfileStatusActive,
		ActivatedAt:  now,
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(profile).Error; err != nil {
			return err
		}
		return RecordAffiliateAuditLog(tx, AffiliateAuditInput{
			ActorUserId:  input.ActorUserId,
			TargetUserId: input.UserId,
			TargetType:   "profile",
			TargetId:     profile.Id,
			Action:       AffiliateAuditActionCreateProfile,
			AfterSnapshot: common.GetJsonString(map[string]interface{}{
				"user_id":        profile.UserId,
				"level":          profile.Level,
				"status":         profile.Status,
				"parent_user_id": profile.ParentUserId,
			}),
			Reason: input.Reason,
		})
	})
	if err != nil {
		return nil, err
	}

	return profile, nil
}

func SetAffiliateProfile(db *gorm.DB, input AffiliateProfileSetInput) (*model.AffiliateProfile, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}
	if input.UserId <= 0 {
		return nil, errors.New("invalid affiliate user id")
	}
	if input.Level != 1 && input.Level != 2 {
		return nil, errors.New("invalid affiliate level")
	}
	if err := validateAffiliateProfileHierarchy(db, input.UserId, input.Level, input.ParentUserId); err != nil {
		return nil, err
	}

	var saved model.AffiliateProfile
	err := db.Transaction(func(tx *gorm.DB) error {
		var existing model.AffiliateProfile
		err := tx.Where("user_id = ?", input.UserId).First(&existing).Error
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if errors.Is(err, gorm.ErrRecordNotFound) {
			created, err := CreateAffiliateProfile(tx, AffiliateProfileCreateInput(input))
			if err != nil {
				return err
			}
			saved = *created
			return nil
		}

		before := common.GetJsonString(map[string]interface{}{
			"user_id":        existing.UserId,
			"level":          existing.Level,
			"status":         existing.Status,
			"parent_user_id": existing.ParentUserId,
			"invite_code":    existing.InviteCode,
		})

		now := common.GetTimestamp()
		existing.Level = input.Level
		existing.ParentUserId = input.ParentUserId
		existing.InviteCode = resolveAffiliateProfileInviteCode(tx, input.UserId, input.InviteCode)
		existing.Status = model.AffiliateProfileStatusActive
		existing.DisabledAt = 0
		if existing.ActivatedAt == 0 {
			existing.ActivatedAt = now
		}

		if err := tx.Save(&existing).Error; err != nil {
			return err
		}
		saved = existing
		return RecordAffiliateAuditLog(tx, AffiliateAuditInput{
			ActorUserId:    input.ActorUserId,
			TargetUserId:   input.UserId,
			TargetType:     "profile",
			TargetId:       existing.Id,
			Action:         AffiliateAuditActionUpdateProfile,
			BeforeSnapshot: before,
			AfterSnapshot: common.GetJsonString(map[string]interface{}{
				"user_id":        existing.UserId,
				"level":          existing.Level,
				"status":         existing.Status,
				"parent_user_id": existing.ParentUserId,
				"invite_code":    existing.InviteCode,
			}),
			Reason: input.Reason,
		})
	})
	if err != nil {
		return nil, err
	}
	return &saved, nil
}

func validateAffiliateProfileHierarchy(db *gorm.DB, userId int, level int, parentUserId int) error {
	if level == 1 {
		if parentUserId != 0 {
			return errors.New("level one affiliate cannot have parent")
		}
		return nil
	}
	if parentUserId <= 0 {
		return errors.New("level two affiliate requires level one parent")
	}
	if parentUserId == userId {
		return errors.New("affiliate parent cannot point to self")
	}

	var parent model.AffiliateProfile
	err := db.
		Where("user_id = ? AND level = ? AND status = ?", parentUserId, 1, model.AffiliateProfileStatusActive).
		First(&parent).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return errors.New("level two affiliate requires active level one parent")
	}
	return err
}

func DisableAffiliateProfile(db *gorm.DB, input AffiliateProfileStatusInput) error {
	if db == nil {
		return errors.New("nil db")
	}
	if input.UserId <= 0 {
		return errors.New("invalid affiliate user id")
	}

	return db.Transaction(func(tx *gorm.DB) error {
		var profile model.AffiliateProfile
		if err := tx.Where("user_id = ?", input.UserId).First(&profile).Error; err != nil {
			return err
		}

		before := common.GetJsonString(map[string]interface{}{
			"user_id":        profile.UserId,
			"level":          profile.Level,
			"status":         profile.Status,
			"parent_user_id": profile.ParentUserId,
		})

		now := common.GetTimestamp()
		profile.Status = model.AffiliateProfileStatusDisabled
		profile.DisabledAt = now
		if err := tx.Save(&profile).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.AffiliateRelation{}).
			Where(
				"(ancestor_user_id = ? OR descendant_user_id = ?) AND status = ?",
				input.UserId,
				input.UserId,
				model.AffiliateProfileStatusActive,
			).
			Updates(map[string]interface{}{
				"status":     model.AffiliateProfileStatusDisabled,
				"ended_at":   now,
				"updated_at": now,
			}).Error; err != nil {
			return err
		}

		return RecordAffiliateAuditLog(tx, AffiliateAuditInput{
			ActorUserId:    input.ActorUserId,
			TargetUserId:   input.UserId,
			TargetType:     "profile",
			TargetId:       profile.Id,
			Action:         AffiliateAuditActionDisableProfile,
			BeforeSnapshot: before,
			AfterSnapshot: common.GetJsonString(map[string]interface{}{
				"user_id":        profile.UserId,
				"level":          profile.Level,
				"status":         profile.Status,
				"parent_user_id": profile.ParentUserId,
			}),
			Reason: input.Reason,
		})
	})
}

func EnableAffiliateProfile(db *gorm.DB, input AffiliateProfileStatusInput) (*model.AffiliateProfile, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}
	if input.UserId <= 0 {
		return nil, errors.New("invalid affiliate user id")
	}

	var saved model.AffiliateProfile
	err := db.Transaction(func(tx *gorm.DB) error {
		var profile model.AffiliateProfile
		if err := tx.Where("user_id = ?", input.UserId).First(&profile).Error; err != nil {
			return err
		}

		before := common.GetJsonString(map[string]interface{}{
			"user_id":        profile.UserId,
			"level":          profile.Level,
			"status":         profile.Status,
			"parent_user_id": profile.ParentUserId,
		})

		now := common.GetTimestamp()
		profile.Status = model.AffiliateProfileStatusActive
		profile.DisabledAt = 0
		if profile.ActivatedAt == 0 {
			profile.ActivatedAt = now
		}
		if err := tx.Save(&profile).Error; err != nil {
			return err
		}
		saved = profile
		return RecordAffiliateAuditLog(tx, AffiliateAuditInput{
			ActorUserId:    input.ActorUserId,
			TargetUserId:   input.UserId,
			TargetType:     "profile",
			TargetId:       profile.Id,
			Action:         AffiliateAuditActionEnableProfile,
			BeforeSnapshot: before,
			AfterSnapshot: common.GetJsonString(map[string]interface{}{
				"user_id":        profile.UserId,
				"level":          profile.Level,
				"status":         profile.Status,
				"parent_user_id": profile.ParentUserId,
			}),
			Reason: input.Reason,
		})
	})
	if err != nil {
		return nil, err
	}
	return &saved, nil
}

type AffiliateRelationCreateInput struct {
	InviterUserId int
	InviteeUserId int
	InviteEventId int
	Source        string
	EffectiveAt   int64
}

func BuildAffiliateInviteRelations(db *gorm.DB, input AffiliateRelationCreateInput) error {
	if db == nil {
		return errors.New("nil db")
	}
	if input.InviterUserId <= 0 || input.InviteeUserId <= 0 {
		return errors.New("invalid affiliate relation users")
	}
	if input.InviterUserId == input.InviteeUserId {
		return errors.New("affiliate relation cannot point to self")
	}

	effectiveAt := input.EffectiveAt
	if effectiveAt == 0 {
		effectiveAt = common.GetTimestamp()
	}
	source := strings.TrimSpace(input.Source)
	if source == "" {
		source = AffiliateInviteSourceNormal
	}

	return db.Transaction(func(tx *gorm.DB) error {
		direct := model.AffiliateRelation{
			AncestorUserId:   input.InviterUserId,
			DescendantUserId: input.InviteeUserId,
			Depth:            1,
			DirectInviterId:  input.InviterUserId,
			InviteEventId:    input.InviteEventId,
			Status:           model.AffiliateProfileStatusActive,
			Source:           source,
			EffectiveAt:      effectiveAt,
		}
		if err := createAffiliateRelationIfMissing(tx, direct); err != nil {
			return err
		}

		var ancestors []model.AffiliateRelation
		if err := tx.Where(
			"descendant_user_id = ? AND status = ? AND depth < ?",
			input.InviterUserId,
			model.AffiliateProfileStatusActive,
			2,
		).Order("depth asc").Find(&ancestors).Error; err != nil {
			return err
		}

		for _, ancestor := range ancestors {
			depth := ancestor.Depth + 1
			if depth > 2 {
				continue
			}
			relation := model.AffiliateRelation{
				AncestorUserId:   ancestor.AncestorUserId,
				DescendantUserId: input.InviteeUserId,
				Depth:            depth,
				DirectInviterId:  input.InviterUserId,
				InviteEventId:    input.InviteEventId,
				Status:           model.AffiliateProfileStatusActive,
				Source:           source,
				EffectiveAt:      effectiveAt,
			}
			if err := createAffiliateRelationIfMissing(tx, relation); err != nil {
				return err
			}
		}

		return nil
	})
}

func createAffiliateRelationIfMissing(db *gorm.DB, relation model.AffiliateRelation) error {
	return db.Clauses(clause.OnConflict{DoNothing: true}).Create(&relation).Error
}

type AffiliateAuditInput struct {
	ActorUserId    int
	TargetUserId   int
	TargetType     string
	TargetId       int
	Action         string
	BeforeSnapshot string
	AfterSnapshot  string
	Reason         string
	RequestId      string
	Ip             string
}

func RecordAffiliateAuditLog(db *gorm.DB, input AffiliateAuditInput) error {
	if db == nil {
		return errors.New("nil db")
	}
	if strings.TrimSpace(input.Action) == "" {
		return errors.New("empty affiliate audit action")
	}

	audit := model.AffiliateAuditLog{
		ActorUserId:    input.ActorUserId,
		TargetUserId:   input.TargetUserId,
		TargetType:     strings.TrimSpace(input.TargetType),
		TargetId:       input.TargetId,
		Action:         strings.TrimSpace(input.Action),
		BeforeSnapshot: input.BeforeSnapshot,
		AfterSnapshot:  input.AfterSnapshot,
		Reason:         strings.TrimSpace(input.Reason),
		RequestId:      strings.TrimSpace(input.RequestId),
		Ip:             strings.TrimSpace(input.Ip),
		CreatedAt:      common.GetTimestamp(),
	}
	return db.Create(&audit).Error
}
