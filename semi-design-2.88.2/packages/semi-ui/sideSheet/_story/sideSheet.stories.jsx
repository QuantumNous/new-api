import React, { useState } from 'react';

import SideSheet from '../index';
import { Select, Button, Tooltip, RadioGroup, Radio } from '../../index';

export default {
  title: 'SideSheet',
  parameters: {
    chromatic: { disableSnapshot: true },
  },
}

const BasicSide = props => {
  const [visible, setVisible] = useState(false);

  const handleCancel = e => {
    console.log('cancelling');
    setVisible(false);
  };

  return (
    <React.Fragment>
      <Button onClick={() => setVisible(true)}>show sideSheet</Button>
      <SideSheet visible={visible} onCancel={handleCancel}>
        12333
      </SideSheet>
    </React.Fragment>
  );
};

export const SideSheetLeft = () => <BasicSide />;

SideSheetLeft.story = {
  name: 'side sheet left',
};

const PosBasicSide = props => {
  const [visible, setVisible] = useState(false);

  const handleCancel = e => {
    setVisible(false);
  };

  return (
    <React.Fragment>
      <Button onClick={() => setVisible(true)}>show sideSheet</Button>
      <SideSheet visible={visible} placement={'bottom'} onCancel={handleCancel}>
        12333
      </SideSheet>
    </React.Fragment>
  );
};

export const _SideSheet = () => <PosBasicSide />;

_SideSheet.story = {
  name: 'side sheet',
};

const SideMask = props => {
  const [visible, setVisible] = useState(false);

  const handleCancel = e => {
    setVisible(false);
  };

  return (
    <React.Fragment>
      <Button onClick={() => setVisible(true)}>show sideSheet</Button>
      <SideSheet
        visible={visible}
        placement={'bottom'}
        onCancel={handleCancel}
        maskClosable={false}
      >
        12333
      </SideSheet>
    </React.Fragment>
  );
};

export const SideSheetMask = () => <SideMask />;

SideSheetMask.story = {
  name: 'side sheet mask',
};

const Test2 = () => {
  const [visible, setVisible] = useState(false);
  const [visible2, setVisible2] = useState(false);
  const handleCancel = e => {
    setVisible(false);
  };

  const handleCancel2 = e => {
    setVisible2(false);
  };

  return (
    <>
      <Button onClick={() => setVisible(true)}> show sideSheet </Button>
      <SideSheet visible={visible} placement={'bottom'} onCancel={handleCancel}>
        <Button onClick={() => setVisible2(true)}>show sideSheet2 </Button>
        <SideSheet
          visible={visible2}
          placement={'bottom'}
          onCancel={handleCancel2}
          height="200px"
        />
      </SideSheet>
    </>
  );
};

export const SidesheetInSidesheet = () => <Test2 />;

SidesheetInSidesheet.story = {
  name: 'sidesheet in sidesheet',
};

const Blocking = () => {
  const [visible, setVisible] = useState(false);
  const [placement, setPlacement] = useState('right');
  const handleCancel = e => {
    setVisible(false);
  };
  const show = () => {
    setVisible(true);
  };

  const onSelect = e => {
    setPlacement(e.target.value);
  };
  return (
    <>
      <RadioGroup onChange={e => onSelect(e)} value={placement}>
        <Radio value={'right'}>right</Radio>
        <Radio value={'left'}>left</Radio>
        <Radio value={'top'}>top</Radio>
        <Radio value={'bottom'}>bottom</Radio>
      </RadioGroup>
      <p>
        jklasjdkfljaskljdfklajksdljfkl;ajklsdjfk;lajksldjfklajskdlfjajsdlf;jaklsjdfkljaklsdjflajsdfjakljsdkl;fja;sd
      </p>
      <br />
      <br />
      <Button onClick={() => show()}>Open SideSheet</Button>
      <SideSheet
        title="自定义位置的侧边栏"
        visible={visible}
        placement={placement}
        onCancel={() => handleCancel()}
        mask={false}
      >
        <p>This is the content of a basic sidesheet.</p>
        <p>Here is more content...</p>
      </SideSheet>
    </>
  );
};

export const SidesheetNonBlocking = () => <Blocking />;

SidesheetNonBlocking.story = {
  name: 'sidesheet non-blocking',
};

const Popup = () => {
  const [visible, setVisible] = useState(false);
  const [placement, setPlacement] = useState('right');
  const handleCancel = e => {
    setVisible(false);
  };

  const onSelect = e => {
    setPlacement(e.target.value);
  };
  return (
    <div
      style={{
        height: 200,
        overflow: 'hidden',
        position: 'relative',
        border: '1px solid #ebedf0',
        borderRadius: 2,
        padding: 48,
        textAlign: 'center',
        background: '#fafafa',
      }}
      className="sidesheet-container"
    >
      Render in this
      <div style={{ marginTop: 16 }}>
        <Button onClick={() => setVisible(true)}> show sideSheet </Button>
        <RadioGroup onChange={e => onSelect(e)} value={placement}>
          <Radio value={'right'}>right</Radio>
          <Radio value={'left'}>left</Radio>
          <Radio value={'top'}>top</Radio>
          <Radio value={'bottom'}>bottom</Radio>
        </RadioGroup>
      </div>
      <SideSheet
        visible={visible}
        title="sideSheet"
        height="100px"
        onCancel={handleCancel}
        placement={placement}
        getPopupContainer={() => document.querySelector('.sidesheet-container')}
      >
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
      </SideSheet>
    </div>
  );
};

export const SidesheetGetpopupcontanier = () => <Popup />;

SidesheetGetpopupcontanier.story = {
  name: 'sidesheet getpopupcontanier',
};

const Combox = () => {
  const [visible, setVisible] = useState(false);
  const [placement, setPlacement] = useState('right');
  const handleCancel = e => {
    setVisible(false);
  };

  const onSelect = e => {
    setPlacement(e.target.value);
  };
  return (
    <div
      style={{
        height: 200,
        overflow: 'hidden',
        position: 'relative',
        border: '1px solid #ebedf0',
        borderRadius: 2,
        padding: 48,
        textAlign: 'center',
        background: '#fafafa',
      }}
      className="sidesheet-container"
    >
      Render in this
      <div style={{ marginTop: 16 }}>
        <Button onClick={() => setVisible(true)}> show sideSheet </Button>
        <RadioGroup onChange={e => onSelect(e)} value={placement}>
          <Radio value={'right'}>right</Radio>
          <Radio value={'left'}>left</Radio>
          <Radio value={'top'}>top</Radio>
          <Radio value={'bottom'}>bottom</Radio>
        </RadioGroup>
      </div>
      <SideSheet
        visible={visible}
        title="sideSheet"
        height="100px"
        onCancel={handleCancel}
        placement={placement}
        mask={false}
        bodyStyle={{ overflow: 'auto', height: 200 }}
        getPopupContainer={() => document.querySelector('.sidesheet-container')}
      >
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
      </SideSheet>
    </div>
  );
};

export const SidesheetGetpopupcontanierAndNonBlocking = () => <Combox />;

SidesheetGetpopupcontanierAndNonBlocking.story = {
  name: 'sidesheet getpopupcontanier and non-blocking',
};

const WithFooter = () => {
  const [visible, setVisible] = useState(false);
  const handleCancel = e => {
    setVisible(false);
  };
  const show = () => {
    setVisible(true);
  };

  return (
    <div>
      <Button onClick={() => show()}>Open SideSheet</Button>
      <SideSheet
        visible={visible}
        title="sideSheet"
        footer={<div>1234</div>}
        placement={'right'}
        onCancel={handleCancel}
        // bodyStyle={{ overflow: 'auto', height: 200 }}
      >
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
      </SideSheet>
    </div>
  );
};

export const _WithFooter = () => <WithFooter />;

_WithFooter.story = {
  name: 'WithFooter',
};

const MaskFalseDemo = () => {
  const [visible, setVisible] = useState(false);
  const handleCancel = e => {
    setVisible(false);
  };
  const show = () => {
    setVisible(true);
  };

  return (
    <div>
      <Button onClick={() => show()}>Open SideSheet</Button>
      <SideSheet
        mask={false}
        width="90%"
        visible={visible}
        placement={'right'}
        onCancel={handleCancel}
      >
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
      </SideSheet>
    </div>
  );
};

export const WidthPercentMaskFalse = () => <MaskFalseDemo />;

WidthPercentMaskFalse.story = {
  name: 'width percent & mask=false',
};
