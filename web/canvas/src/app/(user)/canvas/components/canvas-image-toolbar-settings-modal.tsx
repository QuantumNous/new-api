"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Button, Card, Checkbox, Form, Modal, Space, Switch, Tag, Tooltip, Typography, theme as antdTheme } from "antd";
import { Ellipsis, Image as ImageIcon, Settings2 } from "lucide-react";

import type { ImageQuickToolId } from "./canvas-image-toolbar-tools";

export type ImageToolbarSettingsTool = {
    id: ImageQuickToolId;
    title: string;
    label: string;
    icon: ReactNode;
    active?: boolean;
    danger?: boolean;
};

type PreviewTool = ImageToolbarSettingsTool | {
    id: "more";
    title: string;
    label: string;
    icon: ReactNode;
    active?: boolean;
    danger?: boolean;
};

type PreviewScroll = {
    left: number;
    max: number;
    viewport: number;
    content: number;
};

export function ImageToolSettingsModal({
    open,
    tools,
    selectedIds,
    showLabels,
    onToggle,
    onShowLabelsChange,
    onCancel,
    onSave,
}: {
    open: boolean;
    tools: ImageToolbarSettingsTool[];
    selectedIds: ImageQuickToolId[];
    showLabels: boolean;
    onToggle: (id: ImageQuickToolId, visible: boolean) => void;
    onShowLabelsChange: (value: boolean) => void;
    onCancel: () => void;
    onSave: () => void;
}) {
    const { token } = antdTheme.useToken();
    const previewToolbarRef = useRef<HTMLDivElement>(null);
    const scrollbarTrackRef = useRef<HTMLInputElement>(null);
    const [previewScroll, setPreviewScroll] = useState<PreviewScroll>({ left: 0, max: 0, viewport: 1, content: 1 });
    const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
    const selectedTools = tools.filter((tool) => selected.has(tool.id));
    const previewTools: PreviewTool[] = [
        ...selectedTools,
        { id: "more", title: "配置快捷工具", label: "更多", icon: <Ellipsis className="size-4" />, active: true },
    ];

    const syncPreviewScroll = useCallback(() => {
        const toolbar = previewToolbarRef.current;
        if (!toolbar) return;
        setPreviewScroll({
            left: toolbar.scrollLeft,
            max: Math.max(0, toolbar.scrollWidth - toolbar.clientWidth),
            viewport: Math.max(1, toolbar.clientWidth),
            content: Math.max(1, toolbar.scrollWidth),
        });
    }, []);

    const setPreviewScrollLeft = useCallback(
        (left: number) => {
            const toolbar = previewToolbarRef.current;
            if (!toolbar) return;
            toolbar.scrollLeft = left;
            syncPreviewScroll();
        },
        [syncPreviewScroll],
    );

    const updateSelectedTools = (values: ImageQuickToolId[]) => {
        const next = new Set(values);
        tools.forEach((tool) => {
            const visible = next.has(tool.id);
            if (selected.has(tool.id) !== visible) onToggle(tool.id, visible);
        });
    };

    useEffect(() => {
        if (!open) return;
        const toolbar = previewToolbarRef.current;
        const sync = () => syncPreviewScroll();
        const frames: number[] = [];
        const firstFrame = window.requestAnimationFrame(() => {
            sync();
            frames.push(window.requestAnimationFrame(sync));
        });
        frames.push(firstFrame);
        const timer = window.setTimeout(sync, 120);
        const resizeObserver = typeof ResizeObserver !== "undefined" && toolbar ? new ResizeObserver(sync) : null;
        resizeObserver?.observe(toolbar);
        toolbar?.childNodes.forEach((child) => {
            if (child instanceof Element) resizeObserver?.observe(child);
        });
        sync();
        window.addEventListener("resize", syncPreviewScroll);
        return () => {
            frames.forEach((frame) => window.cancelAnimationFrame(frame));
            window.clearTimeout(timer);
            resizeObserver?.disconnect();
            window.removeEventListener("resize", syncPreviewScroll);
        };
    }, [open, selectedIds, showLabels, previewTools.length, syncPreviewScroll]);

    const scrollbarWidth = scrollbarTrackRef.current?.clientWidth || previewScroll.viewport;
    const scrollbarThumbWidth = previewScroll.max > 0 ? Math.min(scrollbarWidth, Math.max(64, (previewScroll.viewport / previewScroll.content) * scrollbarWidth)) : scrollbarWidth;

    return (
        <Modal
            title="自定义工具栏"
            open={open}
            centered
            width={760}
            onCancel={onCancel}
            destroyOnHidden
            footer={
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span>显示按钮文字</span>
                        <Switch checked={showLabels} onChange={onShowLabelsChange} />
                    </div>
                    <Space>
                        <Button onClick={onCancel}>取消</Button>
                        <Button type="primary" onClick={onSave}>
                            保存
                        </Button>
                    </Space>
                </div>
            }
        >
            <Typography.Paragraph type="secondary" className="!mb-4">
                选择你想在图片节点编辑栏中使用的快捷工具。
            </Typography.Paragraph>

            <Card
                size="small"
                title={
                    <Space size={6}>
                        <Settings2 className="size-4" />
                        节点预览
                    </Space>
                }
                className="mb-4"
            >
                <div className="relative flex min-h-[300px] w-full justify-center pt-20 pb-9">
                    <div
                        ref={previewToolbarRef}
                        className="hide-scrollbar absolute left-2 right-2 top-3 z-10 flex h-12 items-center overflow-x-auto rounded-[18px] border px-1 text-[13px]"
                        style={{ background: token.colorBgElevated, borderColor: token.colorBorderSecondary, boxShadow: token.boxShadowSecondary, color: token.colorText }}
                        onScroll={syncPreviewScroll}
                    >
                        {previewTools.map((tool) => (
                            <PreviewToolbarItem key={tool.id} tool={tool} showLabels={showLabels} />
                        ))}
                    </div>
                    <div
                        className="flex h-48 w-full max-w-[360px] flex-col items-center justify-center rounded-xl border"
                        style={{ background: token.colorFillAlter, borderColor: token.colorBorderSecondary, color: token.colorTextSecondary }}
                    >
                        <ImageIcon className="mb-2 size-8" />
                        <Typography.Text type="secondary">图片节点</Typography.Text>
                    </div>
                    <input
                        ref={scrollbarTrackRef}
                        type="range"
                        min={0}
                        max={Math.max(previewScroll.max, 1)}
                        value={Math.min(previewScroll.left, Math.max(previewScroll.max, 1))}
                        disabled={previewScroll.max <= 0}
                        className="absolute bottom-4 left-10 right-10 h-2.5 cursor-pointer appearance-none bg-transparent disabled:cursor-default [&::-moz-range-thumb]:h-2.5 [&::-moz-range-thumb]:w-[var(--preview-scrollbar-thumb-width)] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[#8d9498] [&::-moz-range-track]:h-2.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-[#bdc4c8] [&::-webkit-slider-runnable-track]:h-2.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[#bdc4c8] [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-[var(--preview-scrollbar-thumb-width)] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#8d9498]"
                        style={{ "--preview-scrollbar-thumb-width": `${scrollbarThumbWidth}px` } as CSSProperties}
                        onInput={(event) => setPreviewScrollLeft(Number(event.currentTarget.value))}
                        onChange={(event) => setPreviewScrollLeft(Number(event.target.value))}
                    />
                </div>
            </Card>

            <Form layout="vertical" className="!mb-0">
                <Form.Item
                    className="!mb-4"
                    label={
                        <Space size={8}>
                            <span>快捷工具</span>
                            <Tag className="m-0">
                                {selectedTools.length}/{tools.length}
                            </Tag>
                        </Space>
                    }
                >
                    <Checkbox.Group value={selectedIds} className="grid w-full gap-3 md:grid-cols-3" onChange={(values) => updateSelectedTools(values as ImageQuickToolId[])}>
                        {tools.map((tool) => (
                            <Checkbox key={tool.id} value={tool.id} className="m-0">
                                <span className="inline-flex items-center gap-2">
                                    {tool.icon}
                                    {tool.label}
                                </span>
                            </Checkbox>
                        ))}
                    </Checkbox.Group>
                </Form.Item>
            </Form>
        </Modal>
    );
}

function PreviewToolbarItem({ tool, showLabels }: { tool: PreviewTool; showLabels: boolean }) {
    return (
        <Tooltip title={tool.title}>
            <span className="flex h-12 shrink-0 items-center px-1.5" style={{ color: tool.danger ? "#ef4444" : undefined }}>
                <span className={`flex h-9 items-center rounded-lg px-2 ${showLabels ? "gap-2" : "justify-center"}`}>
                    {tool.icon}
                    {showLabels ? <span className="whitespace-nowrap">{tool.label}</span> : null}
                </span>
            </span>
        </Tooltip>
    );
}
