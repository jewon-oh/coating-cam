
import type { CustomShapeConfig } from '@/types/custom-konva-config';

export interface CoatingRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * 도형에 따른 채우기 Rect들을 생성합니다 (시작 라인 중간부터 계산)
 */
export function generateFillRects(
    shape: CustomShapeConfig,
    lineSpacing: number,
    coatingWidth: number
): CoatingRect[] {
    if (shape.coatingType !== 'fill' || !shape.fillPattern) {
        return [];
    }

    const rects: CoatingRect[] = [];

    if (shape.type === 'rectangle') {
        const { x = 0, y = 0, width = 0, height = 0 } = shape;

        if (shape.fillPattern === 'horizontal') {
            // 수평 Rect들 생성 - 첫 번째 라인의 중간부터 시작
            const firstLineY = y + coatingWidth / 2;
            let currentY = firstLineY;

            while (currentY + coatingWidth / 2 <= y + height) {
                rects.push({
                    x: x,
                    y: currentY - coatingWidth / 2,
                    width: width,
                    height: coatingWidth
                });
                currentY += lineSpacing;
            }
        } else if (shape.fillPattern === 'vertical') {
            // 수직 Rect들 생성 - 첫 번째 라인의 중간부터 시작
            const firstLineX = x + coatingWidth / 2;
            let currentX = firstLineX;

            while (currentX + coatingWidth / 2 <= x + width) {
                rects.push({
                    x: currentX - coatingWidth / 2,
                    y: y,
                    width: coatingWidth,
                    height: height
                });
                currentX += lineSpacing;
            }
        } else if (shape.fillPattern === 'auto') {
            // 더 짧은 방향으로 채우기 (효율적)
            if (width <= height) {
                // 수직으로 채우기
                const firstLineX = x + coatingWidth / 2;
                let currentX = firstLineX;

                while (currentX + coatingWidth / 2 <= x + width) {
                    rects.push({
                        x: currentX - coatingWidth / 2,
                        y: y,
                        width: coatingWidth,
                        height: height
                    });
                    currentX += lineSpacing;
                }
            } else {
                // 수평으로 채우기
                const firstLineY = y + coatingWidth / 2;
                let currentY = firstLineY;

                while (currentY + coatingWidth / 2 <= y + height) {
                    rects.push({
                        x: x,
                        y: currentY - coatingWidth / 2,
                        width: width,
                        height: coatingWidth
                    });
                    currentY += lineSpacing;
                }
            }
        }
    } else if (shape.type === 'circle') {
        const { x = 0, y = 0, radius = 0 } = shape;

        if (shape.fillPattern === 'horizontal') {
            // 원 내부를 수평 Rect으로 채우기 - 첫 번째 라인의 중간부터 시작
            const firstLineY = y - radius + coatingWidth / 2;
            let currentY = firstLineY;

            while (currentY + coatingWidth / 2 <= y + radius) {
                const distFromCenter = Math.abs(currentY - y);

                if (distFromCenter + coatingWidth / 2 <= radius) {
                    const halfChord = Math.sqrt(radius * radius - distFromCenter * distFromCenter);
                    const rectWidth = halfChord * 2;
                    if (rectWidth > 0) {
                        rects.push({
                            x: x - halfChord,
                            y: currentY - coatingWidth / 2,
                            width: rectWidth,
                            height: coatingWidth
                        });
                    }
                }
                currentY += lineSpacing;
            }
        } else if (shape.fillPattern === 'vertical') {
            // 원 내부를 수직 Rect으로 채우기 - 첫 번째 라인의 중간부터 시작
            const firstLineX = x - radius + coatingWidth / 2;
            let currentX = firstLineX;

            while (currentX + coatingWidth / 2 <= x + radius) {
                const distFromCenter = Math.abs(currentX - x);

                if (distFromCenter + coatingWidth / 2 <= radius) {
                    const halfChord = Math.sqrt(radius * radius - distFromCenter * distFromCenter);
                    const rectHeight = halfChord * 2;
                    if (rectHeight > 0) {
                        rects.push({
                            x: currentX - coatingWidth / 2,
                            y: y - halfChord,
                            width: coatingWidth,
                            height: rectHeight
                        });
                    }
                }
                currentX += lineSpacing;
            }
        } else if (shape.fillPattern === 'auto') {
            // 기본은 수평으로 채우기
            const firstLineY = y - radius + coatingWidth / 2;
            let currentY = firstLineY;

            while (currentY + coatingWidth / 2 <= y + radius) {
                const distFromCenter = Math.abs(currentY - y);

                if (distFromCenter + coatingWidth / 2 <= radius) {
                    const halfChord = Math.sqrt(radius * radius - distFromCenter * distFromCenter);
                    const rectWidth = halfChord * 2;
                    if (rectWidth > 0) {
                        rects.push({
                            x: x - halfChord,
                            y: currentY - coatingWidth / 2,
                            width: rectWidth,
                            height: coatingWidth
                        });
                    }
                }
                currentY += lineSpacing;
            }
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