locals {
  alert_emails         = distinct(compact(concat(var.alert_email == "" ? [] : [var.alert_email], var.alert_emails)))
  alerts_enabled       = length(local.alert_emails) > 0
  cloudsql_database_id = "${var.project_id}:${var.cloudsql_instance_name}"
}

// Uptime check against the public Cloud Run URL — independent of Cloudflare/DNS.

resource "google_monitoring_uptime_check_config" "api_status" {
  project      = var.project_id
  display_name = "new-api /api/status"
  timeout      = "10s"
  period       = "60s"

  http_check {
    path           = "/api/status"
    port           = 443
    use_ssl        = true
    validate_ssl   = true
    request_method = "GET"
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      host       = var.uptime_host
      project_id = var.project_id
    }
  }
}

// Email alert channel — operator can register more channels manually.
resource "google_monitoring_notification_channel" "email" {
  for_each = toset(local.alert_emails)

  project      = var.project_id
  display_name = "new-api email alerts (${each.value})"
  type         = "email"
  labels = {
    email_address = each.value
  }
}

resource "google_monitoring_alert_policy" "uptime_failed" {
  count = local.alerts_enabled ? 1 : 0

  project      = var.project_id
  display_name = "new-api uptime failed"
  combiner     = "OR"

  conditions {
    display_name = "Uptime check failed"
    condition_threshold {
      filter          = "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND resource.type=\"uptime_url\" AND metric.label.check_id=\"${google_monitoring_uptime_check_config.api_status.uptime_check_id}\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_NEXT_OLDER"
        cross_series_reducer = "REDUCE_COUNT_FALSE"
        group_by_fields      = ["resource.label.host"]
      }
      trigger {
        count = 1
      }
    }
  }

  notification_channels = values(google_monitoring_notification_channel.email)[*].id

  alert_strategy {
    auto_close = "3600s"
  }
}

resource "google_monitoring_alert_policy" "router_instances_near_max" {
  count = local.alerts_enabled ? 1 : 0

  project      = var.project_id
  display_name = "new-api router instances near max"
  combiner     = "OR"

  conditions {
    display_name = "Router instance count is near maxScale"
    condition_threshold {
      filter = join(" AND ", [
        "metric.type=\"run.googleapis.com/container/instance_count\"",
        "resource.type=\"cloud_run_revision\"",
        "resource.label.service_name=\"${var.router_service_name}\"",
        "resource.label.location=\"${var.region}\"",
      ])
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = floor(var.router_max_instances * var.router_instance_saturation_ratio)
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_MAX"
        cross_series_reducer = "REDUCE_MAX"
        group_by_fields      = ["resource.label.service_name"]
      }
      trigger {
        count = 1
      }
    }
  }

  notification_channels = values(google_monitoring_notification_channel.email)[*].id

  alert_strategy {
    auto_close = "3600s"
  }
}

resource "google_monitoring_alert_policy" "router_pending_requests" {
  count = local.alerts_enabled ? 1 : 0

  project      = var.project_id
  display_name = "new-api router pending requests"
  combiner     = "OR"

  conditions {
    display_name = "Router requests are waiting in Cloud Run pending queue"
    condition_threshold {
      filter = join(" AND ", [
        "metric.type=\"run.googleapis.com/pending_queue/pending_requests\"",
        "resource.type=\"cloud_run_revision\"",
        "resource.label.service_name=\"${var.router_service_name}\"",
        "resource.label.location=\"${var.region}\"",
      ])
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = var.router_pending_requests_threshold
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_MAX"
        cross_series_reducer = "REDUCE_MAX"
        group_by_fields      = ["resource.label.service_name"]
      }
      trigger {
        count = 1
      }
    }
  }

  notification_channels = values(google_monitoring_notification_channel.email)[*].id

  alert_strategy {
    auto_close = "3600s"
  }
}

resource "google_monitoring_alert_policy" "router_5xx" {
  count = local.alerts_enabled ? 1 : 0

  project      = var.project_id
  display_name = "new-api router 5xx spike"
  combiner     = "OR"

  conditions {
    display_name = "Router 5xx responses exceed threshold"
    condition_threshold {
      filter = join(" AND ", [
        "metric.type=\"run.googleapis.com/request_count\"",
        "resource.type=\"cloud_run_revision\"",
        "resource.label.service_name=\"${var.router_service_name}\"",
        "resource.label.location=\"${var.region}\"",
        "metric.label.response_code_class=\"5xx\"",
      ])
      duration        = "0s"
      comparison      = "COMPARISON_GT"
      threshold_value = var.router_5xx_per_5m_threshold
      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_DELTA"
        cross_series_reducer = "REDUCE_SUM"
        group_by_fields      = ["resource.label.service_name"]
      }
      trigger {
        count = 1
      }
    }
  }

  notification_channels = values(google_monitoring_notification_channel.email)[*].id

  alert_strategy {
    auto_close = "3600s"
  }
}

resource "google_monitoring_alert_policy" "console_instances_near_max" {
  count = local.alerts_enabled ? 1 : 0

  project      = var.project_id
  display_name = "new-api console instances near max"
  combiner     = "OR"
  severity     = "WARNING"

  conditions {
    display_name = "Console instance count reaches maxScale"
    condition_threshold {
      filter = join(" AND ", [
        "metric.type=\"run.googleapis.com/container/instance_count\"",
        "resource.type=\"cloud_run_revision\"",
        "resource.label.service_name=\"${var.console_service_name}\"",
        "resource.label.location=\"${var.region}\"",
      ])
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = floor(var.console_max_instances * var.console_instance_saturation_ratio)
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_MAX"
        cross_series_reducer = "REDUCE_MAX"
        group_by_fields      = ["resource.label.service_name"]
      }
      trigger {
        count = 1
      }
    }
  }

  documentation {
    content   = "Console instance count remained above 4 for 5 minutes. The configured maximum is 5; check latency, database contention, CPU, and traffic changes."
    mime_type = "text/markdown"
  }

  notification_channels = values(google_monitoring_notification_channel.email)[*].id

  alert_strategy {
    auto_close = "3600s"
  }
}

resource "google_monitoring_alert_policy" "console_pending_requests" {
  count = local.alerts_enabled ? 1 : 0

  project      = var.project_id
  display_name = "new-api console pending requests"
  combiner     = "OR"
  severity     = "WARNING"

  conditions {
    display_name = "Console pending requests exceed 5"
    condition_threshold {
      filter = join(" AND ", [
        "metric.type=\"run.googleapis.com/pending_queue/pending_requests\"",
        "resource.type=\"cloud_run_revision\"",
        "resource.label.service_name=\"${var.console_service_name}\"",
        "resource.label.location=\"${var.region}\"",
      ])
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = var.console_pending_requests_threshold
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_MAX"
        cross_series_reducer = "REDUCE_MAX"
        group_by_fields      = ["resource.label.service_name"]
      }
      trigger {
        count = 1
      }
    }
  }

  documentation {
    content   = "Console pending queue exceeded 5 requests for 5 minutes. Check instance saturation, startup failures, database connections, and slow handlers."
    mime_type = "text/markdown"
  }

  notification_channels = values(google_monitoring_notification_channel.email)[*].id

  alert_strategy {
    auto_close = "3600s"
  }
}

resource "google_monitoring_alert_policy" "console_5xx" {
  count = local.alerts_enabled ? 1 : 0

  project      = var.project_id
  display_name = "new-api console 5xx spike"
  combiner     = "OR"
  severity     = "ERROR"

  conditions {
    display_name = "Console 5xx responses exceed 20 per 5 minutes"
    condition_threshold {
      filter = join(" AND ", [
        "metric.type=\"run.googleapis.com/request_count\"",
        "resource.type=\"cloud_run_revision\"",
        "resource.label.service_name=\"${var.console_service_name}\"",
        "resource.label.location=\"${var.region}\"",
        "metric.label.response_code_class=\"5xx\"",
      ])
      duration        = "0s"
      comparison      = "COMPARISON_GT"
      threshold_value = var.console_5xx_per_5m_threshold
      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_DELTA"
        cross_series_reducer = "REDUCE_SUM"
        group_by_fields      = ["resource.label.service_name"]
      }
      trigger {
        count = 1
      }
    }
  }

  documentation {
    content   = "Console returned more than 20 HTTP 5xx responses within 5 minutes. Check the active revision, database connectivity, authentication paths, and recent deployments."
    mime_type = "text/markdown"
  }

  notification_channels = values(google_monitoring_notification_channel.email)[*].id

  alert_strategy {
    auto_close = "3600s"
  }
}

resource "google_monitoring_alert_policy" "cloudsql_connections_warning" {
  count = local.alerts_enabled ? 1 : 0

  project      = var.project_id
  display_name = "new-api Cloud SQL connections warning"
  combiner     = "OR"
  severity     = "WARNING"

  conditions {
    display_name = "Cloud SQL connected threads exceed 210"
    condition_threshold {
      filter = join(" AND ", [
        "metric.type=\"cloudsql.googleapis.com/database/mysql/threads\"",
        "resource.type=\"cloudsql_database\"",
        "resource.label.database_id=\"${local.cloudsql_database_id}\"",
        "metric.label.thread_kind=\"THREADS_CONNECTED\"",
      ])
      duration        = "120s"
      comparison      = "COMPARISON_GT"
      threshold_value = floor(var.cloudsql_max_connections * var.cloudsql_connections_warning_ratio)
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_MAX"
        cross_series_reducer = "REDUCE_MAX"
        group_by_fields      = ["resource.label.database_id"]
      }
      trigger {
        count = 1
      }
    }
  }

  documentation {
    content   = "Cloud SQL connections exceeded 70% of max_connections=300 for 2 minutes. Check running queries, metadata locks, application pool growth, and active deployments."
    mime_type = "text/markdown"
  }

  notification_channels = values(google_monitoring_notification_channel.email)[*].id

  alert_strategy {
    auto_close = "3600s"
  }
}

resource "google_monitoring_alert_policy" "cloudsql_connections_critical" {
  count = local.alerts_enabled ? 1 : 0

  project      = var.project_id
  display_name = "new-api Cloud SQL connections critical"
  combiner     = "OR"
  severity     = "CRITICAL"

  conditions {
    display_name = "Cloud SQL connected threads exceed 270"
    condition_threshold {
      filter = join(" AND ", [
        "metric.type=\"cloudsql.googleapis.com/database/mysql/threads\"",
        "resource.type=\"cloudsql_database\"",
        "resource.label.database_id=\"${local.cloudsql_database_id}\"",
        "metric.label.thread_kind=\"THREADS_CONNECTED\"",
      ])
      duration        = "60s"
      comparison      = "COMPARISON_GT"
      threshold_value = floor(var.cloudsql_max_connections * var.cloudsql_connections_critical_ratio)
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_MAX"
        cross_series_reducer = "REDUCE_MAX"
        group_by_fields      = ["resource.label.database_id"]
      }
      trigger {
        count = 1
      }
    }
  }

  documentation {
    content   = "Cloud SQL connections exceeded 90% of max_connections=300. Stop high-risk DDL or runaway workloads immediately and preserve an admin connection for diagnosis."
    mime_type = "text/markdown"
  }

  notification_channels = values(google_monitoring_notification_channel.email)[*].id

  alert_strategy {
    auto_close = "3600s"
  }
}

resource "google_monitoring_alert_policy" "cloudsql_running_threads_high" {
  count = local.alerts_enabled ? 1 : 0

  project      = var.project_id
  display_name = "new-api Cloud SQL running threads high"
  combiner     = "OR"
  severity     = "WARNING"

  conditions {
    display_name = "Cloud SQL running threads exceed 50"
    condition_threshold {
      filter = join(" AND ", [
        "metric.type=\"cloudsql.googleapis.com/database/mysql/threads\"",
        "resource.type=\"cloudsql_database\"",
        "resource.label.database_id=\"${local.cloudsql_database_id}\"",
        "metric.label.thread_kind=\"THREADS_RUNNING\"",
      ])
      duration        = "120s"
      comparison      = "COMPARISON_GT"
      threshold_value = var.cloudsql_running_threads_threshold
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_MAX"
        cross_series_reducer = "REDUCE_MAX"
        group_by_fields      = ["resource.label.database_id"]
      }
      trigger {
        count = 1
      }
    }
  }

  documentation {
    content   = "MySQL running/waiting threads exceeded 50 for 2 minutes. Inspect processlist, metadata locks, long transactions, and DDL before connections are exhausted."
    mime_type = "text/markdown"
  }

  notification_channels = values(google_monitoring_notification_channel.email)[*].id

  alert_strategy {
    auto_close = "3600s"
  }
}

resource "google_monitoring_alert_policy" "cloudsql_aborted_connects" {
  count = local.alerts_enabled ? 1 : 0

  project      = var.project_id
  display_name = "new-api Cloud SQL aborted connects spike"
  combiner     = "OR"
  severity     = "ERROR"

  conditions {
    display_name = "Cloud SQL aborted connects exceed 5 per minute"
    condition_threshold {
      filter = join(" AND ", [
        "metric.type=\"cloudsql.googleapis.com/database/mysql/aborted_connects_count\"",
        "resource.type=\"cloudsql_database\"",
        "resource.label.database_id=\"${local.cloudsql_database_id}\"",
      ])
      duration        = "0s"
      comparison      = "COMPARISON_GT"
      threshold_value = var.cloudsql_aborted_connects_per_minute_threshold
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_DELTA"
        cross_series_reducer = "REDUCE_MAX"
        group_by_fields      = ["resource.label.database_id"]
      }
      trigger {
        count = 1
      }
    }
  }

  documentation {
    content   = "More than 5 MySQL connection attempts were aborted within one minute. Check Error 1040, authentication failures, proxy connectivity, and pool exhaustion."
    mime_type = "text/markdown"
  }

  notification_channels = values(google_monitoring_notification_channel.email)[*].id

  alert_strategy {
    auto_close = "3600s"
  }
}

resource "google_monitoring_alert_policy" "cloudsql_alter_contention" {
  count = local.alerts_enabled ? 1 : 0

  project      = var.project_id
  display_name = "new-api Cloud SQL production ALTER contention detected"
  combiner     = "AND_WITH_MATCHING_RESOURCE"
  severity     = "WARNING"

  conditions {
    display_name = "Cloud SQL ALTER TABLE operation detected"
    condition_threshold {
      filter = join(" AND ", [
        "metric.type=\"cloudsql.googleapis.com/database/mysql/ddl_operations_count\"",
        "resource.type=\"cloudsql_database\"",
        "resource.label.database_id=\"${local.cloudsql_database_id}\"",
        "metric.label.operation_type=\"ALTER_TABLE\"",
      ])
      duration        = "0s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0
      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_SUM"
        cross_series_reducer = "REDUCE_SUM"
        group_by_fields      = ["resource.label.database_id"]
      }
      trigger {
        count = 1
      }
    }
  }

  conditions {
    display_name = "Cloud SQL running threads exceed 50 during ALTER"
    condition_threshold {
      filter = join(" AND ", [
        "metric.type=\"cloudsql.googleapis.com/database/mysql/threads\"",
        "resource.type=\"cloudsql_database\"",
        "resource.label.database_id=\"${local.cloudsql_database_id}\"",
        "metric.label.thread_kind=\"THREADS_RUNNING\"",
      ])
      duration        = "60s"
      comparison      = "COMPARISON_GT"
      threshold_value = var.cloudsql_running_threads_threshold
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_MAX"
        cross_series_reducer = "REDUCE_MAX"
        group_by_fields      = ["resource.label.database_id"]
      }
      trigger {
        count = 1
      }
    }
  }

  documentation {
    content   = "A production ALTER TABLE operation coincided with more than 50 running/waiting MySQL threads. Treat this as high-risk DDL contention: inspect metadata locks, processlist, connected threads, and the active Console deployment immediately."
    mime_type = "text/markdown"
  }

  notification_channels = values(google_monitoring_notification_channel.email)[*].id

  alert_strategy {
    auto_close = "3600s"
  }
}

resource "google_monitoring_alert_policy" "redis_cpu_high" {
  count = local.alerts_enabled ? 1 : 0

  project      = var.project_id
  display_name = "new-api Redis CPU high"
  combiner     = "OR"
  severity     = "WARNING"

  conditions {
    display_name = "Redis CPU utilization is high"
    condition_threshold {
      filter = join(" AND ", [
        "metric.type=\"redis.googleapis.com/stats/cpu_utilization\"",
        "resource.type=\"redis_instance\"",
        "resource.label.instance_id=\"${var.redis_instance_id}\"",
        "resource.label.region=\"${var.region}\"",
        "metric.label.role=\"primary\"",
        "metric.label.relationship=\"parent\"",
      ])
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = var.redis_cpu_threshold
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
        group_by_fields      = ["resource.label.instance_id"]
      }
      trigger {
        count = 1
      }
    }
  }

  notification_channels = values(google_monitoring_notification_channel.email)[*].id

  alert_strategy {
    auto_close = "3600s"
  }
}
