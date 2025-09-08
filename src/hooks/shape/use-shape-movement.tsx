// src/hooks/use-shape-movement.tsx
import { useCallback, useRef, useEffect } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import type Konva from 'konva';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { batchUpdateShapes, setDragging, setDraggingShapeIds } from '@/store/slices/shape-slice';
import { setPresent } from '@/store/slices/shape-history-slice';
import type { CustomShapeConfig } from '@/types/custom-konva-config';
import { useSettings } from '@/contexts/settings-context';
import { useShapeSnapping } from "@/hooks/shape/use-shape-snapping";

export function useShapeMovement() {
    const dispatch = useAppDispatch();
    const { shapes, selectedShapeIds } = useAppSelector((state) => state.shapes);
    const { isSnappingEnabled } = useSettings();
    const { snapToGrid } = useShapeSnapping();

    const shapesRef = useRef(shapes);
    useEffect(() => {
        shapesRef.current = shapes;
    }, [shapes]);

    const dragStartPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

    /**
     * 여러 도형의 위치를 업데이트하고, 변경 사항을 Redux 스토어와 히스토리(undo/redo)에 반영하는 중앙 집중식 함수입니다.
     * @param updates - 업데이트할 도형의 ID와 새로운 속성(props) 배열
     */
    const applyPositionUpdates = useCallback((updates: { id: string; props: Partial<CustomShapeConfig> }[]) => {
        if (updates.length === 0) return;

        dispatch(batchUpdateShapes(updates));

        // 히스토리 스택에 현재 상태를 저장합니다.
        const updatedShapes = shapesRef.current.map(shape => {
            const update = updates.find(u => u.id === shape.id);
            return update ? { ...shape, ...update.props } : shape;
        });
        dispatch(setPresent(updatedShapes));
    }, [dispatch]);


    const handleDragStart = useCallback((e: KonvaEventObject<DragEvent>) => {
        dispatch(setDragging(true));
        const node = e.target;
        const nodeId = node.id();

        // 드래그되는 도형들의 ID를 설정
        if (selectedShapeIds.includes(nodeId)) {
            dispatch(setDraggingShapeIds(selectedShapeIds));
        } else {
            dispatch(setDraggingShapeIds([nodeId]));
        }

        dragStartPositionsRef.current.set(nodeId, {
            x: node.x(),
            y: node.y()
        });
    }, [dispatch, selectedShapeIds]);

    const handleDragMove = useCallback((e: KonvaEventObject<DragEvent>) => {
        // console.log('handleDragMove');
        const node = e.target as Konva.Node & {
            x: () => number;
            y: () => number;
            position: (p: { x: number; y: number }) => void
        };
        const sx = snapToGrid(node.x());
        const sy = snapToGrid(node.y());
        if (sx !== node.x() || sy !== node.y()) {
            node.position({ x: sx, y: sy });
            node.getLayer()?.batchDraw();
        }
    }, [snapToGrid]);

    const handleDragEnd = useCallback((e: KonvaEventObject<DragEvent>) => {
        console.log('handleDragEnd');
        dispatch(setDragging(false));
        dispatch(setDraggingShapeIds([])); // 드래그 종료 시 ID 목록 초기화

        const node = e.target;
        const shapeId = node.id();
        const shape = shapesRef.current.find(s => s.id === shapeId);

        if (!shape) return;

        const startPos = dragStartPositionsRef.current.get(shapeId);
        const currentPos = { x: node.x(), y: node.y() };

        // 이동이 있었는지 확인 (미세한 움직임은 무시)
        const hasMoved = !startPos ||
            Math.abs(currentPos.x - startPos.x) > 0.5 ||
            Math.abs(currentPos.y - startPos.y) > 0.5;

        if (!hasMoved) {
            dragStartPositionsRef.current.delete(shapeId);
            return;
        }

        const updates: { id: string; props: { x: number; y: number } }[] = [];

        // 드래그된 도형이 다중 선택의 일부인 경우, 이동 델타를 계산하여 모든 선택된 도형에 적용합니다.
        // 이는 LineEditor의 그룹을 포함한 모든 타입의 도형에 일관되게 동작합니다.
        if (selectedShapeIds.includes(shapeId)) {
            const originalShape = shapesRef.current.find(s => s.id === shapeId);
            if (!originalShape) return;

            // 드래그 시작 위치 대비 이동량을 계산합니다.
            const deltaX = currentPos.x - (originalShape.x || 0);
            const deltaY = currentPos.y - (originalShape.y || 0);

            selectedShapeIds.forEach(id => {
                const s = shapesRef.current.find(shape => shape.id === id);
                if (s) {
                    updates.push({
                        id,
                        props: { x: snapToGrid((s.x || 0) + deltaX), y: snapToGrid((s.y || 0) + deltaY) },
                    });
                }
            });
        } else {
            // 단일 도형 드래그의 경우, 현재 위치를 그대로 사용합니다.
            updates.push({ id: shapeId, props: currentPos });
        }

        applyPositionUpdates(updates);

        dragStartPositionsRef.current.delete(shapeId);
    }, [dispatch, selectedShapeIds, snapToGrid, applyPositionUpdates]);

    const handleNudge = useCallback((direction: 'up' | 'down' | 'left' | 'right', distance = 1) => {
        if (selectedShapeIds.length === 0) return;

        const updates: { id: string; props: Partial<CustomShapeConfig> }[] = [];
        let deltaX = 0;
        let deltaY = 0;

        switch (direction) {
            case 'up': deltaY = -distance; break;
            case 'down': deltaY = distance; break;
            case 'left': deltaX = -distance; break;
            case 'right': deltaX = distance; break;
        }

        selectedShapeIds.forEach(shapeId => {
            const shape = shapesRef.current.find(s => s.id === shapeId);
            if (shape) {
                const newX = snapToGrid((shape.x || 0) + deltaX);
                const newY = snapToGrid((shape.y || 0) + deltaY);
                updates.push({ id: shapeId, props: { x: newX, y: newY } });
            }
        });

        applyPositionUpdates(updates);
    }, [selectedShapeIds, snapToGrid, applyPositionUpdates]);

    const moveShapeTo = useCallback((shapeId: string, x: number, y: number) => {
        const shape = shapesRef.current.find(s => s.id === shapeId);
        if (!shape) return;

        const snappedX = snapToGrid(x);
        const snappedY = snapToGrid(y);

        applyPositionUpdates([{ id: shapeId, props: { x: snappedX, y: snappedY } }]);
    }, [snapToGrid, applyPositionUpdates]);

    const moveShapesTo = useCallback((shapeIds: string[], positions: { x: number; y: number }[]) => {
        const updates: { id: string; props: Partial<CustomShapeConfig> }[] = [];
        shapeIds.forEach((shapeId, index) => {
            if (positions[index]) {
                const snappedX = snapToGrid(positions[index].x);
                const snappedY = snapToGrid(positions[index].y);
                updates.push({ id: shapeId, props: { x: snappedX, y: snappedY } });
            }
        });

        applyPositionUpdates(updates as { id: string; props: { x: number; y: number } }[]);
    }, [snapToGrid, applyPositionUpdates]);

    return {
        handleDragStart,
        handleDragMove,
        handleDragEnd,
        handleNudge,
        moveShapeTo,
        moveShapesTo,
        isSnappingEnabled,
    };
}