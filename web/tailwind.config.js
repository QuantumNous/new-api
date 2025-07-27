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

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    colors: {
      "semi-color-white": "var(--semi-color-white)",
      "semi-color-black": "var(--semi-color-black)",
      "semi-color-primary": "var(--semi-color-primary)",
      "semi-color-primary-hover": "var(--semi-color-primary-hover)",
      "semi-color-primary-active": "var(--semi-color-primary-active)",
      "semi-color-primary-disabled": "var(--semi-color-primary-disabled)",
      "semi-color-primary-light-default": "var(--semi-color-primary-light-default)",
      "semi-color-primary-light-hover": "var(--semi-color-primary-light-hover)",
      "semi-color-primary-light-active": "var(--semi-color-primary-light-active)",
      "semi-color-secondary": "var(--semi-color-secondary)",
      "semi-color-secondary-hover": "var(--semi-color-secondary-hover)",
      "semi-color-secondary-active": "var(--semi-color-secondary-active)",
      "semi-color-secondary-disabled": "var(--semi-color-secondary-disabled)",
      "semi-color-secondary-light-default": "var(--semi-color-secondary-light-default)",
      "semi-color-secondary-light-hover": "var(--semi-color-secondary-light-hover)",
      "semi-color-secondary-light-active": "var(--semi-color-secondary-light-active)",
      "semi-color-tertiary": "var(--semi-color-tertiary)",
      "semi-color-tertiary-hover": "var(--semi-color-tertiary-hover)",
      "semi-color-tertiary-active": "var(--semi-color-tertiary-active)",
      "semi-color-tertiary-light-default": "var(--semi-color-tertiary-light-default)",
      "semi-color-tertiary-light-hover": "var(--semi-color-tertiary-light-hover)",
      "semi-color-tertiary-light-active": "var(--semi-color-tertiary-light-active)",
      "semi-color-default": "var(--semi-color-default)",
      "semi-color-default-hover": "var(--semi-color-default-hover)",
      "semi-color-default-active": "var(--semi-color-default-active)",
      "semi-color-info": "var(--semi-color-info)",
      "semi-color-info-hover": "var(--semi-color-info-hover)",
      "semi-color-info-active": "var(--semi-color-info-active)",
      "semi-color-info-disabled": "var(--semi-color-info-disabled)",
      "semi-color-info-light-default": "var(--semi-color-info-light-default)",
      "semi-color-info-light-hover": "var(--semi-color-info-light-hover)",
      "semi-color-info-light-active": "var(--semi-color-info-light-active)",
      "semi-color-success": "var(--semi-color-success)",
      "semi-color-success-hover": "var(--semi-color-success-hover)",
      "semi-color-success-active": "var(--semi-color-success-active)",
      "semi-color-success-disabled": "var(--semi-color-success-disabled)",
      "semi-color-success-light-default": "var(--semi-color-success-light-default)",
      "semi-color-success-light-hover": "var(--semi-color-success-light-hover)",
      "semi-color-success-light-active": "var(--semi-color-success-light-active)",
      "semi-color-danger": "var(--semi-color-danger)",
      "semi-color-danger-hover": "var(--semi-color-danger-hover)",
      "semi-color-danger-active": "var(--semi-color-danger-active)",
      "semi-color-danger-light-default": "var(--semi-color-danger-light-default)",
      "semi-color-danger-light-hover": "var(--semi-color-danger-light-hover)",
      "semi-color-danger-light-active": "var(--semi-color-danger-light-active)",
      "semi-color-warning": "var(--semi-color-warning)",
      "semi-color-warning-hover": "var(--semi-color-warning-hover)",
      "semi-color-warning-active": "var(--semi-color-warning-active)",
      "semi-color-warning-light-default": "var(--semi-color-warning-light-default)",
      "semi-color-warning-light-hover": "var(--semi-color-warning-light-hover)",
      "semi-color-warning-light-active": "var(--semi-color-warning-light-active)",
      "semi-color-focus-border": "var(--semi-color-focus-border)",
      "semi-color-disabled-text": "var(--semi-color-disabled-text)",
      "semi-color-disabled-border": "var(--semi-color-disabled-border)",
      "semi-color-disabled-bg": "var(--semi-color-disabled-bg)",
      "semi-color-disabled-fill": "var(--semi-color-disabled-fill)",
      "semi-color-shadow": "var(--semi-color-shadow)",
      "semi-color-link": "var(--semi-color-link)",
      "semi-color-link-hover": "var(--semi-color-link-hover)",
      "semi-color-link-active": "var(--semi-color-link-active)",
      "semi-color-link-visited": "var(--semi-color-link-visited)",
      "semi-color-border": "var(--semi-color-border)",
      "semi-color-nav-bg": "var(--semi-color-nav-bg)",
      "semi-color-overlay-bg": "var(--semi-color-overlay-bg)",
      "semi-color-fill-0": "var(--semi-color-fill-0)",
      "semi-color-fill-1": "var(--semi-color-fill-1)",
      "semi-color-fill-2": "var(--semi-color-fill-2)",
      "semi-color-bg-0": "var(--semi-color-bg-0)",
      "semi-color-bg-1": "var(--semi-color-bg-1)",
      "semi-color-bg-2": "var(--semi-color-bg-2)",
      "semi-color-bg-3": "var(--semi-color-bg-3)",
      "semi-color-bg-4": "var(--semi-color-bg-4)",
      "semi-color-text-0": "var(--semi-color-text-0)",
      "semi-color-text-1": "var(--semi-color-text-1)",
      "semi-color-text-2": "var(--semi-color-text-2)",
      "semi-color-text-3": "var(--semi-color-text-3)",
      "semi-color-highlight-bg": "var(--semi-color-highlight-bg)",
      "semi-color-highlight": "var(--semi-color-highlight)",
      "semi-color-data-0": "var(--semi-color-data-0)",
      "semi-color-data-1": "var(--semi-color-data-1)",
      "semi-color-data-2": "var(--semi-color-data-2)",
      "semi-color-data-3": "var(--semi-color-data-3)",
      "semi-color-data-4": "var(--semi-color-data-4)",
      "semi-color-data-5": "var(--semi-color-data-5)",
      "semi-color-data-6": "var(--semi-color-data-6)",
      "semi-color-data-7": "var(--semi-color-data-7)",
      "semi-color-data-8": "var(--semi-color-data-8)",
      "semi-color-data-9": "var(--semi-color-data-9)",
      "semi-color-data-10": "var(--semi-color-data-10)",
      "semi-color-data-11": "var(--semi-color-data-11)",
      "semi-color-data-12": "var(--semi-color-data-12)",
      "semi-color-data-13": "var(--semi-color-data-13)",
      "semi-color-data-14": "var(--semi-color-data-14)",
      "semi-color-data-15": "var(--semi-color-data-15)",
      "semi-color-data-16": "var(--semi-color-data-16)",
      "semi-color-data-17": "var(--semi-color-data-17)",
      "semi-color-data-18": "var(--semi-color-data-18)",
      "semi-color-data-19": "var(--semi-color-data-19)"
    },
    extend: {
      borderRadius: {
        "semi-border-radius-extra-small": "var(--semi-border-radius-extra-small)",
        "semi-border-radius-small": "var(--semi-border-radius-small)",
        "semi-border-radius-medium": "var(--semi-border-radius-medium)",
        "semi-border-radius-large": "var(--semi-border-radius-large)",
        "semi-border-radius-circle": "var(--semi-border-radius-circle)",
        "semi-border-radius-full": "var(--semi-border-radius-full)",
      }
    }
  },
  plugins: [],
}

