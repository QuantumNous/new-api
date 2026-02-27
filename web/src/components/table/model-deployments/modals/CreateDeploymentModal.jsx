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

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Switch,
  Collapse,
  Card,
  Divider,
  Button,
  Typography,
  Space,
  Spin,
  Tag,
  Row,
  Col,
  Tooltip,
  Radio,
} from '@douyinfe/semi-ui';
import {
  IconPlus,
  IconMinus,
  IconHelpCircle,
  IconCopy,
} from '@douyinfe/semi-icons';
import { API } from '../../../../helpers';
import { showError, showSuccess, copy } from '../../../../helpers';

const { Text, Title } = Typography;
const { Option } = Select;
const RadioGroup = Radio.Group;

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

const CreateDeploymentModal = ({ visible, onCancel, onSuccess, t }) => {
  const [formApi, setFormApi] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Resource data states
  const [hardwareTypes, setHardwareTypes] = useState([]);
  const [hardwareTotalAvailable, setHardwareTotalAvailable] = useState(null);
  const [locations, setLocations] = useState([]);
  const [locationTotalAvailable, setLocationTotalAvailable] = useState(null);
  const [priceEstimation, setPriceEstimation] = useState(null);

  // UI states
  const [loadingHardware, setLoadingHardware] = useState(false);
  const [loadingReplicas, setLoadingReplicas] = useState(false);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
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
  const [formDefaults, setFormDefaults] = useState({
    resource_private_name: '',
    image_url: BUILTIN_IMAGE,
    gpus_per_container: 1,
    replica_count: 1,
    duration_hours: 1,
    traffic_port: DEFAULT_TRAFFIC_PORT,
    location_ids: [],
  });
  const [formKey, setFormKey] = useState(0);
  const [priceCurrency, setPriceCurrency] = useState('usdc');
  const normalizeCurrencyValue = (value) => {
    if (typeof value === 'string') return value.toLowerCase();
    if (value && typeof value === 'object') {
      if (typeof value.value === 'string') return value.value.toLowerCase();
      if (typeof value.target?.value === 'string') {
        return value.target.value.toLowerCase();
      }
    }
    return 'usdc';
  };

  const handleCurrencyChange = (value) => {
    const normalized = normalizeCurrencyValue(value);
    setPriceCurrency(normalized);
  };

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

  // Form values for price calculation
  const [selectedHardwareId, setSelectedHardwareId] = useState(null);
  const [selectedLocationIds, setSelectedLocationIds] = useState([]);
  const [gpusPerContainer, setGpusPerContainer] = useState(1);
  const [durationHours, setDurationHours] = useState(1);
  const [replicaCount, setReplicaCount] = useState(1);

  useEffect(() => {
    if (!selectedHardwareId) {
      return;
    }

    const nextMaxGpus = getHardwareMaxGpus(selectedHardwareId);
    if (gpusPerContainer !== nextMaxGpus) {
      setGpusPerContainer(nextMaxGpus);
    }
    if (formApi) {
      formApi.setValue('gpus_per_container', nextMaxGpus);
    }
  }, [selectedHardwareId, hardwareTypes, formApi, gpusPerContainer]);

  // Load initial data when modal opens
  useEffect(() => {
    if (visible) {
      loadHardwareTypes();
      resetFormState();
    }
  }, [visible]);

  // Load available replicas when hardware or locations change
  useEffect(() => {
    if (!visible) {
      return;
    }
    if (selectedHardwareId && gpusPerContainer > 0) {
      loadAvailableReplicas(selectedHardwareId, gpusPerContainer);
    }
  }, [selectedHardwareId, gpusPerContainer, visible]);

  // Calculate price when relevant parameters change
  useEffect(() => {
    if (!visible) {
      return;
    }
    if (
      selectedHardwareId &&
      selectedLocationIds.length > 0 &&
      gpusPerContainer > 0 &&
      durationHours > 0 &&
      replicaCount > 0
    ) {
      calculatePrice();
    } else {
      setPriceEstimation(null);
    }
  }, [
    selectedHardwareId,
    selectedLocationIds,
    gpusPerContainer,
    durationHours,
    replicaCount,
    priceCurrency,
    visible,
  ]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const prevMode = prevImageModeRef.current;
    if (prevMode === imageMode) {
      return;
    }

    if (imageMode === 'builtin') {
      if (prevMode === 'custom') {
        if (formApi) {
          customImageRef.current =
            formApi.getValue('image_url') || customImageRef.current;
          customTrafficPortRef.current =
            formApi.getValue('traffic_port') ?? customTrafficPortRef.current;
        }
        customSecretEnvRef.current = secretEnvVariables.map((item) => ({
          ...item,
        }));
        customEnvRef.current = envVariables.map((item) => ({ ...item }));
      }
      const newKey = generateRandomKey();
      setAutoOllamaKey(newKey);
      setSecretEnvVariables([{ key: 'OLLAMA_API_KEY', value: newKey }]);
      setEnvVariables([{ key: '', value: '' }]);
      if (formApi) {
        formApi.setValue('image_url', BUILTIN_IMAGE);
        formApi.setValue('traffic_port', DEFAULT_TRAFFIC_PORT);
      }
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
      if (formApi) {
        const restoredImage = customImageRef.current || '';
        formApi.setValue('image_url', restoredImage);
        if (customTrafficPortRef.current) {
          formApi.setValue('traffic_port', customTrafficPortRef.current);
        }
      }
    }

    prevImageModeRef.current = imageMode;
  }, [imageMode, visible, secretEnvVariables, envVariables, formApi]);

  useEffect(() => {
    if (!visible || !formApi) {
      return;
    }
    if (imageMode === 'builtin') {
      formApi.setValue('image_url', BUILTIN_IMAGE);
    }
  }, [formApi, imageMode, visible]);

  useEffect(() => {
    if (!formApi) {
      return;
    }
    if (selectedHardwareId !== null && selectedHardwareId !== undefined) {
      formApi.setValue('hardware_id', selectedHardwareId);
    }
  }, [formApi, selectedHardwareId]);

  useEffect(() => {
    if (!formApi) {
      return;
    }
    formApi.setValue('location_ids', selectedLocationIds);
  }, [formApi, selectedLocationIds]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    if (selectedHardwareId) {
      return;
    } else {
      setLocations([]);
      setSelectedLocationIds([]);
      setLocationTotalAvailable(null);
      setLoadingReplicas(false);
      replicaRequestIdRef.current = 0;
      if (formApi) {
        formApi.setValue('location_ids', []);
      }
    }
  }, [selectedHardwareId, visible, formApi]);

  const resetFormState = () => {
    const randomName = `deployment-${Math.random().toString(36).slice(2, 8)}`;
    const generatedKey = generateRandomKey();

    setSelectedHardwareId(null);
    setSelectedLocationIds([]);
    setGpusPerContainer(1);
    setDurationHours(1);
    setReplicaCount(1);
    setPriceEstimation(null);
    setLocations([]);
    setLocationTotalAvailable(null);
    setHardwareTotalAvailable(null);
    setEnvVariables([{ key: '', value: '' }]);
    setSecretEnvVariables([{ key: 'OLLAMA_API_KEY', value: generatedKey }]);
    setEntrypoint(['']);
    setArgs(['']);
    setShowAdvanced(false);
    setImageMode('builtin');
    setAutoOllamaKey(generatedKey);
    customSecretEnvRef.current = null;
    customEnvRef.current = null;
    customImageRef.current = '';
    customTrafficPortRef.current = DEFAULT_TRAFFIC_PORT;
    prevImageModeRef.current = 'builtin';
    setFormDefaults({
      resource_private_name: randomName,
      image_url: BUILTIN_IMAGE,
      gpus_per_container: 1,
      replica_count: 1,
      duration_hours: 1,
      traffic_port: DEFAULT_TRAFFIC_PORT,
      location_ids: [],
    });
    setFormKey((prev) => prev + 1);
    setPriceCurrency('usdc');
  };

  const arraysEqual = (a = [], b = []) =>
    a.length === b.length && a.every((value, index) => value === b[index]);

  const loadHardwareTypes = async () => {
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
  };

  const loadAvailableReplicas = async (hardwareId, gpuCount) => {
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

      if (replicaRequestIdRef.current !== requestId) {
        return;
      }

      if (response.data.success) {
        const replicasList = response.data.data?.replicas || [];

        const nextLocationsMap = new Map();
        replicasList.forEach((replica) => {
          const rawId = replica?.location_id ?? replica?.location?.id;
          if (rawId === null || rawId === undefined) {
            return;
          }
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
  };

  const calculatePrice = async () => {
    try {
      setLoadingPrice(true);
      const requestData = {
        location_ids: selectedLocationIds,
        hardware_id: selectedHardwareId,
        gpus_per_container: gpusPerContainer,
        duration_hours: durationHours,
        replica_count: replicaCount,
        currency: priceCurrency?.toLowerCase?.() || priceCurrency,
        duration_type: 'hour',
        duration_qty: durationHours,
        hardware_qty: gpusPerContainer,
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
  };

  const handleSubmit = async (values) => {
    try {
      setSubmitting(true);

      // Prepare environment variables
      const envVars = {};
      envVariables.forEach((env) => {
        if (env.key && env.value) {
          envVars[env.key] = env.value;
        }
      });

      const secretEnvVars = {};
      secretEnvVariables.forEach((env) => {
        if (env.key && env.value) {
          secretEnvVars[env.key] = env.value;
        }
      });

      if (imageMode === 'builtin') {
        if (!secretEnvVars.OLLAMA_API_KEY) {
          const ensuredKey = autoOllamaKey || generateRandomKey();
          secretEnvVars.OLLAMA_API_KEY = ensuredKey;
          setAutoOllamaKey(ensuredKey);
        }
      }

      // Prepare entrypoint and args
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
        gpus_per_container: gpusPerContainer,
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
  };

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

  useEffect(() => {
    if (!visible) {
      return;
    }

    if (!selectedHardwareId) {
      if (selectedLocationIds.length > 0) {
        setSelectedLocationIds([]);
        if (formApi) {
          formApi.setValue('location_ids', []);
        }
      }
      return;
    }

    const validLocationIds = locations
      .filter((location) => (Number(location.available) || 0) > 0)
      .map((location) => location.id);

    if (validLocationIds.length === 0) {
      if (selectedLocationIds.length > 0) {
        setSelectedLocationIds([]);
        if (formApi) {
          formApi.setValue('location_ids', []);
        }
      }
      return;
    }

    if (selectedLocationIds.length === 0) {
      return;
    }

    const filteredSelection = selectedLocationIds.filter((id) =>
      validLocationIds.includes(id),
    );

    if (!arraysEqual(selectedLocationIds, filteredSelection)) {
      setSelectedLocationIds(filteredSelection);
      if (formApi) {
        formApi.setValue('location_ids', filteredSelection);
      }
    }
  }, [locations, selectedHardwareId, selectedLocationIds, visible, formApi]);

  const maxAvailableReplicas = useMemo(() => {
    if (!selectedLocationIds.length) return 0;

    return locations
      .filter((location) => selectedLocationIds.includes(location.id))
      .reduce((total, location) => {
        const availableValue = Number(location.available);
        return total + (Number.isNaN(availableValue) ? 0 : availableValue);
      }, 0);
  }, [selectedLocationIds, locations]);

  const isPriceReady = useMemo(
    () =>
      selectedHardwareId &&
      selectedLocationIds.length > 0 &&
      gpusPerContainer > 0 &&
      durationHours > 0 &&
      replicaCount > 0,
    [
      selectedHardwareId,
      selectedLocationIds,
      gpusPerContainer,
      durationHours,
      replicaCount,
    ],
  );

  const currencyLabel = (
    priceEstimation?.currency ||
    priceCurrency ||
    ''
  ).toUpperCase();
  const selectedHardwareLabel = selectedHardwareId
    ? hardwareLabelMap[selectedHardwareId]
    : '';
  const selectedLocationNames = selectedLocationIds
    .map((id) => locationLabelMap[id])
    .filter(Boolean);
  const totalGpuHours =
    Number(gpusPerContainer || 0) *
    Number(replicaCount || 0) *
    Number(durationHours || 0);
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
      value: (replicaCount ?? 0).toString(),
    },
    {
      key: 'gpus',
      label: t('最大GPU数量'),
      value: (gpusPerContainer ?? 0).toString(),
    },
    {
      key: 'duration',
      label: t('运行时长（小时）'),
      value: durationHours ? durationHours.toString() : '0',
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

  const priceUnavailableContent = (
    <div style={{ marginTop: 12 }}>
      {loadingPrice ? (
        <Space spacing={8} align='center'>
          <Spin size='small' />
          <Text size='small' type='tertiary'>
            {t('价格计算中...')}
          </Text>
        </Space>
      ) : (
        <Text size='small' type='tertiary'>
          {isPriceReady
            ? t('价格暂时不可用，请稍后重试')
            : t('完成硬件类型、部署位置、副本数量等配置后，将自动计算价格')}
        </Text>
      )}
    </div>
  );

  useEffect(() => {
    if (!visible || !formApi) {
      return;
    }
    if (maxAvailableReplicas > 0 && replicaCount > maxAvailableReplicas) {
      setReplicaCount(maxAvailableReplicas);
      formApi.setValue('replica_count', maxAvailableReplicas);
    }
  }, [maxAvailableReplicas, replicaCount, visible, formApi]);

  return (
    <Modal
      title={t('新建容器部署')}
      visible={visible}
      onCancel={onCancel}
      onOk={() => formApi?.submitForm()}
      okText={t('创建')}
      cancelText={t('取消')}
      width={800}
      confirmLoading={submitting}
      style={{ top: 20 }}
    >
      <Form
        key={formKey}
        initValues={formDefaults}
        getFormApi={setFormApi}
        onSubmit={handleSubmit}
        style={{ maxHeight: '70vh', overflowY: 'auto' }}
        labelPosition='top'
      >
        <Space
          wrap
          spacing={8}
          style={{ justifyContent: 'flex-end', width: '100%', marginBottom: 8 }}
        >
          <Button
            size='small'
            theme='borderless'
            type='tertiary'
            onClick={() => scrollToSection(basicSectionRef)}
          >
            {t('部署配置')}
          </Button>
          <Button
            size='small'
            theme='borderless'
            type='tertiary'
            onClick={() => scrollToSection(priceSectionRef)}
          >
            {t('价格预估')}
          </Button>
          <Button
            size='small'
            theme='borderless'
            type='tertiary'
            onClick={() => scrollToSection(advancedSectionRef)}
          >
            {t('高级配置')}
          </Button>
        </Space>

        <div ref={basicSectionRef}>
          <Card className='mb-4'>
            <Title heading={6}>{t('部署配置')}</Title>

            <Form.Input
              field='resource_private_name'
              label={t('容器名称')}
              placeholder={t('请输入容器名称')}
              rules={[{ required: true, message: t('请输入容器名称') }]}
            />

            <div className='mt-2'>
              <Text strong>{t('镜像选择')}</Text>
              <div style={{ marginTop: 8 }}>
                <RadioGroup
                  type='button'
                  value={imageMode}
                  onChange={(value) =>
                    setImageMode(value?.target?.value ?? value)
                  }
                >
                  <Radio value='builtin'>{t('内置 Ollama 镜像')}</Radio>
                  <Radio value='custom'>{t('自定义镜像')}</Radio>
                </RadioGroup>
              </div>
            </div>

            <Form.Input
              field='image_url'
              label={t('镜像地址')}
              placeholder={t('例如：nginx:latest')}
              rules={[{ required: true, message: t('请输入镜像地址') }]}
              disabled={imageMode === 'builtin'}
              onChange={(value) => {
                if (imageMode === 'custom') {
                  customImageRef.current = value;
                }
              }}
            />

            {imageMode === 'builtin' && (
              <Space align='center' spacing={8} className='mt-2'>
                <Text size='small' type='tertiary'>
                  {t('系统已为该部署准备 Ollama 镜像与随机 API Key')}
                </Text>
                <Input
                  readOnly
                  value={autoOllamaKey}
                  size='small'
                  style={{ width: 220 }}
                />
                <Button
                  icon={<IconCopy />}
                  size='small'
                  theme='borderless'
                  onClick={async () => {
                    if (!autoOllamaKey) {
                      return;
                    }
                    const copied = await copy(autoOllamaKey);
                    if (copied) {
                      showSuccess(t('已复制自动生成的 API Key'));
                    } else {
                      showError(t('复制失败，请手动选择文本复制'));
                    }
                  }}
                >
                  {t('复制')}
                </Button>
              </Space>
            )}

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Select
                  field='hardware_id'
                  label={t('硬件类型')}
                  placeholder={t('选择硬件类型')}
                  loading={loadingHardware}
                  rules={[{ required: true, message: t('请选择硬件类型') }]}
                  onChange={(value) => {
                    const nextMaxGpus = getHardwareMaxGpus(value);
                    setSelectedHardwareId(value);
                    setGpusPerContainer(nextMaxGpus);
                    setSelectedLocationIds([]);
                    if (formApi) {
                      formApi.setValue('location_ids', []);
                      formApi.setValue('gpus_per_container', nextMaxGpus);
                    }
                  }}
                  style={{ width: '100%' }}
                  dropdownStyle={{ maxHeight: 360, overflowY: 'auto' }}
                  renderSelectedItem={(optionNode) =>
                    optionNode
                      ? hardwareLabelMap[optionNode?.value] ||
                        optionNode?.label ||
                        optionNode?.value ||
                        ''
                      : ''
                  }
                >
                  {hardwareTypes.map((hardware) => {
                    const displayName = hardware.brand_name
                      ? `${hardware.brand_name} ${hardware.name}`.trim()
                      : hardware.name;
                    const availableCount =
                      typeof hardware.available_count === 'number'
                        ? hardware.available_count
                        : 0;
                    const hasAvailability = availableCount > 0;

                    return (
                      <Option key={hardware.id} value={hardware.id}>
                        <div className='flex flex-col gap-1'>
                          <Text strong>{displayName}</Text>
                          <div className='flex items-center gap-2 text-xs text-[var(--semi-color-text-2)]'>
                            <span>
                              {t('最大GPU数量')}: {hardware.max_gpus}
                            </span>
                            <Tag
                              color={hasAvailability ? 'green' : 'red'}
                              size='small'
                            >
                              {t('可用数量')}: {availableCount}
                            </Tag>
                          </div>
                        </div>
                      </Option>
                    );
                  })}
                </Form.Select>
              </Col>
              <Col xs={24} md={12}>
                <Form.InputNumber
                  field='gpus_per_container'
                  label={t('最大GPU数量')}
                  placeholder={1}
                  min={1}
                  max={getHardwareMaxGpus(selectedHardwareId)}
                  step={1}
                  disabled
                  style={{ width: '100%' }}
                />
              </Col>
            </Row>

            {typeof hardwareTotalAvailable === 'number' && (
              <Text size='small' type='tertiary'>
                {t('全部硬件总可用资源')}: {hardwareTotalAvailable}
              </Text>
            )}

            <Form.Select
              field='location_ids'
              label={
                <Space>
                  {t('部署位置')}
                  {loadingReplicas && <Spin size='small' />}
                </Space>
              }
              placeholder={
                !selectedHardwareId
                  ? t('请先选择硬件类型')
                  : loadingReplicas
                    ? t('正在加载可用部署位置...')
                    : t('选择部署位置（可多选）')
              }
              multiple
              loading={loadingReplicas}
              disabled={!selectedHardwareId || loadingReplicas}
              rules={[{ required: true, message: t('请选择至少一个部署位置') }]}
              onChange={(value) => setSelectedLocationIds(value)}
              style={{ width: '100%' }}
              dropdownStyle={{ maxHeight: 360, overflowY: 'auto' }}
              renderSelectedItem={(optionNode) => ({
                isRenderInTag: true,
                content: !optionNode
                  ? ''
                  : loadingReplicas
                    ? t('部署位置加载中...')
                    : locationLabelMap[optionNode?.value] ||
                      optionNode?.label ||
                      optionNode?.value ||
                      '',
              })}
            >
              {locations.map((location) => {
                const numeric = Number(location.available);
                const availableCount = Number.isNaN(numeric) ? 0 : numeric;
                const locationLabel =
                  location.region ||
                  location.country ||
                  (location.iso2 ? location.iso2.toUpperCase() : '') ||
                  location.code ||
                  '';
                const disableOption = availableCount === 0;

                return (
                  <Option
                    key={location.id}
                    value={location.id}
                    disabled={disableOption}
                  >
                    <div className='flex flex-col gap-1'>
                      <div className='flex items-center gap-2'>
                        <Text strong>{location.name}</Text>
                        {locationLabel && (
                          <Tag color='blue' size='small'>
                            {locationLabel}
                          </Tag>
                        )}
                      </div>
                      <Text
                        size='small'
                        type={availableCount > 0 ? 'success' : 'danger'}
                      >
                        {t('可用数量')}: {availableCount}
                      </Text>
                    </div>
                  </Option>
                );
              })}
            </Form.Select>

            {typeof locationTotalAvailable === 'number' && (
              <Text size='small' type='tertiary'>
                {t('全部地区总可用资源')}: {locationTotalAvailable}
              </Text>
            )}

            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.InputNumber
                  field='replica_count'
                  label={t('副本数量')}
                  placeholder={1}
                  min={1}
                  max={maxAvailableReplicas || 100}
                  rules={[{ required: true, message: t('请输入副本数量') }]}
                  onChange={(value) => setReplicaCount(value)}
                  style={{ width: '100%' }}
                />
                {maxAvailableReplicas > 0 && (
                  <Text size='small' type='tertiary'>
                    {t('最大可用')}: {maxAvailableReplicas}
                  </Text>
                )}
              </Col>
              <Col xs={24} md={8}>
                <Form.InputNumber
                  field='duration_hours'
                  label={t('运行时长（小时）')}
                  placeholder={1}
                  min={1}
                  max={8760} // 1 year
                  rules={[{ required: true, message: t('请输入运行时长') }]}
                  onChange={(value) => setDurationHours(value)}
                  style={{ width: '100%' }}
                />
              </Col>
              <Col xs={24} md={8}>
                <Form.InputNumber
                  field='traffic_port'
                  label={
                    <Space>
                      {t('流量端口')}
                      <Tooltip content={t('容器对外服务的端口号，可选')}>
                        <IconHelpCircle />
                      </Tooltip>
                    </Space>
                  }
                  placeholder={DEFAULT_TRAFFIC_PORT}
                  min={1}
                  max={65535}
                  style={{ width: '100%' }}
                  disabled={imageMode === 'builtin'}
                />
              </Col>
            </Row>

            <div ref={advancedSectionRef}>
              <Collapse className='mt-4'>
                <Collapse.Panel header={t('高级配置')} itemKey='advanced'>
                  <Card>
                    <Title heading={6}>{t('镜像仓库配置')}</Title>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Input
                          field='registry_username'
                          label={t('镜像仓库用户名')}
                          placeholder={t('私有镜像仓库的用户名')}
                        />
                      </Col>
                      <Col span={12}>
                        <Form.Input
                          field='registry_secret'
                          label={t('镜像仓库密码')}
                          type='password'
                          placeholder={t('私有镜像仓库的密码')}
                        />
                      </Col>
                    </Row>
                  </Card>

                  <Divider />

                  <Card>
                    <Title heading={6}>{t('容器启动配置')}</Title>

                    <div style={{ marginBottom: 16 }}>
                      <Text strong>{t('启动命令 (Entrypoint)')}</Text>
                      {entrypoint.map((cmd, index) => (
                        <div
                          key={index}
                          style={{ display: 'flex', marginTop: 8 }}
                        >
                          <Input
                            value={cmd}
                            placeholder={t('例如：/bin/bash')}
                            onChange={(value) =>
                              handleArrayFieldChange(index, value, 'entrypoint')
                            }
                            style={{ flex: 1, marginRight: 8 }}
                          />
                          <Button
                            icon={<IconMinus />}
                            onClick={() =>
                              handleRemoveArrayField(index, 'entrypoint')
                            }
                            disabled={entrypoint.length === 1}
                          />
                        </div>
                      ))}
                      <Button
                        icon={<IconPlus />}
                        onClick={() => handleAddArrayField('entrypoint')}
                        style={{ marginTop: 8 }}
                      >
                        {t('添加启动命令')}
                      </Button>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <Text strong>{t('启动参数 (Args)')}</Text>
                      {args.map((arg, index) => (
                        <div
                          key={index}
                          style={{ display: 'flex', marginTop: 8 }}
                        >
                          <Input
                            value={arg}
                            placeholder={t('例如：-c')}
                            onChange={(value) =>
                              handleArrayFieldChange(index, value, 'args')
                            }
                            style={{ flex: 1, marginRight: 8 }}
                          />
                          <Button
                            icon={<IconMinus />}
                            onClick={() =>
                              handleRemoveArrayField(index, 'args')
                            }
                            disabled={args.length === 1}
                          />
                        </div>
                      ))}
                      <Button
                        icon={<IconPlus />}
                        onClick={() => handleAddArrayField('args')}
                        style={{ marginTop: 8 }}
                      >
                        {t('添加启动参数')}
                      </Button>
                    </div>
                  </Card>

                  <Divider />

                  <Card>
                    <Title heading={6}>{t('环境变量')}</Title>

                    <div style={{ marginBottom: 16 }}>
                      <Text strong>{t('普通环境变量')}</Text>
                      {envVariables.map((env, index) => (
                        <Row key={index} gutter={8} style={{ marginTop: 8 }}>
                          <Col span={10}>
                            <Input
                              placeholder={t('变量名')}
                              value={env.key}
                              onChange={(value) =>
                                handleEnvVariableChange(
                                  index,
                                  'key',
                                  value,
                                  'env',
                                )
                              }
                            />
                          </Col>
                          <Col span={10}>
                            <Input
                              placeholder={t('变量值')}
                              value={env.value}
                              onChange={(value) =>
                                handleEnvVariableChange(
                                  index,
                                  'value',
                                  value,
                                  'env',
                                )
                              }
                            />
                          </Col>
                          <Col span={4}>
                            <Button
                              icon={<IconMinus />}
                              onClick={() =>
                                handleRemoveEnvVariable(index, 'env')
                              }
                              disabled={envVariables.length === 1}
                            />
                          </Col>
                        </Row>
                      ))}
                      <Button
                        icon={<IconPlus />}
                        onClick={() => handleAddEnvVariable('env')}
                        style={{ marginTop: 8 }}
                      >
                        {t('添加环境变量')}
                      </Button>
                    </div>

                    <div>
                      <Text strong>{t('密钥环境变量')}</Text>
                      {secretEnvVariables.map((env, index) => {
                        const isAutoSecret =
                          imageMode === 'builtin' &&
                          env.key === 'OLLAMA_API_KEY';
                        return (
                          <Row key={index} gutter={8} style={{ marginTop: 8 }}>
                            <Col span={10}>
                              <Input
                                placeholder={t('变量名')}
                                value={env.key}
                                onChange={(value) =>
                                  handleEnvVariableChange(
                                    index,
                                    'key',
                                    value,
                                    'secret',
                                  )
                                }
                                disabled={isAutoSecret}
                              />
                            </Col>
                            <Col span={10}>
                              <Input
                                placeholder={t('变量值')}
                                type='password'
                                value={env.value}
                                onChange={(value) =>
                                  handleEnvVariableChange(
                                    index,
                                    'value',
                                    value,
                                    'secret',
                                  )
                                }
                                disabled={isAutoSecret}
                              />
                            </Col>
                            <Col span={4}>
                              <Button
                                icon={<IconMinus />}
                                onClick={() =>
                                  handleRemoveEnvVariable(index, 'secret')
                                }
                                disabled={
                                  secretEnvVariables.length === 1 ||
                                  isAutoSecret
                                }
                              />
                            </Col>
                          </Row>
                        );
                      })}
                      <Button
                        icon={<IconPlus />}
                        onClick={() => handleAddEnvVariable('secret')}
                        style={{ marginTop: 8 }}
                      >
                        {t('添加密钥环境变量')}
                      </Button>
                    </div>
                  </Card>
                </Collapse.Panel>
              </Collapse>
            </div>
          </Card>
        </div>

        <div ref={priceSectionRef}>
          <Card className='mb-4'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <Title heading={6} style={{ margin: 0 }}>
                {t('价格预估')}
              </Title>
              <Space align='center' spacing={12} className='flex flex-wrap'>
                <Text type='secondary' size='small'>
                  {t('计价币种')}
                </Text>
                <RadioGroup
                  type='button'
                  value={priceCurrency}
                  onChange={handleCurrencyChange}
                >
                  <Radio value='usdc'>USDC</Radio>
                  <Radio value='iocoin'>IOCOIN</Radio>
                </RadioGroup>
                <Tag size='small' color='blue'>
                  {currencyLabel}
                </Tag>
              </Space>
            </div>

            {priceEstimation ? (
              <div className='mt-4 flex w-full flex-col gap-4'>
                <div className='grid w-full gap-4 md:grid-cols-2 lg:grid-cols-3'>
                  <div
                    className='flex flex-col gap-1 rounded-md px-4 py-3'
                    style={{
                      border: '1px solid var(--semi-color-border)',
                      backgroundColor: 'var(--semi-color-fill-0)',
                    }}
                  >
                    <Text size='small' type='tertiary'>
                      {t('预估总费用')}
                    </Text>
                    <div
                      style={{
                        fontSize: 24,
                        fontWeight: 600,
                        color: 'var(--semi-color-text-0)',
                      }}
                    >
                      {typeof priceEstimation.estimated_cost === 'number'
                        ? `${priceEstimation.estimated_cost.toFixed(4)} ${currencyLabel}`
                        : '--'}
                    </div>
                  </div>
                  <div
                    className='flex flex-col gap-1 rounded-md px-4 py-3'
                    style={{
                      border: '1px solid var(--semi-color-border)',
                      backgroundColor: 'var(--semi-color-fill-0)',
                    }}
                  >
                    <Text size='small' type='tertiary'>
                      {t('小时费率')}
                    </Text>
                    <Text strong>
                      {typeof priceEstimation.price_breakdown?.hourly_rate ===
                      'number'
                        ? `${priceEstimation.price_breakdown.hourly_rate.toFixed(4)} ${currencyLabel}/h`
                        : '--'}
                    </Text>
                  </div>
                  <div
                    className='flex flex-col gap-1 rounded-md px-4 py-3'
                    style={{
                      border: '1px solid var(--semi-color-border)',
                      backgroundColor: 'var(--semi-color-fill-0)',
                    }}
                  >
                    <Text size='small' type='tertiary'>
                      {t('计算成本')}
                    </Text>
                    <Text strong>
                      {typeof priceEstimation.price_breakdown?.compute_cost ===
                      'number'
                        ? `${priceEstimation.price_breakdown.compute_cost.toFixed(4)} ${currencyLabel}`
                        : '--'}
                    </Text>
                  </div>
                </div>

                <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                  {priceSummaryItems.map((item) => (
                    <div
                      key={item.key}
                      className='flex items-center justify-between gap-3 rounded-md px-3 py-2'
                      style={{
                        border: '1px solid var(--semi-color-border)',
                        backgroundColor: 'var(--semi-color-fill-0)',
                      }}
                    >
                      <Text size='small' type='tertiary'>
                        {item.label}
                      </Text>
                      <Text strong>{item.value}</Text>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              priceUnavailableContent
            )}

            {priceEstimation && loadingPrice && (
              <Space align='center' spacing={8} style={{ marginTop: 12 }}>
                <Spin size='small' />
                <Text size='small' type='tertiary'>
                  {t('价格重新计算中...')}
                </Text>
              </Space>
            )}
          </Card>
        </div>
      </Form>
    </Modal>
  );
};

export default CreateDeploymentModal;
