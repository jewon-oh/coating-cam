"use client";

import dynamic from "next/dynamic";
import {CanvasProvider} from "@/contexts/canvas-context";
import {ObjectPanel} from "@/components/object-panel/object-panel";
import {Toolbar} from "@/components/tool/toolbar";
import React, {useCallback, useState} from "react";
import {WorkspaceOverlays} from "@/components/workspace/workspace-overlays";
import ToolContextPanel from "@/components/workspace/tool-context-panel";
import {useProjectAutoLoad} from "@/hooks/project/use-project-autoload";
import {ResizableHandle, ResizablePanel, ResizablePanelGroup} from "@/components/ui/resizable";
import {PropertyPanel} from "@/components/workspace/shape/property-panel";
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

    const selectedShapeIds = useAppSelector((state) => state.shapes.selectedShapeIds);
    const currentTool = useAppSelector((state) => state.tool.tool);

    const hasSelectedShapes = selectedShapeIds.length > 0;
    const isDrawingTool = currentTool !== 'select';

    // G-Code 생성 상태
    const [generationState, setGenerationState] = useState({
        isOpen: false,
        progress: 0,
        status: 'generating' as 'generating' | 'completed' | 'error',
        currentStep: '',
        error: ''
    });

    // G-code를 경로 데이터로 파싱하는 함수
    const parseGCodeToPath = (gcodeText: string): number[][] => {
        const lines = gcodeText.split('\n');
        const path: number[][] = [];
        let currentX = 0;
        let currentY = 0;
        let currentZ = 5; // 안전 높이

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('G')) continue;

            // G0, G1 명령 파싱
            if (trimmed.startsWith('G0') || trimmed.startsWith('G1')) {
                const xMatch = trimmed.match(/X([+-]?\d*\.?\d+)/);
                const yMatch = trimmed.match(/Y([+-]?\d*\.?\d+)/);
                const zMatch = trimmed.match(/Z([+-]?\d*\.?\d+)/);

                if (xMatch) currentX = parseFloat(xMatch[1]);
                if (yMatch) currentY = parseFloat(yMatch[1]);
                if (zMatch) currentZ = parseFloat(zMatch[1]);

                // 경로에 점 추가
                path.push([ currentX, currentY, currentZ]);
            }
        }

        return path;
    };

    // G-Code 생성 함수
    const handleGenerateGCode = useCallback(async () => {
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

            // 경로/영역 기반 진행률을 전체 진행률로 매핑하는 헬퍼
            const mapProgress = (
                rawPercent: number,
                message: string,
                totals: { pathIndex?: number; pathTotal?: number; areaIndex?: number; areaTotal?: number }
            ) => {
                // 전체 파이프라인 가중치 설정
                // 0-5%: 초기화/분석, 5-95%: 경로 생성(모든 경로 총합), 95-100%: 파싱/마무리
                const START_INIT = 0;
                const END_INIT = 5;
                const START_PATHS = 5;
                const END_PATHS = 95;

                const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

                const pIdx = totals.pathIndex ?? 0;
                const pTot = totals.pathTotal ?? 0;
                const aIdx = totals.areaIndex ?? 0;
                const aTot = totals.areaTotal ?? 0;

                if (pTot > 0) {
                    // 각 경로 구간의 전체 진행률 폭
                    const perPathSpan = (END_PATHS - START_PATHS) / pTot;
                    // 현재 경로의 시작/끝
                    const pathStart = START_PATHS + (pIdx - 1) * perPathSpan;
                    const pathEnd = pathStart + perPathSpan;

                    // 메시지가 영역 i/n 이면 영역 비율로, 아니면 rawPercent(0-100)를 경로 구간으로 매핑
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

                // 경로 총수가 없으면 초기화/기타 단계로 간주: INIT 구간에서만 움직이게 (rawPercent 사용)
                return clamp(START_INIT + (END_INIT - START_INIT) * (rawPercent / 100), START_INIT, END_INIT);
            };

            // 진행률 계산에 사용할 현재 경로/총 경로 수 추적
            let currentPathIndex = 0;
            let totalPaths = 0;

            const onProgress = (raw: number, message: string) => {
                // 경로 i/n 패턴 파싱
                const pathMatch = /(\d+)\s*\/\s*(\d+)\s*경로\s*계산\s*중/.exec(message);
                if (pathMatch) {
                    currentPathIndex = Number(pathMatch[1]);
                    totalPaths = Number(pathMatch[2]);
                }

                // 영역 i/n 패턴도 매핑 시 사용됨
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
                    progress: Math.min(Math.max(overall, prev.progress), 99.9), // 후반 95~100 구간 위해 상한 99.9
                    currentStep: message
                }));
                console.log(`Progress: ${overall.toFixed(1)}% - ${message}`);
            };

            // 시작 표기
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

            // 파싱/마무리 단계(95~100%)
            setGenerationState(prev => ({
                ...prev,
                progress: Math.max(prev.progress, 95),
                currentStep: 'G-code 파싱 중...'
            }));

            const path = parseGCodeToPath(gcode);
            dispatch(setGCode({ gcode, path }));

            // 완료 및 카운트다운(100% 고정)
            for (let sec = 3; sec > 0; sec--) {
                setGenerationState(prev => ({
                    ...prev,
                    progress: 100,
                    status: 'completed',
                    currentStep: `${sec}초 후 미리보기로 이동합니다...`
                }));
                await new Promise(r => setTimeout(r, 1000));
            }

            router.push('/preview');
        } catch (error) {
            console.error('G-Code 생성 실패:', error);
            setGenerationState(prev => ({
                ...prev,
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            }));
        }
    }, [shapes, gcodeSettings, workArea, gcodeSnippets, dispatch, router]);


    // 미리보기로 이동
    const handleViewPreview = useCallback(() => {
        setGenerationState(prev => ({ ...prev, isOpen: false }));
        router.push('/preview');
    }, [router]);

    // 모달 닫기
    const handleCloseModal = useCallback(() => {
        if (generationState.status !== 'generating') {
            setGenerationState(prev => ({ ...prev, isOpen: false }));
        }
    }, [generationState.status]);

    // 우측 패널 렌더링 로직
    const renderRightPanel = () => {
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
                    <ResizablePanel defaultSize={20} minSize={5} maxSize={30}>
                        <ObjectPanel/>
                    </ResizablePanel>

                    <ResizableHandle withHandle/>

                    <ResizablePanel defaultSize={60} minSize={40}>
                        <div className="relative h-full w-full overflow-hidden bg-muted/20">
                            <DynamicCanvasStage />
                            <WorkspaceOverlays />
                        </div>
                    </ResizablePanel>

                    <ResizableHandle withHandle/>

                    <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
                        {renderRightPanel()}
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>

            {/* G-Code 생성 진행률 모달 */}
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