/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { createFileRoute, redirect } from '@tanstack/react-router'
import { CommissionPage } from '@/features/commission'
import { useCommissionConfig } from '@/hooks/use-commission-config'

export const Route = createFileRoute('/_authenticated/commission/')({
  beforeLoad: async () => {
    // D2: 路由守卫 - 返佣功能关闭时重定向到钱包页
    try {
      const response = await fetch('/api/status')
      if (response.ok) {
        const data = await response.json()
        if (!data.data?.commission_enabled) {
          throw redirect({ to: '/wallet' })
        }
      }
    } catch (error) {
      // 如果获取配置失败，允许访问（让页面自行处理）
    }
  },
  component: CommissionPage,
})
