import React, { useEffect, useState } from 'react';
import { Button, SideSheet } from '@douyinfe/semi-ui';
import { Bot } from 'lucide-react';
import AgentChatPanel from './AgentChatPanel';
import { getAgentConfig } from '../../services/agent';
import { getUserIdFromLocalStorage } from '../../helpers';

const FloatingAgentButton = () => {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const isLoggedIn = getUserIdFromLocalStorage() > 0;

  useEffect(() => {
    if (!isLoggedIn) return;
    getAgentConfig()
      .then((res) => setVisible(Boolean(res.data?.data?.enabled)))
      .catch(() => setVisible(false));
  }, [isLoggedIn]);

  if (!isLoggedIn || !visible) return null;

  return (
    <>
      <Button
        type='primary'
        theme='solid'
        icon={<Bot size={18} />}
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          right: 24,
          bottom: 28,
          zIndex: 120,
          boxShadow: 'var(--semi-shadow-elevated)',
        }}
      >
        Agent
      </Button>
      <SideSheet
        title='Agent'
        visible={open}
        width={480}
        onCancel={() => setOpen(false)}
        bodyStyle={{ padding: 0, height: 'calc(100vh - 56px)' }}
      >
        <AgentChatPanel compact />
      </SideSheet>
    </>
  );
};

export default FloatingAgentButton;
