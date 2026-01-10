export const CURL_EXAMPLE = `curl https://api.example.com/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'` as const;

export const PYTHON_EXAMPLE = `from openai import OpenAI

client = OpenAI(
    api_key="YOUR_API_KEY",
    base_url="https://api.example.com/v1"
)

response = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages=[
        {"role": "user", "content": "Hello!"}
    ]
)

print(response.choices[0].message.content)` as const;

export const NODEJS_EXAMPLE = `import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'YOUR_API_KEY',
  baseURL: 'https://api.example.com/v1',
});

async function main() {
  const response = await client.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'user', content: 'Hello!' }
    ],
  });
  
  console.log(response.choices[0].message.content);
}

main();` as const;

export const API_ENDPOINTS = [
  {
    method: 'POST',
    path: '/v1/chat/completions',
    description: '创建聊天完成',
    color: 'border-blue-500',
  },
  {
    method: 'POST',
    path: '/v1/images/generations',
    description: '生成图像',
    color: 'border-green-500',
  },
  {
    method: 'POST',
    path: '/v1/embeddings',
    description: '创建嵌入向量',
    color: 'border-purple-500',
  },
  {
    method: 'POST',
    path: '/v1/audio/transcriptions',
    description: '音频转文字',
    color: 'border-orange-500',
  },
] as const;
