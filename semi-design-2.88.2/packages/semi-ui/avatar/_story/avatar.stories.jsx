import React, {useState} from 'react';
import { Avatar,Popover, AvatarGroup, RadioGroup, Radio } from '../../index';
import { Input } from '../../input'
import {IconPlus} from "@douyinfe/semi-icons";

export default {
  title: 'Avatar',
}

export const Basic = () => (
  <div>
    <div>
      <Avatar>U</Avatar>
      <Avatar autoFocus size="large" onClick={() => console.log('ok')}>U</Avatar>
      <Avatar size="extra-small">U</Avatar>
      <Avatar size="small">U</Avatar>
      <Avatar size="default">U</Avatar>
      <Avatar size="extra-large">U</Avatar>
    </div>
    <div>
      <Avatar shape="square">U</Avatar>
      <Avatar shape="square" size="large">
        U
      </Avatar>
      <Avatar shape="square" size="extra-small">
        U
      </Avatar>
      <Avatar shape="square" size="small">
        U
      </Avatar>
      <Avatar shape="square" size="default">
        U
      </Avatar>
      <Avatar shape="square" size="extra-large">
        U
      </Avatar>
    </div>
  </div>
);

export const BottomSolt = () => (
    <div>
        <div>
            <Avatar shape="circle" border={true} bottomSlot={{
                shape:'circle',
                text:<IconPlus/>
            }}
            onClick={(e) => {console.log('on click')}}
            onMouseEnter={(e) => {console.log('on mouse enter')}}
            onMouseLeave={(e) => {console.log('onMouse leave')}}
            >U</Avatar>
            <Avatar shape="circle" size={'large'} border={true} bottomSlot={{
                shape:'circle',
                text:<IconPlus/>
            }}>U</Avatar>
            <Avatar shape="circle" size={'small'} border={true} bottomSlot={{
                shape:'circle',
                text:<IconPlus/>
            }}>U</Avatar>
            <Avatar shape="circle" bottomSlot={{
                shape:'square',
                text: "直播中"
            }}>U</Avatar>
            <Avatar shape="circle" size={"large"} bottomSlot={{
                shape:'square',
                text: "直播中"
            }}>U</Avatar>
            <Avatar shape="circle" bottomSlot={{
                shape:'rect',
                text: "直播中",
                render:()=>{
                    return "test"
                }
            }}>U</Avatar>
        </div>
    </div>
);

BottomSolt.parameters = {
    chromatic: { disableSnapshot: true },
}

export const TopSolt = () => (
    <div>
        <div>
            <Avatar shape="circle"  size={"extra-extra-small"}  border={true} topSlot={{
                text:"直播",
                gradientStart:"rgb(255,23,100)",
                gradientEnd:"rgb(237,52,148)"
            }}>U</Avatar>
            <Avatar shape="circle"  size={"extra-small"}  border={true} topSlot={{
                text:"直播"
            }}>U</Avatar>
            <Avatar shape="square" size={"default"} border={true} topSlot={{
                text:"直播"
            }}>U</Avatar>
            <Avatar shape="circle" size={"medium"} border={true} topSlot={{
                text:"直播"
            }}>U</Avatar>
            <Avatar shape="circle" size={"large"} borderMotion={true} border={true} topSlot={{
                text:"直播"
            }} bottomSlot={{
                text:"T",
                shape:"circle"
            }} contentMotion={true}>U</Avatar>
            <br/>
            <Avatar shape="square"  size={"extra-extra-small"}  border={true} topSlot={{
                text:"直播"
            }}>U</Avatar>
            <Avatar shape="square"  size={"extra-small"}  border={true} topSlot={{
                text:"直播"
            }}>U</Avatar>
            <Avatar shape="square" size={"default"} border={true} topSlot={{
                text:"直播"
            }}>U</Avatar>
            <Avatar shape="square" size={"medium"} border={true} topSlot={{
                text:"直播"
            }}>U</Avatar>
            <Avatar shape="square" size={"large"} borderMotion={true} border={true} topSlot={{
                text:"直播"
            }}  bottomSlot={{
                text:"T",
                shape:"circle"
            }}>U</Avatar>
            <br/>
            <Avatar shape="circle"  size={"extra-extra-small"}  border={false} topSlot={{
                text:"直播"
            }}>U</Avatar>
            <Avatar shape="circle"  size={"extra-small"}  border={false} topSlot={{
                text:"直播"
            }}>U</Avatar>
            <Avatar shape="square" size={"default"} border={false} topSlot={{
                text:"直播"
            }}>U</Avatar>
            <Avatar shape="circle" size={"medium"} border={false} topSlot={{
                text:"直播"
            }}>U</Avatar>
            <Avatar shape="circle" size={"large"} borderMotion={true} border={false} topSlot={{
                text:"直播"
            }}  bottomSlot={{
                text:"T",
                shape:"circle"
            }}>U</Avatar>
            <br/>
            <Avatar shape="square"  size={"extra-extra-small"}  border={false} topSlot={{
                text:"直播"
            }}>U</Avatar>
            <Avatar shape="square"  size={"extra-small"}  border={false} topSlot={{
                text:"直播"
            }}>U</Avatar>
            <Avatar shape="square" size={"default"} border={false} topSlot={{
                text:"直播"
            }}>U</Avatar>
            <Avatar shape="square" size={"medium"} border={false} topSlot={{
                text:"直播"
            }}>U</Avatar>
            <Avatar shape="square" size={"large"} borderMotion={true} border={false} topSlot={{
                text:"直播"
            }}  bottomSlot={{
                text:"T",
                shape:"circle"
            }}>U</Avatar>
        </div>
    </div>
);

TopSolt.parameters = {
    chromatic: { disableSnapshot: true },
}


export const CustomAvatar = () => (
  <div>
    <Avatar>U</Avatar>
    <Avatar color="red">U</Avatar>
    <Avatar color="red" size="default">
      DF
    </Avatar>
    <Avatar src="https://zos.alipayobjects.com/rmsportal/ODTLcjxAfvqbxHnVXCYX.png" alt="a man" />
    <Avatar size="default" src="https://zos.alipayobjects.com/rmsportal/ODTLcjxAfvqbxHnVXCYX.png" alt="a man" />
    <Avatar size="small" src="https://zos.alipayobjects.com/rmsportal/ODTLcjxAfvqbxHnVXCYX.png" alt="a man" />
    <Avatar style={{ color: '#f56a00', backgroundColor: '#fde3cf' }}>U</Avatar>
    <Avatar style={{ backgroundColor: '#87d068' }}>YZ</Avatar>
  </div>
);

export const GroupSize = () => (
  <div>
    <p>medium</p>
    <AvatarGroup>
      <Avatar color="red" topSlot={{text:"T"}} bottomSlot={{text:"T"}}>LL</Avatar>
      <Avatar>CX</Avatar>
      <Avatar size="default">CX</Avatar>
      <Avatar color="amber">RM</Avatar>
      <Avatar style={{ color: '#f56a00', backgroundColor: '#fde3cf' }}>ZL</Avatar>
      <Avatar style={{ backgroundColor: '#87d068' }}>YZ</Avatar>
    </AvatarGroup>
    <p>default</p>
    <AvatarGroup size="default">
      <Avatar color="red">LL</Avatar>
      <Avatar>CX</Avatar>
      <Avatar size="default">CX</Avatar>
      <Avatar color="amber">RM</Avatar>
      <Avatar style={{ color: '#f56a00', backgroundColor: '#fde3cf' }}>ZL</Avatar>
      <Avatar style={{ backgroundColor: '#87d068' }}>YZ</Avatar>
    </AvatarGroup>
    <p>small</p>
    <AvatarGroup size="small">
      <Avatar color="red">LL</Avatar>
      <Avatar>CX</Avatar>
      <Avatar size="default">CX</Avatar>
      <Avatar color="amber">RM</Avatar>
      <Avatar style={{ color: '#f56a00', backgroundColor: '#fde3cf' }}>ZL</Avatar>
      <Avatar style={{ backgroundColor: '#87d068' }}>YZ</Avatar>
    </AvatarGroup>
  </div>
);

export const OverlapFromDemo = () => (
  <div>
    <div>overlapFrom=start</div>
    <AvatarGroup overlapFrom={'start'}>
      <Avatar color="red">LL</Avatar>
      <Avatar>CX</Avatar>
      <Avatar color="amber">RM</Avatar>
      <Avatar style={{ color: '#f56a00', backgroundColor: '#fde3cf' }}>ZL</Avatar>
      <Avatar style={{ backgroundColor: '#87d068' }}>YZ</Avatar>
    </AvatarGroup>
    <br />
    <br />
    <div>overlapFrom=end</div>
    <AvatarGroup overlapFrom={'end'}>
      <Avatar color="red">LL</Avatar>
      <Avatar>CX</Avatar>
      <Avatar color="amber">RM</Avatar>
      <Avatar style={{ color: '#f56a00', backgroundColor: '#fde3cf' }}>ZL</Avatar>
      <Avatar style={{ backgroundColor: '#87d068' }}>YZ</Avatar>
    </AvatarGroup>
    <br />
    <br />
  </div>
);

export const MaxCountDemo = () => (
  <div>
    <div>maxCount=3</div>
    <AvatarGroup maxCount={3}>
      <Avatar color="red">LL</Avatar>
      <Avatar>CX</Avatar>
      <Avatar color="amber">RM</Avatar>
      <Avatar style={{ color: '#f56a00', backgroundColor: '#fde3cf' }}>ZL</Avatar>
      <Avatar style={{ backgroundColor: '#87d068' }}>YZ</Avatar>
    </AvatarGroup>
    <br />
    <br />
  </div>
);

const renderMore = (restNumber, restAvatars) => {
  const content = restAvatars.map((avatar, index) => {
    return (
      <div style={{ paddingBottom: '12px' }}>
        {React.cloneElement(avatar, { size: 'extra-small' })}
        <span style={{ marginLeft: 8, fontSize: 14 }}>这是段文字描述</span>
      </div>
    );
  });
  return (
    <Popover
      content={content}
      autoAdjustOverflow={false}
      position={'bottomRight'}
      style={{ padding: '12px 8px', paddingBottom: 0 }}
    >
      <Avatar>{`+${restNumber}`}</Avatar>
    </Popover>
  );
};

export const RenderMoreDemo = () => (
  <div>
    <AvatarGroup maxCount={3} renderMore={renderMore}>
      <Avatar color="red">LL</Avatar>
      <Avatar>CX</Avatar>
      <Avatar color="amber">RM</Avatar>
      <Avatar style={{ color: '#f56a00', backgroundColor: '#fde3cf' }}>ZL</Avatar>
      <Avatar style={{ backgroundColor: '#87d068' }}>YZ</Avatar>
    </AvatarGroup>
    <br />
    <br />
  </div>
);

export const ExtraExtraSmallOverlap = () => (
  <div>
    <AvatarGroup size="extra-extra-small" overlapFrom={'start'}>
      <Avatar color="red">LL</Avatar>
      <Avatar>CX</Avatar>
      <Avatar color="amber">RM</Avatar>
      <Avatar style={{ color: '#f56a00', backgroundColor: '#fde3cf' }}>ZL</Avatar>
      <Avatar style={{ backgroundColor: '#87d068' }}>YZ</Avatar>
    </AvatarGroup>
    <br />
    <br />
    <AvatarGroup size="extra-extra-small" overlapFrom={'end'}>
      <Avatar color="red">LL</Avatar>
      <Avatar>CX</Avatar>
      <Avatar color="amber">RM</Avatar>
      <Avatar style={{ color: '#f56a00', backgroundColor: '#fde3cf' }}>ZL</Avatar>
      <Avatar style={{ backgroundColor: '#87d068' }}>YZ</Avatar>
    </AvatarGroup>
    <br />
    <br />
    <AvatarGroup size="extra-extra-small" maxCount={3}>
      <Avatar color="red">LL</Avatar>
      <Avatar>CX</Avatar>
      <Avatar color="amber">RM</Avatar>
      <Avatar style={{ color: '#f56a00', backgroundColor: '#fde3cf' }}>ZL</Avatar>
      <Avatar style={{ backgroundColor: '#87d068' }}>YZ</Avatar>
    </AvatarGroup>
  </div>
);

export const focusTest = () => {
  return (
    <>
      <div id='initial_focus_point' tabindex={0} style={{width: 10, height: 10}}></div>
      <Avatar
        alt="a cat 1"
        src="https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/avatarDemo.jpeg"
        style={{ margin: 4 }}
        onClick={()=>{
            console.log('click avatar 1');
        }}
      />
      <Avatar
        alt="a cat 2"
        size="small"
        src="https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/avatarDemo.jpeg"
        style={{ margin: 4 }}
        onClick={()=>{
            console.log('click avatar 2');
        }}
      />
    </>
  );
}

const srcGroup = {
  'successSrc1': 'https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/avatarDemo.jpeg',
  'successSrc2': 'https://zos.alipayobjects.com/rmsportal/ODTLcjxAfvqbxHnVXCYX.png',
  'errorSrc': 'https://xxx.png',
}

export const srcChange = () => {
  const [src, setSrc] = useState('successSrc1');

  const onChange = (e) => {
    setSrc(e.target.value);
  } 

  return (
    <>
      <div>点击选择src类型</div>
      <RadioGroup onChange={onChange} value={src} aria-label="单选组合示例">
        <Radio value={'successSrc1'}>成功的src</Radio>
        <Radio value={'successSrc2'}>成功的src</Radio>
        <Radio value={'errorSrc'}>失败的src</Radio>
      </RadioGroup>
      <br />
      <Avatar
        alt="test image"
        src={srcGroup[src]}
        style={{ margin: 4 }}
        onError={() => {
          console.log('loading error');
        }}
      />
    </>
  )
}

export const adaptLength = () => {
    const [string, setString] = useState("Semi")
    return (
        <div>
            <div>
                <span></span>
                <div style={{width: "300px", display: "flex", alignItems: "center"}}>
                    <span>Content:</span>
                    <Input value={string} onChange={(value)=>{ setString(value) }}></Input>
                </div>
            </div>
            <div>
                <Avatar>{string}</Avatar>
                <Avatar gap={10}>{string}</Avatar>
            </div>
            <div>
                <Avatar size="large">{string}</Avatar>
                <Avatar size="large" gap={10}>{string}</Avatar>
            </div>
        </div>
    );
}
