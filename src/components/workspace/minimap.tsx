import React, { useMemo, useCallback} from "react";
import {Stage, Layer, Rect, Circle, Group} from 'react-konva';
import {motion} from "framer-motion";
import {CustomShapeConfig} from "@/types/custom-konva-config";
import Konva from "konva";
import {useCanvas} from "@/contexts/canvas-context";

interface MinimapProps {
    shapes: CustomShapeConfig[];
    viewport: {
        x: number;
        y: number;
        scaleX: number;
        scaleY: number;
        width: number;
        height: number;
    };
    workArea: { width: number; height: number };
    onViewportChange?: (x: number, y: number) => void;
}

export default function Minimap({
                                    shapes,
                                    viewport,
                                    workArea,
                                    onViewportChange
                                }: MinimapProps){
    const minimapWidth = 150; // 크기 증가
    const minimapHeight = 150;

    // 1. 동적 스케일 계산
    const { minimapScaleX, minimapScaleY, positiveScale } = useMemo(() => {
        const baseScaleX = minimapWidth / workArea.width;
        const baseScaleY = minimapHeight / workArea.height;
        // 여백을 줄이고 콘텐츠를 더 크게 표시하기 위해 1.1배 확대
        const baseScale = Math.min(baseScaleX, baseScaleY) * 5.0;
        return {
            minimapScaleX: baseScale * viewport.scaleX,
            minimapScaleY: baseScale * viewport.scaleY,
            positiveScale: baseScale * Math.abs(viewport.scaleX)
        };
    }, [workArea, viewport.scaleX, viewport.scaleY, minimapWidth, minimapHeight]);


    // 2. 뷰포트 중심 계산 (월드 좌표)
    const viewCenter = useMemo(() => ({
        x: (-viewport.x / viewport.scaleX) + (viewport.width / viewport.scaleX / 2),
        y: (-viewport.y / viewport.scaleY) + (viewport.height / viewport.scaleY / 2),
    }), [viewport]);

    // 3. 미니맵 그룹의 오프셋 및 위치 계산
    const groupPosition = useMemo(() => ({
        x: (minimapWidth / 2) - (viewCenter.x * minimapScaleX),
        y: (minimapHeight / 2) - (viewCenter.y * minimapScaleY),
    }), [viewCenter, minimapScaleX, minimapScaleY, minimapWidth, minimapHeight]);

    // 4. 뷰포트 사각형 정보 계산 (월드 좌표 기준)
    const viewportRect = useMemo(() => {
        const { x, y, scaleX, scaleY, width, height } = viewport;
        const rectWidth = width / Math.abs(scaleX);
        const rectHeight = height / Math.abs(scaleY);

        // scaleX가 음수일 때 (좌우 반전) x 좌표를 보정합니다.
        const rectX = scaleX > 0
            ? -x / scaleX
            : (width - x) / scaleX;

        const rectY = -y / scaleY;

        return {
            x: rectX,
            y: rectY,
            width: rectWidth,
            height: rectHeight,
        };
    }, [viewport]);

    // 5. 미니맵 클릭 핸들러
    const handleMinimapClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
        if (!onViewportChange) return;
        const stage = e.target.getStage();
        if (!stage) return;
        const pos = stage.getPointerPosition();
        if (!pos) return;

        const transform = new Konva.Transform();
        transform.translate(groupPosition.x, groupPosition.y);
        transform.scale(minimapScaleX, minimapScaleY);
        transform.invert();
        const worldPos = transform.point(pos);

        const newStageX = -worldPos.x * viewport.scaleX + viewport.width / 2;
        const newStageY = -worldPos.y * viewport.scaleY + viewport.height / 2;

        onViewportChange(newStageX, newStageY);
    }, [onViewportChange, groupPosition, minimapScaleX, minimapScaleY, viewport]);

    return (
        <motion.div
            initial={{opacity: 0, scale: 0.8}}
            animate={{opacity: 1, scale: 1}}
            className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg border shadow-lg overflow-hidden cursor-pointer"
            style={{width: minimapWidth, height: minimapHeight}}
        >
            <Stage
                width={minimapWidth}
                height={minimapHeight}
                onClick={handleMinimapClick}
                onTap={handleMinimapClick}
            >
                <Layer clipFunc={(ctx) => ctx.rect(0, 0, minimapWidth, minimapHeight)}>
                    <Rect x={0} y={0} width={minimapWidth} height={minimapHeight} fill="#f8fafc" listening={false} />
                    <Group {...groupPosition} scaleX={minimapScaleX} scaleY={minimapScaleY} listening={false}>
                        <Rect
                            x={0}
                            y={0}
                            width={workArea.width}
                            height={workArea.height}
                            fill="#ffffff"
                            stroke="#e2e8f0"
                            strokeWidth={2 / positiveScale}
                        />
                        {shapes
                            .filter(s => s.visible !== false && s.type !== 'group')
                            .map(shape => {
                                const commonProps = {
                                    key: shape.id,
                                    x: shape.x || 0,
                                    y: shape.y || 0,
                                    rotation: shape.rotation || 0,
                                    scaleX: shape.scaleX || 1,
                                    scaleY: shape.scaleY || 1,
                                };
                                const getShapeColor = (shape: CustomShapeConfig) => {
                                    if (shape.skipCoating) return '#9ca3af';
                                    switch (shape.coatingType) {
                                        case 'fill': return '#3b82f6';
                                        case 'outline': return '#f59e0b';
                                        case 'masking': return '#ef4444';
                                        default: return '#6b7280';
                                    }
                                };
                                const fill = getShapeColor(shape);

                                if (shape.type === 'rectangle' || shape.type === 'image') {
                                    return <Rect {...commonProps} width={shape.width} height={shape.height} fill={fill} opacity={0.8} />;
                                }
                                if (shape.type === 'circle') {
                                    return <Circle {...commonProps} radius={shape.radius} fill={fill} opacity={0.8} />;
                                }
                                return null;
                            })
                        }
                        <Rect
                            x={viewportRect.x}
                            y={viewportRect.y}
                            width={viewportRect.width}
                            height={viewportRect.height}
                            fill="rgba(239, 68, 68, 0.2)"
                            stroke="#ef4444"
                            strokeWidth={2 / positiveScale}
                            dash={[4 / positiveScale, 2 / positiveScale]}
                        />
                    </Group>
                </Layer>
            </Stage>
        </motion.div>
    );
};
