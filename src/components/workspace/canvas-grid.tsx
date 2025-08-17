// src/components/canvas/grid-layer.tsx

import React, {JSX, useMemo} from 'react';
import {  Line, Group, Text } from 'react-konva';

interface CanvasGridProps {
    stage: { x: number; y: number; scale: number };
    gridSize: number;
    workArea: { width: number; height: number };
    visible?: boolean;
    isPanning?: boolean;
    // 성능을 위해 window 접근 대신, 캔버스 뷰포트 크기를 직접 전달받을 수 있게 옵션 제공
    viewportWidth?: number;
    viewportHeight?: number;
}

// 스냅 기반 스테이지 위치(그리드 셀 단위로 스냅) - 경계 넘어갈 때만 재계산 유도
function quantizeStageToGrid(stage: { x: number; y: number; scale: number }, gridSize: number) {
    const invScale = 1 / (stage.scale || 1);
    const gx = Math.round((-stage.x * invScale) / gridSize);
    const gy = Math.round((-stage.y * invScale) / gridSize);
    return { gx, gy, scale: stage.scale };
}

const CanvasGrid: React.FC<CanvasGridProps> = React.memo(
    ({
         stage,
         gridSize,
         workArea,
         visible = true,
         isPanning = false,
         viewportWidth,
         viewportHeight,
     }) => {

        const { lines, axes } = useMemo(() => {
            if (!visible || isPanning || gridSize <= 0 || stage.scale <= 0) {
                return { lines: [] as Array<JSX.Element>, labels: [] as Array<JSX.Element>, axes: [] as Array<JSX.Element> };
            }

            const safeViewportW =
                typeof viewportWidth === 'number' && viewportWidth > 0
                    ? viewportWidth
                    : typeof window !== 'undefined'
                        ? window.innerWidth
                        : workArea.width;

            const safeViewportH =
                typeof viewportHeight === 'number' && viewportHeight > 0
                    ? viewportHeight
                    : typeof window !== 'undefined'
                        ? window.innerHeight
                        : workArea.height;


            const majorGridSize = gridSize * 5;
            const labelGridSize = gridSize * 10; // 100mm
            const axisColor = '#8B0000';
            const majorLineColor = '#c0c0c0';
            const minorLineColor = '#e0e0e0';
            const labelColor = '#666';

            const invScale = 1 / stage.scale;
            const lineStrokeWidth = 0.5 * invScale;
            const majorLineStrokeWidth = invScale;
            const axisWidth = 1.5 * invScale;
            const fontSize = Math.max(8, 10 * invScale); // 최소 폰트 크기 보장

            const workAreaRect = {
                x: 0,
                y: 0,
                width: workArea.width,
                height: workArea.height,
            };

            // 뷰포트 컬링
            const viewportMargin = 100; // 여유 마진
            const visibleLeft = Math.max(0, -stage.x * invScale - viewportMargin);
            const visibleRight = Math.min(
                workArea.width,
                (-stage.x + safeViewportW) * invScale + viewportMargin
            );
            const visibleTop = Math.max(0, -stage.y * invScale - viewportMargin);
            const visibleBottom = Math.min(
                workArea.height,
                (-stage.y + safeViewportH) * invScale + viewportMargin
            );

            // 줌 레벨 적응
            let effectiveGridSize = gridSize;
            let showMinorGrid = true;
            let showLabels = true;

            if (stage.scale < 0.1) {
                effectiveGridSize = labelGridSize;
                showMinorGrid = false;
            } else if (stage.scale < 0.3) {
                effectiveGridSize = majorGridSize;
                showMinorGrid = false;
            } else if (stage.scale < 0.5) {
                showLabels = false;
            }

            // 컬링된 범위 내에서만 선 생성
            const verticalLinesRaw: Array<{ x: number; isMajor: boolean }> = [];
            const horizontalLinesRaw: Array<{ y: number; isMajor: boolean }> = [];

            const startX = Math.floor(visibleLeft / effectiveGridSize) * effectiveGridSize;
            const endX = Math.ceil(visibleRight / effectiveGridSize) * effectiveGridSize;
            for (let i = startX; i <= Math.min(endX, workAreaRect.width); i += effectiveGridSize) {
                if (i === 0) continue;
                const isMajor = i % majorGridSize === 0;
                if (!showMinorGrid && !isMajor) continue;
                verticalLinesRaw.push({ x: i, isMajor });
            }

            const startY = Math.floor(visibleTop / effectiveGridSize) * effectiveGridSize;
            const endY = Math.ceil(visibleBottom / effectiveGridSize) * effectiveGridSize;
            for (let i = startY; i <= Math.min(endY, workAreaRect.height); i += effectiveGridSize) {
                if (i === 0) continue;
                const isMajor = i % majorGridSize === 0;
                if (!showMinorGrid && !isMajor) continue;
                horizontalLinesRaw.push({ y: i, isMajor });
            }

            // 라벨 제한 (오버헤드 방지)
            const MAX_LABELS = 200;
            let labelCount = 0;

            // 라인 생성 (key 포함)
            const linesElements: Array<JSX.Element> = [];
            for (const { x, isMajor } of verticalLinesRaw) {
                linesElements.push(
                    <Line
                        key={`grid-v-${x}-${isMajor ? 'M' : 'm'}`}
                        points={[x, workAreaRect.y, x, workAreaRect.height]}
                        stroke={isMajor ? majorLineColor : minorLineColor}
                        strokeWidth={isMajor ? majorLineStrokeWidth : lineStrokeWidth}
                        listening={false}
                        perfectDrawEnabled={false}
                        shadowForStrokeEnabled={false}
                        hitStrokeWidth={0}
                    />
                );
                // 라벨
                if (showLabels && x % labelGridSize === 0 && labelCount < MAX_LABELS && x % (effectiveGridSize * 2) === 0) {
                    linesElements.push(
                        <Text
                            key={`grid-lbl-v-${x}`}
                            x={x + 4 * invScale}
                            y={-12 * invScale}
                            text={String(x)}
                            fontSize={fontSize}
                            fill={labelColor}
                            listening={false}
                            perfectDrawEnabled={false}
                        />
                    );
                    labelCount++;
                }
            }

            for (const { y, isMajor } of horizontalLinesRaw) {
                linesElements.push(
                    <Line
                        key={`grid-h-${y}-${isMajor ? 'M' : 'm'}`}
                        points={[workAreaRect.x, y, workAreaRect.width, y]}
                        stroke={isMajor ? majorLineColor : minorLineColor}
                        strokeWidth={isMajor ? majorLineStrokeWidth : lineStrokeWidth}
                        listening={false}
                        perfectDrawEnabled={false}
                        shadowForStrokeEnabled={false}
                        hitStrokeWidth={0}
                    />
                );
                // 라벨
                if (showLabels && y % labelGridSize === 0 && labelCount < MAX_LABELS && y % (effectiveGridSize * 2) === 0) {
                    linesElements.push(
                        <Text
                            key={`grid-lbl-h-${y}`}
                            x={-24 * invScale}
                            y={y - fontSize / 2}
                            text={String(y)}
                            fontSize={fontSize}
                            fill={labelColor}
                            listening={false}
                            perfectDrawEnabled={false}
                        />
                    );
                    labelCount++;
                }
            }

            // 축선 + 축 라벨
            const axesElements: Array<JSX.Element> = [
                <Line
                    key="grid-axis-y"
                    points={[workAreaRect.x, 0, 0, workAreaRect.height]}
                    stroke={axisColor}
                    strokeWidth={axisWidth}
                    listening={false}
                    perfectDrawEnabled={false}
                    shadowForStrokeEnabled={false}
                    hitStrokeWidth={0}
                />,
                <Line
                    key="grid-axis-x"
                    points={[workAreaRect.x, 0, workAreaRect.width, 0]}
                    stroke={axisColor}
                    strokeWidth={axisWidth}
                    listening={false}
                    perfectDrawEnabled={false}
                    shadowForStrokeEnabled={false}
                    hitStrokeWidth={0}
                />,
            ];

            if (showLabels) {
                axesElements.push(
                    <Text
                        key="grid-axis-label-x"
                        x={workAreaRect.width + 24 * invScale}
                        y={-20 * invScale}
                        text="X"
                        fontSize={fontSize}
                        fill={axisColor}
                        fontStyle="bold"
                        listening={false}
                        perfectDrawEnabled={false}
                    />,
                    <Text
                        key="grid-axis-label-y"
                        x={-20 * invScale}
                        y={workAreaRect.height + 20 * invScale}
                        text="Y"
                        fontSize={fontSize}
                        fill={axisColor}
                        fontStyle="bold"
                        listening={false}
                        perfectDrawEnabled={false}
                    />
                );
            }

            return { lines: linesElements, labels: [], axes: axesElements };
            // 스냅된 스테이지 그리드 좌표(gx, gy)와 scale에만 의존 → 미세 이동시 재계산 회피
        }, [visible, isPanning, gridSize, stage.scale, stage.x, stage.y, viewportWidth, workArea.width, workArea.height, viewportHeight]);

        if (!visible || isPanning) return null;

        return (
            <Group listening={false}>
                {lines}
                {axes}
            </Group>
        );
    }
);

CanvasGrid.displayName = 'GridLayer';

export default CanvasGrid;