
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Circle, Group, Line, } from 'react-konva';
import { useAppSelector } from '@/hooks/redux';
import { useSettings } from '@/contexts/settings-context';
import { selectShapes,  selectDraggingShapeIds } from '@/store/slices/shape-slice';
import { GCodeGenerator } from '@/lib/gcode/g-code-generator';
import { Point } from '@/types/point';
import { CoatingOrderBadge } from './coating-order-badge';
import { useCanvas } from '@/contexts/canvas-context';

interface PathEndpoint {
    shapeId: string;
    startPoint: Point;
    endPoint: Point;
    order: number;
}

export const PathVisualization = () => {
    const settings = useSettings();
    const { gcodeSettings, workArea, showCoatingPaths = false } = settings;
    const { stageState } = useCanvas();
    const allShapes = useAppSelector(selectShapes);
    const draggingShapeIds = useAppSelector(selectDraggingShapeIds);

    const [endpoints, setEndpoints] = useState<PathEndpoint[]>([]);
    const [isCalculating, setIsCalculating] = useState(false);

    const orderedShapes = useMemo(() => {
        return allShapes
            .filter(s => s.coatingOrder && s.coatingOrder > 0)
            .sort((a, b) => (a.coatingOrder || 0) - (b.coatingOrder || 0));
    }, [allShapes]);

    const coatingShapes = useMemo(() => {
        return allShapes.filter(s =>
            s.coatingType === 'fill' &&
            s.fillPattern &&
            !s.isLocked &&
            !s.skipCoating
        );
    }, [allShapes]);

    useEffect(() => {
        if (!showCoatingPaths) {
            setEndpoints([]);
            return;
        }

        const calculateVisualizations = async () => {
            setIsCalculating(true);
            try {
                // Endpoint 계산 (기존 로직)
                if (orderedShapes.length > 0) {
                    const generator = new GCodeGenerator(gcodeSettings, workArea, allShapes);
                    const newEndpoints: PathEndpoint[] = [];
                    let previousEndPoint: Point = { x: 0, y: 0 };
                    for (const shape of orderedShapes) {
                        const path = await generator.getOptimizedPathForShape(shape, previousEndPoint);
                        if (path && path.length > 0) {
                            newEndpoints.push({
                                shapeId: shape.id!,
                                startPoint: path[0].start,
                                endPoint: path[path.length - 1].end,
                                order: shape.coatingOrder!,
                            });
                            previousEndPoint = path[path.length - 1].end;
                        }
                    }
                    setEndpoints(newEndpoints);
                }


            } catch (error) {
                console.error("경로 시각화 계산 중 오류 발생:", error);
                setEndpoints([]);
            } finally {
                setIsCalculating(false);
            }
        };

        calculateVisualizations();
    }, [showCoatingPaths, orderedShapes, coatingShapes, gcodeSettings, workArea, allShapes, draggingShapeIds]);



    if (isCalculating || !showCoatingPaths) {
        return null;
    }

    const scaleX = stageState.scaleX;
    const scaleY = stageState.scaleY;
    const invScale = Math.max(0.1, Math.min(10, 1 / Math.min(Math.abs(scaleX), Math.abs(scaleY))));

    return (
        <Group>
            {/* 경로 순서 시각화 */}
            {endpoints.map((ep, index) => {
                if (draggingShapeIds.includes(ep.shapeId)) return null;
                const nextEp = endpoints[index + 1];
                const isNextShapeDragging = nextEp ? draggingShapeIds.includes(nextEp.shapeId) : false;

                return (
                    <React.Fragment key={ep.shapeId}>
                        <Circle x={ep.endPoint.x} y={ep.endPoint.y} radius={4 * invScale} fill="hsl(0 100% 50%)" stroke="white" strokeWidth={1.5 * invScale} opacity={0.9} shadowBlur={5} shadowColor="black" />
                        <CoatingOrderBadge order={ep.order} x={ep.startPoint.x} y={ep.startPoint.y} parentScaleX={scaleX} parentScaleY={scaleY} />
                        {nextEp && !isNextShapeDragging && (
                            <Line points={[ep.endPoint.x, ep.endPoint.y, nextEp.startPoint.x, nextEp.startPoint.y]} stroke="hsl(221.2 83.2% 53.3%)" strokeWidth={1.5 * invScale} dash={[4 * invScale, 3 * invScale]} opacity={0.8} />
                        )}
                    </React.Fragment>
                );
            })}
        </Group>
    );
};