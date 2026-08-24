# Recall Translation Type and SMTP Summary Design

## Goal

Keep recall email translation validation aligned with the persisted campaign type, and reduce the Activity SMTP configuration footprint after it has been configured successfully.

## Backend translation behavior

`GenerateEmailTranslations` must translate with the campaign type loaded from the stored campaign. A `content_only` campaign must use `RecallEmailCampaignTranslator.TranslateForCampaign` so its English and localized HTML is validated without promotion-only fields such as `ClaimURL`.

The existing compatibility boundary remains intact: translators that only implement `RecallEmailTranslator` may continue to serve promotion campaigns, while non-promotion campaigns require the campaign-aware interface. This matches the established localization path and avoids weakening HTML validation.

## Activity SMTP interaction

The SMTP component has two presentation states:

- Not configured: render the existing description and full configuration form.
- Configured: render one compact row containing the section title, sender address, `server:port`, configured status, and an Edit button.

Selecting Edit expands the existing form with the redacted status values and a blank token. A successful save updates the cached status, clears the password field, and collapses the section. A failed save keeps the form expanded so validation and safe transport errors remain visible. Background status refreshes must not discard dirty form values or unexpectedly collapse an edit in progress.

Loading uses the compact header with a neutral loading status. A load failure keeps the configuration surface available but disabled and shows the existing safe error message.

## Accessibility and localization

The Edit control uses the existing translated `Edit` key and exposes `aria-expanded` and `aria-controls`. The summary values come from the redacted SMTP status and never include the token. No new user-visible translation keys are required.

## Testing

- Add a service regression test proving content-only translation generation receives `content_only` through the campaign-aware translator.
- Add SMTP view tests proving configured state hides form fields and not-configured state shows them.
- Add a mounted SMTP test proving Edit expands the form and a successful save collapses it again.
- Preserve existing validation, secret-retention, cache-refetch, and safe-error tests.

## Deployment scope

The Go console backend and `web/default` console frontend must be deployed together. No database migration or runtime configuration change is required. Router request handling and relay behavior are unchanged.
