import React, { useMemo, useCallback} from "react";
import {Stage, Layer, Rect, Circle, Group} from 'react-konva';
import {motion} from "framer-motion";
import {AnyNodeConfig} from "@/types/custom-konva-config";
import Konva from "konva";

interface MinimapProps {
    shapes: AnyNodeConfig[];
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
    const minimapWidth = 150;
    const minimapHeight = 150;
    const padding = 10;

    // 미니맵 내부 작업 영역 크기
    const mapWidth = minimapWidth - padding * 2;
    const mapHeight = minimapHeight - padding * 2;

    // 작업 영역을 미니맵 크기에 맞게 스케일 계산
    const scaleX = mapWidth / workArea.width;
    const scaleY = mapHeight / workArea.height;
    const uniformScale = Math.min(scaleX, scaleY);

    // ✅ 캔버스의 반전 상태 감지
    const isFlippedX = viewport.scaleX < 0;
    const isFlippedY = viewport.scaleY < 0;

    // 뷰포트 계산
    const viewportInfo = useMemo(() => {
        const absScaleX = Math.abs(viewport.scaleX);
        const absScaleY = Math.abs(viewport.scaleY);

        // 뷰포트의 실제 크기 (월드 좌표계에서)
        const viewWidthOnCanvas = viewport.width / absScaleX;
        const viewHeightOnCanvas = viewport.height / absScaleY;

        // 뷰포트의 좌상단 좌표
        const viewX = -viewport.x / viewport.scaleX;
        const viewY = -viewport.y / viewport.scaleY;

        // ✅ 반전 고려한 뷰포트 위치 계산
        const normalizedViewX = isFlippedX ? workArea.width - viewX - viewWidthOnCanvas : viewX;
        const normalizedViewY = isFlippedY ? workArea.height - viewY - viewHeightOnCanvas : viewY;

        // 미니맵에서의 뷰포트 크기와 위치
        const minimapViewWidth = viewWidthOnCanvas * uniformScale;
        const minimapViewHeight = viewHeightOnCanvas * uniformScale;
        const minimapViewX = padding + (normalizedViewX * uniformScale);
        const minimapViewY = padding + (normalizedViewY * uniformScale);

        return {
            x: minimapViewX,
            y: minimapViewY,
            width: minimapViewWidth,
            height: minimapViewHeight,
        };
    }, [viewport, workArea, uniformScale, padding, isFlippedX, isFlippedY]);


    // ✅ 미니맵 클릭으로 뷰포트 이동 - 단순화된 버전
    const handleMinimapClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
        if (!onViewportChange) return;

        const stage = e.target.getStage();
        if (!stage) return;

        const pos = stage.getPointerPosition();
        if (!pos) return;

        // ✅ Stage 반전을 고려한 실제 클릭 좌표 계산
        let actualClickX = pos.x;
        let actualClickY = pos.y;

        // Stage가 반전되어 있다면 좌표 보정
        if (isFlippedX) {
            actualClickX = minimapWidth - pos.x;
        }
        if (isFlippedY) {
            actualClickY = minimapHeight - pos.y;
        }

        // 미니맵 좌표를 월드 좌표로 변환 (padding 고려)
        const worldX = (actualClickX - padding) / uniformScale;
        const worldY = (actualClickY - padding) / uniformScale;

        // 작업 영역 범위 내로 제한
        const clampedWorldX = Math.max(0, Math.min(workArea.width, worldX));
        const clampedWorldY = Math.max(0, Math.min(workArea.height, worldY));

        // 뷰포트 중앙이 클릭 지점이 되도록 계산
        const viewportCenterX = viewport.width / 2 / Math.abs(viewport.scaleX);
        const viewportCenterY = viewport.height / 2 / Math.abs(viewport.scaleY);

        // 타겟 월드 좌표 (뷰포트 중앙을 클릭 지점으로)
        const targetWorldX = clampedWorldX + viewportCenterX;
        const targetWorldY = clampedWorldY - viewportCenterY;

        // Stage 좌표로 변환하여 전달
        const stageX = -targetWorldX * viewport.scaleX;
        const stageY = -targetWorldY * viewport.scaleY;

        onViewportChange(stageX, stageY);
    }, [onViewportChange, uniformScale, padding, viewport, workArea, isFlippedX, isFlippedY, minimapWidth, minimapHeight]);

    return (
        <motion.div
            initial={{opacity: 0, scale: 0.8}}
            animate={{opacity: 1, scale: 1}}
            className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg border shadow-lg overflow-hidden cursor-pointer"
            style={{width: minimapWidth, height: minimapHeight}}
        >
            {/* ✅ 미니맵 전체에 반전 적용 */}
            <Stage
                width={minimapWidth}
                height={minimapHeight}
                scaleX={isFlippedX ? -1 : 1}
                scaleY={isFlippedY ? -1 : 1}
                x={isFlippedX ? minimapWidth : 0}
                y={isFlippedY ? minimapHeight : 0}
                onClick={handleMinimapClick}
                onTap={handleMinimapClick}
            >
                <Layer>
                    {/* 미니맵 배경 */}
                    <Rect
                        x={0}
                        y={0}
                        width={minimapWidth}
                        height={minimapHeight}
                        fill="#f8fafc"
                        listening={false}
                    />

                    {/* 작업 영역 배경 */}
                    <Rect
                        x={padding}
                        y={padding}
                        width={workArea.width * uniformScale}
                        height={workArea.height * uniformScale}
                        fill="#ffffff"
                        stroke="#e2e8f0"
                        strokeWidth={1}
                        listening={false}
                    />

                    {/* ✅ 도형들 렌더링 (반전 적용 안 함 - Stage에서 전체 반전 처리) */}
                    <Group listening={false}>
                        {shapes
                            .filter(s => s.visible !== false && s.type !== 'group')
                            .map(shape => {
                                const actualX = (shape.x || 0);
                                const actualY = (shape.y || 0);
                                const actualWidth = (shape.width || 0);
                                const actualHeight = (shape.height || 0);
                                const actualRadius = (shape.radius || 0);

                                // Stage 반전으로 인해 원본 좌표 그대로 사용
                                const minimapX = padding + actualX * uniformScale;
                                const minimapY = padding + actualY * uniformScale;
                                const minimapWidth = actualWidth * uniformScale;
                                const minimapHeight = actualHeight * uniformScale;
                                const minimapRadius = actualRadius * uniformScale;

                                const commonProps = {
                                    key: shape.id,
                                    x: minimapX,
                                    y: minimapY,
                                    listening: false,
                                    perfectDrawEnabled: false,
                                };

                                const getShapeColor = (shape: AnyNodeConfig) => {
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
                                    return (
                                        <Rect
                                            {...commonProps}
                                            width={minimapWidth}
                                            height={minimapHeight}
                                            fill={fill}
                                            stroke={fill}
                                            strokeWidth={0.5}
                                            opacity={shape.type === 'image' ? 0.6 : 0.8}
                                        />
                                    );
                                }

                                if (shape.type === 'circle') {
                                    return (
                                        <Circle
                                            {...commonProps}
                                            radius={minimapRadius}
                                            fill={fill}
                                            stroke={fill}
                                            strokeWidth={0.5}
                                            opacity={0.8}
                                        />
                                    );
                                }

                                return null;
                            })
                        }
                    </Group>

                    {/* 뷰포트 표시 */}
                    <Rect
                        scaleX={isFlippedX ? -1 : 1}
                        scaleY={isFlippedY ? -1 : 1}
                        x={isFlippedX ? -viewportInfo.x : viewportInfo.x}
                        y={isFlippedY ? -viewportInfo.y : viewportInfo.y}
                        width={Math.max(1, viewportInfo.width)}
                        height={Math.max(1, viewportInfo.height)}
                        fill="rgba(239, 68, 68, 0.1)"
                        stroke="#ef4444"
                        strokeWidth={2}
                        dash={[4, 2]}
                        listening={false}
                    />
                </Layer>
            </Stage>
        </motion.div>
    );
};