import React, { useMemo } from 'react';
import { Circle } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { LineShapeConfig } from '@/types/custom-konva-config';
import { useLineHandles } from '@/hooks/shape/use-line-handles';
// 💡 1. Redux 훅을 가져옵니다.
import { useAppSelector } from '@/hooks/redux';

// ----------------------------------------------------------------
// 2. UI를 렌더링하는 컴포넌트 (Component)
// ----------------------------------------------------------------
interface LineHandlesProps {
    // 💡 2. selectedLineConfig prop을 제거합니다.
    lineNode: Konva.Line | null;
}

export const LineHandles: React.FC<LineHandlesProps> = ({ lineNode }) => {
    // 💡 3. Redux 스토어에서 직접 선택된 도형 ID와 전체 도형 목록을 가져옵니다.
    const { selectedShapeIds, shapes } = useAppSelector((state) => state.shapes);

    // 💡 4. 선택된 도형 ID를 기반으로 현재 선택된 라인 설정을 찾습니다.
    const selectedLineConfig = useMemo(() => {
        // 하나의 도형만 선택되었는지 확인
        if (selectedShapeIds.length !== 1) {
            return null;
        }
        // 선택된 도형 정보 찾기
        const selectedShape = shapes.find(s => s.id === selectedShapeIds[0]);

        // 해당 도형이 'line' 타입이 맞는지 확인
        if (selectedShape?.type === 'line') {
            return selectedShape as LineShapeConfig;
        }

        return null;
    }, [selectedShapeIds, shapes]);


    // 로직은 모두 분리된 커스텀 훅에 위임합니다.
    const { handleProps, handleDragMove, handleDragEnd } = useLineHandles(lineNode, selectedLineConfig);

    const commonHandleStyle = {
        radius: 6,
        fill: '#3b82f6',
        stroke: 'white',
        strokeWidth: 2,
        draggable: true,
        onDragStart: (e: KonvaEventObject<DragEvent>) => e.evt.stopPropagation(),
    };

    // isVisible이 false이면 아무것도 렌더링하지 않음
    if (!handleProps.isVisible) {
        return null;
    }

    return (
        <>
            {/* 시작점 핸들 */}
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
            {/* 끝점 핸들 */}
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