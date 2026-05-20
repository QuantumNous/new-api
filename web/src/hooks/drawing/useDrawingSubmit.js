import { useCallback, useRef } from 'react';
import { API } from '../../helpers';
import { DRAWING_API, POLL_INTERVAL, POLL_TIMEOUT } from '../../constants/drawing.constants';

export function useDrawingSubmit(activeSessionId, addOptimisticMessage, updateMessageByTaskId) {
  const pollTimersRef = useRef({});

  const submit = useCallback(async ({ prompt, model, size, quality, images }) => {
    if (!activeSessionId || !prompt.trim()) return null;

    const optimisticMsg = {
      id: Date.now(),
      session_id: activeSessionId,
      role: 'user',
      prompt,
      model,
      size,
      quality,
      image_urls: images?.length ? JSON.stringify(images) : null,
      status: 'pending',
      task_id: null,
      created_at: Math.floor(Date.now() / 1000),
    };
    addOptimisticMessage(optimisticMsg);

    try {
      const res = await API.post(DRAWING_API.GENERATE(activeSessionId), {
        prompt,
        model,
        size,
        quality,
        images: images || [],
      });

      if (res.data.success) {
        const { task_id } = res.data.data;
        updateMessageByTaskId(null, { task_id, status: 'processing' });
        // Update the optimistic message with real task_id
        optimisticMsg.task_id = task_id;
        optimisticMsg.status = 'processing';
        startPolling(task_id);
        return task_id;
      } else {
        updateMessageByTaskId(null, { status: 'failure', fail_reason: res.data.message });
      }
    } catch (e) {
      console.error('Submit failed', e);
      updateMessageByTaskId(null, { status: 'failure', fail_reason: e.message });
    }
    return null;
  }, [activeSessionId, addOptimisticMessage, updateMessageByTaskId]);

  const startPolling = useCallback((taskId) => {
    const startTime = Date.now();

    const poll = async () => {
      if (Date.now() - startTime > POLL_TIMEOUT) {
        updateMessageByTaskId(taskId, { status: 'failure', fail_reason: '轮询超时' });
        delete pollTimersRef.current[taskId];
        return;
      }

      try {
        const res = await API.get(DRAWING_API.TASK_STATUS(taskId));
        if (res.data.success) {
          const { status, result_data, fail_reason, progress } = res.data.data;

          if (status === 'SUCCESS') {
            updateMessageByTaskId(taskId, {
              status: 'success',
              result_data: result_data,
            });
            delete pollTimersRef.current[taskId];
            return;
          } else if (status === 'FAILURE') {
            updateMessageByTaskId(taskId, {
              status: 'failure',
              fail_reason: fail_reason,
            });
            delete pollTimersRef.current[taskId];
            return;
          }
          // Still processing, continue polling
          updateMessageByTaskId(taskId, { progress });
        }
      } catch (e) {
        console.error('Poll failed', e);
      }

      pollTimersRef.current[taskId] = setTimeout(poll, POLL_INTERVAL);
    };

    pollTimersRef.current[taskId] = setTimeout(poll, POLL_INTERVAL);
  }, [updateMessageByTaskId]);

  const stopAllPolling = useCallback(() => {
    Object.values(pollTimersRef.current).forEach(clearTimeout);
    pollTimersRef.current = {};
  }, []);

  return { submit, startPolling, stopAllPolling };
}
