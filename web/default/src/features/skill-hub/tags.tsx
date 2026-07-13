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
import { useEffect, useState } from 'react'
import { Plus, RefreshCw, Search, Tag, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { SectionPageLayout } from '@/components/layout'
import {
  createSkillHubTag,
  deleteSkillHubTag,
  listAdminSkillHubTags,
} from './api'
import type { SkillHubTag } from './types'

export function SkillHubTags() {
  const [tags, setTags] = useState<SkillHubTag[]>([])
  const [keyword, setKeyword] = useState('')
  const [newName, setNewName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<SkillHubTag | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  async function loadTags() {
    setLoading(true)
    try {
      const payload = await listAdminSkillHubTags({
        keyword: keyword.trim(),
        page_size: 200,
      })
      if (!payload.success) {
        throw new Error(payload.message || '标签加载失败')
      }
      setTags(payload.data?.items || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '标签加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTags()
    }, 0)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function createTag() {
    const name = newName.trim()
    if (!name) {
      toast.error('请输入标签名称')
      return
    }
    setSaving(true)
    try {
      const payload = await createSkillHubTag({
        name,
      })
      if (!payload.success) {
        throw new Error(payload.message || '标签创建失败')
      }
      toast.success('标签已创建')
      setNewName('')
      await loadTags()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '标签创建失败')
    } finally {
      setSaving(false)
    }
  }

  function requestRemoveTag(tag: SkillHubTag) {
    if (tag.usageCount > 0) {
      toast.error('该标签仍被技能使用，不能删除')
      return
    }
    setDeleteTarget(tag)
  }

  async function confirmRemoveTag() {
    if (!deleteTarget) return
    setSaving(true)
    try {
      const payload = await deleteSkillHubTag(deleteTarget.name)
      if (!payload.success) {
        throw new Error(payload.message || '标签删除失败')
      }
      toast.success('标签已删除')
      setDeleteTarget(null)
      await loadTags()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '标签删除失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>标签管理</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button variant='outline' disabled={loading} onClick={loadTags}>
          <RefreshCw className='h-4 w-4' />
          {loading ? '刷新中' : '刷新'}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='grid gap-4 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]'>
          <Card>
            <CardHeader>
              <CardTitle>新建标签</CardTitle>
              <CardDescription>
                标签会作为技能管理里的可选项，也会统计当前使用数量。
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              <label className='grid gap-1.5 text-sm font-medium'>
                <span>标签名称</span>
                <Input
                  value={newName}
                  maxLength={40}
                  placeholder='例如：办公协同'
                  onChange={(event) => setNewName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void createTag()
                  }}
                />
              </label>
              <Button className='w-full' disabled={saving} onClick={createTag}>
                <Plus className='h-4 w-4' />
                添加标签
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>标签库</CardTitle>
              <CardDescription>
                搜索、查看使用数量，并删除未被技能使用的标签。
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='flex gap-2'>
                <div className='relative flex-1'>
                  <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
                  <Input
                    className='pl-9'
                    value={keyword}
                    placeholder='搜索标签'
                    onChange={(event) => setKeyword(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void loadTags()
                    }}
                  />
                </div>
                <Button variant='outline' onClick={loadTags}>
                  搜索
                </Button>
              </div>

              <div className='overflow-hidden rounded-lg border'>
                <div className='bg-muted/40 grid grid-cols-[minmax(120px,1fr)_120px_110px] gap-3 px-3 py-2 text-xs font-medium'>
                  <span>标签</span>
                  <span>使用数量</span>
                  <span className='text-right'>操作</span>
                </div>
                <div className='divide-y'>
                  {tags.map((tag) => (
                    <div
                      key={tag.id || tag.name}
                      className='grid grid-cols-[minmax(120px,1fr)_120px_110px] items-center gap-3 px-3 py-3 text-sm'
                    >
                      <div className='flex min-w-0 items-center gap-2'>
                        <Tag className='text-muted-foreground h-4 w-4 shrink-0' />
                        <span className='truncate font-medium'>{tag.name}</span>
                      </div>
                      <Badge
                        variant={tag.usageCount > 0 ? 'secondary' : 'outline'}
                      >
                        {tag.usageCount} 个技能
                      </Badge>
                      <div className='flex justify-end'>
                        <Button
                          size='sm'
                          variant='ghost'
                          disabled={saving || tag.usageCount > 0}
                          title={
                            tag.usageCount > 0
                              ? '仍被技能使用，不能删除'
                              : '删除标签'
                          }
                          onClick={() => requestRemoveTag(tag)}
                        >
                          <Trash2 className='text-destructive h-4 w-4' />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {!tags.length && (
                    <div className='text-muted-foreground px-3 py-8 text-center text-sm'>
                      {loading ? '加载中...' : '暂无标签'}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </SectionPageLayout.Content>
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !saving) setDeleteTarget(null)
        }}
        title='删除标签'
        desc={
          <div className='space-y-2'>
            <p>
              确认删除标签
              <span className='text-foreground font-medium'>
                「{deleteTarget?.name}」
              </span>
              ？
            </p>
            <p className='text-muted-foreground text-sm'>
              删除后它会从标签库中移除，技能管理页也不能再选择这个标签。
            </p>
          </div>
        }
        cancelBtnText='取消'
        confirmText='删除标签'
        destructive
        isLoading={saving}
        handleConfirm={() => void confirmRemoveTag()}
      />
    </SectionPageLayout>
  )
}
