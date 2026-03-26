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
import { useTranslation } from 'react-i18next';
import { API, showError } from '../../../helpers';
import { useDebouncedCallback } from 'use-debounce';

const DEFAULT_LIMIT = 10;
const DEFAULT_DEBOUNCE_MS = 250;

const FilterAutoComplete = ({
  field,
  endpoint,
  placeholder,
  buildParams,
  enableSuggestions = true,
  minLength = 2,
  limit = DEFAULT_LIMIT,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  prefix = null,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const autoCompleteRef = useRef(null);
  const requestIdRef = useRef(0);
  const cacheRef = useRef(new Map());
  const lastRateLimitNoticeAtRef = useRef(0);

  const resetOptions = () => {
    requestIdRef.current += 1;
    setOptions([]);
    setLoading(false);
  };

  const fetchSuggestions = useDebouncedCallback(async (value) => {
    const keyword = String(value || '').trim();
    if (disabled || !enableSuggestions || keyword.length < minLength) {
      resetOptions();
      return;
    }

    const params = {
      ...(buildParams ? buildParams(keyword) : {}),
      field,
      keyword,
      limit,
    };
    const requestKey = JSON.stringify({
      endpoint,
      params,
    });
    const cachedOptions = cacheRef.current.get(requestKey);
    if (cachedOptions) {
      requestIdRef.current += 1;
      setOptions(cachedOptions);
      setLoading(false);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);

    try {
      const res = await API.get(endpoint, { params });
      if (requestIdRef.current !== requestId) {
        return;
      }
      const { success, data } = res.data;
      if (!success || !Array.isArray(data)) {
        setOptions([]);
        return;
      }
      const nextOptions = data
        .filter((item) => typeof item === 'string' && item !== '')
        .map((item) => ({
          value: item,
          label: item,
        }));
      cacheRef.current.set(requestKey, nextOptions);
      setOptions(nextOptions);
    } catch (error) {
      if (requestIdRef.current === requestId) {
        setOptions([]);
        if (error?.response?.status === 429) {
          const now = Date.now();
          if (now - lastRateLimitNoticeAtRef.current > 5000) {
            lastRateLimitNoticeAtRef.current = now;
            showError(t('联想请求过于频繁，请稍后重试'));
          }
        }
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

  useEffect(() => {
    if (!enableSuggestions) {
      fetchSuggestions.cancel();
      resetOptions();
    }
  }, [enableSuggestions, fetchSuggestions]);

  const handleTabSelect = () => {
    if (!enableSuggestions || disabled || options.length === 0) {
      return;
    }

    const component = autoCompleteRef.current;
    const focusIndex = component?.state?.focusIndex;
    const selectedIndex =
      Number.isInteger(focusIndex) &&
      focusIndex >= 0 &&
      focusIndex < options.length
        ? focusIndex
        : 0;
    const selectedOption = options[selectedIndex];

    if (!selectedOption || component?.foundation?.handleSelect == null) {
      return;
    }

    component.foundation.handleSelect(selectedOption, selectedIndex);
  };

  return (
    <Form.AutoComplete
      ref={autoCompleteRef}
      field={field}
      data={enableSuggestions ? options : []}
      prefix={prefix}
      placeholder={placeholder}
      showClear
      pure
      size='small'
      autoComplete='off'
      disabled={disabled}
      suffix={loading ? <Spin size='small' /> : null}
      onChange={(value) => {
        if (enableSuggestions) {
          fetchSuggestions(value);
        }
      }}
      onClear={() => {
        resetOptions();
      }}
      onFocus={(e) => {
        if (enableSuggestions && e?.target?.value) {
          fetchSuggestions(e.target.value);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Tab') {
          handleTabSelect();
        }
      }}
    />
  );
};

export default FilterAutoComplete;
