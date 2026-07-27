/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useQuery } from '@tanstack/react-query'

import { useStatus } from '@/hooks/use-status'

import {
  DEFAULT_RELEASE_MANIFEST_URL,
  fetchDesktopRelease,
} from '../lib/release'

/**
 * The current desktop release, read straight from the manifest the publish pipeline uploads
 * to R2. Publishing a build therefore updates the download page without a backend deploy.
 */
export function useDesktopRelease() {
  const { status } = useStatus()
  const manifestUrl =
    status?.desktop_release_manifest_url?.trim() || DEFAULT_RELEASE_MANIFEST_URL

  const query = useQuery({
    queryKey: ['desktop-release', manifestUrl],
    queryFn: () => fetchDesktopRelease(manifestUrl),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  return {
    release: query.data,
    loading: query.isLoading,
    failed: query.isError,
    fallbackUrl: status?.desktop_download_url?.trim() || '',
  }
}
