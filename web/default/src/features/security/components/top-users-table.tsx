import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface TopUsersTableProps {
  data: Array<{ user_id: number; user_name: string; count: number }>
}

export function TopUsersTable({ data }: TopUsersTableProps) {
  const { t } = useTranslation()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Top Users')}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">#</TableHead>
              <TableHead>{t('User')}</TableHead>
              <TableHead className="text-right">{t('Detections')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground text-center">
                  {t('No data')}
                </TableCell>
              </TableRow>
            )}
            {data.map((item, idx) => (
              <TableRow key={item.user_id ?? idx}>
                <TableCell className="font-medium">{idx + 1}</TableCell>
                <TableCell>{item.user_name || `User #${item.user_id}`}</TableCell>
                <TableCell className="text-right">{item.count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
