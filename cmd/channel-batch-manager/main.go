// channel-batch-manager 是一个渠道批量管理工具
// 用于批量导入渠道、按 Tag 管理渠道、查看统计信息
//
// 使用方式:
//
//	go build -o bin/channel-batch-manager ./cmd/channel-batch-manager
//	./bin/channel-batch-manager stats
//	./bin/channel-batch-manager disable -tag merchant-a-batch1
//	./bin/channel-batch-manager enable -tag merchant-a-batch1
//	./bin/channel-batch-manager import -file channels.csv -tag merchant-a-batch1
package main

import (
	"encoding/csv"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/joho/godotenv"
)

// ChannelTypeMap 渠道类型映射
var ChannelTypeMap = map[string]int{
	"openai":    1,
	"azure":     3,
	"anthropic": 14,
	"claude":    14,
	"gemini":    24,
	"google":    24,
	"deepseek":  37,
	"mistral":   29,
	"groq":      31,
	"cohere":    26,
	"zhipu":     18,
	"qwen":      17,
	"baichuan":  25,
	"moonshot":  16,
	"minimax":   19,
	"custom":    8,
}

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(0)
	}

	command := os.Args[1]

	// 初始化资源
	if err := initResources(); err != nil {
		fmt.Printf("初始化失败: %v\n", err)
		os.Exit(1)
	}
	defer model.CloseDB()

	switch command {
	case "stats":
		cmdStats()
	case "disable":
		cmdDisable()
	case "enable":
		cmdEnable()
	case "import":
		cmdImport()
	case "export":
		cmdExport()
	case "set-tag":
		cmdSetTag()
	case "help", "-h", "--help":
		printUsage()
	default:
		fmt.Printf("未知命令: %s\n\n", command)
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println("渠道批量管理工具")
	fmt.Println()
	fmt.Println("用法:")
	fmt.Println("  channel-batch-manager <command> [options]")
	fmt.Println()
	fmt.Println("命令:")
	fmt.Println("  stats              查看 Tag 统计")
	fmt.Println("  disable -tag <tag> 按 Tag 禁用渠道")
	fmt.Println("  enable -tag <tag>  按 Tag 启用渠道")
	fmt.Println("  import -file <file> -tag <tag> [-priority <n>] [-group <groups>]")
	fmt.Println("                     从 CSV/JSON 文件导入渠道")
	fmt.Println("  export -file <file> [-tag <tag>]")
	fmt.Println("                     导出渠道到 CSV 文件")
	fmt.Println("  set-tag -ids <id1,id2,...> -tag <tag>")
	fmt.Println("                     为指定渠道设置 Tag")
	fmt.Println()
	fmt.Println("示例:")
	fmt.Println("  channel-batch-manager stats")
	fmt.Println("  channel-batch-manager disable -tag merchant-a-batch1")
	fmt.Println("  channel-batch-manager enable -tag merchant-a-batch1")
	fmt.Println("  channel-batch-manager import -file channels.csv -tag merchant-a-batch1 -priority 100")
	fmt.Println("  channel-batch-manager export -file backup.csv")
	fmt.Println("  channel-batch-manager set-tag -ids 1,2,3 -tag merchant-b")
}

func initResources() error {
	_ = godotenv.Load(".env")

	if os.Getenv("SESSION_SECRET") != "" {
		common.SessionSecret = os.Getenv("SESSION_SECRET")
	}
	if os.Getenv("CRYPTO_SECRET") != "" {
		common.CryptoSecret = os.Getenv("CRYPTO_SECRET")
	} else {
		common.CryptoSecret = common.SessionSecret
	}
	if os.Getenv("SQLITE_PATH") != "" {
		common.SQLitePath = os.Getenv("SQLITE_PATH")
	}

	common.DebugEnabled = os.Getenv("DEBUG") == "true"
	common.MemoryCacheEnabled = os.Getenv("MEMORY_CACHE_ENABLED") == "true"

	if err := model.InitDB(); err != nil {
		return fmt.Errorf("初始化数据库失败: %w", err)
	}

	model.InitOptionMap()

	return nil
}

func cmdStats() {
	channels, err := model.GetAllChannels(0, 10000, true, false)
	if err != nil {
		fmt.Printf("获取渠道列表失败: %v\n", err)
		os.Exit(1)
	}

	// 统计
	type TagStat struct {
		Total      int
		Enabled    int
		Disabled   int
		Priorities map[int64]int
	}

	stats := make(map[string]*TagStat)

	for _, ch := range channels {
		tag := "(无标签)"
		if ch.Tag != nil && *ch.Tag != "" {
			tag = *ch.Tag
		}

		if stats[tag] == nil {
			stats[tag] = &TagStat{
				Priorities: make(map[int64]int),
			}
		}

		stats[tag].Total++
		if ch.Status == common.ChannelStatusEnabled {
			stats[tag].Enabled++
		} else {
			stats[tag].Disabled++
		}

		priority := int64(0)
		if ch.Priority != nil {
			priority = *ch.Priority
		}
		stats[tag].Priorities[priority]++
	}

	// 排序 tags
	var tags []string
	for tag := range stats {
		tags = append(tags, tag)
	}
	sort.Strings(tags)

	// 打印
	fmt.Println()
	fmt.Println(strings.Repeat("=", 80))
	fmt.Println("渠道 Tag 统计")
	fmt.Println(strings.Repeat("=", 80))
	fmt.Printf("%-30s %8s %8s %8s %s\n", "Tag", "总数", "启用", "禁用", "优先级分布")
	fmt.Println(strings.Repeat("-", 80))

	for _, tag := range tags {
		stat := stats[tag]

		// 格式化优先级分布
		var priorities []string
		var priorityKeys []int64
		for p := range stat.Priorities {
			priorityKeys = append(priorityKeys, p)
		}
		sort.Slice(priorityKeys, func(i, j int) bool {
			return priorityKeys[i] > priorityKeys[j]
		})
		for _, p := range priorityKeys {
			priorities = append(priorities, fmt.Sprintf("P%d:%d", p, stat.Priorities[p]))
		}

		fmt.Printf("%-30s %8d %8d %8d %s\n",
			truncateString(tag, 30),
			stat.Total,
			stat.Enabled,
			stat.Disabled,
			strings.Join(priorities, ", "))
	}

	fmt.Println(strings.Repeat("=", 80))
	fmt.Printf("总计: %d 个渠道, %d 个 Tag\n", len(channels), len(stats))
}

func cmdDisable() {
	fs := flag.NewFlagSet("disable", flag.ExitOnError)
	tag := fs.String("tag", "", "渠道标签")
	fs.Parse(os.Args[2:])

	if *tag == "" {
		fmt.Println("错误: 必须指定 -tag 参数")
		os.Exit(1)
	}

	err := model.DisableChannelByTag(*tag)
	if err != nil {
		fmt.Printf("禁用失败: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("已禁用 Tag '%s' 的所有渠道\n", *tag)
}

func cmdEnable() {
	fs := flag.NewFlagSet("enable", flag.ExitOnError)
	tag := fs.String("tag", "", "渠道标签")
	fs.Parse(os.Args[2:])

	if *tag == "" {
		fmt.Println("错误: 必须指定 -tag 参数")
		os.Exit(1)
	}

	err := model.EnableChannelByTag(*tag)
	if err != nil {
		fmt.Printf("启用失败: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("已启用 Tag '%s' 的所有渠道\n", *tag)
}

func cmdImport() {
	fs := flag.NewFlagSet("import", flag.ExitOnError)
	file := fs.String("file", "", "导入文件路径 (CSV/JSON)")
	tag := fs.String("tag", "", "渠道标签")
	priority := fs.Int("priority", 100, "默认优先级")
	group := fs.String("group", "default,vip,free", "默认分组")
	fs.Parse(os.Args[2:])

	if *file == "" {
		fmt.Println("错误: 必须指定 -file 参数")
		os.Exit(1)
	}
	if *tag == "" {
		fmt.Println("错误: 必须指定 -tag 参数")
		os.Exit(1)
	}

	// 判断文件类型
	var success, fail int
	if strings.HasSuffix(*file, ".json") {
		success, fail = importFromJSON(*file, *tag, *priority, *group)
	} else {
		success, fail = importFromCSV(*file, *tag, *priority, *group)
	}

	fmt.Printf("\n导入完成: 成功 %d, 失败 %d\n", success, fail)
}

func importFromCSV(filepath string, tag string, defaultPriority int, defaultGroup string) (int, int) {
	f, err := os.Open(filepath)
	if err != nil {
		fmt.Printf("打开文件失败: %v\n", err)
		return 0, 0
	}
	defer f.Close()

	reader := csv.NewReader(f)
	records, err := reader.ReadAll()
	if err != nil {
		fmt.Printf("读取 CSV 失败: %v\n", err)
		return 0, 0
	}

	if len(records) < 2 {
		fmt.Println("CSV 文件为空或只有表头")
		return 0, 0
	}

	// 解析表头
	header := records[0]
	headerMap := make(map[string]int)
	for i, h := range header {
		headerMap[strings.ToLower(strings.TrimSpace(h))] = i
	}

	success, fail := 0, 0

	for i, row := range records[1:] {
		ch := buildChannelFromRow(row, headerMap, tag, defaultPriority, defaultGroup)
		if ch == nil {
			fmt.Printf("行 %d: 解析失败，跳过\n", i+2)
			fail++
			continue
		}

		if err := ch.Insert(); err != nil {
			fmt.Printf("行 %d: 插入失败: %v\n", i+2, err)
			fail++
		} else {
			fmt.Printf("行 %d: 创建渠道 #%d (%s)\n", i+2, ch.Id, ch.Name)
			success++
		}
	}

	return success, fail
}

func buildChannelFromRow(row []string, headerMap map[string]int, tag string, defaultPriority int, defaultGroup string) *model.Channel {
	getValue := func(key string, defaultVal string) string {
		if idx, ok := headerMap[key]; ok && idx < len(row) {
			return strings.TrimSpace(row[idx])
		}
		return defaultVal
	}

	getIntValue := func(key string, defaultVal int) int {
		if idx, ok := headerMap[key]; ok && idx < len(row) {
			if v, err := strconv.Atoi(strings.TrimSpace(row[idx])); err == nil {
				return v
			}
		}
		return defaultVal
	}

	name := getValue("name", fmt.Sprintf("导入渠道-%d", time.Now().UnixNano()))
	key := getValue("key", "")
	if key == "" {
		return nil
	}

	// 解析类型
	typeStr := strings.ToLower(getValue("type", "openai"))
	channelType := 1
	if t, ok := ChannelTypeMap[typeStr]; ok {
		channelType = t
	} else if t, err := strconv.Atoi(typeStr); err == nil {
		channelType = t
	}

	priority := int64(getIntValue("priority", defaultPriority))
	weight := uint(getIntValue("weight", 10))
	autoBan := 1

	baseURL := getValue("base_url", "")
	models := getValue("models", "gpt-4o,gpt-4o-mini")
	group := getValue("group", defaultGroup)

	ch := &model.Channel{
		Name:        name,
		Type:        channelType,
		Key:         key,
		BaseURL:     &baseURL,
		Models:      models,
		Group:       group,
		Priority:    &priority,
		Weight:      &weight,
		AutoBan:     &autoBan,
		Tag:         &tag,
		CreatedTime: time.Now().Unix(),
		Status:      common.ChannelStatusEnabled,
	}

	// 检查是否为多 Key
	if strings.Contains(key, "\n") {
		keys := strings.Split(key, "\n")
		ch.ChannelInfo.IsMultiKey = true
		ch.ChannelInfo.MultiKeySize = len(keys)
		ch.ChannelInfo.MultiKeyMode = constant.MultiKeyModeRandom
	}

	return ch
}

func importFromJSON(filepath string, tag string, defaultPriority int, defaultGroup string) (int, int) {
	data, err := os.ReadFile(filepath)
	if err != nil {
		fmt.Printf("读取文件失败: %v\n", err)
		return 0, 0
	}

	var channels []map[string]interface{}
	if err := json.Unmarshal(data, &channels); err != nil {
		fmt.Printf("解析 JSON 失败: %v\n", err)
		return 0, 0
	}

	success, fail := 0, 0

	for i, chData := range channels {
		ch := buildChannelFromJSON(chData, tag, defaultPriority, defaultGroup)
		if ch == nil {
			fmt.Printf("记录 %d: 解析失败，跳过\n", i+1)
			fail++
			continue
		}

		if err := ch.Insert(); err != nil {
			fmt.Printf("记录 %d: 插入失败: %v\n", i+1, err)
			fail++
		} else {
			fmt.Printf("记录 %d: 创建渠道 #%d (%s)\n", i+1, ch.Id, ch.Name)
			success++
		}
	}

	return success, fail
}

func buildChannelFromJSON(data map[string]interface{}, tag string, defaultPriority int, defaultGroup string) *model.Channel {
	getString := func(key string, defaultVal string) string {
		if v, ok := data[key].(string); ok {
			return v
		}
		return defaultVal
	}

	getInt := func(key string, defaultVal int) int {
		if v, ok := data[key].(float64); ok {
			return int(v)
		}
		return defaultVal
	}

	name := getString("name", fmt.Sprintf("导入渠道-%d", time.Now().UnixNano()))
	key := getString("key", "")
	if key == "" {
		return nil
	}

	priority := int64(getInt("priority", defaultPriority))
	weight := uint(getInt("weight", 10))
	autoBan := getInt("auto_ban", 1)

	baseURL := getString("base_url", "")
	models := getString("models", "gpt-4o,gpt-4o-mini")
	group := getString("group", defaultGroup)
	channelType := getInt("type", 1)

	ch := &model.Channel{
		Name:        name,
		Type:        channelType,
		Key:         key,
		BaseURL:     &baseURL,
		Models:      models,
		Group:       group,
		Priority:    &priority,
		Weight:      &weight,
		AutoBan:     &autoBan,
		Tag:         &tag,
		CreatedTime: time.Now().Unix(),
		Status:      common.ChannelStatusEnabled,
	}

	// 检查 channel_info
	if info, ok := data["channel_info"].(map[string]interface{}); ok {
		if isMultiKey, ok := info["is_multi_key"].(bool); ok && isMultiKey {
			ch.ChannelInfo.IsMultiKey = true
			if mode, ok := info["multi_key_mode"].(string); ok {
				ch.ChannelInfo.MultiKeyMode = constant.MultiKeyMode(mode)
			} else {
				ch.ChannelInfo.MultiKeyMode = constant.MultiKeyModeRandom
			}
			keys := strings.Split(key, "\n")
			ch.ChannelInfo.MultiKeySize = len(keys)
		}
	} else if strings.Contains(key, "\n") {
		keys := strings.Split(key, "\n")
		ch.ChannelInfo.IsMultiKey = true
		ch.ChannelInfo.MultiKeySize = len(keys)
		ch.ChannelInfo.MultiKeyMode = constant.MultiKeyModeRandom
	}

	return ch
}

func cmdExport() {
	fs := flag.NewFlagSet("export", flag.ExitOnError)
	file := fs.String("file", "", "导出文件路径")
	tag := fs.String("tag", "", "筛选标签（可选）")
	fs.Parse(os.Args[2:])

	if *file == "" {
		fmt.Println("错误: 必须指定 -file 参数")
		os.Exit(1)
	}

	var channels []*model.Channel
	var err error

	if *tag != "" {
		channels, err = model.GetChannelsByTag(*tag, false, true)
	} else {
		channels, err = model.GetAllChannels(0, 10000, true, false)
	}

	if err != nil {
		fmt.Printf("获取渠道失败: %v\n", err)
		os.Exit(1)
	}

	f, err := os.Create(*file)
	if err != nil {
		fmt.Printf("创建文件失败: %v\n", err)
		os.Exit(1)
	}
	defer f.Close()

	writer := csv.NewWriter(f)
	defer writer.Flush()

	// 写入表头
	header := []string{"id", "name", "type", "tag", "priority", "weight", "group", "status", "models", "base_url"}
	writer.Write(header)

	// 写入数据
	for _, ch := range channels {
		tag := ""
		if ch.Tag != nil {
			tag = *ch.Tag
		}
		priority := int64(0)
		if ch.Priority != nil {
			priority = *ch.Priority
		}
		weight := uint(0)
		if ch.Weight != nil {
			weight = *ch.Weight
		}
		baseURL := ""
		if ch.BaseURL != nil {
			baseURL = *ch.BaseURL
		}

		row := []string{
			strconv.Itoa(ch.Id),
			ch.Name,
			strconv.Itoa(ch.Type),
			tag,
			strconv.FormatInt(priority, 10),
			strconv.FormatUint(uint64(weight), 10),
			ch.Group,
			strconv.Itoa(ch.Status),
			ch.Models,
			baseURL,
		}
		writer.Write(row)
	}

	fmt.Printf("已导出 %d 个渠道到 %s\n", len(channels), *file)
}

func cmdSetTag() {
	fs := flag.NewFlagSet("set-tag", flag.ExitOnError)
	ids := fs.String("ids", "", "渠道 ID 列表（逗号分隔）")
	tag := fs.String("tag", "", "新标签")
	fs.Parse(os.Args[2:])

	if *ids == "" {
		fmt.Println("错误: 必须指定 -ids 参数")
		os.Exit(1)
	}
	if *tag == "" {
		fmt.Println("错误: 必须指定 -tag 参数")
		os.Exit(1)
	}

	// 解析 IDs
	var channelIds []int
	for _, idStr := range strings.Split(*ids, ",") {
		id, err := strconv.Atoi(strings.TrimSpace(idStr))
		if err != nil {
			fmt.Printf("无效的 ID: %s\n", idStr)
			continue
		}
		channelIds = append(channelIds, id)
	}

	if len(channelIds) == 0 {
		fmt.Println("没有有效的渠道 ID")
		os.Exit(1)
	}

	err := model.BatchSetChannelTag(channelIds, tag)
	if err != nil {
		fmt.Printf("设置 Tag 失败: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("已为 %d 个渠道设置 Tag '%s'\n", len(channelIds), *tag)
}

func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
