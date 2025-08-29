// TypeScript React
"use client";

import * as React from "react";
import { useCallback, useMemo, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSettings } from "@/contexts/settings-context";
import {GCODE_HOOKS, GCodeHook} from "@/types/gcode";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useTheme } from "next-themes";

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl p-0 flex flex-col max-h-[90vh] translate-y-[0%] top-16">
                {/* 헤더 */}
                <div className="px-6 pt-6">
                    <DialogHeader className="p-0">
                        <DialogTitle>설정</DialogTitle>
                        <DialogDescription>애플리케이션 전역 설정을 구성합니다.</DialogDescription>
                    </DialogHeader>
                </div>

                {/* 탭/본문 */}
                <div className="mt-4 flex-1 min-h-0 flex flex-col">
                    <Tabs defaultValue="general" className="w-full flex-1 min-h-0 flex flex-col">
                        {/* 탭 리스트(상단 고정) */}
                        <div className="px-6">
                            <TabsList className="w-full grid grid-cols-4 sticky top-0 z-10">
                                <TabsTrigger value="general">일반</TabsTrigger>
                                <TabsTrigger value="view">뷰/그리드</TabsTrigger>
                                <TabsTrigger value="coating">코팅</TabsTrigger>
                                <TabsTrigger value="gcode">G-Code 스니펫</TabsTrigger>
                            </TabsList>
                        </div>

                        {/* 스크롤 영역: 이 래퍼에서만 스크롤 */}
                        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4">
                            <TabsContent value="general" className="mt-4 space-y-6">
                                <GeneralSettings />
                            </TabsContent>

                            <TabsContent value="view" className="mt-4 space-y-6">
                                <ViewGridSettings />
                            </TabsContent>

                            <TabsContent value="coating" className="mt-4 space-y-6">
                                <CoatingSettings />
                            </TabsContent>

                            <TabsContent value="gcode" className="mt-4 space-y-6">
                                <GCodeSnippetsSection />
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>
                <Separator />
                {/* 푸터 */}
                <DialogFooter className="gap-2 px-3 py-3">
                    <p className="mx-3 text-xs text-muted-foreground">*변경사항은 자동 저장됩니다.</p>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>닫기</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/* 일반 탭: workArea 편집 + 테마 즉시 적용 + 현재 테마 표시 */
function GeneralSettings() {
    const { theme: persistedTheme, setTheme: setThemePersisted, workArea, setWorkArea, pixelsPerMm } = useSettings();
    const { theme: runtimeTheme, setTheme } = useTheme();

    const [widthText, setWidthText] = useState(String(workArea.width));
    const [heightText, setHeightText] = useState(String(workArea.height));

    const commitWorkArea = useCallback(() => {
        const w = Math.max(1, Math.floor(Number(widthText)));
        const h = Math.max(1, Math.floor(Number(heightText)));
        if (Number.isFinite(w) && Number.isFinite(h)) {
            setWorkArea({ width: w, height: h });
        }
    }, [widthText, heightText, setWorkArea]);

    const themeLabel = useMemo(() => {
        switch (runtimeTheme) {
            case "light": return "라이트";
            case "dark": return "다크";
            case "system": return "시스템";
            default: return String(runtimeTheme ?? "");
        }
    }, [runtimeTheme]);

    const workAreaInPx = useMemo(() => {
        if (!pixelsPerMm) return { w: 0, h: 0 };
        return {
            w: workArea.width * pixelsPerMm,
            h: workArea.height * pixelsPerMm,
        };
    }, [workArea, pixelsPerMm]);

    return (
        <section className="space-y-4">
            <div>
                <h3 className="text-base font-semibold">일반</h3>
                <p className="text-sm text-muted-foreground">작업영역 및 테마를 설정합니다.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid grid-cols-4 items-center gap-2">
                    <Label className="text-right col-span-1">너비 (mm)</Label>
                    <Input
                        className="col-span-3"
                        type="number"
                        value={widthText}
                        min={1}
                        onChange={(e) => setWidthText(e.target.value)}
                        onBlur={commitWorkArea}
                        onKeyDown={(e) => e.key === "Enter" && commitWorkArea()}
                    />
                </div>
                <div className="grid grid-cols-4 items-center gap-2">
                    <Label className="text-right col-span-1">높이 (mm)</Label>
                    <Input
                        className="col-span-3"
                        type="number"
                        value={heightText}
                        min={1}
                        onChange={(e) => setHeightText(e.target.value)}
                        onBlur={commitWorkArea}
                        onKeyDown={(e) => e.key === "Enter" && commitWorkArea()}
                    />
                </div>
            </div>
            <div className="text-sm text-muted-foreground pl-2">
                현재 작업 영역의 픽셀 크기는 <b>{workAreaInPx.w} x {workAreaInPx.h} px</b> 입니다.
            </div>

            <div className="grid grid-cols-4 items-center gap-2 max-w-md">
                <Label className="text-right col-span-1">테마</Label>
                <div className="col-span-3">
                    <Select
                        value={(runtimeTheme as any) ?? "system"}
                        onValueChange={(v) => {
                            setTheme(v as any);
                            setThemePersisted(v);
                        }}
                    >
                        <SelectTrigger className="h-9">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="light">라이트</SelectItem>
                            <SelectItem value="dark">다크</SelectItem>
                            <SelectItem value="system">시스템</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground mt-1">
                        현재 테마: {themeLabel} ({runtimeTheme ?? "알 수 없음"})
                    </p>
                </div>
            </div>
        </section>
    );
}

/* 뷰/그리드 탭: 그리드/스냅/그리드 크기 */
function ViewGridSettings() {
    const { isGridVisible, setGridVisible, isSnappingEnabled, setSnappingEnabled, pixelsPerMm, setPixelsPerMm } = useSettings();
    const [pixelsPerMmText, setPixelsPerMmText] = useState(String(pixelsPerMm));

    const commitPixelsPerMm = useCallback(() => {
        const n = Math.max(1, Math.floor(Number(pixelsPerMmText)));
        if (Number.isFinite(n)) setPixelsPerMm(n);
    }, [pixelsPerMmText, setPixelsPerMm]);

    return (
        <section className="space-y-4">
            <div>
                <h3 className="text-base font-semibold">뷰/그리드</h3>
                <p className="text-sm text-muted-foreground">그리드 표시, 스냅, 그리드 단위를 설정합니다.</p>
            </div>

            <div className="grid grid-cols-1 gap-3 max-w-xl">
                <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                        <div className="font-medium text-sm">그리드 표시</div>
                        <div className="text-xs text-muted-foreground">캔버스에 격자를 표시합니다.</div>
                    </div>
                    <Switch checked={isGridVisible} onCheckedChange={setGridVisible} />
                </div>

                <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                        <div className="font-medium text-sm">스냅 사용</div>
                        <div className="text-xs text-muted-foreground">그리드에 맞춰 도형 이동/정렬이 스냅됩니다.</div>
                    </div>
                    <Switch checked={isSnappingEnabled} onCheckedChange={setSnappingEnabled} />
                </div>

                <div className="grid grid-cols-4 items-center gap-2">
                    <Label className="text-right col-span-1">mm당 픽셀</Label>
                    <Input
                        className="col-span-3"
                        type="number"
                        min={1}
                        value={pixelsPerMmText}
                        onChange={(e) => setPixelsPerMmText(e.target.value)}
                        onBlur={commitPixelsPerMm}
                        onKeyDown={(e) => e.key === "Enter" && commitPixelsPerMm()}
                    />
                </div>
            </div>
        </section>
    );
}

/* 코팅 탭: 기본 코팅 설정 */
function CoatingSettings() {
    const { gcodeSettings, updateGcodeSettings } = useSettings();

    const handleInputChange = useCallback((field: string, value: string) => {
        const numValue = parseFloat(value) || 0;
        updateGcodeSettings({ [field]: numValue });
    }, [updateGcodeSettings]);

    const handleSelectChange = useCallback((field: string, value: string) => {
        updateGcodeSettings({ [field]: value });
    }, [updateGcodeSettings]);

    const handleSwitchChange = useCallback((field: string, value: boolean) => {
        updateGcodeSettings({ [field]: value });
    }, [updateGcodeSettings]);

    return (
        <section className="space-y-6">
            <div>
                <h3 className="text-base font-semibold">코팅 설정</h3>
                <p className="text-sm text-muted-foreground">기본 코팅 매개변수를 설정합니다.</p>
            </div>

            {/* 기본 코팅 설정 */}
            <div className="rounded-md border p-4 space-y-4">
                <h4 className="font-medium text-sm">기본 매개변수</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-sm">코팅 폭 (mm)</Label>
                        <Input
                            type="number"
                            step="0.01"
                            value={gcodeSettings.coatingWidth}
                            onChange={(e) => handleInputChange('coatingWidth', e.target.value)}
                            className="h-9"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-sm">라인 간격 (mm)</Label>
                        <Input
                            type="number"
                            step="0.01"
                            value={gcodeSettings.lineSpacing}
                            onChange={(e) => handleInputChange('lineSpacing', e.target.value)}
                            className="h-9"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-sm">코팅 속도 (mm/min)</Label>
                        <Input
                            type="number"
                            value={gcodeSettings.coatingSpeed}
                            onChange={(e) => handleInputChange('coatingSpeed', e.target.value)}
                            className="h-9"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-sm">이동 속도 (mm/min)</Label>
                        <Input
                            type="number"
                            value={gcodeSettings.moveSpeed}
                            onChange={(e) => handleInputChange('moveSpeed', e.target.value)}
                            className="h-9"
                        />
                    </div>
                </div>
            </div>

            {/* Z축 설정 */}
            <div className="rounded-md border p-4 space-y-4">
                <h4 className="font-medium text-sm">Z축 설정</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-sm">안전 높이 (mm)</Label>
                        <Input
                            type="number"
                            step="0.01"
                            value={gcodeSettings.safeHeight}
                            onChange={(e) => handleInputChange('safeHeight', e.target.value)}
                            className="h-9"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-sm">코팅 높이 (mm)</Label>
                        <Input
                            type="number"
                            step="0.01"
                            value={gcodeSettings.coatingHeight}
                            onChange={(e) => handleInputChange('coatingHeight', e.target.value)}
                            className="h-9"
                        />
                    </div>
                </div>
            </div>

            {/* 패턴 및 마스킹 설정 */}
            <div className="rounded-md border p-4 space-y-4">
                <h4 className="font-medium text-sm">패턴 및 마스킹</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-sm">기본 채우기 패턴</Label>
                        <Select
                            value={gcodeSettings.fillPattern}
                            onValueChange={(value) => handleSelectChange('fillPattern', value)}
                        >
                            <SelectTrigger className="h-9">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="horizontal">수평</SelectItem>
                                <SelectItem value="vertical">수직</SelectItem>
                                <SelectItem value="auto">자동</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-sm">이동 회피 전략</Label>
                        <Select
                            value={gcodeSettings.travelAvoidanceStrategy}
                            onValueChange={(value) => handleSelectChange('travelAvoidanceStrategy', value)}
                        >
                            <SelectTrigger className="h-9">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="global">전역 회피</SelectItem>
                                <SelectItem value="lift">리프트</SelectItem>
                                <SelectItem value="contour">윤곽 따라</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-md border p-3">
                        <div>
                            <div className="font-medium text-sm">마스킹 사용</div>
                            <div className="text-xs text-muted-foreground">마스킹 영역을 설정하여 코팅을 제외합니다.</div>
                        </div>
                        <Switch
                            checked={gcodeSettings.enableMasking}
                            onCheckedChange={(checked) => handleSwitchChange('enableMasking', checked)}
                        />
                    </div>

                    {gcodeSettings.enableMasking && (
                        <div className="space-y-2">
                            <Label className="text-sm">마스킹 여유 거리 (mm)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={gcodeSettings.maskingClearance}
                                onChange={(e) => handleInputChange('maskingClearance', e.target.value)}
                                className="h-9"
                            />
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

/* G-Code 스니펫 탭: 긴 목록도 확실히 스크롤 */
function GCodeSnippetsSection() {
    const {
        gcodeSnippets,
        addGcodeSnippet,
        updateGcodeSnippet,
        removeGcodeSnippet,
        toggleGcodeSnippetEnabled,
        reorderGcodeSnippetsInHook,
    } = useSettings();

    const hooks = GCODE_HOOKS;

    const grouped = useMemo(() => {
        const map = new Map<GCodeHook, typeof gcodeSnippets>();
        hooks.forEach((h) => map.set(h.value, []));
        for (const s of gcodeSnippets) {
            const list = map.get(s.hook);
            (list ? list : []).push(s);
            if (!list) map.set(s.hook, [s]);
        }
        for (const [k, list] of map.entries()) {
            list.sort((a, b) => a.order - b.order);
            map.set(k, list);
        }
        return map;
    }, [gcodeSnippets, hooks]);

    const [newName, setNewName] = useState("");
    const [newHook, setNewHook] = useState<GCodeHook>("beforeAll");
    const handleAdd = useCallback(() => {
        if (!newName.trim()) return;
        addGcodeSnippet({ name: newName.trim(), hook: newHook, template: "; 새 스니펫", enabled: true });
        setNewName("");
    }, [addGcodeSnippet, newName, newHook]);

    const moveWithinHook = useCallback(
        (hook: string, id: string, dir: "up" | "down") => {
            const list = grouped.get(hook) ?? [];
            const ids = list.map((s) => s.id);
            const idx = ids.indexOf(id);
            if (idx < 0) return;
            const swapWith = dir === "up" ? idx - 1 : idx + 1;
            if (swapWith < 0 || swapWith >= ids.length) return;
            const newIds = [...ids];
            [newIds[idx], newIds[swapWith]] = [newIds[swapWith], newIds[idx]];
            reorderGcodeSnippetsInHook(hook, newIds);
        },
        [grouped, reorderGcodeSnippetsInHook]
    );

    return (
        <section className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold">G-Code 스니펫</h3>
                    <Badge variant="secondary">{gcodeSnippets.length}</Badge>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                        <Label className="text-sm">Hook</Label>
                        <Select value={newHook} onValueChange={(v) => setNewHook(v as GCodeHook)}>
                            <SelectTrigger className="h-8 w-44">
                                <SelectValue placeholder="Hook" />
                            </SelectTrigger>
                            <SelectContent>
                                {hooks.map((h) => (
                                    <SelectItem key={h.value} value={h.value}>
                                        {h.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Input
                        className="h-8 w-56"
                        placeholder="새 스니펫 이름"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                    />
                    <Button size="sm" onClick={handleAdd}>
                        <Plus className="w-4 h-4 mr-1" />
                        추가
                    </Button>
                </div>
            </div>

            {/* 목록 */}
            <div className="space-y-6">
                {hooks.map(({ value: hookValue, label }) => {
                    const list = grouped.get(hookValue) ?? [];
                    return (
                        <div key={hookValue} className="rounded-md border">
                            <div className="px-3 py-2 bg-muted/50 flex items-center justify-between">
                                <div className="font-medium text-sm">{label}</div>
                                <div className="text-xs text-muted-foreground">총 {list.length}개</div>
                            </div>

                            {list.length === 0 ? (
                                <div className="p-3 text-sm text-muted-foreground">등록된 스니펫이 없습니다.</div>
                            ) : (
                                <div className="divide-y">
                                    {list.map((snip, idx) => (
                                        <div key={snip.id} className="p-3 space-y-3">
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <div className="flex-1 min-w-56">
                                                    <Label htmlFor={`name-${snip.id}`} className="text-xs">이름</Label>
                                                    <Input
                                                        id={`name-${snip.id}`}
                                                        className="h-8"
                                                        value={snip.name}
                                                        onChange={(e) => updateGcodeSnippet(snip.id, { name: e.target.value })}
                                                    />
                                                </div>

                                                <div>
                                                    <Label className="text-xs mr-2">사용</Label>
                                                    <Switch checked={snip.enabled} onCheckedChange={() => toggleGcodeSnippetEnabled(snip.id)} />
                                                </div>

                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8"
                                                        onClick={() => moveWithinHook(hookValue, snip.id, "up")}
                                                        disabled={idx === 0}
                                                        title="위로"
                                                    >
                                                        <ArrowUp className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8"
                                                        onClick={() => moveWithinHook(hookValue, snip.id, "down")}
                                                        disabled={idx === list.length - 1}
                                                        title="아래로"
                                                    >
                                                        <ArrowDown className="w-4 h-4" />
                                                    </Button>
                                                </div>

                                                <div className="ml-auto">
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8 text-red-600 hover:text-red-700"
                                                        onClick={() => removeGcodeSnippet(snip.id)}
                                                        title="삭제"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div>
                                                    <Label className="text-xs">Hook</Label>
                                                    <Select
                                                        value={snip.hook}
                                                        onValueChange={(v) => updateGcodeSnippet(snip.id, { hook: v as GCodeHook, order: 1e9 })}
                                                    >
                                                        <SelectTrigger className="h-8">
                                                            <SelectValue placeholder="Hook" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {hooks.map((h) => (
                                                                <SelectItem key={h.value} value={h.value}>
                                                                    {h.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div>
                                                    <Label htmlFor={`desc-${snip.id}`} className="text-xs">설명</Label>
                                                    <Input
                                                        id={`desc-${snip.id}`}
                                                        className="h-8"
                                                        value={snip.description ?? ""}
                                                        onChange={(e) => updateGcodeSnippet(snip.id, { description: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <Label htmlFor={`tpl-${snip.id}`} className="text-xs">템플릿(G-Code)</Label>
                                                <Textarea
                                                    id={`tpl-${snip.id}`}
                                                    className="min-h-[120px] font-mono text-xs"
                                                    value={snip.template}
                                                    onChange={(e) => updateGcodeSnippet(snip.id, { template: e.target.value })}
                                                    placeholder="예) G21 ; mm&#10;G90 ; absolute&#10;G0 Z{{safeHeight}}"
                                                />
                                                <p className="mt-1 text-[11px] text-muted-foreground">
                                                    변수 예: {'{{safeHeight}}'}, {'{{unit}}'}, {'{{workArea.width}}'}, {'{{pathIndex}}'}/
                                                    {'{{pathCount}}'}, {'{{shapeName}}'}, {'{{shapeType}}'}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
    );
}