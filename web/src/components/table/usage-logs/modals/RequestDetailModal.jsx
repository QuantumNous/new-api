import React from 'react';
import { Modal, Spin, Empty, Typography, Tabs, TabPane } from '@douyinfe/semi-ui';

const codeBlockStyle = {
  background: 'var(--semi-color-fill-0)',
  borderRadius: 6,
  padding: 12,
  fontSize: 13,
  fontFamily: 'monospace',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
  maxHeight: 400,
  overflow: 'auto',
};

function tryFormatJson(str) {
  if (!str) return '';
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}

const RequestDetailModal = ({
  showRequestDetailModal,
  setShowRequestDetailModal,
  requestDetailData,
  requestDetailLoading,
  t,
}) => {
  return (
    <Modal
      title={t('请求详情')}
      visible={showRequestDetailModal}
      onCancel={() => setShowRequestDetailModal(false)}
      footer={null}
      centered
      closable
      maskClosable
      width={800}
    >
      {requestDetailLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size='large' />
        </div>
      ) : !requestDetailData ? (
        <Empty description={t('无数据')} style={{ padding: 40 }} />
      ) : (
        <Tabs type='line'>
          <TabPane tab={t('请求头')} itemKey='req_headers'>
            <div style={codeBlockStyle}>
              {tryFormatJson(requestDetailData.request_headers)}
            </div>
          </TabPane>
          <TabPane tab={t('请求体')} itemKey='req_body'>
            <div style={codeBlockStyle}>
              {tryFormatJson(requestDetailData.request_body)}
            </div>
          </TabPane>
          <TabPane tab={t('响应头')} itemKey='resp_headers'>
            <div style={codeBlockStyle}>
              {tryFormatJson(requestDetailData.response_headers)}
            </div>
          </TabPane>
          <TabPane tab={t('响应体')} itemKey='resp_body'>
            <div style={codeBlockStyle}>
              {requestDetailData.response_body
                ? tryFormatJson(requestDetailData.response_body)
                : t('无数据（流式请求不记录响应体）')}
            </div>
          </TabPane>
        </Tabs>
      )}
    </Modal>
  );
};

export default RequestDetailModal;
