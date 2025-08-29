import React from 'react';
import { Circle, Group } from 'react-konva';
import { CustomShapeConfig } from '@/types/custom-konva-config';

interface LineEndpointsMarkerProps {
    shape: CustomShapeConfig;
    isSelected: boolean;
}

export const LineEndpointsMarker: React.FC<LineEndpointsMarkerProps> = ({ shape, isSelected }) => {
    if (shape.type !== 'line' || !isSelected || !shape.points) return null;

    const startX = shape.points[0] || 0;
    const startY = shape.points[1] || 0;
    const endX = shape.points[2] || 0;
    const endY = shape.points[3] || 0;

    return (
        <Group>
            {/* 시작점 마커 */}
            <Circle
                x={startX}
                y={startY}
                radius={6}
                fill="#4ade80"
                stroke="#22c55e"
                strokeWidth={2}
                listening={false}
            />

            {/* 끝점 마커 */}
            <Circle
                x={endX}
                y={endY}
                radius={6}
                fill="#f87171"
                stroke="#ef4444"
                strokeWidth={2}
                listening={false}
            />
        </Group>
    );
};
