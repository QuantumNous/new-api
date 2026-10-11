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
import { nanoid } from 'nanoid'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import type { FooterRegistration } from '@/features/footer/types'

import { SupportLinkDialog } from './support-link-dialog'

export function FooterRegistrationEditor(props: {
  value: FooterRegistration[]
  onChange: (value: FooterRegistration[]) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<FooterRegistration | null>(null)
  const [deleting, setDeleting] = useState<FooterRegistration | null>(null)

  const move = (index: number, offset: number) => {
    const next = [...props.value]
    const target = index + offset
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    props.onChange(next)
  }

  return (
    <section className='space-y-3' aria-label={t('Registration information')}>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div>
          <h3 className='text-sm font-semibold'>
            {t('Registration information')}
          </h3>
          <p className='text-muted-foreground mt-1 text-xs'>
            {t(
              'Display registration text and an optional icon in the homepage footer.'
            )}
          </p>
        </div>
        <Button
          type='button'
          variant='outline'
          size='sm'
          disabled={props.value.length >= 10}
          onClick={() => {
            setEditing(null)
            setOpen(true)
          }}
        >
          {t('Add registration')}
        </Button>
      </div>
      <ul className='space-y-2'>
        {props.value.map((record, index) => (
          <li
            key={record.id}
            className='flex flex-wrap items-center gap-3 rounded-lg border p-3'
          >
            {record.icon && (
              <img
                src={record.icon}
                alt=''
                className='size-5 shrink-0 object-contain'
              />
            )}
            <div className='min-w-0 flex-1 break-words'>
              <p className='text-sm font-medium'>{record.label}</p>
              <p className='text-muted-foreground text-xs break-all'>
                {record.url}
              </p>
            </div>
            <div className='flex flex-wrap gap-1'>
              <Button
                type='button'
                size='sm'
                variant='ghost'
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                {t('Move up')}
              </Button>
              <Button
                type='button'
                size='sm'
                variant='ghost'
                disabled={index === props.value.length - 1}
                onClick={() => move(index, 1)}
              >
                {t('Move down')}
              </Button>
              <Button
                type='button'
                size='sm'
                variant='ghost'
                onClick={() => {
                  setEditing(record)
                  setOpen(true)
                }}
              >
                {t('Edit')}
              </Button>
              <Button
                type='button'
                size='sm'
                variant='ghost'
                onClick={() => setDeleting(record)}
              >
                {t('Delete')}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <SupportLinkDialog
        mode='registration'
        open={open}
        onOpenChange={setOpen}
        link={
          editing
            ? {
                id: editing.id,
                title: editing.label,
                icon: editing.icon,
                url: editing.url,
              }
            : null
        }
        onSubmit={(values) => {
          const record = {
            id: editing?.id ?? nanoid(),
            label: values.title,
            url: values.url,
            icon: values.icon,
          }
          props.onChange(
            editing
              ? props.value.map((item) =>
                  item.id === editing.id ? record : item
                )
              : [...props.value, record]
          )
          setOpen(false)
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(value) => {
          if (!value) setDeleting(null)
        }}
        title={t('Delete footer link?')}
        desc={t('The link will be removed after you save.')}
        confirmText={t('Delete')}
        destructive
        handleConfirm={() => {
          props.onChange(
            props.value.filter((record) => record.id !== deleting?.id)
          )
          setDeleting(null)
        }}
      />
    </section>
  )
}
