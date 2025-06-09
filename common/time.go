package common

import (
	"time"
)

var (
	// BeijingLocation 北京时区
	// 使用 "Asia/Shanghai" 作为时区标识符，如果加载失败则打印错误日志
	BeijingLocation = func() *time.Location {
		loc, err := time.LoadLocation("Asia/Shanghai")
		if err != nil {
			// 打印错误日志
			println("Failed to load Asia/Shanghai timezone:", err.Error())
			return time.UTC
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
	// 获取当前时间
	now := time.Now()

	// 获取系统时区信息
	zone, offset := now.Zone()

	// 检查是否是北京时区（CST 且 UTC+8）
	if zone != "CST" || offset != 8*3600 {
		// 如果不是北京时区，转换为北京时区
		now = now.In(BeijingLocation)
	}

	// 返回北京时区的时间戳
	return now.Unix()
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

// PrintTimeInfo 打印当前时区和时间信息
func PrintTimeInfo() {
	now := time.Now()
	zone, offset := now.Zone()
	beijingTime := GetBeijingTime()
	beijingTimestamp := GetBeijingTimestamp()

	println("系统时区:", zone)
	println("时区偏移:", offset/3600, "小时")
	println("系统时间:", now.Format("2006-01-02 15:04:05"))
	println("北京时间:", beijingTime.Format("2006-01-02 15:04:05"))
	println("日志存储的时间戳:", beijingTimestamp)
}
