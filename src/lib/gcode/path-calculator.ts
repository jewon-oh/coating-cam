import { CustomShapeConfig } from '@/types/custom-konva-config';
import {CoatingSettings} from "@/types/coating";
import { Point } from '@/types/point';
import { MaskingManager } from "@/lib/gcode/mask-manager";

/**
 * Path 계산 옵션
 */
export interface PathCalculationOptions {
    /** 상대 좌표로 반환할지 여부 (UI용) */
    relative?: boolean;
    /** 변환 정보를 함께 반환할지 여부 */
    includeTransform?: boolean;
}

/**
 * Path 계산 결과
 */
export interface PathCalculationResult {
    segments: { start: Point; end: Point }[];
    transform?: {
        x: number;
        y: number;
        rotation: number;
        scaleX: number;
        scaleY: number;
    };
}

/**
 * 개선된 PathCalculator - 단순화되고 예측 가능한 접근법
 */
export class PathCalculator {
    private readonly settings: CoatingSettings;
    private readonly masker: MaskingManager;

    constructor(settings: CoatingSettings, masker: MaskingManager) {
        this.settings = settings;
        this.masker = masker;
    }
    /**
     * 점을 회전시키는 유틸리티 함수
     */
    private rotatePoint(point: Point, center: Point, angleInDegrees: number): Point {
        if (angleInDegrees === 0) return point;

        const angleInRadians = (angleInDegrees * Math.PI) / 180;
        const cos = Math.cos(angleInRadians);
        const sin = Math.sin(angleInRadians);

        const dx = point.x - center.x;
        const dy = point.y - center.y;

        return {
            x: center.x + (dx * cos - dy * sin),
            y: center.y + (dx * sin + dy * cos)
        };
    }

    /**
     * 도형의 회전 중심점을 계산하는 함수 (Konva의 offsetX, offsetY 고려)
     */
    private getRotationCenter(shape: CustomShapeConfig): Point {
        // Konva의 offsetX, offsetY 고려 (기본값은 0)
        const offsetX = shape.offsetX ?? 0;
        const offsetY = shape.offsetY ?? 0;

        if (shape.type === 'circle') {
            return {
                x: (shape.x ?? 0) - offsetX,
                y: (shape.y ?? 0) - offsetY
            };
        } else if (shape.type === 'rectangle' || shape.type === 'image') {
            return {
                x: (shape.x ?? 0) - offsetX,
                y: (shape.y ?? 0) - offsetY
            };
        }

        return {
            x: (shape.x ?? 0) - offsetX,
            y: (shape.y ?? 0) - offsetY
        };
    }

    /**
     * 도형의 기하학적 중심점을 계산하는 함수 (회전 변환용)
     */
    private getShapeCenter(shape: CustomShapeConfig): Point {
        if (shape.type === 'circle') {
            return {
                x: shape.x ?? 0,
                y: shape.y ?? 0
            };
        } else if (shape.type === 'rectangle' || shape.type === 'image') {
            return {
                x: (shape.x ?? 0) + (shape.width ?? 0) / 2,
                y: (shape.y ?? 0) + (shape.height ?? 0) / 2
            };
        }

        return { x: shape.x ?? 0, y: shape.y ?? 0 };
    }

    /**
     * 세그먼트에 회전 변환 적용
     */
    private applyRotationToSegments(
        segments: { start: Point; end: Point }[],
        shape: CustomShapeConfig
    ): { start: Point; end: Point }[] {
        const rotation = shape.rotation ?? 0;
        if (rotation === 0) return segments;

        // Konva의 회전 중심점 사용
        const rotationCenter = this.getRotationCenter(shape);

        return segments.map(segment => ({
            start: this.rotatePoint(segment.start, rotationCenter, rotation),
            end: this.rotatePoint(segment.end, rotationCenter, rotation)
        }));
    }


    /**
     * 메인 계산 메서드 - 옵션을 통해 절대/상대 좌표 선택
     */
    public async calculateForShape(
        boundary: CustomShapeConfig,
        options: PathCalculationOptions = {}
    ): Promise<PathCalculationResult> {
        const { relative = false, includeTransform = false } = options;

        let segments: { start: Point; end: Point }[] = [];

        if (boundary.coatingType === 'fill') {
            segments = await this.calculateFillSegments(boundary);
        } else if (boundary.coatingType === 'outline') {
            segments = this.calculateOutlineSegments(boundary);
        }

        // 회전 변환 적용 (항상 절대 좌표로 먼저 계산)
        const absoluteSegments = this.applyRotationToSegments(segments, boundary);

        // 변환 정보 준비
        const transform = {
            x: boundary.x ?? 0,
            y: boundary.y ?? 0,
            rotation: boundary.rotation ?? 0,
            scaleX: boundary.scaleX ?? 1,
            scaleY: boundary.scaleY ?? 1
        };

        // 상대 좌표 변환 여부에 따라 처리
        if (relative) {
            // UI용: 상대 좌표로 변환
            const relativeSegments = absoluteSegments.map(seg => ({
                start: {
                    x: seg.start.x - transform.x,
                    y: seg.start.y - transform.y
                },
                end: {
                    x: seg.end.x - transform.x,
                    y: seg.end.y - transform.y
                }
            }));

            return {
                segments: relativeSegments,
                ...(includeTransform && { transform })
            };
        } else {
            // G-code용: 절대 좌표 그대로 반환
            return {
                segments: absoluteSegments,
                ...(includeTransform && { transform })
            };
        }
    }

    // 기존 메서드 유지 (하위 호환성) - 배열 직접 반환
    public async calculateForShapeAbsolute(boundary: CustomShapeConfig): Promise<{ start: Point; end: Point }[]> {
        const result = await this.calculateForShape(boundary, { relative: false });
        return result.segments;
    }

    /**
     * Fill 세그먼트 계산 - 대폭 단순화
     */
    private async calculateFillSegments(boundary: CustomShapeConfig): Promise<{ start: Point; end: Point }[]> {
        const lineSpacing = this.getLineSpacing(boundary);
        const pattern = this.getFillPattern(boundary);
        const bounds = this.getBounds(boundary);

        if (!bounds || lineSpacing <= 0) return [];

        // Concentric 패턴 처리
        if (pattern === 'concentric') {
            return this.calculateConcentricFillSegments(boundary, lineSpacing);
        }

        // Auto 패턴 단순화: 마스킹 유무에 따른 간단한 분기
        const effectivePattern = pattern === 'auto' ?
            await this.determineSimpleOptimalPattern(boundary, bounds) :
            pattern; // 이 시점에서 'horizontal' 또는 'vertical'

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
     * Concentric Fill 세그먼트 계산
     */
    private calculateConcentricFillSegments(
        boundary: CustomShapeConfig,
        lineSpacing: number
    ): { start: Point; end: Point }[] {
        const segments: { start: Point; end: Point }[] = [];
        const coatingWidth = this.getCoatingWidth(boundary);

        if (boundary.type === 'rectangle' || boundary.type === 'image') {
            const x = boundary.x ?? 0;
            const y = boundary.y ?? 0;
            const width = boundary.width ?? 0;
            const height = boundary.height ?? 0;

            // [수정 1] 코팅 폭보다 도형이 작거나 같으면 경로를 생성하지 않도록 명확하게 처리합니다.
            // 첫 경로의 너비/높이가 0보다 커야만 의미가 있습니다.
            if (width <= coatingWidth || height <= coatingWidth) {
                return [];
            }

            const centerX = x + width / 2;
            const centerY = y + height / 2;

            // 첫 경로는 코팅 폭만큼 안쪽으로 이동하여 시작
            let currentWidth = width - coatingWidth;
            let currentHeight = height - coatingWidth;

            while (currentWidth > 0 && currentHeight > 0) {
                const rectX = centerX - currentWidth / 2;
                const rectY = centerY - currentHeight / 2;

                // 현재 사각형의 세그먼트 추가
                segments.push(
                    { start: { x: rectX, y: rectY }, end: { x: rectX + currentWidth, y: rectY } },
                    { start: { x: rectX + currentWidth, y: rectY }, end: { x: rectX + currentWidth, y: rectY + currentHeight } },
                    { start: { x: rectX + currentWidth, y: rectY + currentHeight }, end: { x: rectX, y: rectY + currentHeight } },
                    { start: { x: rectX, y: rectY + currentHeight }, end: { x: rectX, y: rectY } }
                );

                // [수정 2] 다음 경로는 가로/세로 모두 동일하게 lineSpacing 만큼 안쪽으로 이동합니다.
                currentWidth -= lineSpacing * 2;
                currentHeight -= lineSpacing * 2; // aspect를 사용하지 않습니다.
            }
        } else if (boundary.type === 'circle') {
            const centerX = boundary.x ?? 0;
            const centerY = boundary.y ?? 0;
            // 첫 경로는 코팅 폭의 절반만큼 안쪽으로 이동하여 시작
            let currentRadius = (boundary.radius ?? 0) - (coatingWidth / 2);
            // G-code 정밀도를 위해 원본 반지름 기준으로 세그먼트 수 계산
            const numSegments = Math.max(32, Math.floor((boundary.radius ?? 0) * 2));

            while (currentRadius > 0) {
                this.addCircleSegments(segments, centerX, centerY, currentRadius, numSegments);
                // 다음 경로는 lineSpacing 만큼 안쪽으로 이동
                currentRadius -= lineSpacing;
            }
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
        const startY = bounds.y + halfWidth; // 첫 코팅 라인의 중심 Y좌표
        const endY = bounds.y + bounds.height - halfWidth; // 마지막 코팅 라인의 중심 Y좌표

        if (startY > endY || lineSpacing <= 0) return;

        let direction = 1; // 1: LTR, -1: RTL

        for (let i = 0; ; i++) {
            // 다음 코팅 라인 중심 위치 = 이전 코팅 라인 중심 위치 + 코팅 라인 간격
            const currentY = startY + i * lineSpacing;
            if (currentY > endY + 0.01) break; // 영역을 벗어나면 중단

            const lineSegments = this.getHorizontalLineSegmentsInBounds(currentY, boundary);

            for (const segment of lineSegments) {
                segments.push(direction > 0 ? segment : { start: segment.end, end: segment.start });
            }
            direction *= -1; // 방향 전환

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
        const startX = bounds.x + halfWidth; // 첫 코팅 라인의 중심 X좌표
        const endX = bounds.x + bounds.width - halfWidth; // 마지막 코팅 라인의 중심 X좌표

        if (startX > endX || lineSpacing <= 0) return;

        let direction = 1; // 1: TTB, -1: BTT

        for (let i = 0; ; i++) {
            // 다음 코팅 라인 중심 위치 = 이전 코팅 라인 중심 위치 + 코팅 라인 간격
            const currentX = startX + i * lineSpacing;
            if (currentX > endX + 0.01) break; // 영역을 벗어나면 중단

            const lineSegments = this.getVerticalLineSegmentsInBounds(currentX, boundary);

            for (const segment of lineSegments) {
                segments.push(direction > 0 ? segment : { start: segment.end, end: segment.start });
            }
            direction *= -1; // 방향 전환

            if (i % 50 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
    }

    /**
     *  Line 세그먼트 계산
     */
    private generateLineOutline(shape: CustomShapeConfig): { start: Point; end: Point }[] {
        const points = shape.points as number[];

        if (!points || points.length < 4) {
            return [];
        }
        const x = shape.x ?? 0;
        const y = shape.y ?? 0;

        const segments: { start: Point; end: Point }[] = [];
        // 폴리라인의 각 세그먼트를 생성
        for (let i = 0; i < points.length - 2; i += 2) {
            segments.push({
                start: { x: x + points[i], y: y + points[i + 1] },
                end: { x: x + points[i + 2], y: y + points[i + 3] }
            });
        }
        return segments;
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
        }else if(boundary.type==='line'){
            segments.push(...this.generateLineOutline(boundary));
        }

        return segments;
    }


    // 기존의 헬퍼 메서드들 유지 (getBounds, generateRectangleOutline 등)
    // 하지만 복잡한 분석 메서드들은 제거

    private getLineSpacing(shape: CustomShapeConfig): number {
        return shape.lineSpacing ?? this.settings.lineSpacing;
    }

    private getFillPattern(shape: CustomShapeConfig): 'horizontal' | 'vertical' | 'auto' | 'concentric' {
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
        // 회전이 적용된 경우, 점을 역회전시켜서 원래 도형 좌표계에서 검사
        const rotation = boundary.rotation ?? 0;
        let testPoint = point;

        if (rotation !== 0) {
            const rotationCenter = this.getRotationCenter(boundary);
            testPoint = this.rotatePoint(point, rotationCenter, rotation);
        }

        if (boundary.type === 'rectangle' || boundary.type === 'image') {
            const x = boundary.x ?? 0;
            const y = boundary.y ?? 0;
            const width = boundary.width ?? 0;
            const height = boundary.height ?? 0;

            return testPoint.x >= x && testPoint.x <= x + width &&
                testPoint.y >= y && testPoint.y <= y + height;
        } else if (boundary.type === 'circle') {
            const centerX = boundary.x ?? 0;
            const centerY = boundary.y ?? 0;
            const radius = boundary.radius ?? 0;

            const distance = Math.hypot(testPoint.x - centerX, testPoint.y - centerY);
            return distance <= radius;
        }

        return false;
    }

    private getHorizontalLineSegmentsInBounds(y: number, boundary: CustomShapeConfig): { start: Point; end: Point }[] {
        const bounds = this.getBounds(boundary);
        if (!bounds) return [];

        // 회전이 없는 경우의 기본 처리
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

        // 회전이 없는 경우의 기본 처리
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