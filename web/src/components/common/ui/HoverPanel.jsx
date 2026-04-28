/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

// Hover-triggered tooltip used by table cells that need a quick on-hover
// breakdown (quota usage, vendor model lists, IP whitelist overflow, etc.).
// The public API matches the original hand-rolled HoverPanel so the 5
// existing call sites keep working without any changes.
//
// Internals: HeroUI `Tooltip` (React Aria's `TooltipTrigger`). This swaps
// the previous custom div for HeroUI's tooltip styling — proper enter/exit
// animations, automatic flip / shift, accessible `role="tooltip"`, focus
// trigger fallback, and design-token-aligned bg/shadow.
//
// Note on interactivity: React Aria Tooltips are explicitly designed for
// non-interactive content (text, icons). The tooltip auto-dismisses when
// the user moves the cursor away from the trigger. If a caller's `content`
// includes click-targets (e.g. copy buttons), those won't be reachable
// once the cursor leaves the trigger element. Callers that need
// interactive content should switch to a click-triggered Popover.

import React from 'react';
import { Tooltip } from '@heroui/react';

const HoverPanel = ({
  children,
  content,
  placement = 'top',
  panelClassName = '',
  delay = 200,
  closeDelay = 100,
  disabled = false,
}) => {
  if (disabled) return children;

  return (
    <Tooltip delay={delay} closeDelay={closeDelay}>
      <Tooltip.Trigger>{children}</Tooltip.Trigger>
      <Tooltip.Content
        placement={placement}
        className={`!max-w-xs !p-3 ${panelClassName}`}
      >
        {content}
      </Tooltip.Content>
    </Tooltip>
  );
};

export default HoverPanel;
