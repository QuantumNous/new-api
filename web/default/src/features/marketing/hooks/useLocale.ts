import { useTranslation } from 'react-i18next'

import type { Locale } from '../types'

// 营销站内容按 locale 切换。当前仓库 i18n 语言为 en（默认）/ zh / fr / ja / ru / vi，
// 营销站仅提供 en / zh 双语内容，其余语言回退英文。
export function useLocale(): Locale {
  const { i18n } = useTranslation()
  return i18n.language?.startsWith('zh') ? 'zh' : 'en'
}
