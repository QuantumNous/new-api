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

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Plus,
  Edit2,
  Trash2,
  ArrowUp,
  ArrowDown,
  Globe,
  Lock,
  ExternalLink,
  FolderPlus,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { SettingsSection } from '../components/settings-section'

type NavigationItemTranslation = {
  id?: number
  locale: string
  label: string
}

type NavigationVisibilityRule = {
  id?: number
  effect: 'allow' | 'deny'
  subject_type: 'everyone' | 'anonymous' | 'authenticated' | 'role' | 'user_group'
  subject_value: string
}

type NavigationItem = {
  id: number
  menu_id: number
  parent_id?: number
  type: 'builtin_module' | 'internal_path' | 'external_url' | 'group' | 'divider'
  module_key?: string
  path?: string
  url?: string
  icon_key?: string
  sort_order: number
  enabled: boolean
  open_in_new_tab: boolean
  exact_active: boolean
  translations: NavigationItemTranslation[]
  rules: NavigationVisibilityRule[]
}

export function HeaderNavigationSection() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  
  // 编辑弹窗状态
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Partial<NavigationItem> | null>(null)
  
  // 1. 获取菜单容器列表，定位顶级 web top 菜单
  const { data: menus = [] } = useQuery({
    queryKey: ['admin-navigation-menus'],
    queryFn: async () => {
      const res = await api.get('/api/navigation/admin/menus')
      return res.data?.data || []
    },
  })

  // 派生出 activeMenuID，避免在异步 queryFn 中调用 setState 造成的缓存及 React 状态异步更新不一致问题
  const activeMenuID = useMemo(() => {
    const defaultMenu = menus.find((m: any) => m.key === 'default_web_top')
    return defaultMenu ? defaultMenu.id : null
  }, [menus])

  // 2. 获取该菜单下所有节点列表
  const { data: flatItems = [], refetch: refetchItems } = useQuery<NavigationItem[]>({
    queryKey: ['admin-navigation-items', activeMenuID],
    queryFn: async () => {
      if (!activeMenuID) return []
      const res = await api.get('/api/navigation/admin/items', {
        params: { menu_id: activeMenuID },
      })
      return res.data?.data || []
    },
    enabled: !!activeMenuID,
  })

  // 3. 构建多级缩进排序好的展示列表
  const displayItems = useMemo(() => {
    const list: Array<{ item: NavigationItem; depth: number }> = []
    
    const recurse = (parentID: number | undefined, depth: number) => {
      const children = flatItems.filter((it) => {
        if (!parentID) return !it.parent_id
        return it.parent_id === parentID
      })
      
      children.forEach((child) => {
        list.push({ item: child, depth })
        recurse(child.id, depth + 1)
      })
    }

    recurse(undefined, 0)
    return list
  }, [flatItems])

  // ================= 级联 CRUD 修改的 Mutations =================

  // 创建/更新节点
  const saveMutation = useMutation({
    mutationFn: async (item: Partial<NavigationItem>) => {
      if (item.id) {
        return api.put(`/api/navigation/admin/items/${item.id}`, item)
      } else {
        return api.post('/api/navigation/admin/items', item)
      }
    },
    onSuccess: (res) => {
      if (res.data?.success) {
        toast.success(t('Navigation settings saved successfully'))
        setEditDialogOpen(false)
        refetchItems()
        // 同步刷新用户侧导航栏缓存
        queryClient.invalidateQueries({ queryKey: ['navigation-tree'] })
      }
    },
  })

  // 删除节点
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return api.delete(`/api/navigation/admin/items/${id}`)
    },
    onSuccess: (res) => {
      if (res.data?.success) {
        toast.success(t('Menu item deleted'))
        refetchItems()
        queryClient.invalidateQueries({ queryKey: ['navigation-tree'] })
      }
    },
  })

  // 重新排序
  const reorderMutation = useMutation({
    mutationFn: async (reorderList: Array<{ item_id: number; sort_order: number }>) => {
      return api.post('/api/navigation/admin/items/reorder', reorderList)
    },
    onSuccess: () => {
      refetchItems()
      queryClient.invalidateQueries({ queryKey: ['navigation-tree'] })
    },
  })

  // ================= 辅助操作 =================

  const handleOpenCreate = (parentID?: number) => {
    setEditingItem({
      menu_id: activeMenuID || 1,
      parent_id: parentID,
      type: 'builtin_module',
      module_key: 'home',
      enabled: true,
      open_in_new_tab: false,
      exact_active: false,
      sort_order: flatItems.length + 1,
      translations: [
        { locale: 'zh-CN', label: '' },
        { locale: 'en', label: '' },
        { locale: 'zh-TW', label: '' },
      ],
      rules: [],
    })
    setEditDialogOpen(true)
  }

  const handleOpenEdit = (item: NavigationItem) => {
    // 拷贝多语言配置，防修改污染
    const translations = ['zh-CN', 'en', 'zh-TW'].map((locale) => {
      const found = (item.translations || []).find((t) => t.locale === locale)
      return { locale, label: found ? found.label : '' }
    })

    setEditingItem({
      ...item,
      translations,
    })
    setEditDialogOpen(true)
  }

  // 排序上移/下移
  const handleMove = (index: number, direction: 'up' | 'down') => {
    const siblingItems = displayItems.filter(
      (it) => it.item.parent_id === displayItems[index].item.parent_id
    )
    const currentSiblingIdx = siblingItems.findIndex(
      (it) => it.item.id === displayItems[index].item.id
    )

    let targetSiblingIdx = direction === 'up' ? currentSiblingIdx - 1 : currentSiblingIdx + 1
    if (targetSiblingIdx < 0 || targetSiblingIdx >= siblingItems.length) return

    const currentItem = siblingItems[currentSiblingIdx].item
    const targetItem = siblingItems[targetSiblingIdx].item

    // 互换权重并保存
    reorderMutation.mutate([
      { item_id: currentItem.id, sort_order: targetItem.sort_order },
      { item_id: targetItem.id, sort_order: currentItem.sort_order },
    ])
  }

  const handleSaveItem = () => {
    if (!editingItem) return
    const cnTrans = editingItem.translations?.find((t) => t.locale === 'zh-CN')
    if (!cnTrans || !cnTrans.label.trim()) {
      toast.error(t('Chinese label is required'))
      return
    }

    saveMutation.mutate(editingItem)
  }

  const updateTranslation = (locale: string, val: string) => {
    if (!editingItem || !editingItem.translations) return
    const updated = editingItem.translations.map((t) => {
      if (t.locale === locale) return { ...t, label: val }
      return t
    })
    setEditingItem({ ...editingItem, translations: updated })
  }

  return (
    <SettingsSection title={t('Header navigation')}>
      <div className='flex flex-col gap-4'>
        <div className='flex items-center justify-between border-b pb-2'>
          <p className='text-muted-foreground text-sm'>
            自定义顶部导航菜单管理。支持树形自关联与二级子触发器，允许外链/内置组合。
          </p>
          <Button size='sm' onClick={() => handleOpenCreate()}>
            <Plus className='mr-1.5 size-4' />
            {t('Add link')}
          </Button>
        </div>

        {/* 动态链接列表 */}
        <div className='flex flex-col gap-1.5 rounded-md border p-1 bg-muted/20'>
          {displayItems.length === 0 ? (
            <div className='py-8 text-center text-muted-foreground text-sm'>
              暂无配置节点，点击右上角添加。
            </div>
          ) : (
            displayItems.map(({ item, depth }, index) => {
              const cnLabel =
                (item.translations || []).find((t) => t.locale === 'zh-CN')?.label || item.module_key
              const enLabel =
                (item.translations || []).find((t) => t.locale === 'en')?.label || item.module_key

              return (
                <div
                  key={item.id}
                  className='group flex items-center justify-between rounded-lg border bg-background p-3.5 hover:shadow-xs transition-shadow'
                  style={{ marginLeft: `${depth * 24}px` }}
                >
                  <div className='flex items-center gap-3.5'>
                    {/* 图标与阶梯指示 */}
                    <div className='flex items-center gap-1.5'>
                      {depth > 0 && <span className='text-muted-foreground/30 text-xs'>└─</span>}
                      <span className='font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded'>
                        {item.type}
                      </span>
                    </div>

                    <div className='flex flex-col'>
                      <span className='font-medium text-sm flex items-center gap-1.5'>
                        {cnLabel}
                        <span className='text-xs text-muted-foreground/60 font-normal'>
                          ({enLabel})
                        </span>
                      </span>
                      <span className='text-xs text-muted-foreground truncate max-w-xs md:max-w-md lg:max-w-xl'>
                        {item.type === 'builtin_module'
                          ? `模块键: ${item.module_key}`
                          : item.type === 'internal_path'
                            ? `内部路径: ${item.path}`
                            : `链接: ${item.url}`}
                      </span>
                    </div>
                  </div>

                  <div className='flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity'>
                    {/* 权限及外链指示 */}
                    {(item.rules || []).length > 0 && <Lock className='size-3.5 text-amber-500' />}
                    {item.open_in_new_tab && <ExternalLink className='size-3.5 text-primary' />}

                    {/* 排序微调 */}
                    <Button
                      variant='ghost'
                      size='icon'
                      className='size-7'
                      onClick={() => handleMove(index, 'up')}
                    >
                      <ArrowUp className='size-3.5' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='size-7'
                      onClick={() => handleMove(index, 'down')}
                    >
                      <ArrowDown className='size-3.5' />
                    </Button>

                    {/* 增加子节点 (只允许二级，限制 depth = 0 时) */}
                    {depth === 0 && item.type !== 'divider' && (
                      <Button
                        variant='ghost'
                        size='icon'
                        className='size-7 text-primary hover:text-primary'
                        onClick={() => handleOpenCreate(item.id)}
                      >
                        <FolderPlus className='size-3.5' />
                      </Button>
                    )}

                    {/* 编辑与删除 */}
                    <Button
                      variant='ghost'
                      size='icon'
                      className='size-7'
                      onClick={() => handleOpenEdit(item)}
                    >
                      <Edit2 className='size-3.5' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='size-7 text-destructive hover:text-destructive'
                      onClick={() => {
                        if (confirm('确认删除此节点吗？子节点会被解除父子绑定关系。')) {
                          deleteMutation.mutate(item.id)
                        }
                      }}
                    >
                      <Trash2 className='size-3.5' />
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* 属性编辑 Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className='max-w-lg'>
          <DialogHeader>
            <DialogTitle>
              {editingItem?.id ? '编辑导航项' : '新增导航链接'}
            </DialogTitle>
          </DialogHeader>

          {editingItem && (
            <div className='flex flex-col gap-4 py-4 text-sm'>
              {/* 类型选择 */}
              <div className='grid grid-cols-4 items-center gap-4'>
                <span className='font-medium text-right'>类型</span>
                <select
                  value={editingItem.type}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      type: e.target.value as any,
                    })
                  }
                  className='col-span-3 rounded-md border p-2 bg-background'
                >
                  <option value='builtin_module'>内置模块 (Builtin)</option>
                  <option value='internal_path'>站内自定义路径</option>
                  <option value='external_url'>外部 URL 链接</option>
                  <option value='group'>分类分组标题 (不可点击)</option>
                  <option value='divider'>分割线 (Divider)</option>
                </select>
              </div>

              {/* 针对不同类型的附加输入框 */}
              {editingItem.type === 'builtin_module' && (
                <div className='grid grid-cols-4 items-center gap-4'>
                  <span className='font-medium text-right'>内置模块</span>
                  <select
                    value={editingItem.module_key}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        module_key: e.target.value,
                      })
                    }
                    className='col-span-3 rounded-md border p-2 bg-background'
                  >
                    <option value='home'>首页 (Home)</option>
                    <option value='console'>控制台 (Console)</option>
                    <option value='pricing'>模型广场 (Model Square)</option>
                    <option value='rankings'>排行榜 (Rankings)</option>
                    <option value='docs'>文档 (Docs)</option>
                    <option value='about'>关于 (About)</option>
                  </select>
                </div>
              )}

              {editingItem.type === 'internal_path' && (
                <div className='grid grid-cols-4 items-center gap-4'>
                  <span className='font-medium text-right'>站内路径</span>
                  <Input
                    value={editingItem.path || ''}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, path: e.target.value })
                    }
                    placeholder='例如: /dashboard/billing'
                    className='col-span-3'
                  />
                </div>
              )}

              {editingItem.type === 'external_url' && (
                <div className='grid grid-cols-4 items-center gap-4'>
                  <span className='font-medium text-right'>外部链接</span>
                  <Input
                    value={editingItem.url || ''}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, url: e.target.value })
                    }
                    placeholder='例如: https://github.com'
                    className='col-span-3'
                  />
                </div>
              )}

              {editingItem.type !== 'divider' && (
                <>
                  {/* 多语言标签输入 */}
                  <div className='border-t pt-3'>
                    <span className='font-medium block mb-2 text-primary flex items-center gap-1.5'>
                      <Globe className='size-4' />
                      国际化多语言翻译 (Labels)
                    </span>
                    <div className='flex flex-col gap-3 pl-4'>
                      <div className='grid grid-cols-4 items-center gap-4'>
                        <span className='text-right text-xs text-muted-foreground'>
                          简体中文
                        </span>
                        <Input
                          value={
                            editingItem.translations?.find((t) => t.locale === 'zh-CN')?.label || ''
                          }
                          onChange={(e) => updateTranslation('zh-CN', e.target.value)}
                          className='col-span-3'
                        />
                      </div>
                      <div className='grid grid-cols-4 items-center gap-4'>
                        <span className='text-right text-xs text-muted-foreground'>
                          English
                        </span>
                        <Input
                          value={
                            editingItem.translations?.find((t) => t.locale === 'en')?.label || ''
                          }
                          onChange={(e) => updateTranslation('en', e.target.value)}
                          className='col-span-3'
                        />
                      </div>
                      <div className='grid grid-cols-4 items-center gap-4'>
                        <span className='text-right text-xs text-muted-foreground'>
                          繁體中文
                        </span>
                        <Input
                          value={
                            editingItem.translations?.find((t) => t.locale === 'zh-TW')?.label || ''
                          }
                          onChange={(e) => updateTranslation('zh-TW', e.target.value)}
                          className='col-span-3'
                        />
                      </div>
                    </div>
                  </div>

                  {/* 图标与行为开关 */}
                  <div className='border-t pt-3 flex flex-col gap-3.5'>
                    <div className='grid grid-cols-4 items-center gap-4'>
                      <span className='font-medium text-right'>图标标识</span>
                      <Input
                        value={editingItem.icon_key || ''}
                        onChange={(e) =>
                          setEditingItem({ ...editingItem, icon_key: e.target.value })
                        }
                        placeholder='例如: star'
                        className='col-span-3'
                      />
                    </div>

                    <div className='grid grid-cols-4 items-center gap-4'>
                      <span className='font-medium text-right'>新标签页打开</span>
                      <div className='col-span-3'>
                        <Switch
                          checked={editingItem.open_in_new_tab}
                          onCheckedChange={(checked) =>
                            setEditingItem({
                              ...editingItem,
                              open_in_new_tab: checked,
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className='grid grid-cols-4 items-center gap-4'>
                      <span className='font-medium text-right'>路由精确激活</span>
                      <div className='col-span-3'>
                        <Switch
                          checked={editingItem.exact_active}
                          onCheckedChange={(checked) =>
                            setEditingItem({
                              ...editingItem,
                              exact_active: checked,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant='outline' onClick={() => setEditDialogOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button onClick={handleSaveItem} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? t('Saving...') : t('Confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsSection>
  )
}
