import  { useCallback } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { unselectAllShapes } from '@/store/slices/shape-slice';

// 분리된 훅들 import
import { useShapeDrawing } from './shape/use-shape-drawing';
import { useShapeSelection } from './shape/use-shape-selection';
import { useShapeEditing } from './shape/use-shape-editing';
import { useShapeMovement } from './shape/use-shape-movement';
import {DRAWING_TOOLS} from "@/types/tool-type";

export function useShapeEvents() {
    const dispatch = useAppDispatch();
    const { tool } = useAppSelector((state) => state.tool);

    // 각 기능별 훅들
    const drawing = useShapeDrawing();
    const selection = useShapeSelection();
    const editing = useShapeEditing();
    const movement = useShapeMovement();

    // 마우스 이벤트 핸들러들
    const handleMouseDown = useCallback((e: KonvaEventObject<MouseEvent>) => {
        console.log('useShapeEvents: handleMouseDown', tool);

        if (DRAWING_TOOLS.includes(tool)) {
            console.log('drawing tool')
            if (drawing.startDrawing(e)) {
                return;
            }
        }

        if (tool === 'select') {
            if (selection.startDragSelection(e)) return;
        }
    }, [tool, drawing, selection]);

    const handleMouseMove = useCallback((e: KonvaEventObject<MouseEvent>) => {
        if (drawing.updateDrawing(e)) return;
        if (selection.updateDragSelection(e)) return;
    }, [drawing, selection]);

    const handleMouseUp = useCallback((e: KonvaEventObject<MouseEvent>) => {
        if (drawing.finishDrawing(e)) {
            return;
        }

        if (selection.finishDragSelection(e)) {
            return;
        }
    }, [drawing, selection]);

    const handleMouseLeave = useCallback(() => {
        drawing.cancelDrawing();
        selection.cancelDragSelection();
    }, [drawing, selection]);

    // 개별 도형 클릭 선택
    const handleSelect = useCallback((e: KonvaEventObject<MouseEvent>) => {
        selection.handleSelect(e);
    }, [selection]);

    // 컨텍스트 메뉴 처리
    const handleContextMenu = useCallback(() => {
        // return selection.handleContextMenuSelection(e);
    }, []);

    // 캔버스 클릭 핸들러
    const handleCanvasClick = useCallback((e: KonvaEventObject<MouseEvent>) => {
        // 💡 '클릭-클릭' 그리기 모드의 두 번째 클릭을 처리
        if (drawing.handleClickForDrawing(e)) {
            return;
        }

        if (e.target === e.target.getStage()) {
            dispatch(unselectAllShapes());
        }
    }, [dispatch, drawing]); // 💡 drawing을 의존성 배열에 추가

    return {
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleMouseLeave,
        handleSelect,
        handleContextMenu,
        handleCanvasClick,

        handleDragStart: movement.handleDragStart,
        handleDragMove: movement.handleDragMove,
        handleDragEnd: movement.handleDragEnd,

        handleDelete: editing.handleDelete,
        handleCopy: editing.handleCopy,
        handlePaste: editing.handlePaste,
        handleCut: editing.handleCut,
        handleGroup: editing.handleGroup,

        handleUngroup: editing.handleUngroup,
        handleSelectAll: selection.handleSelectAll,
        handleNudge: movement.handleNudge,

        isDrawing: drawing.isDrawing,
        isDragSelecting: selection.isDragSelecting,

        selectedShapeIds: selection.selectedShapeIds,
        hasClipboardData: editing.hasClipboardData,
        isSnappingEnabled: movement.isSnappingEnabled,
    };
}
