import { useEffect } from 'react';

const useFormFieldA11yPatch = (routeKey) => {
  useEffect(() => {
    let generatedFieldCounter = 0;
    let isPatching = false;
    let patchScheduled = false;

    const ensureFieldId = (element, fallbackId) => {
      if (!element) {
        return null;
      }
      if (!element.id) {
        element.id = fallbackId;
      }
      if (!element.name) {
        element.name = element.id;
      }
      return element.id;
    };

    const isVisibleField = (element) => {
      if (!element) {
        return false;
      }
      if (element.type === 'hidden' || element.hidden) {
        return false;
      }
      if (element.getAttribute('aria-hidden') === 'true') {
        return false;
      }
      if (element.closest('[aria-hidden="true"]')) {
        return false;
      }
      const style = window.getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden';
    };

    const getFieldLabelText = (element) => {
      const formField = element.closest('.semi-form-field');
      const explicitLabel =
        formField?.querySelector('.semi-form-field-label-text')?.textContent?.trim();
      if (explicitLabel) {
        return explicitLabel;
      }

      const placeholder = element.getAttribute('placeholder')?.trim();
      if (placeholder) {
        return placeholder;
      }

      const parentText = element.parentElement?.textContent?.trim();
      if (parentText) {
        return parentText.slice(0, 40);
      }

      return element.getAttribute('name') || element.id || 'form-field';
    };

    const patchDocumentFields = () => {
      if (typeof document === 'undefined' || !document.body) {
        return;
      }
      if (isPatching) {
        return;
      }

      isPatching = true;
      try {
        document
          .querySelectorAll('textarea[aria-hidden="true"]:not([name])')
          .forEach((element, index) => {
            element.setAttribute('name', `audit-hidden-textarea-${index + 1}`);
          });

        document.querySelectorAll('[data-a11y-disable-autocomplete]').forEach((element) => {
          if (!isVisibleField(element)) {
            return;
          }
          element.setAttribute('autocomplete', 'off');
        });

        document
          .querySelectorAll(
            'input:not([type="hidden"]), textarea, select, [role="combobox"]',
          )
          .forEach((element) => {
            if (!isVisibleField(element)) {
              return;
            }

            if (!element.id && !element.getAttribute('name')) {
              generatedFieldCounter += 1;
              const generatedId = `audit-field-${generatedFieldCounter}`;
              if (element.tagName.toLowerCase() !== 'div') {
                element.setAttribute('name', generatedId);
              }
              element.id = generatedId;
            }

            const currentAriaLabel = element.getAttribute('aria-label')?.trim();
            const hasGenericAriaLabel =
              currentAriaLabel === 'input value' ||
              currentAriaLabel === 'selected';
            const hasAssociatedLabel =
              (!!element.id &&
                document.querySelector(`label[for="${element.id}"]`)) ||
              !!element.getAttribute('aria-label') ||
              !!element.getAttribute('aria-labelledby');

            if (!hasAssociatedLabel || hasGenericAriaLabel) {
              element.setAttribute('aria-label', getFieldLabelText(element));
            }
          });

        document.querySelectorAll('label[for]').forEach((label, index) => {
          const targetId = label.getAttribute('for');
          const field = label.closest('.semi-form-field');

          if (!targetId) {
            const control = field?.querySelector('input, textarea, select');
            const controlId = ensureFieldId(
              control,
              `audit-form-control-${index + 1}`,
            );
            if (controlId) {
              label.htmlFor = controlId;
            } else {
              label.removeAttribute('for');
            }
            return;
          }

          const target = document.getElementById(targetId);
          if (!target) {
            const fallbackControl = field?.querySelector(
              'input, textarea, select, [role="combobox"], [role="spinbutton"]',
            );
            const fallbackId = ensureFieldId(
              fallbackControl,
              `${targetId}-control-${index + 1}`,
            );
            if (fallbackId) {
              if (
                fallbackControl &&
                ['input', 'textarea', 'select'].includes(
                  fallbackControl.tagName.toLowerCase(),
                )
              ) {
                label.htmlFor = fallbackId;
              } else {
                label.removeAttribute('for');
                const labelId = label.id || `audit-form-label-${index + 1}`;
                label.id = labelId;
                fallbackControl?.setAttribute('aria-labelledby', labelId);
              }
            } else {
              label.removeAttribute('for');
            }
            return;
          }

          if (['input', 'textarea', 'select'].includes(target.tagName.toLowerCase())) {
            return;
          }

          const control = target.querySelector('input, textarea, select');
          const controlId = ensureFieldId(control, `${targetId}-control`);
          if (controlId) {
            if (target.id === targetId) {
              target.id = `${targetId}-wrapper`;
            }
            label.htmlFor = controlId;
          } else {
            label.removeAttribute('for');
          }
        });

        document
          .querySelectorAll('.semi-form-field > label:not([for])')
          .forEach((label, index) => {
            if (label.querySelector('input, textarea, select')) {
              return;
            }

            const field = label.closest('.semi-form-field');
            const control =
              field?.querySelector(
                'input, textarea, select, [role="combobox"], [role="spinbutton"]',
              ) || null;
            const labelId = label.id || `audit-form-label-${index + 1}`;

            label.id = labelId;

            if (
              control &&
              ['input', 'textarea', 'select'].includes(control.tagName.toLowerCase())
            ) {
              const controlId = ensureFieldId(
                control,
                `audit-form-control-${index + 1}`,
              );
              if (controlId) {
                label.htmlFor = controlId;
              }
              return;
            }

            if (control && !control.getAttribute('aria-labelledby')) {
              control.setAttribute('aria-labelledby', labelId);
            }
          });

        document
          .querySelectorAll(
            'input[aria-labelledby], textarea[aria-labelledby], select[aria-labelledby]',
          )
          .forEach((control, index) => {
            const ids = (control.getAttribute('aria-labelledby') || '')
              .split(/\s+/)
              .filter(Boolean);
            const field = control.closest('.semi-form-field');
            const labelText =
              field?.querySelector('.semi-form-field-label-text')?.textContent?.trim() ||
              control.getAttribute('placeholder') ||
              control.getAttribute('name') ||
              control.id ||
              `field-${index + 1}`;

            ids.forEach((id) => {
              if (document.getElementById(id)) {
                return;
              }
              const span = document.createElement('span');
              span.id = id;
              span.textContent = labelText;
              span.className = 'sr-only';
              span.style.position = 'absolute';
              span.style.width = '1px';
              span.style.height = '1px';
              span.style.padding = '0';
              span.style.margin = '-1px';
              span.style.overflow = 'hidden';
              span.style.clip = 'rect(0, 0, 0, 0)';
              span.style.whiteSpace = 'nowrap';
              span.style.border = '0';
              (field || document.body).prepend(span);
            });
          });
      } finally {
        isPatching = false;
      }
    };

    patchDocumentFields();
    const schedulePatch = () => {
      if (patchScheduled) {
        return;
      }
      patchScheduled = true;
      window.requestAnimationFrame(() => {
        patchScheduled = false;
        patchDocumentFields();
      });
    };

    const observer = new MutationObserver(() => {
      schedulePatch();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-hidden', 'aria-label', 'type', 'placeholder'],
    });

    return () => observer.disconnect();
  }, [routeKey]);
};

export default useFormFieldA11yPatch;
