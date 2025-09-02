import { CustomShapeConfig } from '@/types/custom-konva-config';
import {CoatingSettings} from "@/types/coating";
import { Point } from '@/lib/gcode/point';
import {PathSegment} from "@/types/path";

/**
 * 마스킹 계산 및 경로 분할만 담당하는 클래스
 */
export class MaskingManager {
    private readonly settings: CoatingSettings;
    private maskShapes: CustomShapeConfig[];
    private readonly maskClearance: number;


    constructor(settings: CoatingSettings, maskShapes: CustomShapeConfig[]=[]) {
        this.settings = settings;
        this.maskShapes = maskShapes;
        // 마스킹 여유 거리에 코팅 라인 폭 절반을 더합니다.
        this.maskClearance = settings.maskingClearance + settings.coatingWidth / 2;
    }

    public setMaskShapes(maskShapes: CustomShapeConfig[]) {
        this.maskShapes = maskShapes;
    }

    /**
     * 마스킹 도형이 있는지 확인합니다.
     */
    public hasMasks(): boolean {
        return this.settings.enableMasking && this.maskShapes.length > 0;
    }

    /**
     * 원본 세그먼트들과 코팅 도형을 받아 마스킹 적용
     */
    public applyMaskingToSegments(
        segments: PathSegment[],
        coatingShape: CustomShapeConfig
    ): PathSegment[] {
        if (!this.hasMasks()) {
            return segments;
        }

        // ✅ 코팅 도형이 마스킹 영역 안에 완전히 포함되어 있는지 확인
        if (this.isShapeCompletelyInsideMasks(coatingShape)) {
            console.log(`도형 ${coatingShape.name || coatingShape.id}이 마스킹 영역 안에 완전히 포함되어 있습니다. 코팅을 건너뜁니다.`);
            return []; // 빈 배열 반환으로 코팅하지 않음
        }

        const maskedSegments: PathSegment[] = [];
        for (const segment of segments) {
            maskedSegments.push(...this.splitSegmentByMasks(segment, coatingShape));
        }
        return maskedSegments;
    }

    /**
     * 코팅 도형이 마스킹 영역들 중 하나에 완전히 포함되어 있는지 확인
     */
    private isShapeCompletelyInsideMasks(coatingShape: CustomShapeConfig): boolean {
        if (!this.hasMasks()) {
            return false;
        }

        for (const mask of this.maskShapes) {
            if (this.isShapeCompletelyInsideMask(coatingShape, mask)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 코팅 도형이 특정 마스킹 도형 안에 완전히 포함되어 있는지 확인
     */
    private isShapeCompletelyInsideMask(coatingShape: CustomShapeConfig, mask: CustomShapeConfig): boolean {
        const clearance = this.getMaskClearance(mask);

        if (mask.type === 'rectangle') {
            const maskBounds = {
                left: (mask.x ?? 0) - clearance,
                top: (mask.y ?? 0) - clearance,
                right: (mask.x ?? 0) + (mask.width ?? 0) + clearance,
                bottom: (mask.y ?? 0) + (mask.height ?? 0) + clearance
            };

            if (coatingShape.type === 'rectangle') {
                const shapeBounds = {
                    left: coatingShape.x ?? 0,
                    top: coatingShape.y ?? 0,
                    right: (coatingShape.x ?? 0) + (coatingShape.width ?? 0),
                    bottom: (coatingShape.y ?? 0) + (coatingShape.height ?? 0)
                };

                return shapeBounds.left >= maskBounds.left &&
                    shapeBounds.top >= maskBounds.top &&
                    shapeBounds.right <= maskBounds.right &&
                    shapeBounds.bottom <= maskBounds.bottom;

            } else if (coatingShape.type === 'circle' && coatingShape.radius) {
                const shapeLeft = (coatingShape.x ?? 0) - coatingShape.radius;
                const shapeTop = (coatingShape.y ?? 0) - coatingShape.radius;
                const shapeRight = (coatingShape.x ?? 0) + coatingShape.radius;
                const shapeBottom = (coatingShape.y ?? 0) + coatingShape.radius;

                return shapeLeft >= maskBounds.left &&
                    shapeTop >= maskBounds.top &&
                    shapeRight <= maskBounds.right &&
                    shapeBottom <= maskBounds.bottom;

            } else if (coatingShape.type === 'image') {
                // 이미지도 사각형으로 처리
                const shapeBounds = {
                    left: coatingShape.x ?? 0,
                    top: coatingShape.y ?? 0,
                    right: (coatingShape.x ?? 0) + (coatingShape.width ?? 0),
                    bottom: (coatingShape.y ?? 0) + (coatingShape.height ?? 0)
                };

                return shapeBounds.left >= maskBounds.left &&
                    shapeBounds.top >= maskBounds.top &&
                    shapeBounds.right <= maskBounds.right &&
                    shapeBounds.bottom <= maskBounds.bottom;
            }

        } else if (mask.type === 'circle' && mask.radius) {
            const maskCenter = { x: mask.x ?? 0, y: mask.y ?? 0 };
            const maskRadius = mask.radius + clearance;

            if (coatingShape.type === 'circle' && coatingShape.radius) {
                const shapeCenter = { x: coatingShape.x ?? 0, y: coatingShape.y ?? 0 };
                const distance = Math.hypot(
                    shapeCenter.x - maskCenter.x,
                    shapeCenter.y - maskCenter.y
                );
                return distance + coatingShape.radius <= maskRadius;

            } else if (coatingShape.type === 'rectangle') {
                // 사각형이 원 안에 완전히 포함되는지 확인 (모든 꼭짓점이 원 안에 있어야 함)
                const corners = [
                    { x: coatingShape.x ?? 0, y: coatingShape.y ?? 0 },
                    { x: (coatingShape.x ?? 0) + (coatingShape.width ?? 0), y: coatingShape.y ?? 0 },
                    { x: (coatingShape.x ?? 0) + (coatingShape.width ?? 0), y: (coatingShape.y ?? 0) + (coatingShape.height ?? 0) },
                    { x: coatingShape.x ?? 0, y: (coatingShape.y ?? 0) + (coatingShape.height ?? 0) }
                ];

                return corners.every(corner => {
                    const distance = Math.hypot(corner.x - maskCenter.x, corner.y - maskCenter.y);
                    return distance <= maskRadius;
                });

            } else if (coatingShape.type === 'image') {
                // 이미지도 사각형과 동일하게 처리
                const corners = [
                    { x: coatingShape.x ?? 0, y: coatingShape.y ?? 0 },
                    { x: (coatingShape.x ?? 0) + (coatingShape.width ?? 0), y: coatingShape.y ?? 0 },
                    { x: (coatingShape.x ?? 0) + (coatingShape.width ?? 0), y: (coatingShape.y ?? 0) + (coatingShape.height ?? 0) },
                    { x: coatingShape.x ?? 0, y: (coatingShape.y ?? 0) + (coatingShape.height ?? 0) }
                ];

                return corners.every(corner => {
                    const distance = Math.hypot(corner.x - maskCenter.x, corner.y - maskCenter.y);
                    return distance <= maskRadius;
                });
            }
        }

        return false;
    }


    /**
     * 충돌하는 모든 마스킹 도형의 배열을 반환합니다.
     */
    public findIntersectingMasks(start: Point, end: Point): CustomShapeConfig[] {
        if (!this.hasMasks()) {
            return [];
        }

        const intersectingMasks: CustomShapeConfig[] = [];
        for (const mask of this.maskShapes) {
            let intersects = false;
            if (mask.type === 'rectangle') {
                const rect = {
                    x: (mask.x ?? 0) - this.getMaskClearance(mask),
                    y: (mask.y ?? 0) - this.getMaskClearance(mask),
                    width: (mask.width ?? 0) + this.getMaskClearance(mask) * 2,
                    height: (mask.height ?? 0) + this.getMaskClearance(mask) * 2,
                };
                if (this.lineIntersectsRect(start, end, rect)) intersects = true;
            } else if (mask.type === 'circle' && mask.radius) {
                const center = { x: mask.x ?? 0, y: mask.y ?? 0 };
                const radius = mask.radius + this.getMaskClearance(mask);
                if (this.lineIntersectsCircle(start, end, center, radius)) intersects = true;
            }
            if (intersects) {
                intersectingMasks.push(mask);
            }
        }
        return intersectingMasks;
    }

    /**
     * 개별 마스크의 클리어런스를 가져옵니다.
     */
    private getMaskClearance(mask: CustomShapeConfig): number {
        if (mask.coatingType === 'masking' && typeof mask.maskingClearance === 'number') {
            return mask.maskingClearance + this.settings.coatingWidth / 2;
        }
        return this.maskClearance;
    }

    /**
     * 단일 경로 세그먼트를 마스크와 교차하는 부분을 기준으로 잘라냅니다.
     */
    private splitSegmentByMasks(
        segment: PathSegment,
    ): PathSegment[] {
        if (!this.settings.enableMasking || this.maskShapes.length === 0) {
            return [segment];
        }

        const unsafeIntervals: { start: number; end: number }[] = [];

        // 모든 마스크와의 교차 구간(t값 기준)을 찾습니다.
        for (const mask of this.maskShapes) {
            let tValues: [number, number] | null = null;
            if (mask.type === 'rectangle') {
                tValues = this.getLineRectIntersectionParams(segment.start, segment.end, mask);
            } else if (mask.type === 'circle') {
                tValues = this.getLineCircleIntersectionParams(segment.start, segment.end, mask);
            }
            if (tValues) {
                unsafeIntervals.push({ start: tValues[0], end: tValues[1] });
            }
        }

        if (unsafeIntervals.length === 0) {
            return [segment];
        }

        // 겹치는 위험 구간들을 하나로 합칩니다.
        unsafeIntervals.sort((a, b) => a.start - b.start);
        const mergedUnsafe: { start: number; end: number }[] = [];
        if (unsafeIntervals.length > 0) {
            let current = { ...unsafeIntervals[0] };
            for (let i = 1; i < unsafeIntervals.length; i++) {
                const next = unsafeIntervals[i];
                if (next.start < current.end) {
                    current.end = Math.max(current.end, next.end);
                } else {
                    mergedUnsafe.push(current);
                    current = { ...next };
                }
            }
            mergedUnsafe.push(current);
        }

        // 위험 구간을 제외한 안전한 구간들로 새로운 세그먼트를 만듭니다.
        const safeSegments: PathSegment[] = [];
        let lastT = 0.0;
        const dir = { x: segment.end.x - segment.start.x, y: segment.end.y - segment.start.y };

        for (const unsafe of mergedUnsafe) {
            if (unsafe.start > lastT) {
                const p1 = { x: segment.start.x + dir.x * lastT, y: segment.start.y + dir.y * lastT };
                const p2 = { x: segment.start.x + dir.x * unsafe.start, y: segment.start.y + dir.y * unsafe.start };
                if (Math.hypot(p2.x - p1.x, p2.y - p1.y) > 0.01) safeSegments.push({ start: p1, end: p2 });
            }
            lastT = unsafe.end;
        }

        if (lastT < 1.0) {
            const p1 = { x: segment.start.x + dir.x * lastT, y: segment.start.y + dir.y * lastT };
            const p2 = segment.end;
            if (Math.hypot(p2.x - p1.x, p2.y - p1.y) > 0.01) safeSegments.push({ start: p1, end: p2 });
        }

        return safeSegments;
    }

    // 기하학적 교차 계산 함수들...

    private lineIntersectsCircle(p1: Point, p2: Point, circleCenter: Point, radius: number): boolean {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const fx = p1.x - circleCenter.x;
        const fy = p1.y - circleCenter.y;

        const a = dx * dx + dy * dy;
        const b = 2 * (fx * dx + fy * dy);
        const c = (fx * fx + fy * fy) - radius * radius;

        let discriminant = b * b - 4 * a * c;
        if (discriminant < 0) return false;

        discriminant = Math.sqrt(discriminant);
        const t1 = (-b - discriminant) / (2 * a);
        const t2 = (-b + discriminant) / (2 * a);

        return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
    }

    private lineIntersectsRect(p1: Point, p2: Point, rect: { x: number, y: number, width: number, height: number }): boolean {
        const rectMinX = rect.x;
        const rectMaxX = rect.x + rect.width;
        const rectMinY = rect.y;
        const rectMaxY = rect.y + rect.height;

        if (Math.max(p1.x, p2.x) < rectMinX || Math.min(p1.x, p2.x) > rectMaxX ||
            Math.max(p1.y, p2.y) < rectMinY || Math.min(p1.y, p2.y) > rectMaxY) {
            return false;
        }

        const boundaries = [
            { x1: rectMinX, y1: rectMaxY, x2: rectMaxX, y2: rectMaxY },
            { x1: rectMinX, y1: rectMinY, x2: rectMaxX, y2: rectMinY },
            { x1: rectMinX, y1: rectMinY, x2: rectMinX, y2: rectMaxY },
            { x1: rectMaxX, y1: rectMinY, x2: rectMaxX, y2: rectMaxY },
        ];

        for (const b of boundaries) {
            const den = (b.y2 - b.y1) * (p2.x - p1.x) - (b.x2 - b.x1) * (p2.y - p1.y);
            if (den === 0) continue;
            const t = ((b.x2 - b.x1) * (p1.y - b.y1) - (b.y2 - b.y1) * (p1.x - b.x1)) / den;
            const u = -((b.y1 - p1.y) * (p2.x - p1.x) - (b.x1 - p1.x) * (p2.y - p1.y)) / den;
            if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return true;
        }

        return false;
    }

    private getLineRectIntersectionParams(
        p1: Point, p2: Point, mask: CustomShapeConfig
    ): [number, number] | null {
        const clearance = this.getMaskClearance(mask);
        const rect = {
            x: (mask.x ?? 0) - clearance,
            y: (mask.y ?? 0) - clearance,
            width: (mask.width ?? 0) + clearance * 2,
            height: (mask.height ?? 0) + clearance * 2,
        };

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        let t0 = 0.0;
        let t1 = 1.0;

        const check = (p: number, q: number): boolean => {
            if (p === 0) {
                return q >= 0;
            }
            const r = q / p;
            if (p < 0) {
                if (r > t1) return false;
                if (r > t0) t0 = r;
            } else {
                if (r < t0) return false;
                if (r < t1) t1 = r;
            }
            return true;
        };

        if (!check(-dx, p1.x - rect.x)) return null;
        if (!check(dx, rect.x + rect.width - p1.x)) return null;
        if (!check(-dy, p1.y - rect.y)) return null;
        if (!check(dy, rect.y + rect.height - p1.y)) return null;

        return (t0 > 0 || t1 < 1) ? [t0, t1] : null;
    }

    private getLineCircleIntersectionParams(
        p1: Point, p2: Point, mask: CustomShapeConfig
    ): [number, number] | null {
        if (typeof mask.x !== 'number' || typeof mask.y !== 'number' || typeof mask.radius !== 'number') return null;

        const center = { x: mask.x, y: mask.y };
        const radius = mask.radius + this.getMaskClearance(mask);
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const fx = p1.x - center.x;
        const fy = p1.y - center.y;

        const a = dx * dx + dy * dy;
        const b = 2 * (fx * dx + fy * dy);
        const c = (fx * fx + fy * fy) - radius * radius;

        let discriminant = b * b - 4 * a * c;
        if (discriminant < 0) return null;

        discriminant = Math.sqrt(discriminant);
        const t1 = (-b - discriminant) / (2 * a);
        const t2 = (-b + discriminant) / (2 * a);

        const startT = Math.max(0, Math.min(t1, t2));
        const endT = Math.min(1, Math.max(t1, t2));

        return startT < endT ? [startT, endT] : null;
    }

    /**
     * 특정 포인트가 마스크 영역에 있는지 확인합니다.
     */
    public isPointInMaskArea(point: Point): boolean {
        if (!this.hasMasks()) {
            return false;
        }

        for (const mask of this.maskShapes) {
            if (this.isPointInMask(point, mask)) {
                return true;
            }
        }

        return false;
    }

    /**
     * 포인트가 특정 마스크 내부에 있는지 확인합니다.
     */
    private isPointInMask(point: Point, mask: CustomShapeConfig): boolean {
        const clearance = this.getMaskClearance(mask);

        if (mask.type === 'rectangle') {
            const rect = {
                x: (mask.x ?? 0) - clearance,
                y: (mask.y ?? 0) - clearance,
                width: (mask.width ?? 0) + clearance * 2,
                height: (mask.height ?? 0) + clearance * 2,
            };

            return point.x >= rect.x && point.x <= rect.x + rect.width &&
                point.y >= rect.y && point.y <= rect.y + rect.height;
        } else if (mask.type === 'circle' && mask.radius) {
            const center = { x: mask.x ?? 0, y: mask.y ?? 0 };
            const radius = mask.radius + clearance;
            const distance = Math.hypot(point.x - center.x, point.y - center.y);

            return distance <= radius;
        }

        return false;
    }
    /**
     * [신규] 특정 도형이 활성화된 마스크 중 하나와 겹치는지 확인합니다.
     * (간단한 경계 상자 검사로 충분)
     * @param shape 확인할 도형
     */
    public isShapeIntersectingMasks(shape: CustomShapeConfig): boolean {
        if (!this.hasMasks()) return false;

        const shapeBounds = this.getShapeBounds(shape);
        if (!shapeBounds) return false;

        for (const mask of this.maskShapes) {
            const maskBounds = this.getShapeBounds(mask, this.getMaskClearance(mask));
            if (!maskBounds) continue;

            // 경계 상자가 겹치는지 확인
            if (
                shapeBounds.left < maskBounds.right &&
                shapeBounds.right > maskBounds.left &&
                shapeBounds.top < maskBounds.bottom &&
                shapeBounds.bottom > maskBounds.top
            ) {
                return true;
            }
        }
        return false;
    }

    /**
     * [신규] 도형의 경계 상자를 계산하는 헬퍼 함수
     */
    private getShapeBounds(shape: CustomShapeConfig, clearance: number = 0): { left: number, top: number, right: number, bottom: number } | null {
        const x = shape.x ?? 0;
        const y = shape.y ?? 0;

        if (shape.type === 'rectangle' || shape.type === 'image') {
            return {
                left: x - clearance,
                top: y - clearance,
                right: x + (shape.width ?? 0) + clearance,
                bottom: y + (shape.height ?? 0) + clearance,
            };
        } else if (shape.type === 'circle' && shape.radius) {
            return {
                left: x - shape.radius - clearance,
                top: y - shape.radius - clearance,
                right: x + shape.radius + clearance,
                bottom: y + shape.radius + clearance,
            };
        }
        return null;
    }
}