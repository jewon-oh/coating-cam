// Next.js의 클라이언트 컴포넌트로 지정.
// 이 컴포넌트 내에서는 브라우저 API(window, localStorage 등)를 안전하게 사용할 수 있습니다.
"use client";

// Next.js의 동적 임포트를 위한 함수
import dynamic from "next/dynamic";
// 애플리케이션 상태 관리를 위한 캔버스 컨텍스트
import {CanvasProvider} from "@/contexts/canvas-context";
// UI 컴포넌트들
import {ObjectPanel} from "@/components/object-panel/object-panel";
import {GCodeSettingsDialog} from "@/components/gcode/gcode-settings-dialog";
import {Toolbar} from "@/components/tool/toolbar";
import React, {useState} from "react";
import {WorkspaceOverlays} from "@/components/workspace/workspace-overlays";

// Redux 액션 및 훅
import ToolContextPanel from "@/components/tool-context-panel";
import {useProjectAutoLoad} from "@/hooks/use-project-autoload";
import {ResizableHandle, ResizablePanel, ResizablePanelGroup} from "@/components/ui/resizable";
import {PropertyPanel} from "@/components/property-panel";
import {useAppSelector} from "@/hooks/redux";

// SSR(서버 사이드 렌더링) 비활성화
// Konva.js와 같은 캔버스 라이브러리는 브라우저 환경에 의존하므로,
// 서버에서 렌더링되지 않도록 동적으로 임포트합니다.
const DynamicCanvasStage = dynamic(() => import('@/components/workspace/workspace-canvas'), {
    ssr: false,
});


/**
 * 프로젝트 로드 로직을 포함하는 내부 컴포넌트
 * 이 컴포넌트는 CanvasProvider의 컨텍스트에 접근해야 하므로,
 * CanvasProvider 내부에 위치해야 합니다.
 */
const WorkspaceContent = () => {
    // G-Code 설정 다이얼로그의 열림/닫힘 상태 관리
    const [isGCodeDialogOpen, setGCodeDialogOpen] = useState(false);

    // 프로젝트 자동 로드 (Electron / sessionStorage / URL content)
    useProjectAutoLoad();

    const selectedShapeIds = useAppSelector((state) => state.shapes.selectedShapeIds);

    // 선택된 도형이 있는지 확인
    const hasSelectedShapes = selectedShapeIds.length > 0;

    // UI 레이아웃
    return (
        <div className="h-full w-full flex flex-col bg-background text-foreground relative">
            {/* 상단 툴바 컴포넌트 */}
            <Toolbar onGenerateGCode={() => setGCodeDialogOpen(true)}/>

            <div className="flex flex-1 overflow-hidden relative">
                <ResizablePanelGroup direction="horizontal" className="h-full w-full">
                    {/* 좌측 패널: Object Panel */}
                    <ResizablePanel defaultSize={20} minSize={5} maxSize={30}>
                        <ObjectPanel/>
                    </ResizablePanel>

                    <ResizableHandle withHandle/>

                    {/* 중앙 패널: WorkspaceCanvas + Overlays */}
                    <ResizablePanel defaultSize={60} minSize={40}>
                        <div className="relative h-full w-full overflow-hidden bg-muted/20">
                            <DynamicCanvasStage/>
                            <WorkspaceOverlays/>
                        </div>
                    </ResizablePanel>

                    <ResizableHandle withHandle/>

                    {/* 우측 패널: Tool Context Panel */}
                    <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
                        {hasSelectedShapes ? (
                            <PropertyPanel/>
                        ) : <ToolContextPanel/>}

                    </ResizablePanel>
                </ResizablePanelGroup>

            </div>

            {/* G-Code 설정 다이얼로그 (열림/닫힘 상태에 따라 렌더링) */}
            <GCodeSettingsDialog
                isOpen={isGCodeDialogOpen}
                onClose={() => setGCodeDialogOpen(false)}
            />
        </div>
    );
};


/**
 * 워크스페이스 페이지의 메인 컴포넌트
 * CanvasProvider로 WorkspaceContent를 감싸서 컨텍스트를 제공합니다.
 */
export default function WorkspacePage() {
    return (
        <CanvasProvider>
            <WorkspaceContent/>
        </CanvasProvider>
    );
}