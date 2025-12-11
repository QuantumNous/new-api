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

// 主要组件导出
export { default as SetupWizard } from './SetupWizard';

export { default as StepNavigation } from './components/StepNavigation';

// 步骤组件导出
export { default as DatabaseStep } from './components/steps/DatabaseStep';
export { default as AdminStep } from './components/steps/AdminStep';
export { default as UsageModeStep } from './components/steps/UsageModeStep';
export { default as CompleteStep } from './components/steps/CompleteStep';
