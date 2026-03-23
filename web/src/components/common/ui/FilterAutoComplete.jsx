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

import React, { useEffect, useRef, useState } from 'react';
import { Form, Spin } from '@douyinfe/semi-ui';
import { API } from '../../../helpers';
import { useDebouncedCallback } from 'use-debounce';

const DEFAULT_LIMIT = 10;
const DEFAULT_DEBOUNCE_MS = 250;

const FilterAutoComplete = ({
  field,
  endpoint,
  placeholder,
  buildParams,
  minLength = 2,
  limit = DEFAULT_LIMIT,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  prefix = null,
  disabled = false,
}) => {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  const resetOptions = () => {
    requestIdRef.current += 1;
    setOptions([]);
    setLoading(false);
  };

  const fetchSuggestions = useDebouncedCallback(async (value) => {
    const keyword = String(value || '').trim();
    if (disabled || keyword.length < minLength) {
      resetOptions();
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);

    try {
      const res = await API.get(endpoint, {
        params: {
          ...(buildParams ? buildParams(keyword) : {}),
          field,
          keyword,
          limit,
        },
      });
      if (requestIdRef.current !== requestId) {
        return;
      }
      const { success, data } = res.data;
      if (!success || !Array.isArray(data)) {
        setOptions([]);
        return;
      }
      setOptions(
        data
          .filter((item) => typeof item === 'string' && item !== '')
          .map((item) => ({
            value: item,
            label: item,
          })),
      );
    } catch {
      if (requestIdRef.current === requestId) {
        setOptions([]);
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, debounceMs);

  useEffect(() => {
    return () => {
      fetchSuggestions.cancel();
    };
  }, [fetchSuggestions]);

  return (
    <Form.AutoComplete
      field={field}
      data={options}
      prefix={prefix}
      placeholder={placeholder}
      showClear
      pure
      size='small'
      autoComplete='off'
      disabled={disabled}
      suffix={loading ? <Spin size='small' /> : null}
      onChange={(value) => {
        fetchSuggestions(value);
      }}
      onClear={() => {
        resetOptions();
      }}
      onFocus={(e) => {
        if (e?.target?.value) {
          fetchSuggestions(e.target.value);
        }
      }}
    />
  );
};

export default FilterAutoComplete;
