export type DefaultFormSubmitter = HTMLButtonElement | HTMLInputElement;

/**
 * Returns the default button a browser uses for implicit form submission.
 *
 * This is useful for custom form controls that need to mirror native Enter key behavior.
 * Clicking the returned submitter preserves browser semantics such as the submitter's click
 * event, `SubmitEvent.submitter`, and submitter-specific attributes.
 *
 * The function follows the controls exposed by `form.elements`, which includes controls associated
 * through the `form` attribute. Disabled submitters can be returned because the default button is
 * determined before disabled state is considered; clicking a disabled submitter is a no-op.
 */
export function getDefaultFormSubmitter(form: HTMLFormElement | null): DefaultFormSubmitter | null {
  if (!form) {
    return null;
  }

  for (const candidate of form.elements) {
    const tagName = candidate.tagName;

    if (tagName === 'BUTTON' || tagName === 'INPUT') {
      const button = candidate as HTMLButtonElement | HTMLInputElement;

      // Intentionally excludes input[type="image"]: Chromium omits it from form.elements,
      // so supporting it would require separate traversal for an exotic submitter type.
      if (button.type === 'submit') {
        return button;
      }
    }
  }

  return null;
}
