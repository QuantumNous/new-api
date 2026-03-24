package service

import (
	"fmt"
	"hash/fnv"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/cachex"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/samber/hot"
)

const (
	ginKeyMultiKeyStickyPendingBinding = "multi_key_sticky_pending_binding"
	ginKeyMultiKeyStickyFailedKeys     = "multi_key_sticky_failed_keys"
	ginKeyMultiKeyStickyAdminInfo      = "multi_key_sticky_admin_info"

	multiKeyStickyCacheNamespace = "new-api:multi_key_sticky:v1"
	multiKeyStickyBindingTTL     = 24 * time.Hour
	multiKeyStickyCacheCapacity  = 100_000
)

type multiKeyStickyBinding struct {
	RingFingerprint string `json:"ring_fingerprint"`
	KeyFingerprint  string `json:"key_fingerprint"`
	KeyIndex        int    `json:"key_index"`
	UpdatedAt       int64  `json:"updated_at"`
}

type multiKeyStickyPendingBinding struct {
	CacheKey         string
	Binding          multiKeyStickyBinding
	IdentityHash     string
	IdentitySource   string
	SelectedByRebind bool
}

type multiKeyStickyNode struct {
	Index       int
	Key         string
	Fingerprint string
	Score       uint64
}

var (
	multiKeyStickyCacheOnce sync.Once
	multiKeyStickyCache     *cachex.HybridCache[multiKeyStickyBinding]
)

func getMultiKeyStickyCache() *cachex.HybridCache[multiKeyStickyBinding] {
	multiKeyStickyCacheOnce.Do(func() {
		multiKeyStickyCache = cachex.NewHybridCache[multiKeyStickyBinding](cachex.HybridCacheConfig[multiKeyStickyBinding]{
			Namespace: multiKeyStickyCacheNamespace,
			Redis:     common.RDB,
			RedisEnabled: func() bool {
				return common.RedisEnabled && common.RDB != nil
			},
			RedisCodec: cachex.JSONCodec[multiKeyStickyBinding]{},
			Memory: func() *hot.HotCache[string, multiKeyStickyBinding] {
				return hot.NewHotCache[string, multiKeyStickyBinding](hot.LRU, multiKeyStickyCacheCapacity).
					WithTTL(multiKeyStickyBindingTTL).
					WithJanitor().
					Build()
			},
		})
	})
	return multiKeyStickyCache
}

func SelectMultiKey(c *gin.Context, channel *model.Channel) (string, int, *types.NewAPIError) {
	if channel == nil {
		return "", 0, types.NewError(fmt.Errorf("channel is nil"), types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry())
	}
	if channel.ChannelInfo.MultiKeyMode != constant.MultiKeyModeSticky {
		return channel.GetNextEnabledKey()
	}

	identity, source := getStickyIdentity(c)
	if identity == "" {
		return channel.GetNextEnabledKey()
	}

	keys := channel.GetKeys()
	if len(keys) == 0 {
		return "", 0, types.NewError(fmt.Errorf("no keys available"), types.ErrorCodeChannelNoAvailableKey)
	}

	lock := model.GetChannelPollingLock(channel.Id)
	lock.Lock()
	defer lock.Unlock()

	enabledNodes := buildEnabledStickyNodes(channel, keys)
	if len(enabledNodes) == 0 {
		return "", 0, types.NewError(fmt.Errorf("no enabled keys"), types.ErrorCodeChannelNoAvailableKey)
	}

	ringFingerprint := buildStickyRingFingerprint(enabledNodes)
	excluded := getFailedStickyKeyIndices(c, channel.Id)
	cacheKey := buildStickyBindingCacheKey(channel.Id, identity)

	if binding, ok := getStickyBinding(cacheKey, ringFingerprint); ok {
		if node, found := findStickyNode(enabledNodes, binding.KeyFingerprint, binding.KeyIndex, excluded); found {
			setPendingStickyBinding(c, cacheKey, ringFingerprint, node, identity, source, true)
			return node.Key, node.Index, nil
		}
	}

	ordered := orderStickyNodes(identity, enabledNodes)
	for _, node := range ordered {
		if _, skip := excluded[node.Index]; skip {
			continue
		}
		setPendingStickyBinding(c, cacheKey, ringFingerprint, node, identity, source, false)
		return node.Key, node.Index, nil
	}
	return "", 0, types.NewError(fmt.Errorf("no sticky keys available"), types.ErrorCodeChannelNoAvailableKey)
}

func RecordMultiKeyFailure(c *gin.Context, channelID int, channelMode constant.MultiKeyMode, keyIndex int) {
	if c == nil || channelID <= 0 || keyIndex < 0 || channelMode != constant.MultiKeyModeSticky {
		return
	}

	value, _ := c.Get(ginKeyMultiKeyStickyFailedKeys)
	failedByChannel, _ := value.(map[int]map[int]struct{})
	if failedByChannel == nil {
		failedByChannel = make(map[int]map[int]struct{})
	}
	if failedByChannel[channelID] == nil {
		failedByChannel[channelID] = make(map[int]struct{})
	}
	failedByChannel[channelID][keyIndex] = struct{}{}
	c.Set(ginKeyMultiKeyStickyFailedKeys, failedByChannel)
}

func CommitMultiKeyBinding(c *gin.Context) {
	if c == nil {
		return
	}
	anyBinding, ok := c.Get(ginKeyMultiKeyStickyPendingBinding)
	if !ok || anyBinding == nil {
		return
	}
	pending, ok := anyBinding.(multiKeyStickyPendingBinding)
	if !ok || pending.CacheKey == "" {
		return
	}
	if err := getMultiKeyStickyCache().SetWithTTL(pending.CacheKey, pending.Binding, multiKeyStickyBindingTTL); err != nil {
		common.SysError(fmt.Sprintf("multi key sticky cache set failed: key=%s, err=%v", pending.CacheKey, err))
	}
}

func AppendMultiKeyStickyAdminInfo(c *gin.Context, adminInfo map[string]interface{}) {
	if c == nil || adminInfo == nil {
		return
	}
	anyInfo, ok := c.Get(ginKeyMultiKeyStickyAdminInfo)
	if !ok || anyInfo == nil {
		return
	}
	if info, ok := anyInfo.(map[string]interface{}); ok && len(info) > 0 {
		adminInfo["multi_key_sticky"] = info
	}
}

func getStickyIdentity(c *gin.Context) (string, string) {
	if c == nil {
		return "", ""
	}
	if tokenID := common.GetContextKeyInt(c, constant.ContextKeyTokenId); tokenID > 0 {
		return "token_id:" + strconv.Itoa(tokenID), "token_id"
	}
	if tokenKey := strings.TrimSpace(common.GetContextKeyString(c, constant.ContextKeyTokenKey)); tokenKey != "" {
		return "token_key:" + tokenKey, "token_key"
	}
	if userID := common.GetContextKeyInt(c, constant.ContextKeyUserId); userID > 0 {
		return "user_id:" + strconv.Itoa(userID), "user_id"
	}
	return "", ""
}

func buildEnabledStickyNodes(channel *model.Channel, keys []string) []multiKeyStickyNode {
	statusList := channel.ChannelInfo.MultiKeyStatusList
	nodes := make([]multiKeyStickyNode, 0, len(keys))
	for idx, key := range keys {
		if statusList != nil {
			if status, ok := statusList[idx]; ok && status != common.ChannelStatusEnabled {
				continue
			}
		}
		nodes = append(nodes, multiKeyStickyNode{
			Index:       idx,
			Key:         key,
			Fingerprint: stickyFingerprint(key),
		})
	}
	return nodes
}

func buildStickyRingFingerprint(nodes []multiKeyStickyNode) string {
	if len(nodes) == 0 {
		return ""
	}
	fps := make([]string, 0, len(nodes))
	for _, node := range nodes {
		fps = append(fps, node.Fingerprint)
	}
	sort.Strings(fps)
	return stickyFingerprint(strings.Join(fps, ","))
}

func buildStickyBindingCacheKey(channelID int, identity string) string {
	if channelID <= 0 || identity == "" {
		return ""
	}
	return fmt.Sprintf("%d:%s", channelID, stickyFingerprint(identity))
}

func getStickyBinding(cacheKey, ringFingerprint string) (multiKeyStickyBinding, bool) {
	if cacheKey == "" || ringFingerprint == "" {
		return multiKeyStickyBinding{}, false
	}
	binding, found, err := getMultiKeyStickyCache().Get(cacheKey)
	if err != nil {
		common.SysError(fmt.Sprintf("multi key sticky cache get failed: key=%s, err=%v", cacheKey, err))
		return multiKeyStickyBinding{}, false
	}
	if !found || binding.RingFingerprint != ringFingerprint {
		return multiKeyStickyBinding{}, false
	}
	return binding, true
}

func findStickyNode(nodes []multiKeyStickyNode, fingerprint string, index int, excluded map[int]struct{}) (multiKeyStickyNode, bool) {
	for _, node := range nodes {
		if node.Index != index {
			continue
		}
		if fingerprint != "" && node.Fingerprint != fingerprint {
			continue
		}
		if _, skip := excluded[node.Index]; skip {
			return multiKeyStickyNode{}, false
		}
		return node, true
	}
	return multiKeyStickyNode{}, false
}

func orderStickyNodes(identity string, nodes []multiKeyStickyNode) []multiKeyStickyNode {
	ordered := make([]multiKeyStickyNode, 0, len(nodes))
	for _, node := range nodes {
		node.Score = stickyScore(identity, node.Fingerprint)
		ordered = append(ordered, node)
	}
	sort.SliceStable(ordered, func(i, j int) bool {
		if ordered[i].Score == ordered[j].Score {
			return ordered[i].Index < ordered[j].Index
		}
		return ordered[i].Score > ordered[j].Score
	})
	return ordered
}

func stickyScore(identity string, nodeFingerprint string) uint64 {
	hasher := fnv.New64a()
	_, _ = hasher.Write([]byte(identity))
	_, _ = hasher.Write([]byte{0})
	_, _ = hasher.Write([]byte(nodeFingerprint))
	return hasher.Sum64()
}

func stickyFingerprint(s string) string {
	if s == "" {
		return ""
	}
	sum := common.Sha1([]byte(s))
	if len(sum) > 12 {
		return sum[:12]
	}
	return sum
}

func setPendingStickyBinding(c *gin.Context, cacheKey string, ringFingerprint string, node multiKeyStickyNode, identity string, source string, selectedByRebind bool) {
	if c == nil || cacheKey == "" || ringFingerprint == "" {
		return
	}
	c.Set(ginKeyMultiKeyStickyPendingBinding, multiKeyStickyPendingBinding{
		CacheKey: cacheKey,
		Binding: multiKeyStickyBinding{
			RingFingerprint: ringFingerprint,
			KeyFingerprint:  node.Fingerprint,
			KeyIndex:        node.Index,
			UpdatedAt:       common.GetTimestamp(),
		},
		IdentityHash:     stickyFingerprint(identity),
		IdentitySource:   source,
		SelectedByRebind: selectedByRebind,
	})
	c.Set(ginKeyMultiKeyStickyAdminInfo, map[string]interface{}{
		"enabled":            true,
		"identity_source":    source,
		"identity_hash":      stickyFingerprint(identity),
		"ring_fingerprint":   ringFingerprint,
		"selected_key_index": node.Index,
		"selected_key_hash":  node.Fingerprint,
		"selected_by_rebind": selectedByRebind,
	})
}

func getFailedStickyKeyIndices(c *gin.Context, channelID int) map[int]struct{} {
	if c == nil || channelID <= 0 {
		return nil
	}
	value, ok := c.Get(ginKeyMultiKeyStickyFailedKeys)
	if !ok || value == nil {
		return nil
	}
	failedByChannel, ok := value.(map[int]map[int]struct{})
	if !ok {
		return nil
	}
	return failedByChannel[channelID]
}
