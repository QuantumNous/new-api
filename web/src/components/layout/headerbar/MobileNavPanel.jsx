import React from 'react';
import { NavLink } from 'react-router-dom';

const MobileNavPanel = ({
  open,
  mainNavLinks,
  userState,
  pricingRequireAuth,
  onClose,
}) => {
  if (!open) {
    return null;
  }

  return (
    <nav className='border-t border-semi-color-border px-4 pb-3 pt-2'>
      <div className='flex flex-col gap-1'>
        {mainNavLinks.map((link) => {
          if (link.isExternal) {
            return (
              <a
                key={link.itemKey}
                href={link.externalLink}
                target='_blank'
                rel='noopener noreferrer'
                onClick={onClose}
                className='flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-semi-color-text-0 no-underline transition-colors hover:bg-semi-color-fill-0'
              >
                {link.text}
              </a>
            );
          }

          let targetPath = link.to;
          if (link.itemKey === 'console' && !userState.user) {
            targetPath = '/login';
          }
          if (link.itemKey === 'pricing' && pricingRequireAuth && !userState.user) {
            targetPath = '/login';
          }

          return (
            <NavLink
              key={link.itemKey}
              to={targetPath}
              end={link.itemKey === 'home'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium no-underline transition-colors ${
                  isActive
                    ? 'bg-semi-color-primary-light-default text-semi-color-primary'
                    : 'text-semi-color-text-0 hover:bg-semi-color-fill-0'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className='h-1.5 w-1.5 shrink-0 rounded-full bg-semi-color-primary' />
                  )}
                  <span>{link.text}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNavPanel;
