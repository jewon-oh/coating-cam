import React, { useMemo } from 'react';
import { Line, Group, Text } from 'react-konva';

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

// 상수 분리
const GRID_CONSTANTS = {
    MAJOR_MULTIPLIER: 5,
    LABEL_MULTIPLIER: 10,
    MARGIN: 100,
    MIN_ZOOM_FOR_LABELS: 0.1,
    MIN_ZOOM_FOR_MINOR: 0.3,
    MIN_ZOOM_FOR_MAJOR_LABELS: 0.5,
    BASE_FONT_SIZE: 10,
    MIN_FONT_SIZE: 8,
    AXIS_OFFSET: 12,
    LABEL_OFFSET: 20,
    AXIS_LABEL_OFFSET: 24,
} as const;

const GRID_STYLES = {
    AXIS: { color: '#8B0000', baseWidth: 1.5 },
    MAJOR: { color: '#c0c0c0', baseWidth: 1 },
    MINOR: { color: '#e0e0e0', baseWidth: 0.5 },
    LABEL: { color: '#666' },
} as const;

// 타입 정의
interface GridBounds {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

interface ScaleInfo {
    absScaleX: number;
    absScaleY: number;
    invScaleX: number;
    invScaleY: number;
    invScale: number;
    flipX: boolean;
    flipY: boolean;
}

interface GridSettings {
    effectiveStep: number;
    showMinor: boolean;
    showLabels: boolean;
    majorStep: number;
    labelStep: number;
}

interface GridStyles {
    axis: { color: string; width: number };
    major: { color: string; width: number };
    minor: { color: string; width: number };
    label: { color: string; size: number };
}

/**
 * 스케일 정보 계산
 */
const calculateScaleInfo = (stageScaleX: number, stageScaleY: number): ScaleInfo => {
    const absScaleX = Math.abs(stageScaleX);
    const absScaleY = Math.abs(stageScaleY);
    const invScaleX = 1 / absScaleX;
    const invScaleY = 1 / absScaleY;
    const invScale = 1 / Math.max(absScaleX, absScaleY);

    return {
        absScaleX,
        absScaleY,
        invScaleX,
        invScaleY,
        invScale,
        flipX: stageScaleX < 0,
        flipY: stageScaleY < 0,
    };
};

/**
 * 그리드 설정 계산
 */
const calculateGridSettings = (gridSize: number, zoom: number): GridSettings => {
    const majorStep = gridSize * GRID_CONSTANTS.MAJOR_MULTIPLIER;
    const labelStep = gridSize * GRID_CONSTANTS.LABEL_MULTIPLIER;

    let effectiveStep = gridSize;
    let showMinor = true;
    let showLabels = true;

    // 줌 임계값 조정 (낮은 배율에서도 잘 보이도록)
    if (zoom < 0.05) {
        effectiveStep = labelStep;
        showMinor = false;
    } else if (zoom < 0.15) {
        effectiveStep = majorStep;
        showMinor = false;
    } else if (zoom < 0.25) {
        showLabels = false;
    }

    return {
        effectiveStep,
        showMinor,
        showLabels,
        majorStep,
        labelStep,
    };
};
/**
 * 그리드 스타일 계산
 */
const calculateGridStyles = (invScale: number): GridStyles => ({
    axis: {
        color: GRID_STYLES.AXIS.color,
        width: GRID_STYLES.AXIS.baseWidth * invScale
    },
    major: {
        color: GRID_STYLES.MAJOR.color,
        width: GRID_STYLES.MAJOR.baseWidth * invScale
    },
    minor: {
        color: GRID_STYLES.MINOR.color,
        width: GRID_STYLES.MINOR.baseWidth * invScale
    },
    label: {
        color: GRID_STYLES.LABEL.color,
        size: Math.max(GRID_CONSTANTS.MIN_FONT_SIZE, GRID_CONSTANTS.BASE_FONT_SIZE * invScale)
    },
});

/**
 * 뷰포트 경계 계산
 */
const calculateViewportBounds = (
    stageX: number,
    stageY: number,
    stageScaleX: number,
    stageScaleY: number,
    viewportWidth: number,
    viewportHeight: number,
    workArea: { width: number; height: number }
): GridBounds => {
    const vx1 = (0 - stageX) / stageScaleX;
    const vx2 = (viewportWidth - stageX) / stageScaleX;
    const vy1 = (0 - stageY) / stageScaleY;
    const vy2 = (viewportHeight - stageY) / stageScaleY;

    return {
        left: Math.max(0, Math.min(vx1, vx2) - GRID_CONSTANTS.MARGIN),
        right: Math.min(workArea.width, Math.max(vx1, vx2) + GRID_CONSTANTS.MARGIN),
        top: Math.max(0, Math.min(vy1, vy2) - GRID_CONSTANTS.MARGIN),
        bottom: Math.min(workArea.height, Math.max(vy1, vy2) + GRID_CONSTANTS.MARGIN),
    };
};

/**
 * 축 라인 생성
 */
const createAxisLines = (workArea: { width: number; height: number }, styles: GridStyles): React.ReactElement[] => [
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
];

/**
 * 세로선과 X축 라벨 생성
 */
const createVerticalLinesAndLabels = (
    bounds: GridBounds,
    workArea: { width: number; height: number },
    settings: GridSettings,
    styles: GridStyles,
    scaleInfo: ScaleInfo
): { lines: React.ReactElement[]; labels: React.ReactElement[] } => {
    const lines: React.ReactElement[] = [];
    const labels: React.ReactElement[] = [];

    const startX = Math.floor(bounds.left / settings.effectiveStep) * settings.effectiveStep;
    const endX = Math.ceil(bounds.right / settings.effectiveStep) * settings.effectiveStep;

    for (let x = startX; x <= Math.min(endX, workArea.width); x += settings.effectiveStep) {
        if (x === 0) continue;

        const isMajor = x % settings.majorStep === 0;
        if (!settings.showMinor && !isMajor) continue;

        const style = isMajor ? styles.major : styles.minor;
        lines.push(
            <Line
                key={`vertical-${x}`}
                points={[x, 0, x, workArea.height]}
                stroke={style.color}
                strokeWidth={style.width}
                listening={false}
                perfectDrawEnabled={false}
            />
        );

        if (settings.showLabels && x % settings.labelStep === 0) {
            // X축 라벨 위치 계산 개선
            const baseOffset = 15; // 기본 오프셋 (픽셀)
            const scaleAdjustedOffset = baseOffset / scaleInfo.absScaleY;

            // 텍스트 크기에 따른 위치 조정
            const textWidth = x.toString().length * styles.label.size * 0.6; // 대략적인 텍스트 너비
            const horizontalOffset = textWidth * 0.5 / scaleInfo.absScaleX;

            let labelX = x;
            let align: 'left' | 'right' | 'center' = 'center';

            // flipX 상태에 관계없이 중앙 정렬 사용
            if (scaleInfo.flipX) {
                // X축이 뒤집힌 경우에도 중앙 정렬 유지
                align = 'center';
            } else {
                align = 'center';
            }

            labels.push(
                <Text
                    key={`xlabel-${x}`}
                    x={labelX}
                    y={-scaleAdjustedOffset}
                    text={x.toString()}
                    fontSize={styles.label.size}
                    fill={styles.label.color}
                    align={align}
                    verticalAlign="bottom"
                    listening={false}
                    perfectDrawEnabled={false}
                    // 텍스트가 항상 올바른 방향으로 표시되도록 함
                    scaleX={scaleInfo.flipX ? -1 : 1}
                    scaleY={1} // Y축은 뒤집지 않음
                    // 중앙 정렬을 위한 오프셋
                    offsetX={0}
                    offsetY={0}
                />
            );
        }
    }

    return { lines, labels };
};

/**
 * 가로선과 Y축 라벨 생성
 */
const createHorizontalLinesAndLabels = (
    bounds: GridBounds,
    workArea: { width: number; height: number },
    settings: GridSettings,
    styles: GridStyles,
    scaleInfo: ScaleInfo
): { lines: React.ReactElement[]; labels: React.ReactElement[] } => {
    const lines: React.ReactElement[] = [];
    const labels: React.ReactElement[] = [];

    const startY = Math.floor(bounds.top / settings.effectiveStep) * settings.effectiveStep;
    const endY = Math.ceil(bounds.bottom / settings.effectiveStep) * settings.effectiveStep;

    for (let y = startY; y <= Math.min(endY, workArea.height); y += settings.effectiveStep) {
        if (y === 0) continue;

        const isMajor = y % settings.majorStep === 0;
        if (!settings.showMinor && !isMajor) continue;

        const style = isMajor ? styles.major : styles.minor;
        lines.push(
            <Line
                key={`horizontal-${y}`}
                points={[0, y, workArea.width, y]}
                stroke={style.color}
                strokeWidth={style.width}
                listening={false}
                perfectDrawEnabled={false}
            />
        );

        if (settings.showLabels && y % settings.labelStep === 0) {
            // Y축 라벨 위치 계산 수정
            const labelOffset = GRID_CONSTANTS.AXIS_OFFSET / Math.abs(scaleInfo.absScaleX);

            let labelX: number;
            let align: 'left' | 'right' = 'right';

            if (scaleInfo.flipX) {
                labelX = -labelOffset;
                align = 'left';
            } else {
                labelX = labelOffset;
                align = 'right';
            }

            labels.push(
                <Text
                    key={`ylabel-${y}`}
                    x={labelX}
                    y={y}
                    text={y.toString()}
                    fontSize={styles.label.size}
                    fill={styles.label.color}
                    align={align}
                    verticalAlign="middle"
                    listening={false}
                    perfectDrawEnabled={false}
                    // 텍스트 뒤집힘 방지
                    scaleX={scaleInfo.flipX ? -1 : 1}
                    scaleY={scaleInfo.flipY ? -1 : 1}
                    // 회전 중심점 설정
                    offsetY={styles.label.size / 2}
                />
            );
        }
    }

    return { lines, labels };
};

/**
 * 축 라벨 생성
 */
const createAxisLabels = (
    workArea: { width: number; height: number },
    styles: GridStyles,
    scaleInfo: ScaleInfo
): React.ReactElement[] => {
    const xLabelOffset = GRID_CONSTANTS.AXIS_LABEL_OFFSET / Math.abs(scaleInfo.absScaleX);
    const yLabelOffset = GRID_CONSTANTS.LABEL_OFFSET / Math.abs(scaleInfo.absScaleY);

    return [
        <Text
            key="axis-label-x"
            x={scaleInfo.flipX ? -xLabelOffset : workArea.width + xLabelOffset}
            y={-yLabelOffset}
            text="X"
            fontSize={styles.label.size}
            fill={styles.axis.color}
            fontStyle="bold"
            align={scaleInfo.flipX ? 'left' : 'right'}
            verticalAlign="bottom"
            listening={false}
            perfectDrawEnabled={false}
            // 축 라벨은 뒤집지 않음
            scaleX={scaleInfo.flipX ? -1 : 1}
            scaleY={scaleInfo.flipY ? -1 : 1}
        />,
        <Text
            key="axis-label-y"
            x={scaleInfo.flipX ? xLabelOffset : -xLabelOffset}
            y={scaleInfo.flipY ? -GRID_CONSTANTS.AXIS_LABEL_OFFSET / Math.abs(scaleInfo.absScaleY) : workArea.height + yLabelOffset}
            text="Y"
            fontSize={styles.label.size}
            fill={styles.axis.color}
            fontStyle="bold"
            align={scaleInfo.flipX ? 'right' : 'left'}
            verticalAlign="middle"
            listening={false}
            perfectDrawEnabled={false}
            // 축 라벨은 뒤집지 않음
            scaleX={scaleInfo.flipX ? -1 : 1}
            scaleY={scaleInfo.flipY ? -1 : 1}
            offsetY={styles.label.size / 2}
        />
    ];
};
/**
 * WorkspaceCanvas Grid 컴포넌트
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
    // 조기 반환 조건들을 useMemo 외부에서 체크
    const shouldRender = useMemo(() => {
        const absScaleX = Math.abs(stageScaleX);
        const absScaleY = Math.abs(stageScaleY);
        return visible && !isPanning && gridSize > 0 && absScaleX > 0 && absScaleY > 0;
    }, [visible, isPanning, gridSize, stageScaleX, stageScaleY]);

    // 스케일 정보 계산 (메모화)
    const scaleInfo = useMemo(() =>
            calculateScaleInfo(stageScaleX, stageScaleY),
        [stageScaleX, stageScaleY]
    );

    // 그리드 설정 계산 (메모화)
    const gridSettings = useMemo(() =>
            calculateGridSettings(gridSize, Math.max(scaleInfo.absScaleX, scaleInfo.absScaleY)),
        [gridSize, scaleInfo.absScaleX, scaleInfo.absScaleY]
    );

    // 스타일 계산 (메모화)
    const gridStyles = useMemo(() =>
            calculateGridStyles(scaleInfo.invScale),
        [scaleInfo.invScale]
    );

    // 뷰포트 경계 계산 (메모화)
    const viewportBounds = useMemo(() =>
            calculateViewportBounds(stageX, stageY, stageScaleX, stageScaleY, viewportWidth, viewportHeight, workArea),
        [stageX, stageY, stageScaleX, stageScaleY, viewportWidth, viewportHeight, workArea]
    );

    // 그리드 요소들 생성 (메모화)
    const gridElements = useMemo(() => {
        if (!shouldRender) return null;

        const axisLines = createAxisLines(workArea, gridStyles);
        const { lines: verticalLines, labels: xLabels } = createVerticalLinesAndLabels(
            viewportBounds, workArea, gridSettings, gridStyles, scaleInfo
        );
        const { lines: horizontalLines, labels: yLabels } = createHorizontalLinesAndLabels(
            viewportBounds, workArea, gridSettings, gridStyles, scaleInfo
        );

        const allLines = [...axisLines, ...verticalLines, ...horizontalLines];
        const allLabels = [...xLabels, ...yLabels];

        if (gridSettings.showLabels) {
            allLabels.push(...createAxisLabels(workArea, gridStyles, scaleInfo));
        }

        return { lines: allLines, labels: allLabels };
    }, [shouldRender, workArea, gridStyles, viewportBounds, gridSettings, scaleInfo]);

    // 렌더링하지 않는 경우
    if (!gridElements) return null;

    return (
        <Group listening={false}>
            {gridElements.lines}
            {gridElements.labels}
        </Group>
    );
});

CanvasGrid.displayName = 'CanvasGrid';

export default CanvasGrid;