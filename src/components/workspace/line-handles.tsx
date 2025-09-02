import React, { useMemo } from 'react';
import { Circle } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { LineShapeConfig } from '@/types/custom-konva-config';
import { useLineHandles } from '@/hooks/shape/use-line-handles';
import { useAppSelector } from '@/hooks/redux';

interface LineHandlesProps {
    lineNode: Konva.Line | null;
}

export const LineHandles: React.FC<LineHandlesProps> = ({ lineNode }) => {
    // ✨ FIX: 드래깅 상태를 Redux에서 가져옵니다.
    const { selectedShapeIds, shapes, isDragging, draggingShapeIds } = useAppSelector((state) => state.shapes);

    const selectedLineConfig = useMemo(() => {
        if (selectedShapeIds.length !== 1) {
            return null;
        }
        const selectedShape = shapes.find(s => s.id === selectedShapeIds[0]);

        if (selectedShape?.type === 'line') {
            return selectedShape as LineShapeConfig;
        }
        return null;
    }, [selectedShapeIds, shapes]);

    const { handleProps, handleDragMove, handleDragEnd } = useLineHandles(
        lineNode,
        selectedLineConfig,
    );

    // ✨ FIX: 현재 선택된 라인이 드래그 중인지 확인합니다.
    const isSelectedLineDragging = useMemo(() => {
        if (!isDragging || !selectedLineConfig) {
            return false;
        }
        return draggingShapeIds.includes(selectedLineConfig.id!);
    }, [isDragging, draggingShapeIds, selectedLineConfig]);

    const commonHandleStyle = {
        radius: 6,
        fill: '#3b82f6',
        stroke: 'white',
        strokeWidth: 2,
        draggable: true,
        onDragStart: (e: KonvaEventObject<DragEvent>) => e.evt.stopPropagation(),
    };

    // ✨ FIX: 라인 드래깅 중에는 핸들을 표시하지 않습니다.
    if (!handleProps.isVisible || isSelectedLineDragging) {
        return null;
    }

    return (
        <>
            {/* Start point handle */}
            <Circle
                name="line-handler-start"
                x={handleProps.start?.x}
                y={handleProps.start?.y}
                scaleX={handleProps.start?.scale.x}
                scaleY={handleProps.start?.scale.y}
                onDragMove={handleDragMove}
                onDragEnd={handleDragEnd}
                {...commonHandleStyle}
            />
            {/* End point handle */}
            <Circle
                name="line-handler-end"
                x={handleProps.end?.x}
                y={handleProps.end?.y}
                scaleX={handleProps.end?.scale.x}
                scaleY={handleProps.end?.scale.y}
                onDragMove={handleDragMove}
                onDragEnd={handleDragEnd}
                {...commonHandleStyle}
            />
        </>
    );
};

