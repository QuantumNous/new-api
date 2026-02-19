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
import { Card, Select, Typography, Avatar } from "@douyinfe/semi-ui";
import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { API, showSuccess, showError } from "../../../../helpers";
import { UserContext } from "../../../../context/User";

// Language options with native names
const languageOptions = [
	{ value: "zh-CN", label: "简体中文" },
	{ value: "zh-TW", label: "繁體中文" },
	{ value: "en", label: "English" },
	{ value: 'fr', label: 'Français'},
	{ value: 'ru', label: 'Русский'},
	{ value: 'ja', label: '日本語'},
	{ value: "vi", label: "Tiếng Việt" },
];

const PreferencesSettings = ({ t }) => {
	const { i18n } = useTranslation();
	const [userState, userDispatch] = useContext(UserContext);
	const [currentLanguage, setCurrentLanguage] = useState(
		i18n.language || "zh-CN",
	);
	const [loading, setLoading] = useState(false);

	// Load saved language preference from user settings
	useEffect(() => {
		if (userState?.user?.setting) {
			try {
				const settings = JSON.parse(userState.user.setting);
				if (settings.language) {
					// Normalize legacy "zh" to "zh-CN" for backward compatibility
					const lang = settings.language === "zh" ? "zh-CN" : settings.language;
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
		const previousLang = currentLanguage;

		try {
			// Update language immediately for responsive UX
			setCurrentLanguage(lang);
			i18n.changeLanguage(lang);

			// Save to backend
			const res = await API.put("/api/user/self", {
				language: lang,
			});

			if (res.data.success) {
				showSuccess(t("语言偏好已保存"));
				// Update user context with new setting
				if (userState?.user?.setting) {
					try {
						const settings = JSON.parse(userState.user.setting);
						settings.language = lang;
						userDispatch({
							type: "login",
							payload: {
								...userState.user,
								setting: JSON.stringify(settings),
							},
						});
					} catch (e) {
						// Ignore
					}
				}
			} else {
				showError(res.data.message || t("保存失败"));
				// Revert on error
				setCurrentLanguage(previousLang);
				i18n.changeLanguage(previousLang);
			}
		} catch (error) {
			showError(t("保存失败，请重试"));
			// Revert on error
			setCurrentLanguage(previousLang);
			i18n.changeLanguage(previousLang);
		} finally {
			setLoading(false);
		}
	};

	return (
		<Card className="!rounded-2xl shadow-sm border-0">
			{/* Card Header */}
			<div className="flex items-center mb-4">
				<Avatar size="small" color="violet" className="mr-3 shadow-md">
					<Languages size={16} />
				</Avatar>
				<div>
					<Typography.Text className="text-lg font-medium">
						{t("偏好设置")}
					</Typography.Text>
					<div className="text-xs text-gray-600 dark:text-gray-400">
						{t("界面语言和其他个人偏好")}
					</div>
				</div>
			</div>
			{/* Language Setting Card */}
			<Card className="!rounded-xl border dark:border-gray-700">
				<div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
					<div className="flex items-start w-full sm:w-auto">
						<div className="w-12 h-12 rounded-full bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center mr-4 flex-shrink-0">
							<Languages
								size={20}
								className="text-violet-600 dark:text-violet-400"
							/>
						</div>
						<div>
							<Typography.Title heading={6} className="mb-1">
								{t("语言偏好")}
							</Typography.Title>
							<Typography.Text type="tertiary" className="text-sm">
								{t("选择您的首选界面语言，设置将自动保存并同步到所有设备")}
							</Typography.Text>
						</div>
					</div>
					<Select
						value={currentLanguage}
						onChange={handleLanguagePreferenceChange}
						style={{ width: 180 }}
						loading={loading}
						optionList={languageOptions.map((opt) => ({
							value: opt.value,
							label: opt.label,
						}))}
					/>
				</div>
			</Card>

			{/* Additional info */}
			<div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
				<Typography.Text type="tertiary">
					{t(
						"提示：语言偏好会同步到您登录的所有设备，并影响API返回的错误消息语言。",
					)}
				</Typography.Text>
			</div>
		</Card>
	);
};

export default PreferencesSettings;
