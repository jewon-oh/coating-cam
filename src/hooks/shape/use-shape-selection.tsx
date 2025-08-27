import { useCallback, useRef, useState } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import {selectMultipleShapes, selectShape, unselectAllShapes} from '@/store/slices/shapes-slice';
import { useSelectionRect } from '@/hooks/use-selection-rect';

export function useShapeSelection() {
    const dispatch = useAppDispatch();
    const { selectedShapeIds, shapes } = useAppSelector((state) => state.shapes);

    // Selection rect 관리
    const {
        createTempRect,
        updateTempRect,
        destroyTempRect
    } = useSelectionRect();

    // 드래그 선택 상태
    const [isDragSelecting, setIsDragSelecting] = useState(false);
    const dragStartRef = useRef<{ x: number; y: number } | null>(null);

    // 박스 선택 시작
    const startDragSelection = useCallback((e: KonvaEventObject<MouseEvent>) => {
        const stage = e.target.getStage();
        if (!stage || e.target !== stage) return false;

        const pointer = stage.getPointerPosition();
        if (!pointer) return false;

        const transform = stage.getAbsoluteTransform().copy().invert();
        const localPos = transform.point(pointer);

        const layer = stage.findOne<Konva.Layer>('Layer')!;
        createTempRect(layer, localPos.x, localPos.y);

        setIsDragSelecting(true);
        dragStartRef.current = localPos;

        return true;
    }, [createTempRect]);

    // 박스 선택 업데이트
    const updateDragSelection = useCallback((e: KonvaEventObject<MouseEvent>) => {
        if (!isDragSelecting || !dragStartRef.current) return false;

        const stage = e.target.getStage();
        if (!stage) return false;

        const pointer = stage.getPointerPosition();
        if (!pointer) return false;

        const transform = stage.getAbsoluteTransform().copy().invert();
        const localPos = transform.point(pointer);

        const start = dragStartRef.current;
        const x = Math.min(start.x, localPos.x);
        const y = Math.min(start.y, localPos.y);
        const width = Math.abs(localPos.x - start.x);
        const height = Math.abs(localPos.y - start.y);

        updateTempRect(x, y, width, height);
        return true;
    }, [isDragSelecting, updateTempRect]);

    // 박스 선택 완료
    const finishDragSelection = useCallback((e: KonvaEventObject<MouseEvent>) => {
        if (!isDragSelecting || !dragStartRef.current) return false;

        const stage = e.target.getStage();
        if (!stage) return false;

        const pointer = stage.getPointerPosition();
        if (!pointer) return false;

        const transform = stage.getAbsoluteTransform().copy().invert();
        const localPos = transform.point(pointer);

        const start = dragStartRef.current;
        const selectionBox = {
            x: Math.min(start.x, localPos.x),
            y: Math.min(start.y, localPos.y),
            width: Math.abs(localPos.x - start.x),
            height: Math.abs(localPos.y - start.y)
        };

        const selectedIds: string[] = [];
        shapes.forEach(shape => {
            if (!shape.visible || shape.isLocked) return;

            const shapeBox = getShapeBox(shape);
            if (isBoxIntersecting(selectionBox, shapeBox)) {
                selectedIds.push(shape.id!);
            }
        });

        dispatch(selectedIds.length > 0 ? selectMultipleShapes(selectedIds) : unselectAllShapes());

        setIsDragSelecting(false);
        destroyTempRect();
        dragStartRef.current = null;
        return true;
    }, [isDragSelecting, shapes, dispatch, destroyTempRect]);

    // 박스 선택 취소
    const cancelDragSelection = useCallback(() => {
        if (isDragSelecting) {
            setIsDragSelecting(false);
            destroyTempRect();
            dragStartRef.current = null;
        }
    }, [isDragSelecting, destroyTempRect]);

    // 단일,멀티 선택 핸들러
    const handleSelect = useCallback((e: KonvaEventObject<MouseEvent>) => {
        const shapeId = e.target.id(); // 클릭한 도형의 ID 가져오기
        if (!shapeId) return;

        const meta = e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey;
        const isSelected = selectedShapeIds.includes(shapeId);

        if (!meta && !isSelected) {
            dispatch(selectShape(shapeId));
        } else if (meta && isSelected) {
            const remain = selectedShapeIds.filter(x => x !== shapeId);
            if (remain.length) {
                dispatch(selectMultipleShapes(remain))
            } else {
                dispatch(unselectAllShapes());
            }
        } else if (meta && !isSelected) {
            dispatch(selectMultipleShapes([...selectedShapeIds, shapeId]));
        }

    }, [dispatch, selectedShapeIds]);

    return {
        isDragSelecting,
        startDragSelection,
        updateDragSelection,
        finishDragSelection,
        cancelDragSelection,
        handleSelect,
        selectedShapeIds
    };
}

// 유틸리티 함수들
function getShapeBox(shape: any) {
    if (shape.type === 'circle') {
        const radius = shape.radius || 0;
        return {
            x: (shape.x || 0) - radius,
            y: (shape.y || 0) - radius,
            width: radius * 2,
            height: radius * 2
        };
    } else {
        return {
            x: shape.x || 0,
            y: shape.y || 0,
            width: shape.width || 0,
            height: shape.height || 0
        };
    }
}

function isBoxIntersecting(box1: any, box2: any) {
    return !(box1.x + box1.width < box2.x ||
        box2.x + box2.width < box1.x ||
        box1.y + box1.height < box2.y ||
        box2.y + box2.height < box1.y);
}