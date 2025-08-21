// G-code 생성 중 진행 상황을 알리는 콜백 타입
type ProgressCallback = (progress: number, message: string) => void;

// G-Code 생성에 필요한 커스텀 도형, 설정, 스니펫 타입들을 가져옵니다.
import {AnyNodeConfig} from '@/types/custom-konva-config';
import {GcodeSettings, GCodeSnippet, GCodeHook} from '@/types/gcode';

// Z축을 선택적으로 포함하도록 정의된 점(Point) 인터페이스입니다.
interface Point {
    x: number;
    y: number;
    z?: number; // Z축은 선택 사항
}

// 경로 세그먼트의 타입을 정의하는 인터페이스
// 'safe'는 마스크에 의해 가려지지 않는 영역을, 'unsafe'는 가려지는 영역을 나타냅니다.
interface PathSegment {
    type: 'safe' | 'unsafe';
    start: number;
    end: number;
    cause?: AnyNodeConfig; // 이 세그먼트를 생성한 원인(도형)
}

/**
 * 개별 도형의 코팅 높이를 계산합니다.
 * - 도형에 useCustomCoating && coatingHeight가 있으면 그 값을 우선 적용
 * - 없으면 전역 settings.coatingHeight 사용
 */
function getCoatingHeight(shape: Partial<AnyNodeConfig> | undefined, settings: GcodeSettings): number {
    if (shape?.useCustomCoating && typeof shape.coatingHeight === 'number') {
        return shape.coatingHeight;
    }
    return settings.coatingHeight;
}
/**
 * [업데이트] 개별 도형의 코팅 속도를 계산합니다.
 */
function getCoatingSpeed(shape: Partial<AnyNodeConfig> | undefined, settings: GcodeSettings): number {
    if (shape?.useCustomCoating && typeof shape.coatingSpeed === 'number') {
        return shape.coatingSpeed;
    }
    return settings.coatingSpeed;
}

/**
 * 도형이 코팅에서 제외되어야 하는지 확인합니다.
 */
function shouldSkipCoating(shape: Partial<AnyNodeConfig>): boolean {
    return shape.skipCoating === true;
}

/**
 * G-code 생성과 상태 추적을 전담하는 클래스
 * 현재 위치, 설정 등을 관리하며, G-code 명령어를 생성하고 추가합니다.
 */
class GCodeEmitter {
    // 생성된 G-code 문자열을 저장합니다.
    private gcode: string = '';
    // 마지막으로 이동한 위치를 추적하여 불필요한 이동 명령을 방지합니다.
    private lastPosition: Point = {x: 0, y: 0, z: 0};
    // G-code 생성에 필요한 설정을 담고 있습니다. (예: 속도, 높이)
    private readonly settings: GcodeSettings;

    constructor(settings: GcodeSettings) {
        this.settings = settings;
    }

    /**
     * G-code 문자열에 한 줄을 추가합니다.
     * @param line G-code 명령어 한 줄
     */
    addLine(line: string) {
        this.gcode += line + '\n';
    }

    /**
     * 지정된 좌표로 이동하는 내부 로직
     * @param x X좌표
     * @param y Y좌표
     * @param z Z좌표 (선택 사항)
     * @param speed 이동 속도 (F값)
     * @param isRapid 고속 이동(G0)인지, 직선 이동(G1)인지
     */
    private moveTo(x: number, y: number, z: number | undefined, speed: number, isRapid: boolean) {
        // 마지막 위치와 동일할 경우, 불필요한 명령을 생성하지 않습니다.
        if (
            Math.abs(this.lastPosition.x - x) < 0.01 &&
            Math.abs(this.lastPosition.y - y) < 0.01 &&
            (z === undefined || z === null || Math.abs(this.lastPosition.z! - z) < 0.01)
        ) {
            return;
        }

        const command = isRapid ? 'G0' : 'G1'; // G0 또는 G1 명령어 선택
        this.addLine(
            // G-code 문자열을 형식에 맞게 생성합니다.
            `${command} F${speed} X${x.toFixed(3)} Y${y.toFixed(3)}${
                z !== undefined && z !== null ? ` Z${z.toFixed(3)}` : ''
            }`,
        );
        // 마지막 위치를 현재 위치로 업데이트합니다.
        this.lastPosition = {x, y, z: z ?? this.lastPosition.z};
    }

    /**
     * 고속 이동(G0)을 사용하여 지정된 위치로 이동합니다.
     * @param x X좌표
     * @param y Y좌표
     * @param z Z좌표 (선택 사항)
     */
    public travelTo(x: number, y: number, z?: number) {
        this.moveTo(x, y, z, this.settings.moveSpeed, true);
    }

    // --- ⬇️ 새로운 메서드 추가 ⬇️ ---
    /**
     * [신규] 지정된 속도를 사용하여 코팅(G1) 이동을 합니다.
     * @param x X좌표
     * @param y Y좌표
     * @param speed 이동 속도 (F값)
     */
    public coatToWithSpeed(x: number, y: number, speed: number) {
        this.moveTo(x, y, this.lastPosition.z, speed, false);
    }

    /**
     * 코팅 속도(G1)를 사용하여 현재 Z높이에서 지정된 위치로 이동합니다.
     * @param x X좌표
     * @param y Y좌표
     */
    public coatTo(x: number, y: number) {
        this.moveTo(x, y, this.lastPosition.z, this.settings.coatingSpeed, false);
    }

    /**
     * 코팅 높이(G1)에서 지정된 위치로 이동합니다.
     * @param x X좌표
     * @param y Y좌표
     */
    public travelAtCoatingHeight(x: number, y: number) {
        this.moveTo(x, y, this.settings.coatingHeight, this.settings.moveSpeed, false);
    }

    /**
     * Z축 높이를 설정합니다. (고속 이동)
     * @param z Z좌표
     */
    public setZ(z: number) {
        this.moveTo(this.lastPosition.x, this.lastPosition.y, z, this.settings.moveSpeed, true);
    }

    /**
     * [선택] 코팅 높이로 내리되, 필요 시 개별 높이를 적용해 사용할 수 있습니다.
     * 내부적으로는 setZ를 사용합니다.
     */
    public setCoatingZ(z: number) {
        this.setZ(z);
    }

    /**
     * 노즐 ON 명령(M503)을 추가합니다.
     */
    public nozzleOn() {
        this.addLine('M503 ; Nozzle ON');
    }

    /**
     * 노즐 OFF 명령(M504)을 추가합니다.
     */
    public nozzleOff() {
        this.addLine('M504 ; Nozzle OFF');
    }

    /**
     * 현재 위치를 반환합니다.
     * @returns 현재 위치
     */
    public getCurrentPosition(): Point {
        return {...this.lastPosition};
    }

    /**
     * 최종 G-code 문자열을 반환합니다.
     * @returns 생성된 G-code
     */
    public getGCode(): string {
        return this.gcode;
    }
}

/**
 * 코팅 경로 계산을 전담하는 클래스
 * 도형들을 분석하여 실제 G-code 경로(segments)를 생성합니다.
 */
class PathGenerator {
    private readonly settings: GcodeSettings;
    // 경계를 정의하는 도형 (이미지)
    private readonly coatingShapes: AnyNodeConfig[];
    // 마스킹을 위한 도형 (이미지 외의 도형)
    private readonly maskShapes: AnyNodeConfig[];
    // 마스킹 클리어런스 (코팅 폭의 절반과 마스킹 여유분 포함)
    private readonly maskClearance: number;

    constructor(settings: GcodeSettings, shapes: AnyNodeConfig[]) {
        this.settings = settings;

        // 코팅에서 제외되지 않은 도형들만 필터링
        const activeShapes = shapes.filter(s => !shouldSkipCoating(s));

        // 경계 도형들 (실제 코팅이 적용될 도형들) - 도형 타입에 관계없이 코팅 설정으로 판단
        this.coatingShapes = activeShapes.filter((s) => {
            // fill 또는 outline 타입인 경우만 코팅 대상
            return s.coatingType === 'fill' || s.coatingType === 'outline';
        });

        // 마스킹 여유 거리에 코팅 라인 폭 절반을 더합니다.
        this.maskClearance = settings.maskingClearance + settings.coatingWidth / 2;

        if (!settings.enableMasking) {
            this.maskShapes = [];
        } else {
            // 마스킹 도형들: 코팅 경로에 장애물 역할을 하는 도형들
            this.maskShapes = activeShapes.filter((s) => {
                return s.coatingType === 'masking';
            });
        }
    }


    /**
     * G-code 경로를 생성하고 GCodeEmitter에 추가합니다.(비동기 처리)
     * 각 도형의 타입(outline, fill)에 따라 적절한 경로 생성 로직을 호출합니다.
     * @param emitter G-code를 생성할 Emitter 인스턴스
     * @param onProgress 진행 상황을 알리는 콜백 함수 (선택 사항)
     */
    public async generatePaths(emitter: GCodeEmitter, onProgress?: ProgressCallback): Promise<void> {
        emitter.setZ(this.settings.safeHeight);

        try {
            if (onProgress) onProgress(5, '경로 분석 시작...');

            // 코팅 순서에 따라 정렬 (coatingOrder가 낮은 것부터)
            const orderedBoundaries = [...this.coatingShapes].sort((a, b) => {
                const orderA = a.coatingOrder ?? 999;
                const orderB = b.coatingOrder ?? 999;
                if (orderA !== orderB) return orderA - orderB;
                // 순서가 같으면 위치로 정렬
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

                // 도형 타입에 따른 메시지 개선
                const shapeTypeLabel = boundary.type === 'image' ? 'PCB' : boundary.type.toUpperCase();
                if (onProgress) onProgress(boundaryProgressBase, `${shapeTypeLabel} ${bi + 1}/${orderedBoundaries.length} 경로 계산 중...`);

                const allSegments: { start: Point; end: Point }[] = [];

                // 이제 coatingType만으로 윤곽선과 채우기를 명확히 구분합니다.
                // 도형의 실제 타입(image, rectangle, circle)에 의존하지 않습니다.
                if (boundary.coatingType === 'outline') {
                    // 윤곽선 코팅
                    emitter.addLine(`; Generating outline segments for ${boundary.name || boundary.type} shape...`);
                    // 1. 마스킹이 적용되지 않은 원본 윤곽선 세그먼트를 생성합니다.
                    const rawOutlineSegments = this.generateOutlineSegments(boundary);

                    // 2. 각 세그먼트를 순회하며 마스킹을 적용하고 안전한 부분만 allSegments에 추가합니다.
                    for (const rawSegment of rawOutlineSegments) {
                        const safeSegments = this.splitSegmentByMasks(rawSegment);
                        allSegments.push(...safeSegments);
                    }
                }
                else if (boundary.coatingType === 'fill') {
                    // 채우기 코팅 (이전 수정으로 이제 모든 도형 유형을 지원)
                    emitter.addLine(`; Pre-calculating fill segments for ${boundary.name || boundary.type}...`);
                    const fillSegments = await this.precalculateAllSafeSegmentsAsync(boundary, onProgress);
                    allSegments.push(...fillSegments);
                }

                if (allSegments.length === 0) {
                    emitter.addLine(`; ${boundary.name || boundary.type} - 생성할 경로 없음`);
                    continue;
                }

                if (onProgress) onProgress(boundaryProgressBase + 2, '경로 그룹화 및 최적화 중...');
                const zones = this.clusterSegmentsWithKMeans(allSegments, 5, 5);

                emitter.addLine(`; ---- ${shapeTypeLabel} ${boundary.name ?? 'unknown'} start ----`);
                const shapeCoatingZ = getCoatingHeight(boundary, this.settings);

                // ✅ 1. 동적 영역 순회를 위한 새로운 로직
                let currentLocation = emitter.getCurrentPosition();
                const unvisitedZones = new Set(zones.filter(z => z.length > 0));
                let processedZoneCount = 0;
                const totalActiveZones = unvisitedZones.size;

                while (unvisitedZones.size > 0) {
                    // ✅ 2. 현재 위치에서 가장 가까운 '진입점'(시작점 끝점)과 해당 '영역'을 찾습니다.
                    let bestNextZone: { start: Point; end: Point }[] | null = null;
                    let closestEntryPoint: Point | null = null;
                    let closestDistance = Infinity;

                    for (const zone of unvisitedZones) {
                        for (const segment of zone) {
                            // 시작점까지의 거리
                            const distToStart = Math.hypot(currentLocation.x - segment.start.x, currentLocation.y - segment.start.y);
                            if (distToStart < closestDistance) {
                                closestDistance = distToStart;
                                bestNextZone = zone;
                                closestEntryPoint = segment.start;
                            }
                            // 끝점까지의 거리
                            const distToEnd = Math.hypot(currentLocation.x - segment.end.x, currentLocation.y - segment.end.y);
                            if (distToEnd < closestDistance) {
                                closestDistance = distToEnd;
                                bestNextZone = zone;
                                closestEntryPoint = segment.end; // 끝점이 더 가까우면 끝점에서 시작하도록 설정
                            }
                        }
                    }

                    if (bestNextZone && closestEntryPoint) {
                        const intersectedMasks = this.findIntersectingMasks(currentLocation, closestEntryPoint);

                        // 1. 충돌이 없으면 직접 이동
                        if (intersectedMasks.length === 0) {
                            emitter.travelTo(closestEntryPoint.x, closestEntryPoint.y);
                        }
                        // 2. 충돌 시 회피 전략에 따라 분기
                        else {
                            emitter.addLine(`; [INFO] Mask collision detected. Strategy: ${this.settings.travelAvoidanceStrategy}`);
                            // 2-1. 윤곽 회피 옵션 + 단일 장애물 충돌 시
                            if (this.settings.travelAvoidanceStrategy === 'contour' && intersectedMasks.length === 1) {
                                const detourPath = this.planDetourPath(currentLocation, closestEntryPoint, intersectedMasks[0]);
                                emitter.addLine(`; [INFO] Detouring around ${intersectedMasks[0].name} via ${detourPath.length} waypoints.`);
                                // 계산된 우회 경로를 따라 이동
                                for (const waypoint of detourPath) {
                                    emitter.travelTo(waypoint.x, waypoint.y);
                                }
                                emitter.travelTo(closestEntryPoint.x, closestEntryPoint.y); // 최종 목적지로 이동
                            }
                            // 2-2. Z-Lift 옵션 또는 여러 장애물과 복잡하게 충돌 시
                            else {
                                emitter.addLine(`; [INFO] Falling back to Z-Lift maneuver.`);
                                emitter.setZ(this.settings.safeHeight);
                                emitter.travelTo(closestEntryPoint.x, closestEntryPoint.y);
                            }
                        }

                        // 코팅 시작 전, Z축 높이를 다시 설정
                        emitter.setCoatingZ(shapeCoatingZ);

                        // 개별 코팅 속도 적용
                        const shapeCoatingSpeed = getCoatingSpeed(boundary, this.settings);

                        const orderedPath = await this.findPathWithinZoneAsync(bestNextZone, closestEntryPoint);

                        for (const segment of orderedPath) {
                            // 이미 segment.start로 이동했으므로, 위치 확인 후 코팅
                            if (Math.abs(emitter.getCurrentPosition().x - segment.start.x) > 0.01 || Math.abs(emitter.getCurrentPosition().y - segment.start.y) > 0.01) {
                                emitter.travelTo(segment.start.x, segment.start.y);
                            }
                            emitter.nozzleOn();
                            emitter.coatToWithSpeed(segment.end.x, segment.end.y, shapeCoatingSpeed);
                            emitter.nozzleOff();
                        }

                        currentLocation = emitter.getCurrentPosition();
                        unvisitedZones.delete(bestNextZone);

                        processedZoneCount++;
                        if (onProgress) {
                            onProgress(boundaryProgressBase + 2 + (processedZoneCount / totalActiveZones) * 20, `${shapeTypeLabel} ${bi + 1} - 영역 ${processedZoneCount}/${totalActiveZones} 처리 완료...`);
                        }
                    } else {
                        // 남은 영역이 있지만 진입점을 찾지 못한 경우(예외 처리)
                        break;
                    }

                    // UI 업데이트 양보
                    await new Promise(resolve => setTimeout(resolve, 0));
                }

                // 다음 코팅 도형으로 넘어가기 전 들어올리기
                emitter.setZ(this.settings.safeHeight);
                emitter.addLine(`; ---- ${shapeTypeLabel} ${boundary.name ?? 'unknown'} end ----`);
            }

            if (onProgress) onProgress(100, 'G-code 생성 완료');
        } catch (error: unknown) {
            console.error('경로 생성 중 오류:', error);
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
            if (onProgress) onProgress(0, `경로 생성 실패: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * 비동기 안전 세그먼트 계산
     * - boundary가 주어지면 해당 도형 내부만 계산
     * - 주어지지 않으면 기존처럼 모든 코팅 도형을 대상으로 계산
     */
    private async precalculateAllSafeSegmentsAsync(
        boundary?: AnyNodeConfig,
        onProgress?: ProgressCallback
    ): Promise<{ start: Point; end: Point }[]> {
        const segments: { start: Point; end: Point }[] = [];

        try {
            const boundaries = boundary ? [boundary] : this.coatingShapes;
            if (boundaries.length === 0) {
                console.warn('경계 도형이 없습니다. 코팅할 도형을 추가해주세요.');
                return segments;
            }

            const directions: ('horizontal' | 'vertical')[] = [];
            if (this.settings.fillPattern === 'horizontal' || this.settings.fillPattern === 'auto') directions.push('horizontal');
            if (this.settings.fillPattern === 'vertical' || this.settings.fillPattern === 'auto') directions.push('vertical');

            if (directions.length === 0) {
                console.warn('채우기 패턴이 설정되지 않았습니다.');
                return segments;
            }

            const totalBoundaries = boundaries.length;
            let processedBoundaries = 0;

            for (const b of boundaries) {
                // --- ⬇️ 수정된 부분: 도형 타입에 따른 경계 계산 ⬇️ ---
                let bx: number, by: number, bw: number, bh: number;

                if (b.type === 'circle' && typeof b.radius === 'number') {
                    // 원의 경우, 반지름을 이용해 바운딩 박스를 계산합니다.
                    bx = (b.x ?? 0) - b.radius;
                    by = (b.y ?? 0) - b.radius;
                    bw = b.radius * 2;
                    bh = b.radius * 2;
                } else {
                    // 사각형, 이미지 등 기존 로직을 유지합니다.
                    bx = b.x ?? 0;
                    by = b.y ?? 0;
                    bw = b.width ?? 0;
                    bh = b.height ?? 0;
                }
                // --- ⬆️ 수정 완료 ⬆️ ---

                for (const direction of directions) {
                    const isHorizontal = direction === 'horizontal';
                    // 여기서 계산된 bx, by, bw, bh를 사용합니다.
                    const mainAxisStart = isHorizontal ? by : bx;
                    const mainAxisEnd = isHorizontal ? by + bh : bx + bw;

                    if (mainAxisStart >= mainAxisEnd) continue;

                    const totalLines = Math.ceil((mainAxisEnd - mainAxisStart) / this.settings.lineSpacing);
                    let processedLines = 0;

                    for (let mainAxis = mainAxisStart; mainAxis <= mainAxisEnd; mainAxis += this.settings.lineSpacing) {
                        // getLineSegments는 이제 원과 같은 도형도 처리할 수 있습니다.
                        const lineSegments = this.getLineSegments(mainAxis, direction, b);

                        for (const seg of lineSegments) {
                            if (seg.type === 'safe') {
                                const startPoint = isHorizontal
                                    ? {x: seg.start, y: mainAxis}
                                    : {x: mainAxis, y: seg.start};
                                const endPoint = isHorizontal
                                    ? {x: seg.end, y: mainAxis}
                                    : {x: mainAxis, y: seg.end};
                                segments.push({start: startPoint, end: endPoint});
                            }
                        }

                        processedLines++;
                        if (onProgress && totalLines > 0 && processedLines % 10 === 0) {
                            const boundaryRatio = processedLines / totalLines;
                            const overall = (processedBoundaries + boundaryRatio) / totalBoundaries;
                            onProgress(5 + overall * 25, `스캔라인 계산 중... (${Math.round(boundaryRatio * 100)}%)`);
                        }

                        // UI 양보
                        if (processedLines % 200 === 0) {
                            await new Promise(resolve => setTimeout(resolve, 0));
                        }
                    }
                }

                processedBoundaries++;
            }

            return segments;
        } catch (e) {
            console.error('안전 세그먼트 계산 중 오류:', e);
            return segments;
        }
    }

    /**
     * [새로 추가] 비동기 경로 최적화
     */
    private async findPathWithinZoneAsync(
        zone: { start: Point; end: Point }[],
        startPoint: Point
    ): Promise<{ start: Point; end: Point }[]> {
        if (zone.length === 0) return [];

        const remaining = new Set(zone);
        const orderedPath: { start: Point; end: Point }[] = [];
        let currentLocation = startPoint;
        let processed = 0;

        while (remaining.size > 0) {
            let closestSegment: { start: Point; end: Point } | null = null;
            let closestDistance = Infinity;
            let reversed = false;

            // 가장 가까운 세그먼트 찾기
            for (const segment of remaining) {
                const distToStart = Math.hypot(
                    currentLocation.x - segment.start.x,
                    currentLocation.y - segment.start.y
                );
                const distToEnd = Math.hypot(
                    currentLocation.x - segment.end.x,
                    currentLocation.y - segment.end.y
                );

                if (distToStart < closestDistance) {
                    closestDistance = distToStart;
                    closestSegment = segment;
                    reversed = false;
                }
                if (distToEnd < closestDistance) {
                    closestDistance = distToEnd;
                    closestSegment = segment;
                    reversed = true;
                }
            }

            if (closestSegment) {
                if (reversed) {
                    orderedPath.push({start: closestSegment.end, end: closestSegment.start});
                    currentLocation = closestSegment.start;
                } else {
                    orderedPath.push(closestSegment);
                    currentLocation = closestSegment.end;
                }
                remaining.delete(closestSegment);
            }

            processed++;

            // 큰 영역의 경우 주기적으로 UI에 양보
            if (zone.length > 1000 && processed % 100 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        return orderedPath;
    }

    /**
     * K-Means 알고리즘을 사용하여 세그먼트를 클러스터링합니다.
     * @param segments 전체 세그먼트 배열
     * @param k 생성할 클러스터(zone)의 개수
     * @param maxIterations 최대 반복 횟수
     * @returns { start: Point; end: Point }[][] - 클러스터링된 세그먼트 배열
     */
    private clusterSegmentsWithKMeans(
        segments: { start: Point; end: Point }[],
        k: number,
        maxIterations = 50
    ): { start: Point; end: Point }[][] {
        if (segments.length === 0 || k === 0) return [];

        const segmentMidpoints = segments.map(s => ({
            x: (s.start.x + s.end.x) / 2,
            y: (s.start.y + s.end.y) / 2,
        }));

        // 1. k개의 중심점을 무작위로 초기화합니다.
        let centroids = segmentMidpoints.slice(0, k);

        let assignments: number[] = [];

        for (let iter = 0; iter < maxIterations; iter++) {
            // 2. 할당 단계: 각 세그먼트를 가장 가까운 중심점에 할당합니다.
            assignments = segmentMidpoints.map(midpoint => {
                let closestCentroidIndex = 0;
                let minDistance = Infinity;
                for (let i = 0; i < centroids.length; i++) {
                    const distance = Math.hypot(midpoint.x - centroids[i].x, midpoint.y - centroids[i].y);
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestCentroidIndex = i;
                    }
                }
                return closestCentroidIndex;
            });

            // 3. 업데이트 단계: 중심점의 위치를 재계산합니다.
            const newCentroids: Point[] = [];
            const clusterCounts: number[] = Array(k).fill(0);
            const clusterSums: Point[] = Array(k).fill(0).map(() => ({ x: 0, y: 0 }));

            for (let i = 0; i < segmentMidpoints.length; i++) {
                const clusterIndex = assignments[i];
                clusterSums[clusterIndex].x += segmentMidpoints[i].x;
                clusterSums[clusterIndex].y += segmentMidpoints[i].y;
                clusterCounts[clusterIndex]++;
            }

            for (let i = 0; i < k; i++) {
                if (clusterCounts[i] > 0) {
                    newCentroids[i] = {
                        x: clusterSums[i].x / clusterCounts[i],
                        y: clusterSums[i].y / clusterCounts[i],
                    };
                } else {
                    // 할당된 세그먼트가 없는 경우, 중심점을 그대로 유지 (또는 다른 곳으로 재배치)
                    newCentroids[i] = centroids[i];
                }
            }

            // 중심점이 더 이상 변하지 않으면 일찍 종료
            const centroidShift = centroids.reduce((sum, c, i) => sum + Math.hypot(c.x - newCentroids[i].x, c.y - newCentroids[i].y), 0);
            if (centroidShift < 0.01) {
                break;
            }

            centroids = newCentroids;
        }

        // 최종 할당 결과에 따라 세그먼트들을 그룹화합니다.
        const zones: { start: Point; end: Point }[][] = Array(k).fill(0).map(() => []);
        for (let i = 0; i < segments.length; i++) {
            const clusterIndex = assignments[i];
            zones[clusterIndex].push(segments[i]);
        }

        return zones;
    }

    /**
     * 경계 도형에 대한 한 줄의 세그먼트들을 계산합니다.
     * 마스킹 도형이 있을 경우 안전한(safe) 영역과 위험한(unsafe) 영역을 분리합니다.
     * @param mainAxis 주축의 현재 위치
     * @param direction 경로의 방향
     * @param boundary 경계 도형
     * @returns PathSegment[] - 안전/위험 세그먼트 배열
     */
    private getLineSegments(
        mainAxis: number,
        direction: 'horizontal' | 'vertical' | 'auto',
        boundary: AnyNodeConfig,
    ): PathSegment[] {
        const {workArea} = this.settings;
        const isHorizontal = direction === 'horizontal';

        let lineStart: number;
        let lineEnd: number;

        // --- ⬇️ 수정된 부분: 도형 타입에 따른 라인 시작/끝 계산 ⬇️ ---
        if (boundary.type === 'circle' && typeof boundary.radius === 'number') {
            const centerCross = isHorizontal ? (boundary.x ?? 0) : (boundary.y ?? 0);
            const centerMain = isHorizontal ? (boundary.y ?? 0) : (boundary.x ?? 0);
            const radius = boundary.radius;

            const deltaMain = Math.abs(mainAxis - centerMain);
            if (deltaMain > radius) {
                return []; // 스캔라인이 원을 지나지 않음
            }

            // 원과 직선의 교점을 찾아 라인의 시작과 끝을 계산
            const deltaCross = Math.sqrt(radius * radius - deltaMain * deltaMain);
            lineStart = centerCross - deltaCross;
            lineEnd = centerCross + deltaCross;

        } else {
            // 사각형 및 기타 도형에 대한 기존 로직
            const startX = boundary.x ?? 0;
            const startY = boundary.y ?? 0;
            const width = boundary.width ?? 0;
            const height = boundary.height ?? 0;

            lineStart = isHorizontal ? startX : startY;
            lineEnd = isHorizontal ? startX + width : startY + height;
        }

        // 작업 영역 경계에 맞게 조정
        lineStart = Math.max(lineStart, 0);
        lineEnd = Math.min(lineEnd, isHorizontal ? workArea.width : workArea.height);
        // --- ⬆️ 수정 완료 ⬆️ ---

        if (lineStart >= lineEnd) return [];

        // 마스킹 기능이 비활성화되어 있으면 전체 구간을 안전한 세그먼트로 반환
        if (!this.settings.enableMasking || this.maskShapes.length === 0) {
            return [{type: 'safe', start: lineStart, end: lineEnd}];
        }

        // (이하 마스킹 로직은 기존과 동일)
        const unsafeIntervals: { start: number; end: number; cause: AnyNodeConfig }[] = [];
        for (const mask of this.maskShapes) {
            const mx = mask.x ?? 0;
            const my = mask.y ?? 0;
            const mw = mask.width ?? 0;
            const mh = mask.height ?? 0;

            let intersection: { start: number; end: number } | null = null;
            if (mask.type === 'circle') {
                const centerCross = isHorizontal ? mx : my;
                const centerMain = isHorizontal ? my : mx;
                const deltaMain = Math.abs(mainAxis - centerMain);
                if (deltaMain <= mask.radius + this.maskClearance) {
                    const deltaCross = Math.sqrt(Math.pow(mask.radius + this.maskClearance, 2) - Math.pow(deltaMain, 2));
                    intersection = {start: centerCross - deltaCross, end: centerCross + deltaCross};
                }
            } else if (mask.type === 'rectangle') {
                const rectMinCross = isHorizontal ? mx : my;
                const rectMaxCross = isHorizontal ? mx + mw : my + mh;
                const rectMinMain = isHorizontal ? my : mx;
                const rectMaxMain = isHorizontal ? my + mh : mx + mw;
                if (mainAxis >= rectMinMain - this.maskClearance && mainAxis <= rectMaxMain + this.maskClearance) {
                    intersection = {start: rectMinCross - this.maskClearance, end: rectMaxCross + this.maskClearance};
                }
            }
            if (intersection) unsafeIntervals.push({...intersection, cause: mask});
        }

        if (unsafeIntervals.length === 0) return [{type: 'safe', start: lineStart, end: lineEnd}];

        // 중첩된 위험 영역을 병합합니다.
        unsafeIntervals.sort((a, b) => a.start - b.start);
        const mergedUnsafe: { start: number; end: number; cause: AnyNodeConfig }[] = [];
        if (unsafeIntervals.length > 0) {
            let currentMerge = {...unsafeIntervals[0]};
            for (let i = 1; i < unsafeIntervals.length; i++) {
                const next = unsafeIntervals[i];
                if (next.start < currentMerge.end) {
                    currentMerge.end = Math.max(currentMerge.end, next.end);
                } else {
                    mergedUnsafe.push(currentMerge);
                    currentMerge = {...next};
                }
            }
            mergedUnsafe.push(currentMerge);
        }

        // 전체 라인을 안전/위험 세그먼트로 분리합니다.
        const allSegments: PathSegment[] = [];
        let cursor = lineStart;
        for (const unsafe of mergedUnsafe) {
            if (cursor < unsafe.start) allSegments.push({type: 'safe', start: cursor, end: unsafe.start});
            allSegments.push({type: 'unsafe', start: unsafe.start, end: unsafe.end, cause: unsafe.cause});
            cursor = unsafe.end;
        }
        if (cursor < lineEnd) allSegments.push({type: 'safe', start: cursor, end: lineEnd});

        // 경계 내에 있는 유효한 세그먼트만 반환합니다.
        return allSegments
            .map((seg) => ({
                ...seg,
                start: Math.max(lineStart, seg.start),
                end: Math.min(lineEnd, seg.end),
            }))
            .filter((seg) => seg.end > seg.start);
    }

    /**
     * 단일 도형의 윤곽선 경로를 기하학적 세그먼트 배열로 생성합니다.
     * @param shape 윤곽선을 생성할 도형
     * @returns { start: Point; end: Point }[] 형태의 경로 세그먼트 배열
     */
    private generateOutlineSegments(shape: AnyNodeConfig): { start: Point; end: Point }[] {
        const segments: { start: Point; end: Point }[] = [];
        const passes = shape.outlinePasses ?? 1;
        const baseInterval = shape.outlineInterval ?? 0;

        if (passes <= 0) return [];

        // 지정된 횟수(passes)만큼 반복
        for (let i = 0; i < passes; i++) {
            const currentInterval = baseInterval * i;

            //  maskClearance를 기본 오프셋으로 추가
            const totalOffset = this.maskClearance + currentInterval;

            if (shape.type === 'rectangle' || shape.type === 'image') {
                //  currentInterval 대신 totalOffset 사용
                const x = (shape.x ?? 0) - totalOffset;
                const y = (shape.y ?? 0) - totalOffset;
                const width = (shape.width ?? 0) + totalOffset * 2;
                const height = (shape.height ?? 0) + totalOffset * 2;

                const corners = [
                    { x: x, y: y },
                    { x: x + width, y: y },
                    { x: x + width, y: y + height },
                    { x: x, y: y + height },
                ];

                // 사각형의 각 변을 세그먼트로 추가
                segments.push({ start: corners[0], end: corners[1] });
                segments.push({ start: corners[1], end: corners[2] });
                segments.push({ start: corners[2], end: corners[3] });
                segments.push({ start: corners[3], end: corners[0] });

            } else if (shape.type === 'circle' && shape.radius) {
                const centerX = shape.x ?? 0;
                const centerY = shape.y ?? 0;

                // ✅ 수정된 부분: currentInterval 대신 totalOffset 사용
                const radius = shape.radius + totalOffset;
                const numSegments = 180; // 원을 근사화할 세그먼트 수

                let lastPoint = {
                    x: centerX + radius * Math.cos(0),
                    y: centerY + radius * Math.sin(0),
                };

                for (let j = 1; j <= numSegments; j++) {
                    const angle = (j / numSegments) * 2 * Math.PI;
                    const nextPoint = {
                        x: centerX + radius * Math.cos(angle),
                        y: centerY + radius * Math.sin(angle),
                    };
                    segments.push({ start: lastPoint, end: nextPoint });
                    lastPoint = nextPoint;
                }
            }
        }
        return segments;
    }

    /**
     * 두 점 사이의 선분이 원과 교차하는지 확인하는 함수
     * @param p1 선분 시작점
     * @param p2 선분 끝점
     * @param circleCenter 원 중심
     * @param radius 원 반지름
     */
    private lineIntersectsCircle(p1: Point, p2: Point, circleCenter: Point, radius: number): boolean {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const fx = p1.x - circleCenter.x;
        const fy = p1.y - circleCenter.y;

        const a = dx * dx + dy * dy;
        const b = 2 * (fx * dx + fy * dy);
        const c = (fx * fx + fy * fy) - radius * radius;

        let discriminant = b * b - 4 * a * c;
        if (discriminant < 0) {
            return false; // 교차점 없음
        }

        discriminant = Math.sqrt(discriminant);
        const t1 = (-b - discriminant) / (2 * a);
        const t2 = (-b + discriminant) / (2 * a);

        return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
    }

    /**
     * [신규] 두 점 사이의 선분이 사각형과 교차하는지 확인하는 함수 (Cohen-Sutherland 알고리즘 일부 사용)
     * @param p1 선분 시작점
     * @param p2 선분 끝점
     * @param rect 사각형 영역 { x, y, width, height }
     */
    private lineIntersectsRect(p1: Point, p2: Point, rect: { x: number, y: number, width: number, height: number }): boolean {
        // AABB (Axis-Aligned Bounding Box) 교차 검사
        const rectMinX = rect.x;
        const rectMaxX = rect.x + rect.width;
        const rectMinY = rect.y;
        const rectMaxY = rect.y + rect.height;

        // 선분의 바운딩 박스가 사각형과 겹치지 않으면 교차 없음
        if (Math.max(p1.x, p2.x) < rectMinX || Math.min(p1.x, p2.x) > rectMaxX ||
            Math.max(p1.y, p2.y) < rectMinY || Math.min(p1.y, p2.y) > rectMaxY) {
            return false;
        }

        // 간단한 선-선 교차 검사 (4개의 사각형 변과)
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;

        if (dx === 0 && dy === 0) return false; // 점인 경우

        // 각 변과 교차하는지 확인
        // Top, Bottom, Left, Right
        const boundaries = [
            { x1: rectMinX, y1: rectMaxY, x2: rectMaxX, y2: rectMaxY }, // Top
            { x1: rectMinX, y1: rectMinY, x2: rectMaxX, y2: rectMinY }, // Bottom
            { x1: rectMinX, y1: rectMinY, x2: rectMinX, y2: rectMaxY }, // Left
            { x1: rectMaxX, y1: rectMinY, x2: rectMaxX, y2: rectMaxY }, // Right
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


    /**
     * [신규] 주어진 경로가 마스킹 영역 중 하나라도 교차하는지 확인합니다.
     * @param start 경로 시작점
     * @param end 경로 끝점
     */
    private isPathIntersectingMask(start: Point, end: Point): boolean {
        if (!this.settings.enableMasking || this.maskShapes.length === 0) {
            return false;
        }

        for (const mask of this.maskShapes) {
            if (mask.type === 'rectangle') {
                const rect = {
                    x: (mask.x ?? 0) - this.maskClearance,
                    y: (mask.y ?? 0) - this.maskClearance,
                    width: (mask.width ?? 0) + this.maskClearance * 2,
                    height: (mask.height ?? 0) + this.maskClearance * 2,
                };
                if (this.lineIntersectsRect(start, end, rect)) return true;
            } else if (mask.type === 'circle' && mask.radius) {
                const center = { x: mask.x ?? 0, y: mask.y ?? 0 };
                const radius = mask.radius + this.maskClearance;
                if (this.lineIntersectsCircle(start, end, center, radius)) return true;
            }
        }
        return false;
    }

    /**
     * [신규] 충돌하는 모든 마스킹 도형의 배열을 반환합니다.
     * @param start 경로 시작점
     * @param end 경로 끝점
     * @returns 충돌하는 도형 배열
     */
    private findIntersectingMasks(start: Point, end: Point): AnyNodeConfig[] {
        if (!this.settings.enableMasking || this.maskShapes.length === 0) {
            return [];
        }
        const intersectingMasks: AnyNodeConfig[] = [];
        for (const mask of this.maskShapes) {
            let intersects = false;
            if (mask.type === 'rectangle') {
                const rect = {
                    x: (mask.x ?? 0) - this.maskClearance,
                    y: (mask.y ?? 0) - this.maskClearance,
                    width: (mask.width ?? 0) + this.maskClearance * 2,
                    height: (mask.height ?? 0) + this.maskClearance * 2,
                };
                if (this.lineIntersectsRect(start, end, rect)) intersects = true;
            } else if (mask.type === 'circle' && mask.radius) {
                const center = { x: mask.x ?? 0, y: mask.y ?? 0 };
                const radius = mask.radius + this.maskClearance;
                if (this.lineIntersectsCircle(start, end, center, radius)) intersects = true;
            }
            if (intersects) {
                intersectingMasks.push(mask);
            }
        }
        return intersectingMasks;
    }

    /**
     * [신규] 단일 장애물에 대한 최적의 우회 경로를 계획합니다.
     * @param start 시작점
     * @param end 끝점
     * @param obstacle 장애물 도형
     * @returns 우회 경로를 구성하는 점(Point)의 배열
     */
    private planDetourPath(start: Point, end: Point, obstacle: AnyNodeConfig): Point[] {
        const waypoints: Point[] = [];

        if (obstacle.type === 'rectangle') {
            const mx = (obstacle.x ?? 0) - this.maskClearance;
            const my = (obstacle.y ?? 0) - this.maskClearance;
            const mw = (obstacle.width ?? 0) + this.maskClearance * 2;
            const mh = (obstacle.height ?? 0) + this.maskClearance * 2;
            // 사각형의 네 꼭짓점을 웨이포인트 후보로 설정
            const corners = [
                { x: mx, y: my },          // 0: Bottom-Left
                { x: mx + mw, y: my },      // 1: Bottom-Right
                { x: mx + mw, y: my + mh }, // 2: Top-Right
                { x: mx, y: my + mh },      // 3: Top-Left
            ];

            // 시작점에서 가장 가까운 꼭짓점과 끝점에서 가장 가까운 꼭짓점을 찾음
            const findClosestCorner = (p: Point) => corners.reduce((prev, curr, idx) => {
                const dist = Math.hypot(p.x - curr.x, p.y - curr.y);
                return dist < prev.dist ? { idx, dist } : prev;
            }, { idx: -1, dist: Infinity });

            const startClosest = findClosestCorner(start);
            const endClosest = findClosestCorner(end);

            // 두 경로(시계방향, 반시계방향) 계산
            const path1: Point[] = [];
            const path2: Point[] = [];

            // 시계방향
            for (let i = startClosest.idx; i !== endClosest.idx; i = (i + 1) % 4) {
                path1.push(corners[i]);
            }
            path1.push(corners[endClosest.idx]);

            // 반시계방향
            for (let i = startClosest.idx; i !== endClosest.idx; i = (i + 3) % 4) {
                path2.push(corners[i]);
            }
            path2.push(corners[endClosest.idx]);

            // 두 경로의 총 길이를 계산하여 더 짧은 경로를 선택
            const calcPathLength = (points: Point[], s: Point, e: Point) => {
                if (points.length === 0) return Infinity;
                let len = Math.hypot(s.x - points[0].x, s.y - points[0].y);
                for(let i=0; i<points.length-1; i++) len += Math.hypot(points[i+1].x - points[i].x, points[i+1].y - points[i].y);
                len += Math.hypot(points[points.length-1].x - e.x, points[points.length-1].y - e.y);
                return len;
            }

            return calcPathLength(path1, start, end) < calcPathLength(path2, start, end) ? path1 : path2;
        }
        // TODO: 원(Circle) 장애물에 대한 우회 로직 추가 (필요 시)
        // 원은 꼭짓점이 없으므로 접선 또는 원주 위의 점들을 웨이포인트로 사용해야 함

        return [end]; // 사각형이 아닌 경우, 일단은 직접 이동
    }
    /**
     * [신규] 선분과 사각형 마스크의 교차 구간을 파라미터(t) 값으로 반환합니다. (0 <= t <= 1)
     * @returns [t_start, t_end] | null - 교차 구간 또는 null
     */
    private getLineRectIntersectionParams(
        p1: Point, p2: Point,
        mask: AnyNodeConfig
    ): [number, number] | null {
        const rect = {
            x: (mask.x ?? 0) - this.maskClearance,
            y: (mask.y ?? 0) - this.maskClearance,
            width: (mask.width ?? 0) + this.maskClearance * 2,
            height: (mask.height ?? 0) + this.maskClearance * 2,
        };

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        let t0 = 0.0;
        let t1 = 1.0;

        const check = (p: number, q: number): boolean => {
            if (p === 0) {
                if (q < 0) return false; // 선이 경계 바깥에 평행
                return true;
            }
            const r = q / p;
            if (p < 0) {
                if (r > t1) return false;
                if (r > t0) t0 = r;
            } else { // p > 0
                if (r < t0) return false;
                if (r < t1) t1 = r;
            }
            return true;
        };

        if (!check(-dx, p1.x - rect.x)) return null; // Left
        if (!check(dx, rect.x + rect.width - p1.x)) return null; // Right
        if (!check(-dy, p1.y - rect.y)) return null; // Bottom
        if (!check(dy, rect.y + rect.height - p1.y)) return null; // Top

        return (t0 > 0 || t1 < 1) ? [t0, t1] : null;
    }

    /**
     * [신규] 선분과 원 마스크의 교차 구간을 파라미터(t) 값으로 반환합니다.
     * @returns [t_start, t_end] | null - 교차 구간 또는 null
     */
    private getLineCircleIntersectionParams(
        p1: Point, p2: Point,
        mask: AnyNodeConfig
    ): [number, number] | null {
        if (typeof mask.x !== 'number' || typeof mask.y !== 'number' || typeof mask.radius !== 'number') return null;

        const center = { x: mask.x, y: mask.y };
        const radius = mask.radius + this.maskClearance;
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
     * [신규] 단일 경로 세그먼트를 마스크와 교차하는 부분을 기준으로 잘라냅니다.
     * @param segment 마스킹을 적용할 원본 경로 세그먼트
     * @returns 마스킹이 적용되어 잘라진 안전한 경로 세그먼트들의 배열
     */
    private splitSegmentByMasks(segment: { start: Point; end: Point }): { start: Point; end: Point }[] {
        if (!this.settings.enableMasking || this.maskShapes.length === 0) {
            return [segment]; // 마스킹 비활성화 시 원본 반환
        }

        const unsafeIntervals: { start: number; end: number }[] = [];

        // 1. 모든 마스크와의 교차 구간(t값 기준)을 찾습니다.
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
            return [segment]; // 교차하는 마스크가 없음
        }

        // 2. 겹치는 위험 구간들을 하나로 합칩니다.
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

        // 3. 위험 구간을 제외한 나머지 안전한 구간들로 새로운 세그먼트를 만듭니다.
        const safeSegments: { start: Point; end: Point }[] = [];
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
            const p2 = segment.end; // t = 1.0
            if (Math.hypot(p2.x - p1.x, p2.y - p1.y) > 0.01) safeSegments.push({ start: p1, end: p2 });
        }

        return safeSegments;
    }
}

/**
 * generateCoatingGCode 함수 - async/await 지원
 */
export async function generateCoatingGCode(
    shapes: AnyNodeConfig[],
    settings: GcodeSettings,
    onProgress?: ProgressCallback
): Promise<string> {
    const emitter = new GCodeEmitter(settings);
    const pathGenerator = new PathGenerator(settings, shapes);

    // await 키워드 추가
    await pathGenerator.generatePaths(emitter, onProgress);

    return emitter.getGCode();
}

/**
 * 스니펫 합성 유틸 & 통합 함수
 */
// G-code 템플릿 변수 타입
type Vars = {
    unit: 'mm' | 'inch';
    workArea: { width: number; height: number };
    safeHeight?: number;
    time?: string;
    pathIndex?: number;
    pathCount?: number;
    shapeName?: string;
    shapeType?: string;
    [k: string]: any;
};

// G-code 템플릿 문자열을 변수 값으로 렌더링하는 유틸 함수
function renderTemplate(tpl: string, vars: Vars): string {
    if (!tpl) return '';
    return tpl.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*}}/g, (_m, key) => {
        const v = key.split('.').reduce<any>((acc, k) => (acc ? acc[k] : undefined), vars);
        return v === undefined || v === null ? '' : String(v);
    });
}

// G-code 스니펫을 후크(hook)에 따라 필터링하고 조합하는 함수
function emit(snippets: GCodeSnippet[], hook: GCodeHook, vars: Vars): string {
    return (
        snippets
            // 활성화되고 해당 후크에 맞는 스니펫만 필터링
            .filter((s) => s.enabled && s.hook === hook)
            // 순서(order)에 따라 정렬
            .sort((a, b) => a.order - b.order)
            // 템플릿을 렌더링하고 공백 제거
            .map((s) => renderTemplate(s.template, vars).trim())
            // 빈 문자열 제거
            .filter(Boolean)
            .join('\n') + (hook ? '\n' : '') // 후크가 있을 경우 마지막에 줄바꿈 추가
    );
}

/**
 * 전역에 저장된 G-code 스니펫을 코팅 바디에 합쳐 최종 G-code를 반환합니다.
 * @param shapes 코팅할 도형
 * @param settings G-code 설정
 * @param snippets G-code 스니펫 목록
 * @param onProgress onProgress 진행 상황을 알리는 콜백 함수 (선택 사항)
 * @returns 최종 G-code 문자열
 */
export async function generateCoatingGCodeWithSnippets(
    shapes: AnyNodeConfig[],
    settings: GcodeSettings,
    snippets: GCodeSnippet[],
    onProgress?: ProgressCallback
): Promise<string> {
    try {
        console.log('G-code 생성 시작:', {
            shapesCount: shapes.length,
            fillPattern: settings.fillPattern,
            lineSpacing: settings.lineSpacing
        });

        // 1) 코팅 바디 G-code만 생성 (await 추가)
        const body = await generateCoatingGCode(shapes, settings, onProgress);

        if (!body || body.trim().length === 0) {
            throw new Error('G-code 바디가 생성되지 않았습니다. 도형과 설정을 확인해주세요.');
        }

        // 2) 스니펫과 조합
        const baseVars: Vars = {
            unit: (settings.unit as any) ?? 'mm',
            workArea: settings.workArea,
            safeHeight: settings.safeHeight,
            time: new Date().toISOString(),
        };

        let out = '';
        out += emit(snippets, 'beforeAll', baseVars);
        // out += emit(snippets, 'beforeJob', baseVars);

        const pathVars: Vars = {
            ...baseVars,
            pathIndex: 1,
            pathCount: 1,
            shapeName: 'Coating',
            shapeType: 'coating'
        };
        out += emit(snippets, 'beforePath', pathVars);
        out += body.trim() + '\n';
        out += emit(snippets, 'afterPath', pathVars);
        // out += emit(snippets, 'afterJob', baseVars);
        out += emit(snippets, 'afterAll', baseVars);

        const result = out.trimEnd() + '\n';
        console.log('G-code 생성 완료, 길이:', result.length);

        return result;

    } catch (error) {
        console.error('G-code 생성 중 오류:', error);
        throw new Error(`G-code 생성 실패: ${error.message || '알 수 없는 오류'}`);
    }
}