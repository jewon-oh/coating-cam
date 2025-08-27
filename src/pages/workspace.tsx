"use client";

import dynamic from "next/dynamic";
import {CanvasProvider} from "@/contexts/canvas-context";
import {ObjectPanel} from "@/components/object-panel/object-panel";
import {GCodeSettingsDialog} from "@/components/gcode/gcode-settings-dialog";
import {Toolbar} from "@/components/tool/toolbar";
import React, {useState} from "react";
import {WorkspaceOverlays} from "@/components/workspace/workspace-overlays";

import ToolContextPanel from "@/components/tool-context-panel";
import {useProjectAutoLoad} from "@/hooks/project/use-project-autoload";
import {ResizableHandle, ResizablePanel, ResizablePanelGroup} from "@/components/ui/resizable";
import {PropertyPanel} from "@/components/property-panel";
import {useAppSelector} from "@/hooks/redux";

const DynamicCanvasStage = dynamic(() => import('@/components/workspace/workspace-canvas'), {
    ssr: false,
});

const WorkspaceContent = () => {
    const [isGCodeDialogOpen, setGCodeDialogOpen] = useState(false);
    useProjectAutoLoad();

    const selectedShapeIds = useAppSelector((state) => state.shapes.selectedShapeIds);
    const { workspaceMode, tool } = useAppSelector((state) => state.tool);
    const hasSelectedShapes = selectedShapeIds.length > 0;



    return (
        <div className="h-full w-full flex flex-col bg-background text-foreground relative">
            <Toolbar onGenerateGCode={() => setGCodeDialogOpen(true)} />

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
                        {hasSelectedShapes ? (
                            <PropertyPanel/>
                        ) : (
                            <ToolContextPanel />
                        )}
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>

            <GCodeSettingsDialog
                isOpen={isGCodeDialogOpen}
                onClose={() => setGCodeDialogOpen(false)}
            />

            {process.env.NODE_ENV === 'development' && (
                <div className="fixed bottom-4 right-4 bg-black/80 text-white text-xs p-2 rounded z-50">
                    Mode: {workspaceMode} | Tool: {tool} | Selected: {selectedShapeIds.length}
                </div>
            )}
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