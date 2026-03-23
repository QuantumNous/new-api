import React from 'react';
import { Modal, ImagePreview } from '@douyinfe/semi-ui';

const ContentModal = ({
  isModalOpen,
  setIsModalOpen,
  modalContent,
  isModalOpenurl,
  setIsModalOpenurl,
  modalImageUrl,
}) => {
  return (
    <>
      {/* Text Content Modal */}
      <Modal
        visible={isModalOpen}
        onOk={() => setIsModalOpen(false)}
        onCancel={() => setIsModalOpen(false)}
        closable={null}
        bodyStyle={{ height: '400px', overflow: 'auto' }}
        width={800}
      >
        <p style={{ whiteSpace: 'pre-line' }}>{modalContent}</p>
      </Modal>

      {/* Image Preview Modal */}
      <ImagePreview
        src={modalImageUrl}
        visible={isModalOpenurl}
        onVisibleChange={(visible) => setIsModalOpenurl(visible)}
      />
    </>
  );
};

export default ContentModal;
