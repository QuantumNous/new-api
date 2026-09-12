import { readAllChats, readChat } from '@util/chat-store';
import Link from 'next/link';
import Chat from './chat';

export default async function Page(props: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await props.params; // get the chat ID from the URL
  const chatData = await readChat(chatId); // load the chat
  const chats = await readAllChats(); // load all chats

  // filter to 5 most recent chats
  const recentChats = chats
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);

  return (
    <div>
      <ul>
        {recentChats.map(chat => (
          <li key={chat.id}>
            <Link href={`/chat/${chat.id}`}>{chat.id}</Link>
          </li>
        ))}
      </ul>
      <Chat chatData={chatData} resume={chatData.activeStreamId !== null} />;
    </div>
  );
}
