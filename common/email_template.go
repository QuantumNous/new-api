package common

import (
	"strconv"
	"strings"
)

const DefaultEmailVerificationSubject = "{{system_name}}邮箱验证邮件"

const DefaultEmailVerificationHTML = "<p>您好，你正在进行{{system_name}}邮箱验证。</p>" +
	"<p>您的验证码为: <strong>{{code}}</strong></p>" +
	"<p>验证码 {{minutes}} 分钟内有效，如果不是本人操作，请忽略。</p>"

const DefaultEmailPasswordResetSubject = "{{system_name}}密码重置"

const DefaultEmailPasswordResetHTML = "<p>您好，你正在进行{{system_name}}密码重置。</p>" +
	"<p>点击 <a href='{{link}}'>此处</a> 进行密码重置。</p>" +
	"<p>如果链接无法点击，请尝试点击下面的链接或将其复制到浏览器中打开：<br> {{link}} </p>" +
	"<p>重置链接 {{minutes}} 分钟内有效，如果不是本人操作，请忽略。</p>"

func RenderEmailTemplate(custom string, fallback string, vars map[string]string) string {
	tmpl := strings.TrimSpace(custom)
	if tmpl == "" {
		tmpl = fallback
	}
	return applyEmailTemplateVars(tmpl, vars)
}

func applyEmailTemplateVars(tmpl string, vars map[string]string) string {
	for key, value := range vars {
		tmpl = strings.ReplaceAll(tmpl, "{{"+key+"}}", value)
	}
	return tmpl
}

func EmailTemplateVars(extra map[string]string) map[string]string {
	vars := map[string]string{
		"system_name": SystemName,
		"minutes":     strconv.Itoa(VerificationValidMinutes),
	}
	for key, value := range extra {
		vars[key] = value
	}
	return vars
}
