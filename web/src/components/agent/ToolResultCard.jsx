import React from 'react';
import { Button, Tag, Typography } from '@douyinfe/semi-ui';
import { ExternalLink, ShieldCheck } from 'lucide-react';

const { Text } = Typography;

const ToolResultCard = ({ event }) => {
  const result = event?.data || {};
  const display = result.display ?? result.data;
  const url =
    display?.url ||
    result?.data?.url ||
    (typeof display === 'string' && display.startsWith('/') ? display : '');

  return (
    <div className='rounded-md border border-[var(--semi-color-border)] bg-[var(--semi-color-bg-1)] p-3 text-sm'>
      <div className='mb-2 flex items-center justify-between gap-2'>
        <div className='flex min-w-0 items-center gap-2'>
          <ShieldCheck size={16} />
          <Text strong ellipsis={{ showTooltip: true }}>
            {event.tool_name || event.toolName || 'tool'}
          </Text>
        </div>
        <Tag color={result.ok === false ? 'red' : 'green'} size='small'>
          {result.ok === false ? 'failed' : 'ok'}
        </Tag>
      </div>
      {result.user_message ? (
        <div className='mb-2 text-[var(--semi-color-text-1)]'>
          {result.user_message}
        </div>
      ) : null}
      {url ? (
        <Button
          size='small'
          icon={<ExternalLink size={14} />}
          onClick={() => {
            window.location.href = url;
          }}
        >
          Open
        </Button>
      ) : (
        <pre className='max-h-44 overflow-auto whitespace-pre-wrap rounded bg-[var(--semi-color-fill-0)] p-2 text-xs'>
          {JSON.stringify(display, null, 2)}
        </pre>
      )}
    </div>
  );
};

export default ToolResultCard;
