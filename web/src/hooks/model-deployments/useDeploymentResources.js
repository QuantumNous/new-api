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

import { useState, useCallback } from 'react';
import { API } from '../../helpers';
import { showError } from '../../helpers';

export const useDeploymentResources = () => {
  const [hardwareTypes, setHardwareTypes] = useState([]);
  const [hardwareTotalAvailable, setHardwareTotalAvailable] = useState(0);
  const [locations, setLocations] = useState([]);
  const [locationsTotalAvailable, setLocationsTotalAvailable] = useState(0);
  const [availableReplicas, setAvailableReplicas] = useState([]);
  const [priceEstimation, setPriceEstimation] = useState(null);

  const [loadingHardware, setLoadingHardware] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [loadingReplicas, setLoadingReplicas] = useState(false);
  const [loadingPrice, setLoadingPrice] = useState(false);

  const fetchHardwareTypes = useCallback(async () => {
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
        return normalizedHardware;
      } else {
        showError('获取硬件类型失败: ' + response.data.message);
        setHardwareTotalAvailable(0);
        return [];
      }
    } catch (error) {
      showError('获取硬件类型失败: ' + error.message);
      setHardwareTotalAvailable(0);
      return [];
    } finally {
      setLoadingHardware(false);
    }
  }, []);

  const fetchLocations = useCallback(async (hardwareId, gpuCount = 1) => {
    if (!hardwareId) {
      setLocations([]);
      setLocationsTotalAvailable(0);
      return [];
    }

    try {
      setLoadingLocations(true);
      const response = await API.get(
        `/api/deployments/available-replicas?hardware_id=${hardwareId}&gpu_count=${gpuCount}`,
      );
      if (response.data.success) {
        const replicas = response.data.data?.replicas || [];
        const nextLocationsMap = new Map();
        replicas.forEach((replica) => {
          const rawId = replica?.location_id ?? replica?.location?.id;
          if (rawId === null || rawId === undefined) return;

          const mapKey = String(rawId);
          if (nextLocationsMap.has(mapKey)) return;

          const rawIso2 =
            replica?.iso2 ?? replica?.location_iso2 ?? replica?.location?.iso2;
          const iso2 = rawIso2 ? String(rawIso2).toUpperCase() : '';
          const name =
            replica?.location_name ??
            replica?.location?.name ??
            replica?.name ??
            String(rawId);

          nextLocationsMap.set(mapKey, {
            id: rawId,
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
            available: Number(replica?.available_count) || 0,
          });
        });

        const normalizedLocations = Array.from(nextLocationsMap.values());
        setLocations(normalizedLocations);
        setLocationsTotalAvailable(
          normalizedLocations.reduce(
            (acc, item) => acc + (item.available || 0),
            0,
          ),
        );
        return normalizedLocations;
      } else {
        showError('获取部署位置失败: ' + response.data.message);
        setLocationsTotalAvailable(0);
        return [];
      }
    } catch (error) {
      showError('获取部署位置失败: ' + error.message);
      setLocationsTotalAvailable(0);
      return [];
    } finally {
      setLoadingLocations(false);
    }
  }, []);

  const fetchAvailableReplicas = useCallback(
    async (hardwareId, gpuCount = 1) => {
      if (!hardwareId) {
        setAvailableReplicas([]);
        return [];
      }

      try {
        setLoadingReplicas(true);
        const response = await API.get(
          `/api/deployments/available-replicas?hardware_id=${hardwareId}&gpu_count=${gpuCount}`,
        );
        if (response.data.success) {
          const replicas = response.data.data.replicas || [];
          setAvailableReplicas(replicas);
          return replicas;
        } else {
          showError('获取可用资源失败: ' + response.data.message);
          setAvailableReplicas([]);
          return [];
        }
      } catch (error) {
        console.error('Load available replicas error:', error);
        setAvailableReplicas([]);
        return [];
      } finally {
        setLoadingReplicas(false);
      }
    },
    [],
  );

  const calculatePrice = useCallback(async (params) => {
    const {
      locationIds,
      hardwareId,
      gpusPerContainer,
      durationHours,
      replicaCount,
    } = params;

    if (
      !locationIds?.length ||
      !hardwareId ||
      !gpusPerContainer ||
      !durationHours ||
      !replicaCount
    ) {
      setPriceEstimation(null);
      return null;
    }

    try {
      setLoadingPrice(true);
      const requestData = {
        location_ids: locationIds,
        hardware_id: hardwareId,
        gpus_per_container: gpusPerContainer,
        duration_hours: durationHours,
        replica_count: replicaCount,
      };

      const response = await API.post(
        '/api/deployments/price-estimation',
        requestData,
      );
      if (response.data.success) {
        const estimation = response.data.data;
        setPriceEstimation(estimation);
        return estimation;
      } else {
        showError('价格计算失败: ' + response.data.message);
        setPriceEstimation(null);
        return null;
      }
    } catch (error) {
      console.error('Price calculation error:', error);
      setPriceEstimation(null);
      return null;
    } finally {
      setLoadingPrice(false);
    }
  }, []);

  const checkClusterNameAvailability = useCallback(async (name) => {
    if (!name?.trim()) return false;

    try {
      const response = await API.get(
        `/api/deployments/check-name?name=${encodeURIComponent(name.trim())}`,
      );
      if (response.data.success) {
        return response.data.data.available;
      } else {
        showError('检查名称可用性失败: ' + response.data.message);
        return false;
      }
    } catch (error) {
      console.error('Check cluster name availability error:', error);
      return false;
    }
  }, []);

  const createDeployment = useCallback(async (deploymentData) => {
    try {
      const response = await API.post('/api/deployments', deploymentData);
      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data.message || '创建部署失败');
      }
    } catch (error) {
      throw error;
    }
  }, []);

  return {
    // Data
    hardwareTypes,
    hardwareTotalAvailable,
    locations,
    locationsTotalAvailable,
    availableReplicas,
    priceEstimation,

    // Loading states
    loadingHardware,
    loadingLocations,
    loadingReplicas,
    loadingPrice,

    // Functions
    fetchHardwareTypes,
    fetchLocations,
    fetchAvailableReplicas,
    calculatePrice,
    checkClusterNameAvailability,
    createDeployment,

    // Clear functions
    clearPriceEstimation: () => setPriceEstimation(null),
    clearAvailableReplicas: () => setAvailableReplicas([]),
  };
};

export default useDeploymentResources;
