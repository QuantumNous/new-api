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

import React, { useState, useEffect, useContext } from "react";
import { Card } from '@heroui/react';
import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { API, showSuccess, showError } from "../../../../helpers";
import { UserContext } from "../../../../context/User";
import { normalizeLanguage } from "../../../../i18n/language";

// Only Chinese and English are surfaced as user-pickable options; other
// locales remain bundled so saved preferences keep working.
const languageOptions = [
	{ value: "zh-CN", label: "简体中文" },
	{ value: "en", label: "English" },
];

const PreferencesSettings = ({ t }) => {
	const { i18n } = useTranslation();
	const [userState, userDispatch] = useContext(UserContext);
	const [currentLanguage, setCurrentLanguage] = useState(
		normalizeLanguage(i18n.language) || "zh-CN",
	);
	const [loading, setLoading] = useState(false);

	// Load saved language preference from user settings
	useEffect(() => {
		if (userState?.user?.setting) {
			try {
				const settings = JSON.parse(userState.user.setting);
				if (settings.language) {
					const lang = normalizeLanguage(settings.language);
					setCurrentLanguage(lang);
					// Sync i18n with saved preference
					if (i18n.language !== lang) {
						i18n.changeLanguage(lang);
					}
				}
			} catch (e) {
				// Ignore parse errors
			}
		}
	}, [userState?.user?.setting, i18n]);

	const handleLanguagePreferenceChange = async (lang) => {
		if (lang === currentLanguage) return;

		setLoading(true);

		// Apply UI change immediately and persist locally so the preference
		// always sticks on this device, even if backend persistence fails.
		setCurrentLanguage(lang);
		i18n.changeLanguage(lang);
		localStorage.setItem("i18nextLng", lang);

		// Mirror into cached user.setting so layout effects don't override it.
		let settings = {};
		if (userState?.user?.setting) {
			try {
				settings = JSON.parse(userState.user.setting) || {};
			} catch (e) {
				settings = {};
			}
		}
		settings.language = lang;
		if (userState?.user) {
			const nextUser = {
				...userState.user,
				setting: JSON.stringify(settings),
			};
			userDispatch({ type: "login", payload: nextUser });
			localStorage.setItem("user", JSON.stringify(nextUser));
		}

		try {
			const res = await API.put(
				"/api/user/self",
				{ language: lang },
				{ skipErrorHandler: true },
			);

			if (res.data?.success) {
				showSuccess(t("语言偏好已保存"));
			} else {
				// Backend rejected but local change is preserved; surface a
				// non-blocking warning instead of reverting the user's choice.
				showError(res.data?.message || t("保存失败"));
			}
		} catch (error) {
			// Network/5xx error: keep the local language change so the user's
			// intent is honored. Surface a non-blocking warning.
			showError(t("保存失败，请重试"));
		} finally {
			setLoading(false);
		}
	};

	return (
		<Card className="!rounded-2xl shadow-sm border-0">
			{/* Card Header */}
			<div className="flex items-center mb-4">
				<div className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-600 shadow-md dark:bg-violet-900/30 dark:text-violet-300">
					<Languages size={16} />
				</div>
				<div>
					<div className="text-lg font-medium text-foreground">
						{t("偏好设置")}
					</div>
					<div className="text-xs text-muted">
						{t("界面语言和其他个人偏好")}
					</div>
				</div>
			</div>
			{/* Language Setting Card */}
			<Card className="!rounded-xl border border-border">
				<div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
					<div className="flex items-start w-full sm:w-auto">
						<div className="w-12 h-12 rounded-full bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center mr-4 flex-shrink-0">
							<Languages
								size={20}
								className="text-violet-600 dark:text-violet-400"
							/>
						</div>
						<div>
							<h6 className="mb-1 text-base font-semibold text-foreground">
								{t("语言偏好")}
							</h6>
							<p className="text-sm text-muted">
								{t("选择您的首选界面语言，设置将自动保存并同步到所有设备")}
							</p>
						</div>
					</div>
					<select
						value={currentLanguage}
						onChange={(event) =>
							handleLanguagePreferenceChange(event.target.value)
						}
						disabled={loading}
						className="h-10 w-[180px] rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
					>
						{languageOptions.map((opt) => (
							<option key={opt.value} value={opt.value}>
								{opt.label}
							</option>
						))}
					</select>
				</div>
			</Card>

			{/* Additional info */}
			<div className="mt-4 text-xs text-muted">
				<span className="text-muted">
					{t(
						"提示：语言偏好会同步到您登录的所有设备，并影响API返回的错误消息语言。",
					)}
				</span>
			</div>
		</Card>
	);
};

export default PreferencesSettings;
