import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { StatusBadge } from '@/components/status-badge'

interface UpstreamUpdateDialogProps {
  open: boolean
  addModels: string[]
  removeModels: string[]
  preferredTab: 'add' | 'remove'
  confirmLoading: boolean
  onConfirm: (data: { addModels: string[]; removeModels: string[] }) => void
  onCancel: () => void
}

export function UpstreamUpdateDialog(props: UpstreamUpdateDialogProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState(props.preferredTab)
  const [searchAdd, setSearchAdd] = useState('')
  const [searchRemove, setSearchRemove] = useState('')
  const [selectedAdd, setSelectedAdd] = useState<Set<string>>(
    () => new Set(props.addModels)
  )
  const [selectedRemove, setSelectedRemove] = useState<Set<string>>(
    () => new Set(props.removeModels)
  )
  const [partialConfirmOpen, setPartialConfirmOpen] = useState(false)

  const filteredAdd = useMemo(
    () =>
      props.addModels.filter((m) =>
        m.toLowerCase().includes(searchAdd.toLowerCase())
      ),
    [props.addModels, searchAdd]
  )

  const filteredRemove = useMemo(
    () =>
      props.removeModels.filter((m) =>
        m.toLowerCase().includes(searchRemove.toLowerCase())
      ),
    [props.removeModels, searchRemove]
  )

  const toggleModel = (
    model: string,
    set: Set<string>,
    setter: (s: Set<string>) => void
  ) => {
    const next = new Set(set)
    if (next.has(model)) next.delete(model)
    else next.add(model)
    setter(next)
  }

  const toggleAllVisible = (
    models: string[],
    set: Set<string>,
    setter: (s: Set<string>) => void
  ) => {
    const allSelected = models.every((m) => set.has(m))
    const next = new Set(set)
    if (allSelected) {
      models.forEach((m) => next.delete(m))
    } else {
      models.forEach((m) => next.add(m))
    }
    setter(next)
  }

  const handleConfirm = () => {
    const hasAdd = props.addModels.length > 0
    const hasRemove = props.removeModels.length > 0
    const selectedAddArr = Array.from(selectedAdd)
    const selectedRemoveArr = Array.from(selectedRemove)
    const anyAdd = selectedAddArr.length > 0
    const anyRemove = selectedRemoveArr.length > 0

    if (hasAdd && hasRemove && (!anyAdd || !anyRemove)) {
      setPartialConfirmOpen(true)
      return
    }

    props.onConfirm({
      addModels: selectedAddArr,
      removeModels: selectedRemoveArr,
    })
  }

  return (
    <>
      <Dialog open={props.open} onOpenChange={(v) => !v && props.onCancel()}>
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>{t('Upstream Model Updates')}</DialogTitle>
          </DialogHeader>

          <p className='text-muted-foreground text-sm'>
            {t(
              'Select models to process. Unselected "add" models will be ignored.'
            )}
          </p>

          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'add' | 'remove')}
          >
            <TabsList className='grid w-full grid-cols-2'>
              <TabsTrigger value='add' className='gap-1'>
                {t('Add Models')}
                <StatusBadge
                  variant='neutral'
                  className='ml-1'
                  copyable={false}
                >
                  {selectedAdd.size}/{props.addModels.length}
                </StatusBadge>
              </TabsTrigger>
              <TabsTrigger value='remove' className='gap-1'>
                {t('Remove Models')}
                <StatusBadge
                  variant='neutral'
                  className='ml-1'
                  copyable={false}
                >
                  {selectedRemove.size}/{props.removeModels.length}
                </StatusBadge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value='add' className='space-y-3'>
              <div className='relative'>
                <Search className='text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4' />
                <Input
                  placeholder={t('Search models...')}
                  className='pl-8'
                  value={searchAdd}
                  onChange={(e) => setSearchAdd(e.target.value)}
                />
              </div>
              {filteredAdd.length > 0 && (
                <div className='flex items-center gap-2'>
                  <Checkbox
                    checked={filteredAdd.every((m) => selectedAdd.has(m))}
                    onCheckedChange={() =>
                      toggleAllVisible(filteredAdd, selectedAdd, setSelectedAdd)
                    }
                  />
                  <span className='text-muted-foreground text-xs'>
                    {t('Select All Visible')}
                  </span>
                </div>
              )}
              <ScrollArea className='h-[280px] rounded-md border p-2'>
                {filteredAdd.length > 0 ? (
                  <div className='space-y-1'>
                    {filteredAdd.map((model) => (
                      <label
                        key={model}
                        className='hover:bg-accent flex cursor-pointer items-center gap-2 rounded px-2 py-1.5'
                      >
                        <Checkbox
                          checked={selectedAdd.has(model)}
                          onCheckedChange={() =>
                            toggleModel(model, selectedAdd, setSelectedAdd)
                          }
                        />
                        <span className='truncate text-sm'>{model}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className='text-muted-foreground py-8 text-center text-sm'>
                    {props.addModels.length === 0
                      ? t('No models to add')
                      : t('No matching results')}
                  </p>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value='remove' className='space-y-3'>
              <div className='relative'>
                <Search className='text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4' />
                <Input
                  placeholder={t('Search models...')}
                  className='pl-8'
                  value={searchRemove}
                  onChange={(e) => setSearchRemove(e.target.value)}
                />
              </div>
              {filteredRemove.length > 0 && (
                <div className='flex items-center gap-2'>
                  <Checkbox
                    checked={filteredRemove.every((m) => selectedRemove.has(m))}
                    onCheckedChange={() =>
                      toggleAllVisible(
                        filteredRemove,
                        selectedRemove,
                        setSelectedRemove
                      )
                    }
                  />
                  <span className='text-muted-foreground text-xs'>
                    {t('Select All Visible')}
                  </span>
                </div>
              )}
              <ScrollArea className='h-[280px] rounded-md border p-2'>
                {filteredRemove.length > 0 ? (
                  <div className='space-y-1'>
                    {filteredRemove.map((model) => (
                      <label
                        key={model}
                        className='hover:bg-accent flex cursor-pointer items-center gap-2 rounded px-2 py-1.5'
                      >
                        <Checkbox
                          checked={selectedRemove.has(model)}
                          onCheckedChange={() =>
                            toggleModel(
                              model,
                              selectedRemove,
                              setSelectedRemove
                            )
                          }
                        />
                        <span className='truncate text-sm'>{model}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className='text-muted-foreground py-8 text-center text-sm'>
                    {props.removeModels.length === 0
                      ? t('No models to remove')
                      : t('No matching results')}
                  </p>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant='outline' onClick={props.onCancel}>
              {t('Cancel')}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={
                props.confirmLoading ||
                (selectedAdd.size === 0 && selectedRemove.size === 0)
              }
            >
              {t('Confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={partialConfirmOpen}
        onOpenChange={setPartialConfirmOpen}
        title={t('Partial Submission')}
        desc={t(
          'There are both add and remove models pending, but you only selected one type. Confirm submitting only the selected items?'
        )}
        handleConfirm={() => {
          setPartialConfirmOpen(false)
          props.onConfirm({
            addModels: Array.from(selectedAdd),
            removeModels: Array.from(selectedRemove),
          })
        }}
      />
    </>
  )
}
