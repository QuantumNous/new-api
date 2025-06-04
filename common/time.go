package common

import (
	"time"
)

var (
	// BeijingLocation 北京时区
	// 优先使用 "Asia/Shanghai" 作为时区标识符，如果加载失败则使用固定偏移
	BeijingLocation = func() *time.Location {
		loc, err := time.LoadLocation("Asia/Shanghai")
		if err != nil {
			// 如果加载失败，使用固定偏移作为后备方案
			return time.FixedZone("CST", 8*3600)
		}
		return loc
	}()
)

// GetBeijingTime 获取当前北京时区的时间
func GetBeijingTime() time.Time {
	// 直接使用北京时区创建时间
	return time.Now().In(BeijingLocation)
}

// GetBeijingTimestamp 获取当前北京时区的时间戳
func GetBeijingTimestamp() int64 {
	// 直接获取北京时区的时间戳
	now := time.Now()
	// 计算与 UTC 的时差（8小时）
	offset := 8 * 3600
	// 返回北京时区的时间戳
	return now.Unix() + int64(offset)
}

// GetBeijingTimeFromTimestamp 从时间戳获取北京时区的时间
func GetBeijingTimeFromTimestamp(timestamp int64) time.Time {
	// 直接使用北京时区创建时间
	return time.Unix(timestamp, 0).In(BeijingLocation)
}

// GetBeijingTimeString 获取北京时区的格式化时间字符串
func GetBeijingTimeString() string {
	return GetBeijingTime().Format("2006-01-02 15:04:05")
}

// GetBeijingDate 获取北京时区的日期（年月日）
func GetBeijingDate() (year int, month time.Month, day int) {
	beijingTime := GetBeijingTime()
	return beijingTime.Year(), beijingTime.Month(), beijingTime.Day()
}

// GetBeijingHour 获取北京时区的小时
func GetBeijingHour() int {
	return GetBeijingTime().Hour()
}

// GetBeijingTimeFromString 从字符串解析北京时区的时间
func GetBeijingTimeFromString(timeStr string) (time.Time, error) {
	// 直接解析为北京时区的时间
	t, err := time.ParseInLocation("2006-01-02 15:04:05", timeStr, BeijingLocation)
	if err != nil {
		return time.Time{}, err
	}
	return t, nil
}
