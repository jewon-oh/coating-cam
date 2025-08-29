"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Circle, Group, Line } from 'react-konva';
import { useAppSelector } from '@/hooks/redux';
import { useSettings } from '@/contexts/settings-context';
import { selectShapes, selectIsDragging, selectDraggingShapeIds } from '@/store/slices/shape-slice';
import { GCodeGenerator } from '@/lib/gcode/g-code-generator';
import { Point } from '@/lib/gcode/point';
import { CoatingOrderBadge } from './coating-order-badge';
import { useCanvas } from '@/contexts/canvas-context';

/**
 * 각 도형의 코팅 경로 시각화에 필요한 데이터 구조입니다.
 */
interface PathEndpoint {
    shapeId: string;    // 도형의 고유 ID
    startPoint: Point;  // 코팅 시작점
    endPoint: Point;    // 코팅 끝점
    order: number;      // 코팅 순서 번호
}

/**
 * 코팅 순서가 지정된 도형들의 경로(시작점, 끝점, 이동선)를 캔버스 위에 시각화하는 컴포넌트입니다.
 */
export const PathVisualization = () => {
    // --- 전역 상태 및 컨텍스트 --- //
    const { showCoatingOrder, gcodeSettings, workArea } = useSettings();
    const { stage } = useCanvas();
    const allShapes = useAppSelector(selectShapes);
    const isDragging = useAppSelector(selectIsDragging);
    const draggingShapeIds = useAppSelector(selectDraggingShapeIds);

    // --- 로컬 상태 --- //
    const [endpoints, setEndpoints] = useState<PathEndpoint[]>([]);
    const [isCalculating, setIsCalculating] = useState(false); // 경로 계산 중 상태

    // --- 메모이제이션된 계산 --- //
    const orderedShapes = useMemo(() => {
        return allShapes
            .filter(s => s.coatingOrder && s.coatingOrder > 0)
            .sort((a, b) => (a.coatingOrder || 0) - (b.coatingOrder || 0));
    }, [allShapes]);

    // --- 경로 계산 효과 --- //
    useEffect(() => {
        if (isDragging) {
            return;
        }

        if (!showCoatingOrder || orderedShapes.length === 0) {
            setEndpoints([]);
            return;
        }

        const calculateAllEndpoints = async () => {
            setIsCalculating(true); // 계산 시작
            try {
                const generator = new GCodeGenerator(gcodeSettings, workArea, allShapes);
                const newEndpoints: PathEndpoint[] = [];
                let previousEndPoint: Point = { x: 0, y: 0 };

                for (const shape of orderedShapes) {
                    const path = await generator.getOptimizedPathForShape(shape, previousEndPoint);

                    if (path && path.length > 0) {
                        const startPoint = path[0].start;
                        const endPoint = path[path.length - 1].end;
                        
                        newEndpoints.push({
                            shapeId: shape.id!,
                            startPoint,
                            endPoint,
                            order: shape.coatingOrder!,
                        });
                        previousEndPoint = endPoint;
                    }
                }
                setEndpoints(newEndpoints);
            } catch (error) {
                console.error("경로 시각화 계산 중 오류 발생:", error);
                setEndpoints([]); // 오류 발생 시 엔드포인트 초기화
            } finally {
                setIsCalculating(false); // 계산 종료 (성공/실패 무관)
            }
        };

        calculateAllEndpoints();
    }, [showCoatingOrder, orderedShapes, gcodeSettings, workArea, allShapes, isDragging]);

    // --- 렌더링 로직 --- //
    // 계산 중이거나, 옵션이 꺼져 있거나, 렌더링할 포인트가 없으면 아무것도 그리지 않습니다.
    if (isCalculating || !showCoatingOrder || endpoints.length === 0) {
        return null;
    }
    const scaleX = stage.scaleX;
    const scaleY = stage.scaleY;

    // 스케일 계산 개선 - 음수 scaleX 처리 및 최소/최대 제한
    const absScaleX = Math.abs(scaleX);
    const absScaleY = Math.abs(scaleY);
    const minScale = Math.min(absScaleX, absScaleY);

    // invScale 계산에 제한을 두어 너무 크거나 작아지지 않도록 함
    const invScale = Math.max(0.1, Math.min(10, 1 / minScale));
    const absInvScale = Math.abs(invScale);

    return (
        <Group>
            {endpoints.map((ep, index) => {
                const isCurrentShapeDragging = draggingShapeIds.includes(ep.shapeId);
                if (isCurrentShapeDragging) {
                    return null;
                }

                const nextEp = endpoints[index + 1];
                const isNextShapeDragging = nextEp ? draggingShapeIds.includes(nextEp.shapeId) : false;

                return (
                    <React.Fragment key={ep.shapeId}>
                        {/* 시작점 (녹색) */}
                        {/*<Circle*/}
                        {/*    x={ep.startPoint.x}*/}
                        {/*    y={ep.startPoint.y}*/}
                        {/*    radius={4 * absInvScale}*/}
                        {/*    fill="hsl(142.1 76.2% 36.3%)"*/}
                        {/*    stroke="white"*/}
                        {/*    strokeWidth={1.5 * absInvScale}*/}
                        {/*    opacity={0.9}*/}
                        {/*    shadowBlur={5}*/}
                        {/*    shadowColor="black"*/}
                        {/*/>*/}
                        {/* 끝점 (빨간색) */}
                        <Circle
                            x={ep.endPoint.x}
                            y={ep.endPoint.y}
                            radius={4 * absInvScale}
                            fill="hsl(0 100% 50%)"
                            stroke="white"
                            strokeWidth={1.5 * absInvScale}
                            opacity={0.9}
                            shadowBlur={5}
                            shadowColor="black"
                        />
                        {/* 코팅 순서 배지 - 스케일 문제 해결 */}
                        {/* 시작점 */}
                        <CoatingOrderBadge
                            order={ep.order}
                            x={ep.startPoint.x}
                            y={ep.startPoint.y}
                            parentScaleX={scaleX}
                            parentScaleY={scaleY}
                        />

                        {/* 다음 도형으로의 이동 경로 (파란색 점선) */}
                        {nextEp && !isNextShapeDragging && (
                             <Line
                                points={[ep.endPoint.x, ep.endPoint.y, nextEp.startPoint.x, nextEp.startPoint.y]}
                                stroke="hsl(221.2 83.2% 53.3%)"
                                strokeWidth={1.5 * absInvScale}
                                dash={[4 * absInvScale, 3 * absInvScale]}
                                opacity={0.8}
                            />
                        )}
                    </React.Fragment>
                );
            })}
        </Group>
    );
};
