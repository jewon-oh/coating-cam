import React, {useCallback, useState} from 'react';
import {useAppSelector} from '@/hooks/redux';
import {useSettings} from '@/contexts/settings-context';
import {useCanvas} from '@/contexts/canvas-context';

import {StatusBar} from './statusbar';
import {ShortcutGuide} from './shortcut-guide';
import {LoadingOverlay} from './loading-overlay';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/components/ui/tooltip";
import {Button} from "@/components/ui/button";
import {Keyboard} from "lucide-react";
import dynamic from "next/dynamic";

const DynamicMinimap = dynamic(() => import('@/components/workspace/minimap'), {
    ssr: false,
});


/**
 * Stage의 pan/zoom을 그대로 따라가는 오버레이 컨테이너.
 * 내부 자식은 workArea(0,0 ~ width,height) 좌표계 기준으로 absolute 배치하세요.
 */
export const WorkspaceOverlays = () => {
    const shapes = useAppSelector((state) => state.shapes.shapes);
    const selectedShapeIds = useAppSelector((state) => state.shapes.selectedShapeIds);
    const {workArea, pixelsPerMm} = useSettings();
    const {stage, loading, setStage} = useCanvas(); // ✅ setStage 추가

    const workAreaPx = React.useMemo(() => ({
        width: workArea.width * pixelsPerMm,
        height: workArea.height * pixelsPerMm,
    }), [workArea, pixelsPerMm]);

    const [showShortcuts, setShowShortcuts] = useState(false);

    // ✅ 미니맵에서 뷰포트 변경 핸들러 추가
    const handleViewportChange = useCallback((x: number, y: number) => {
        setStage(prevStage => ({
            ...prevStage,
            x,
            y
        }));
    }, [setStage]);

    return (
        <>
            {/* 상태 바 */}
            <StatusBar
                shapes={shapes}
                selectedCount={selectedShapeIds.length}
                zoom={stage.scale}
                isLoading={loading.isLoading}
            />
            {/* 미니맵 */}
            <DynamicMinimap
                shapes={shapes}
                workArea={workAreaPx}
                viewport={stage}
                onViewportChange={handleViewportChange}
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