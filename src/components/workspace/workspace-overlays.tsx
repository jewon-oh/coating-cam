import React, {useState} from 'react';
import {useAppSelector} from '@/hooks/redux';
import {useSettings} from '@/contexts/settings-context';
import {useCanvas} from '@/contexts/canvas-context';

import {StatusBar} from './statusbar';
import {Minimap} from './minimap';
import {ShortcutGuide} from './shortcut-guide';
import {LoadingOverlay} from './loading-overlay';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/components/ui/tooltip";
import {Button} from "@/components/ui/button";
import {Keyboard} from "lucide-react";

/**
 * Stage의 pan/zoom을 그대로 따라가는 오버레이 컨테이너.
 * 내부 자식은 workArea(0,0 ~ width,height) 좌표계 기준으로 absolute 배치하세요.
 */

export const WorkspaceOverlays = () => {
    const shapes = useAppSelector((state) => state.shapes.shapes);
    const selectedShapeIds = useAppSelector((state) => state.shapes.selectedShapeIds);
    const {workArea} = useSettings();
    const {stage, isLoading} = useCanvas();

    const [showShortcuts, setShowShortcuts] = useState(false);


    return (
        <>
            {/* 상태 바 */}
            <StatusBar
                shapes={shapes}
                selectedCount={selectedShapeIds.length}
                zoom={stage.scale}
                isLoading={isLoading}
            />
            {/* 미니맵 */}
            <Minimap
                shapes={shapes}
                workArea={workArea}
                viewport={stage}
            />

            {/* 단축키 가이드 버튼 */}
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-4 right-40 h-8 w-8 bg-white/90 backdrop-blur-sm"
                            onClick={() => setShowShortcuts(true)}
                        >
                            <Keyboard className="h-4 w-4"/>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>단축키 가이드 (?)</TooltipContent>
                </Tooltip>
            </TooltipProvider>

            {/* 단축키 버튼 */}
            <ShortcutGuide
                isVisible={showShortcuts}
                onClose={() => setShowShortcuts(false)}
            />

            <LoadingOverlay/>
        </>
    );
};