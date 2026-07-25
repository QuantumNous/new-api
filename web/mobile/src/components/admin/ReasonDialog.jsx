import React, { useState } from 'react';
import { Dialog, TextArea } from 'antd-mobile';

// 带必填文本框的确认对话框（驳回原因/审核备注等）
const ReasonDialog = ({
  visible,
  title,
  placeholder = '请填写原因',
  required = true,
  onClose,
  onSubmit,
}) => {
  const [value, setValue] = useState('');

  return (
    <Dialog
      visible={visible}
      title={title}
      content={
        <TextArea
          placeholder={placeholder}
          value={value}
          onChange={setValue}
          rows={3}
        />
      }
      onClose={onClose}
      closeOnAction={false}
      actions={[
        [
          { key: 'cancel', text: '取消', onClick: onClose },
          {
            key: 'ok',
            text: '确定',
            bold: true,
            onClick: async () => {
              if (required && !value.trim()) return;
              await onSubmit(value.trim());
              setValue('');
            },
          },
        ],
      ]}
    />
  );
};

export default ReasonDialog;
