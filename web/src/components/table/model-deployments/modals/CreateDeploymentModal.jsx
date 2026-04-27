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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  Spinner,
  Tooltip,
  useOverlayState,
} from '@heroui/react';
import { ChevronDown, Copy, HelpCircle, Minus, Plus, X } from 'lucide-react';
import { API, copy, showError, showSuccess } from '../../../../helpers';

// ----------------------------- helpers -----------------------------

const inputClass =
  'h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:opacity-50';

const inputClassSm =
  'h-8 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:opacity-50';

function FieldLabel({ children, required }) {
  return (
    <label className='block text-sm font-medium text-foreground'>
      {children}
      {required ? <span className='ml-0.5 text-danger'>*</span> : null}
    </label>
  );
}

function FieldHint({ children }) {
  if (!children) return null;
  return <div className='mt-1.5 text-xs text-muted'>{children}</div>;
}

function FieldError({ children }) {
  if (!children) return null;
  return <div className='mt-1 text-xs text-danger'>{children}</div>;
}

function StatusChip({ tone = 'grey', size = 'sm', children }) {
  const TONE = {
    green: 'bg-success/15 text-success',
    red: 'bg-danger/15 text-danger',
    blue: 'bg-primary/15 text-primary',
    grey: 'bg-surface-secondary text-muted',
  };
  const sizeCls =
    size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ${sizeCls} ${
        TONE[tone] || TONE.grey
      }`}
    >
      {children}
    </span>
  );
}

// ----------------------------- custom dropdowns -----------------------------

// Single-select dropdown with rich item rendering. Replaces Semi
// `<Form.Select renderSelectedItem>` with `<Option>` children.
function RichSingleSelect({
  value,
  options,
  placeholder,
  loading,
  disabled,
  onChange,
  renderItem,
  renderSelected,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const selected = options.find((opt) => opt.value === value) || null;

  return (
    <div ref={ref} className='relative'>
      <button
        type='button'
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-10 w-full items-center justify-between gap-2 rounded-xl border bg-background px-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
          open ? 'border-primary' : 'border-border'
        } ${disabled ? '' : 'hover:border-primary/60'}`}
      >
        <span className='min-w-0 flex-1 truncate text-left'>
          {loading ? (
            <span className='inline-flex items-center gap-2 text-muted'>
              <Spinner size='sm' />
              <span>{placeholder}</span>
            </span>
          ) : selected ? (
            renderSelected ? (
              renderSelected(selected)
            ) : (
              selected.label || String(selected.value)
            )
          ) : (
            <span className='text-muted'>{placeholder}</span>
          )}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-muted transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && !disabled ? (
        <div className='absolute left-0 right-0 z-30 mt-1 max-h-[360px] overflow-auto rounded-xl border border-border bg-background shadow-lg'>
          {options.length === 0 ? (
            <div className='px-3 py-2 text-xs text-muted'>{placeholder}</div>
          ) : (
            <ul className='py-1'>
              {options.map((option) => {
                const active = option.value === value;
                return (
                  <li key={String(option.value)}>
                    <button
                      type='button'
                      disabled={option.disabled}
                      onClick={() => {
                        onChange?.(option.value);
                        setOpen(false);
                      }}
                      className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        active
                          ? 'bg-primary/10 text-primary'
                          : 'text-foreground hover:bg-surface-secondary'
                      }`}
                    >
                      <span className='min-w-0 flex-1'>
                        {renderItem ? renderItem(option) : option.label}
                      </span>
                      {active ? <span className='text-xs'>{'✓'}</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

// Multi-select dropdown with rich item rendering + chips.
function RichMultiSelect({
  value = [],
  options,
  placeholder,
  loading,
  disabled,
  onChange,
  renderItem,
  renderSelectedLabel,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const toggle = (val, optionDisabled) => {
    if (optionDisabled) return;
    if ((value || []).includes(val)) {
      onChange?.((value || []).filter((v) => v !== val));
    } else {
      onChange?.([...(value || []), val]);
    }
  };

  const removeAt = (val) => {
    onChange?.((value || []).filter((v) => v !== val));
  };

  return (
    <div ref={ref} className='relative'>
      <div
        className={`flex min-h-[40px] flex-wrap items-center gap-1.5 rounded-xl border bg-background px-2 py-1.5 text-sm transition focus-within:border-primary ${
          open ? 'border-primary' : 'border-border'
        } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-text'}`}
        onClick={() => {
          if (!disabled) setOpen(true);
        }}
      >
        {(value || []).length === 0 ? (
          <span className='px-1 text-muted'>
            {loading ? (
              <span className='inline-flex items-center gap-2'>
                <Spinner size='sm' />
                <span>{placeholder}</span>
              </span>
            ) : (
              placeholder
            )}
          </span>
        ) : (
          (value || []).map((v) => {
            const opt = options.find((o) => o.value === v);
            const label = renderSelectedLabel
              ? renderSelectedLabel(opt, v)
              : (opt?.label ?? String(v));
            return (
              <span
                key={String(v)}
                className='inline-flex items-center gap-1 rounded-full bg-surface-secondary px-2 py-0.5 text-xs'
              >
                <span>{label}</span>
                <button
                  type='button'
                  onClick={(event) => {
                    event.stopPropagation();
                    removeAt(v);
                  }}
                  aria-label='remove'
                  className='text-muted hover:text-foreground'
                >
                  <X size={12} />
                </button>
              </span>
            );
          })
        )}
        <span className='ml-auto inline-flex items-center'>
          <ChevronDown
            size={14}
            className={`text-muted transition-transform ${
              open ? 'rotate-180' : ''
            }`}
          />
        </span>
      </div>

      {open && !disabled ? (
        <div className='absolute left-0 right-0 z-30 mt-1 max-h-[360px] overflow-auto rounded-xl border border-border bg-background shadow-lg'>
          {options.length === 0 ? (
            <div className='px-3 py-2 text-xs text-muted'>{placeholder}</div>
          ) : (
            <ul className='py-1'>
              {options.map((option) => {
                const selected = (value || []).includes(option.value);
                return (
                  <li key={String(option.value)}>
                    <button
                      type='button'
                      disabled={option.disabled}
                      onClick={() => toggle(option.value, option.disabled)}
                      className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        selected
                          ? 'bg-primary/10 text-primary'
                          : 'text-foreground hover:bg-surface-secondary'
                      }`}
                    >
                      <input
                        type='checkbox'
                        readOnly
                        checked={selected}
                        className='mt-1 h-4 w-4 shrink-0 accent-primary'
                      />
                      <span className='min-w-0 flex-1'>
                        {renderItem ? renderItem(option) : option.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ----------------------------- constants -----------------------------

const BUILTIN_IMAGE = 'ollama/ollama:latest';
const DEFAULT_TRAFFIC_PORT = 11434;

const generateRandomKey = () => {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return `ionet-${crypto.randomUUID().replace(/-/g, '')}`;
    }
  } catch (error) {
    // ignore
  }
  return `ionet-${Math.random().toString(36).slice(2)}${Math.random()
    .toString(36)
    .slice(2)}`;
};

// ----------------------------- main -----------------------------

const CreateDeploymentModal = ({ visible, onCancel, onSuccess, t }) => {
  const [submitting, setSubmitting] = useState(false);

  // Resource data
  const [hardwareTypes, setHardwareTypes] = useState([]);
  const [hardwareTotalAvailable, setHardwareTotalAvailable] = useState(null);
  const [locations, setLocations] = useState([]);
  const [locationTotalAvailable, setLocationTotalAvailable] = useState(null);
  const [priceEstimation, setPriceEstimation] = useState(null);

  const [loadingHardware, setLoadingHardware] = useState(false);
  const [loadingReplicas, setLoadingReplicas] = useState(false);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [envVariables, setEnvVariables] = useState([{ key: '', value: '' }]);
  const [secretEnvVariables, setSecretEnvVariables] = useState([
    { key: '', value: '' },
  ]);
  const [entrypoint, setEntrypoint] = useState(['']);
  const [args, setArgs] = useState(['']);

  const [imageMode, setImageMode] = useState('builtin');
  const [autoOllamaKey, setAutoOllamaKey] = useState('');

  const customSecretEnvRef = useRef(null);
  const customEnvRef = useRef(null);
  const customImageRef = useRef('');
  const customTrafficPortRef = useRef(null);
  const prevImageModeRef = useRef('builtin');
  const basicSectionRef = useRef(null);
  const priceSectionRef = useRef(null);
  const advancedSectionRef = useRef(null);
  const replicaRequestIdRef = useRef(0);

  // Form values (controlled)
  const [values, setValues] = useState({
    resource_private_name: '',
    image_url: BUILTIN_IMAGE,
    hardware_id: null,
    gpus_per_container: 1,
    location_ids: [],
    replica_count: 1,
    duration_hours: 1,
    traffic_port: DEFAULT_TRAFFIC_PORT,
    registry_username: '',
    registry_secret: '',
  });
  const [errors, setErrors] = useState({});
  const [priceCurrency, setPriceCurrency] = useState('usdc');

  const setField = (key) => (value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const setNumberField = (key) => (event) => {
    const raw = event?.target ? event.target.value : event;
    if (raw === '' || raw === null || raw === undefined) {
      setField(key)('');
      return;
    }
    const num = Number(raw);
    if (Number.isNaN(num)) return;
    setField(key)(num);
  };

  const modalState = useOverlayState({
    isOpen: visible,
    onOpenChange: (isOpen) => {
      if (!isOpen) onCancel?.();
    },
  });

  const hardwareLabelMap = useMemo(() => {
    const map = {};
    hardwareTypes.forEach((hardware) => {
      const displayName = hardware.brand_name
        ? `${hardware.brand_name} ${hardware.name}`.trim()
        : hardware.name;
      map[hardware.id] = displayName;
    });
    return map;
  }, [hardwareTypes]);

  const locationLabelMap = useMemo(() => {
    const map = {};
    locations.forEach((location) => {
      map[location.id] = location.name;
    });
    return map;
  }, [locations]);

  const getHardwareMaxGpus = (hardwareId) => {
    if (!hardwareId) return 1;
    const hardware = hardwareTypes.find((h) => h.id === hardwareId);
    const maxGpus = Number(hardware?.max_gpus);
    return Number.isFinite(maxGpus) && maxGpus > 0 ? maxGpus : 1;
  };

  // Update gpus_per_container when hardware changes
  useEffect(() => {
    if (!values.hardware_id) return;
    const nextMaxGpus = getHardwareMaxGpus(values.hardware_id);
    if (values.gpus_per_container !== nextMaxGpus) {
      setValues((prev) => ({ ...prev, gpus_per_container: nextMaxGpus }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.hardware_id, hardwareTypes]);

  // Load initial data when modal opens
  useEffect(() => {
    if (visible) {
      loadHardwareTypes();
      resetFormState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Load available replicas when hardware or gpu count change
  useEffect(() => {
    if (!visible) return;
    if (values.hardware_id && values.gpus_per_container > 0) {
      loadAvailableReplicas(values.hardware_id, values.gpus_per_container);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.hardware_id, values.gpus_per_container, visible]);

  // Calculate price when relevant parameters change
  useEffect(() => {
    if (!visible) return;
    if (
      values.hardware_id &&
      (values.location_ids || []).length > 0 &&
      values.gpus_per_container > 0 &&
      values.duration_hours > 0 &&
      values.replica_count > 0
    ) {
      calculatePrice();
    } else {
      setPriceEstimation(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    values.hardware_id,
    values.location_ids,
    values.gpus_per_container,
    values.duration_hours,
    values.replica_count,
    priceCurrency,
    visible,
  ]);

  // Image mode switch
  useEffect(() => {
    if (!visible) return;
    const prevMode = prevImageModeRef.current;
    if (prevMode === imageMode) return;

    if (imageMode === 'builtin') {
      if (prevMode === 'custom') {
        customImageRef.current = values.image_url || customImageRef.current;
        customTrafficPortRef.current =
          values.traffic_port ?? customTrafficPortRef.current;
        customSecretEnvRef.current = secretEnvVariables.map((item) => ({
          ...item,
        }));
        customEnvRef.current = envVariables.map((item) => ({ ...item }));
      }
      const newKey = generateRandomKey();
      setAutoOllamaKey(newKey);
      setSecretEnvVariables([{ key: 'OLLAMA_API_KEY', value: newKey }]);
      setEnvVariables([{ key: '', value: '' }]);
      setValues((prev) => ({
        ...prev,
        image_url: BUILTIN_IMAGE,
        traffic_port: DEFAULT_TRAFFIC_PORT,
      }));
    } else {
      const restoredSecrets =
        customSecretEnvRef.current && customSecretEnvRef.current.length > 0
          ? customSecretEnvRef.current.map((item) => ({ ...item }))
          : [{ key: '', value: '' }];
      const restoredEnv =
        customEnvRef.current && customEnvRef.current.length > 0
          ? customEnvRef.current.map((item) => ({ ...item }))
          : [{ key: '', value: '' }];
      setSecretEnvVariables(restoredSecrets);
      setEnvVariables(restoredEnv);
      const restoredImage = customImageRef.current || '';
      setValues((prev) => ({
        ...prev,
        image_url: restoredImage,
        traffic_port: customTrafficPortRef.current || prev.traffic_port,
      }));
    }

    prevImageModeRef.current = imageMode;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageMode, visible]);

  // Reset locations when hardware cleared
  useEffect(() => {
    if (!visible) return;
    if (values.hardware_id) return;
    setLocations([]);
    setValues((prev) => ({ ...prev, location_ids: [] }));
    setLocationTotalAvailable(null);
    setLoadingReplicas(false);
    replicaRequestIdRef.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.hardware_id, visible]);

  const arraysEqual = (a = [], b = []) =>
    a.length === b.length && a.every((value, index) => value === b[index]);

  // Filter location_ids to keep only locations that are still valid+available
  useEffect(() => {
    if (!visible) return;
    if (!values.hardware_id) {
      if ((values.location_ids || []).length > 0) {
        setValues((prev) => ({ ...prev, location_ids: [] }));
      }
      return;
    }
    const validLocationIds = locations
      .filter((location) => (Number(location.available) || 0) > 0)
      .map((location) => location.id);
    if (validLocationIds.length === 0) {
      if ((values.location_ids || []).length > 0) {
        setValues((prev) => ({ ...prev, location_ids: [] }));
      }
      return;
    }
    if ((values.location_ids || []).length === 0) return;
    const filteredSelection = (values.location_ids || []).filter((id) =>
      validLocationIds.includes(id),
    );
    if (!arraysEqual(values.location_ids, filteredSelection)) {
      setValues((prev) => ({ ...prev, location_ids: filteredSelection }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations, values.hardware_id, values.location_ids, visible]);

  function resetFormState() {
    const randomName = `deployment-${Math.random().toString(36).slice(2, 8)}`;
    const generatedKey = generateRandomKey();

    setLocations([]);
    setLocationTotalAvailable(null);
    setHardwareTotalAvailable(null);
    setEnvVariables([{ key: '', value: '' }]);
    setSecretEnvVariables([{ key: 'OLLAMA_API_KEY', value: generatedKey }]);
    setEntrypoint(['']);
    setArgs(['']);
    setAdvancedOpen(false);
    setImageMode('builtin');
    setAutoOllamaKey(generatedKey);
    customSecretEnvRef.current = null;
    customEnvRef.current = null;
    customImageRef.current = '';
    customTrafficPortRef.current = DEFAULT_TRAFFIC_PORT;
    prevImageModeRef.current = 'builtin';
    setPriceCurrency('usdc');
    setPriceEstimation(null);
    setErrors({});
    setValues({
      resource_private_name: randomName,
      image_url: BUILTIN_IMAGE,
      hardware_id: null,
      gpus_per_container: 1,
      location_ids: [],
      replica_count: 1,
      duration_hours: 1,
      traffic_port: DEFAULT_TRAFFIC_PORT,
      registry_username: '',
      registry_secret: '',
    });
  }

  async function loadHardwareTypes() {
    try {
      setLoadingHardware(true);
      const response = await API.get('/api/deployments/hardware-types');
      if (response.data.success) {
        const { hardware_types: hardwareList = [], total_available } =
          response.data.data || {};

        const normalizedHardware = hardwareList.map((hardware) => {
          const availableCountValue = Number(hardware.available_count);
          const availableCount = Number.isNaN(availableCountValue)
            ? 0
            : availableCountValue;
          const availableBool =
            typeof hardware.available === 'boolean'
              ? hardware.available
              : availableCount > 0;

          return {
            ...hardware,
            available: availableBool,
            available_count: availableCount,
          };
        });

        const providedTotal = Number(total_available);
        const fallbackTotal = normalizedHardware.reduce(
          (acc, item) =>
            acc +
            (Number.isNaN(item.available_count) ? 0 : item.available_count),
          0,
        );
        const hasProvidedTotal =
          total_available !== undefined &&
          total_available !== null &&
          total_available !== '' &&
          !Number.isNaN(providedTotal);

        setHardwareTypes(normalizedHardware);
        setHardwareTotalAvailable(
          hasProvidedTotal ? providedTotal : fallbackTotal,
        );
      } else {
        showError(t('获取硬件类型失败: ') + response.data.message);
      }
    } catch (error) {
      showError(t('获取硬件类型失败: ') + error.message);
    } finally {
      setLoadingHardware(false);
    }
  }

  async function loadAvailableReplicas(hardwareId, gpuCount) {
    if (!hardwareId || !gpuCount) {
      setLocations([]);
      setLocationTotalAvailable(null);
      setLoadingReplicas(false);
      return;
    }

    const requestId = Date.now();
    replicaRequestIdRef.current = requestId;
    setLoadingReplicas(true);
    setLocations([]);
    setLocationTotalAvailable(null);

    try {
      const response = await API.get(
        `/api/deployments/available-replicas?hardware_id=${hardwareId}&gpu_count=${gpuCount}`,
      );

      if (replicaRequestIdRef.current !== requestId) return;

      if (response.data.success) {
        const replicasList = response.data.data?.replicas || [];
        const nextLocationsMap = new Map();
        replicasList.forEach((replica) => {
          const rawId = replica?.location_id ?? replica?.location?.id;
          if (rawId === null || rawId === undefined) return;
          const id = rawId;
          const mapKey = String(rawId);
          const existing = nextLocationsMap.get(mapKey) || null;

          const rawIso2 =
            replica?.iso2 ?? replica?.location_iso2 ?? replica?.location?.iso2;
          const iso2 = rawIso2 ? String(rawIso2).toUpperCase() : '';

          const name =
            replica?.location_name ??
            replica?.location?.name ??
            replica?.name ??
            id;

          const available = Number(replica?.available_count) || 0;
          if (existing) {
            existing.available += available;
            return;
          }
          nextLocationsMap.set(mapKey, {
            id,
            name: String(name),
            iso2,
            region:
              replica?.region ??
              replica?.location_region ??
              replica?.location?.region,
            country:
              replica?.country ??
              replica?.location_country ??
              replica?.location?.country,
            code:
              replica?.code ??
              replica?.location_code ??
              replica?.location?.code,
            available,
          });
        });

        setLocations(Array.from(nextLocationsMap.values()));
        setLocationTotalAvailable(
          Array.from(nextLocationsMap.values()).reduce(
            (total, location) => total + (location.available || 0),
            0,
          ),
        );
      } else {
        showError(t('获取可用资源失败: ') + response.data.message);
        setLocationTotalAvailable(null);
      }
    } catch (error) {
      if (replicaRequestIdRef.current === requestId) {
        console.error('Load available replicas error:', error);
        setLocationTotalAvailable(null);
      }
    } finally {
      if (replicaRequestIdRef.current === requestId) {
        setLoadingReplicas(false);
      }
    }
  }

  async function calculatePrice() {
    try {
      setLoadingPrice(true);
      const requestData = {
        location_ids: values.location_ids,
        hardware_id: values.hardware_id,
        gpus_per_container: values.gpus_per_container,
        duration_hours: values.duration_hours,
        replica_count: values.replica_count,
        currency: priceCurrency?.toLowerCase?.() || priceCurrency,
        duration_type: 'hour',
        duration_qty: values.duration_hours,
        hardware_qty: values.gpus_per_container,
      };

      const response = await API.post(
        '/api/deployments/price-estimation',
        requestData,
      );
      if (response.data.success) {
        setPriceEstimation(response.data.data);
      } else {
        showError(t('价格计算失败: ') + response.data.message);
        setPriceEstimation(null);
      }
    } catch (error) {
      console.error('Price calculation error:', error);
      setPriceEstimation(null);
    } finally {
      setLoadingPrice(false);
    }
  }

  const validate = () => {
    const next = {};
    if (!values.resource_private_name?.trim())
      next.resource_private_name = t('请输入容器名称');
    if (!values.image_url?.trim()) next.image_url = t('请输入镜像地址');
    if (!values.hardware_id) next.hardware_id = t('请选择硬件类型');
    if ((values.location_ids || []).length === 0)
      next.location_ids = t('请选择至少一个部署位置');
    if (!values.replica_count || values.replica_count < 1)
      next.replica_count = t('请输入副本数量');
    if (!values.duration_hours || values.duration_hours < 1)
      next.duration_hours = t('请输入运行时长');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  async function handleSubmit() {
    if (!validate()) return;

    try {
      setSubmitting(true);

      const envVars = {};
      envVariables.forEach((env) => {
        if (env.key && env.value) envVars[env.key] = env.value;
      });

      const secretEnvVars = {};
      secretEnvVariables.forEach((env) => {
        if (env.key && env.value) secretEnvVars[env.key] = env.value;
      });

      if (imageMode === 'builtin') {
        if (!secretEnvVars.OLLAMA_API_KEY) {
          const ensuredKey = autoOllamaKey || generateRandomKey();
          secretEnvVars.OLLAMA_API_KEY = ensuredKey;
          setAutoOllamaKey(ensuredKey);
        }
      }

      const cleanEntrypoint = entrypoint.filter((item) => item.trim() !== '');
      const cleanArgs = args.filter((item) => item.trim() !== '');

      const resolvedImage =
        imageMode === 'builtin' ? BUILTIN_IMAGE : values.image_url;
      const resolvedTrafficPort =
        values.traffic_port ||
        (imageMode === 'builtin' ? DEFAULT_TRAFFIC_PORT : undefined);

      const requestData = {
        resource_private_name: values.resource_private_name,
        duration_hours: values.duration_hours,
        gpus_per_container: values.gpus_per_container,
        hardware_id: values.hardware_id,
        location_ids: values.location_ids,
        container_config: {
          replica_count: values.replica_count,
          env_variables: envVars,
          secret_env_variables: secretEnvVars,
          entrypoint: cleanEntrypoint.length > 0 ? cleanEntrypoint : undefined,
          args: cleanArgs.length > 0 ? cleanArgs : undefined,
          traffic_port: resolvedTrafficPort,
        },
        registry_config: {
          image_url: resolvedImage,
          registry_username: values.registry_username || undefined,
          registry_secret: values.registry_secret || undefined,
        },
      };

      const response = await API.post('/api/deployments', requestData);

      if (response.data.success) {
        showSuccess(t('容器创建成功'));
        onSuccess?.(response.data.data);
        onCancel();
      } else {
        showError(t('容器创建失败: ') + response.data.message);
      }
    } catch (error) {
      showError(t('容器创建失败: ') + error.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Env variable / array helpers
  const handleAddEnvVariable = (type) => {
    if (type === 'env') {
      setEnvVariables([...envVariables, { key: '', value: '' }]);
    } else {
      setSecretEnvVariables([...secretEnvVariables, { key: '', value: '' }]);
    }
  };

  const handleRemoveEnvVariable = (index, type) => {
    if (type === 'env') {
      const newEnvVars = envVariables.filter((_, i) => i !== index);
      setEnvVariables(
        newEnvVars.length > 0 ? newEnvVars : [{ key: '', value: '' }],
      );
    } else {
      const newSecretEnvVars = secretEnvVariables.filter((_, i) => i !== index);
      setSecretEnvVariables(
        newSecretEnvVars.length > 0
          ? newSecretEnvVars
          : [{ key: '', value: '' }],
      );
    }
  };

  const handleEnvVariableChange = (index, field, value, type) => {
    if (type === 'env') {
      const newEnvVars = [...envVariables];
      newEnvVars[index][field] = value;
      setEnvVariables(newEnvVars);
    } else {
      const newSecretEnvVars = [...secretEnvVariables];
      newSecretEnvVars[index][field] = value;
      setSecretEnvVariables(newSecretEnvVars);
    }
  };

  const handleArrayFieldChange = (index, value, type) => {
    if (type === 'entrypoint') {
      const newEntrypoint = [...entrypoint];
      newEntrypoint[index] = value;
      setEntrypoint(newEntrypoint);
    } else {
      const newArgs = [...args];
      newArgs[index] = value;
      setArgs(newArgs);
    }
  };

  const handleAddArrayField = (type) => {
    if (type === 'entrypoint') {
      setEntrypoint([...entrypoint, '']);
    } else {
      setArgs([...args, '']);
    }
  };

  const handleRemoveArrayField = (index, type) => {
    if (type === 'entrypoint') {
      const newEntrypoint = entrypoint.filter((_, i) => i !== index);
      setEntrypoint(newEntrypoint.length > 0 ? newEntrypoint : ['']);
    } else {
      const newArgs = args.filter((_, i) => i !== index);
      setArgs(newArgs.length > 0 ? newArgs : ['']);
    }
  };

  const maxAvailableReplicas = useMemo(() => {
    if (!(values.location_ids || []).length) return 0;
    return locations
      .filter((location) => values.location_ids.includes(location.id))
      .reduce((total, location) => {
        const availableValue = Number(location.available);
        return total + (Number.isNaN(availableValue) ? 0 : availableValue);
      }, 0);
  }, [values.location_ids, locations]);

  // Clamp replica_count to max available
  useEffect(() => {
    if (!visible) return;
    if (
      maxAvailableReplicas > 0 &&
      values.replica_count > maxAvailableReplicas
    ) {
      setValues((prev) => ({
        ...prev,
        replica_count: maxAvailableReplicas,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxAvailableReplicas, values.replica_count, visible]);

  const isPriceReady = useMemo(
    () =>
      values.hardware_id &&
      (values.location_ids || []).length > 0 &&
      values.gpus_per_container > 0 &&
      values.duration_hours > 0 &&
      values.replica_count > 0,
    [
      values.hardware_id,
      values.location_ids,
      values.gpus_per_container,
      values.duration_hours,
      values.replica_count,
    ],
  );

  const currencyLabel = (
    priceEstimation?.currency ||
    priceCurrency ||
    ''
  ).toUpperCase();
  const selectedHardwareLabel = values.hardware_id
    ? hardwareLabelMap[values.hardware_id]
    : '';
  const selectedLocationNames = (values.location_ids || [])
    .map((id) => locationLabelMap[id])
    .filter(Boolean);
  const totalGpuHours =
    Number(values.gpus_per_container || 0) *
    Number(values.replica_count || 0) *
    Number(values.duration_hours || 0);
  const priceSummaryItems = [
    {
      key: 'hardware',
      label: t('硬件类型'),
      value: selectedHardwareLabel || '--',
    },
    {
      key: 'locations',
      label: t('部署位置'),
      value: selectedLocationNames.length
        ? selectedLocationNames.join('、')
        : '--',
    },
    {
      key: 'replicas',
      label: t('副本数量'),
      value: (values.replica_count ?? 0).toString(),
    },
    {
      key: 'gpus',
      label: t('最大GPU数量'),
      value: (values.gpus_per_container ?? 0).toString(),
    },
    {
      key: 'duration',
      label: t('运行时长（小时）'),
      value: values.duration_hours ? values.duration_hours.toString() : '0',
    },
    {
      key: 'gpu-hours',
      label: t('总 GPU 小时'),
      value: totalGpuHours > 0 ? totalGpuHours.toLocaleString() : '0',
    },
  ];

  const scrollToSection = (ref) => {
    if (ref?.current && typeof ref.current.scrollIntoView === 'function') {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const hardwareOptions = useMemo(
    () =>
      hardwareTypes.map((hardware) => {
        const displayName = hardware.brand_name
          ? `${hardware.brand_name} ${hardware.name}`.trim()
          : hardware.name;
        return {
          value: hardware.id,
          label: displayName,
          _data: hardware,
        };
      }),
    [hardwareTypes],
  );

  const locationOptions = useMemo(
    () =>
      locations.map((location) => {
        const numeric = Number(location.available);
        const availableCount = Number.isNaN(numeric) ? 0 : numeric;
        return {
          value: location.id,
          label: location.name,
          disabled: availableCount === 0,
          _data: { ...location, availableCount },
        };
      }),
    [locations],
  );

  // ESC-to-close (only when visible and not currently submitting)
  useEffect(() => {
    if (!visible) return;
    const onKey = (event) => {
      if (event.key === 'Escape') onCancel?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, onCancel]);

  // ----------------------------- render -----------------------------

  const renderHardwareItem = (option) => {
    const hardware = option._data;
    const availableCount = Number(hardware.available_count) || 0;
    return (
      <div className='flex flex-col gap-1'>
        <span className='text-sm font-semibold'>{option.label}</span>
        <div className='flex items-center gap-2 text-xs text-muted'>
          <span>
            {t('最大GPU数量')}: {hardware.max_gpus}
          </span>
          <StatusChip tone={availableCount > 0 ? 'green' : 'red'} size='xs'>
            {t('可用数量')}: {availableCount}
          </StatusChip>
        </div>
      </div>
    );
  };

  const renderLocationItem = (option) => {
    const location = option._data;
    const availableCount = location.availableCount;
    const locationLabel =
      location.region ||
      location.country ||
      (location.iso2 ? location.iso2.toUpperCase() : '') ||
      location.code ||
      '';
    return (
      <div className='flex flex-col gap-1'>
        <div className='flex items-center gap-2'>
          <span className='text-sm font-semibold'>{location.name}</span>
          {locationLabel ? (
            <StatusChip tone='blue' size='xs'>
              {locationLabel}
            </StatusChip>
          ) : null}
        </div>
        <span
          className={`text-xs ${
            availableCount > 0 ? 'text-success' : 'text-danger'
          }`}
        >
          {t('可用数量')}: {availableCount}
        </span>
      </div>
    );
  };

  const priceUnavailableContent = (
    <div className='mt-3'>
      {loadingPrice ? (
        <div className='inline-flex items-center gap-2'>
          <Spinner size='sm' />
          <span className='text-xs text-muted'>{t('价格计算中...')}</span>
        </div>
      ) : (
        <span className='text-xs text-muted'>
          {isPriceReady
            ? t('价格暂时不可用，请稍后重试')
            : t('完成硬件类型、部署位置、副本数量等配置后，将自动计算价格')}
        </span>
      )}
    </div>
  );

  return (
    <Modal state={modalState}>
      <ModalBackdrop variant='blur'>
        <ModalContainer size='4xl' placement='center' className='max-w-[95vw]'>
          <ModalDialog className='bg-background/95 backdrop-blur'>
            <ModalHeader className='border-b border-border'>
              <span>{t('新建容器部署')}</span>
            </ModalHeader>
            <ModalBody className='max-h-[70vh] overflow-y-auto px-6 py-5'>
              {/* Quick nav */}
              <div className='mb-3 flex flex-wrap items-center justify-end gap-2'>
                <Button
                  size='sm'
                  variant='tertiary'
                  onPress={() => scrollToSection(basicSectionRef)}
                >
                  {t('部署配置')}
                </Button>
                <Button
                  size='sm'
                  variant='tertiary'
                  onPress={() => scrollToSection(priceSectionRef)}
                >
                  {t('价格预估')}
                </Button>
                <Button
                  size='sm'
                  variant='tertiary'
                  onPress={() => scrollToSection(advancedSectionRef)}
                >
                  {t('高级配置')}
                </Button>
              </div>

              {/* 部署配置 */}
              <div ref={basicSectionRef} className='mb-4'>
                <Card>
                  <Card.Content className='space-y-4 p-5'>
                    <h6 className='m-0 text-base font-semibold text-foreground'>
                      {t('部署配置')}
                    </h6>

                    <div className='space-y-2'>
                      <FieldLabel required>{t('容器名称')}</FieldLabel>
                      <input
                        type='text'
                        value={values.resource_private_name || ''}
                        onChange={(event) =>
                          setField('resource_private_name')(event.target.value)
                        }
                        placeholder={t('请输入容器名称')}
                        className={inputClass}
                      />
                      <FieldError>{errors.resource_private_name}</FieldError>
                    </div>

                    <div className='space-y-2'>
                      <FieldLabel>{t('镜像选择')}</FieldLabel>
                      <div className='inline-flex overflow-hidden rounded-xl border border-border'>
                        {[
                          { value: 'builtin', label: t('内置 Ollama 镜像') },
                          { value: 'custom', label: t('自定义镜像') },
                        ].map((mode) => {
                          const active = mode.value === imageMode;
                          return (
                            <button
                              key={mode.value}
                              type='button'
                              onClick={() => setImageMode(mode.value)}
                              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                                active
                                  ? 'bg-foreground text-background'
                                  : 'bg-background text-muted hover:bg-surface-secondary'
                              }`}
                            >
                              {mode.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className='space-y-2'>
                      <FieldLabel required>{t('镜像地址')}</FieldLabel>
                      <input
                        type='text'
                        value={values.image_url || ''}
                        onChange={(event) => {
                          const v = event.target.value;
                          setField('image_url')(v);
                          if (imageMode === 'custom')
                            customImageRef.current = v;
                        }}
                        placeholder={t('例如：nginx:latest')}
                        disabled={imageMode === 'builtin'}
                        className={inputClass}
                      />
                      <FieldError>{errors.image_url}</FieldError>
                    </div>

                    {imageMode === 'builtin' && (
                      <div className='flex flex-wrap items-center gap-2'>
                        <span className='text-xs text-muted'>
                          {t('系统已为该部署准备 Ollama 镜像与随机 API Key')}
                        </span>
                        <input
                          type='text'
                          readOnly
                          value={autoOllamaKey}
                          className={`${inputClassSm} w-[220px]`}
                        />
                        <Button
                          size='sm'
                          variant='tertiary'
                          onPress={async () => {
                            if (!autoOllamaKey) return;
                            const copied = await copy(autoOllamaKey);
                            if (copied)
                              showSuccess(t('已复制自动生成的 API Key'));
                            else showError(t('复制失败，请手动选择文本复制'));
                          }}
                        >
                          <Copy size={14} />
                          {t('复制')}
                        </Button>
                      </div>
                    )}

                    <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                      <div className='space-y-2'>
                        <FieldLabel required>{t('硬件类型')}</FieldLabel>
                        <RichSingleSelect
                          value={values.hardware_id}
                          options={hardwareOptions}
                          placeholder={t('选择硬件类型')}
                          loading={loadingHardware}
                          onChange={(value) => {
                            const nextMaxGpus = getHardwareMaxGpus(value);
                            setValues((prev) => ({
                              ...prev,
                              hardware_id: value,
                              gpus_per_container: nextMaxGpus,
                              location_ids: [],
                            }));
                          }}
                          renderItem={renderHardwareItem}
                          renderSelected={(option) =>
                            hardwareLabelMap[option.value] ||
                            option.label ||
                            String(option.value)
                          }
                        />
                        <FieldError>{errors.hardware_id}</FieldError>
                      </div>
                      <div className='space-y-2'>
                        <FieldLabel>{t('最大GPU数量')}</FieldLabel>
                        <input
                          type='number'
                          min={1}
                          max={getHardwareMaxGpus(values.hardware_id)}
                          step={1}
                          value={values.gpus_per_container ?? 1}
                          disabled
                          className={inputClass}
                        />
                      </div>
                    </div>

                    {typeof hardwareTotalAvailable === 'number' && (
                      <div className='text-xs text-muted'>
                        {t('全部硬件总可用资源')}: {hardwareTotalAvailable}
                      </div>
                    )}

                    <div className='space-y-2'>
                      <FieldLabel required>
                        <span className='inline-flex items-center gap-2'>
                          {t('部署位置')}
                          {loadingReplicas ? <Spinner size='sm' /> : null}
                        </span>
                      </FieldLabel>
                      <RichMultiSelect
                        value={values.location_ids}
                        options={locationOptions}
                        placeholder={
                          !values.hardware_id
                            ? t('请先选择硬件类型')
                            : loadingReplicas
                              ? t('正在加载可用部署位置...')
                              : t('选择部署位置（可多选）')
                        }
                        loading={loadingReplicas}
                        disabled={!values.hardware_id || loadingReplicas}
                        onChange={setField('location_ids')}
                        renderItem={renderLocationItem}
                        renderSelectedLabel={(option, v) =>
                          loadingReplicas
                            ? t('部署位置加载中...')
                            : option?.label || locationLabelMap[v] || String(v)
                        }
                      />
                      <FieldError>{errors.location_ids}</FieldError>
                    </div>

                    {typeof locationTotalAvailable === 'number' && (
                      <div className='text-xs text-muted'>
                        {t('全部地区总可用资源')}: {locationTotalAvailable}
                      </div>
                    )}

                    <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
                      <div className='space-y-2'>
                        <FieldLabel required>{t('副本数量')}</FieldLabel>
                        <input
                          type='number'
                          min={1}
                          max={maxAvailableReplicas || 100}
                          value={values.replica_count ?? 1}
                          onChange={setNumberField('replica_count')}
                          className={inputClass}
                        />
                        {maxAvailableReplicas > 0 ? (
                          <FieldHint>
                            {t('最大可用')}: {maxAvailableReplicas}
                          </FieldHint>
                        ) : null}
                        <FieldError>{errors.replica_count}</FieldError>
                      </div>
                      <div className='space-y-2'>
                        <FieldLabel required>
                          {t('运行时长（小时）')}
                        </FieldLabel>
                        <input
                          type='number'
                          min={1}
                          max={8760}
                          value={values.duration_hours ?? 1}
                          onChange={setNumberField('duration_hours')}
                          className={inputClass}
                        />
                        <FieldError>{errors.duration_hours}</FieldError>
                      </div>
                      <div className='space-y-2'>
                        <FieldLabel>
                          <span className='inline-flex items-center gap-1'>
                            {t('流量端口')}
                            <Tooltip content={t('容器对外服务的端口号，可选')}>
                              <HelpCircle size={14} className='text-muted' />
                            </Tooltip>
                          </span>
                        </FieldLabel>
                        <input
                          type='number'
                          min={1}
                          max={65535}
                          value={values.traffic_port ?? DEFAULT_TRAFFIC_PORT}
                          onChange={setNumberField('traffic_port')}
                          disabled={imageMode === 'builtin'}
                          className={inputClass}
                          placeholder={`${DEFAULT_TRAFFIC_PORT}`}
                        />
                      </div>
                    </div>

                    {/* 高级配置 (collapsible) */}
                    <div ref={advancedSectionRef} className='mt-4'>
                      <details
                        className='group rounded-xl border border-border bg-background'
                        open={advancedOpen}
                        onToggle={(event) =>
                          setAdvancedOpen(event.currentTarget.open)
                        }
                      >
                        <summary className='flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-foreground'>
                          <span>{t('高级配置')}</span>
                          <ChevronDown
                            size={16}
                            className='text-muted transition-transform group-open:rotate-180'
                          />
                        </summary>

                        <div className='space-y-4 border-t border-border px-3 py-3'>
                          {/* 镜像仓库配置 */}
                          <Card>
                            <Card.Content className='space-y-4 p-5'>
                              <h6 className='m-0 text-base font-semibold text-foreground'>
                                {t('镜像仓库配置')}
                              </h6>
                              <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                                <div className='space-y-2'>
                                  <FieldLabel>{t('镜像仓库用户名')}</FieldLabel>
                                  <input
                                    type='text'
                                    value={values.registry_username || ''}
                                    onChange={(event) =>
                                      setField('registry_username')(
                                        event.target.value,
                                      )
                                    }
                                    placeholder={t('私有镜像仓库的用户名')}
                                    className={inputClass}
                                  />
                                </div>
                                <div className='space-y-2'>
                                  <FieldLabel>{t('镜像仓库密码')}</FieldLabel>
                                  <input
                                    type='password'
                                    value={values.registry_secret || ''}
                                    onChange={(event) =>
                                      setField('registry_secret')(
                                        event.target.value,
                                      )
                                    }
                                    placeholder={t('私有镜像仓库的密码')}
                                    className={inputClass}
                                  />
                                </div>
                              </div>
                            </Card.Content>
                          </Card>

                          <div className='border-t border-border' />

                          {/* 容器启动配置 */}
                          <Card>
                            <Card.Content className='space-y-4 p-5'>
                              <h6 className='m-0 text-base font-semibold text-foreground'>
                                {t('容器启动配置')}
                              </h6>

                              <div className='space-y-2'>
                                <div className='text-sm font-medium text-foreground'>
                                  {t('启动命令 (Entrypoint)')}
                                </div>
                                {entrypoint.map((cmd, index) => (
                                  <div
                                    key={index}
                                    className='flex items-center gap-2'
                                  >
                                    <input
                                      type='text'
                                      value={cmd}
                                      onChange={(event) =>
                                        handleArrayFieldChange(
                                          index,
                                          event.target.value,
                                          'entrypoint',
                                        )
                                      }
                                      placeholder={t('例如：/bin/bash')}
                                      className={inputClass}
                                    />
                                    <Button
                                      isIconOnly
                                      size='sm'
                                      variant='tertiary'
                                      isDisabled={entrypoint.length === 1}
                                      aria-label={t('删除')}
                                      onPress={() =>
                                        handleRemoveArrayField(
                                          index,
                                          'entrypoint',
                                        )
                                      }
                                    >
                                      <Minus size={14} />
                                    </Button>
                                  </div>
                                ))}
                                <Button
                                  size='sm'
                                  variant='tertiary'
                                  onPress={() =>
                                    handleAddArrayField('entrypoint')
                                  }
                                >
                                  <Plus size={14} />
                                  {t('添加启动命令')}
                                </Button>
                              </div>

                              <div className='space-y-2'>
                                <div className='text-sm font-medium text-foreground'>
                                  {t('启动参数 (Args)')}
                                </div>
                                {args.map((arg, index) => (
                                  <div
                                    key={index}
                                    className='flex items-center gap-2'
                                  >
                                    <input
                                      type='text'
                                      value={arg}
                                      onChange={(event) =>
                                        handleArrayFieldChange(
                                          index,
                                          event.target.value,
                                          'args',
                                        )
                                      }
                                      placeholder={t('例如：-c')}
                                      className={inputClass}
                                    />
                                    <Button
                                      isIconOnly
                                      size='sm'
                                      variant='tertiary'
                                      isDisabled={args.length === 1}
                                      aria-label={t('删除')}
                                      onPress={() =>
                                        handleRemoveArrayField(index, 'args')
                                      }
                                    >
                                      <Minus size={14} />
                                    </Button>
                                  </div>
                                ))}
                                <Button
                                  size='sm'
                                  variant='tertiary'
                                  onPress={() => handleAddArrayField('args')}
                                >
                                  <Plus size={14} />
                                  {t('添加启动参数')}
                                </Button>
                              </div>
                            </Card.Content>
                          </Card>

                          <div className='border-t border-border' />

                          {/* 环境变量 */}
                          <Card>
                            <Card.Content className='space-y-4 p-5'>
                              <h6 className='m-0 text-base font-semibold text-foreground'>
                                {t('环境变量')}
                              </h6>

                              <div className='space-y-2'>
                                <div className='text-sm font-medium text-foreground'>
                                  {t('普通环境变量')}
                                </div>
                                {envVariables.map((env, index) => (
                                  <div
                                    key={index}
                                    className='grid grid-cols-12 gap-2'
                                  >
                                    <input
                                      type='text'
                                      placeholder={t('变量名')}
                                      value={env.key}
                                      onChange={(event) =>
                                        handleEnvVariableChange(
                                          index,
                                          'key',
                                          event.target.value,
                                          'env',
                                        )
                                      }
                                      className={`${inputClass} col-span-5`}
                                    />
                                    <input
                                      type='text'
                                      placeholder={t('变量值')}
                                      value={env.value}
                                      onChange={(event) =>
                                        handleEnvVariableChange(
                                          index,
                                          'value',
                                          event.target.value,
                                          'env',
                                        )
                                      }
                                      className={`${inputClass} col-span-5`}
                                    />
                                    <div className='col-span-2 flex items-center'>
                                      <Button
                                        isIconOnly
                                        size='sm'
                                        variant='tertiary'
                                        isDisabled={envVariables.length === 1}
                                        aria-label={t('删除')}
                                        onPress={() =>
                                          handleRemoveEnvVariable(index, 'env')
                                        }
                                      >
                                        <Minus size={14} />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                                <Button
                                  size='sm'
                                  variant='tertiary'
                                  onPress={() => handleAddEnvVariable('env')}
                                >
                                  <Plus size={14} />
                                  {t('添加环境变量')}
                                </Button>
                              </div>

                              <div className='space-y-2'>
                                <div className='text-sm font-medium text-foreground'>
                                  {t('密钥环境变量')}
                                </div>
                                {secretEnvVariables.map((env, index) => {
                                  const isAutoSecret =
                                    imageMode === 'builtin' &&
                                    env.key === 'OLLAMA_API_KEY';
                                  return (
                                    <div
                                      key={index}
                                      className='grid grid-cols-12 gap-2'
                                    >
                                      <input
                                        type='text'
                                        placeholder={t('变量名')}
                                        value={env.key}
                                        onChange={(event) =>
                                          handleEnvVariableChange(
                                            index,
                                            'key',
                                            event.target.value,
                                            'secret',
                                          )
                                        }
                                        disabled={isAutoSecret}
                                        className={`${inputClass} col-span-5`}
                                      />
                                      <input
                                        type='password'
                                        placeholder={t('变量值')}
                                        value={env.value}
                                        onChange={(event) =>
                                          handleEnvVariableChange(
                                            index,
                                            'value',
                                            event.target.value,
                                            'secret',
                                          )
                                        }
                                        disabled={isAutoSecret}
                                        className={`${inputClass} col-span-5`}
                                      />
                                      <div className='col-span-2 flex items-center'>
                                        <Button
                                          isIconOnly
                                          size='sm'
                                          variant='tertiary'
                                          isDisabled={
                                            secretEnvVariables.length === 1 ||
                                            isAutoSecret
                                          }
                                          aria-label={t('删除')}
                                          onPress={() =>
                                            handleRemoveEnvVariable(
                                              index,
                                              'secret',
                                            )
                                          }
                                        >
                                          <Minus size={14} />
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })}
                                <Button
                                  size='sm'
                                  variant='tertiary'
                                  onPress={() => handleAddEnvVariable('secret')}
                                >
                                  <Plus size={14} />
                                  {t('添加密钥环境变量')}
                                </Button>
                              </div>
                            </Card.Content>
                          </Card>
                        </div>
                      </details>
                    </div>
                  </Card.Content>
                </Card>
              </div>

              {/* 价格预估 */}
              <div ref={priceSectionRef} className='mb-4'>
                <Card>
                  <Card.Content className='space-y-4 p-5'>
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                      <h6 className='m-0 text-base font-semibold text-foreground'>
                        {t('价格预估')}
                      </h6>
                      <div className='flex flex-wrap items-center gap-3'>
                        <span className='text-xs text-muted'>
                          {t('计价币种')}
                        </span>
                        <div className='inline-flex overflow-hidden rounded-xl border border-border'>
                          {[
                            { value: 'usdc', label: 'USDC' },
                            { value: 'iocoin', label: 'IOCOIN' },
                          ].map((option) => {
                            const active = option.value === priceCurrency;
                            return (
                              <button
                                key={option.value}
                                type='button'
                                onClick={() => setPriceCurrency(option.value)}
                                className={`px-3 py-1 text-xs font-medium transition-colors ${
                                  active
                                    ? 'bg-foreground text-background'
                                    : 'bg-background text-muted hover:bg-surface-secondary'
                                }`}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                        <StatusChip tone='blue'>{currencyLabel}</StatusChip>
                      </div>
                    </div>

                    {priceEstimation ? (
                      <div className='flex w-full flex-col gap-4'>
                        <div className='grid w-full gap-4 md:grid-cols-2 lg:grid-cols-3'>
                          <div className='flex flex-col gap-1 rounded-md border border-border bg-surface-secondary px-4 py-3'>
                            <span className='text-xs text-muted'>
                              {t('预估总费用')}
                            </span>
                            <div className='text-2xl font-semibold text-foreground'>
                              {typeof priceEstimation.estimated_cost ===
                              'number'
                                ? `${priceEstimation.estimated_cost.toFixed(4)} ${currencyLabel}`
                                : '--'}
                            </div>
                          </div>
                          <div className='flex flex-col gap-1 rounded-md border border-border bg-surface-secondary px-4 py-3'>
                            <span className='text-xs text-muted'>
                              {t('小时费率')}
                            </span>
                            <span className='text-sm font-semibold text-foreground'>
                              {typeof priceEstimation.price_breakdown
                                ?.hourly_rate === 'number'
                                ? `${priceEstimation.price_breakdown.hourly_rate.toFixed(4)} ${currencyLabel}/h`
                                : '--'}
                            </span>
                          </div>
                          <div className='flex flex-col gap-1 rounded-md border border-border bg-surface-secondary px-4 py-3'>
                            <span className='text-xs text-muted'>
                              {t('计算成本')}
                            </span>
                            <span className='text-sm font-semibold text-foreground'>
                              {typeof priceEstimation.price_breakdown
                                ?.compute_cost === 'number'
                                ? `${priceEstimation.price_breakdown.compute_cost.toFixed(4)} ${currencyLabel}`
                                : '--'}
                            </span>
                          </div>
                        </div>

                        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                          {priceSummaryItems.map((item) => (
                            <div
                              key={item.key}
                              className='flex items-center justify-between gap-3 rounded-md border border-border bg-surface-secondary px-3 py-2'
                            >
                              <span className='text-xs text-muted'>
                                {item.label}
                              </span>
                              <span className='text-sm font-semibold text-foreground'>
                                {item.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      priceUnavailableContent
                    )}

                    {priceEstimation && loadingPrice && (
                      <div className='inline-flex items-center gap-2'>
                        <Spinner size='sm' />
                        <span className='text-xs text-muted'>
                          {t('价格重新计算中...')}
                        </span>
                      </div>
                    )}
                  </Card.Content>
                </Card>
              </div>
            </ModalBody>
            <ModalFooter className='border-t border-border'>
              <Button variant='tertiary' onPress={onCancel}>
                {t('取消')}
              </Button>
              <Button
                color='primary'
                isPending={submitting}
                onPress={handleSubmit}
              >
                {t('创建')}
              </Button>
            </ModalFooter>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </Modal>
  );
};

export default CreateDeploymentModal;
