/**
 * 获取纯文本预览（去除HTML标签和Markdown格式）
 */
export function getPreviewText(
  content: string,
  maxLength: number = 60
): string {
  if (!content) return ''
  const plainText = content
    .replace(/<[^>]*>/g, '') // 去除HTML标签
    .replace(/[#*_]/g, '') // 去除Markdown格式符号
    .trim()
  return plainText.length > maxLength
    ? plainText.substring(0, maxLength) + '...'
    : plainText
}
