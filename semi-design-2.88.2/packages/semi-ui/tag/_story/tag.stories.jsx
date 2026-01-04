/* argus-disable unPkgSensitiveInfo */
import React, { useCallback, useState } from 'react';
import withPropsCombinations from 'react-storybook-addon-props-combinations';
import { BASE_CLASS_PREFIX } from '@douyinfe/semi-foundation/base/constants';
import { IconAIFilledLevel1, IconAIFilledLevel3 } from '@douyinfe/semi-icons';

import { Tag, TagGroup } from '../../index';
import { Space } from '@douyinfe/semi-ui';

export default {
  title: 'Tag'
}

export const Tag1 = () => (
  <div>
    <Tag>hello Tag</Tag>
    <Tag>
      <div>
        leftBottom
        <br />
        leftBottom line 2
      </div>
    </Tag>
  </div>
);

Tag1.story = {
  name: 'tag 1',
};

export const Tag2 = () => (
  <div>
    <div className={`${BASE_CLASS_PREFIX}-tag-group`}>
      <Tag color="red" closable>
        hello Tag
      </Tag>
      <Tag color="red">hello Tag</Tag>
      <Tag color="red">hello Tag</Tag>
      <Tag color="red">hello Tag</Tag>
      <Tag color="red">hello Tag</Tag>
    </div>
    <div className={`${BASE_CLASS_PREFIX}-tag-group`}>
      <Tag color="green">hello Tag</Tag>
      <Tag color="green">hello Tag</Tag>
      <Tag color="green">hello Tag</Tag>
      <Tag color="green">hello Tag</Tag>
      <Tag color="green">hello Tag</Tag>
    </div>
    <div className={`${BASE_CLASS_PREFIX}-tag-group`}>
      <Tag color="blue">hello Tag</Tag>
      <Tag color="blue">hello Tag</Tag>
      <Tag color="blue">hello Tag</Tag>
      <Tag color="blue">hello Tag</Tag>
      <Tag color="blue">hello Tag</Tag>
    </div>
    <div className={`${BASE_CLASS_PREFIX}-tag-group`}>
      <Tag color="grey">hello Tag</Tag>
      <Tag color="grey">hello Tag</Tag>
      <Tag color="grey">hello Tag</Tag>
      <Tag color="grey">hello Tag</Tag>
      <Tag color="grey">hello Tag</Tag>
    </div>
    <div className={`${BASE_CLASS_PREFIX}-tag-group`}>
      <Tag color="orange">hello Tag</Tag>
      <Tag color="orange">hello Tag</Tag>
      <Tag color="orange">hello Tag</Tag>
      <Tag color="orange">hello Tag</Tag>
      <Tag color="orange">hello Tag</Tag>
    </div>
    <div className={`${BASE_CLASS_PREFIX}-tag-group`}>
      <Tag color="white">hello Tag</Tag>
      <Tag color="white">hello Tag</Tag>
      <Tag color="white">hello Tag</Tag>
      <Tag color="white">hello Tag</Tag>
      <Tag color="white">hello Tag</Tag>
    </div>
  </div>
);

Tag2.story = {
  name: 'tag 2',
};

export const CombinationShow = withPropsCombinations(
  Tag,
  {
    children: ['hello Tag'],
    size: ['large', 'small'],
    closable: [true, false],
    color: ['green', 'orange', 'blue', 'grey', 'red', 'white'],
  },
  {
    showSource: false,
  }
);

CombinationShow.story = {
  name: 'combination show',
};

const TagGroupDemo = () => {
  let tagList = [
    { color: 'white', children: '抖音' },
    { color: 'white', children: '火山小视频' },
    { color: 'white', children: 'Abc' },
    { color: 'white', children: 'vigo' },
    { color: 'white', children: '皮皮虾' },
  ];
  let divStyle = {
    backgroundColor: 'var(--semi-color-fill-0)',
    height: 35,
    width: 300,
    display: 'flex',
    alignItems: 'center',
    padding: '0 10px',
  };
  return (
    <>
      <div style={divStyle}>
        <TagGroup
          maxTagCount={3}
          style={{ width: 300 }}
          tagList={tagList}
          size="large"
          showPopover
        ></TagGroup>
      </div>
      <br />
      <div style={divStyle}>
        <TagGroup
          maxTagCount={3}
          style={{ width: 300 }}
          tagList={tagList}
          size="small"
          showPopover
        ></TagGroup>
      </div>
      <br />
      <div>
        <TagGroup style={{ width: 300 }} tagList={tagList} size="large"></TagGroup>
      </div>
      <div>
        <TagGroup style={{ width: 300 }} tagList={tagList} size="small"></TagGroup>
      </div>
    </>
  );
};

export const _TagGroup = () => <TagGroupDemo />;

_TagGroup.story = {
  name: 'tagGroup',
};

export const TagAvatar = () => {
  const avatarSrc =
    'https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/avatarDemo.jpeg';
  return (
    <div style={{ margin: 10 }}>
      <Tag avatarSrc={avatarSrc} avatarShape={'square'} onClick={()=>{console.log('如果能重来，我要做李白')}}>
        李白
      </Tag>
      <br />
      <Tag avatarSrc={avatarSrc} avatarShape={'square'} size="large">
        李白
      </Tag>
      <br />
      <Tag avatarSrc={avatarSrc} avatarShape={'circle'}>
        白居易
      </Tag>
      <br />
      <Tag avatarSrc={avatarSrc} avatarShape={'circle'} size="large">
        白居易
      </Tag>
      <br />
      <Tag closable={true} avatarSrc={avatarSrc} avatarShape={'square'}>
        李白
      </Tag>
      <br />
      <Tag closable={true} avatarSrc={avatarSrc} avatarShape={'square'} size="large">
        李白
      </Tag>
      <br />
      <Tag closable={true} avatarSrc={avatarSrc} avatarShape={'circle'}>
        白居易
      </Tag>
      <br />
      <Tag closable={true} avatarSrc={avatarSrc} avatarShape={'circle'} size="large">
        白居易
      </Tag>
      <br />
    </div>
  );
};

TagAvatar.story = {
  name: 'tag avatar',
};

const AvatarTagGroupDemo = () => {
  const src =
    'https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/avatarDemo.jpeg';
  let tagList = [
    { color: 'white', children: '抖音', avatarSrc: src },
    { color: 'white', children: '火山小视频', avatarSrc: src },
    { color: 'white', children: 'Abc', avatarSrc: src },
    { color: 'white', children: 'vigo', avatarSrc: src },
    { color: 'white', children: '皮皮虾', avatarSrc: src },
  ];
  let divStyle = {
    backgroundColor: 'var(--semi-color-fill-0)',
    height: 35,
    width: 350,
    display: 'flex',
    alignItems: 'center',
    padding: '0 10px',
  };
  return (
    <div style={divStyle}>
      <TagGroup
        maxTagCount={3}
        style={{ width: 350 }}
        tagList={tagList}
        size="large"
        avatarShape="circle"
        showPopover
      ></TagGroup>
    </div>
  );
};

export const AvatarTagGroup = () => <AvatarTagGroupDemo />;

AvatarTagGroup.story = {
  name: 'avatar tagGroup',
};

class TagGroupCloseableDemo extends React.Component {
    constructor(props){
        super(props);
        this.state = {
            tagList: [
                { tagKey: '1', color: 'white', children: '抖音',  closable: true,},
                { tagKey: '2',color: 'white', children: '火山小视频', closable: true,},
                { tagKey: '3',color: 'white', children: '剪映', closable: true,},
                { tagKey: '4',color: 'white', children: '皮皮虾', closable: true,},
            ]
        };
        this.tagListClick = this.tagListClick.bind(this);
    }

    tagListClick(value, e, tagKey){
        const newTagList = [...this.state.tagList];
        const closeTagIndex = newTagList.findIndex(t => t.tagKey === tagKey);
        newTagList.splice(closeTagIndex, 1);
        this.setState({
          tagList: newTagList,
        });
    }

    render() {
        return (
            <div style={ {
                backgroundColor: 'var(--semi-color-fill-0)',
                height: 35,
                width: 300,
                display: 'flex',
                alignItems: 'center',
                padding: '0 10px',
                marginBottom: 30,
            }}>
                <TagGroup
                    maxTagCount={3}
                    style={ {
                        display: 'flex',
                        alignItems: 'center',
                        width: 350,
                    }}
                    tagList={this.state.tagList}
                    size='large'
                    onTagClose={this.tagListClick}
                />
            </div>
        );
    }
}

export const TagGroupCloseable = () => <TagGroupCloseableDemo />;

TagGroupCloseable.story = {
  name: 'tagGroup closable',
}

export const Issue1107 = () => {
    const src = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/dy.png';
    const tagList = [
        { color: 'white', children:'Douyin', avatarSrc:src },
        { color: 'white', children:'Hotsoon', avatarSrc:src },
        { color: 'white', children:'Capcut', avatarSrc:src },
        { color: 'white', children:'Xingtu', avatarSrc:src },
    ];
    const divStyle = {
        backgroundColor: 'var(--semi-color-fill-0)',
        height: 35,
        width: 300,
        display: 'flex',
        alignItems: 'center',
        padding: '0 10px',
        marginBottom: 30,
    };
    const tagGroupStyle = {
        display: 'flex',
        alignItems: 'center',
        width: 350,
    };
    return (
        <>
            <div style={divStyle}>
                <TagGroup 
                  maxTagCount={3} 
                  style={tagGroupStyle} 
                  tagList={tagList} 
                  size="small" 
                />
            </div>
            <div style={divStyle}>
                <TagGroup
                    maxTagCount={2}
                    style={tagGroupStyle}
                    tagList={tagList}
                    size="large"
                    avatarShape="circle"
                    showPopover
                />
            </div>
        </>
    );
};

Issue1107.story = {
  name: 'issue 1107',
};

export const TagShape = () => {
  return (
   <div>
      <Space wrap>
        {
          ['amber', 'blue', 'cyan', 'green', 'grey', 'indigo',
            'light-blue', 'light-green', 'lime', 'orange', 'pink',
            'purple', 'red', 'teal', 'violet', 'yellow', 'white'
          ].map(item => (<Tag color={item} key={item} shape='circle'> {item} tag </Tag>))
        }
      </Space>
      <Space wrap>
        {
          ['amber', 'blue', 'cyan', 'green', 'grey', 'indigo',
            'light-blue', 'light-green', 'lime', 'orange', 'pink',
            'purple', 'red', 'teal', 'violet', 'yellow', 'white'
          ].map(item => (<Tag color={item} key={item}> {item} tag </Tag>))
        }
      </Space>
   </div>
  )
};

TagShape.story = {
  name: 'tag shape',
};

export const maxWidth = () => {
  const src = 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/dy.png';
  return (
  <>
    <Tag style={{maxWidth: 100}} >
      李白李白李白李白李白
    </Tag>
    <br /><br />
    <Tag style={{maxWidth: 100}} closable={true}>
      李白李白李白李白李白
    </Tag>
    <br /><br />
    <Tag style={{maxWidth: 100}} avatarSrc={src} avatarShape={'square'} onClick={()=>{console.log('如果能重来，我要做李白')}}>
      李白李白李白李白李白
    </Tag>
  </>
)}

export const ColorFulTag = () => {
  const tagList = [
  { colorful: true, children: 'AI', type: 'solid', prefixIcon: <IconAIFilledLevel1 size="small"/>},
  { colorful: true, children: 'AI', type: 'light', prefixIcon: <IconAIFilledLevel3 size="small" /> },
  { colorful: true, children: 'AI', type: 'ghost', prefixIcon: <IconAIFilledLevel3 size="small"/> },
  { colorful: true, children: 'AI', type: 'solid', gradient: true, prefixIcon: <IconAIFilledLevel1 size="small"/> },
  { colorful: true, children: 'AI', type: 'light', gradient: true, prefixIcon: <IconAIFilledLevel1 size="small" /> },
  { colorful: true, children: 'AI', type: 'ghost', gradient: true, prefixIcon: <IconAIFilledLevel1 size="small"/> },
  ]
  return (
    <>
      <span>Colorful Tag, small</span><br /><br />
      <div style={{ display: 'flex', flexDirection: 'row', columnGap: 30 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gridGap: '10px', width: 'fit-content'}}>
          <Tag prefixIcon={<IconAIFilledLevel1 size="small"/>} colorful={true} type="solid" shape='circle' gradient>AI</Tag>
          <Tag prefixIcon={<IconAIFilledLevel3 size="small" />} colorful={true} type="light" shape='circle' gradient>AI</Tag>
          <Tag prefixIcon={<IconAIFilledLevel3 size="small"/>} colorful={true} type="ghost"  shape='circle' gradient >AI</Tag>
          <Tag prefixIcon={<IconAIFilledLevel1 size="small"/>} colorful={true} type="solid" shape='circle' >AI</Tag>
          <Tag prefixIcon={<IconAIFilledLevel1 size="small" />} colorful={true} type="light" shape='circle'>AI</Tag>
          <Tag prefixIcon={<IconAIFilledLevel1 size="small"/>} colorful={true} type="ghost" shape='circle'>AI</Tag>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gridGap: '10px', width: 'fit-content'}}>
          <Tag prefixIcon={<IconAIFilledLevel1 size="small"/>} colorful={true} type="solid"  gradient>AI</Tag>
          <Tag prefixIcon={<IconAIFilledLevel3 size="small" />} colorful={true} type="light" gradient>AI</Tag>
          <Tag prefixIcon={<IconAIFilledLevel3 size="small"/>} colorful={true} type="ghost"  gradient >AI</Tag>
          <Tag prefixIcon={<IconAIFilledLevel1 size="small"/>} colorful={true} type="solid"  >AI</Tag>
          <Tag prefixIcon={<IconAIFilledLevel1 size="small" />} colorful={true} type="light" >AI</Tag>
          <Tag prefixIcon={<IconAIFilledLevel1 size="small"/>} colorful={true} type="ghost" >AI</Tag>
        </div>
      </div>
      <br />
      <span>Colorful Tag, large</span><br /><br />
      <div style={{ display: 'flex', flexDirection: 'row', columnGap: 30 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gridGap: '10px', width: 'fit-content'}}>
          <Tag prefixIcon={<IconAIFilledLevel1 size="small"/>} colorful={true} type="solid" shape='circle' gradient size="large">AI</Tag>
          <Tag prefixIcon={<IconAIFilledLevel3 size="small" />} colorful={true} type="light" shape='circle' gradient size="large">AI</Tag>
          <Tag prefixIcon={<IconAIFilledLevel3 size="small"/>} colorful={true} type="ghost"  shape='circle' gradient size="large">AI</Tag>
          <Tag prefixIcon={<IconAIFilledLevel1 size="small"/>} colorful={true} type="solid" shape='circle' size="large">AI</Tag>
          <Tag prefixIcon={<IconAIFilledLevel1 size="small" />} colorful={true} type="light" shape='circle' size="large">AI</Tag>
          <Tag prefixIcon={<IconAIFilledLevel1 size="small"/>} colorful={true} type="ghost" shape='circle' size="large">AI</Tag>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gridGap: '10px', width: 'fit-content'}}>
          <Tag prefixIcon={<IconAIFilledLevel1 size="small"/>} colorful={true} type="solid"  gradient size="large">AI</Tag>
          <Tag prefixIcon={<IconAIFilledLevel3 size="small" />} colorful={true} type="light"  gradient size="large">AI</Tag>
          <Tag prefixIcon={<IconAIFilledLevel3 size="small"/>} colorful={true} type="ghost"   gradient size="large">AI</Tag>
          <Tag prefixIcon={<IconAIFilledLevel1 size="small"/>} colorful={true} type="solid"  size="large">AI</Tag>
          <Tag prefixIcon={<IconAIFilledLevel1 size="small" />} colorful={true} type="light"size="large" >AI</Tag>
          <Tag prefixIcon={<IconAIFilledLevel1 size="small"/>} colorful={true} type="ghost" size="large">AI</Tag>
        </div>
      </div><br />
      <span>Colorful Tag, Group</span><br /><br />
      <TagGroup
        maxTagCount={5}
        tagList={tagList}
      ></TagGroup>
    </>
  )
}

