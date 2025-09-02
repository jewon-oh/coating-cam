"use client";

import dynamic from "next/dynamic";
import {CanvasProvider} from "@/contexts/canvas-context";
import {ObjectPanel} from "@/components/object-panel/object-panel";
import {Toolbar} from "@/components/tool/toolbar";
import React, {useCallback, useState, useRef, useEffect} from "react";
import {WorkspaceOverlays} from "@/components/workspace/workspace-overlays";
import ToolContextPanel from "@/components/workspace/tool-context-panel";
import {useProjectAutoLoad} from "@/hooks/project/use-project-autoload";
import {ResizableHandle, ResizablePanel, ResizablePanelGroup} from "@/components/ui/resizable";
import {PropertyPanel} from "@/components/workspace/property-panel";
import {useAppDispatch, useAppSelector} from "@/hooks/redux";
import {useRouter} from "next/navigation";
import {toast} from "sonner";
import {useSettings} from "@/contexts/settings-context";
import {GCodeGenerationDialog} from "@/components/gcode/gcode-generation-dialog";
import {setGCode} from "@/store/slices/gcode-slice";
import {generateGcode} from "@/lib/gcode/generate-gcode";

const DynamicCanvasStage = dynamic(() => import('@/components/workspace/workspace-canvas'), {
    ssr: false,
});

const WorkspaceContent = () => {
    const router = useRouter();
    const dispatch = useAppDispatch();
    const shapes = useAppSelector((state) => state.shapes.shapes);
    const { gcodeSettings,workArea,gcodeSnippets } = useSettings();
    useProjectAutoLoad();

    const navigationTimerRef = useRef<NodeJS.Timeout | null>(null);

    const selectedShapeIds = useAppSelector((state) => state.shapes.selectedShapeIds);
    const currentTool = useAppSelector((state) => state.tool.tool);

    const hasSelectedShapes = selectedShapeIds.length > 0;
    const isDrawingTool = currentTool !== 'select';

    const [generationState, setGenerationState] = useState({
        isOpen: false,
        progress: 0,
        status: 'generating' as 'generating' | 'completed' | 'error',
        currentStep: '',
        error: ''
    });

    const parseGCodeToPath = (gcodeText: string): number[][] => {
        const lines = gcodeText.split('\n');
        const path: number[][] = [];
        let currentX = 0;
        let currentY = 0;
        let currentZ = 5;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('G')) continue;

            if (trimmed.startsWith('G0') || trimmed.startsWith('G1')) {
                const xMatch = trimmed.match(/X([+-]?\d*\.?\d+)/);
                const yMatch = trimmed.match(/Y([+-]?\d*\.?\d+)/);
                const zMatch = trimmed.match(/Z([+-]?\d*\.?\d+)/);

                if (xMatch) currentX = parseFloat(xMatch[1]);
                if (yMatch) currentY = parseFloat(yMatch[1]);
                if (zMatch) currentZ = parseFloat(zMatch[1]);

                path.push([ currentX, currentY, currentZ]);
            }
        }

        return path;
    };

    useEffect(() => {
        return () => {
            if (navigationTimerRef.current) {
                // ✨ FIX: setTimeout -> setInterval에 맞춰 clearInterval로 변경
                clearInterval(navigationTimerRef.current);
            }
        };
    }, []);


    const handleGenerateGCode = useCallback(async () => {
        if (navigationTimerRef.current) {
            // ✨ FIX: setTimeout -> setInterval에 맞춰 clearInterval로 변경
            clearInterval(navigationTimerRef.current);
        }

        try {
            if (shapes.length === 0) {
                toast.error("G-Code를 생성할 도형이 없습니다.");
                return;
            }

            setGenerationState({
                isOpen: true,
                progress: 0,
                status: 'generating',
                currentStep: '준비 중...',
                error: ''
            });

            const mapProgress = (
                rawPercent: number,
                message: string,
                totals: { pathIndex?: number; pathTotal?: number; areaIndex?: number; areaTotal?: number }
            ) => {
                const START_INIT = 0;
                const END_INIT = 5;
                const START_PATHS = 5;
                const END_PATHS = 95;

                const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

                const pIdx = totals.pathIndex ?? 0;
                const pTot = totals.pathTotal ?? 0;

                if (pTot > 0) {
                    const perPathSpan = (END_PATHS - START_PATHS) / pTot;
                    const pathStart = START_PATHS + (pIdx - 1) * perPathSpan;
                    const pathEnd = pathStart + perPathSpan;

                    let withinPathRatio: number;
                    const areaMatch = /영역\s+(\d+)\s*\/\s*(\d+)/.exec(message);
                    if (areaMatch) {
                        const ai = Number(areaMatch[1]);
                        const at = Number(areaMatch[2]);
                        withinPathRatio = at > 0 ? ai / at : rawPercent / 100;
                    } else {
                        withinPathRatio = rawPercent / 100;
                    }

                    const overall = pathStart + (pathEnd - pathStart) * withinPathRatio;
                    return clamp(overall, START_PATHS, END_PATHS);
                }

                return clamp(START_INIT + (END_INIT - START_INIT) * (rawPercent / 100), START_INIT, END_INIT);
            };

            let currentPathIndex = 0;
            let totalPaths = 0;

            const onProgress = (raw: number, message: string) => {
                const pathMatch = /(\d+)\s*\/\s*(\d+)\s*경로\s*계산\s*중/.exec(message);
                if (pathMatch) {
                    currentPathIndex = Number(pathMatch[1]);
                    totalPaths = Number(pathMatch[2]);
                }

                const areaMatch = /영역\s+(\d+)\s*\/\s*(\d+)/.exec(message);
                const areaIndex = areaMatch ? Number(areaMatch[1]) : undefined;
                const areaTotal = areaMatch ? Number(areaMatch[2]) : undefined;

                const overall = mapProgress(raw, message, {
                    pathIndex: currentPathIndex || undefined,
                    pathTotal: totalPaths || undefined,
                    areaIndex,
                    areaTotal
                });

                setGenerationState(prev => ({
                    ...prev,
                    progress: Math.min(Math.max(overall, prev.progress), 99.9),
                    currentStep: message
                }));
            };

            setGenerationState(prev => ({
                ...prev,
                progress: 1,
                currentStep: 'G-code 생성 시작...'
            }));

            const gcode = await generateGcode(
                shapes,
                gcodeSettings,
                workArea,
                gcodeSnippets,
                onProgress
            );

            setGenerationState(prev => ({
                ...prev,
                progress: Math.max(prev.progress, 95),
                currentStep: 'G-code 파싱 중...'
            }));

            const path = parseGCodeToPath(gcode);
            dispatch(setGCode({ gcode, path }));

            // ✨ FIX: 실시간 카운트다운 로직으로 변경
            let countdown = 3;
            setGenerationState(prev => ({
                ...prev,
                progress: 100,
                status: 'completed',
                currentStep: `${countdown}초 후 미리보기로 이동합니다...`
            }));

            navigationTimerRef.current = setInterval(() => {
                countdown -= 1;
                if (countdown > 0) {
                    setGenerationState(prev => ({
                        ...prev,
                        progress: 100,
                        status: 'completed',
                        currentStep: `${countdown}초 후 미리보기로 이동합니다...`
                    }));
                } else {
                    if (navigationTimerRef.current) {
                        clearInterval(navigationTimerRef.current);
                    }
                    setGenerationState(prev => ({ ...prev, currentStep: "이동 중..." }));
                    router.push('/preview');
                }
            }, 1000);

        } catch (error) {
            console.error('G-Code 생성 실패:', error);
            setGenerationState(prev => ({
                ...prev,
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            }));
        }
    }, [shapes, gcodeSettings, workArea, gcodeSnippets, dispatch, router]);

    const handleViewPreview = useCallback(() => {
        if (navigationTimerRef.current) {
            // ✨ FIX: setTimeout -> setInterval에 맞춰 clearInterval로 변경
            clearInterval(navigationTimerRef.current);
        }
        setGenerationState(prev => ({ ...prev, isOpen: false }));
        router.push('/preview');
    }, [router]);

    const handleCloseModal = useCallback(() => {
        if (generationState.status !== 'generating') {
            if (navigationTimerRef.current) {
                // ✨ FIX: setTimeout -> setInterval에 맞춰 clearInterval로 변경
                clearInterval(navigationTimerRef.current);
            }
            setGenerationState(prev => ({ ...prev, isOpen: false }));
        }
    }, [generationState.status]);

    const renderLeftPanel = () => {
        if (isDrawingTool) {
            return <ToolContextPanel />;
        }
        if (hasSelectedShapes) {
            return <PropertyPanel />;
        }
        return <ToolContextPanel />;
    };

    return (
        <div className="h-full w-full flex flex-col bg-background text-foreground relative">
            <Toolbar onGenerateGCode={handleGenerateGCode} />

            <div className="flex flex-1 overflow-hidden relative">
                <ResizablePanelGroup direction="horizontal" className="h-full w-full">
                    <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
                        {renderLeftPanel()}
                    </ResizablePanel>

                    <ResizableHandle withHandle/>

                    <ResizablePanel defaultSize={60} minSize={40}>
                        <div className="relative h-full w-full overflow-hidden bg-muted/20">
                            <DynamicCanvasStage />
                            <WorkspaceOverlays />
                        </div>
                    </ResizablePanel>

                    <ResizableHandle withHandle/>

                    <ResizablePanel defaultSize={20} minSize={10} maxSize={30}>
                        <ObjectPanel/>
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>

            <GCodeGenerationDialog
                isOpen={generationState.isOpen}
                onClose={handleCloseModal}
                progress={generationState.progress}
                status={generationState.status}
                currentStep={generationState.currentStep}
                error={generationState.error}
                onViewPreview={handleViewPreview}
            />
        </div>
    );
};

export default function WorkspacePage() {
    return (
        <CanvasProvider>
            <WorkspaceContent />
        </CanvasProvider>
    );
}

