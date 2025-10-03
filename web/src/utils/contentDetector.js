/**
 * 检测内容类型并返回相应的渲染信息
 */

// 检查是否为 URL
export const isUrl = (content) => {
  try {
    new URL(content);
    return true;
  } catch {
    return false;
  }
};

// 检查是否为 HTML 内容
export const isHtmlContent = (content) => {
  if (!content || typeof content !== 'string') return false;
  
  // 检查是否包含HTML标签
  const htmlTagRegex = /<\/?[a-z][\s\S]*>/i;
  return htmlTagRegex.test(content);
};

// 检查是否为 Markdown 内容
export const isMarkdownContent = (content) => {
  if (!content || typeof content !== 'string') return false;
  
  // 如果已经是HTML，则不是原始Markdown
  if (isHtmlContent(content)) return false;
  
  // 检查Markdown特征
  const markdownFeatures = [
    /^#{1,6}\s+.+$/m,        // 标题
    /^\*\s+.+$/m,            // 无序列表
    /^\d+\.\s+.+$/m,         // 有序列表
    /\*\*.+\*\*/,            // 粗体
    /\*.+\*/,                // 斜体
    /\[.+\]\(.+\)/,          // 链接
    /^>.+$/m,                // 引用
    /^```[\s\S]*?```$/m,     // 代码块
    /`[^`]+`/,               // 行内代码
    /^\|.+\|$/m,             // 表格
    /^---+$/m,               // 分割线
  ];
  
  return markdownFeatures.some(regex => regex.test(content));
};

// 获取内容类型
export const getContentType = (content) => {
  if (!content) return 'empty';
  
  const trimmedContent = content.trim();
  
  if (isUrl(trimmedContent)) return 'url';
  if (isHtmlContent(trimmedContent)) return 'html';
  if (isMarkdownContent(trimmedContent)) return 'markdown';
  
  // 默认当作纯文本处理
  return 'text';
};