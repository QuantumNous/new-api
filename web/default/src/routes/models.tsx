/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY OF MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
*/
import { createFileRoute, redirect } from '@tanstack/react-router'

import { MODELS_DEFAULT_SECTION } from '@/features/models/section-registry'
import { Models as MarketingModels } from '@/features/marketing/pages/Models'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'
import { isMarketingHost } from '@/lib/host'

// 原 _authenticated/models 的重定向逻辑迁移到顶层 /models：
// - 营销站点（www）：直接渲染营销模型能力页，不经过控制台鉴权/侧边栏。
// - 控制台站点（app）：保持原行为——管理员重定向到 /models/$section，否则 403。
export const Route = createFileRoute('/models')({
  beforeLoad: () => {
    if (isMarketingHost()) return

    const { auth } = useAuthStore.getState()
    if (!auth.user || auth.user.role < ROLE.ADMIN) {
      throw redirect({ to: '/403' })
    }
    throw redirect({
      to: '/models/$section',
      params: { section: MODELS_DEFAULT_SECTION },
    })
  },
  component: MarketingModels,
})
