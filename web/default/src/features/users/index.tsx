import { useTranslation } from 'react-i18next'
import { SectionPageLayout } from '@/components/layout'
import { UsersDeleteDialog } from './components/users-delete-dialog'
import { FeishuBatchInitDialog } from './components/feishu-batch-init-dialog'
import { FeishuTokenManagerDialog } from './components/feishu-token-manager-dialog'
import { UsersMutateDrawer } from './components/users-mutate-drawer'
import { UsersPrimaryButtons } from './components/users-primary-buttons'
import { UsersProvider, useUsers } from './components/users-provider'
import { UsersTable } from './components/users-table'

function UsersContent() {
  const { t } = useTranslation()
  const { open, setOpen, currentRow } = useUsers()

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Users')}</SectionPageLayout.Title>
        <SectionPageLayout.Description>
          {t('Manage users and their permissions')}
        </SectionPageLayout.Description>
        <SectionPageLayout.Actions>
          <UsersPrimaryButtons />
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <UsersTable />
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <UsersMutateDrawer
        open={open === 'create' || open === 'update'}
        onOpenChange={(isOpen) => !isOpen && setOpen(null)}
        currentRow={open === 'update' ? currentRow || undefined : undefined}
      />
      <UsersDeleteDialog />
      <FeishuBatchInitDialog
        open={open === 'feishu_batch_init'}
        onOpenChange={(isOpen) => !isOpen && setOpen(null)}
      />
      <FeishuTokenManagerDialog
        open={open === 'feishu_token_manager'}
        onOpenChange={(isOpen) => !isOpen && setOpen(null)}
      />
    </>
  )
}

export function Users() {
  return (
    <UsersProvider>
      <UsersContent />
    </UsersProvider>
  )
}
