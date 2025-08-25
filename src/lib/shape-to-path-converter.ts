import { CustomShapeConfig } from '@/types/custom-konva-config';
import { GcodeSettings } from '@/types/gcode';
import { PathSegment, PathGroup } from '@/types/gcode-path';
import { PathGenerator } from '@/lib/gcode/path-generator';

/**
 * Shape를 PathSegment로 변환하는 유틸리티 클래스
 */
export class ShapeToPathConverter {
    private settings: GcodeSettings;
    private workArea: { width: number; height: number };

    constructor(settings: GcodeSettings, workArea: { width: number; height: number }) {
        this.settings = settings;
        this.workArea = workArea;
    }

    /**
     * Shape들을 PathGroup들로 변환
     */
    async convertShapesToPaths(shapes: CustomShapeConfig[]): Promise<PathGroup[]> {
        const pathGroups: PathGroup[] = [];

        // 각 shape를 개별 PathGroup으로 변환
        for (let i = 0; i < shapes.length; i++) {
            const shape = shapes[i];
            const pathGroup = await this.convertShapeToPathGroup(shape, i);
            if (pathGroup && pathGroup.segments.length > 0) {
                pathGroups.push(pathGroup);
            }
        }

        return pathGroups;
    }

    /**
     * 단일 Shape를 PathGroup으로 변환
     */
    private async convertShapeToPathGroup(shape: CustomShapeConfig, index: number): Promise<PathGroup | null> {
        try {
            // PathGenerator를 사용하여 경로 계산
            const pathGenerator = new PathGenerator(this.settings, this.workArea, [shape]);
            const rawSegments = await this.extractSegmentsFromShape(shape);

            const segments: PathSegment[] = rawSegments.map((seg, segIndex) => ({
                id: `${shape.id || `shape-${index}`}-seg-${segIndex}`,
                start: seg.start,
                end: seg.end,
                type: seg.type || 'G1', // 기본값은 G1 (코팅)
                speed: this.settings.feedRate,
                z: seg.type === 'G0' ? this.settings.safeHeight : this.settings.coatingHeight,
                feedRate: seg.type === 'G0' ? this.settings.rapidRate : this.settings.feedRate,
                comment: `${shape.name || shape.type} - ${seg.type}`
            }));

            return {
                id: shape.id || `group-${index}`,
                name: shape.name || `${shape.type.toUpperCase()} ${index + 1}`,
                segments,
                visible: true,
                locked: false,
                color: this.getShapeColor(shape),
                order: shape.coatingOrder || index
            };
        } catch (error) {
            console.error('Shape 변환 중 오류:', error);
            return null;
        }
    }

    /**
     * Shape로부터 실제 경로 세그먼트를 추출
     */
    private async extractSegmentsFromShape(shape: CustomShapeConfig): Promise<Array<{
        start: { x: number; y: number };
        end: { x: number; y: number };
        type: 'G0' | 'G1';
    }>> {
        // PathGenerator의 내부 로직을 활용
        const pathGenerator = new PathGenerator(this.settings, this.workArea, [shape]);

        // PathCalculator에 직접 접근할 수 없으므로 간단한 구현 제공
        if (shape.type === 'rectangle') {
            return this.generateRectangleSegments(shape);
        } else if (shape.type === 'circle') {
            return this.generateCircleSegments(shape);
        } else if (shape.type === 'image') {
            return this.generateImageSegments(shape);
        }

        return [];
    }

    /**
     * 사각형 경로 생성
     */
    private generateRectangleSegments(shape: CustomShapeConfig): Array<{
        start: { x: number; y: number };
        end: { x: number; y: number };
        type: 'G0' | 'G1';
    }> {
        const segments = [];
        const x = shape.x || 0;
        const y = shape.y || 0;
        const width = shape.width || 0;
        const height = shape.height || 0;

        if (shape.coatingType === 'outline') {
            // 외곽선 생성
            segments.push(
                { start: { x, y }, end: { x: x + width, y }, type: 'G1' as const },
                { start: { x: x + width, y }, end: { x: x + width, y: y + height }, type: 'G1' as const },
                { start: { x: x + width, y: y + height }, end: { x, y: y + height }, type: 'G1' as const },
                { start: { x, y: y + height }, end: { x, y }, type: 'G1' as const }
            );
        } else if (shape.coatingType === 'fill') {
            // 채우기 패턴 생성 (간단한 수평선)
            const lineSpacing = shape.lineSpacing || this.settings.lineSpacing;
            const numLines = Math.floor(height / lineSpacing);

            for (let i = 0; i <= numLines; i++) {
                const lineY = y + (i * lineSpacing);
                if (lineY <= y + height) {
                    const isEven = i % 2 === 0;
                    if (isEven) {
                        segments.push({ start: { x, y: lineY }, end: { x: x + width, y: lineY }, type: 'G1' });
                    } else {
                        segments.push({ start: { x: x + width, y: lineY }, end: { x, y: lineY }, type: 'G1' });
                    }
                }
            }
        }

        return segments;
    }

    /**
     * 원 경로 생성
     */
    private generateCircleSegments(shape: CustomShapeConfig): Array<{
        start: { x: number; y: number };
        end: { x: number; y: number };
        type: 'G0' | 'G1';
    }> {
        const segments = [];
        const centerX = shape.x || 0;
        const centerY = shape.y || 0;
        const radius = shape.radius || 0;

        if (shape.coatingType === 'outline') {
            // 원주 근사 (8각형으로 근사)
            const points = 16;
            const angleStep = (2 * Math.PI) / points;

            for (let i = 0; i < points; i++) {
                const angle1 = i * angleStep;
                const angle2 = ((i + 1) % points) * angleStep;

                const start = {
                    x: centerX + radius * Math.cos(angle1),
                    y: centerY + radius * Math.sin(angle1)
                };
                const end = {
                    x: centerX + radius * Math.cos(angle2),
                    y: centerY + radius * Math.sin(angle2)
                };

                segments.push({ start, end, type: 'G1' });
            }
        }
        // fill은 더 복잡하므로 생략 (필요시 구현)

        return segments;
    }

    /**
     * 이미지 경로 생성 (외곽선만)
     */
    private generateImageSegments(shape: CustomShapeConfig): Array<{
        start: { x: number; y: number };
        end: { x: number; y: number };
        type: 'G0' | 'G1';
    }> {
        // 이미지의 경우 사각형과 동일하게 처리
        return this.generateRectangleSegments(shape);
    }

    /**
     * Shape 타입에 따른 색상 반환
     */
    private getShapeColor(shape: CustomShapeConfig): string {
        switch (shape.type) {
            case 'rectangle': return '#3b82f6'; // 파란색
            case 'circle': return '#10b981'; // 초록색
            case 'image': return '#f59e0b'; // 주황색
            default: return '#6b7280'; // 회색
        }
    }
}