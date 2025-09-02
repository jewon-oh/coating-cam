import { useCallback, useRef, useState } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import {selectMultipleShapes, selectShape, unselectAllShapes} from '@/store/slices/shape-slice';
import { useSelectionRect } from '@/hooks/use-selection-rect';
import Konva from "konva";
import {CustomShapeConfig} from "@/types/custom-konva-config";

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

        console.log('start drag selection')

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

        // 이 부분은 변경 없음: 수정된 getShapeBox를 사용하게 됨
        const selectedIds: string[] = [];
        shapes.forEach(shape => {
            if (shape.isLocked) return;

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


    const handleSelectAll = useCallback(() => {
        const ids = shapes
            .filter(s => s.visible !== false && !s.isLocked)
            .map(s => s.id!)
            .filter(Boolean);
        if (ids.length) dispatch(selectMultipleShapes(ids));
    }, [dispatch, shapes]);


    return {
        isDragSelecting,
        startDragSelection,
        updateDragSelection,
        finishDragSelection,
        cancelDragSelection,
        handleSelect,
        handleSelectAll,
        selectedShapeIds
    };
}

/** 도형의 경계 상자를 나타내는 타입 */
interface Box {
    x: number;
    y: number;
    width: number;
    height: number;
}

// 유틸리티 함수들


// 헬퍼 함수: 라인의 절대 끝점 좌표를 계산합니다.
function getLineEndPosition(shape: CustomShapeConfig): { x: number; y: number } {
    const startX = shape.x || 0;
    const startY = shape.y || 0;

    // points는 시작점 기준 상대 좌표 [0, 0, endX, endY]
    const relEndX = shape.points?.[2] || 0;
    const relEndY = shape.points?.[3] || 0;
    const rotation = shape.rotation || 0;

    // 라디안으로 변환
    const rad = rotation * (Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // 회전 변환 적용
    const rotatedX = relEndX * cos - relEndY * sin;
    const rotatedY = relEndX * sin + relEndY * cos;

    // 절대 좌표 반환
    return {
        x: startX + rotatedX,
        y: startY + rotatedY,
    };
}


// ⭐️ 수정된 함수: getShapeBox
/** 도형의 경계 상자(bounding box)를 계산하여 반환합니다. */
function getShapeBox(shape: CustomShapeConfig): Box {
    const x = shape.x || 0;
    const y = shape.y || 0;

    if (shape.type === 'circle') {
        const radius = shape.radius || 0;
        return {
            x: x - radius,
            y: y - radius,
            width: radius * 2,
            height: radius * 2
        };
    }

    // 💡 라인 타입에 대한 처리 추가
    if (shape.type === 'line') {
        const startPoint = { x, y };
        const endPoint = getLineEndPosition(shape);

        const minX = Math.min(startPoint.x, endPoint.x);
        const minY = Math.min(startPoint.y, endPoint.y);
        const maxX = Math.max(startPoint.x, endPoint.x);
        const maxY = Math.max(startPoint.y, endPoint.y);

        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
        };
    }

    // 사각형 및 기타 도형
    return {
        x,
        y,
        width: shape.width || 0,
        height: shape.height || 0
    };
}


/** 두 경계 상자가 겹치는지 확인합니다. */
function isBoxIntersecting(box1: Box, box2: Box): boolean {
    return !(box1.x + box1.width < box2.x ||
        box2.x + box2.width < box1.x ||
        box1.y + box1.height < box2.y ||
        box2.y + box2.height < box1.y);
}