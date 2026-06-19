import React from 'react';
import { Typography } from '@douyinfe/semi-ui';
import { IconFile } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import CardPro from '../../components/common/ui/CardPro';
import UploadCard from '../../components/table/reconcile/UploadCard';
import SummaryCard from '../../components/table/reconcile/SummaryCard';
import DiffTable from '../../components/table/reconcile/DiffTable';
import ByModelTable from '../../components/table/reconcile/ByModelTable';
import ParseErrorsList from '../../components/table/reconcile/ParseErrorsList';
import useReconcileUpload from '../../hooks/reconcile/useReconcileUpload';

const { Text } = Typography;

// `.table-scroll-card` (defined in src/index.css) forces every CardPro to
// `height: calc(100vh - 110px)` so it fills the viewport — fine for the
// single-card pages it was written for (KYC, Logs), wrong for this page
// which stacks 4 cards vertically. Override with !h-auto / !max-h-none so
// each card sizes to its content and the page scrolls normally.
const STACKED_CARD_CLASS = '!h-auto !max-h-none';

export default function ReconcilePage() {
  const { t } = useTranslation();
  const u = useReconcileUpload();
  const r = u.result;

  return (
    <div className='mt-[60px] px-2 flex flex-col gap-3'>
      <CardPro
        type='type1'
        className={STACKED_CARD_CLASS}
        descriptionArea={
          <div className='flex items-center text-blue-500'>
            <IconFile className='mr-2' />
            <Text>{t('对账管理')}</Text>
          </div>
        }
        t={t}
      >
        <UploadCard
          channels={u.channels}
          selectedChannelIds={u.selectedChannelIds}
          setSelectedChannelIds={u.setSelectedChannelIds}
          file={u.file}
          setFile={u.setFile}
          granularity={u.granularity}
          setGranularity={u.setGranularity}
          uploading={u.uploading}
          onSubmit={u.submit}
          onReset={u.reset}
        />
      </CardPro>

      {r && (
        <>
          <CardPro
            type='type1'
            className={STACKED_CARD_CLASS}
            descriptionArea={
              <Text strong>{t('对账总览')}</Text>
            }
            t={t}
          >
            <SummaryCard summary={r.summary} drift={r.drift_analysis} />
          </CardPro>

          {r.parse_errors && r.parse_errors.length > 0 && (
            <ParseErrorsList errors={r.parse_errors} />
          )}

          <CardPro
            type='type1'
            className={STACKED_CARD_CLASS}
            descriptionArea={
              <Text strong>{t('按模型汇总')}</Text>
            }
            t={t}
          >
            <ByModelTable byModel={r.by_model} />
          </CardPro>

          <CardPro
            type='type1'
            className={STACKED_CARD_CLASS}
            descriptionArea={
              <Text strong>{t('明细差异（仅真实差异，精确到小时）')}</Text>
            }
            t={t}
          >
            <DiffTable rows={r.rows} />
          </CardPro>
        </>
      )}
    </div>
  );
}
