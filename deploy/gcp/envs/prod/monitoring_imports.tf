// Adopt the production alert policies created during the 2026-08-03 Cloud SQL
// incident response. These imports prevent Terraform from creating duplicates.

import {
  to = module.monitoring.google_monitoring_alert_policy.cloudsql_connections_warning[0]
  id = "projects/vocai-gemini-prod/alertPolicies/13656996355170996924"
}

import {
  to = module.monitoring.google_monitoring_alert_policy.cloudsql_connections_critical[0]
  id = "projects/vocai-gemini-prod/alertPolicies/5318844188298619061"
}

import {
  to = module.monitoring.google_monitoring_alert_policy.cloudsql_running_threads_high[0]
  id = "projects/vocai-gemini-prod/alertPolicies/2110700858121044585"
}

import {
  to = module.monitoring.google_monitoring_alert_policy.cloudsql_aborted_connects[0]
  id = "projects/vocai-gemini-prod/alertPolicies/2110700858121046979"
}

import {
  to = module.monitoring.google_monitoring_alert_policy.cloudsql_alter_contention[0]
  id = "projects/vocai-gemini-prod/alertPolicies/10855132013680485565"
}

import {
  to = module.monitoring.google_monitoring_alert_policy.console_5xx[0]
  id = "projects/vocai-gemini-prod/alertPolicies/5318844188298619994"
}

import {
  to = module.monitoring.google_monitoring_alert_policy.console_instances_near_max[0]
  id = "projects/vocai-gemini-prod/alertPolicies/9358491225774740618"
}

import {
  to = module.monitoring.google_monitoring_alert_policy.console_pending_requests[0]
  id = "projects/vocai-gemini-prod/alertPolicies/12310351681699573480"
}
