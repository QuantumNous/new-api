resource "google_project_service" "this" {
  for_each = toset(var.apis)

  project                    = var.project_id
  service                    = each.value
  disable_dependent_services = false
  disable_on_destroy         = false
}
