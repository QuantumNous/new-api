import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Modal, Spin, Toast } from '@douyinfe/semi-ui';
import { QRCodeSVG } from 'qrcode.react';
import { API, showError, showSuccess } from '../../helpers';
import { useTranslation } from 'react-i18next';

const promoterStyles = `
.promoter-page .bg-white {
  background-color: #ffffff;
}
.promoter-page .bg-white\\/75 {
  background-color: rgba(255, 255, 255, 0.75);
}
.promoter-page .bg-white\\/80 {
  background-color: rgba(255, 255, 255, 0.8);
}
.promoter-page .bg-white\\/90 {
  background-color: rgba(255, 255, 255, 0.9);
}
.promoter-page .bg-white\\/95 {
  background-color: rgba(255, 255, 255, 0.95);
}
.promoter-page .bg-slate-50 {
  background-color: #f8fafc;
}
.promoter-page .bg-slate-100 {
  background-color: #f1f5f9;
}
.promoter-page .bg-indigo-50 {
  background-color: #eef2ff;
}
.promoter-page .bg-blue-50 {
  background-color: #eff6ff;
}
.promoter-page .bg-cyan-50 {
  background-color: #ecfeff;
}
.promoter-page .bg-purple-50 {
  background-color: #faf5ff;
}
.promoter-page .bg-amber-50 {
  background-color: #fffbeb;
}
.promoter-page .bg-emerald-50 {
  background-color: #ecfdf5;
}
.promoter-page .bg-rose-50 {
  background-color: #fff1f2;
}
.promoter-page .text-white {
  color: #ffffff;
}
.promoter-page .text-transparent {
  color: transparent !important;
  -webkit-text-fill-color: transparent !important;
}
.promoter-page .bg-clip-text {
  background-clip: text;
  -webkit-background-clip: text;
}
.promoter-page .text-slate-950 {
  color: #020617;
}
.promoter-page .text-slate-900,
.promoter-page .hover\\:text-slate-900:hover {
  color: #0f172a;
}
.promoter-page .text-slate-800 {
  color: #1e293b;
}
.promoter-page .text-slate-700 {
  color: #334155;
}
.promoter-page .text-slate-600 {
  color: #475569;
}
.promoter-page .text-slate-500 {
  color: #64748b;
}
.promoter-page .text-slate-400 {
  color: #94a3b8;
}
.promoter-page .text-indigo-600 {
  color: #4f46e5;
}
.promoter-page .text-blue-700 {
  color: #1d4ed8;
}
.promoter-page .text-emerald-600 {
  color: #059669;
}
.promoter-page .text-emerald-700 {
  color: #047857;
}
.promoter-page .text-amber-700 {
  color: #b45309;
}
.promoter-page .text-rose-700 {
  color: #be123c;
}
.promoter-page .border-white {
  border-color: #ffffff;
}
.promoter-page .border-indigo-100 {
  border-color: #e0e7ff;
}
.promoter-page .border-slate-100 {
  border-color: #f1f5f9;
}
.promoter-page .border-slate-200 {
  border-color: #e2e8f0;
}
.promoter-page .border-slate-200\\/90 {
  border-color: rgba(226, 232, 240, 0.9);
}
.promoter-page .border-slate-300 {
  border-color: #cbd5e1;
}
.promoter-page .border-blue-200 {
  border-color: #bfdbfe;
}
.promoter-page .border-emerald-200 {
  border-color: #a7f3d0;
}
.promoter-page .border-amber-200 {
  border-color: #fde68a;
}
.promoter-page .border-rose-200 {
  border-color: #fecdd3;
}
.promoter-page .infistar-btn-primary {
  display: inline-flex;
  min-height: 48px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 12px;
  border: 0;
  background: #4f46e5;
  padding: 0 24px;
  color: #fff;
  font-size: 14px;
  font-weight: 900;
  box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.3);
  transition: transform 160ms ease, background-color 160ms ease, box-shadow 160ms ease;
}
.promoter-page .infistar-btn-primary:hover {
  transform: translateY(-2px);
  background: #4338ca;
}
.promoter-page .infistar-btn-primary:disabled {
  cursor: not-allowed;
  opacity: 0.62;
  transform: none;
}
.promoter-page .infistar-btn-secondary {
  display: inline-flex;
  min-height: 48px;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: #fff;
  padding: 0 20px;
  color: #334155;
  font-size: 14px;
  font-weight: 900;
  transition: transform 160ms ease, border-color 160ms ease, color 160ms ease, background-color 160ms ease, box-shadow 160ms ease;
}
.promoter-page .infistar-btn-secondary:hover {
  transform: translateY(-1px);
  border-color: #c7d2fe;
  color: #4f46e5;
  background: #f8faff;
  box-shadow: 0 8px 18px -16px rgba(79, 70, 229, 0.5);
}
.promoter-page .partner-dashboard-surface {
  background:
    radial-gradient(circle at 82% 0%, rgba(79,70,229,.05), transparent 32%),
    linear-gradient(180deg, #fcfdff 0%, #ffffff 58%, #fafbff 100%);
}
.promoter-page .entry-action {
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: #fff;
  padding: 8px 12px;
  color: #334155;
  font-size: 12px;
  font-weight: 800;
}
.promoter-page .partner-card {
  position: relative;
  z-index: 0;
  min-width: 0;
  max-width: 100%;
  border: 0;
  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(18px) saturate(1.08);
  -webkit-backdrop-filter: blur(18px) saturate(1.08);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.92), 0 18px 46px -36px rgba(79,70,229,.28);
  transition: transform 180ms ease, box-shadow 180ms ease, background-color 180ms ease;
}
.promoter-page .partner-card:hover {
  transform: translateY(-2px);
  background: rgba(255,255,255,.94);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.96), 0 22px 52px -36px rgba(79,70,229,.32);
}
.promoter-page .partner-card:has(.partner-page-select-trigger[aria-expanded="true"]) {
  z-index: 40;
}
.promoter-page .partner-footer {
  display: grid;
  grid-template-columns: minmax(0,1fr) minmax(180px,260px);
  gap: 32px;
  margin-top: 48px;
  border-top: 1px solid rgba(226,232,240,.78);
  padding: 30px 4px 0;
}
.promoter-page .partner-footer-logo {
  height: 34px;
  width: auto;
  max-width: 190px;
  object-fit: contain;
  object-position: left center;
}
.promoter-page .partner-footer-desc {
  margin-top: 14px;
  max-width: 360px;
  color: #64748b;
  font-size: 14px;
  line-height: 24px;
  font-weight: 700;
}
.promoter-page .partner-footer-copy {
  margin-top: 18px;
  color: #94a3b8;
  font-size: 12px;
  line-height: 20px;
  font-weight: 700;
}
.promoter-page .partner-footer-title {
  color: #111827;
  font-size: 15px;
  line-height: 22px;
  font-weight: 900;
}
.promoter-page .partner-footer-links {
  display: grid;
  gap: 12px;
  margin-top: 14px;
  color: #64748b;
  font-size: 14px;
  line-height: 22px;
  font-weight: 800;
}
.promoter-page .partner-footer-links a {
  color: inherit;
  text-decoration: none;
  transition: color 160ms ease;
}
.promoter-page .partner-footer-links a:hover {
  color: #4f46e5;
}
.promoter-page .partner-entry-hero-card,
.promoter-page .partner-entry-section-card,
.promoter-page .partner-entry-preview-card,
.promoter-page .partner-entry-qr-card,
.promoter-page .partner-entry-preview-stat,
.promoter-page .partner-entry-step,
.promoter-page .partner-entry-benefit-item,
.promoter-page .partner-entry-scene-item {
  transition: transform 180ms ease, box-shadow 180ms ease, background-color 180ms ease;
}
.promoter-page .partner-entry-hero-card:hover,
.promoter-page .partner-entry-section-card:hover,
.promoter-page .partner-entry-preview-card:hover,
.promoter-page .partner-entry-qr-card:hover,
.promoter-page .partner-entry-preview-stat:hover,
.promoter-page .partner-entry-step:hover,
.promoter-page .partner-entry-benefit-item:hover,
.promoter-page .partner-entry-scene-item:hover {
  transform: translateY(-2px);
  background: rgba(255,255,255,.96);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.98), 0 22px 52px -36px rgba(79,70,229,.32);
}
.promoter-page .partner-entry-step:hover,
.promoter-page .partner-entry-benefit-item:hover,
.promoter-page .partner-entry-scene-item:hover {
  background: rgba(248,250,255,.96);
}
.promoter-page .partner-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  background: #ecfdf5;
  padding: 9px 14px;
  color: #10b981;
  font-size: 14px;
  font-weight: 900;
  box-shadow: 0 12px 28px -22px rgba(16,185,129,.45);
}
.promoter-page .partner-status-badge::before {
  content: "";
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #10b981;
  box-shadow: 0 0 0 4px rgba(16,185,129,.14);
}
.promoter-page .partner-tab-list {
  display: flex;
  min-width: max-content;
  gap: 4px;
  border-radius: 16px;
  background: rgba(255,255,255,.78);
  backdrop-filter: blur(20px) saturate(1.2);
  -webkit-backdrop-filter: blur(20px) saturate(1.2);
  padding: 4px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.92), 0 10px 28px -26px rgba(79,70,229,.28);
}
.promoter-page .partner-tab {
  min-height: 40px;
  border-radius: 12px;
  padding: 9px 16px;
  color: #475569;
  font-size: 14px;
  font-weight: 900;
  transition: transform 160ms ease, color 160ms ease, background-color 160ms ease, box-shadow 160ms ease;
}
.promoter-page .partner-tab:hover {
  transform: translateY(-1px);
  background: rgba(255,255,255,.82);
  color: #4f46e5;
}
.promoter-page .partner-tab.is-active {
  color: #fff;
  background: linear-gradient(135deg, #4f46e5 0%, #2563eb 52%, #06b6d4 100%);
  box-shadow: 0 14px 28px -18px rgba(79,70,229,.72);
}
.promoter-page .partner-overview-stat,
.promoter-page .partner-promo-card {
  display: grid;
  grid-template-columns: 58px minmax(0,1fr);
  align-items: center;
  gap: 16px;
  min-height: 124px;
  overflow: hidden;
  border-radius: 20px;
  background: rgba(255,255,255,.88);
  backdrop-filter: blur(18px) saturate(1.08);
  -webkit-backdrop-filter: blur(18px) saturate(1.08);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.94), 0 18px 44px -36px rgba(79,70,229,.28);
  padding: 18px;
  transition: transform 180ms ease, box-shadow 180ms ease, background-color 180ms ease;
}
.promoter-page .partner-overview-stat:hover,
.promoter-page .partner-promo-card:hover {
  transform: translateY(-2px);
  background: rgba(255,255,255,.96);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.98), 0 22px 52px -36px rgba(79,70,229,.32);
}
.promoter-page .partner-overview-stat-label,
.promoter-page .partner-promo-desc {
  color: #64748b;
  font-size: 14px;
  line-height: 22px;
  font-weight: 700;
}
.promoter-page .partner-overview-stat-value {
  margin-top: 4px;
  color: #4f46e5;
  font-size: 30px;
  line-height: 36px;
  font-weight: 950;
}
.promoter-page .partner-overview-stat-icon,
.promoter-page .partner-promo-icon {
  display: inline-flex;
  width: 58px;
  height: 58px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 18px;
  background: #eef0ff;
  color: #4f46e5;
  box-shadow: none;
}
.promoter-page .partner-promo-title {
  color: #111827;
  font-size: 17px;
  line-height: 24px;
  font-weight: 900;
}
.promoter-page .partner-promo-desc {
  margin-top: 8px;
  font-weight: 600;
}
.promoter-page .partner-overview-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 20px;
}
.promoter-page .partner-overview-panel {
  display: flex;
  min-height: 260px;
  flex-direction: column;
}
.promoter-page .partner-overview-panel.is-wide {
  grid-column: 1 / -1;
}
.promoter-page .partner-preview-list {
  display: grid;
  gap: 12px;
}
.promoter-page .partner-preview-row {
  display: grid;
  grid-template-columns: 48px 96px minmax(0,1fr) 78px;
  align-items: center;
  gap: 14px;
  min-height: 68px;
  border-radius: 16px;
  background: rgba(255,255,255,.68);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.72);
  padding: 12px 14px;
}
.promoter-page .partner-preview-row-icon {
  display: inline-flex;
  width: 44px;
  height: 44px;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  background: #eef0ff;
  color: #4f46e5;
}
.promoter-page .partner-preview-label {
  color: #64748b;
  font-size: 14px;
  line-height: 22px;
  font-weight: 800;
}
.promoter-page .partner-preview-value {
  min-width: 0;
  overflow: hidden;
  color: #374151;
  font-size: 14px;
  line-height: 22px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.promoter-page .partner-overview-qr-frame {
  position: relative;
  display: grid;
  width: 224px;
  height: 224px;
  place-items: center;
  border-radius: 18px;
  background: rgba(255,255,255,.72);
  padding: 12px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.9), 0 16px 34px -28px rgba(79,70,229,.34);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}
.promoter-page .partner-action {
  display: inline-flex;
  min-height: 38px;
  align-items: center;
  justify-content: center;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  padding: 0 14px;
  color: #374151;
  font-size: 14px;
  font-weight: 800;
  transition: transform 160ms ease, border-color 160ms ease, color 160ms ease, background-color 160ms ease, box-shadow 160ms ease;
}
.promoter-page .partner-action:hover {
  transform: translateY(-1px);
  border-color: #c7d2fe;
  color: #4f46e5;
  background: #f8faff;
  box-shadow: 0 8px 18px -16px rgba(79,70,229,.5);
}
.promoter-page .partner-tool-row {
  display: grid;
  grid-template-columns: 146px minmax(0,1fr) auto;
  align-items: center;
  gap: 16px;
  min-height: 88px;
  border-radius: 18px;
  background: rgba(255,255,255,.68);
  padding: 15px 16px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.72);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
.promoter-page .partner-tool-label {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  color: #374151;
  font-size: 15px;
  line-height: 24px;
  font-weight: 900;
  white-space: nowrap;
}
.promoter-page .partner-tool-label-icon {
  display: inline-flex;
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: #eef0ff;
  color: #4f46e5;
}
.promoter-page .partner-overview-stat-icon svg,
.promoter-page .partner-promo-icon svg {
  width: 22px;
  height: 22px;
}
.promoter-page .partner-preview-row-icon svg {
  width: 18px;
  height: 18px;
}
.promoter-page .partner-tool-label-icon svg {
  width: 17px;
  height: 17px;
}
.promoter-page .partner-tool-value {
  min-width: 0;
  overflow: hidden;
  border-radius: 14px;
  background: rgba(255,255,255,.7);
  padding: 15px 18px;
  color: #374151;
  font-size: 16px;
  line-height: 24px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.promoter-page .partner-tool-actions {
  display: flex;
  min-width: 176px;
  flex-wrap: nowrap;
  justify-content: flex-end;
  gap: 10px;
}
.promoter-page .partner-tool-actions > button {
  min-width: 82px;
  height: 44px;
  padding-right: 14px;
  padding-left: 14px;
  white-space: nowrap;
}
.promoter-page .partner-tools-layout {
  align-items: stretch;
}
.promoter-page .partner-commission-table {
  overflow: hidden;
  border-radius: 16px;
  background: rgba(255,255,255,.66);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.74);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
.promoter-page .portal-table {
  width: 100%;
  border-collapse: collapse;
  background: transparent;
  font-size: 13px;
  text-align: left;
}
.promoter-page .portal-table th {
  white-space: nowrap;
  padding: 14px 16px;
  text-align: left;
  font-size: 12px;
  font-weight: 800;
  color: #64748b;
}
.promoter-page .portal-table td {
  white-space: nowrap;
  padding: 14px 16px;
  color: #475569;
}
.promoter-page .portal-table tbody tr {
  background: rgba(255,255,255,.58);
}
.promoter-page .portal-table tbody tr + tr {
  border-top: 1px solid #eef2f7;
}
.promoter-page .portal-table tbody tr:hover {
  background: rgba(248,250,255,.72);
}
.promoter-page .partner-table-primary,
.promoter-page .partner-table-strong {
  color: #111827;
  font-weight: 900;
}
.promoter-page .partner-table-money {
  color: #4f46e5;
  font-weight: 900;
}
.promoter-page .partner-table-negative {
  color: #e11d48;
  font-weight: 900;
}
.promoter-page .partner-table-status {
  display: inline-flex;
  min-height: 26px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  padding: 4px 10px;
  font-size: 12px;
  line-height: 1;
  font-weight: 600;
  white-space: nowrap;
}
.promoter-page .partner-table-empty {
  padding: 24px 16px;
  text-align: center;
  color: #94a3b8;
  font-weight: 700;
}
.promoter-page .partner-list-pagination {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 24px;
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
}
.promoter-page .partner-list-pagination.is-open {
  z-index: 80;
}
.promoter-page .partner-page-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.promoter-page .partner-page-size {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 38px;
  border-radius: 14px;
  background: rgba(255,255,255,.76);
  box-shadow: 0 14px 32px -24px rgba(79,70,229,.34), inset 0 0 0 1px rgba(99,102,241,.10);
  padding: 3px 4px 3px 12px;
  transition: background-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
}
.promoter-page .partner-page-size:hover,
.promoter-page .partner-page-size:focus-within {
  transform: translateY(-1px);
  background: rgba(255,255,255,.94);
  box-shadow: 0 18px 34px -24px rgba(79,70,229,.46), inset 0 0 0 1px rgba(79,70,229,.20);
}
.promoter-page .partner-page-size > span {
  color: #64748b;
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
}
.promoter-page .partner-page-select {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.promoter-page .partner-page-select-trigger {
  display: inline-flex;
  min-width: 104px;
  height: 32px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border: 0;
  border-radius: 11px;
  background: linear-gradient(135deg,#4f46e5 0%,#6d5dfb 100%);
  color: #fff;
  cursor: pointer;
  padding: 0 12px 0 14px;
  font-size: 12px;
  font-weight: 900;
  outline: none;
  box-shadow: 0 12px 22px -16px rgba(79,70,229,.72);
  transition: box-shadow 160ms ease, transform 160ms ease, filter 160ms ease;
}
.promoter-page .partner-page-select-trigger:hover {
  filter: brightness(1.03);
}
.promoter-page .partner-page-select-trigger:focus-visible,
.promoter-page .partner-page-select-trigger[aria-expanded="true"] {
  box-shadow: 0 0 0 4px rgba(79,70,229,.14), 0 12px 22px -16px rgba(79,70,229,.72);
}
.promoter-page .partner-page-select-trigger::after {
  content: "";
  width: 7px;
  height: 7px;
  border-right: 2px solid rgba(255,255,255,.9);
  border-bottom: 2px solid rgba(255,255,255,.9);
  transform: translateY(-2px) rotate(45deg);
  pointer-events: none;
  transition: transform 160ms ease;
}
.promoter-page .partner-page-select-trigger[aria-expanded="true"]::after {
  transform: translateY(2px) rotate(225deg);
}
.promoter-page .partner-page-select-menu {
  position: absolute;
  left: 0;
  top: calc(100% + 8px);
  bottom: auto;
  z-index: 120;
  min-width: 122px;
  overflow: hidden;
  border-radius: 14px;
  background: rgba(255,255,255,.98);
  box-shadow: 0 22px 46px -28px rgba(15,23,42,.38), inset 0 0 0 1px rgba(99,102,241,.10);
  padding: 6px;
}
.promoter-page .partner-page-select-menu[hidden] {
  display: none;
}
.promoter-page .partner-page-select-option {
  display: flex;
  width: 100%;
  height: 34px;
  align-items: center;
  justify-content: space-between;
  border-radius: 10px;
  padding: 0 10px;
  color: #334155;
  font-size: 12px;
  font-weight: 900;
  transition: background-color 140ms ease, color 140ms ease;
}
.promoter-page .partner-page-select-option:hover,
.promoter-page .partner-page-select-option:focus-visible,
.promoter-page .partner-page-select-option.is-active {
  background: #eef0ff;
  color: #4f46e5;
  outline: none;
}
.promoter-page .partner-page-select-option.is-active::after {
  content: "";
  width: 6px;
  height: 10px;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: translateY(-1px) rotate(45deg);
}
.promoter-page .partner-page-controls {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.promoter-page .partner-page-button {
  display: inline-flex;
  min-width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: rgba(255,255,255,.76);
  color: #475569;
  font-size: 12px;
  font-weight: 900;
  transition: transform 160ms ease, background-color 160ms ease, color 160ms ease;
}
.promoter-page .partner-page-button:hover {
  transform: translateY(-1px);
  background: #eef0ff;
  color: #4f46e5;
}
.promoter-page .partner-page-button.is-active {
  background: #4f46e5;
  color: #fff;
}
.promoter-page .partner-page-button.is-disabled {
  cursor: not-allowed;
  background: rgba(248,250,252,.72);
  color: #cbd5e1;
  transform: none;
}
.promoter-page .partner-trend-chart-card {
  margin-top: 18px;
  position: relative;
  overflow: hidden;
  border-radius: 20px;
  background: rgba(255,255,255,.72);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.88);
  padding: 18px;
}
.promoter-page .partner-trend-empty-note {
  margin-top: 14px;
  border-radius: 14px;
  background: rgba(238,240,255,.68);
  padding: 10px 14px;
  color: #64748b;
  font-size: 13px;
  line-height: 20px;
  font-weight: 700;
}
.promoter-page .partner-trend-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  color: #475569;
  font-size: 13px;
  font-weight: 800;
}
.promoter-page .partner-trend-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.promoter-page .partner-trend-legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #4f46e5;
}
.promoter-page .partner-trend-legend-dot.is-line {
  background: #06b6d4;
}
.promoter-page .partner-trend-svg-wrap {
  position: relative;
  margin-top: 14px;
  overflow-x: auto;
  overflow-y: visible;
}
.promoter-page .partner-trend-svg {
  display: block;
  width: 100%;
  min-width: 920px;
  height: auto;
}
.promoter-page .partner-trend-grid {
  stroke: #e8eef8;
  stroke-width: 1;
}
.promoter-page .partner-trend-axis-text {
  fill: #94a3b8;
  font-size: 12px;
  font-weight: 700;
}
.promoter-page .partner-trend-label {
  fill: #334155;
  font-size: 13px;
  font-weight: 900;
}
.promoter-page .partner-trend-hover-zone {
  fill: transparent;
  cursor: pointer;
  pointer-events: all;
}
.promoter-page .partner-trend-item {
  outline: none;
}
.promoter-page .partner-trend-gmv-bar {
  fill: url(#partnerTrendBarGradient);
  transition: opacity 160ms ease, transform 160ms ease;
}
.promoter-page .partner-trend-commission-bar {
  fill: url(#partnerTrendCommissionGradient);
  transition: opacity 160ms ease, transform 160ms ease;
}
.promoter-page .partner-trend-item:hover .partner-trend-gmv-bar,
.promoter-page .partner-trend-item:hover .partner-trend-commission-bar {
  opacity: .9;
  transform: translateY(-2px);
}
.promoter-page .partner-trend-summary {
  display: grid;
  grid-template-columns: repeat(2,minmax(0,1fr));
  gap: 12px;
  margin-top: 16px;
}
.promoter-page .partner-trend-summary-item {
  min-width: 0;
  border-radius: 18px;
  background: rgba(255,255,255,.72);
  padding: 14px 16px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.86), 0 16px 34px -28px rgba(79,70,229,.28);
}
.promoter-page .partner-trend-summary-label {
  color: #64748b;
  font-size: 12px;
  font-weight: 900;
}
.promoter-page .partner-trend-summary-value {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin-top: 6px;
  color: #0f172a;
  font-size: 18px;
  font-weight: 900;
}
.promoter-page .partner-trend-summary-sub {
  color: #4f46e5;
}
.promoter-page .partner-tier-visual {
  display: grid;
  grid-template-columns: minmax(0,1fr) 300px;
  gap: 18px;
  margin-top: 22px;
  align-items: stretch;
}
.promoter-page .partner-tier-chart,
.promoter-page .partner-tier-note {
  border-radius: 22px;
  background: rgba(255,255,255,.72);
  backdrop-filter: blur(14px) saturate(1.04);
  -webkit-backdrop-filter: blur(14px) saturate(1.04);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.9), 0 16px 34px -28px rgba(79,70,229,.30);
}
.promoter-page .partner-tier-chart {
  min-height: 340px;
  overflow-x: auto;
  padding: 18px;
}
.promoter-page .partner-tier-note {
  display: flex;
  min-height: 340px;
  flex-direction: column;
  justify-content: space-between;
  padding: 22px;
}
.promoter-page .partner-tier-svg {
  display: block;
  width: 100%;
  min-width: 720px;
  height: auto;
}
.promoter-page .partner-tier-grid-line {
  stroke: #e2e8f0;
  stroke-width: 1;
  stroke-dasharray: 4 6;
}
.promoter-page .partner-tier-axis-line {
  stroke: #cbd5e1;
  stroke-width: 1.2;
}
.promoter-page .partner-tier-axis-label {
  fill: #94a3b8;
  font-size: 13px;
  font-weight: 800;
}
.promoter-page .partner-tier-rate-label {
  fill: #4f46e5;
  font-size: 22px;
  font-weight: 950;
}
.promoter-page .partner-tier-x-label {
  fill: #111827;
  font-size: 15px;
  font-weight: 900;
}
.promoter-page .partner-tier-x-sub {
  fill: #64748b;
  font-size: 12px;
  font-weight: 800;
}
.promoter-page .partner-tier-bar-shape {
  fill: url(#partnerTierBarGradient);
  filter: drop-shadow(0 16px 18px rgba(79,70,229,.16));
  transition: opacity 160ms ease, transform 160ms ease;
}
.promoter-page .partner-tier-bar-group:hover .partner-tier-bar-shape {
  opacity: .92;
  transform: translateY(-3px);
}
.promoter-page .partner-tier-note-badge {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  border-radius: 999px;
  background: #eef0ff;
  padding: 8px 12px;
  color: #4f46e5;
  font-size: 12px;
  font-weight: 900;
}
.promoter-page .partner-tier-note-title {
  margin-top: 18px;
  color: #111827;
  font-size: 22px;
  line-height: 30px;
  font-weight: 950;
}
.promoter-page .partner-tier-note-text {
  margin-top: 12px;
  color: #64748b;
  font-size: 14px;
  line-height: 24px;
  font-weight: 600;
}
.promoter-page .partner-tier-formula {
  margin-top: 20px;
  border-radius: 18px;
  background: #fff;
  padding: 16px;
  color: #334155;
  font-size: 13px;
  line-height: 22px;
  font-weight: 800;
  box-shadow: inset 0 0 0 1px rgba(226,232,240,.72);
}
.promoter-page .partner-faq-list {
  margin-top: 20px;
  display: grid;
  gap: 12px;
}
.promoter-page .partner-faq-item {
  overflow: hidden;
  border-radius: 18px;
  background: rgba(255,255,255,.72);
  backdrop-filter: blur(14px) saturate(1.04);
  -webkit-backdrop-filter: blur(14px) saturate(1.04);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.86), 0 14px 32px -28px rgba(79,70,229,.28);
  transition: background-color 180ms ease, transform 180ms ease, box-shadow 180ms ease;
}
.promoter-page .partner-faq-item:hover,
.promoter-page .partner-faq-item[open] {
  transform: translateY(-1px);
  background: rgba(255,255,255,.92);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.94), 0 18px 38px -30px rgba(79,70,229,.36);
}
.promoter-page .partner-faq-question {
  display: grid;
  grid-template-columns: minmax(0,1fr) 34px;
  align-items: center;
  gap: 16px;
  min-height: 68px;
  cursor: pointer;
  list-style: none;
  padding: 16px 18px 16px 20px;
  color: #111827;
  font-size: 15px;
  line-height: 22px;
  font-weight: 900;
}
.promoter-page .partner-faq-question::-webkit-details-marker {
  display: none;
}
.promoter-page .partner-faq-toggle {
  position: relative;
  display: inline-flex;
  width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: #eef0ff;
  color: #4f46e5;
}
.promoter-page .partner-faq-toggle::before,
.promoter-page .partner-faq-toggle::after {
  content: "";
  position: absolute;
  width: 14px;
  height: 2px;
  border-radius: 999px;
  background: currentColor;
  transition: transform 160ms ease;
}
.promoter-page .partner-faq-toggle::after {
  transform: rotate(90deg);
}
.promoter-page .partner-faq-item[open] .partner-faq-toggle::after {
  transform: rotate(0deg);
}
.promoter-page .partner-faq-answer {
  padding: 0 20px 18px;
  color: #64748b;
  font-size: 14px;
  line-height: 24px;
  font-weight: 600;
}
.promoter-page .partner-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 150;
  display: grid;
  place-items: center;
  background: rgba(15,23,42,.55);
  padding: 24px 16px;
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}
.promoter-page .partner-modal-backdrop-button {
  position: absolute;
  inset: 0;
  cursor: default;
  border: 0;
  background: transparent;
}
.promoter-page .partner-modal-window {
  position: relative;
  width: 100%;
}
.promoter-page .partner-modal-shell,
.promoter-page .partner-receipt-shell {
  position: relative;
  overflow: hidden;
  width: 100%;
  background:
    radial-gradient(circle at 86% 0%, rgba(79,70,229,.10), transparent 34%),
    linear-gradient(180deg, rgba(255,255,255,.98) 0%, rgba(248,250,255,.96) 100%);
  box-shadow: 0 32px 90px -48px rgba(15,23,42,.62);
}
.promoter-page .partner-modal-shell::before,
.promoter-page .partner-receipt-shell::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.95);
}
.promoter-page .partner-modal-shell {
  border-radius: 16px;
  padding: 24px;
}
.promoter-page .partner-modal-head,
.promoter-page .partner-receipt-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.promoter-page .partner-modal-title,
.promoter-page .partner-receipt-title {
  color: #020617;
  font-size: 20px;
  line-height: 28px;
  font-weight: 900;
}
.promoter-page .partner-modal-desc,
.promoter-page .partner-receipt-desc {
  margin-top: 8px;
  color: #64748b;
  font-size: 14px;
  line-height: 24px;
  font-weight: 600;
}
.promoter-page .partner-modal-close,
.promoter-page .partner-receipt-close {
  display: inline-flex;
  height: 38px;
  width: 38px;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: rgba(255,255,255,.76);
  color: #64748b;
  font-size: 22px;
  font-weight: 800;
  line-height: 1;
  transition: transform 160ms ease, background-color 160ms ease, color 160ms ease, box-shadow 160ms ease;
}
.promoter-page .partner-modal-close:hover,
.promoter-page .partner-receipt-close:hover {
  transform: translateY(-1px);
  background: #fff;
  color: #111827;
  box-shadow: 0 12px 28px -22px rgba(79,70,229,.42);
}
.promoter-page .partner-modal-form {
  display: grid;
  gap: 16px;
  margin-top: 20px;
}
.promoter-page .partner-modal-summary {
  border-radius: 16px;
  border: 1px solid #f1f5f9;
  background: #f8fafc;
  padding: 14px 16px;
  color: #64748b;
  font-size: 14px;
  line-height: 24px;
  font-weight: 600;
}
.promoter-page .partner-modal-footer,
.promoter-page .partner-receipt-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}
.promoter-page .partner-receipt-shell {
  max-height: 86vh;
  overflow-y: auto;
  border-radius: 24px;
}
.promoter-page .partner-receipt-head {
  padding: 24px 24px 18px;
}
.promoter-page .partner-receipt-title-wrap {
  display: grid;
  grid-template-columns: 52px minmax(0,1fr);
  align-items: center;
  gap: 14px;
}
.promoter-page .partner-receipt-icon {
  display: inline-flex;
  height: 52px;
  width: 52px;
  align-items: center;
  justify-content: center;
  border-radius: 18px;
  background: #eef0ff;
  color: #4f46e5;
}
.promoter-page .partner-receipt-form {
  display: grid;
  grid-template-columns: repeat(2,minmax(0,1fr));
  gap: 14px;
  padding: 4px 26px 0;
}
.promoter-page .partner-receipt-field {
  display: grid;
  gap: 8px;
  min-width: 0;
}
.promoter-page .partner-receipt-field.is-wide {
  grid-column: 1 / -1;
}
.promoter-page .partner-receipt-label {
  display: block;
  color: #475569;
  font-size: 13px;
  line-height: 18px;
  font-weight: 900;
}
.promoter-page .partner-receipt-input {
  height: 48px;
  width: 100%;
  border: 0;
  border-radius: 14px;
  background: rgba(255,255,255,.82);
  padding: 0 15px;
  color: #111827;
  font-size: 14px;
  font-weight: 700;
  outline: none;
  box-shadow: inset 0 0 0 1px rgba(226,232,240,.9);
  transition: background-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
}
.promoter-page .partner-receipt-input:focus {
  background: #fff;
  box-shadow: inset 0 0 0 1px #4f46e5, 0 0 0 4px rgba(79,70,229,.10);
  transform: translateY(-1px);
}
.promoter-page .partner-receipt-footer {
  padding: 18px 24px 24px;
}
@media (max-width: 640px) {
  .promoter-page .partner-receipt-form {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 768px) {
  .promoter-page .partner-overview-layout {
    grid-template-columns: 1fr;
  }
  .promoter-page .partner-overview-panel.is-wide {
    grid-column: auto;
  }
  .promoter-page .partner-list-pagination,
  .promoter-page .partner-page-meta,
  .promoter-page .partner-page-controls {
    justify-content: center;
  }
  .promoter-page .partner-preview-row {
    grid-template-columns: 44px minmax(0,1fr);
  }
  .promoter-page .partner-preview-label,
  .promoter-page .partner-preview-value,
  .promoter-page .partner-preview-row .partner-action {
    grid-column: 2;
  }
  .promoter-page .partner-tool-row {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .promoter-page .partner-tool-actions {
    display: grid;
    grid-template-columns: repeat(2,minmax(120px,1fr));
    min-width: 0;
  }
  .promoter-page .partner-trend-summary {
    grid-template-columns: 1fr;
  }
  .promoter-page .partner-footer {
    grid-template-columns: 1fr;
    gap: 22px;
    margin-top: 36px;
  }
  .promoter-page .partner-tier-visual {
    grid-template-columns: 1fr;
  }
}
`;

const apiPrefix = '/api/partnership/promoter';

const tabs = [
  { key: 'overview', label: '推广概览', shortLabel: '概览' },
  { key: 'tools', label: '推广工具', shortLabel: '工具' },
  { key: 'data', label: '推广数据', shortLabel: '数据' },
  { key: 'withdrawals', label: '分佣提现', shortLabel: '分佣' },
  { key: 'rules', label: '规则说明', shortLabel: '规则' },
];

const rangeOptions = [
  { key: 'month', label: '本月' },
  { key: 'lastMonth', label: '上月' },
  { key: 'last90', label: '近90天' },
  { key: 'all', label: '全部' },
];

const tierRows = [
  ['0-5 万', '8%'],
  ['5-10 万', '10%'],
  ['10-30 万', '12%'],
  ['30-50 万', '15%'],
  ['50 万以上', '20%'],
];

function getLocalUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch (error) {
    return null;
  }
}

function toNumber(value) {
  if (typeof value === 'number') return value;
  const parsed = Number(String(value || '').replace(/[￥,\s]/g, ''));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function money(value) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

function copyText(text, label = '内容') {
  if (!text) return;
  navigator.clipboard
    .writeText(text)
    .then(() => Toast.success(`${label}已复制`))
    .catch(() => Toast.warning('当前浏览器不支持自动复制'));
}

function withReferralSource(value, source) {
  if (!value) return '';
  try {
    const url = new URL(value, window.location.origin);
    url.searchParams.set('ref_source', source);
    return url.toString();
  } catch (error) {
    return value;
  }
}

function loadCanvasImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (!src.startsWith('data:') && !src.startsWith('blob:')) {
      image.crossOrigin = 'anonymous';
    }
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('image load failed'));
    image.src = src;
  });
}

async function downloadQrPng(filename, avatarUrl) {
  const svg = document.querySelector('[data-promoter-qr="main"]');
  if (!svg) return;
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', '660');
  clone.setAttribute('height', '660');
  const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
    type: 'image/svg+xml;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    URL.revokeObjectURL(url);
    return;
  }
  try {
    const qrImage = await loadCanvasImage(url);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 720, 720);
    ctx.drawImage(qrImage, 30, 30, 660, 660);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(294, 294, 132, 132);
    if (avatarUrl) {
      const avatar = await loadCanvasImage(avatarUrl);
      ctx.drawImage(avatar, 304, 304, 112, 112);
    } else {
      ctx.fillStyle = '#2f65ff';
      ctx.fillRect(304, 304, 112, 112);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('FI', 360, 360);
    }
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = filename.replace(/\.svg$/i, '.png');
    link.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

function uploadImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('image read failed'));
    reader.readAsDataURL(file);
  });
}

function formatDateTime(value) {
  const text = String(value || '').trim();
  if (!text || text === '-') return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) {
    const pad = (next) => String(next).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }
  return text.includes('T') ? text.replace('T', ' ').slice(0, 19) : text;
}

function buildMonthTrend(rows) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const trend = Array.from({ length: daysInMonth }, (_, index) => ({
    day: `${String(month + 1).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`,
    gmv: 0,
    commission: 0,
  }));
  rows.forEach((row) => {
    const date = new Date(rowValue(row, ['date', 'occurred_at', 'occurredAt'], ''));
    if (Number.isNaN(date.getTime())) return;
    if (date.getFullYear() !== year || date.getMonth() !== month) return;
    const index = date.getDate() - 1;
    trend[index].gmv += toNumber(rowValue(row, ['effective_gmv', 'effectiveGmv'], 0));
    trend[index].commission += toNumber(rowValue(row, ['commission_amount', 'commissionAmount'], 0));
  });
  return trend;
}

function currentMonthLabel() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function buildMonthTrendWeeks(rows) {
  const days = buildMonthTrend(rows);
  const weeks = [];
  for (let index = 0; index < days.length; index += 7) {
    const slice = days.slice(index, index + 7);
    const first = slice[0]?.day;
    const last = slice[slice.length - 1]?.day;
    weeks.push({
      label: first === last ? first : `${first} ~ ${last}`,
      aria: first === last ? first : `${first} 到 ${last}`,
      gmv: slice.reduce((sum, item) => sum + item.gmv, 0),
      commission: slice.reduce((sum, item) => sum + item.commission, 0),
    });
  }
  return weeks;
}

function trendAxisMax(rows) {
  const maxValue = Math.max(...rows.flatMap((row) => [row.gmv, row.commission]), 1);
  const step = Math.max(10000, Math.ceil(maxValue / 3 / 10000) * 10000);
  return step * 3;
}

function yAxisTicks(maxValue) {
  if (maxValue <= 0) return [0];
  const step = niceTickStep(maxValue / 3);
  return [step * 3, step * 2, step, 0];
}

function niceTickStep(rawStep) {
  if (rawStep <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

function compactMoney(value) {
  if (value >= 10000) {
    return `${new Intl.NumberFormat('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value / 10000)} 万`;
  }
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function trendTickLabels(rows) {
  const indexes = [0, 7, 14, 21, rows.length - 1].filter(
    (value, index, list) =>
      value >= 0 && value < rows.length && list.indexOf(value) === index,
  );
  return indexes.map((index) => rows[index].day);
}

function normalizeRows(rows) {
  return Array.isArray(rows) ? rows : [];
}

function statusLabel(status) {
  const map = {
    active: '合作中',
    paused: '暂停中',
    frozen: '已冻结',
    terminated: '已终止',
  };
  return map[status] || status || '合作中';
}

function rowValue(row, keys, fallback = '-') {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== '') {
      return row[key];
    }
  }
  return fallback;
}

function isInRange(dateText, range) {
  if (range === 'all') return true;
  if (!dateText) return true;
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return true;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  if (range === 'month') return date >= startOfMonth;
  if (range === 'lastMonth') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return date >= start && date < startOfMonth;
  }
  const start90 = new Date(now);
  start90.setDate(now.getDate() - 90);
  return date >= start90;
}

const Promoter = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [userRange, setUserRange] = useState('month');
  const [topupRange, setTopupRange] = useState('month');
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [maintenance, setMaintenance] = useState(false);
  const [previewView, setPreviewView] = useState('');
  const [profile, setProfile] = useState(null);
  const [center, setCenter] = useState(null);
  const [credentialModal, setCredentialModal] = useState(null);
  const [credentialDraft, setCredentialDraft] = useState('');
  const [qrAvatarUrl, setQrAvatarUrl] = useState('');
  const [payoutModalVisible, setPayoutModalVisible] = useState(false);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawNote, setWithdrawNote] = useState('');
  const [payoutDraft, setPayoutDraft] = useState({
    identity_name: '',
    identity_no: '',
    bank_account_no: '',
    bank_name: '',
    bank_branch: '',
  });

  const user = useMemo(() => getLocalUser(), []);
  const isLoggedIn = Boolean(user?.id);
  const snapshot = center || {};
  const portalProfile = snapshot.profile || profile || {};
  const stats = snapshot.stats || {};
  const users = normalizeRows(snapshot.users);
  const topups = normalizeRows(snapshot.topups);
  const monthTrend = normalizeRows(
    snapshot.month_trend || stats.month_trend,
  );
  const monthTrendRows = monthTrend.length ? monthTrend : topups;
  const statements = normalizeRows(snapshot.statements);
  const withdrawals = normalizeRows(snapshot.withdrawals);
  const receipt = snapshot.receipt || {};
  const isOpened = Boolean(snapshot.opened || profile?.opened);
  const forceApplyView = previewView === 'apply';
  const forceDashboardView =
    previewView === 'dashboard' || previewView === 'center';
  const shouldShowDashboard = forceApplyView
    ? false
    : forceDashboardView
      ? true
      : isOpened;
  const promoterStatus = portalProfile.status || profile?.status || '';
  const restricted =
    promoterStatus === 'frozen' || promoterStatus === 'terminated';
  const recommendationCode =
    portalProfile.recommendation_code || profile?.recommendation_code || '';
  const recommendationPhrase =
    portalProfile.recommendation_phrase || profile?.recommendation_phrase || '';
  const recommendationLink =
    portalProfile.recommendation_link || profile?.recommendation_link || '';
  const referralLink = withReferralSource(recommendationLink, 'link');
  const qrRecommendationLink = withReferralSource(recommendationLink, 'qr');
  const remainingChanges =
    portalProfile.remaining_changes ?? profile?.remaining_changes ?? 0;
  const commissionTiers = normalizeRows(
    snapshot.commission_tiers || stats.commission_tiers,
  ).length
    ? normalizeRows(snapshot.commission_tiers || stats.commission_tiers)
    : tierRows.map(([range, rate]) => ({ range, rate }));

  const monthGmv = stats.month_effective_gmv || 0;
  const monthCommission = stats.month_commission || 0;
  const monthNewUsers = stats.month_new_users || 0;
  const monthTopupCount = stats.month_topup_count || 0;
  const availableWithdraw = stats.available_withdraw || 0;
  const withdrawingAmount = stats.withdrawing_amount || 0;
  const paidAmount = stats.paid_amount || 0;
  const currentRate = stats.current_rate || '区间阶梯';

  const filteredUsers = users.filter((item) =>
    isInRange(rowValue(item, ['locked_at', 'lockedAt'], ''), userRange),
  );
  const filteredTopups = topups.filter((item) =>
    isInRange(
      rowValue(item, ['date', 'occurred_at', 'occurredAt'], ''),
      topupRange,
    ),
  );
  const firstChargedUsers = filteredUsers.filter((item) =>
    String(rowValue(item, ['first_charge', 'firstCharge'], '')).includes(
      '已首充',
    ),
  ).length;

  const fetchPromoterState = async () => {
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setMaintenance(false);
    try {
      const meRes = await API.get(`${apiPrefix}/me`, {
        skipErrorHandler: true,
      });
      const me = meRes.data;
      setProfile(me);
      if (me?.opened) {
        const centerRes = await API.get(`${apiPrefix}/center`, {
          skipErrorHandler: true,
        });
        setCenter(centerRes.data);
        const nextReceipt = centerRes.data?.receipt || {};
        setPayoutDraft({
          identity_name: nextReceipt.identity_name || '',
          identity_no: nextReceipt.identity_no || '',
          bank_account_no: nextReceipt.bank_account_no || '',
          bank_name: nextReceipt.bank_name || '',
          bank_branch: nextReceipt.bank_branch || '',
        });
        const nextAvatar =
          centerRes.data?.profile?.qr_avatar_url ||
          centerRes.data?.profile?.qrAvatarUrl ||
          '';
        if (nextAvatar) setQrAvatarUrl(nextAvatar);
      }
    } catch (error) {
      if (error?.response?.status === 401) {
        localStorage.removeItem('user');
      } else {
        setMaintenance(true);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    if (['apply', 'dashboard', 'center'].includes(view)) setPreviewView(view);
    const tab = params.get('tab');
    if (tabs.some((item) => item.key === tab)) setActiveTab(tab);
    fetchPromoterState();
  }, []);

  const goLogin = () => navigate('/login?return_to=/partners/promoter');

  const openPromoter = async () => {
    if (!isLoggedIn) {
      goLogin();
      return;
    }
    setOpening(true);
    try {
      await API.post(`${apiPrefix}/me/open`, {}, { skipErrorHandler: true });
      showSuccess(t('开通成功'));
      await fetchPromoterState();
    } catch (error) {
      showError(error?.response?.data?.detail || t('开通失败，请稍后再试'));
    } finally {
      setOpening(false);
    }
  };

  const saveCredential = async () => {
    const value = credentialDraft.trim();
    if (!credentialModal || !value) return;
    try {
      await API.patch(
        `${apiPrefix}/referral-credential`,
        { credential_type: credentialModal, value },
        { skipErrorHandler: true },
      );
      setCredentialModal(null);
      showSuccess(t('保存成功'));
      await fetchPromoterState();
    } catch (error) {
      showError(error?.response?.data?.detail || t('保存失败'));
    }
  };

  const savePayoutProfile = async () => {
    try {
      await API.put(
        `${apiPrefix}/payout-profile`,
        {
          ...payoutDraft,
          bank_account_name: payoutDraft.identity_name,
        },
        {
          skipErrorHandler: true,
        },
      );
      setPayoutModalVisible(false);
      showSuccess(t('收款资料已保存'));
      await fetchPromoterState();
    } catch (error) {
      showError(error?.response?.data?.detail || t('保存失败'));
    }
  };

  const createWithdrawal = async () => {
    try {
      await API.post(
        `${apiPrefix}/withdrawals`,
        { amount: Number(withdrawAmount), note: withdrawNote },
        { skipErrorHandler: true },
      );
      setWithdrawModalVisible(false);
      setWithdrawAmount('');
      setWithdrawNote('');
      showSuccess(t('提现申请已提交'));
      await fetchPromoterState();
    } catch (error) {
      showError(error?.response?.data?.detail || t('提交失败'));
    }
  };

  const openCredentialModal = (kind) => {
    setCredentialModal(kind);
    setCredentialDraft(
      kind === 'code' ? recommendationCode : recommendationPhrase,
    );
  };

  const uploadQrAvatar = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setQrAvatarUrl(await uploadImageAsDataUrl(file));
    } catch (error) {
      Toast.error('头像读取失败，请重新选择图片');
    } finally {
      event.target.value = '';
    }
  };

  const renderOverview = () => (
    <div className='grid gap-5'>
      <div className='grid gap-5 md:grid-cols-2 xl:grid-cols-4'>
        <SummaryStatCard
          color='purple'
          icon='userPlus'
          label='本月新增推广用户'
          value={`${monthNewUsers}`}
        />
        <SummaryStatCard
          color='blue'
          icon='chart'
          label='本月有效 GMV'
          value={money(monthGmv)}
        />
        <SummaryStatCard
          color='purple'
          icon='calendar'
          label='本月预估分佣'
          value={money(monthCommission)}
        />
        <SummaryStatCard
          color='amber'
          icon='wallet'
          label='可提现分佣'
          value={money(availableWithdraw)}
        />
      </div>

      <div className='partner-overview-layout'>
        <Panel className='partner-overview-panel'>
          <PanelTitle title='推广工具预览' />
          <div className='partner-preview-list mt-5'>
            <PreviewToolLine
              icon='link'
              label='推荐链接'
              value={referralLink}
              onClick={() => copyText(referralLink, '推广链接')}
            />
            <PreviewToolLine
              icon='message'
              label='推荐口令'
              value={recommendationPhrase}
              onClick={() => copyText(recommendationPhrase, '推荐口令')}
            />
            <PreviewToolLine
              icon='qr'
              label='推广二维码'
              value='扫码进入专属推广入口'
              action='下载'
              onClick={() =>
                downloadQrPng(
                  `infistar-${recommendationCode || 'promoter'}-qr.png`,
                  qrAvatarUrl,
                )
              }
            />
          </div>
          <button
            className='infistar-btn-primary mt-5 h-12 w-full'
            type='button'
            onClick={() => setActiveTab('tools')}
          >
            进入推广工具
          </button>
        </Panel>

        <Panel className='partner-overview-panel'>
          <PanelTitle title='二维码预览' />
          <div className='mt-5 flex flex-1 flex-col items-center gap-4'>
            <QrPreview avatarUrl={qrAvatarUrl} value={qrRecommendationLink} />
            <button
              className='infistar-btn-primary mt-auto h-12 w-full rounded-xl px-4 text-sm font-black'
              type='button'
              onClick={() =>
                downloadQrPng(
                  `infistar-${recommendationCode || 'promoter'}-qr.png`,
                  qrAvatarUrl,
                )
              }
            >
              下载二维码
            </button>
          </div>
        </Panel>

        <Panel className='partner-overview-panel is-wide'>
          <PanelHeader
            title='本月趋势'
            hint='按周展示有效 GMV 和预估分佣趋势。'
            right={
              <span className='rounded-full bg-indigo-50 px-4 py-2 text-xs font-black text-indigo-600'>
                {currentMonthLabel()}
              </span>
            }
          />
          <TrendBars rows={monthTrendRows} />
        </Panel>

        <Panel className='partner-overview-panel is-wide'>
          <PanelHeader
            title='最近分佣'
            hint='展示近几个月的分佣账单和结算状态。'
            right={
              <button
                className='infistar-btn-primary h-11 rounded-xl px-5 text-sm font-black'
                type='button'
                onClick={() => setActiveTab('withdrawals')}
              >
                查看分佣提现
              </button>
            }
          />
          <PartnerListTable
            columns={[
              {
                key: 'month',
                label: '账单月份',
                render: (item) => rowValue(item, ['month']),
                primary: true,
              },
              {
                key: 'effectiveGmv',
                label: '有效 GMV',
                render: (item) =>
                  money(rowValue(item, ['effective_gmv', 'effectiveGmv'], 0)),
              },
              {
                key: 'ratio',
                label: '返佣比例',
                render: (item) => rowValue(item, ['ratio'], currentRate),
              },
              {
                key: 'settledCommission',
                label: '实结佣金',
                render: (item) =>
                  money(
                    rowValue(
                      item,
                      ['settled_commission', 'settledCommission'],
                      monthCommission,
                    ),
                  ),
                money: true,
              },
              {
                key: 'status',
                label: '状态',
                render: (item) => (
                  <StatusBadge status={rowValue(item, ['status'], '统计中')} />
                ),
              },
            ]}
            emptyTitle='暂无最近分佣记录'
            getRowKey={(item, index) =>
              String(rowValue(item, ['month'], `overview-${index}`))
            }
            minWidth={760}
            rows={
              statements.length
                ? statements.slice(0, 3)
                : [
                    {
                      month: '本月',
                      effective_gmv: monthGmv,
                      ratio: currentRate,
                      settled_commission: monthCommission,
                      status: '统计中',
                    },
                  ]
            }
          />
        </Panel>
      </div>
    </div>
  );

  const renderTools = () => (
    <div className='grid gap-5'>
      <div className='grid gap-5 lg:grid-cols-3'>
        <UseCaseCard
          color='purple'
          icon='users'
          title='社群转发：用推荐口令更自然'
          detail='在社群或聊天中分享推荐口令，用户注册时手动填写即可归属。'
        />
        <UseCaseCard
          color='blue'
          icon='book'
          title='内容平台：用推荐链接更方便'
          detail='在文章、视频、评论区等内容平台分享推荐链接，用户点击即可注册。'
        />
        <UseCaseCard
          color='amber'
          icon='qr'
          title='海报物料：用二维码更醒目'
          detail='将专属二维码添加到海报、宣传页等物料，扫码即可关注与注册。'
        />
      </div>

      <div className='partner-overview-layout partner-tools-layout'>
        <Panel className='partner-overview-panel'>
          <PanelTitle
            title='推荐信息'
            hint={`推荐链接和推荐口令今年合计还可修改 ${remainingChanges} 次；修改后旧链接或旧口令立即失效。`}
          />
          <div className='mt-5 grid gap-3'>
            <ToolInfoRow
              icon='link'
              label='推荐链接'
              value={referralLink}
              primaryAction={
                <button
                  className='infistar-btn-primary h-10 min-w-[72px]'
                  type='button'
                  onClick={() => copyText(referralLink, '推广链接')}
                >
                  复制
                </button>
              }
              secondaryAction={
                <button
                  className='infistar-btn-secondary h-10 min-w-[72px]'
                  type='button'
                  disabled={restricted}
                  onClick={() => openCredentialModal('code')}
                >
                  修改
                </button>
              }
            />
            <ToolInfoRow
              icon='message'
              label='推荐口令'
              value={recommendationPhrase}
              primaryAction={
                <button
                  className='infistar-btn-primary h-10 min-w-[72px]'
                  type='button'
                  onClick={() => copyText(recommendationPhrase, '推荐口令')}
                >
                  复制
                </button>
              }
              secondaryAction={
                <button
                  className='infistar-btn-secondary h-10 min-w-[72px]'
                  type='button'
                  disabled={restricted}
                  onClick={() => openCredentialModal('phrase')}
                >
                  修改
                </button>
              }
            />
            <ToolInfoRow
              icon='qr'
              label='推广二维码'
              value='扫码进入专属推广入口'
              primaryAction={
                <button
                  className='infistar-btn-primary h-10 min-w-[72px]'
                  type='button'
                  onClick={() =>
                    downloadQrPng(
                      `infistar-${recommendationCode || 'promoter'}-qr.png`,
                      qrAvatarUrl,
                    )
                  }
                >
                  下载
                </button>
              }
            />
          </div>
        </Panel>

        <Panel className='partner-overview-panel'>
          <PanelTitle title='二维码' />
          <div className='mt-5 flex flex-1 flex-col items-center gap-4'>
            <QrPreview avatarUrl={qrAvatarUrl} value={qrRecommendationLink} />
            <div className='grid w-full gap-3'>
              <label className='partner-action h-11 cursor-pointer rounded-xl px-4 text-sm font-bold'>
                上传头像
                <input
                  accept='image/*'
                  className='hidden'
                  type='file'
                  onChange={uploadQrAvatar}
                />
              </label>
              <button
                className='infistar-btn-primary h-11 w-full rounded-xl px-4 text-sm font-black'
                type='button'
                onClick={() =>
                  downloadQrPng(
                    `infistar-${recommendationCode || 'promoter'}-qr.png`,
                    qrAvatarUrl,
                  )
                }
              >
                下载二维码
              </button>
            </div>
            {qrAvatarUrl ? (
              <button
                className='mt-3 text-sm font-bold text-slate-500'
                type='button'
                onClick={() => setQrAvatarUrl('')}
              >
                恢复默认头像
              </button>
            ) : null}
          </div>
        </Panel>
      </div>

      <Panel className='mt-0'>
        <PanelTitle title='推荐信息变更记录' />
        <CredentialChangeTable
          rows={normalizeRows(
            snapshot.credential_changes || snapshot.credentialChanges,
          )}
        />
      </Panel>
    </div>
  );

  const renderData = () => (
    <div className='grid gap-5'>
      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
        <SummaryStatCard
          icon='userPlus'
          label='本月新增推广用户'
          value={`${monthNewUsers}`}
          color='purple'
        />
        <SummaryStatCard
          icon='checkUser'
          label='本月已首充用户'
          value={`${firstChargedUsers}`}
          color='cyan'
        />
        <SummaryStatCard
          icon='chart'
          label='本月有效 GMV'
          value={money(monthGmv)}
          color='blue'
        />
        <SummaryStatCard
          icon='calendar'
          label='本月预估分佣'
          value={money(monthCommission)}
          color='amber'
        />
      </div>
      <Panel>
        <PanelHeader
          title='推广用户'
          right={<SegmentedRange value={userRange} onChange={setUserRange} />}
        />
        <UserTable rows={filteredUsers} />
      </Panel>
      <Panel>
        <PanelHeader
          title='充值流水'
          hint='按单笔展示有效 GMV，不按用户聚合，不展示用户累计值。'
          right={<SegmentedRange value={topupRange} onChange={setTopupRange} />}
        />
        <TopupTable rows={filteredTopups} />
      </Panel>
    </div>
  );

  const renderWithdrawals = () => (
    <div className='grid gap-5'>
      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
        <SummaryStatCard
          icon='wallet'
          label='可提现分佣'
          value={money(availableWithdraw)}
          color='amber'
        />
        <SummaryStatCard
          icon='transfer'
          label='提现中'
          value={money(withdrawingAmount)}
          color='blue'
        />
        <SummaryStatCard
          icon='check'
          label='已提现'
          value={money(paidAmount)}
          color='green'
        />
      </div>
      <Panel>
        <div className='grid gap-5 xl:grid-cols-[240px_minmax(280px,1fr)_300px] xl:items-center'>
          <div className='min-w-[220px]'>
            <PanelTitle title='申请提现' hint='提交前请先确认身份和银行卡信息。' />
          </div>
          <div className='rounded-2xl bg-slate-50 px-5 py-4'>
            <div className='text-xs font-bold text-slate-500'>当前可提现</div>
            <div className='mt-1 text-3xl font-black text-[#4f46e5]'>
              {money(availableWithdraw)}
            </div>
          </div>
          <div className='grid gap-3'>
            <button
              className='infistar-btn-primary h-11 rounded-xl text-sm font-bold'
              type='button'
              disabled={restricted}
              onClick={() => setWithdrawModalVisible(true)}
            >
              申请提现
            </button>
            <button
              className='partner-action h-11 rounded-xl text-sm font-bold'
              type='button'
              onClick={() => setPayoutModalVisible(true)}
            >
              查看收款信息
            </button>
          </div>
        </div>
      </Panel>
      <Panel>
        <PanelTitle title='月度分佣记录' />
        <StatementTable rows={statements} />
      </Panel>
      <Panel>
        <PanelTitle title='提现记录' />
        <WithdrawalTable rows={withdrawals} />
      </Panel>
    </div>
  );

  const renderRules = () => (
    <div className='grid gap-5'>
      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
        {[
          ['推荐关系', '链接、口令、二维码统一绑定到你的推广账户。', 'link', 'blue'],
          ['有效 GMV', '扣除退款和不参与分佣项目后进入统计。', 'chart', 'purple'],
          ['月度分佣', '系统按月生成记录，最终以月度结算为准。', 'calendar', 'cyan'],
          ['提现申请', '有可提现分佣时，可提交申请并查看进度。', 'wallet', 'amber'],
        ].map(([title, detail, icon, color]) => (
          <UseCaseCard key={title} color={color} icon={icon} title={title} detail={detail} />
        ))}
      </div>
      <Panel>
        <PanelHeader
          title='分佣梯度'
          hint='按当月有效 GMV 分段累进计算，不是全额统一套用最高比例。'
          right={
            <span className='rounded-full bg-indigo-50 px-4 py-2 text-xs font-black text-indigo-600'>
              分段计佣
            </span>
          }
        />
        <TierVisual tiers={commissionTiers} />
      </Panel>
      <Panel>
        <PanelTitle
          title='常见问题'
          hint='关于推荐关系、分佣统计和提现规则的高频说明。'
        />
        <div className='partner-faq-list'>
          {[
            [
              '分佣是按整月 GMV 的最高档统一计算吗？',
              '不是。分佣按区间分段累进计算，每一段金额只适用当前区间对应比例，最终分佣以月度结算记录为准。',
            ],
            [
              '哪些充值会计入有效 GMV？',
              '通过你的推荐链接、推荐口令或二维码注册并完成的有效充值会进入统计；退款、异常订单和不参与分佣的项目不会计入。',
            ],
            [
              '推荐链接、口令和二维码会分别统计吗？',
              '是。同一个推广账户下的链接、口令和二维码会统一归因，用户通过任一入口注册后都会绑定到同一个推荐关系。',
            ],
            [
              '分佣什么时候可以提现？',
              '系统按月生成分佣记录。记录进入可提现状态后，可以在分佣提现页面提交提现申请并查看处理进度。',
            ],
            [
              '修改推荐链接或口令会影响老用户吗？',
              '不会影响已经绑定的推荐关系。修改后新链接或新口令生效，旧链接或旧口令将不再用于新的推荐绑定。',
            ],
          ].map(([title, detail]) => (
            <details key={title} className='partner-faq-item'>
              <summary className='partner-faq-question'>
                {title}
                <span className='partner-faq-toggle' aria-hidden='true' />
              </summary>
              <div className='partner-faq-answer'>{detail}</div>
            </details>
          ))}
        </div>
      </Panel>
    </div>
  );

  const renderCenter = () => (
    <div id='partner-dashboard' className='mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6'>
      <header className='partner-card rounded-[24px] px-6 py-6 lg:px-8'>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div>
            <h1 className='text-3xl font-black leading-tight text-slate-950'>
              我的联运后台
            </h1>
            <p className='mt-2 max-w-2xl text-sm leading-6 text-slate-500'>
              推荐链接已生效，数据每日更新，最终结算以月度分佣为准。
            </p>
          </div>
          <span className='partner-status-badge'>
            {statusLabel(promoterStatus)}
          </span>
        </div>
      </header>
      <TabNav activeTab={activeTab} setActiveTab={setActiveTab} />
      <section className='mt-5'>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'tools' && renderTools()}
        {activeTab === 'data' && renderData()}
        {activeTab === 'withdrawals' && renderWithdrawals()}
        {activeTab === 'rules' && renderRules()}
      </section>
      <PartnerFooter />
    </div>
  );

  if (loading) {
    return (
      <div className='flex min-h-[60vh] items-center justify-center'>
        <Spin size='large' />
      </div>
    );
  }

  return (
    <main className='promoter-page header-offset-top header-offset-min-height overflow-x-hidden bg-[#f8fafc] text-slate-950'>
      <style>{promoterStyles}</style>
      <div className='header-offset-min-height partner-dashboard-surface'>
        {maintenance ? (
          <MaintenanceState onRetry={fetchPromoterState} />
        ) : shouldShowDashboard ? (
          renderCenter()
        ) : (
          <Landing loading={opening} onOpen={openPromoter} />
        )}
      </div>
      <Modal
        title={credentialModal === 'phrase' ? '修改推荐口令' : '修改推荐链接'}
        visible={Boolean(credentialModal)}
        onCancel={() => setCredentialModal(null)}
        onOk={saveCredential}
        okText='确认修改'
        cancelText='取消'
      >
        <p className='mb-4 text-sm leading-6 text-slate-500'>
          {credentialModal === 'code'
            ? '这里只修改链接最后的专属后缀，修改后旧推广链接将不再可用。'
            : '修改后，旧推荐口令将不再可用。'}
          今年还可修改 {remainingChanges} 次。
        </p>
        <Input
          value={credentialDraft}
          maxLength={64}
          onChange={setCredentialDraft}
        />
      </Modal>
      {payoutModalVisible ? (
        <PayoutProfileDialog
          draft={payoutDraft}
          onClose={() => setPayoutModalVisible(false)}
          onSave={savePayoutProfile}
          setDraft={setPayoutDraft}
        />
      ) : null}
      {withdrawModalVisible ? (
        <WithdrawalDialog
          amount={withdrawAmount}
          available={availableWithdraw}
          note={withdrawNote}
          payoutDraft={payoutDraft}
          onClose={() => setWithdrawModalVisible(false)}
          onSubmit={createWithdrawal}
          setAmount={setWithdrawAmount}
          setNote={setWithdrawNote}
        />
      ) : null}
    </main>
  );
};

function PartnerModalFrame({ children, maxWidth = '448px', onClose }) {
  return (
    <div className='partner-modal-backdrop' role='dialog' aria-modal='true'>
      <button
        className='partner-modal-backdrop-button'
        type='button'
        aria-label='关闭弹框'
        onClick={onClose}
      />
      <div className='partner-modal-window' style={{ maxWidth }}>
        {children}
      </div>
    </div>
  );
}

function WithdrawalDialog({
  amount,
  available,
  payoutDraft,
  onClose,
  onSubmit,
  setAmount,
}) {
  return (
    <PartnerModalFrame onClose={onClose}>
      <section className='partner-modal-shell'>
        <div className='partner-modal-head'>
          <div>
            <h2 className='partner-modal-title'>申请提现</h2>
            <p className='partner-modal-desc'>
              可提现分佣 {money(available)}，可全部或部分提现。
            </p>
          </div>
          <button
            className='partner-modal-close'
            type='button'
            aria-label='关闭申请提现弹框'
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className='partner-modal-form'>
          <label className='partner-receipt-field'>
            <span className='partner-receipt-label'>提现金额</span>
            <input
              className='partner-receipt-input'
              inputMode='decimal'
              min='1'
              max={available}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          <div className='partner-modal-summary'>
            收款账户：{formatPayoutSummary(payoutDraft)}
          </div>
        </div>
        <div className='partner-modal-footer'>
          <button
            className='partner-action h-10 rounded-xl px-4 text-sm font-bold'
            type='button'
            onClick={onClose}
          >
            取消
          </button>
          <button
            className='infistar-btn-primary h-10 min-w-0 rounded-xl px-5 text-sm font-bold'
            type='button'
            onClick={onSubmit}
          >
            提交申请
          </button>
        </div>
      </section>
    </PartnerModalFrame>
  );
}

function PayoutProfileDialog({ draft, onClose, onSave, setDraft }) {
  const updateDraft = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };
  return (
    <PartnerModalFrame maxWidth='680px' onClose={onClose}>
      <section className='partner-receipt-shell'>
        <div className='partner-receipt-head'>
          <div className='partner-receipt-title-wrap'>
            <span className='partner-receipt-icon' aria-hidden='true'>
              <IconGlyph icon='wallet' small />
            </span>
            <div>
              <h2 className='partner-receipt-title'>收款信息</h2>
              <p className='partner-receipt-desc'>
                用于分佣提现打款，信息可随时修改后保存。
              </p>
            </div>
          </div>
          <button
            className='partner-receipt-close'
            type='button'
            aria-label='关闭收款信息弹框'
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className='partner-receipt-form'>
          {[
            ['identity_name', '真实姓名', '请输入真实姓名', false],
            ['identity_no', '身份证号码', '请输入身份证号码', false],
            ['bank_account_no', '收款账号', '请输入银行卡号或收款账号', true],
            ['bank_name', '开户银行', '例如：中国工商银行', false],
            ['bank_branch', '开户支行', '请输入开户支行', false],
          ].map(([key, label, placeholder, wide]) => (
            <label
              key={key}
              className={`partner-receipt-field ${wide ? 'is-wide' : ''}`}
            >
              <span className='partner-receipt-label'>{label}</span>
              <input
                className='partner-receipt-input'
                placeholder={placeholder}
                value={draft[key] || ''}
                onChange={(event) => updateDraft(key, event.target.value)}
              />
            </label>
          ))}
        </div>
        <div className='partner-receipt-footer'>
          <button
            className='partner-action h-11 rounded-xl px-5 text-sm font-bold'
            type='button'
            onClick={onClose}
          >
            关闭
          </button>
          <button
            className='infistar-btn-primary h-11 min-w-0 rounded-xl px-6 text-sm font-bold'
            type='button'
            onClick={onSave}
          >
            保存收款信息
          </button>
        </div>
      </section>
    </PartnerModalFrame>
  );
}

function formatPayoutSummary(draft) {
  const identityName = String(draft.identity_name || '').trim();
  const bankName = String(draft.bank_name || '').trim();
  const accountNo = String(draft.bank_account_no || '').replace(/\s+/g, '');
  if (!identityName && !bankName && !accountNo) {
    return '请先填写收款信息后再提交提现。';
  }
  const accountLabel = accountNo
    ? `尾号 ${accountNo.slice(-4)}`
    : '未填写账号';
  return [identityName || '未填写姓名', bankName || '未填写银行', accountLabel].join(' · ');
}

function PartnerFooter() {
  return (
    <footer className='partner-footer'>
      <div>
        <img
          className='partner-footer-logo'
          src='/header-logo.svg'
          alt='无限星河'
        />
        <p className='partner-footer-desc'>
          让顶尖 AI 模型，以更透明、可信、低成本的方式服务每一位 AI 用户。
        </p>
        <p className='partner-footer-copy'>
          © {new Date().getFullYear()} Infistar. All rights reserved.
        </p>
      </div>
      <div>
        <h4 className='partner-footer-title'>产品与文档</h4>
        <div className='partner-footer-links'>
          <a href='/pricing'>模型覆盖矩阵</a>
          <a href='https://doc.infistar.ai/' target='_blank' rel='noopener noreferrer'>
            文档
          </a>
        </div>
      </div>
    </footer>
  );
}

function Landing({ loading, onOpen }) {
  const steps = [
    ['开通推广账户', '点击开启后进入推广中心，系统会为你生成推荐链接、推荐口令和专属二维码。', 'bolt', '01'],
    ['分享推广入口', '链接适合文章和社群，口令适合私聊和线下转述，二维码适合海报、资料包和公告。', 'share', '02'],
    ['查看分佣提现', '查看推广用户、有效 GMV、结算记录和提现状态，分佣可提现后直接申请。', 'wallet', '03'],
  ];
  const benefits = [
    ['入口统一归因', '链接、口令、二维码绑定同一个推广账户，用户从任一入口注册都能追踪。', 'link', 'blue'],
    ['数据集中查看', '新增用户、有效 GMV、预估分佣和结算记录，都在后台集中展示。', 'chart', 'purple'],
    ['分佣提现闭环', '月度结算后进入可提现分佣，规则说明和处理状态都可查看。', 'wallet', 'amber'],
  ];
  const scenarios = [
    ['社群运营者', '适合 AI 社群、知识星球和客户群，在公告或资料包中放置专属入口。', 'userPlus', 'cyan'],
    ['内容创作者', '适合教程、测评和工具清单内容，在文章或视频简介中放入链接。', 'message', 'purple'],
    ['服务商与团队', '适合培训、代运营和企业服务团队，推荐客户后自动记录后续充值。', 'qr', 'blue'],
  ];

  return (
    <>
      <div id='partner-entry' className='mx-auto max-w-7xl px-4 pb-48 pt-10 sm:px-6 lg:pt-12'>
        <section className='grid items-stretch gap-8 lg:grid-cols-[minmax(0,1.05fr)_500px]'>
          <div className='py-6'>
            <div className='inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white px-5 py-2 text-sm font-bold text-[#4f46e5] shadow-sm'>
              <span className='h-2.5 w-2.5 rounded-full bg-[#6366f1]' />
              无限星河联运推广计划
            </div>
            <h1 className='mt-6 max-w-[760px] text-[38px] font-black leading-[1.1] tracking-normal text-slate-950 sm:text-[50px] lg:text-[56px]'>
              <span className='bg-gradient-to-r from-[#4f46e5] to-[#06b6d4] bg-clip-text text-transparent'>
                推荐Infistar
              </span>
              <span className='block'>持续获得合作分佣</span>
            </h1>
            <p className='mt-5 max-w-[690px] text-base font-semibold leading-8 text-slate-500'>
              如果你认可 Infistar，可以把它分享给社群、客户或内容受众。用户通过你的专属入口完成注册并产生有效充值后，系统会按规则记录分佣。
            </p>
            <div className='mt-6 flex flex-wrap items-center gap-4'>
              <button
                className='infistar-btn-primary h-14 rounded-2xl px-9 text-base'
                type='button'
                onClick={onOpen}
                disabled={loading}
              >
                {loading ? '开通中...' : '开启联运推广'}
              </button>
            </div>
          </div>
          <aside className='partner-entry-hero-card grid gap-4 rounded-[24px] bg-white/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_18px_46px_-36px_rgba(79,70,229,0.28)] backdrop-blur'>
            <div className='flex items-start justify-between gap-4'>
              <div>
                <p className='text-sm font-black text-[#4f46e5]'>推广中心预览</p>
                <h2 className='mt-2 text-2xl font-black leading-8 text-slate-950'>
                  开通后直接获得专属推广入口
                </h2>
              </div>
              <span className='shrink-0 rounded-full bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-600'>
                可开通
              </span>
            </div>
            <div className='grid items-stretch gap-3 sm:grid-cols-[minmax(0,1fr)_164px]'>
              <div className='grid gap-3'>
                <LandingPreviewLine icon='link' label='推荐链接' value='https://infistar.ai/register?aff=MLTHPUZ2&ref_source=link' />
                <LandingPreviewLine icon='message' label='推荐口令' value='AI星推计划' />
                <LandingPreviewLine icon='chart' label='结算口径' value='用户有效充值即可累计合作 GMV，按月生成分佣回报' wrap />
              </div>
              <div className='partner-entry-qr-card grid justify-items-center rounded-[20px] bg-white/90 p-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_14px_28px_-24px_rgba(79,70,229,0.36)]'>
                <QrPreview value='https://infistar.ai/register?aff=MLTHPUZ2&ref_source=qr' compact />
                <div className='mt-3 text-xs font-black text-slate-500'>推广二维码</div>
                <div className='mt-1 text-sm font-black text-slate-950'>扫码注册自动绑定</div>
              </div>
            </div>
            <div className='grid gap-3 sm:grid-cols-3'>
              <LandingPreviewStat label='本月有效 GMV' value='126800.00' />
              <LandingPreviewStat label='预估分佣' value='15216.00' />
              <LandingPreviewStat label='可提现分佣' value='22356.00' />
            </div>
          </aside>
        </section>

        <section className='partner-entry-section-card mt-12 rounded-[24px] bg-white/95 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_28px_72px_-44px_rgba(79,70,229,0.38)] lg:p-7'>
          <SectionIntro title='三步开始联运' detail='不需要自己搭建系统，开通后就在推广中心管理入口、查看数据和处理分佣提现。' />
          <div className='mt-6 grid gap-4 lg:grid-cols-3'>
            {steps.map(([title, detail, icon, step]) => (
              <LandingStepCard key={title} detail={detail} icon={icon} step={step} title={title} />
            ))}
          </div>
        </section>

        <section className='partner-entry-section-card mt-12 rounded-[24px] bg-white/95 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_28px_72px_-44px_rgba(79,70,229,0.38)] lg:p-7'>
          <SectionIntro title='推广权益与适用场景' detail='把推广入口、数据追踪和分佣结算收在一套后台里，页面信息更聚焦，开通后直接使用。' />
          <div className='mt-6 grid gap-4 lg:grid-cols-3'>
            {benefits.map(([title, detail, icon, color]) => (
              <LandingFeatureCard key={title} color={color} detail={detail} icon={icon} title={title} />
            ))}
          </div>
          <div className='mt-4 grid gap-4 lg:grid-cols-3'>
            {scenarios.map(([title, detail, icon, color]) => (
              <LandingScenarioCard key={title} color={color} detail={detail} icon={icon} title={title} />
            ))}
          </div>
        </section>
      </div>
      <div className='fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/90 bg-white/95 shadow-[0_-18px_48px_-30px_rgba(79,70,229,0.35)] backdrop-blur'>
        <div className='mx-auto grid max-w-7xl items-center gap-4 px-4 py-6 sm:px-6 lg:min-h-[112px] lg:grid-cols-[1fr_180px] lg:py-7'>
          <div>
            <strong className='block text-base font-black text-slate-800'>
              准备好开始联运推广了吗
            </strong>
            <span className='text-sm leading-6 text-slate-500'>
              开启后进入推广中心，复制推荐链接、口令和二维码，并查看推广数据。
            </span>
          </div>
          <button
            className='infistar-btn-primary w-full'
            type='button'
            onClick={onOpen}
            disabled={loading}
          >
            {loading ? '开通中...' : '开启联运推广'}
          </button>
        </div>
      </div>
    </>
  );
}

function SectionIntro({ title, detail }) {
  return (
    <div>
      <h2 className='text-3xl font-black leading-tight text-slate-950'>{title}</h2>
      <p className='mt-2 max-w-3xl text-sm font-semibold leading-7 text-slate-500'>{detail}</p>
    </div>
  );
}

function LandingPreviewLine({ icon, label, value, wrap }) {
  return (
    <div className='partner-entry-preview-card grid min-w-0 grid-cols-[42px_minmax(0,1fr)] items-center gap-3 rounded-[18px] bg-white/90 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_14px_28px_-24px_rgba(79,70,229,0.28)]'>
      <MiniIconBubble color='blue' icon={icon} />
      <div className='min-w-0'>
        <div className='text-xs font-black text-slate-500'>{label}</div>
        <div className={`mt-1 text-sm font-black leading-6 text-slate-950 ${wrap ? 'break-words' : 'truncate'}`}>{value}</div>
      </div>
    </div>
  );
}

function LandingPreviewStat({ label, value }) {
  return (
    <div className='partner-entry-preview-stat min-w-0 rounded-[18px] bg-white/75 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]'>
      <span className='block whitespace-nowrap text-xs font-black text-slate-500'>{label}</span>
      <strong className='mt-1 block whitespace-nowrap text-base font-black text-[#4f46e5]'>{value}</strong>
    </div>
  );
}

function LandingStepCard({ detail, icon, step, title }) {
  return (
    <article className='partner-entry-step relative grid min-h-[146px] grid-cols-[54px_minmax(0,1fr)] gap-x-4 overflow-hidden rounded-[20px] bg-[#f8faff]/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_18px_44px_-36px_rgba(79,70,229,0.28)]'>
      <span className='absolute right-5 top-3 text-[64px] font-black leading-none text-[#4f46e5]/10'>{step}</span>
      <MiniIconBubble color='purple' icon={icon} />
      <div className='relative min-w-0 pr-12'>
        <h3 className='text-xl font-black leading-7 text-slate-950'>{title}</h3>
        <p className='mt-2 text-sm font-semibold leading-6 text-slate-500'>{detail}</p>
      </div>
    </article>
  );
}

function TabNav({ activeTab, setActiveTab }) {
  return (
    <nav
      className='mt-5 overflow-x-auto rounded-2xl'
      aria-label='推广中心导航'
    >
      <div className='partner-tab-list'>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`partner-tab ${activeTab === tab.key ? 'is-active' : ''}`}
            type='button'
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

function Panel({ children, className = '' }) {
  return (
    <div
      className={`partner-card rounded-[24px] p-6 ${className}`}
    >
      {children}
    </div>
  );
}
function PanelTitle({ title, hint }) {
  return (
    <div>
      <div className='text-xl font-black text-slate-950'>{title}</div>
      {hint ? (
        <div className='mt-2 text-sm leading-6 text-slate-500'>{hint}</div>
      ) : null}
    </div>
  );
}
function PanelHeader({ title, hint, right }) {
  return (
    <div className={`flex flex-wrap ${hint ? 'items-start' : 'items-center'} justify-between gap-3`}>
      <PanelTitle title={title} hint={hint} />
      {right}
    </div>
  );
}
function TableWrap({ children }) {
  return (
    <div className='partner-commission-table mt-5 overflow-x-auto'>
      {children}
    </div>
  );
}

function PartnerListTable({
  columns,
  emptyTitle,
  getRowKey,
  minWidth = 760,
  rows,
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));

  useEffect(() => {
    setPage((current) => Math.min(Math.max(1, current), totalPages));
  }, [totalPages]);

  const start = (page - 1) * pageSize;
  const visibleRows = rows.slice(start, start + pageSize);

  return (
    <>
      <TableWrap>
        <table className='portal-table' style={{ minWidth }}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length ? (
              visibleRows.map((row, index) => (
                <tr key={getRowKey(row, start + index)}>
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={[
                        column.primary ? 'partner-table-primary' : '',
                        column.strong ? 'partner-table-strong' : '',
                        column.money ? 'partner-table-money' : '',
                        column.negative ? 'partner-table-negative' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length}>
                  <div className='partner-table-empty'>{emptyTitle}</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableWrap>
      <PartnerListPagination
        page={page}
        pageSize={pageSize}
        setPage={setPage}
        setPageSize={(nextSize) => {
          setPageSize(nextSize);
          setPage(1);
        }}
        total={rows.length}
      />
    </>
  );
}

function PartnerListPagination({ page, pageSize, setPage, setPageSize, total }) {
  const [open, setOpen] = useState(false);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, total);
  const pageSizeOptions = [10, 20, 50];

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('click', close);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div className={`partner-list-pagination ${open ? 'is-open' : ''}`}>
      <div className='partner-page-meta'>
        <span>
          共 {total} 条记录，当前显示 {start}-{end} 条
        </span>
        <div className='partner-page-size'>
          <span>每页显示</span>
          <div className='partner-page-select'>
            <button
              aria-expanded={open}
              aria-haspopup='listbox'
              className='partner-page-select-trigger'
              type='button'
              onClick={(event) => {
                event.stopPropagation();
                setOpen((value) => !value);
              }}
            >
              <span>{pageSize} 条/页</span>
            </button>
            <div
              className='partner-page-select-menu'
              hidden={!open}
              role='listbox'
              onClick={(event) => event.stopPropagation()}
            >
              {pageSizeOptions.map((option) => (
                <button
                  key={option}
                  aria-selected={pageSize === option}
                  className={`partner-page-select-option ${pageSize === option ? 'is-active' : ''}`}
                  role='option'
                  type='button'
                  onClick={() => {
                    setPageSize(option);
                    setOpen(false);
                    Toast.success(`每页显示 ${option} 条`);
                  }}
                >
                  {option} 条/页
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className='partner-page-controls' aria-label='列表分页'>
        <button
          className={`partner-page-button ${page <= 1 ? 'is-disabled' : ''}`}
          disabled={page <= 1}
          type='button'
          onClick={() => setPage(Math.max(1, page - 1))}
        >
          上一页
        </button>
        {Array.from({ length: totalPages }, (_, index) => index + 1).map(
          (item) => (
            <button
              key={item}
              className={`partner-page-button ${page === item ? 'is-active' : ''}`}
              type='button'
              onClick={() => setPage(item)}
            >
              {item}
            </button>
          ),
        )}
        <button
          className={`partner-page-button ${page >= totalPages ? 'is-disabled' : ''}`}
          disabled={page >= totalPages}
          type='button'
          onClick={() => setPage(Math.min(totalPages, page + 1))}
        >
          下一页
        </button>
      </div>
    </div>
  );
}

function SummaryStatCard({ color, icon, label, value }) {
  return (
    <article className='partner-overview-stat'>
      <IconBubble color={color} icon={icon} />
      <div>
        <div className='partner-overview-stat-label'>{label}</div>
        <div className='partner-overview-stat-value'>{value}</div>
      </div>
    </article>
  );
}
function InfoBox({ title, value, detail, color }) {
  return (
    <Panel>
      <div className='text-xs font-extrabold text-slate-500'>{title}</div>
      <div className={`mt-2 text-2xl font-black ${textColor(color)}`}>
        {value}
      </div>
      {detail ? (
        <div className='mt-2 text-sm leading-6 text-slate-500'>{detail}</div>
      ) : null}
    </Panel>
  );
}
function PreviewToolLine({ icon, label, value, action = '复制', onClick }) {
  return (
    <div className='partner-preview-row'>
      <MiniIconBubble color='blue' icon={icon} />
      <span className='text-sm font-black text-slate-950'>{label}</span>
      <span className='partner-preview-value'>
        {value || '-'}
      </span>
      <button className='partner-action' type='button' onClick={onClick}>
        {action}
      </button>
    </div>
  );
}
function ToolInfoRow({ icon, label, value, primaryAction, secondaryAction }) {
  return (
    <div className='partner-tool-row'>
      <div className='partner-tool-label'>
        <span className='partner-tool-label-icon'>
          <IconGlyph icon={icon} small />
        </span>
        {label}
      </div>
      <div className='partner-tool-value'>
        {value || '-'}
      </div>
      <div className='partner-tool-actions'>
        {secondaryAction}
        {primaryAction}
      </div>
    </div>
  );
}

function SegmentedRange({ value, onChange }) {
  return (
    <div className='flex rounded-lg border border-slate-200 bg-slate-50 p-1'>
      {rangeOptions.map((option) => (
        <button
          key={option.key}
          className={`rounded-md px-3 py-1.5 text-xs font-extrabold transition ${value === option.key ? 'bg-white text-[#2f62ff] shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
          type='button'
          onClick={() => onChange(option.key)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
function ReadonlyField({ label, value }) {
  return (
    <div className='rounded-lg border border-slate-200 bg-white px-3 py-3'>
      <div className='text-xs text-slate-500'>{label}</div>
      <div className='mt-1 break-all text-sm font-black text-slate-950'>
        {value}
      </div>
    </div>
  );
}
function RuleCard({ title, detail }) {
  return (
    <div className='rounded-lg border border-slate-200 bg-slate-50 px-4 py-4'>
      <div className='text-sm font-black text-slate-950'>{title}</div>
      <div className='mt-2 text-sm leading-6 text-slate-600'>{detail}</div>
    </div>
  );
}

function UserTable({ rows }) {
  return (
    <PartnerListTable
      columns={[
        {
          key: 'maskedId',
          label: '用户 ID',
          render: (item) => rowValue(item, ['masked_id', 'maskedId']),
          primary: true,
        },
        {
          key: 'source',
          label: '绑定方式',
          render: (item) => rowValue(item, ['source', 'attribution_source']),
        },
        {
          key: 'lockedAt',
          label: '绑定时间',
          render: (item) =>
            formatDateTime(rowValue(item, ['locked_at', 'lockedAt'])),
        },
        {
          key: 'firstCharge',
          label: '首充状态',
          render: (item) => (
            <StatusBadge
              status={rowValue(
                item,
                ['first_charge', 'firstCharge'],
                '未首充',
              )}
            />
          ),
        },
        {
          key: 'status',
          label: '用户状态',
          render: (item) => (
            <StatusBadge
              status={rowValue(item, ['status', 'user_status'], '正常')}
            />
          ),
        },
      ]}
      emptyTitle='还没有推广用户'
      getRowKey={(item) => String(rowValue(item, ['masked_id', 'maskedId'], 'row'))}
      minWidth={820}
      rows={rows}
    />
  );
}

function TopupTable({ rows, compact = false }) {
  const columns = compact
    ? [
        {
          key: 'date',
          label: '日期',
          render: (item) => formatDateTime(rowValue(item, ['date'])),
        },
        { key: 'type', label: '记录', render: (item) => rowValue(item, ['type']) },
        {
          key: 'user',
          label: '用户 ID',
          render: (item) => rowValue(item, ['masked_user_id', 'maskedUserId']),
          primary: true,
        },
        {
          key: 'amount',
          label: '金额',
          render: (item) =>
            money(rowValue(item, ['effective_gmv', 'effectiveGmv'], 0)),
          strong: true,
        },
        {
          key: 'status',
          label: '状态',
          render: (item) => (
            <StatusBadge status={rowValue(item, ['status'], '统计中')} />
          ),
        },
      ]
    : [
        {
          key: 'date',
          label: '日期',
          render: (item) => formatDateTime(rowValue(item, ['date'])),
        },
        {
          key: 'flow',
          label: '流水编号',
          render: (item) => rowValue(item, ['masked_flow_no', 'maskedFlowNo']),
          primary: true,
        },
        {
          key: 'user',
          label: '用户 ID',
          render: (item) => rowValue(item, ['masked_user_id', 'maskedUserId']),
        },
        { key: 'type', label: '类型', render: (item) => rowValue(item, ['type']) },
        {
          key: 'gmv',
          label: '单笔有效 GMV',
          render: (item) =>
            money(rowValue(item, ['effective_gmv', 'effectiveGmv'], 0)),
          strong: true,
        },
        {
          key: 'commission',
          label: '预估分佣',
          render: (item) =>
            money(rowValue(item, ['commission_amount', 'commissionAmount'], 0)),
          money: true,
        },
        { key: 'impact', label: '分佣影响', render: (item) => rowValue(item, ['impact']) },
        {
          key: 'status',
          label: '状态',
          render: (item) => (
            <StatusBadge status={rowValue(item, ['status'], '统计中')} />
          ),
        },
      ];
  return (
    <PartnerListTable
      columns={columns}
      emptyTitle='当前时间范围内没有充值流水'
      getRowKey={(item) =>
        String(rowValue(item, ['id', 'masked_flow_no', 'maskedFlowNo'], 'row'))
      }
      minWidth={compact ? 720 : 920}
      rows={rows}
    />
  );
}

function StatementTable({ rows }) {
  return (
    <PartnerListTable
      columns={[
        { key: 'month', label: '月份', render: (item) => rowValue(item, ['month']), primary: true },
        {
          key: 'gmv',
          label: '有效 GMV',
          render: (item) => money(rowValue(item, ['effective_gmv', 'effectiveGmv'], 0)),
        },
        { key: 'ratio', label: '返佣比例', render: (item) => rowValue(item, ['ratio']) },
        {
          key: 'expected',
          label: '应结佣金',
          render: (item) =>
            money(rowValue(item, ['expected_commission', 'expectedCommission'], 0)),
        },
        {
          key: 'adjustment',
          label: '扣回调整',
          render: (item) => money(rowValue(item, ['adjustment', 'adjustment_amount'], 0)),
          negative: true,
        },
        {
          key: 'settled',
          label: '实结佣金',
          render: (item) =>
            money(rowValue(item, ['settled_commission', 'settledCommission'], 0)),
          money: true,
        },
        {
          key: 'status',
          label: '状态',
          render: (item) => <StatusBadge status={rowValue(item, ['status'], '待确认')} />,
        },
        {
          key: 'payableAt',
          label: '预计可提现时间',
          render: (item) => rowValue(item, ['payable_at', 'payableAt']),
        },
      ]}
      emptyTitle='暂无月度分佣记录'
      getRowKey={(item) => String(rowValue(item, ['month'], 'row'))}
      minWidth={860}
      rows={rows}
    />
  );
}
function WithdrawalTable({ rows }) {
  return (
    <PartnerListTable
      columns={[
        { key: 'id', label: '提现单号', render: (item) => rowValue(item, ['id']), primary: true },
        {
          key: 'appliedAt',
          label: '申请时间',
          render: (item) => formatDateTime(rowValue(item, ['applied_at', 'appliedAt'])),
        },
        {
          key: 'amount',
          label: '提现金额',
          render: (item) => money(rowValue(item, ['amount'], 0)),
          strong: true,
        },
        {
          key: 'status',
          label: '状态',
          render: (item) => <StatusBadge status={rowValue(item, ['status'], '处理中')} />,
        },
        {
          key: 'handledAt',
          label: '处理时间',
          render: (item) => formatDateTime(rowValue(item, ['handled_at', 'handledAt'])),
        },
        { key: 'note', label: '备注', render: (item) => rowValue(item, ['note']) },
      ]}
      emptyTitle='暂无提现记录'
      getRowKey={(item) => String(rowValue(item, ['id'], 'row'))}
      minWidth={760}
      rows={rows}
    />
  );
}
function CredentialChangeTable({ rows }) {
  return (
    <PartnerListTable
      columns={[
        {
          key: 'changedAt',
          label: '变更时间',
          render: (item) =>
            formatDateTime(rowValue(item, ['changed_at', 'changedAt', 'time'])),
          primary: true,
        },
        {
          key: 'type',
          label: '类型',
          render: (item) => rowValue(item, ['type', 'credential_type', 'credentialType']),
        },
        { key: 'oldValue', label: '旧值', render: (item) => rowValue(item, ['old_value', 'oldValue']) },
        { key: 'newValue', label: '新值', render: (item) => rowValue(item, ['new_value', 'newValue']) },
        {
          key: 'status',
          label: '状态',
          render: (item) => <StatusBadge status={rowValue(item, ['status'], '生效中')} />,
        },
      ]}
      emptyTitle='暂无推荐信息变更记录'
      getRowKey={(item) =>
        String(rowValue(item, ['id', 'changed_at', 'changedAt'], 'row'))
      }
      minWidth={760}
      rows={rows}
    />
  );
}

function TrendBars({ rows }) {
  const trendRows = buildMonthTrendWeeks(rows);
  const trendPeriod = currentMonthLabel();
  const totalGmv = trendRows.reduce((sum, item) => sum + item.gmv, 0);
  const totalCommission = trendRows.reduce((sum, item) => sum + item.commission, 0);
  const axisMax = trendAxisMax(trendRows);
  const axisValues = [axisMax, (axisMax * 2) / 3, axisMax / 3, 0];
  const width = Math.max(920, 170 + trendRows.length * 170);
  const height = 320;
  const plotLeft = 92;
  const plotRight = width - 88;
  const plotTop = 48;
  const plotBottom = 228;
  const groupWidth = (plotRight - plotLeft) / Math.max(1, trendRows.length);
  const barWidth = 28;
  const barGap = 8;
  const hoverWidth = Math.min(138, groupWidth * 0.78);
  const yOf = (value) =>
    plotBottom - (Math.min(value, axisMax) / axisMax) * (plotBottom - plotTop);
  const hasData = trendRows.some((item) => item.gmv > 0 || item.commission > 0);
  const summary = (
    <div className='partner-trend-summary'>
      <div className='partner-trend-summary-item'>
        <div className='partner-trend-summary-label'>周期</div>
        <div className='partner-trend-summary-value'>{trendPeriod}</div>
      </div>
      <div className='partner-trend-summary-item'>
        <div className='partner-trend-summary-label'>本月合计</div>
        <div className='partner-trend-summary-value'>
          <span>有效 GMV {money(totalGmv)}</span>
          <span className='partner-trend-summary-sub'>预估分佣 {money(totalCommission)}</span>
        </div>
      </div>
    </div>
  );
  return (
    <div>
      {summary}
      <div className='partner-trend-chart-card'>
        <div className='partner-trend-legend'>
          <span className='partner-trend-legend-item'>
            <i className='partner-trend-legend-dot' />
            有效 GMV
          </span>
          <span className='partner-trend-legend-item'>
            <i className='partner-trend-legend-dot is-line' />
            预估分佣
          </span>
        </div>
        <div className='partner-trend-svg-wrap'>
          <svg
            className='partner-trend-svg'
            viewBox={`0 0 ${width} ${height}`}
            role='img'
            aria-label='本月有效 GMV 与预估分佣对比图'
          >
            <defs>
              <linearGradient id='partnerTrendBarGradient' x1='0' x2='0' y1='0' y2='1'>
                <stop offset='0%' stopColor='#4F46E5' />
                <stop offset='100%' stopColor='#60A5FA' />
              </linearGradient>
              <linearGradient id='partnerTrendCommissionGradient' x1='0' x2='0' y1='0' y2='1'>
                <stop offset='0%' stopColor='#06B6D4' />
                <stop offset='100%' stopColor='#A5F3FC' />
              </linearGradient>
            </defs>
            {axisValues.map((value) => {
              const y = yOf(value);
              return (
                <React.Fragment key={value}>
                  <line
                    className='partner-trend-grid'
                    x1={plotLeft}
                    x2={plotRight}
                    y1={y}
                    y2={y}
                  />
                  <text
                    className='partner-trend-axis-text'
                    x={value === 0 ? 26 : 8}
                    y={y + 4}
                  >
                    {compactMoney(value)}
                  </text>
                </React.Fragment>
              );
            })}
            {trendRows.map((item, index) => {
              const center = plotLeft + groupWidth * (index + 0.5);
              const rawGmvHeight = plotBottom - yOf(item.gmv);
              const rawCommissionHeight = plotBottom - yOf(item.commission);
              const gmvHeight = item.gmv > 0 ? Math.max(8, rawGmvHeight) : 6;
              const commissionHeight =
                item.commission > 0 ? Math.max(8, rawCommissionHeight) : 6;
              const gmvY = item.gmv > 0 ? plotBottom - gmvHeight : plotBottom - 6;
              const commissionY =
                item.commission > 0 ? plotBottom - commissionHeight : plotBottom - 6;
              const gmvX = center - barWidth - barGap / 2;
              const commissionX = center + barGap / 2;
              return (
                <g
                  key={item.label}
                  className='partner-trend-item'
                  tabIndex='0'
                  aria-label={`${item.aria}，有效 GMV ${item.gmv.toFixed(2)} 元，预估分佣 ${item.commission.toFixed(2)} 元`}
                >
                  <title>
                    {item.label}：有效 GMV {money(item.gmv)}，预估分佣 {money(item.commission)}
                  </title>
                  <rect
                    className='partner-trend-hover-zone'
                    x={center - hoverWidth / 2}
                    y={40}
                    width={hoverWidth}
                    height={205}
                    rx={18}
                  />
                  <rect
                    className='partner-trend-gmv-bar'
                    x={gmvX}
                    y={gmvY}
                    width={barWidth}
                    height={gmvHeight}
                  />
                  <rect
                    className='partner-trend-commission-bar'
                    x={commissionX}
                    y={commissionY}
                    width={barWidth}
                    height={commissionHeight}
                  />
                  <text className='partner-trend-label' x={center} y={272} textAnchor='middle'>
                    {item.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        {!hasData ? (
          <div className='partner-trend-empty-note'>
            暂无本月有效充值数据，当前按周展示 0 值；产生有效 GMV 后会自动更新柱状趋势。
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TierVisual({ tiers }) {
  const ranges = tiers.length
    ? tiers.map((item) => ({
        range: rowValue(item, ['range', 'label']),
        rate: rowValue(item, ['rate', 'ratio']),
      }))
    : tierRows.map(([range, rate]) => ({ range, rate }));

  return (
    <div className='partner-tier-visual'>
      <div
        className='partner-tier-chart'
        role='img'
        aria-label='分佣梯度阶梯图'
      >
        <svg className='partner-tier-svg' viewBox='0 0 900 340' aria-hidden='true'>
          <defs>
            <linearGradient id='partnerTierBarGradient' x1='0' x2='0' y1='0' y2='1'>
              <stop offset='0%' stopColor='#4F46E5' />
              <stop offset='100%' stopColor='#60A5FA' />
            </linearGradient>
          </defs>
          {[40, 82, 124, 166, 208].map((y) => (
            <line key={y} className='partner-tier-grid-line' x1={70} x2={830} y1={y} y2={y} />
          ))}
          <line className='partner-tier-axis-line' x1={70} x2={70} y1={40} y2={248} />
          <line className='partner-tier-axis-line' x1={70} x2={830} y1={248} y2={248} />
          {['20%', '15%', '12%', '10%', '8%'].map((label, index) => (
            <text
              key={label}
              className='partner-tier-axis-label'
              x={56}
              y={[44, 86, 128, 170, 212][index]}
              textAnchor='end'
            >
              {label}
            </text>
          ))}
          {ranges.slice(0, 5).map((item, index) => {
            const bars = [
              { x: 99, y: 208, height: 40, cx: 140, rateY: 194 },
              { x: 249, y: 166, height: 82, cx: 290, rateY: 152 },
              { x: 399, y: 124, height: 124, cx: 440, rateY: 110 },
              { x: 549, y: 82, height: 166, cx: 590, rateY: 68 },
              { x: 699, y: 40, height: 208, cx: 740, rateY: 26 },
            ];
            const bar = bars[index];
            return (
              <g key={item.range || index} className='partner-tier-bar-group'>
                <rect className='partner-tier-bar-shape' x={bar.x} y={bar.y} width={82} height={bar.height} />
                <text className='partner-tier-rate-label' x={bar.cx} y={bar.rateY} textAnchor='middle'>
                  {item.rate}
                </text>
                <text className='partner-tier-x-label' x={bar.cx} y={288} textAnchor='middle'>
                  {item.range}
                </text>
                <text className='partner-tier-x-sub' x={bar.cx} y={310} textAnchor='middle'>
                  对应部分
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <aside className='partner-tier-note'>
        <div>
          <span className='partner-tier-note-badge'>阶梯累进</span>
          <h3 className='partner-tier-note-title'>计算落入区间的金额</h3>
          <p className='partner-tier-note-text'>
            分佣按区间分段累进，不会把整月 GMV 全部套用最高比例。
          </p>
        </div>
        <div className='partner-tier-formula'>
          示例：当月有效 GMV 为 80000.00，前 50000.00 按 8% 产生 4000.00，剩余 30000.00 按 10% 产生 3000.00，合计预估分佣 7000.00。
        </div>
      </aside>
    </div>
  );
}
function QrPreview({ avatarUrl, compact = false, value }) {
  const sizeClass = compact ? 'h-[132px] w-[132px]' : 'h-56 w-56';
  const qrSize = compact ? 112 : 196;
  const avatarClass = compact ? 'h-9 w-9 rounded-lg' : 'h-12 w-12 rounded-lg';
  const showCenterLogo = Boolean(avatarUrl || !compact);
  return (
    <div className={compact ? `relative grid ${sizeClass} place-items-center rounded-[16px] border border-slate-200 bg-white p-3 shadow-sm` : 'partner-overview-qr-frame'}>
      {value ? (
        <QRCodeSVG data-promoter-qr={compact ? undefined : 'main'} value={value} size={qrSize} level='H' />
      ) : (
        <div className='h-full w-full rounded bg-slate-50' />
      )}
      {showCenterLogo && avatarUrl ? (
        <img
          alt=''
          className={`absolute ${avatarClass} border-4 border-white object-cover shadow-sm`}
          src={avatarUrl}
        />
      ) : showCenterLogo ? (
        <span className={`absolute grid ${avatarClass} place-items-center border-4 border-white bg-white text-sm font-black text-indigo-600 shadow-sm`}>
          FI
        </span>
      ) : null}
    </div>
  );
}
function EmptyState({ title, detail }) {
  return (
    <div className='mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center'>
      <div className='text-base font-black text-slate-800'>{title}</div>
      <div className='mt-2 text-sm leading-6 text-slate-500'>{detail}</div>
    </div>
  );
}
function MaintenanceState({ onRetry }) {
  return (
    <div className='mx-auto max-w-[760px] px-4 py-20 text-center'>
      <Panel>
        <div className='text-2xl font-black text-slate-950'>
          推广中心暂时无法访问，请稍后再试。
        </div>
        <p className='mt-3 text-sm leading-6 text-slate-500'>
          NewAPI 后端暂时无法连接联运前台 API，或桥接密钥/代理配置未生效。
        </p>
        <button
          className='infistar-btn-primary mx-auto mt-6'
          type='button'
          onClick={onRetry}
        >
          重试
        </button>
      </Panel>
    </div>
  );
}

function LandingFeatureCard({ color, detail, icon, title }) {
  return (
    <article className='partner-entry-benefit-item grid min-h-[136px] grid-cols-[54px_minmax(0,1fr)] gap-4 rounded-[20px] bg-[#f8faff]/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_18px_44px_-36px_rgba(79,70,229,0.28)]'>
      <MiniIconBubble color={color} icon={icon} />
      <div>
        <h3 className='text-xl font-black leading-7 text-slate-950'>{title}</h3>
        <p className='mt-2 text-sm font-semibold leading-6 text-slate-500'>{detail}</p>
      </div>
    </article>
  );
}
function LandingScenarioCard({ color, detail, icon, title }) {
  return (
    <article className='partner-entry-scene-item grid min-h-[136px] grid-cols-[54px_minmax(0,1fr)] gap-4 rounded-[20px] bg-[#f8faff]/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_18px_44px_-36px_rgba(79,70,229,0.28)]'>
      <MiniIconBubble color={color} icon={icon} />
      <div>
        <h3 className='text-xl font-black leading-7 text-slate-950'>{title}</h3>
        <p className='mt-2 text-sm font-semibold leading-6 text-slate-500'>{detail}</p>
      </div>
    </article>
  );
}
function UseCaseCard({ color, detail, icon, title }) {
  return (
    <article className='partner-promo-card'>
      <PromoIconBubble icon={icon} />
      <div>
        <h3 className='partner-promo-title'>{title}</h3>
        <p className='partner-promo-desc'>{detail}</p>
      </div>
    </article>
  );
}
function PreviewItem({ color, title, detail, icon }) {
  return (
    <div className='grid grid-cols-[64px_1fr] items-center gap-4'>
      <IconBubble color={color} icon={icon} />
      <div>
        <strong className='block text-2xl font-black leading-tight text-slate-950'>
          {title}
        </strong>
        <span className='mt-1 block text-sm leading-6 text-slate-500'>
          {detail}
        </span>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const tone = {
    正常: 'bg-emerald-50 text-emerald-700',
    合作中: 'bg-emerald-50 text-emerald-700',
    生效中: 'bg-emerald-50 text-emerald-700',
    已首充: 'bg-emerald-50 text-emerald-700',
    未首充: 'bg-slate-100 text-slate-600',
    统计中: 'bg-blue-50 text-blue-700',
    待确认: 'bg-amber-50 text-amber-700',
    已结算: 'bg-emerald-50 text-emerald-700',
    可提现: 'bg-amber-50 text-amber-700',
    提现中: 'bg-blue-50 text-blue-700',
    已提现: 'bg-slate-100 text-slate-600',
    已扣回: 'bg-rose-50 text-rose-700',
    已排除: 'bg-slate-100 text-slate-600',
    已注销: 'bg-slate-100 text-slate-500',
    处理中: 'bg-blue-50 text-blue-700',
    已打款: 'bg-emerald-50 text-emerald-700',
  };
  return (
    <span
      className={`partner-table-status ${tone[status] || tone['待确认']}`}
    >
      {status}
    </span>
  );
}
function IconBubble({ icon }) {
  return (
    <span className='partner-overview-stat-icon'>
      <IconGlyph icon={icon} />
    </span>
  );
}
function MiniIconBubble({ color, icon }) {
  return (
    <span className='partner-preview-row-icon'>
      <IconGlyph icon={icon} small />
    </span>
  );
}
function PromoIconBubble({ icon }) {
  return (
    <span className='partner-promo-icon'>
      <IconGlyph icon={icon} />
    </span>
  );
}
function IconGlyph({ icon, small = false }) {
  const size = small ? '18' : '22';
  const glyphs = {
    userPlus: (
      <>
        <path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' />
        <circle cx='9' cy='7' r='4' />
        <path d='M19 8v6' />
        <path d='M22 11h-6' />
      </>
    ),
    users: (
      <>
        <path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' />
        <circle cx='9' cy='7' r='4' />
        <path d='M23 21v-2a4 4 0 0 0-3-3.87' />
        <path d='M16 3.13a4 4 0 0 1 0 7.75' />
      </>
    ),
    link: (
      <>
        <path d='M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L11 4.93' />
        <path d='M14 11a5 5 0 0 0-7.07 0L4.81 13.12a5 5 0 0 0 7.07 7.07L13 19.07' />
      </>
    ),
    chart: (
      <>
        <path d='M3 3v18h18' />
        <path d='m19 9-5 5-4-4-3 3' />
      </>
    ),
    calendar: (
      <>
        <path d='M8 2v4' />
        <path d='M16 2v4' />
        <rect x='3' y='4' width='18' height='18' rx='2' />
        <path d='M3 10h18' />
        <path d='m9 16 2 2 4-4' />
      </>
    ),
    wallet: (
      <>
        <rect x='2' y='5' width='20' height='14' rx='2' />
        <path d='M16 9h2' />
        <path d='M6 12h6' />
        <path d='M6 15h4' />
      </>
    ),
    checkUser: (
      <>
        <path d='M16 11a4 4 0 1 0-8 0' />
        <path d='M6 21v-2a4 4 0 0 1 4-4h2' />
        <path d='m16 19 2 2 4-4' />
      </>
    ),
    transfer: (
      <>
        <path d='M12 2v20' />
        <path d='m17 5-5-3-5 3' />
        <path d='m17 19-5 3-5-3' />
        <path d='M4 12h16' />
      </>
    ),
    check: (
      <>
        <path d='M20 7H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z' />
        <path d='M16 7V5a2 2 0 0 0-2-2H6' />
        <path d='m9 14 2 2 4-5' />
      </>
    ),
    qr: (
      <>
        <path d='M4 4h6v6H4z' />
        <path d='M14 4h6v6h-6z' />
        <path d='M4 14h6v6H4z' />
        <path d='M14 14h2' />
        <path d='M20 14v2' />
        <path d='M16 18h4' />
        <path d='M18 16v4' />
      </>
    ),
    message: (
      <>
        <path d='M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z' />
        <path d='M8 9h8' />
        <path d='M8 13h5' />
      </>
    ),
    bolt: <path d='M13 2 4 14h7l-1 8 9-12h-7l1-8Z' />,
    share: (
      <>
        <circle cx='18' cy='5' r='3' />
        <circle cx='6' cy='12' r='3' />
        <circle cx='18' cy='19' r='3' />
        <path d='m8.59 13.51 6.83 3.98' />
        <path d='m15.41 6.51-6.82 3.98' />
      </>
    ),
    book: (
      <>
        <path d='M4 19.5A2.5 2.5 0 0 1 6.5 17H20' />
        <path d='M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z' />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      {glyphs[icon] || glyphs.link}
    </svg>
  );
}
function bubbleColor(color) {
  return (
    {
      purple: 'bg-[#ede8ff] text-[#7247ff]',
      blue: 'bg-[#e7f0ff] text-[#2f6bff]',
      cyan: 'bg-[#e4f9fb] text-[#21bfc8]',
      amber: 'bg-[#fff1d6] text-[#f5a524]',
      green: 'bg-[#e8f7ef] text-[#28a36b]',
    }[color] || 'bg-[#e7f0ff] text-[#2f6bff]'
  );
}
function textColor(color) {
  return (
    {
      purple: 'text-[#7247ff]',
      blue: 'text-[#2f6bff]',
      cyan: 'text-[#149ca4]',
      amber: 'text-[#c77700]',
      green: 'text-[#28a36b]',
    }[color] || 'text-[#2f6bff]'
  );
}

export default Promoter;
