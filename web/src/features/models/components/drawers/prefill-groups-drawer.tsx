import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { stringToColor } from '@/lib/format'
import { truncateText } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getPrefillGroups, deletePrefillGroup } from '../../api'
import {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  PREFILL_GROUP_TYPE_OPTIONS,
} from '../../constants'
import { type PrefillGroup } from '../../types'
import { useModels } from '../models-provider'

type PrefillGroupsDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PrefillGroupsDrawer({
  open,
  onOpenChange,
}: PrefillGroupsDrawerProps) {
  const { setOpen, setCurrentRow, triggerRefresh } = useModels()
  const [deletingGroup, setDeletingGroup] = useState<PrefillGroup | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const {
    data: groups,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['prefill-groups-all'],
    queryFn: async () => {
      const result = await getPrefillGroups()
      if (!result.success) {
        toast.error(result.message || ERROR_MESSAGES.PREFILL_GROUP_LOAD_FAILED)
        return []
      }
      return result.data || []
    },
    enabled: open,
  })

  const handleCreate = () => {
    setCurrentRow(null)
    setOpen('create-prefill-group')
  }

  const handleEdit = (group: PrefillGroup) => {
    setCurrentRow(group)
    setOpen('update-prefill-group')
  }

  const handleDelete = async () => {
    if (!deletingGroup) return

    setIsDeleting(true)
    try {
      const result = await deletePrefillGroup(deletingGroup.id)
      if (result.success) {
        toast.success(SUCCESS_MESSAGES.PREFILL_GROUP_DELETED)
        refetch()
        triggerRefresh()
        setDeletingGroup(null)
      } else {
        toast.error(
          result.message || ERROR_MESSAGES.PREFILL_GROUP_DELETE_FAILED
        )
      }
    } catch (error) {
      toast.error(ERROR_MESSAGES.PREFILL_GROUP_DELETE_FAILED)
    }
    setIsDeleting(false)
  }

  const renderItems = (group: PrefillGroup) => {
    try {
      if (group.type === 'endpoint') {
        const parsed =
          typeof group.items === 'string'
            ? JSON.parse(group.items)
            : group.items
        const keys = Object.keys(parsed || {})
        if (keys.length === 0)
          return <span className='text-muted-foreground'>-</span>

        return (
          <div className='flex flex-wrap gap-1'>
            {keys.slice(0, 3).map((key, idx) => (
              <Badge
                key={idx}
                variant='outline'
                style={{ borderColor: stringToColor(key) }}
              >
                {key}
              </Badge>
            ))}
            {keys.length > 3 && (
              <Badge variant='outline'>+{keys.length - 3}</Badge>
            )}
          </div>
        )
      }

      const itemsArray = Array.isArray(group.items)
        ? group.items
        : typeof group.items === 'string'
          ? JSON.parse(group.items)
          : []

      if (itemsArray.length === 0) {
        return <span className='text-muted-foreground'>-</span>
      }

      return (
        <div className='flex flex-wrap gap-1'>
          {itemsArray.slice(0, 3).map((item: string, idx: number) => (
            <Badge
              key={idx}
              variant='outline'
              style={{ borderColor: stringToColor(item) }}
            >
              {item}
            </Badge>
          ))}
          {itemsArray.length > 3 && (
            <Badge variant='outline'>+{itemsArray.length - 3}</Badge>
          )}
        </div>
      )
    } catch {
      return <span className='text-muted-foreground'>Invalid</span>
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className='flex flex-col overflow-y-auto sm:max-w-[800px]'>
          <SheetHeader className='text-start'>
            <SheetTitle>Prefill Group Management</SheetTitle>
            <SheetDescription>
              Manage model, tag, and endpoint prefill groups for quick filling.
            </SheetDescription>
          </SheetHeader>

          <div className='mb-4 flex justify-end'>
            <Button size='sm' onClick={handleCreate}>
              <Plus className='mr-2 h-4 w-4' />
              New Group
            </Button>
          </div>

          {isLoading ? (
            <div className='flex h-32 items-center justify-center'>
              <p className='text-muted-foreground'>Loading...</p>
            </div>
          ) : !groups || groups.length === 0 ? (
            <div className='flex h-32 items-center justify-center'>
              <p className='text-muted-foreground'>No prefill groups found</p>
            </div>
          ) : (
            <div className='rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className='w-[100px]'>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((group) => (
                    <TableRow key={group.id}>
                      <TableCell>
                        <div className='flex items-center gap-2'>
                          <span className='font-medium'>{group.name}</span>
                          <Badge variant='secondary'>
                            {PREFILL_GROUP_TYPE_OPTIONS.find(
                              (opt) => opt.value === group.type
                            )?.label || group.type}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className='text-muted-foreground text-sm'>
                          {truncateText(group.description || '-', 50)}
                        </span>
                      </TableCell>
                      <TableCell>{renderItems(group)}</TableCell>
                      <TableCell>
                        <div className='flex gap-2'>
                          <Button
                            size='sm'
                            variant='ghost'
                            onClick={() => handleEdit(group)}
                          >
                            <Pencil className='h-4 w-4' />
                          </Button>
                          <Button
                            size='sm'
                            variant='ghost'
                            onClick={() => setDeletingGroup(group)}
                          >
                            <Trash2 className='text-destructive h-4 w-4' />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={!!deletingGroup}
        onOpenChange={(open) => !open && setDeletingGroup(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Prefill Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete group{' '}
              <strong>{deletingGroup?.name}</strong>? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={isDeleting}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
