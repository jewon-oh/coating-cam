
import type { KonvaEventObject } from 'konva/lib/Node';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { unselectAllShapes } from '@/store/slices/shape-slice';
import { useCanvas } from '@/contexts/canvas-context';
import { usePanZoom } from '@/hooks/use-pan-zoom';
import { DRAWING_TOOLS } from "@/types/tool-type";

// 모드별 이벤트 훅들
import { useShapeEvents } from "@/hooks/use-shape-events";
import { useCallback } from 'react';

// shape 인지 확인하는 헬퍼 함수
const isShape = (type: string) => {
    return type === "Shape";
};

export function useStageEvents() {
    const dispatch = useAppDispatch();
    const { canvasContainerRef, setStageState } = useCanvas();
    const { tool } = useAppSelector((state) => state.tool);

    // 팬/줌 기능
    const {
        isPanning,
        startPan,
        stopPan,
        updateStagePosition,
        handleWheel
    } = usePanZoom(setStageState);

    // 모든 모드의 이벤트 핸들러를 항상 생성 (훅 규칙 준수)
    const shapeEvents = useShapeEvents();

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

        // 도형 클릭 처리 (선택)
        console.log(e.target.name());
        if (isShape(e.target.getType())) {
            shapeEvents.handleSelect(e);
            return;
        }

        // 그리기 도구 처리
        if (DRAWING_TOOLS.includes(tool) && shapeEvents.startDrawing(e)) return;

        // 선택 도구 처리 (드래그 선택 시작)
        if (tool === 'select' && shapeEvents.startDragSelection(e)) return;

    }, [startPan, isPanning, shapeEvents, tool]);

    const handleStageMouseMove = useCallback((e: KonvaEventObject<MouseEvent>) => {
        // 패닝 중이면 다른 작업 차단
        if (isPanning) return;

        // 그리기 업데이트
        if (shapeEvents.updateDrawing(e)) return;

        // 드래그 선택 업데이트
        if (shapeEvents.updateDragSelection(e)) return;

    }, [isPanning, shapeEvents]);

    const handleStageMouseUp = useCallback((e: KonvaEventObject<MouseEvent>) => {
        // 패닝 중이면 다른 작업 차단
        if (isPanning) return;

        // 그리기 완료
        if (shapeEvents.finishDrawing(e)) return;

        // 드래그 선택 완료
        if (shapeEvents.finishDragSelection(e)) return;


    }, [isPanning, shapeEvents]);

    const handleStageMouseLeave = useCallback((e: KonvaEventObject<MouseEvent>) => {
        // 패닝 중단
        if (isPanning) {
            stopPan(e.target.getStage());
        }

        // 그리기 및 드래그 선택 취소
        shapeEvents.cancelDrawing();
        shapeEvents.cancelDragSelection();

    }, [isPanning, stopPan, shapeEvents]);

    const handleStageDragStart = useCallback((e: KonvaEventObject<DragEvent>) => {
        // 패닝 중이면 다른 작업 차단
        if (isPanning) return;

        // shape 드래그 시작
        if (isShape(e.target.getType())) {
            shapeEvents.handleDragStart(e);
            return;
        }
    }, [isPanning, shapeEvents]);

    // 드래그 이벤트 처리
    const handleStageDragMove = useCallback((e: KonvaEventObject<DragEvent>) => {
        const stage = e.target.getStage();
        // 패닝 중
        if (isPanning && stage && e.target === stage) {
            updateStagePosition(stage);
            return;
        }

        // shape 드래그 이동 중
        if (isShape(e.target.getType())) {
            shapeEvents.handleDragMove(e);
            return;
        }

    }, [isPanning, shapeEvents, updateStagePosition]);

    const handleStageDragEnd = useCallback((e: KonvaEventObject<DragEvent>) => {
        // 패닝 종료
        if (isPanning) {
            stopPan(e.target.getStage());
            return;
        }

        // 드래그 이동 종료
        if (isShape(e.target.getType())) {
            shapeEvents.handleDragEnd(e);
            return;
        }
    }, [isPanning, shapeEvents, stopPan]);

    // 캔버스 클릭 핸들러
    const handleCanvasClick = useCallback((e: KonvaEventObject<MouseEvent>) => {
        canvasContainerRef.current?.focus();

        if (isPanning) return;

        // 💡 '클릭-클릭' 그리기 모드의 두 번째 클릭을 처리
        if (DRAWING_TOOLS.includes(tool)) {
            if (shapeEvents.handleClickForDrawing(e)) {
                return;
            }
        }

        // 공통 로직: 빈 영역 클릭 시 선택 해제
        if (e.target === e.target.getStage()) {
            dispatch(unselectAllShapes());
        }

    }, [canvasContainerRef, dispatch, isPanning, shapeEvents, tool]);

    return {
        // 공통 Stage 이벤트 핸들러
        handleStageMouseDown,
        handleStageMouseMove,
        handleStageMouseUp,
        handleStageMouseLeave,
        handleStageDragStart,
        handleStageDragMove,
        handleStageDragEnd,
        handleWheel,
        handleCanvasClick,

        // 공통 상태
        isPanning,

        // 현재 활성화된 모드의 상태들
        selectedShapeIds: shapeEvents.selectedShapeIds || [],
        isDrawing: shapeEvents.isDrawing || false,
        isDragSelecting: shapeEvents.isDragSelecting,
        hasClipboardData: shapeEvents.hasClipboardData || false,
        isSnappingEnabled: shapeEvents.isSnappingEnabled || false,

        // 편집 기능들 (현재 모드에 따라 자동 선택됨)
        handleDelete: shapeEvents.handleDelete,
        handleCopy: shapeEvents.handleCopy,
        handlePaste: shapeEvents.handlePaste,
        handleCut: shapeEvents.handleCut,
        handleGroup: shapeEvents.handleGroup,
        handleUngroup: shapeEvents.handleUngroup,
        handleSelectAll: shapeEvents.handleSelectAll,
        handleNudge: shapeEvents.handleNudge,
    };
}