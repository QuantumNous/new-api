import React, { useCallback, useState } from 'react';
import { AIChatInput } from '../../index';
import { storiesOf } from '@storybook/react';
import { uploadProps } from './constant';

const stories = storiesOf('AIChatInput', module);

const outerStyle = { margin: 12, maxHeight: 300 };

stories.add('default', () => {
  const [generating, setGenerating] = useState(false);
    const onContentChange = useCallback((content) => {
      console.log('onContentChange', content);
    }, []);
  
    const onUploadChange = useCallback((fileList) => {
      console.log('onUploadChange', fileList);
    }, []);
  
    const toggleGenerate = useCallback(() => {
      setGenerating(value => !value);
    }, []);
    
    return (
      <AIChatInput
        generating={generating}
        defaultContent={''}
        placeholder={'输入内容或者上传内容'} 
        uploadProps={uploadProps}
        onContentChange={onContentChange}
        onUploadChange={onUploadChange}
        style={outerStyle}
        onMessageSend={toggleGenerate}
        onStopGenerate={toggleGenerate}
      />
    );
});