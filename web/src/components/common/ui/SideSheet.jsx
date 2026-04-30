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

// SideSheet — shared side-drawer wrapper for /console list-page modals
// (edit token / edit channel / edit user / edit redemption / edit prefill
// group / model detail / ...).
//
// Why this exists
// ---------------
// Every one of those pages used to ship its own hand-rolled drawer:
//
//   <div className="fixed inset-0 z-40 bg-black/40 ..." onClick={onCancel} />
//   <aside className="fixed bottom-0 right-0 top-0 z-50 ... translate-x-full">
//     <header>...</header>
//     <div className="flex-1 overflow-y-auto">...</div>
//     <footer>...</footer>
//   </aside>
//
// Two latent bugs lived in that pattern:
//
// 1. CardPro renders a HeroUI `Surface` with `backdrop-blur`. Per the CSS
//    spec, ANY `backdrop-filter` (just like `transform`) creates a new
//    containing block for `position: fixed` descendants. So `right-0` /
//    `left-0` was being pinned to the Surface card's edge, NOT the
//    viewport — and `translate-x-full` only pushed the panel just outside
//    the card edge, leaving a visible vertical strip in the page.
//
// 2. The drawer markup lived inline inside the page tree, so it
//    competed for stacking context with the table's sticky-right column,
//    the page header, the sidebar, etc. — z-index whack-a-mole.
//
// SideSheet wraps HeroUI v3 `Drawer` (compound), which renders through
// React Aria's `Modal` portal into `document.body`. That single change
// fixes both bugs at once: the panel is now positioned relative to the
// viewport regardless of any ancestor's filter / transform / perspective.
//
// API
// ---
// Drop-in replacement for the old `<aside>...</aside>`. Consumers just:
//
//   <SideSheet visible={open} onClose={close} placement='right' width={920}>
//     <header>...</header>
//     <div className='flex-1 overflow-y-auto p-4'>...</div>
//     <footer>...</footer>
//   </SideSheet>
//
// — same children, same width, same placement. The internal layout
// (header / scroll body / footer split) is whatever the consumer puts in
// `children`. The component supplies the portal, the backdrop, the focus
// trap, ESC-to-dismiss, and the slide-in animation.

import React from 'react';
import { Drawer, useOverlayState } from '@heroui/react';
import PropTypes from 'prop-types';
import { useIsMobile } from '../../../hooks/common/useIsMobile';

const SideSheet = ({
  visible,
  onClose,
  placement = 'right',
  width = 600,
  // Some legacy modals (notably the model-deployments side sheet) want
  // the click-outside affordance disabled while a network request is
  // in flight. Forward to React Aria's `isDismissable` prop.
  isDismissable = true,
  className = '',
  children,
}) => {
  const isMobile = useIsMobile();
  const sheetState = useOverlayState({
    isOpen: !!visible,
    onOpenChange: (isOpen) => {
      if (!isOpen) onClose?.();
    },
  });

  // Default Drawer.Dialog ships `w-80 sm:w-96 p-6` for left/right
  // placements. We want the consumer to control width and we strip
  // `p-6` since the legacy `<aside>` had no padding (header / body /
  // footer set their own).
  //
  // Width is set via a CSS custom property + matching Tailwind
  // arbitrary class. Dynamic Tailwind classes (`!w-[${value}]` via a
  // template literal) don't work because Tailwind's JIT only scans
  // source text — it never sees the runtime-resolved class name. CSS
  // variables work because the `!w-[length:var(--sheet-width)]`
  // class string IS a static literal Tailwind picks up.
  const widthValue = typeof width === 'number' ? `${width}px` : width;
  const dialogStyle = isMobile
    ? { '--sheet-width': '100%' }
    : { '--sheet-width': widthValue };

  return (
    <Drawer state={sheetState}>
      <Drawer.Backdrop variant='blur' isDismissable={isDismissable}>
        <Drawer.Content placement={placement}>
          <Drawer.Dialog
            style={dialogStyle}
            // `!p-0` strips Drawer.Dialog's default `p-6`.
            // `!w-[length:var(--sheet-width)]` and `!max-w-[92vw]`
            // (or `!max-w-full` on mobile) win against HeroUI's
            // default `w-80 sm:w-96 max-w-[85vw]` left/right rule.
            className={`!p-0 !w-[length:var(--sheet-width)] ${
              isMobile ? '!max-w-full' : '!max-w-[92vw]'
            } flex h-full flex-col !bg-[color:var(--app-background)] ${className}`}
          >
            {children}
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
};

SideSheet.propTypes = {
  visible: PropTypes.bool,
  onClose: PropTypes.func,
  placement: PropTypes.oneOf(['left', 'right']),
  width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  isDismissable: PropTypes.bool,
  className: PropTypes.string,
  children: PropTypes.node,
};

export default SideSheet;
