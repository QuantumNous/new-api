import type { ReasoningUIPart } from 'ai';
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from './ai-elements/reasoning';

export const ReasoningView = ({ part }: { part: ReasoningUIPart }) => {
  return (
    <Reasoning className="w-full" isStreaming={part.state === 'streaming'}>
      <ReasoningTrigger />
      <ReasoningContent>{part.text}</ReasoningContent>
    </Reasoning>
  );
};
