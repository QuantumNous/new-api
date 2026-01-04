import React, { useCallback, useState, useRef, useMemo } from 'react';
import Button from '../../button';
import AIChatInput from '../index';
import Configure from '../configure';
import { IconFixedStroked, IconBookOpenStroked, IconClose, IconUpload } from '@douyinfe/semi-icons';
import { modelOptions, mcpOptions, radioButtonProps1, radioButtonProps2, skills, template, 
  reference, uploadProps, suggestionTemplate, customReferences, refTypeToIconMap } from './constant';
import './stories.scss';
import { getAttachmentType, isImageType } from '@douyinfe/semi-foundation/aiChatInput/utils';
import suggestion from './suggestion';
import Mention from '@tiptap/extension-mention';
import ReferSlot from './referSlot';
import { RadioGroup, Radio, Cascader } from '../../index';
import getConfigureItem from '../configure/getConfigureItem';

export default {
  title: 'AIChatInput',
}

const outerStyle = { margin: 12, maxHeight: 300 };

export const Basic = () => {
  const [generating, setGenerating] = useState(false);
  const onContentChange = useCallback((content) => {
    console.log('onContentChange', content);
  }, []);

  const onUploadChange = useCallback((fileList) => {
    console.log('onUploadChange', fileList);
  }, []);

  const toggleGenerate = useCallback((props) => {
    setGenerating(value => !value);
  }, []);
  
  return (
    <div>
    <AIChatInput
      generating={generating}
      placeholder={'输入内容或者上传内容'} 
      uploadProps={uploadProps}
      onContentChange={onContentChange}
      onUploadChange={onUploadChange}
      style={outerStyle}
      onMessageSend={toggleGenerate}
      onStopGenerate={toggleGenerate}
    />
    </div>
  );
}

const temp = {
    'input-slot': `我是一名<input-slot placeholder="[职业]">学生</input-slot>，帮我写一段面向<input-slot placeholder="[输入对象]"></input-slot>的话术内容`,
    'select-slot': `我的职业是<select-slot value="打工人" options='["打工人", "学生"]'></select-slot>，帮我写一份...`,
    // 'skill-slot': '<skill-slot data-label="帮我写作" data-value="writing" data-template=true></skill-slot>帮我完成...',
    'skill-slot': {
        type: "skillSlot",
        attrs: { label: "帮我写作", value: 'writing',  hasTemplate: false }
      },
};

export const RichTextExample = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const ref = useRef();

   const setTemplate = useCallback((event) => {
    const index = Number(event.target.dataset.index);
    setActiveIndex(index);
    const content = Object.values(temp)[index];
    if (ref.current) {
      ref.current.setContent(content);
      ref.current.focusEditor();
    }
  }, [ref]);

  const onContentChange = useCallback((content) => {
    console.log('onContentChange', content);
  }, []);

  const onSkillChange = useCallback((skill) => {
    console.log("skill", skill);
  })

  return (<>
      <div className="aiChatInput-radio">
        {Object.keys(temp).map((item, index) => {
          return <div 
            className={`aiChatInput-radio-item ${index === activeIndex ? 'aiChatInput-radio-item-selected' : ''}` }
            key={index} 
            data-index={index} 
            onClick={setTemplate}
          >{item}</div>
        })}
      </div>
      <AIChatInput
          ref={ref}
          defaultContent={temp['input-slot']}
          placeholder={'输入内容或者上传内容'} 
          uploadProps={uploadProps}
          onSkillChange={onSkillChange}
          onContentChange={onContentChange}
          style={outerStyle} 
      />
      <Button onClick={() => {
        const html = ref.current.editor.getHTML();
        const json = ref.current.editor.getJSON();
        console.log('html', html);
        console.log('json', json);
      }}>点击获取</Button>
  </>);
}

export const SendMessage = () => {
  const [generating, setGenerating] = useState(false);
  const onContentChange = useCallback((content) => {
    console.log('onContentChange', content);
  }, []);

  const onUploadChange = useCallback((fileList) => {
    console.log('onUploadChange', fileList);
  }, []);

  const toggleGenerate = useCallback((props) => {
    setGenerating(value => !value);
  }, []);
  
  return (
    <AIChatInput
      generating={generating}
      placeholder={'输入内容或者上传内容'} 
      uploadProps={uploadProps}
      onContentChange={onContentChange}
      onUploadChange={onUploadChange}
      style={outerStyle}
      onMessageSend={toggleGenerate}
      onStopGenerate={toggleGenerate}
    />
  );
}

export const ReferenceExample = () => {
  const [references, setReferences] = useState(reference);
  const handleReferenceDelete = useCallback((item) => {
    const newReference = references.filter((ref) => ref.id !== item.id);
    setReferences(newReference);
  }, [references]);
  
  return (
    <AIChatInput
      placeholder={'用于查看引用内容的用例'} 
      onReferenceDelete={handleReferenceDelete}
      references={references} 
      uploadProps={uploadProps}
      style={outerStyle}
    />
  );
}

export const ConfigureDemo = () => {
  const renderLeftMenu = useCallback(() => (<>
    <Configure.Select optionList={modelOptions} field="model" initValue="GPT-4o" />
    <Configure.Button icon={<IconFixedStroked />} field="deepThink">深度思考</Configure.Button>
    <Configure.Button icon={<IconBookOpenStroked />} field="onlineSearch">联网搜索</Configure.Button>
    <Configure.Mcp options={mcpOptions} />
    <Configure.RadioButton options={radioButtonProps1} field="thinkType" initValue="fast"/>
  </>), []);

  const onConfigureChange = useCallback((value, changedValue) => {
    console.log('onConfigureChange', value, changedValue);
  }, []);

  const onMessageSend = useCallback((message) => {
    console.log('message', message);
  }, [])
  
  return (
    <AIChatInput
      placeholder={'用于查看右下方配置项的用例'} 
      renderConfigureArea={renderLeftMenu} 
      onConfigureChange={onConfigureChange}
      onMessageSend={onMessageSend}
      uploadProps={uploadProps}
      style={outerStyle}
    />
  );
}

// 来个自定义的 Cascader
const cascaderModalOptions = [
    {
      label: 'GPT',
      value: 'GPT',
      children: [
            {
              label: 'GPT-4o',
              value: 'GPT-4o',
          },
          {
              value: 'GPT-5',
              label: 'GPT-5',
          }
      ],
    },
    {
      label: 'Claude',
      value: 'Claude',
      children: [
            {
              label: 'Claude 3.5 Sonnet',
              value: 'Claude 3.5 Sonnet',
          }
      ],
    }
];
const CustomCascader = getConfigureItem(Cascader, { className: 'aiChatInput-cascader-configure'});

export const CustomConfigure = () => {
  const renderLeftMenu = useCallback(() => (<>
    <CustomCascader field="model" treeData={cascaderModalOptions} initValue={['GPT', 'GPT-4o']} />
  </>), []);

  const onConfigureChange = useCallback((value, changedValue) => {
    console.log('onConfigureChange', value, changedValue);
  }, []);
  
  return (
    <AIChatInput
      placeholder={'用于查看右下方配置项的用例'} 
      renderConfigureArea={renderLeftMenu} 
      onConfigureChange={onConfigureChange}
      uploadProps={uploadProps}
      style={outerStyle}
    />
  );
}

export const Square = () => {
  const [round, setRound] = useState(false);
  const renderLeftMenu = useCallback(() => <>
      <Configure.Select optionList={modelOptions} field="model" initValue="GPT-4o" />
      <Configure.Button icon={<IconFixedStroked />} field="deepThink">深度思考</Configure.Button>
      <Configure.Button icon={<IconBookOpenStroked />} field="onlineSearch">联网搜索</Configure.Button>
      <Configure.Mcp options={mcpOptions} />
      <Configure.RadioButton options={radioButtonProps1} field="thinkType" initValue="fast"/>
   </>);

  const onChange = useCallback((e) => {
      setRound(e.target.value);
  }, []);
    
  return (<>
    <RadioGroup onChange={onChange} value={round} aria-label="单选组合示例" name="demo-radio-group">
        <Radio value={true}>圆形</Radio>
        <Radio value={false}>方形</Radio>
    </RadioGroup>
    <AIChatInput
        placeholder={'下方按钮为方形的用例'} 
        round={round}
        renderConfigureArea={renderLeftMenu} 
        uploadProps={uploadProps}
        style={outerStyle}
    />
  </>);
}

export const Suggestion = () => {
  const [suggestion, setSuggestion] = useState([]);
  const onChange = useCallback((content) => {
    const value = content?.[0]?.text;
    if (value === undefined || value.includes('\n')) {
     if (suggestion === undefined || suggestion.length === 0) {
      return;
     } else {
      return setSuggestion([]);
     }
    }
    if (value.length === 0) {
      setSuggestion([]);
    } else if (value.length > 0 && value.length < 4) {
      const su = new Array(suggestionTemplate.length).fill(0).map((item, index) => {
        return `${value}, ${suggestionTemplate[index]}`;
      });
      setSuggestion(su);
    } else if (value.length >= 4){
      setSuggestion([])
    }
  }, [suggestion]);

  const renderLeftMenu = useCallback(() => <>
    <Configure.Select optionList={modelOptions} field="model" initValue="GPT-4o" />
    <Configure.RadioButton options={radioButtonProps2} initValue="fast"/>
  </>);
  
  return (
    <AIChatInput
      placeholder={'输入内容，当内容长度小于4可以看到建议, 可以通过鼠标上下按键切换侯选项'} 
      suggestions={suggestion} 
      renderConfigureArea={renderLeftMenu} 
      onContentChange={onChange}
      uploadProps={uploadProps}
      style={outerStyle}
    />
  );
}

const TemplateContent = (props) => {
  const { onTemplateClick: onTemplateClickProps } = props;
  const [groupIndex, setGroupIndex] = useState(0);
  const onItemClick = useCallback((e) => {
    const index = e.target.dataset.index;
    setGroupIndex(Number(index));
  }, [])

  const onTemplateClick = useCallback((item) => {
    const { content } = item;
    onTemplateClickProps(content);
  }, [onTemplateClickProps])

  return (<div className={'aiChatInput-template'} >
     {/* tabs */}
      <div className={'template-header'} >
        {template?.map((item, index) => {
          return <div
            key={index}
            data-index={index}
            className={`template-header-item ${groupIndex === index ? 'template-header-item-active' : ''}`}
            onClick={onItemClick}
          >
            {item.group}
          </div>
        })}
      </div>
      {/* content */}
      <div className='template-content'>
        {template?.[groupIndex]?.children?.map((item, index) => <div
          key={index}
          className='template-content-item'
          onClick={() => onTemplateClick(item)}
        >
          <div className='template-content-item-icon' style={{ background: item.bg }}>{item.icon}</div>
          <div className='template-content-item-title'>{item.title}</div>
          <div className='template-content-item-desc'>{item.desc}</div>
        </div>)}
      </div>
  </div>);
}

export const Template = () => {
  const ref = useRef();

  const setTemplate = useCallback((content) => {
    ref.current?.setContentWhileSaveTool(content);
    ref.current?.focusEditor();
  }, [ref]);

  const renderTemplate = useCallback((skill, e) => {
    if (skill?.value === 'writing') {
      return <TemplateContent onTemplateClick={setTemplate}/>
    }
  }, [setTemplate]);

  const renderLeftMenu = useCallback(() => <>
    <Configure.Select optionList={modelOptions} field="model" initValue="GPT-4o" />
    <Configure.Button icon={<IconFixedStroked />} field="deepThink">深度思考</Configure.Button>
    <Configure.Button icon={<IconBookOpenStroked />} field="onlineSearch">联网搜索</Configure.Button>
    <Configure.Mcp options={mcpOptions} />
    <Configure.RadioButton options={radioButtonProps1} initValue="fast" field="mode"/>
  </>);

  const onConfigureChange = useCallback((value, changedValue) => {
    console.log('onConfigureChange', value, changedValue);
  }, []);

  return (
    <AIChatInput 
      placeholder='输入 / 唤起技能选择面板，选择技能后，点击模板按钮可查看技能，可通过鼠标上下按键切换侯选项'
      // renderConfigureArea={renderLeftMenu} 
      ref={ref}
      uploadProps={uploadProps}
      skills={skills}
      skillHotKey='/'
      renderTemplate={renderTemplate}
      style={outerStyle}
      onConfigureChange={onConfigureChange}
    />
  );
}

export const CustomRenderTop = () => {
  const ref = useRef();
  const [reference, setReference] = useState(customReferences);

  const renderLeftMenu = useCallback(() => <>
    <Configure.RadioButton options={radioButtonProps2} initValue="fast" field="mode"/>
  </>);

  const renderTopSlot = useCallback((props) => {
    const { attachments = [], references } = props;
    return <div className="topSlot">
      {references?.map((item, index) => {
        const { type, name, detail, key, ...rest } = item;
        return (
          <div className="item" key={key}>
            <span className='item-icon'>
              {React.cloneElement(refTypeToIconMap.get(type), { className: 'item-left item-icon'})}
              <IconClose size="small" className='item-icon-delete' onClick={() => {
                const newReferences = [...references];
                newReferences.splice(index, 1);
                setReference(newReferences);
              }}/>
            </span>
            <span className='item-content'>
              {name}
              {type === 'branch' && <span className='detail'>{detail}</span>}
            </span>
        </div>)
      })}
      {attachments.map((item, index) => {
        const isImage = isImageType(item);
        const realType = getAttachmentType(item);
        const { uid, name, url, size, percent, status } = item;
        return (
          <div className="item" key={uid}>
            <span className='item-icon'>
              {isImage ? <img className='item-image item-left' src={item.url} alt={item.name} /> : 
              <IconUpload size="small" className='item-left item-icon' />}
              <IconClose size="small" className='item-icon-delete' onClick={() => ref.current?.deleteUploadFile(item)}/>
            </span>
            <span className='item-content'>{name}</span>
          </div>
        );
      })}
    </div>
  }, []);
  
  return (
    <AIChatInput
      className='customTopSlot'
      renderTopSlot={renderTopSlot}
      references={reference}
      showUploadFile={false}
      showReference={false}
      renderConfigureArea={renderLeftMenu} 
      ref={ref}
      uploadProps={uploadProps}
      skills={skills}
      style={outerStyle}
      placeholder="自定义渲染顶部内容，可用于渲染上传内容、引用内容"
    />
  );
}

export const CustomRichTextExtension = () => {
  const ref = useRef();
  const [reference, setReference] = useState(customReferences);
  const extensions = useMemo(() => {
    // 使用 @ 触发
    return [
      ReferSlot,
      Mention.configure({
        HTMLAttributes: {
          class: 'mention',
        },
        suggestion,
      }),
    ]
  }, []);

  const renderLeftMenu = useCallback(() => <>
    <Configure.RadioButton options={radioButtonProps2} initValue="fast" field="mode"/>
  </>);

  const renderTopSlot = useCallback((props) => {
    const { attachments = [], references = [], content = [] } = props;
    const showContent = content.filter((item) => item.type !== 'text');
    return <div className="topSlot">
      {/* order: reference, rich text area content, attachments */}
      {showContent.map((item, index) => {
        const { type, value, name, key, detail, ...rest } = item;
        return (
          <div className="item" key={key ?? index}>
            <span className='item-icon'>
              {React.cloneElement(refTypeToIconMap.get(type), { className: 'item-left item-icon'})}
              <IconClose size="small" className='item-icon-delete' onClick={() => {
                ref?.current?.deleteContent(item);
              }}/>
            </span>
            <span className='item-content'>
              {name ?? value}
              {type === 'branch' && <span className='detail'>{detail}</span>}
            </span>
        </div>
        )
      })}
      {references.map((item, index) => {
        const { type, name, detail, key, ...rest } = item;
        return (
          <div className="item" key={key}>
            <span className='item-icon'>
              {React.cloneElement(refTypeToIconMap.get(type), { className: 'item-left item-icon'})}
              <IconClose size="small" className='item-icon-delete' onClick={() => {
                const newReferences = [...references];
                newReferences.splice(index, 1);
                setReference(newReferences);
              }}/>
            </span>
            <span className='item-content'>
              {name}
              {type === 'branch' && <span className='detail'>{detail}</span>}
            </span>
        </div>)
      })}
      {attachments.map((item, index) => {
        const isImage = isImageType(item);
        const realType = getAttachmentType(item);
        const { uid, name, url, size, percent, status } = item;
        return (
          <div className="item" key={uid}>
            <span className='item-icon'>
              {isImage ? <img className='item-image item-left' src={item.url} alt={item.name} /> : 
              <IconUpload size="small" className='item-left item-icon' />}
              <IconClose size="small" className='item-icon-delete' onClick={() => ref.current?.deleteUploadFile(item)}/>
            </span>
            <span className='item-content'>{name}</span>
          </div>
        );
      })}
    </div>
  }, []);

  const onContentChange = useCallback((content) => {
    console.log('onContentChange', content);
  }, []);

  const onButtonClick = useCallback(() => {
    console.log('html', ref.current?.editor.getHTML());
    console.log('json', ref.current?.editor.getJSON());
  }, [ref]);

  const transformer = useMemo(() => {
    return new Map([
      ['referSlot', (obj) => {
        const { attrs = {} } = obj;
        const { value, info, type = 'text', uniqueKey } = attrs;
        return {
          type: type, 
          value: value,
          uniqueKey: uniqueKey,
          ...JSON.parse(info),
        };
      }],
    ]);
  }, []);

  return (
    <>
      <AIChatInput
        className='customTopSlot'
        renderTopSlot={renderTopSlot}
        extensions={extensions}
        references={reference}
        showUploadFile={false}
        showReference={false}
        onContentChange={onContentChange}
        renderConfigureArea={renderLeftMenu}
        ref={ref}
        transformer={transformer}
        uploadProps={uploadProps}
        // skills={skills}
        style={outerStyle}
        placeholder="使用 @ 触发"
      />
      <Button onClick={onButtonClick}>点我获取结果</Button>
      {/* <Button onClick={onButtonClick2}>点我设置结果</Button> */}
    </>
  );
}
