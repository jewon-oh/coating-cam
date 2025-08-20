import React, {useMemo} from 'react';
import {Line, Group, Text} from 'react-konva';

interface CanvasGridProps {
    gridSize: number;
    workArea: { width: number; height: number };
    visible?: boolean;
    isPanning?: boolean;
    stageScaleX: number;
    stageScaleY: number;
    stageX: number;
    stageY: number;
    viewportWidth?: number;
    viewportHeight?: number;

}

/**
 * Canvas Grid 컴포넌트
 * X축이 반전된 상황(-scaleX)에서도 올바르게 표시되는 그리드를 렌더링합니다.
 */
const CanvasGrid: React.FC<CanvasGridProps> = React.memo(({
                                                              gridSize,
                                                              workArea,
                                                              visible = true,
                                                              isPanning = false,
                                                              stageScaleX,
                                                              stageScaleY,
                                                              stageX,
                                                              stageY,
                                                              viewportWidth = 800,
                                                              viewportHeight = 600,

                                                          }) => {
    const gridElements = useMemo(() => {
            // 조기 반환 조건
            const absScaleX = Math.abs(stageScaleX);
            const absScaleY = Math.abs(stageScaleY);
            if (!visible || isPanning || gridSize <= 0 || absScaleX <= 0 || absScaleY <= 0) {
                return null;
            }

            // 스케일/반전 정보
            const invScaleX = 1 / absScaleX;
            const invScaleY = 1 / absScaleY;
            const invScale = 1 / Math.max(absScaleX, absScaleY); // 선/폰트 두께 기준
            const flipX = stageScaleX < 0;
            const flipY = stageScaleY < 0;

            // 줌 레벨에 따른 그리드 간격
            const majorStep = gridSize * 5;
            const labelStep = gridSize * 10;

            let effectiveStep = gridSize;
            let showMinor = true;
            let showLabels = true;

            const zoom = Math.max(absScaleX, absScaleY);
            if (zoom < 0.1) {
                effectiveStep = labelStep;
                showMinor = false;
            } else if (zoom < 0.3) {
                effectiveStep = majorStep;
                showMinor = false;
            } else if (zoom < 0.5) {
                showLabels = false;
            }

            // 스타일
            const styles = {
                axis: { color: '#8B0000', width: 1.5 * invScale },
                major: { color: '#c0c0c0', width: invScale },
                minor: { color: '#e0e0e0', width: 0.5 * invScale },
                label: { color: '#666', size: Math.max(8, 10 * invScale) },
            };

            // 뷰포트 컬링: 스케일 부호를 고려해 범위 계산
            const margin = 100;
            const vx1 = (0 - stageX) / stageScaleX;
            const vx2 = (viewportWidth - stageX) / stageScaleX;
            const vy1 = (0 - stageY) / stageScaleY;
            const vy2 = (viewportHeight - stageY) / stageScaleY;

            const bounds = {
                left: Math.max(0, Math.min(vx1, vx2) - margin),
                right: Math.min(workArea.width, Math.max(vx1, vx2) + margin),
                top: Math.max(0, Math.min(vy1, vy2) - margin),
                bottom: Math.min(workArea.height, Math.max(vy1, vy2) + margin),
            };

            const lineElements: React.ReactElement[] = [];
            const labelElements: React.ReactElement[] = [];

            // 좌표축 (라인)
            lineElements.push(
                <Line
                    key="axis-x"
                    points={[0, 0, workArea.width, 0]}
                    stroke={styles.axis.color}
                    strokeWidth={styles.axis.width}
                    listening={false}
                    perfectDrawEnabled={false}
                />,
                <Line
                    key="axis-y"
                    points={[0, 0, 0, workArea.height]}
                    stroke={styles.axis.color}
                    strokeWidth={styles.axis.width}
                    listening={false}
                    perfectDrawEnabled={false}
                />
            );

            // 세로선 + X 라벨
            const startX = Math.floor(bounds.left / effectiveStep) * effectiveStep;
            const endX = Math.ceil(bounds.right / effectiveStep) * effectiveStep;

            for (let x = startX; x <= Math.min(endX, workArea.width); x += effectiveStep) {
                if (x === 0) continue;
                const isMajor = x % majorStep === 0;
                if (!showMinor && !isMajor) continue;

                const style = isMajor ? styles.major : styles.minor;
                lineElements.push(
                    <Line
                        key={`vertical-${x}`}
                        points={[x, 0, x, workArea.height]}
                        stroke={style.color}
                        strokeWidth={style.width}
                        listening={false}
                        perfectDrawEnabled={false}
                    />
                );

                if (showLabels && x % labelStep === 0) {
                    labelElements.push(
                        <Text
                            key={`xlabel-${x}`}
                            // x 좌표와 정렬을 flipX 값에 따라 동적으로 변경
                            x={flipX ? x + styles.label.size * invScaleX : x - styles.label.size * invScaleX}
                            y={-12 * invScaleY}
                            text={x.toString()}
                            fontSize={styles.label.size}
                            fill={styles.label.color}
                            align={flipX ? 'right' : 'left'} // 정렬 기준 변경
                            listening={false}
                            perfectDrawEnabled={false}
                            scaleX={flipX ? -1 : 1}
                            scaleY={flipY ? -1 : 1}
                        />
                    );
                }
            }

            // 가로선 + Y 라벨
            const startY = Math.floor(bounds.top / effectiveStep) * effectiveStep;
            const endY = Math.ceil(bounds.bottom / effectiveStep) * effectiveStep;

            for (let y = startY; y <= Math.min(endY, workArea.height); y += effectiveStep) {
                if (y === 0) continue;
                const isMajor = y % majorStep === 0;
                if (!showMinor && !isMajor) continue;

                const style = isMajor ? styles.major : styles.minor;
                lineElements.push(
                    <Line
                        key={`horizontal-${y}`}
                        points={[0, y, workArea.width, y]}
                        stroke={style.color}
                        strokeWidth={style.width}
                        listening={false}
                        perfectDrawEnabled={false}
                    />
                );

                if (showLabels && y % labelStep === 0) {
                    labelElements.push(
                        <Text
                            key={`ylabel-${y}`}
                            x={flipX ? -12 * invScaleX : 12 * invScaleX}
                            y={y - styles.label.size / 2}
                            text={y.toString()}
                            fontSize={styles.label.size}
                            fill={styles.label.color}
                            align={flipX ? 'left' : 'right'}
                            listening={false}
                            perfectDrawEnabled={false}
                            // ✅ 추가: 텍스트의 뒤집힘을 상쇄합니다.
                            scaleX={flipX ? -1 : 1}
                            scaleY={flipY ? -1 : 1}
                        />
                    );
                }
            }

            // 축 라벨
            if (showLabels) {
                labelElements.push(
                    <Text
                        key="axis-label-x"
                        // x 좌표와 정렬을 flipX 값에 따라 동적으로 변경
                        x={flipX ? -24 * invScaleX : workArea.width + 24 * invScaleX}
                        y={-20 * invScaleY}
                        text="X"
                        fontSize={styles.label.size}
                        fill={styles.axis.color}
                        fontStyle="bold"
                        align={flipX ? 'left' : 'right'} // 정렬 기준 변경
                        listening={false}
                        perfectDrawEnabled={false}

                    />,
                    <Text
                        key="axis-label-y"
                        x={-20 * invScaleX}
                        y={flipY ? -24 * invScaleY : workArea.height + 20 * invScaleY}
                        text="Y"
                        fontSize={styles.label.size}
                        fill={styles.axis.color}
                        fontStyle="bold"
                        listening={false}
                        perfectDrawEnabled={false}
                    />
                );
            }

            // 라벨만 반전 상쇄
            return (
                <>
                    <Group listening={false}>
                        {lineElements}
                        {labelElements}
                    </Group>
                </>
            );
        }
        , [
            visible,
            isPanning,
            gridSize,
            stageScaleX,
            stageScaleY,
            stageX,
            stageY,
            viewportWidth,
            viewportHeight,
            workArea.width,
            workArea.height
    ]);

    // 그리드가 비활성화되거나 패닝 중인 경우 렌더링하지 않음
    if (!gridElements) return null;

    return (
        <Group
            listening={false}
        >
            {gridElements}
        </Group>
    );
});

CanvasGrid.displayName = 'CanvasGrid';

export default CanvasGrid;