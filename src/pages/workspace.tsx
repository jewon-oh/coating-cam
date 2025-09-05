"use client";

import dynamic from "next/dynamic";
import React from "react";
import { CanvasProvider } from "@/contexts/canvas-context";
import { Toolbar } from "@/components/tool/toolbar";
import { WorkspaceOverlays } from "@/components/workspace/workspace-overlays";
import ToolContextPanel from "@/components/workspace/tool-context-panel";
import { useProjectAutoLoad } from "@/hooks/project/use-project-autoload";
import { PropertyPanel } from "@/components/workspace/property-panel";
import { useAppSelector } from "@/hooks/redux";
import { DRAWING_TOOLS } from "@/types/tool-type";
import { useGCodeGeneration } from "@/hooks/use-gcode-generation"; // ✨ 공통 훅 import

const DynamicCanvasStage = dynamic(() => import('@/components/workspace/workspace-canvas'), {
    ssr: false,
});

const WorkspaceContent = () => {
    useProjectAutoLoad();

    // ✨ G-Code 생성 로직을 공통 훅으로 대체
    const { generate: handleGenerateGCode } = useGCodeGeneration();

    const currentTool = useAppSelector((state) => state.tool.tool);
    const selectedShapeIds = useAppSelector((state) => state.shapes.selectedShapeIds);
    const hasSelectedShapes = selectedShapeIds.length > 0;

    const renderLeftPanel = () => {
        // 그리기 도구가 활성화된 경우, 항상 도구 컨텍스트 패널을 표시합니다.
        if (DRAWING_TOOLS.includes(currentTool)) {
            return <ToolContextPanel className="w-90" />;
        }
        // 선택 도구일 때, 선택된 도형이 있으면 속성 패널을, 없으면 도구 컨텍스트 패널을 표시합니다.
        if (hasSelectedShapes) {
            return <PropertyPanel className="w-90"/>;
        }
        return <ToolContextPanel className="w-90"/>;
    };

    return (
        <div className="h-full w-full flex flex-col bg-background text-foreground relative">
            <Toolbar onGenerateGCode={handleGenerateGCode} />

            <div className="flex flex-1 overflow-hidden relative">
                {renderLeftPanel()}
                <div className="relative h-full w-full overflow-hidden bg-muted/20">
                    <DynamicCanvasStage />
                    <WorkspaceOverlays />
                </div>
            </div>
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
