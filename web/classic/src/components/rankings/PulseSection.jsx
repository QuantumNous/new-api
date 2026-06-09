import React from 'react';
import { Card, Typography } from '@douyinfe/semi-ui';
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;

export default function PulseSection({ movers, droppers }) {
  const { t } = useTranslation();

  return (
    <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
      <Card className='!rounded-2xl'>
        <Title heading={6} className='flex items-center gap-2 !mb-1'>
          <TrendingUp size={14} style={{ color: 'var(--semi-color-success)' }} />
          {t('上升趋势')}
        </Title>
        <Text type='tertiary' size='small'>{t('排名上升最快的模型')}</Text>
        <div className='mt-3'>
          {movers.length === 0 ? (
            <div className='text-center py-6'>
              <Text type='tertiary' size='small'>{t('暂无上升模型')}</Text>
            </div>
          ) : (
            <ul className='list-none p-0 m-0'>
              {movers.map((row) => (
                <MoverRow key={row.model_name} row={row} intent='up' />
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card className='!rounded-2xl'>
        <Title heading={6} className='flex items-center gap-2 !mb-1'>
          <TrendingDown size={14} style={{ color: 'var(--semi-color-danger)' }} />
          {t('下降趋势')}
        </Title>
        <Text type='tertiary' size='small'>{t('排名下降最多的模型')}</Text>
        <div className='mt-3'>
          {droppers.length === 0 ? (
            <div className='text-center py-6'>
              <Text type='tertiary' size='small'>{t('暂无下降模型')}</Text>
            </div>
          ) : (
            <ul className='list-none p-0 m-0'>
              {droppers.map((row) => (
                <MoverRow key={row.model_name} row={row} intent='down' />
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}

function MoverRow({ row, intent }) {
  const color = intent === 'up' ? 'var(--semi-color-success)' : 'var(--semi-color-danger)';

  return (
    <li className='flex items-center gap-3 py-2.5 border-b border-semi-color-border last:border-0'>
      <div className='w-7 h-7 rounded-lg flex items-center justify-center shrink-0' style={{ backgroundColor: intent === 'up' ? 'var(--semi-color-success-light-default)' : 'var(--semi-color-danger-light-default)' }}>
        {intent === 'up' ? <ArrowUpRight size={14} style={{ color }} /> : <ArrowDownRight size={14} style={{ color }} />}
      </div>
      <div className='min-w-0 flex-1'>
        <div className='text-sm font-medium font-mono truncate' style={{ color: 'var(--semi-color-text-0)' }}>{row.model_name}</div>
        <div className='text-xs truncate' style={{ color: 'var(--semi-color-text-2)' }}>
          #{row.current_rank} · {row.vendor.toLowerCase()}
        </div>
      </div>
      <span className='inline-flex items-center gap-0.5 font-mono text-sm font-bold shrink-0' style={{ color }}>
        {intent === 'up' ? '+' : ''}{row.rank_delta}
      </span>
    </li>
  );
}
