// src/hooks/use-shape-movement.tsx
import React, { useCallback, useRef } from 'react';
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { batchUpdateShapes, setDragging, setDraggingShapeIds } from '@/store/slices/shape-slice';
import { setPresent } from '@/store/slices/shape-history-slice';
import type { CustomShapeConfig } from '@/types/custom-konva-config';
import { useSettings } from '@/contexts/settings-context';

export function useShapeMovement() {
    const dispatch = useAppDispatch();
    const { shapes, selectedShapeIds } = useAppSelector((state) => state.shapes);
    const { isSnappingEnabled, pixelsPerMm } = useSettings();

    const shapesRef = useRef(shapes);
    React.useEffect(() => {
        shapesRef.current = shapes;
    }, [shapes]);

    const dragStartPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

    const snap = useCallback(
        (v: number) => (isSnappingEnabled ? Math.round(v / pixelsPerMm) * pixelsPerMm : v),
        [isSnappingEnabled, pixelsPerMm]
    );

    const handleDragStart = useCallback((e: KonvaEventObject<DragEvent>) => {
        console.log('handleDragStart');
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
        console.log('handleDragMove');
        const node = e.target as Konva.Node & {
            x: () => number;
            y: () => number;
            position: (p: { x: number; y: number }) => void
        };
        const sx = snap(node.x());
        const sy = snap(node.y());
        if (sx !== node.x() || sy !== node.y()) {
            node.position({ x: sx, y: sy });
            node.getLayer()?.batchDraw();
        }
    }, [snap]);

    const handleDragEnd = useCallback((e: KonvaEventObject<DragEvent>) => {
        console.log('handleDragEnd');
        dispatch(setDragging(false));
        dispatch(setDraggingShapeIds([])); // 드래그 종료 시 ID 목록 초기화

        const node = e.target;
        const shape = shapesRef.current.find(s => s.id === node.id());

        if (!shape) return;

        const startPos = dragStartPositionsRef.current.get(node.id());
        const currentPos = { x: node.x(), y: node.y() };

        const hasMoved = !startPos ||
            Math.abs(currentPos.x - startPos.x) > 0.5 ||
            Math.abs(currentPos.y - startPos.y) > 0.5;

        if (!hasMoved) {
            dragStartPositionsRef.current.delete(node.id());
            return;
        }

        const updates: { id: string; props: Partial<CustomShapeConfig> }[] = [];

        if (selectedShapeIds.includes(shape.id!)) {
            selectedShapeIds.forEach(shapeId => {
                const targetShape = shapesRef.current.find(s => s.id === shapeId);
                if (targetShape) {
                    const stage = e.target.getStage();
                    const stageNode = stage?.findOne(`#${shapeId}`);
                    if (stageNode) {
                        updates.push({
                            id: shapeId,
                            props: {
                                x: stageNode.x(),
                                y: stageNode.y(),
                            }
                        });
                    }
                }
            });
        } else {
            updates.push({
                id: shape.id!,
                props: currentPos
            });
        }

        if (updates.length > 0) {
            dispatch(batchUpdateShapes(updates));

            const updatedShapes = shapesRef.current.map(shape => {
                const update = updates.find(u => u.id === shape.id);
                return update ? { ...shape, ...update.props } : shape;
            });

            dispatch(setPresent(updatedShapes));
        }

        dragStartPositionsRef.current.delete(node.id());
    }, [dispatch, selectedShapeIds]);

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
                const newX = snap((shape.x || 0) + deltaX);
                const newY = snap((shape.y || 0) + deltaY);
                updates.push({ id: shapeId, props: { x: newX, y: newY } });
            }
        });

        if (updates.length > 0) {
            dispatch(batchUpdateShapes(updates));
            const updatedShapes = shapesRef.current.map(shape => {
                const update = updates.find(u => u.id === shape.id);
                return update ? { ...shape, ...update.props } : shape;
            });
            dispatch(setPresent(updatedShapes));
        }
    }, [selectedShapeIds, snap, dispatch]);

    const moveShapeTo = useCallback((shapeId: string, x: number, y: number) => {
        const shape = shapesRef.current.find(s => s.id === shapeId);
        if (!shape) return;

        const snappedX = snap(x);
        const snappedY = snap(y);

        dispatch(batchUpdateShapes([{ id: shapeId, props: { x: snappedX, y: snappedY } }]));
        const updatedShapes = shapesRef.current.map(s => s.id === shapeId ? { ...s, x: snappedX, y: snappedY } : s);
        dispatch(setPresent(updatedShapes));
    }, [snap, dispatch]);

    const moveShapesTo = useCallback((shapeIds: string[], positions: { x: number; y: number }[]) => {
        const updates: { id: string; props: Partial<CustomShapeConfig> }[] = [];
        shapeIds.forEach((shapeId, index) => {
            if (positions[index]) {
                const snappedX = snap(positions[index].x);
                const snappedY = snap(positions[index].y);
                updates.push({ id: shapeId, props: { x: snappedX, y: snappedY } });
            }
        });

        if (updates.length > 0) {
            dispatch(batchUpdateShapes(updates));
            const updatedShapes = shapesRef.current.map(shape => {
                const update = updates.find(u => u.id === shape.id);
                return update ? { ...shape, ...update.props } : shape;
            });
            dispatch(setPresent(updatedShapes));
        }
    }, [snap, dispatch]);

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