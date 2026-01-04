import React, { useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@douyinfe/semi-ui';
import { IconMoon, IconSun, IconSearch } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { UserContext } from '../../context/User';
import { useActualTheme, useSetTheme } from '../../context/Theme';
import { getLogo, getSystemName } from '../../helpers';

const OpenRouterHeader = () => {
  const { t } = useTranslation();
  const [userState] = useContext(UserContext);
  const navigate = useNavigate();
  const location = useLocation();
  const systemName = getSystemName();
  const logo = getLogo();
  
  const theme = useActualTheme();
  const setTheme = useSetTheme();
  const isDark = theme === 'dark';

  const navItems = [
    { text: 'Models', link: '/console/models', itemKey: 'models' },
    { text: 'Chat', link: '/console/chat', itemKey: 'chat' },
    { text: 'Rankings', link: '/rankings', itemKey: 'rankings' },
    { text: 'Enterprise', link: '/enterprise', itemKey: 'enterprise' },
    { text: 'Pricing', link: '/pricing', itemKey: 'pricing' },
    { text: 'Docs', link: 'https://openrouter.ai/docs', itemKey: 'docs', external: true },
  ];

  return (
    <nav id="main-nav" className="sticky top-0 z-40 transition-all duration-150 bg-white/80 dark:bg-black/80 backdrop-blur-md w-full border-b border-transparent">
      <div className="mx-auto w-full px-6 py-3.5 lg:py-4 max-w-[1800px]">
        <div className="align-center relative flex flex-row justify-between text-sm md:text-base items-center">
          
          {/* Left: Logo & Search */}
          <div className="flex flex-1 items-center gap-4">
            <a href="/" className="text-muted-foreground" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
              <button className="inline-flex items-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring gap-2 leading-6 hover:bg-accent hover:text-accent-foreground border border-transparent h-9 rounded-md w-auto justify-center px-2 text-accent-foreground">
                <span className="flex items-center gap-2 text-base transform cursor-pointer font-medium duration-100 ease-in-out fill-current stroke-current text-black dark:text-white">
                  <img src={logo} alt="logo" className="w-6 h-6" />
                  {systemName}
                </span>
              </button>
            </a>
            
            {/* Search Input */}
            <div className="hidden md:flex items-center gap-2 rounded-md h-9 w-0 ring-ring md:w-48 transition-colors relative bg-slate-100 dark:bg-zinc-800 text-slate-500 focus-within:bg-slate-200 dark:focus-within:bg-zinc-700 focus-within:text-slate-900 dark:focus-within:text-white border border-transparent">
              <div className="flex items-center px-3 w-full">
                <IconSearch className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <input 
                  className="flex h-full w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50" 
                  placeholder="Search" 
                  autoComplete="off"
                />
              </div>
              <kbd className="flex items-center justify-center aspect-square h-4 w-4 p-1 pointer-events-none rounded-sm bg-white dark:bg-black border border-gray-200 dark:border-gray-700 text-xs text-muted-foreground absolute right-2">/</kbd>
            </div>
          </div>

          {/* Right: Nav Links & Auth */}
          <div className="hidden lg:flex lg:gap-1 text-sm items-center">
            {navItems.map((item) => (
              <a 
                key={item.itemKey}
                href={item.link}
                target={item.external ? '_blank' : undefined}
                rel={item.external ? 'noopener noreferrer' : undefined}
                onClick={(e) => {
                  if (!item.external) {
                    e.preventDefault();
                    navigate(item.link);
                  }
                }}
              >
                <button className={`inline-flex items-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring gap-2 leading-6 hover:bg-gray-100 dark:hover:bg-zinc-800 border border-transparent h-9 rounded-md w-auto justify-center text-gray-600 dark:text-gray-300 px-3 ${location.pathname === item.link ? 'bg-gray-100 dark:bg-zinc-800 text-black dark:text-white' : ''}`}>
                  {item.text}
                </button>
              </a>
            ))}

            <div className="flex items-center gap-2 ml-2">
              <Button
                theme="borderless"
                icon={isDark ? <IconSun /> : <IconMoon />}
                style={{ color: 'var(--semi-color-text-2)' }}
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
              />
              
              {userState?.user ? (
                <Button 
                  theme="solid"
                  className="!rounded-full !px-4 !bg-black dark:!bg-white !text-white dark:!text-black hover:opacity-90 transition-opacity"
                  onClick={() => navigate('/console')}
                >
                  {t('控制台')}
                </Button>
              ) : (
                <Button 
                  theme="solid"
                  className="!rounded-full !px-4 !bg-transparent !border !border-gray-300 dark:!border-gray-600 !text-black dark:!text-white hover:!bg-gray-100 dark:hover:!bg-zinc-800 transition-colors"
                  onClick={() => navigate('/login')}
                >
                  {t('Sign up')}
                </Button>
              )}
            </div>
          </div>

        </div>
      </div>
    </nav>
  );
};

export default OpenRouterHeader;
