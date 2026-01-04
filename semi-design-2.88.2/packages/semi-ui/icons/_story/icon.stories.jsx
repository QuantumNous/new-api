import React from 'react';

import Others from './Others';
import {
  IconHome,
  IconLock,
  IconClear,
  IconTickCircle,
  IconTick,
  IconClose,
  IconCaretup,
  IconAIBellLevel1,
  IconAIBellLevel2,
  IconAIBellLevel3,
  IconAIEditLevel1,
  IconAIEditLevel2,
  IconAIEditLevel3,
  IconAIFileLevel1,
  IconAIFileLevel2,
  IconAIFileLevel3,
  IconAIFilledLevel1,
  IconAIFilledLevel2,
  IconAIFilledLevel3,
  IconAIImageLevel1,
  IconAIImageLevel2,
  IconAIImageLevel3,
  IconAISearchLevel1,
  IconAISearchLevel2,
  IconAISearchLevel3,
  IconAIStrokedLevel1,
  IconAIStrokedLevel2,
  IconAIStrokedLevel3,
  IconAIWandLevel1,
  IconAIWandLevel2,
  IconAIWandLevel3,
  IconAILoading,
} from '@douyinfe/semi-icons';

export default {
  title: 'Icon'
}

export {
  Others
}

export const IconDemo = () => (
  <div>
    <div>
      <IconHome size="large" />
      <IconLock size="small" />
      <IconLock />
      <IconClear />
      <IconTickCircle />
      <IconTick />
      <IconClose />
      <IconCaretup />
    </div>
    <div
      style={{
        color: 'red',
      }}
    >
      <IconHome size="large" />
      <IconLock size="small" />
      <IconLock />
      <IconClear />
      <IconTickCircle />
      <IconTick />
      <IconClose />
      <IconCaretup />
    </div>
    <div
      style={{
        color: 'pink',
      }}
    >
      <IconHome size="large" />
      <IconLock size="small" />
      <IconLock />
      <IconClear />
      <IconTickCircle />
      <IconTick />
      <IconClose />
      <IconCaretup />
      <IconAIStrokedLevel1 />
      <IconAIFilledLevel1 />
      <IconAIEditLevel1 />
      <IconAIWandLevel1 />
      <IconAIImageLevel1 />
      <IconAISearchLevel1 />
      <IconAIFileLevel1 />
      <IconAIBellLevel1 />
    </div>
  </div>
);

export const AIIcon = () => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gridGap: '10px', width: 100}}>
      <IconAIStrokedLevel1 />
      <IconAIStrokedLevel2 />
      <IconAIStrokedLevel3 />
      <IconAIFilledLevel1 />
      <IconAIFilledLevel2 />
      <IconAIFilledLevel3 />
      <IconAIEditLevel1 />
      <IconAIEditLevel2 />
      <IconAIEditLevel3 />
      <IconAIWandLevel1 />
      <IconAIWandLevel2 />
      <IconAIWandLevel3 />
      <IconAIImageLevel1 />
      <IconAIImageLevel2 />
      <IconAIImageLevel3 />
      <IconAISearchLevel1 />
      <IconAISearchLevel2 />
      <IconAISearchLevel3 />
      <IconAIFileLevel1 />
      <IconAIFileLevel2 />
      <IconAIFileLevel3 />
      <IconAIBellLevel1 />
      <IconAIBellLevel2 />
      <IconAIBellLevel3 />
      <IconAILoading />
    </div>
  )
}