import { CustomShapeConfig } from "@/types/custom-konva-config";
import { GCodeEmitter } from "@/lib/gcode/gcode-emitter";
import { ProgressCallback } from "@/lib/gcode/progress-callback";
import { PathCalculator } from "@/lib/gcode/path-calculator";
import { MaskingManager } from "@/lib/gcode/mask-manager";
import { PathOptimizer } from "@/lib/gcode/path-optimizer";
import {CoatingSettings} from "@/types/coating";
import {Point} from "@/types/point";

/**
 * 도형이 코팅에서 제외되어야 하는지 확인합니다.
 */
function shouldSkipCoating(shape: Partial<CustomShapeConfig>): boolean {
    return shape.skipCoating === true;
}

/**
 * 코팅 경로 계산을 전담하는 클래스
 * 도형들을 분석하여 실제 G-code 경로(segments)를 생성합니다.
 */
export class GCodeGenerator {
    private readonly settings: CoatingSettings;
    private readonly coatingShapes: CustomShapeConfig[];

    // 모듈 인스턴스
    private readonly calculator: PathCalculator;
    private readonly masker: MaskingManager;
    private readonly optimizer: PathOptimizer;

    constructor(settings: CoatingSettings, workArea: { width: number; height: number }, shapes: CustomShapeConfig[]) {
        this.settings = settings;
        // 코팅에서 제외되지 않은 도형들만 필터링
        const activeShapes = shapes.filter(s => !shouldSkipCoating(s));

        // 경계 도형들 (실제 코팅이 적용될 도형들)
        this.coatingShapes = activeShapes.filter((s) => {
            return s.coatingType === 'fill' || s.coatingType === 'outline';
        });

        let maskShapes: CustomShapeConfig[] = [];
        if (settings.enableMasking) {
            // 마스킹 도형들: 코팅 경로에 장애물 역할을 하는 도형들
            maskShapes = activeShapes.filter((s) => {
                return s.coatingType === 'masking';
            });
        }

        // 각 모듈을 초기화
        this.masker = new MaskingManager(settings, maskShapes);
        this.calculator = new PathCalculator(settings,this.masker);
        this.optimizer = new PathOptimizer(settings, maskShapes);
    }
    
    public async getOptimizedPathForShape(
        shape: CustomShapeConfig,
        startPoint: Point
    ): Promise<{ start: Point; end: Point }[] | null> {
        if (shouldSkipCoating(shape) || (shape.coatingType !== 'fill' && shape.coatingType !== 'outline')) {
            return null;
        }

        // 1. Calculate raw segments
        const rawSegments = await this.calculator.calculateForShapeAbsolute(shape);

        // 2. Apply masking
        const maskedSegments = this.masker.applyMaskingToSegments(rawSegments, shape);

        if (maskedSegments.length === 0) {
            return null;
        }

        // 3. Get optimized path using the new method in PathOptimizer
        return await this.optimizer.getOptimizedPathForVisualization(
            maskedSegments,
            startPoint
        );
    }

    public async generatePaths(emitter: GCodeEmitter, onProgress?: ProgressCallback): Promise<void> {
        emitter.setZ(this.settings.safeHeight);

        try {
            if (onProgress) onProgress(5, '경로 분석 시작...');

            // 코팅 순서에 따라 정렬
            const orderedBoundaries = [...this.coatingShapes].sort((a, b) => {
                const orderA = a.coatingOrder ?? 999;
                const orderB = b.coatingOrder ?? 999;
                if (orderA !== orderB) return orderA - orderB;
                return (a.x ?? 0) - (b.x ?? 0) || (a.y ?? 0) - (b.y ?? 0);
            });

            if (orderedBoundaries.length === 0) {
                if (onProgress) onProgress(100, '코팅할 도형이 없습니다');
                return;
            }

            // 각 경계 도형별로 코팅 경로 생성
            for (let bi = 0; bi < orderedBoundaries.length; bi++) {
                const boundary = orderedBoundaries[bi];
                const boundaryProgressBase = 5 + (bi / orderedBoundaries.length) * 90;

                const shapeTypeLabel = boundary.type === 'image' ? 'PCB' : boundary.type.toUpperCase();
                if (onProgress) onProgress(boundaryProgressBase, `${shapeTypeLabel} ${bi + 1}/${orderedBoundaries.length} 경로 계산 중...`);

                // 1. 경로 계산 - G-code 생성용: 절대 좌표로 계산
                const rawSegments = await this.calculator.calculateForShapeAbsolute(boundary);

                // 2. 마스킹 적용
                const maskedSegments = this.masker.applyMaskingToSegments(rawSegments, boundary);

                if (maskedSegments.length === 0) {
                    emitter.addLine(`; ${boundary.name || boundary.type} - 생성할 경로 없음`);
                    continue;
                }

                // 3. 최적화 및 G-code 생성
                await this.optimizer.optimizeAndEmit(maskedSegments, emitter, boundary, onProgress);

                // UI 업데이트 양보
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            if (onProgress) onProgress(100, 'G-code 생성 완료');
        } catch (error: unknown) {
            console.error('경로 생성 중 오류:', error);
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            if (onProgress) onProgress(0, `경로 생성 실패: ${errorMessage}`);
            throw error;
        }
    }
}