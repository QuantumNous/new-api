import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { IconSearch, IconArrowRight } from '@douyinfe/semi-icons';

const Home = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState('');

  const tags = ['Free', 'Popular', 'Vision', 'Llama 3', 'Claude 3.5', 'GPT-4o', 'Uncensored'];

  const models = [
    { name: 'Google: Gemini Pro 1.5', description: 'Google\'s latest multimodal model', price: '$1.25/M', context: '128k' },
    { name: 'Meta: Llama 3 70B', description: 'The most capable open weight model', price: '$0.70/M', context: '8k' },
    { name: 'Anthropic: Claude 3.5 Sonnet', description: 'Anthropic\'s most intelligent model', price: '$3.00/M', context: '200k' },
    { name: 'OpenAI: GPT-4o', description: 'OpenAI\'s flagship model', price: '$5.00/M', context: '128k' },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="container px-4 mx-auto text-center">
          <h1 className="mb-6 text-5xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-7xl">
            A unified interface for LLMs
          </h1>
          <p className="mb-10 text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Find the best models for your application. Connect to 100+ models with one API key.
          </p>

          {/* Search */}
          <div className="max-w-2xl mx-auto mb-8 relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <IconSearch className="text-gray-400 w-5 h-5" />
            </div>
            <input
              type="text"
              className="w-full pl-11 pr-4 py-4 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl text-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white"
              placeholder="Search models..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/pricing?search=${searchValue}`)}
            />
            <div className="absolute inset-y-0 right-3 flex items-center">
               <span className="text-xs text-gray-400 border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5">/</span>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap justify-center gap-2 mb-16">
            {tags.map(tag => (
              <button
                key={tag}
                onClick={() => navigate(`/pricing?tag=${tag}`)}
                className="px-3 py-1 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-[#1a1a1a] rounded-full hover:bg-gray-200 dark:hover:bg-[#252525] transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>

          {/* Model Cards Grid (Preview) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-7xl mx-auto">
            {models.map((model, idx) => (
              <div key={idx} className="p-4 text-left border border-gray-200 dark:border-gray-800 rounded-xl hover:border-gray-300 dark:hover:border-gray-700 transition-colors cursor-pointer bg-white dark:bg-[#0b0b0b]" onClick={() => navigate('/pricing')}>
                <div className="flex justify-between items-start mb-2">
                  <div className="font-semibold text-gray-900 dark:text-white truncate pr-2">{model.name}</div>
                  <div className="text-xs text-gray-500 bg-gray-100 dark:bg-[#1a1a1a] px-1.5 py-0.5 rounded">{model.context}</div>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">{model.description}</p>
                <div className="text-xs font-mono text-gray-400">{model.price}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Building with LLMs */}
      <section className="py-24 bg-gray-50 dark:bg-[#050505] border-t border-gray-200 dark:border-gray-800">
        <div className="container px-4 mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Building with LLMs?</h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
                OpenRouter provides a standardized API for all models. Switch between models with a single line of code change.
              </p>
              <ul className="space-y-4">
                {['Unified API Standard', 'Lowest Prices', 'No Usage Limits', 'Global Low Latency'].map((item, i) => (
                  <li key={i} className="flex items-center text-gray-700 dark:text-gray-300">
                    <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center mr-3">
                      <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <button 
                onClick={() => navigate('/docs')}
                className="mt-8 px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-lg font-medium hover:opacity-90 transition-opacity inline-flex items-center"
              >
                Read the docs <IconArrowRight className="ml-2" />
              </button>
            </div>
            <div className="bg-white dark:bg-[#111] p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm font-mono text-sm overflow-hidden">
              <div className="flex gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              <div className="space-y-2 text-gray-600 dark:text-gray-400">
                <p><span className="text-purple-500">import</span> OpenAI <span className="text-purple-500">from</span> <span className="text-green-500">'openai'</span>;</p>
                <p className="h-4"></p>
                <p><span className="text-purple-500">const</span> openai = <span className="text-purple-500">new</span> OpenAI({'{'}</p>
                <p className="pl-4">baseURL: <span className="text-green-500">'{window.location.origin}/v1'</span>,</p>
                <p className="pl-4">apiKey: <span className="text-green-500">'sk-or-...'</span>,</p>
                <p>{'}'});</p>
                <p className="h-4"></p>
                <p><span className="text-purple-500">async function</span> main() {'{'}</p>
                <p className="pl-4"><span className="text-purple-500">const</span> completion = <span className="text-purple-500">await</span> openai.chat.completions.create({'{'}</p>
                <p className="pl-8">model: <span className="text-green-500">'openai/gpt-4o'</span>,</p>
                <p className="pl-8">messages: [{'{'} role: <span className="text-green-500">'user'</span>, content: <span className="text-green-500">'Hello!'</span> {'}'}],</p>
                <p className="pl-4">{'}'});</p>
                <p className="pl-4">console.log(completion.choices[0].message);</p>
                <p>{'}'}</p>
                <p>main();</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
