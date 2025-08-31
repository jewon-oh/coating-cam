
import type { CustomShapeConfig } from '@/types/custom-konva-config';
import { PathCalculator } from '@/lib/gcode/path-calculator';
import { MaskingManager } from '@/lib/gcode/mask-manager';
import { CoatingSettings } from '@/types/coating';

export interface CoatingRect {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
}

/**
 * PathCalculator를 사용하여 채우기 영역(Rect)을 생성합니다.
 * 이를 통해 시각화와 실제 G-code 생성이 동일한 로직을 공유하게 됩니다.
 */
export async function generateFillRects(
    shape: CustomShapeConfig,
    allShapes: CustomShapeConfig[], // 마스킹 계산을 위해 모든 도형 정보가 필요합니다.
    settings: CoatingSettings
): Promise<CoatingRect[]> {
    if (shape.coatingType !== 'fill' || !shape.fillPattern) {
        return [];
    }

    // 1. PathCalculator의 의존성 설정 (마스킹 포함)
    const activeShapes = allShapes.filter(s => s.skipCoating !== true);
    const maskShapes = settings.enableMasking
        ? activeShapes.filter(s => s.coatingType === 'masking')
        : [];

    const masker = new MaskingManager(settings, maskShapes);
    const calculator = new PathCalculator(settings, masker);

    // 2. PathCalculator를 통해 채우기 경로(세그먼트) 계산
    // calculateForShapeAbsolute는 회전과 마스킹이 모두 적용된 절대 좌표 세그먼트를 반환합니다.
    const segments = await calculator.calculateForShapeAbsolute(shape);

    // 3. 계산된 세그먼트를 시각화용 Rect로 변환
    const coatingWidth = shape.coatingWidth ?? settings.coatingWidth;
    const halfWidth = coatingWidth / 2;
    const rects: CoatingRect[] = [];

    for (const segment of segments) {
        const { start, end } = segment;

        // 세그먼트의 방향 (수평/수직)을 확인합니다.
        // PathCalculator는 현재 수평/수직 라인만 생성하므로 간단한 비교로 충분합니다.
        const isHorizontal = Math.abs(start.y - end.y) < 0.001;

        if (isHorizontal) {
            rects.push({
                x: Math.min(start.x, end.x),
                y: start.y - halfWidth,
                width: Math.abs(end.x - start.x),
                height: coatingWidth,
            });
        } else {
            rects.push({
                x: start.x - halfWidth,
                y: Math.min(start.y, end.y),
                width: coatingWidth,
                height: Math.abs(end.y - start.y),
            });
        }
    }

    return rects;
}


/**
 * 코팅 설정 기반 스냅 유틸리티 (채우기 방향에 따라 선택적 적용)
 */
export function createCoatingSnap(
    lineSpacing: number,
    coatingWidth: number,
    isSnappingEnabled: boolean = true
) {
    return {
        snapToLineSpacing: (value: number): number => {
            if (!isSnappingEnabled) return value;
            return Math.round(value / lineSpacing) * lineSpacing;
        },

        snapToCoatingWidth: (value: number): number => {
            if (!isSnappingEnabled) return value;
            return Math.round(value / coatingWidth) * coatingWidth;
        },

        // 채우기 패턴에 따른 선택적 스냅
        snapShapeForFill: (
            point: { x: number; y: number },
            size: { width: number; height: number },
            fillPattern: 'horizontal' | 'vertical' | 'auto'
        ) => {
            if (!isSnappingEnabled) return { point, size };

            let snappedPoint = { ...point };
            let snappedSize = { ...size };

            if (fillPattern === 'horizontal') {
                // 수평 채우기: Y 방향만 스냅
                snappedPoint.y = Math.round(point.y / lineSpacing) * lineSpacing;
                snappedSize.height = Math.max(coatingWidth, Math.round(size.height / lineSpacing) * lineSpacing);
            } else if (fillPattern === 'vertical') {
                // 수직 채우기: X 방향만 스냅
                snappedPoint.x = Math.round(point.x / lineSpacing) * lineSpacing;
                snappedSize.width = Math.max(coatingWidth, Math.round(size.width / lineSpacing) * lineSpacing);
            } else if (fillPattern === 'auto') {
                // 자동: 더 짧은 방향으로 스냅
                if (size.width <= size.height) {
                    // 수직으로 채울 예정이므로 X 방향만 스냅
                    snappedPoint.x = Math.round(point.x / lineSpacing) * lineSpacing;
                    snappedSize.width = Math.max(coatingWidth, Math.round(size.width / lineSpacing) * lineSpacing);
                } else {
                    // 수평으로 채울 예정이므로 Y 방향만 스냅
                    snappedPoint.y = Math.round(point.y / lineSpacing) * lineSpacing;
                    snappedSize.height = Math.max(coatingWidth, Math.round(size.height / lineSpacing) * lineSpacing);
                }
            }

            return { point: snappedPoint, size: snappedSize };
        },

        // 기존 호환성을 위한 메서드들 유지
        snapPoint: (point: { x: number; y: number }): { x: number; y: number } => {
            if (!isSnappingEnabled) return point;
            return {
                x: Math.round(point.x / lineSpacing) * lineSpacing,
                y: Math.round(point.y / lineSpacing) * lineSpacing
            };
        },

        snapSize: (size: { width: number; height: number }): { width: number; height: number } => {
            if (!isSnappingEnabled) return size;
            return {
                width: Math.round(size.width / lineSpacing) * lineSpacing,
                height: Math.round(size.height / lineSpacing) * lineSpacing
            };
        }
    };
}
