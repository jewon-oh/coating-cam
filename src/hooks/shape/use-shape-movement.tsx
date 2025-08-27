// src/hooks/use-shape-movement.tsx
import React, { useCallback, useRef } from 'react';
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { batchUpdateShapes } from '@/store/slices/shapes-slice';
import { setPresent } from '@/store/slices/history-slice';
import type { CustomShapeConfig } from '@/types/custom-konva-config';
import { useSettings } from '@/contexts/settings-context';

export function useShapeMovement() {
    const dispatch = useAppDispatch();
    const { shapes, selectedShapeIds } = useAppSelector((state) => state.shapes);
    const { isSnappingEnabled, gridSize } = useSettings();

    const shapesRef = useRef(shapes);
    React.useEffect(() => {
        shapesRef.current = shapes;
    }, [shapes]);

    // 드래그 시작 위치 저장용
    const dragStartPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

    // 스냅 함수
    const snap = useCallback(
        (v: number) => (isSnappingEnabled ? Math.round(v / gridSize) * gridSize : v),
        [isSnappingEnabled, gridSize]
    );

    // 드래그 시작 핸들러
    const handleDragStart = useCallback((e: KonvaEventObject<DragEvent>) => {
        const node = e.target;
        dragStartPositionsRef.current.set(node.id(), {
            x: node.x(),
            y: node.y()
        });
    }, []);

    // 드래그 이동 중 스냅 적용
    const handleDragMove = useCallback((e: KonvaEventObject<DragEvent>) => {
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

    // 드래그 종료 핸들러 - 실제 이동했을 때만 히스토리 기록
    const handleDragEnd = useCallback((e: KonvaEventObject<DragEvent>) => {
        const node = e.target;
        const shape = shapesRef.current.find(s => s.id === node.id());

        if (!shape) return;

        const startPos = dragStartPositionsRef.current.get(node.id());
        const currentPos = { x: node.x(), y: node.y() };

        // 실제로 이동했는지 확인 (최소 0.5픽셀 이상)
        const hasMoved = !startPos ||
            Math.abs(currentPos.x - startPos.x) > 0.5 ||
            Math.abs(currentPos.y - startPos.y) > 0.5;

        if (!hasMoved) {
            dragStartPositionsRef.current.delete(node.id());
            return;
        }

        // 위치 업데이트 및 히스토리 기록
        const updates: { id: string; props: Partial<CustomShapeConfig> }[] = [];

        if (selectedShapeIds.includes(shape.id!)) {
            // 선택된 도형들이 함께 이동하는 경우
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
            // 단일 도형 이동
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

        // 시작 위치 정리
        dragStartPositionsRef.current.delete(node.id());
    }, [dispatch, selectedShapeIds]);

    // 키보드를 통한 미세 이동
    const handleNudge = useCallback((direction: 'up' | 'down' | 'left' | 'right', distance = 1) => {
        if (selectedShapeIds.length === 0) return;

        const updates: { id: string; props: Partial<CustomShapeConfig> }[] = [];
        let deltaX = 0;
        let deltaY = 0;

        switch (direction) {
            case 'up':
                deltaY = -distance;
                break;
            case 'down':
                deltaY = distance;
                break;
            case 'left':
                deltaX = -distance;
                break;
            case 'right':
                deltaX = distance;
                break;
        }

        selectedShapeIds.forEach(shapeId => {
            const shape = shapesRef.current.find(s => s.id === shapeId);
            if (shape) {
                const newX = snap((shape.x || 0) + deltaX);
                const newY = snap((shape.y || 0) + deltaY);
                updates.push({
                    id: shapeId,
                    props: { x: newX, y: newY }
                });
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

    // 위치를 직접 설정
    const moveShapeTo = useCallback((shapeId: string, x: number, y: number) => {
        const shape = shapesRef.current.find(s => s.id === shapeId);
        if (!shape) return;

        const snappedX = snap(x);
        const snappedY = snap(y);

        dispatch(batchUpdateShapes([{
            id: shapeId,
            props: { x: snappedX, y: snappedY }
        }]));

        const updatedShapes = shapesRef.current.map(s =>
            s.id === shapeId ? { ...s, x: snappedX, y: snappedY } : s
        );

        dispatch(setPresent(updatedShapes));
    }, [snap, dispatch]);

    // 여러 도형을 특정 좌표로 이동
    const moveShapesTo = useCallback((shapeIds: string[], positions: { x: number; y: number }[]) => {
        const updates: { id: string; props: Partial<CustomShapeConfig> }[] = [];

        shapeIds.forEach((shapeId, index) => {
            if (positions[index]) {
                const snappedX = snap(positions[index].x);
                const snappedY = snap(positions[index].y);
                updates.push({
                    id: shapeId,
                    props: { x: snappedX, y: snappedY }
                });
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