import { useMemo, useCallback } from 'react';
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { LineShapeConfig } from '@/types/custom-konva-config';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { updateShape } from '@/store/slices/shape-slice';
import { setPresent } from '@/store/slices/shape-history-slice';
import { useCanvas } from '@/contexts/canvas-context';
import { useShapeSnapping } from "@/hooks/shape/use-shape-snapping";

/**
 * Konva Line의 조절 핸들(시작점, 끝점)의 위치 계산 및 드래그 로직을 처리하는 커스텀 훅입니다.
 * @param lineNode - 현재 선택된 Konva.Line 노드 객체.
 * @param selectedLineConfig - 선택된 라인의 설정 데이터.
 */
export const useLineHandles = (lineNode: Konva.Line | null, selectedLineConfig: LineShapeConfig | null) => {
    const dispatch = useAppDispatch();
    const shapes = useAppSelector(s => s.shapes.shapes);
    const { stageRef } = useCanvas();
    const { snapPointToGrid } = useShapeSnapping();

    // 핸들의 화면상 위치와 크기를 계산합니다.
    const handleProps = useMemo(() => {
        const stage = stageRef.current;
        if (!lineNode || !stage) {
            return { isVisible: false, start: null, end: null };
        }

        const transform = lineNode.getAbsoluteTransform();
        const points = lineNode.points();
        const startPosAbs = transform.point({ x: points[0], y: points[1] });
        const endPosAbs = transform.point({ x: points[2], y: points[3] });

        // 핸들은 스테이지의 스케일에 따라 크기가 변하지 않도록 역스케일을 적용합니다.
        const scaleX = Math.abs(stage.scaleX());
        const scaleY = Math.abs(stage.scaleY());
        const handleScale = { x: 1 / scaleX, y: 1 / scaleY };

        // 핸들의 위치는 Konva Layer를 기준으로 하므로, 절대 좌표를 Layer 좌표로 변환합니다.
        const stageTransform = stage.getTransform().copy().invert();

        return {
            isVisible: true,
            start: { ...stageTransform.point(startPosAbs), scale: handleScale },
            end: { ...stageTransform.point(endPosAbs), scale: handleScale },
        };
    }, [lineNode, stageRef]);


    // 핸들을 드래그하는 동안 실시간으로 라인의 points를 업데이트합니다.
    const handleDragMove = useCallback((e: KonvaEventObject<DragEvent>) => {
        const handle = e.target as Konva.Circle;
        const layer = handle.getLayer();
        const stage = handle.getStage();
        if (!layer || !stage || !lineNode) return;

        // 핸들의 절대 위치를 가져와 그리드에 스냅합니다.
        const absPos = handle.getAbsolutePosition();
        const snappedAbsPos = snapPointToGrid(absPos);

        // 스냅된 위치가 다를 경우 핸들의 시각적 위치를 업데이트합니다.
        if (snappedAbsPos.x !== absPos.x || snappedAbsPos.y !== absPos.y) {
            const snappedRelativePos = layer.getAbsoluteTransform().copy().invert().point(snappedAbsPos);
            handle.position(snappedRelativePos);
        }

        // 라인의 로컬 좌표계로 변환하여 points를 업데이트합니다.
        const invTransform = lineNode.getAbsoluteTransform().copy().invert();
        const newLocalPos = invTransform.point(snappedAbsPos);
        const oldPoints = lineNode.points();
        const newPoints = [...oldPoints];

        if (handle.name() === 'line-handler-start') {
            newPoints[0] = newLocalPos.x; newPoints[1] = newLocalPos.y;
        } else {
            newPoints[2] = newLocalPos.x; newPoints[3] = newLocalPos.y;
        }
        lineNode.points(newPoints);
        layer.batchDraw();
    }, [lineNode, snapPointToGrid]);


    // 드래그가 끝나면 라인의 위치와 points를 정규화하여 Redux 상태를 업데이트합니다.
    const handleDragEnd = useCallback((e: KonvaEventObject<DragEvent>) => {
        if (!lineNode || !selectedLineConfig) return;

        const startHandleNode = e.target.getStage()?.findOne<Konva.Circle>('.line-handler-start');
        const endHandleNode = e.target.getStage()?.findOne<Konva.Circle>('.line-handler-end');
        const layer = e.target.getLayer();
        if (!startHandleNode || !endHandleNode || !layer) return;

        const finalStartAbs = snapPointToGrid(startHandleNode.getAbsolutePosition());
        const finalEndAbs = snapPointToGrid(endHandleNode.getAbsolutePosition());

        const invLayerTransform = layer.getAbsoluteTransform().copy().invert();
        const finalStartRelative = invLayerTransform.point(finalStartAbs);
        const finalEndRelative = invLayerTransform.point(finalEndAbs);

        const currentRotation = lineNode.rotation();
        const updatedProps: Partial<LineShapeConfig> = {
            x: finalStartRelative.x,
            y: finalStartRelative.y,
            rotation: currentRotation,
        };

        const delta = { x: finalEndRelative.x - finalStartRelative.x, y: finalEndRelative.y - finalStartRelative.y };
        const rad = -currentRotation * (Math.PI / 180);
        const cosA = Math.cos(rad);
        const sinA = Math.sin(rad);
        const newEndPointLocal = { x: delta.x * cosA - delta.y * sinA, y: delta.x * sinA + delta.y * cosA };

        updatedProps.points = [0, 0, newEndPointLocal.x, newEndPointLocal.y];

        dispatch(updateShape({ id: selectedLineConfig.id, updatedProps }));
        const updatedShape = { ...selectedLineConfig, ...updatedProps };
        const updatedShapesForHistory = shapes.map(s => s.id === updatedShape.id ? updatedShape : s);
        dispatch(setPresent(updatedShapesForHistory));
    }, [lineNode, selectedLineConfig, snapPointToGrid, dispatch, shapes]);

    return { handleProps, handleDragMove, handleDragEnd };
};