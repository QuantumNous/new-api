/* ============================================================
   API Gateway Admin — Base Scripts
   ============================================================ */

/* ── Toast System ── */
const Toast = {
  icons: {
    success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/></svg>',
    warn: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>',
    info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  },
  show(type, message, duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = (this.icons[type] || '') + `<span>${message}</span>`;
    container.appendChild(el);
    if (duration > 0) {
      setTimeout(() => {
        el.style.opacity = '0'; el.style.transform = 'translateX(16px)';
        el.style.transition = '180ms ease';
        setTimeout(() => el.remove(), 180);
      }, duration);
    }
    return el;
  }
};

/* ── Dialogs ── */
const Dialog = {
  open(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('open');
  },
  close(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
  },
};

/* ── Sheets ── */
const Sheet = {
  open(id) {
    const el = document.getElementById(id);
    const ov = document.getElementById(id + 'Overlay');
    if (el) el.classList.add('open');
    if (ov) ov.classList.add('open');
  },
  close(id) {
    const el = document.getElementById(id);
    const ov = document.getElementById(id + 'Overlay');
    if (el) el.classList.remove('open');
    if (ov) ov.classList.remove('open');
  },
};

/* ── Dropdowns ── */
function toggleDropdown(event, id) {
  event.stopPropagation();
  document.querySelectorAll('.dropdown-menu.open').forEach(m => {
    if (m.id !== id) m.classList.remove('open');
  });
  const menu = document.getElementById(id);
  if (menu) menu.classList.toggle('open');
}
document.addEventListener('click', () => {
  document.querySelectorAll('.dropdown-menu.open').forEach(m => m.classList.remove('open'));
});

/* ── Theme ── */
function toggleTheme() {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  const lightIcon = document.getElementById('themeIconLight');
  const darkIcon = document.getElementById('themeIconDark');
  if (lightIcon) lightIcon.style.display = isDark ? 'none' : '';
  if (darkIcon) darkIcon.style.display = isDark ? '' : 'none';
}
(function initTheme() {
  if (localStorage.getItem('theme') === 'dark' ||
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.body.classList.add('dark');
    const lightIcon = document.getElementById('themeIconLight');
    const darkIcon = document.getElementById('themeIconDark');
    if (lightIcon) lightIcon.style.display = 'none';
    if (darkIcon) darkIcon.style.display = '';
  }
})();

/* ── Sidebar ── */
function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('open');
  document.getElementById('sidebarOverlay')?.classList.toggle('open');
}
function toggleSidebarCollapse() {
  document.body.classList.toggle('sidebar-collapsed');
  localStorage.setItem('sidebarCollapsed', document.body.classList.contains('sidebar-collapsed'));
}
(function initSidebar() {
  if (localStorage.getItem('sidebarCollapsed') === 'true') {
    document.body.classList.add('sidebar-collapsed');
  }
})();

/* ── Drill-in ── */
function enterDrillMode() {
  document.getElementById('sidebarMainNav')?.classList.add('hidden');
  document.getElementById('settingsDrill')?.classList.add('active');
  window.location.href = 'settings-auth.html';
}
function exitDrillMode() {
  document.getElementById('sidebarMainNav')?.classList.remove('hidden');
  document.getElementById('settingsDrill')?.classList.remove('active');
  window.location.href = 'dashboard.html';
}

/* ── Helper: highlight active nav item based on current page ── */
function highlightNav() {
  const page = window.location.pathname.split('/').pop().replace('.html', '') || 'index';
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    const view = item.dataset.view;
    if (!view) return;
    const href = item.getAttribute('href') || '';
    if (href.includes(page) || view === page || (page === 'dashboard' && view === 'dashboard') || (page.startsWith('settings-') && view === 'settings')) {
      item.classList.add('active');
    }
  });
}

/* ── Dialog overlay click-to-close ── */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.dialog-overlay').forEach(el => {
    el.addEventListener('click', function(e) { if (e.target === this) this.classList.remove('open'); });
  });
  document.querySelectorAll('.sheet-overlay').forEach(el => {
    el.addEventListener('click', function(e) { if (e.target === this) {
      const sheetId = this.id.replace('Overlay', '');
      Sheet.close(sheetId);
    }});
  });
  highlightNav();
});

/* ── Copy to clipboard ── */
async function copyText(text, label = '内容') {
  try {
    await navigator.clipboard.writeText(text);
    Toast.show('success', `${label}已复制到剪贴板`);
  } catch {
    Toast.show('error', '复制失败');
  }
}

/* ── Confirm delete ── */
function confirmDelete(message = '此操作不可撤销，确定继续吗？', onConfirm) {
  const dialogId = 'confirmDeleteDialog';
  // Create if not exists
  if (!document.getElementById(dialogId)) {
    const html = `
      <div class="dialog-overlay" id="${dialogId}">
        <div class="dialog" style="max-width:400px">
          <div class="dialog-header"><h2 style="color:var(--danger)">确认删除</h2></div>
          <div class="dialog-body"><p class="text-sm" id="${dialogId}Msg">${message}</p></div>
          <div class="dialog-footer">
            <button class="btn btn-secondary" onclick="Dialog.close('${dialogId}')">取消</button>
            <button class="btn btn-danger" id="${dialogId}Btn">确认删除</button>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  }
  document.getElementById(dialogId + 'Msg').textContent = message;
  const btn = document.getElementById(dialogId + 'Btn');
  btn.onclick = () => { Dialog.close(dialogId); if (onConfirm) onConfirm(); };
  Dialog.open(dialogId);
}
