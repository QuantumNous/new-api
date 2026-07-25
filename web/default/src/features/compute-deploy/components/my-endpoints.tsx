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
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { COMPUTE_API_BASE, COMPUTE_MODELS } from '../catalog'

export function MyEndpoints() {
  const { t } = useTranslation()
  const ready = COMPUTE_MODELS.filter((m) => m.status === 'ready')

  return (
    <div className='flex flex-col gap-4'>
      <p className='text-muted-foreground text-sm'>
        {t(
          'Serverless endpoints are shared and always on for your account — billed per use, scaled to zero when idle. Rented GPU instances will appear here once launched.'
        )}
      </p>

      <div className='rounded-lg border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Model')}</TableHead>
              <TableHead>{t('Endpoint')}</TableHead>
              <TableHead>{t('Type')}</TableHead>
              <TableHead>{t('Status')}</TableHead>
              <TableHead>{t('Price')}</TableHead>
              <TableHead className='text-right'>{t('Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ready.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className='text-muted-foreground py-8 text-center'
                >
                  {t('No endpoints yet')}
                </TableCell>
              </TableRow>
            ) : (
              ready.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className='font-medium'>{m.name}</TableCell>
                  <TableCell className='text-muted-foreground font-mono text-xs'>
                    {COMPUTE_API_BASE}
                  </TableCell>
                  <TableCell>
                    <Badge variant='secondary'>{t('Serverless')}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant='default'>{t('Running')}</Badge>
                  </TableCell>
                  <TableCell className='tabular-nums'>
                    {m.price}
                    <span className='text-muted-foreground text-xs'>
                      {' '}
                      {t(m.priceUnitKey)}
                    </span>
                  </TableCell>
                  <TableCell className='text-right'>
                    <Button
                      variant='outline'
                      size='sm'
                      render={<Link to='/playground' />}
                    >
                      {t('Test')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className='flex justify-end'>
        <Button
          variant='outline'
          render={
            <Link to='/usage-logs/$section' params={{ section: 'common' }} />
          }
        >
          {t('View usage')}
        </Button>
      </div>
    </div>
  )
}
