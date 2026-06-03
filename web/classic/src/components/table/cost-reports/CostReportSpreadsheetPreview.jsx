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

import React, { useEffect, useMemo, useRef } from 'react';
import dayjs from 'dayjs';
import jspreadsheet from 'jspreadsheet-ce';
import 'jsuites/dist/jsuites.css';
import 'jspreadsheet-ce/dist/jspreadsheet.css';

const PREVIEW_EMPTY_ROWS = 12;

const excelColumnName = (index) => {
  let n = index + 1;
  let label = '';
  while (n > 0) {
    const remainder = (n - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
};

const columnWidth = (field) => {
  if (field?.value_type === 'date') return 190;
  if (field?.key === 'customer' || field?.key === 'channel_name') return 180;
  if (field?.kind === 'formula' || field?.kind === 'manual') return 150;
  return 140;
};

const fieldBg = (field, editable) => {
  if (editable) return '#eff6ff';
  if (field?.kind === 'formula') return '#fffbeb';
  if (field?.kind === 'metric') return '#ecfdf5';
  if (field?.kind === 'dimension') return '#f9fafb';
  return '#ffffff';
};

const isNumericValueType = (type) => ['integer', 'decimal', 'currency', 'percent'].includes(type);

const formatValue = (value, field) => {
  if (value === null || value === undefined || value === '') return '';
  if (field?.value_type === 'date') {
    if (typeof value === 'number') return dayjs.unix(value).format('YYYY-MM-DD HH:mm:ss');
    return String(value);
  }
  if (['currency', 'decimal'].includes(field?.value_type)) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 6 }) : String(value);
  }
  if (field?.value_type === 'percent') {
    const n = Number(value);
    return Number.isFinite(n) ? `${(n * 100).toFixed(2)}%` : String(value);
  }
  return String(value);
};

const cellName = (col, row) => `${excelColumnName(col)}${row + 1}`;

const CostReportSpreadsheetPreview = ({
  fields = [],
  rows = [],
  manualDrafts = {},
  selectedRun,
  manualDraftKey,
  isEditableField,
  onManualDraftChange,
}) => {
  const rootRef = useRef(null);
  const spreadsheetRef = useRef(null);
  const ignoreChangeRef = useRef(false);
  const hasDataRows = rows.length > 0;

  const sheetRows = useMemo(() => {
    if (hasDataRows) return rows;
    return Array.from({ length: PREVIEW_EMPTY_ROWS }, (_, index) => ({
      key: `empty-${index}`,
      row_key: '',
      values: {},
      __empty: true,
    }));
  }, [hasDataRows, rows]);

  const { columns, data, style } = useMemo(() => {
    const placeholderOnly = !hasDataRows;
    const nextColumns = fields.map((field) => {
      const editable = !placeholderOnly && isEditableField(field) && !selectedRun;
      return {
        title: field.label || field.key,
        type: 'text',
        width: columnWidth(field),
        readOnly: !editable,
        align: isNumericValueType(field.value_type) ? 'right' : 'left',
      };
    });

    const nextData = sheetRows.map((row) =>
      fields.map((field) => {
        if (row.__empty) return '';
        if (isEditableField(field) && !selectedRun) {
          return manualDrafts[manualDraftKey(row.row_key, field.key)] ?? '';
        }
        return formatValue(row?.values?.[field.key], field);
      }),
    );

    const nextStyle = {};
    sheetRows.forEach((row, rowIndex) => {
      fields.forEach((field, colIndex) => {
        const editable = !row.__empty && isEditableField(field) && !selectedRun;
        nextStyle[cellName(colIndex, rowIndex)] = `background-color:${fieldBg(field, editable)};`;
      });
    });

    return { columns: nextColumns, data: nextData, style: nextStyle };
  }, [fields, hasDataRows, isEditableField, manualDraftKey, selectedRun, sheetRows]);

  useEffect(() => {
    if (!rootRef.current || fields.length === 0) return undefined;
    if (spreadsheetRef.current) {
      jspreadsheet.destroy(rootRef.current, true);
      spreadsheetRef.current = null;
    }
    rootRef.current.innerHTML = '';
    ignoreChangeRef.current = true;
    const instances = jspreadsheet(rootRef.current, {
      toolbar: false,
      tabs: false,
      parseFormulas: false,
      worksheets: [
        {
          data,
          columns,
          style,
          minDimensions: [Math.max(fields.length, 1), Math.max(sheetRows.length, PREVIEW_EMPTY_ROWS)],
          tableOverflow: true,
          tableWidth: '100%',
          tableHeight: 'calc(100vh - 170px)',
          freezeColumns: Math.min(2, fields.length),
          defaultRowHeight: 30,
          allowInsertColumn: false,
          allowInsertRow: false,
          allowDeleteColumn: false,
          allowDeleteRow: false,
          allowRenameColumn: false,
          allowManualInsertColumn: false,
          allowManualInsertRow: false,
          columnDrag: false,
          columnSorting: false,
          filters: false,
        },
      ],
      onchange: (_instance, _cell, colIndex, rowIndex, newValue) => {
        if (ignoreChangeRef.current) return;
        const col = Number(colIndex);
        const row = Number(rowIndex);
        const field = fields[col];
        const record = sheetRows[row];
        if (!field || !record || record.__empty || selectedRun || !isEditableField(field)) return;
        onManualDraftChange(record.row_key, field.key, newValue === null || newValue === undefined ? '' : String(newValue));
      },
    });
    spreadsheetRef.current = instances;
    setTimeout(() => {
      ignoreChangeRef.current = false;
    }, 0);
    return () => {
      if (rootRef.current) {
        jspreadsheet.destroy(rootRef.current, true);
        rootRef.current.innerHTML = '';
      }
      spreadsheetRef.current = null;
    };
  }, [columns, data, fields, isEditableField, onManualDraftChange, selectedRun, sheetRows, style]);

  return (
    <div className='cost-report-spreadsheet-preview'>
      <div ref={rootRef} />
    </div>
  );
};

export default CostReportSpreadsheetPreview;
