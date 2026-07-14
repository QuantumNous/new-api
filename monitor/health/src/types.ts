export interface ChannelInfo {
  id: number;
  name: string;
  type: number;
  status: number;
  response_time: number;
  test_time: number;
  models: string;
  is_testable: boolean;
}

export interface ModelAvailability {
  model: string;
  channels: { id: number; name: string; status: number }[];
  available_count: number;
  total_count: number;
}

export interface TimelineItem {
  id: number;
  status: string;
  response_time: number;
  error_message: string;
  tested_at: string;
  test_model: string;
}

export interface AvailabilityStat {
  channel_id: number;
  period: string;
  total_checks: number;
  operational_count: number;
  availability_pct: number;
}

export interface Overview {
  total_channels: number;
  operational_channels: number;
  failed_channels: number;
  unsupported_channels: number;
  total_models: number;
  avg_response_time: number;
}

// Channel types that don't support testing
export const UNSUPPORTED_TEST_CHANNEL_TYPES = [
  2,  // Midjourney
  5,  // MidjourneyPlus
  36, // SunoAPI
  50, // Kling
  51, // Jimeng
  52, // Vidu
  54, // DoubaoVideo
];
