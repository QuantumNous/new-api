/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navigation = ({
  mainNavLinks,
  isMobile,
  userState,
  pricingRequireAuth,
}) => {
  const location = useLocation();
  const navRef = useRef(null);
  const itemRefs = useRef({});
  const hasMeasured = useRef(false);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, opacity: 0 });

  const isActive = (link) => {
    if (link.isExternal) return false;
    if (link.to === '/') return location.pathname === '/';
    return location.pathname.startsWith(link.to);
  };

  const updateIndicator = useCallback(() => {
    const activeLink = mainNavLinks.find((l) => isActive(l));
    if (!activeLink || !navRef.current) {
      setIndicator((prev) => ({ ...prev, opacity: 0 }));
      return;
    }
    const el = itemRefs.current[activeLink.itemKey];
    if (!el) return;
    const navRect = navRef.current.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    setIndicator({
      left: elRect.left - navRect.left,
      width: elRect.width,
      opacity: 1,
    });
    hasMeasured.current = true;
  }, [location.pathname, mainNavLinks]);

  useEffect(() => {
    // Delay first measurement to ensure DOM is painted
    const raf = requestAnimationFrame(() => {
      updateIndicator();
    });
    window.addEventListener('resize', updateIndicator);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', updateIndicator);
    };
  }, [updateIndicator]);

  const renderNavLinks = () => {
    const spacingClasses = isMobile ? 'px-2 py-1' : 'px-3 py-1.5';

    return mainNavLinks.map((link) => {
      const active = isActive(link);
      const baseClasses = `relative z-10 flex-shrink-0 flex items-center gap-1 font-semibold rounded-full transition-colors duration-200 ${spacingClasses}`;
      const colorClasses = active
        ? 'text-white'
        : 'text-semi-color-text-1 hover:text-semi-color-text-0';

      if (link.isExternal) {
        return (
          <a
            key={link.itemKey}
            ref={(el) => { itemRefs.current[link.itemKey] = el; }}
            href={link.externalLink}
            target='_blank'
            rel='noopener noreferrer'
            className={`${baseClasses} ${colorClasses}`}
          >
            <span>{link.text}</span>
          </a>
        );
      }

      let targetPath = link.to;
      if (link.itemKey === 'console' && !userState.user) targetPath = '/login';
      if (link.itemKey === 'pricing' && pricingRequireAuth && !userState.user) targetPath = '/login';

      return (
        <Link
          key={link.itemKey}
          ref={(el) => { itemRefs.current[link.itemKey] = el; }}
          to={targetPath}
          className={`${baseClasses} ${colorClasses}`}
        >
          <span>{link.text}</span>
        </Link>
      );
    });
  };

  return (
    <nav
      ref={navRef}
      className='relative flex flex-1 items-center gap-0.5 lg:gap-1 mx-2 md:mx-4 overflow-x-auto whitespace-nowrap scrollbar-hide'
    >
      {/* Sliding indicator */}
      <div
        className='absolute top-1/2 -translate-y-1/2 h-8 rounded-full pointer-events-none'
        style={{
          left: indicator.left,
          width: indicator.width,
          opacity: indicator.opacity,
          background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
          boxShadow: indicator.opacity ? '0 2px 12px rgba(99, 102, 241, 0.35)' : 'none',
          transition: hasMeasured.current
            ? 'left 0.35s cubic-bezier(0.16, 1, 0.3, 1), width 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.15s ease'
            : 'none',
        }}
      />
      {renderNavLinks()}
    </nav>
  );
}

export default Navigation;
