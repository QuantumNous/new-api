import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { LayoutDashboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { api } from '@/lib/api'

type SidebarModuleConfig = {
  enabled: boolean
  [key: string]: boolean
}

type SidebarModulesConfig = Record<string, SidebarModuleConfig>

type SectionDef = {
  key: string
  title: string
  description: string
  modules: { key: string; title: string; description: string }[]
}

export function SidebarModulesCard() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [config, setConfig] = useState<SidebarModulesConfig>({})

  const sectionDefs: SectionDef[] = [
    {
      key: 'chat',
      title: t('聊天区域'),
      description: t('操练场和聊天功能'),
      modules: [
        { key: 'playground', title: t('操练场'), description: t('AI模型测试环境') },
        { key: 'chat', title: t('聊天'), description: t('聊天会话管理') },
      ],
    },
    {
      key: 'console',
      title: t('控制台区域'),
      description: t('数据管理和日志查看'),
      modules: [
        { key: 'detail', title: t('数据看板'), description: t('系统数据统计') },
        { key: 'token', title: t('令牌管理'), description: t('API令牌管理') },
        { key: 'log', title: t('使用日志'), description: t('API使用记录') },
        { key: 'midjourney', title: t('绘图日志'), description: t('绘图任务记录') },
        { key: 'task', title: t('任务日志'), description: t('系统任务记录') },
      ],
    },
    {
      key: 'personal',
      title: t('个人中心区域'),
      description: t('用户个人功能'),
      modules: [
        { key: 'topup', title: t('钱包管理'), description: t('余额充值管理') },
        { key: 'personal', title: t('个人设置'), description: t('个人信息设置') },
      ],
    },
  ]

  const loadConfig = useCallback(async () => {
    try {
      const res = await api.get('/api/user/self')
      if (res.data.success && res.data.data?.sidebar_modules) {
        const raw = res.data.data.sidebar_modules
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
        setConfig(parsed)
      } else {
        const defaults: SidebarModulesConfig = {}
        for (const sec of sectionDefs) {
          defaults[sec.key] = { enabled: true }
          for (const mod of sec.modules) defaults[sec.key][mod.key] = true
        }
        setConfig(defaults)
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  const toggleSection = (sectionKey: string, val: boolean) => {
    setConfig((prev) => ({
      ...prev,
      [sectionKey]: { ...prev[sectionKey], enabled: val },
    }))
  }

  const toggleModule = (sectionKey: string, moduleKey: string, val: boolean) => {
    setConfig((prev) => ({
      ...prev,
      [sectionKey]: { ...prev[sectionKey], [moduleKey]: val },
    }))
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const res = await api.put('/api/user/self', {
        sidebar_modules: JSON.stringify(config),
      })
      if (res.data.success) {
        toast.success(t('保存成功'))
      } else {
        toast.error(res.data.message || t('保存失败'))
      }
    } catch {
      toast.error(t('保存失败，请重试'))
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    const defaults: SidebarModulesConfig = {}
    for (const sec of sectionDefs) {
      defaults[sec.key] = { enabled: true }
      for (const mod of sec.modules) defaults[sec.key][mod.key] = true
    }
    setConfig(defaults)
    toast.success(t('已重置为默认配置'))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <LayoutDashboard className='h-4 w-4' />
          {t('左侧边栏个人设置')}
        </CardTitle>
        <CardDescription>
          {t('个性化设置左侧边栏的显示内容')}
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-6'>
        {sectionDefs.map((section) => {
          const sectionEnabled = config[section.key]?.enabled !== false
          return (
            <div key={section.key} className='space-y-3'>
              <div className='flex items-center justify-between rounded-lg border bg-muted/50 p-3'>
                <div>
                  <p className='text-sm font-medium'>{section.title}</p>
                  <p className='text-xs text-muted-foreground'>
                    {section.description}
                  </p>
                </div>
                <Switch
                  checked={sectionEnabled}
                  onCheckedChange={(v) => toggleSection(section.key, v)}
                />
              </div>
              <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
                {section.modules.map((mod) => (
                  <div
                    key={mod.key}
                    className={`flex items-center justify-between rounded-lg border p-3 transition-opacity ${
                      sectionEnabled ? '' : 'opacity-50'
                    }`}
                  >
                    <div className='mr-2 min-w-0'>
                      <p className='truncate text-sm font-medium'>
                        {mod.title}
                      </p>
                      <p className='truncate text-xs text-muted-foreground'>
                        {mod.description}
                      </p>
                    </div>
                    <Switch
                      checked={config[section.key]?.[mod.key] !== false}
                      onCheckedChange={(v) =>
                        toggleModule(section.key, mod.key, v)
                      }
                      disabled={!sectionEnabled}
                    />
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        <div className='flex justify-end gap-2 border-t pt-4'>
          <Button variant='outline' onClick={handleReset}>
            {t('重置为默认')}
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? t('Saving...') : t('Save Changes')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
