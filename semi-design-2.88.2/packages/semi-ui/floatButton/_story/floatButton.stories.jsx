import React from 'react';
import FloatButton from '../index';
import { DragMove } from '../../index';
import FloatButtonGroup from '../floatButtonGroup';
import { IconAIEditLevel1, IconHelpCircleStroked, IconSearchStroked, IconAIStrokedLevel3 } from '@douyinfe/semi-icons';

export default {
  title: 'FloatButton',
}

export const Single = () => {
  const onClick = () => {
    console.log('onClick');
  }
  return (
    <>
      <FloatButton icon={<IconAIEditLevel1 />} size="small" disabled style={{bottom: '220px'}} />
      <FloatButton icon={<IconAIEditLevel1 />} size="small" colorful  shape="square" style={{bottom: '170px'}} />
      <FloatButton icon={<IconAIEditLevel1 />} size="small" colorful style={{bottom: '120px'}} />
      <FloatButton icon={<IconAIEditLevel1 />} size="small" shape="square" style={{bottom: '70px'}} />
      <FloatButton icon={<IconAIEditLevel1 />} size="small" onClick={onClick}/>
      
      <FloatButton icon={<IconAIEditLevel1 size="small" />}  disabled style={{ insetInlineEnd: 80, bottom: '220px'}} />
      <FloatButton icon={<IconAIEditLevel1 size="small" />}  colorful  shape="square" style={{ insetInlineEnd: 80, bottom: '170px'}} />
      <FloatButton icon={<IconAIEditLevel1 size="small" />} colorful style={{ insetInlineEnd: 80, bottom: '120px'}} />
      <FloatButton icon={<IconAIEditLevel1 size="small" />} shape="square" style={{ insetInlineEnd: 80, bottom: '70px'}} />
      <FloatButton icon={<IconAIEditLevel1 />} onClick={onClick} style={{insetInlineEnd: 80}}/>
     
      <FloatButton icon={<IconAIEditLevel1 size="extra-large" />}  size="large" disabled style={{ insetInlineEnd: 130, bottom: '220px'}} />
      <FloatButton icon={<IconAIEditLevel1 size="extra-large" />}  size="large" colorful  shape="square" style={{ insetInlineEnd: 130, bottom: '170px'}} />
      <FloatButton icon={<IconAIEditLevel1 size="extra-large" />}  size="large" colorful style={{ insetInlineEnd: 130, bottom: '120px'}} />
      <FloatButton icon={<IconAIEditLevel1 size="extra-large" />}  size="large" shape="square" style={{ insetInlineEnd: 130, bottom: '70px'}} />
      <FloatButton icon={<IconAIEditLevel1 size="extra-large" />}  size="large" onClick={onClick} style={{ insetInlineEnd: 130}}/>

      <FloatButton icon={<IconAIEditLevel1 size="small" />}  badge={{dot: true}} size="small" disabled style={{ insetInlineEnd: 200, bottom: '220px'}} />
      <FloatButton icon={<IconAIEditLevel1 size="small" />}  badge={{dot: true}} size="small" colorful  shape="square" style={{ insetInlineEnd: 200, bottom: '170px'}} />
      <FloatButton icon={<IconAIEditLevel1 size="small" />}  badge={{dot: true}} size="small" colorful style={{ insetInlineEnd: 200, bottom: '120px'}} />
      <FloatButton icon={<IconAIEditLevel1 size="small" />}  badge={{dot: true}} size="small" shape="square" style={{ insetInlineEnd: 200, bottom: '70px'}} />
      <FloatButton icon={<IconAIEditLevel1 size="small" />}  badge={{dot: true}} size="small" onClick={onClick} style={{insetInlineEnd: 200}}/>

      <FloatButton icon={<IconAIEditLevel1 />}  badge={{dot: true}} disabled style={{ insetInlineEnd: 250, bottom: '220px'}} />
      <FloatButton icon={<IconAIEditLevel1 />}  badge={{dot: true}} colorful  shape="square" style={{insetInlineEnd: 250,  bottom: '170px'}} />
      <FloatButton icon={<IconAIEditLevel1 />}  badge={{dot: true}} colorful style={{ insetInlineEnd: 250,  bottom: '120px'}} />
      <FloatButton icon={<IconAIEditLevel1 />}  badge={{dot: true}} shape="square" style={{ insetInlineEnd: 250,  bottom: '70px'}} />
      <FloatButton icon={<IconAIEditLevel1 />}  badge={{dot: true}} onClick={onClick} style={{ insetInlineEnd: 250 }} />

      <FloatButton icon={<IconAIEditLevel1 size="extra-large" />}  badge={{dot: true}} size="large" disabled style={{ insetInlineEnd: 300, bottom: '220px'}} />
      <FloatButton icon={<IconAIEditLevel1 size="extra-large" />}  badge={{dot: true}} size="large" colorful  shape="square" style={{ insetInlineEnd: 300, bottom: '170px'}} />
      <FloatButton icon={<IconAIEditLevel1 size="extra-large" />}  badge={{dot: true}} size="large" colorful style={{ insetInlineEnd: 300, bottom: '120px'}} />
      <FloatButton icon={<IconAIEditLevel1 size="extra-large" />}  badge={{dot: true}} size="large" shape="square" style={{ insetInlineEnd: 300, bottom: '70px'}} />
      <FloatButton icon={<IconAIEditLevel1 size="extra-large" />}  badge={{dot: true}} size="large" onClick={onClick} style={{insetInlineEnd: 300}}/>

      <FloatButton icon={<IconAIEditLevel1 size="small" />}  badge={{count: 9}} size="small" disabled style={{ insetInlineEnd: 370, bottom: '220px'}} />
      <FloatButton icon={<IconAIEditLevel1 size="small" />}  badge={{count: 9}} size="small" colorful  shape="square" style={{ insetInlineEnd: 370, bottom: '170px'}} />
      <FloatButton icon={<IconAIEditLevel1 size="small" />}  badge={{count: 9}} size="small" colorful style={{ insetInlineEnd: 370, bottom: '120px'}} />
      <FloatButton icon={<IconAIEditLevel1 size="small" />}  badge={{count: 9}} size="small" shape="square" style={{ insetInlineEnd: 370, bottom: '70px'}} />
      <FloatButton icon={<IconAIEditLevel1 size="small" />}  badge={{count: 9}} size="small" onClick={onClick} style={{insetInlineEnd: 370}}/>

      <FloatButton icon={<IconAIEditLevel1 />}  badge={{count: 'VIP', type: "danger" }} type="" disabled style={{ insetInlineEnd: 420, bottom: '220px'}} />
      <FloatButton icon={<IconAIEditLevel1 />}  badge={{count: 'VIP', type: "danger" }} colorful  shape="square" style={{insetInlineEnd: 420,  bottom: '170px'}} />
      <FloatButton icon={<IconAIEditLevel1 />}  badge={{count: 'VIP', type: "danger" }} colorful style={{ insetInlineEnd: 420,  bottom: '120px'}} />
      <FloatButton icon={<IconAIEditLevel1 />}  badge={{count: 'VIP', type: "danger" }} shape="square" style={{ insetInlineEnd: 420,  bottom: '70px'}} />
      <FloatButton icon={<IconAIEditLevel1 />}  badge={{count: 'VIP', type: "danger" }} onClick={onClick} style={{ insetInlineEnd: 420 }} />

      <FloatButton icon={<IconAIEditLevel1 size="extra-large" />}  badge={{count: 1000, overflowCount: 999}} size="large" disabled style={{ insetInlineEnd: 500, bottom: '310px'}} />
      <FloatButton icon={<IconAIEditLevel1 size="extra-large" />}  badge={{count: 1000, overflowCount: 999}} size="large" colorful  shape="square" style={{ insetInlineEnd: 500, bottom: '240px'}} />
      <FloatButton icon={<IconAIEditLevel1 size="extra-large" />}  badge={{count: 1000, overflowCount: 999}} size="large" colorful style={{ insetInlineEnd: 500, bottom: '170px'}} />
      <FloatButton icon={<IconAIEditLevel1 size="extra-large" />}  badge={{count: 1000, overflowCount: 999}} size="large" shape="square" style={{ insetInlineEnd: 500, bottom: '100px'}} />
      <FloatButton icon={<IconAIEditLevel1 size="extra-large" />}  badge={{count: 1000, overflowCount: 999}} size="large" onClick={onClick} style={{insetInlineEnd: 500}}/>

    </>
  )
}

export const HrefTarget = () => {
  return (
    <>
      <DragMove>
        <FloatButton icon={<IconAIEditLevel1 />} href="https://semi.design" target="_blank" style={{bottom: '220px'}} />
      </DragMove>
      <FloatButton icon={<IconAIEditLevel1 />} href="https://semi.design" shape="square" style={{bottom: '170px'}} />
    </>
  )
}

export const GroupNormal = () => {
  return (
    <div>
      <FloatButtonGroup 
        style={{
          top: 24,
          left: 24,
          bottom: 'auto',
          right: 'auto'
        }}
        items={[
          {
            icon: <IconAIStrokedLevel3 />,
            content: "编辑"
          },
          {
            icon: <IconSearchStroked />,
            content: "搜索"
          },
          {
            icon: <IconHelpCircleStroked />,
            content: "帮助"
          }
        ]}
      />
      <FloatButtonGroup 
        style={{
          top: 100,
          left: 24,
          bottom: 'auto',
          right: 'auto'
        }}
        items={[
          {
            icon: <IconAIStrokedLevel3 />,
            content: "编辑",
            badge: { dot: true, type: "danger" }
          },
          {
            icon: <IconSearchStroked />,
            content: "搜索",
            badge: { dot: true, type: "danger" }
          },
          {
            icon: <IconHelpCircleStroked />,
            content: "帮助",
            badge: { dot: true, type: "danger" }
          }
        ]}
      />
      <FloatButtonGroup 
        style={{
          top: 180,
          left: 24,
          bottom: 'auto',
          right: 'auto'
        }}
        items={[
          {
            icon: <IconAIStrokedLevel3 />,
            content: "编辑",
            badge: { count: 3, type: "danger" }
          },
          {
            icon: <IconSearchStroked />,
            content: "搜索",
            badge: { count: 3, type: "danger" }
          },
          {
            icon: <IconHelpCircleStroked />,
            content: "帮助",
            badge: {count: 100, overflowCount: 99, type: "danger"}
          }
        ]}
      />
    </div>
  )
}

