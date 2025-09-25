/**
 * 剪贴板操作工具函数
 */

/**
 * 复制文本到剪贴板
 * @param text 要复制的文本
 * @returns Promise<boolean> 是否复制成功
 */
export async function copy(text: string): Promise<boolean> {
  try {
    // 首先尝试使用现代API
    await navigator.clipboard.writeText(text)
    return true
  } catch (e) {
    // 降级到旧方法
    try {
      const input = document.createElement('input')
      input.value = text
      document.body.appendChild(input)
      input.select()
      const result = document.execCommand('copy')
      document.body.removeChild(input)
      return result
    } catch (e) {
      console.error('Failed to copy text:', e)
      return false
    }
  }
}

/**
 * 从剪贴板读取文本
 * @returns Promise<string> 剪贴板中的文本
 */
export async function paste(): Promise<string> {
  try {
    if (navigator.clipboard && navigator.clipboard.readText) {
      return await navigator.clipboard.readText()
    }
    throw new Error('Clipboard API not supported')
  } catch (e) {
    console.error('Failed to read from clipboard:', e)
    return ''
  }
}

/**
 * 检查是否支持剪贴板API
 * @returns 是否支持
 */
export function isClipboardSupported(): boolean {
  return !!(navigator.clipboard && navigator.clipboard.writeText)
}

/**
 * 复制JSON对象到剪贴板
 * @param obj 要复制的对象
 * @param pretty 是否格式化JSON
 * @returns Promise<boolean> 是否复制成功
 */
export async function copyJSON(
  obj: any,
  pretty: boolean = true
): Promise<boolean> {
  try {
    const jsonString = pretty
      ? JSON.stringify(obj, null, 2)
      : JSON.stringify(obj)
    return await copy(jsonString)
  } catch (e) {
    console.error('Failed to copy JSON:', e)
    return false
  }
}

/**
 * 复制表格数据为CSV格式
 * @param data 表格数据
 * @param headers 表头
 * @returns Promise<boolean> 是否复制成功
 */
export async function copyAsCSV(
  data: any[],
  headers?: string[]
): Promise<boolean> {
  try {
    let csvContent = ''

    // 添加表头
    if (headers) {
      csvContent += headers.join(',') + '\n'
    }

    // 添加数据行
    data.forEach((row) => {
      const values = Object.values(row).map((value) =>
        typeof value === 'string' && value.includes(',')
          ? `"${value}"`
          : String(value)
      )
      csvContent += values.join(',') + '\n'
    })

    return await copy(csvContent)
  } catch (e) {
    console.error('Failed to copy CSV:', e)
    return false
  }
}

/**
 * 复制链接地址
 * @param url 链接地址
 * @param title 可选的标题
 * @returns Promise<boolean> 是否复制成功
 */
export async function copyLink(url: string, title?: string): Promise<boolean> {
  const text = title ? `[${title}](${url})` : url
  return await copy(text)
}

/**
 * 复制代码块
 * @param code 代码内容
 * @param language 编程语言
 * @returns Promise<boolean> 是否复制成功
 */
export async function copyCode(
  code: string,
  language?: string
): Promise<boolean> {
  let text = code
  if (language) {
    text = `\`\`\`${language}\n${code}\n\`\`\``
  }
  return await copy(text)
}
