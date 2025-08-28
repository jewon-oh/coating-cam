import { CustomShapeConfig } from '@/types/custom-konva-config';
import { GcodeSettings } from '@/types/gcode';
import { Point } from '@/lib/gcode/point';
import { MaskingManager } from "@/lib/gcode/mask-manager";

/**
 * 개선된 PathCalculator - 단순화되고 예측 가능한 접근법
 */
export class PathCalculator {
    private readonly settings: GcodeSettings;
    private readonly masker: MaskingManager;

    constructor(settings: GcodeSettings, masker: MaskingManager) {
        this.settings = settings;
        this.masker = masker;
    }

    /**
     * 메인 계산 메서드 - 단순화된 접근
     */
    public async calculateForShape(boundary: CustomShapeConfig): Promise<{ start: Point; end: Point }[]> {
        if (boundary.coatingType === 'fill') {
            return this.calculateFillSegments(boundary);
        } else if (boundary.coatingType === 'outline') {
            return this.calculateOutlineSegments(boundary);
        }
        return [];
    }

    /**
     * Fill 세그먼트 계산 - 대폭 단순화
     */
    private async calculateFillSegments(boundary: CustomShapeConfig): Promise<{ start: Point; end: Point }[]> {
        const lineSpacing = this.getLineSpacing(boundary);
        const pattern = this.getFillPattern(boundary);
        const bounds = this.getBounds(boundary);

        if (!bounds) return [];

        // Auto 패턴 단순화: 마스킹 유무에 따른 간단한 분기
        const effectivePattern = pattern === 'auto' ?
            await this.determineSimpleOptimalPattern(boundary, bounds) :
            pattern;

        return this.generateStreamingFillSegments(boundary, bounds, effectivePattern, lineSpacing);
    }

    /**
     * 간단한 Auto 패턴 결정 - 복잡한 분석 제거
     */
    private async determineSimpleOptimalPattern(
        boundary: CustomShapeConfig,
        bounds: { x: number; y: number; width: number; height: number }
    ): Promise<'horizontal' | 'vertical'> {
        // 마스킹이 없으면 단순한 휴리스틱
        if (!this.masker.hasMasks()) {
            return bounds.width > bounds.height ? 'horizontal' : 'vertical';
        }

        // 마스킹이 있어도 간단한 샘플링 (5x5)
        const maskDensity = await this.sampleMaskDensity(boundary, bounds, 5);

        // 단순한 결정 로직
        if (maskDensity > 0.4) {
            // 마스킹이 많으면 짧은 방향
            return bounds.width > bounds.height ? 'vertical' : 'horizontal';
        } else {
            // 마스킹이 적으면 긴 방향
            return bounds.width > bounds.height ? 'horizontal' : 'vertical';
        }
    }

    /**
     * 간단한 마스크 밀도 샘플링
     */
    private async sampleMaskDensity(
        boundary: CustomShapeConfig,
        bounds: { x: number; y: number; width: number; height: number },
        gridSize: number
    ): Promise<number> {
        let maskedCount = 0;
        const total = gridSize * gridSize;

        const stepX = bounds.width / gridSize;
        const stepY = bounds.height / gridSize;

        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                const point = {
                    x: bounds.x + (i + 0.5) * stepX,
                    y: bounds.y + (j + 0.5) * stepY
                };

                if (this.isPointInBoundary(point, boundary) &&
                    this.masker.isPointInMaskArea(point)) {
                    maskedCount++;
                }
            }
        }

        return maskedCount / total;
    }

    /**
     * 스트리밍 Fill 세그먼트 생성 - 메모리 효율적
     */
    private async generateStreamingFillSegments(
        boundary: CustomShapeConfig,
        bounds: { x: number; y: number; width: number; height: number },
        pattern: 'horizontal' | 'vertical',
        lineSpacing: number
    ): Promise<{ start: Point; end: Point }[]> {
        const segments: { start: Point; end: Point }[] = [];
        const coatingWidth = this.getCoatingWidth(boundary);

        if (pattern === 'horizontal') {
            await this.generateHorizontalLines(boundary, bounds, lineSpacing, coatingWidth, segments);
        } else {
            await this.generateVerticalLines(boundary, bounds, lineSpacing, coatingWidth, segments);
        }

        return segments;
    }

    /**
     * 수평 라인 생성 - Snake 패턴 적용
     */
    private async generateHorizontalLines(
        boundary: CustomShapeConfig,
        bounds: { x: number; y: number; width: number; height: number },
        lineSpacing: number,
        coatingWidth: number,
        segments: { start: Point; end: Point }[]
    ): Promise<void> {
        const halfWidth = coatingWidth / 2;
        const startY = bounds.y + halfWidth;
        const endY = bounds.y + bounds.height - halfWidth;

        if (startY > endY) return;

        const numLines = Math.floor((endY - startY) / lineSpacing) + 1;
        let direction = 1; // 1: 왼쪽에서 오른쪽, -1: 오른쪽에서 왼쪽

        for (let i = 0; i < numLines; i++) {
            const y = startY + i * lineSpacing;
            if (y > endY + 0.01) break;

            const lineSegments = this.getHorizontalLineSegmentsInBounds(y, boundary);

            // Snake 패턴: 방향에 따라 세그먼트 뒤집기
            for (const segment of lineSegments) {
                if (direction > 0) {
                    segments.push(segment);
                } else {
                    segments.push({ start: segment.end, end: segment.start });
                }
            }

            direction *= -1; // 다음 라인을 위해 방향 전환

            // 주기적 UI 양보
            if (i % 50 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
    }

    /**
     * 수직 라인 생성 - Snake 패턴 적용
     */
    private async generateVerticalLines(
        boundary: CustomShapeConfig,
        bounds: { x: number; y: number; width: number; height: number },
        lineSpacing: number,
        coatingWidth: number,
        segments: { start: Point; end: Point }[]
    ): Promise<void> {
        const halfWidth = coatingWidth / 2;
        const startX = bounds.x + halfWidth;
        const endX = bounds.x + bounds.width - halfWidth;

        if (startX > endX) return;

        const numLines = Math.floor((endX - startX) / lineSpacing) + 1;
        let direction = 1; // 1: 위에서 아래, -1: 아래에서 위

        for (let i = 0; i < numLines; i++) {
            const x = startX + i * lineSpacing;
            if (x > endX + 0.01) break;

            const lineSegments = this.getVerticalLineSegmentsInBounds(x, boundary);

            // Snake 패턴: 방향에 따라 세그먼트 뒤집기
            for (const segment of lineSegments) {
                if (direction > 0) {
                    segments.push(segment);
                } else {
                    segments.push({ start: segment.end, end: segment.start });
                }
            }

            direction *= -1; // 다음 라인을 위해 방향 전환

            // 주기적 UI 양보
            if (i % 50 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
    }

    /**
     * Outline 세그먼트 계산 - 기존 로직 유지하되 단순화
     */
    private calculateOutlineSegments(boundary: CustomShapeConfig): { start: Point; end: Point }[] {
        const segments: { start: Point; end: Point }[] = [];
        const outlineOffset = this.getLineSpacing(boundary);
        const passes = this.getOutlinePasses(boundary);
        const startPoint = this.getOutlineStartPoint(boundary);

        if (boundary.type === 'rectangle') {
            segments.push(...this.generateRectangleOutline(boundary, outlineOffset, passes, startPoint));
        } else if (boundary.type === 'circle') {
            segments.push(...this.generateCircleOutline(boundary, outlineOffset, passes, startPoint));
        } else if (boundary.type === 'image') {
            segments.push(...this.generateImageOutline(boundary, outlineOffset, passes, startPoint));
        }

        return segments;
    }

    // 기존의 헬퍼 메서드들 유지 (getBounds, generateRectangleOutline 등)
    // 하지만 복잡한 분석 메서드들은 제거

    private getLineSpacing(shape: CustomShapeConfig): number {
        return shape.lineSpacing ?? this.settings.lineSpacing;
    }

    private getFillPattern(shape: CustomShapeConfig): 'horizontal' | 'vertical' | 'auto' {
        return shape.fillPattern ?? this.settings.fillPattern;
    }

    private getCoatingWidth(shape: CustomShapeConfig): number {
        return shape.coatingWidth ?? this.settings.coatingWidth;
    }

    private getOutlinePasses(shape: CustomShapeConfig): number {
        if (shape.coatingType === 'outline' && typeof shape.outlinePasses === 'number' && shape.outlinePasses > 0) {
            return shape.outlinePasses;
        }
        return 1;
    }

    private getOutlineStartPoint(shape: CustomShapeConfig): 'outside' | 'center' | 'inside' {
        if (shape.coatingType === 'outline' && shape.outlineStartPoint) {
            return shape.outlineStartPoint;
        }
        return 'center';
    }

    // 기존 메서드들 유지하되 간소화...
    private getBounds(shape: CustomShapeConfig): { x: number; y: number; width: number; height: number } | null {
        if (shape.type === 'rectangle' || shape.type === 'image') {
            return {
                x: shape.x ?? 0,
                y: shape.y ?? 0,
                width: shape.width ?? 0,
                height: shape.height ?? 0
            };
        } else if (shape.type === 'circle' && shape.radius) {
            const x = (shape.x ?? 0) - shape.radius;
            const y = (shape.y ?? 0) - shape.radius;
            return {
                x: x,
                y: y,
                width: shape.radius * 2,
                height: shape.radius * 2
            };
        }
        return null;
    }

    private isPointInBoundary(point: Point, boundary: CustomShapeConfig): boolean {
        if (boundary.type === 'rectangle' || boundary.type === 'image') {
            const x = boundary.x ?? 0;
            const y = boundary.y ?? 0;
            const width = boundary.width ?? 0;
            const height = boundary.height ?? 0;

            return point.x >= x && point.x <= x + width &&
                point.y >= y && point.y <= y + height;
        } else if (boundary.type === 'circle') {
            const centerX = boundary.x ?? 0;
            const centerY = boundary.y ?? 0;
            const radius = boundary.radius ?? 0;

            const distance = Math.hypot(point.x - centerX, point.y - centerY);
            return distance <= radius;
        }

        return false;
    }

    private getHorizontalLineSegmentsInBounds(y: number, boundary: CustomShapeConfig): { start: Point; end: Point }[] {
        const bounds = this.getBounds(boundary);
        if (!bounds) return [];

        if (boundary.type === 'rectangle' || boundary.type === 'image') {
            if (y >= bounds.y && y <= bounds.y + bounds.height) {
                return [{ start: { x: bounds.x, y }, end: { x: bounds.x + bounds.width, y } }];
            }
        } else if (boundary.type === 'circle') {
            const centerY = boundary.y ?? 0;
            const radius = boundary.radius ?? 0;
            const centerX = boundary.x ?? 0;

            const dy = Math.abs(y - centerY);
            if (dy <= radius) {
                const dx = Math.sqrt(radius * radius - dy * dy);
                return [{ start: { x: centerX - dx, y }, end: { x: centerX + dx, y } }];
            }
        }

        return [];
    }

    private getVerticalLineSegmentsInBounds(x: number, boundary: CustomShapeConfig): { start: Point; end: Point }[] {
        const bounds = this.getBounds(boundary);
        if (!bounds) return [];

        if (boundary.type === 'rectangle' || boundary.type === 'image') {
            if (x >= bounds.x && x <= bounds.x + bounds.width) {
                return [{ start: { x, y: bounds.y }, end: { x, y: bounds.y + bounds.height } }];
            }
        } else if (boundary.type === 'circle') {
            const centerX = boundary.x ?? 0;
            const radius = boundary.radius ?? 0;
            const centerY = boundary.y ?? 0;

            const dx = Math.abs(x - centerX);
            if (dx <= radius) {
                const dy = Math.sqrt(radius * radius - dx * dx);
                return [{ start: { x, y: centerY - dy }, end: { x, y: centerY + dy } }];
            }
        }

        return [];
    }

    // 기존의 outline 관련 메서드들도 유지...
    private generateRectangleOutline(shape: CustomShapeConfig, offset: number, passes: number, startPoint: 'outside' | 'center' | 'inside'): { start: Point; end: Point }[] {
        // 기존 구현 유지
        const segments: { start: Point; end: Point }[] = [];
        const x = shape.x ?? 0;
        const y = shape.y ?? 0;
        const width = shape.width ?? 0;
        const height = shape.height ?? 0;

        let firstOffset: number;
        switch (startPoint) {
            case 'outside':
                firstOffset = offset;
                break;
            case 'inside':
                firstOffset = -offset;
                break;
            case 'center':
            default:
                firstOffset = 0;
                break;
        }

        for (let pass = 0; pass < passes; pass++) {
            const currentOffset = firstOffset + (offset * pass);
            const outerX = x - currentOffset;
            const outerY = y - currentOffset;
            const outerWidth = width + currentOffset * 2;
            const outerHeight = height + currentOffset * 2;

            if (outerWidth <= 0 || outerHeight <= 0) continue;

            segments.push(
                { start: { x: outerX, y: outerY }, end: { x: outerX + outerWidth, y: outerY } },
                { start: { x: outerX + outerWidth, y: outerY }, end: { x: outerX + outerWidth, y: outerY + outerHeight } },
                { start: { x: outerX + outerWidth, y: outerY + outerHeight }, end: { x: outerX, y: outerY + outerHeight } },
                { start: { x: outerX, y: outerY + outerHeight }, end: { x: outerX, y: outerY } }
            );
        }

        return segments;
    }


    private generateCircleOutline(shape: CustomShapeConfig, offset: number, passes: number, startPoint: 'outside' | 'center' | 'inside'): { start: Point; end: Point }[] {
        const segments: { start: Point; end: Point }[] = [];
        const centerX = shape.x ?? 0;
        const centerY = shape.y ?? 0;
        const baseRadius = shape.radius ?? 0;

        const numSegments = Math.max(16, Math.floor(baseRadius * 0.5));

        // 시작점에 따른 첫 번째 반지름 결정
        let firstRadius: number;
        switch (startPoint) {
            case 'outside':
                // 바깥쪽부터: 첫 번째 원이 윤곽선 바깥에 위치
                firstRadius = baseRadius + offset;
                break;
            case 'inside':
                // 안쪽부터: 첫 번째 원이 윤곽선 안에 위치
                firstRadius = baseRadius - offset;
                break;
            case 'center':
            default:
                // 중심부터: 첫 번째 원이 윤곽선 위에 위치
                firstRadius = baseRadius;
                break;
        }

        // 지정된 패스 수만큼 원형 윤곽선 생성 (바깥쪽으로 퍼져나감)
        for (let pass = 0; pass < passes; pass++) {
            const currentRadius = firstRadius + (offset * pass);

            // 반지름이 0 이하가 되면 건너뛰기
            if (currentRadius <= 0) continue;

            this.addCircleSegments(segments, centerX, centerY, currentRadius, numSegments);
        }

        return segments;
    }

    private generateImageOutline(shape: CustomShapeConfig, offset: number, passes: number, startPoint: 'outside' | 'center' | 'inside'): { start: Point; end: Point }[] {
        // 이미지는 사각형으로 처리
        return this.generateRectangleOutline(shape, offset, passes, startPoint);
    }

    private addCircleSegments(segments: { start: Point; end: Point }[], cx: number, cy: number, r: number, numSegments: number) {
        const angleStep = (2 * Math.PI) / numSegments;

        for (let i = 0; i < numSegments; i++) {
            const angle1 = i * angleStep;
            const angle2 = ((i + 1) % numSegments) * angleStep;

            const x1 = cx + r * Math.cos(angle1);
            const y1 = cy + r * Math.sin(angle1);
            const x2 = cx + r * Math.cos(angle2);
            const y2 = cy + r * Math.sin(angle2);

            segments.push({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 } });
        }
    }
}