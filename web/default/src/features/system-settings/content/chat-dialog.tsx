import { useEffect } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

const createChatDialogSchema = (t: (key: string) => string) =>
  z.object({
    name: z.string().min(1, t('Chat client name is required')),
    url: z.string().min(1, t('URL is required')),
  })

type ChatDialogFormValues = z.infer<ReturnType<typeof createChatDialogSchema>>

export type ChatEntryData = {
  name: string
  url: string
}

type ChatDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: ChatEntryData) => void
  editData?: ChatEntryData | null
}

export function ChatDialog({
  open,
  onOpenChange,
  onSave,
  editData,
}: ChatDialogProps) {
  const { t } = useTranslation()
  const isEditMode = !!editData
  const chatDialogSchema = createChatDialogSchema(t)

  const form = useForm<ChatDialogFormValues>({
    resolver: zodResolver(chatDialogSchema),
    defaultValues: {
      name: '',
      url: '',
    },
  })

  useEffect(() => {
    if (editData) {
      form.reset(editData)
    } else {
      form.reset({
        name: '',
        url: '',
      })
    }
  }, [editData, form, open])

  const handleSubmit = (values: ChatDialogFormValues) => {
    onSave(values)
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? t('Edit chat preset') : t('Add chat preset')}
          </DialogTitle>
          <DialogDescription>
            {t('Configure a predefined chat link for end users.')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className='space-y-4'
          >
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Chat Client Name')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('Please enter chat client name')}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Display name for this chat client.')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='url'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('URL')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('Please enter the URL')} {...field} />
                  </FormControl>
                  <FormDescription>
                    {t('The URL for this chat client.')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
              >
                {t('Cancel')}
              </Button>
              <Button type='submit'>
                {isEditMode ? t('Update') : t('Add')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
