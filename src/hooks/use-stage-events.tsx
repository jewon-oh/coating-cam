
import  { useCallback } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { unselectAllShapes } from '@/store/slices/shapes-slice';
import { useCanvas } from '@/contexts/canvas-context';
import { usePanZoom } from '@/hooks/use-pan-zoom';

// Shape 모드용 훅들
import { useShapeDrawing } from '@/hooks/shape/use-shape-drawing';
import { useShapeSelection } from '@/hooks/shape/use-shape-selection';
import { useShapeEditing } from '@/hooks/shape/use-shape-editing';
import { useShapeMovement } from '@/hooks/shape/use-shape-movement';

interface UseStageEventsProps {
    workspaceMode: 'shape' | 'path';
}

export function useStageEvents({  workspaceMode }: UseStageEventsProps) {
    const dispatch = useAppDispatch();
    const { tool } = useAppSelector((state) => state.tool);
    const { canvasContainerRef, setStage } = useCanvas();

    // 팬/줌 기능
    const {
        isPanning,
        startPan,
        stopPan,
        updateStagePosition,
        handleWheel
    } = usePanZoom(setStage);

    // Shape 모드 전용 훅들 (workspaceMode가 'shape'일 때만 활성화)
    const shapeDrawing = workspaceMode === 'shape' ? useShapeDrawing() : null;
    const shapeSelection = workspaceMode === 'shape' ? useShapeSelection() : null;
    const shapeEditing = workspaceMode === 'shape' ? useShapeEditing() : null;
    const shapeMovement = workspaceMode === 'shape' ? useShapeMovement() : null;

    // 통합 마우스 다운 핸들러
    const handleStageMouseDown = useCallback((e: KonvaEventObject<MouseEvent>) => {

        // 미들 클릭인 경우 항상 패닝 시작 (모든 모드에서 공통)
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

        // Shape 모드일 때만 도형 그리기/선택 처리
        if (workspaceMode === 'shape' && shapeDrawing && shapeSelection) {
            // 1. 드로잉 도구인 경우 그리기 시작 시도
            if (tool === 'circle' || tool === 'rectangle') {
                if (shapeDrawing.startDrawing(e)) return;
            }

            // 2. 선택 도구인 경우 박스 선택 시작 시도
            if (tool === 'select') {
                if (shapeSelection.startDragSelection(e)) return;
            }
        }

        // Path 모드나 기타 모드의 경우 여기에 추가 로직 구현 가능
        // if (workspaceMode === 'path') {
        //     // Path 모드 전용 로직
        // }
    }, [tool, workspaceMode, startPan, isPanning, shapeDrawing, shapeSelection]);

    // 통합 마우스 무브 핸들러
    const handleStageMouseMove = useCallback((e: KonvaEventObject<MouseEvent>) => {
        // 패닝 중이면 다른 작업 차단
        if (isPanning) return;

        // Shape 모드일 때만 도형 관련 처리
        if (workspaceMode === 'shape' && shapeDrawing && shapeSelection) {
            // 1. 그리기 중인 경우 임시 도형 업데이트
            if (shapeDrawing.updateDrawing(e)) return;

            // 2. 박스 선택 중인 경우 선택 박스 업데이트
            if (shapeSelection.updateDragSelection(e)) return;
        }
    }, [workspaceMode, isPanning, shapeDrawing, shapeSelection]);

    // 통합 마우스 업 핸들러
    const handleStageMouseUp = useCallback((e: KonvaEventObject<MouseEvent>) => {
        // 패닝 중이면 다른 작업 차단
        if (isPanning) return;

        // Shape 모드일 때만 도형 관련 처리
        if (workspaceMode === 'shape' && shapeDrawing && shapeSelection) {
            // 1. 그리기 완료 시도
            if (shapeDrawing.finishDrawing(e)) return;

            // 2. 박스 선택 완료 시도
            if (shapeSelection.finishDragSelection(e)) return;
        }
    }, [workspaceMode, isPanning, shapeDrawing, shapeSelection]);

    // 통합 마우스 리브 핸들러
    const handleStageMouseLeave = useCallback((e: KonvaEventObject<MouseEvent>) => {
        // 패닝 중단
        if (isPanning) {
            stopPan(e.target.getStage());
        }

        // Shape 모드일 때 진행 중인 작업 취소
        if (workspaceMode === 'shape' && shapeDrawing && shapeSelection) {
            shapeDrawing.cancelDrawing();
            shapeSelection.cancelDragSelection();
        }
    }, [workspaceMode, isPanning, stopPan, shapeDrawing, shapeSelection]);

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

        // 빈 영역 클릭 시 모든 선택 해제 (모든 모드 공통)
        if (e.target === e.target.getStage()) {
            dispatch(unselectAllShapes());
        }
    }, [canvasContainerRef, dispatch, isPanning]);

    // Shape 전용 이벤트 핸들러들 (workspaceMode가 'shape'일 때만 반환)
    const shapeEventHandlers = workspaceMode === 'shape' && shapeSelection && shapeMovement ? {
        // 개별 도형 선택
        handleShapeSelect: useCallback((e: KonvaEventObject<MouseEvent>) => {
            if (isPanning) return;
            shapeSelection.handleSelect(e);
        }, [shapeSelection, isPanning]),

        // 컨텍스트 메뉴
        handleShapeContextMenu: useCallback((e: KonvaEventObject<PointerEvent>) => {
            if (isPanning) return;
            return shapeSelection.handleContextMenuSelection(e);
        }, [shapeSelection, isPanning]),

        // 개별 도형 드래그
        handleShapeDragStart: shapeMovement.handleDragStart,
        handleShapeDragMove: shapeMovement.handleDragMove,
        handleShapeDragEnd: shapeMovement.handleDragEnd,

        // 편집 기능들
        handleDelete: shapeEditing?.handleDelete,
        handleCopy: shapeEditing?.handleCopy,
        handlePaste: shapeEditing?.handlePaste,
        handleCut: shapeEditing?.handleCut,
        handleGroup: shapeEditing?.handleGroup,
        handleUngroup: shapeEditing?.handleUngroup,
        handleSelectAll: shapeSelection.handleSelectAll,

        // 상태들
        isDrawing: shapeDrawing?.isDrawing || false,
        isDragSelecting: shapeSelection.isDragSelecting,
        selectedShapeIds: shapeSelection.selectedShapeIds,
        hasClipboardData: shapeEditing?.hasClipboardData || false,
        isSnappingEnabled: shapeMovement.isSnappingEnabled,
    } : {};

    return {
        // 공통 Stage 이벤트 핸들러들 (모든 모드에서 사용)
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
        workspaceMode,

        // Shape 모드 전용 핸들러들과 상태들
        ...shapeEventHandlers,
    };
}