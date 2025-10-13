import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Pencil, Plus, Trash2, ChevronDown, Check } from 'lucide-react'
import { toast } from 'sonner'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'
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
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { getVendors, getModels, deleteVendor } from '../api'
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants'
import { type Vendor } from '../types'
import { useModels } from './models-provider'

export function ModelsTabs() {
  const {
    activeVendorKey,
    setActiveVendorKey,
    setOpen: setDialogOpen,
    setCurrentRow,
    triggerRefresh,
  } = useModels()
  const [deletingVendor, setDeletingVendor] = useState<Vendor | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)

  // Fetch vendors
  const { data: vendorsData } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const result = await getVendors({ page_size: 1000 })
      if (!result.success) {
        toast.error(result.message || ERROR_MESSAGES.VENDOR_LOAD_FAILED)
        return { items: [] }
      }
      return result.data || { items: [] }
    },
    staleTime: 5 * 60 * 1000,
  })

  // Fetch model counts for each vendor
  const { data: countsData } = useQuery({
    queryKey: ['vendor-counts'],
    queryFn: async () => {
      const result = await getModels({ p: 1, page_size: 1 })
      if (!result.success || !result.data?.vendor_counts) {
        return { all: 0 }
      }

      const counts = result.data.vendor_counts
      const total = Object.values(counts).reduce(
        (acc: number, val) => acc + (val as number),
        0
      )

      return { ...counts, all: total }
    },
    staleTime: 30 * 1000, // Cache for 30 seconds
  })

  const vendors = vendorsData?.items || []
  const vendorCounts = countsData || { all: 0 }

  const handleAddVendor = () => {
    setCurrentRow(null)
    setDialogOpen('create-vendor')
  }

  const handleEditVendor = (vendor: Vendor, e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentRow(vendor)
    setDialogOpen('update-vendor')
  }

  const handleDeleteVendor = async () => {
    if (!deletingVendor) return

    setIsDeleting(true)

    try {
      const result = await deleteVendor(deletingVendor.id)

      if (result.success) {
        toast.success(SUCCESS_MESSAGES.VENDOR_DELETED)

        // If the deleted vendor was active, switch to "all"
        if (activeVendorKey === String(deletingVendor.id)) {
          setActiveVendorKey('all')
        }

        triggerRefresh()
        setDeletingVendor(null)
      } else {
        toast.error(result.message || ERROR_MESSAGES.VENDOR_DELETE_FAILED)
      }
    } catch {
      toast.error(ERROR_MESSAGES.VENDOR_DELETE_FAILED)
    }

    setIsDeleting(false)
  }

  // Get current selected vendor
  const currentVendor = vendors.find((v) => String(v.id) === activeVendorKey)
  const currentCount =
    activeVendorKey === 'all'
      ? vendorCounts.all || 0
      : (vendorCounts as Record<string, number>)[Number(activeVendorKey)] || 0

  return (
    <>
      <div className='flex items-center gap-2'>
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant='outline'
              role='combobox'
              aria-expanded={popoverOpen}
              size='sm'
              className='h-8 w-[200px] justify-between'
            >
              <div className='flex items-center gap-1.5 overflow-hidden'>
                {activeVendorKey === 'all' ? (
                  <span className='text-sm'>All Vendors</span>
                ) : currentVendor ? (
                  <>
                    {currentVendor.icon && (
                      <div className='flex-shrink-0'>
                        {getLobeIcon(currentVendor.icon, 14)}
                      </div>
                    )}
                    <span className='truncate text-sm'>
                      {currentVendor.name}
                    </span>
                  </>
                ) : (
                  <span className='text-sm'>Select vendor...</span>
                )}
                <span className='text-muted-foreground ml-auto text-xs'>
                  {currentCount}
                </span>
              </div>
              <ChevronDown className='ml-2 h-3.5 w-3.5 flex-shrink-0 opacity-50' />
            </Button>
          </PopoverTrigger>
          <PopoverContent className='w-[240px] p-0' align='start'>
            <Command>
              <CommandInput placeholder='Search vendor...' className='h-8' />
              <CommandList>
                <CommandEmpty>No vendor found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value='all'
                    onSelect={() => {
                      setActiveVendorKey('all')
                      setPopoverOpen(false)
                    }}
                    className='text-sm'
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        activeVendorKey === 'all' ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className='flex-1'>All Vendors</span>
                    <span className='text-muted-foreground text-xs'>
                      {vendorCounts.all || 0}
                    </span>
                  </CommandItem>
                  {vendors.map((vendor) => (
                    <CommandItem
                      key={vendor.id}
                      value={`${vendor.name}-${vendor.id}`}
                      onSelect={(currentValue) => {
                        // Extract the vendor ID from the value
                        const vendorId = currentValue.split('-').pop()
                        if (vendorId) {
                          setActiveVendorKey(vendorId)
                          setPopoverOpen(false)
                        }
                      }}
                      className='group relative text-sm'
                    >
                      <div className='flex w-full items-center'>
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4 flex-shrink-0',
                            activeVendorKey === String(vendor.id)
                              ? 'opacity-100'
                              : 'opacity-0'
                          )}
                        />
                        {vendor.icon && (
                          <div className='mr-2 flex-shrink-0'>
                            {getLobeIcon(vendor.icon, 14)}
                          </div>
                        )}
                        <span className='flex-1 truncate'>{vendor.name}</span>
                        <span className='text-muted-foreground mr-1 text-xs'>
                          {(vendorCounts as Record<string, number>)[
                            vendor.id
                          ] || 0}
                        </span>
                        <div className='flex items-center gap-0.5'>
                          <button
                            type='button'
                            className='hover:bg-accent flex h-5 w-5 items-center justify-center rounded'
                            onPointerDown={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                            }}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleEditVendor(vendor, e)
                              setPopoverOpen(false)
                            }}
                            title='Edit vendor'
                          >
                            <Pencil className='h-3 w-3' />
                          </button>
                          <button
                            type='button'
                            className='hover:bg-accent flex h-5 w-5 items-center justify-center rounded'
                            onPointerDown={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                            }}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setDeletingVendor(vendor)
                              setPopoverOpen(false)
                            }}
                            title='Delete vendor'
                          >
                            <Trash2 className='h-3 w-3' />
                          </button>
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Button
          size='sm'
          variant='outline'
          onClick={handleAddVendor}
          className='h-8'
        >
          <Plus className='mr-1.5 h-3.5 w-3.5' />
          <span className='text-sm'>Add Vendor</span>
        </Button>
      </div>

      <AlertDialog
        open={!!deletingVendor}
        onOpenChange={(open) => !open && setDeletingVendor(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vendor</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete vendor{' '}
              <strong>{deletingVendor?.name}</strong>? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDeleteVendor()
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
