output "service_name" {
  value = try(google_cloud_run_v2_service.main[0].name, null)
}

output "service_uri" {
  value = try(google_cloud_run_v2_service.main[0].uri, null)
}

output "domain_mappings" {
  value = {
    for d, m in google_cloud_run_domain_mapping.domains :
    d => {
      // Cloudflare DNS targets to use (CNAME)
      rrdata = try(m.status[0].resource_records[0].rrdata, "ghs.googlehosted.com.")
      type   = try(m.status[0].resource_records[0].type, "CNAME")
    }
  }
}
