import { useCallback, useMemo } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useAppDispatch } from '@/hooks/redux';
import { unselectAllShapes } from '@/store/slices/shape-slice';
import { useCanvas } from '@/contexts/canvas-context';
import { usePanZoom } from '@/hooks/use-pan-zoom';

// 모드별 이벤트 훅들
import { useShapeEvents } from "@/hooks/use-shape-events";


export function useStageEvents() {
    const dispatch = useAppDispatch();
    const { canvasContainerRef, setStage } = useCanvas();

    // 팬/줌 기능
    const {
        isPanning,
        startPan,
        stopPan,
        updateStagePosition,
        handleWheel
    } = usePanZoom(setStage);

    // 모든 모드의 이벤트 핸들러를 항상 생성 (훅 규칙 준수)
    const shapeEvents = useShapeEvents();

    // workspaceMode에 따라 현재 활성화된 모드 선택
    const modeEvents = useMemo(() => {
        return shapeEvents; // 기본값
    }, [ shapeEvents]);

    // 통합된 Stage 이벤트 핸들러들
    const handleStageMouseDown = useCallback((e: KonvaEventObject<MouseEvent>) => {
        // 공통 로직 1: 미들 클릭 패닝
        if (e.evt.button === 1) {
            const stage = e.target.getStage();
            if (stage) {
                e.evt.preventDefault();
                startPan(stage);
                return;
            }
        }

        // 패닝 중이면 다른 작업 차단
        if (isPanning) return;

        // 모드별 로직 실행
        modeEvents.handleMouseDown(e);
    }, [startPan, isPanning, modeEvents]);

    const handleStageMouseMove = useCallback((e: KonvaEventObject<MouseEvent>) => {
        // 패닝 중이면 다른 작업 차단
        if (isPanning) return;

        // 모드별 로직 실행
        modeEvents.handleMouseMove(e);
    }, [isPanning, modeEvents]);

    const handleStageMouseUp = useCallback((e: KonvaEventObject<MouseEvent>) => {
        // 패닝 중이면 다른 작업 차단
        if (isPanning) return;

        // 모드별 로직 실행
        modeEvents.handleMouseUp(e);
    }, [isPanning, modeEvents]);

    const handleStageMouseLeave = useCallback((e: KonvaEventObject<MouseEvent>) => {
        // 패닝 중단
        if (isPanning) {
            stopPan(e.target.getStage());
        }

        // 모드별 정리 로직 실행
        modeEvents.handleMouseLeave(e);
    }, [isPanning, stopPan, modeEvents]);

    // 드래그 이벤트 처리 (패닝용)
    const handleStageDragMove = useCallback((e: KonvaEventObject<DragEvent>) => {
        const stage = e.target.getStage();
        if (stage && e.target === stage) {
            updateStagePosition(stage);
        }
    }, [updateStagePosition]);

    const handleStageDragEnd = useCallback((e: KonvaEventObject<DragEvent>) => {
        if (isPanning) {
            stopPan(e.target.getStage());
        }
    }, [isPanning, stopPan]);

    // 캔버스 클릭 핸들러
    const handleCanvasClick = useCallback((e: KonvaEventObject<MouseEvent>) => {
        canvasContainerRef.current?.focus();

        if (isPanning) return;

        // 공통 로직: 빈 영역 클릭 시 선택 해제
        if (e.target === e.target.getStage()) {
            dispatch(unselectAllShapes());
        }
    }, [canvasContainerRef, dispatch, isPanning, ]);

    return {
        // 공통 Stage 이벤트 핸들러
        handleStageMouseDown,
        handleStageMouseMove,
        handleStageMouseUp,
        handleStageMouseLeave,
        handleStageDragMove,
        handleStageDragEnd,
        handleWheel,
        handleCanvasClick,

        // 공통 상태
        isPanning,

        // 현재 활성화된 모드의 상태들
        selectedShapeIds: shapeEvents.selectedShapeIds || [],
        isDrawing: modeEvents.isDrawing || false,
        isDragSelecting: shapeEvents.isDragSelecting,
        hasClipboardData: modeEvents.hasClipboardData || false,
        isSnappingEnabled: modeEvents.isSnappingEnabled || false,

        // 편집 기능들 (현재 모드에 따라 자동 선택됨)
        handleDelete: modeEvents.handleDelete,
        handleCopy: modeEvents.handleCopy,
        handlePaste: modeEvents.handlePaste,
        handleCut: modeEvents.handleCut,
        handleGroup: shapeEvents.handleGroup,
        handleUngroup: shapeEvents.handleUngroup,
        handleSelectAll: modeEvents.handleSelectAll,
        handleNudge: modeEvents.handleNudge,
    };
}