import { generateId } from 'ai';
import Chat from './chat/[chatId]/chat';

export default async function ChatPage() {
  return <Chat chatData={{ id: generateId(), messages: [] }} isNewChat />;
}
