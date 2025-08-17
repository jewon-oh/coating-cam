
// G-code 생성 중 진행 상황을 알리는 콜백 타입
type ProgressCallback = (progress: number, message: string) => void;

// G-Code 생성에 필요한 커스텀 도형, 설정, 스니펫 타입들을 가져옵니다.
import { AnyNodeConfig } from '@/types/custom-konva-config';
import { GcodeSettings, GCodeSnippet, GCodeHook } from '@/types/gcode';

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
 * G-code 생성과 상태 추적을 전담하는 클래스
 * 현재 위치, 설정 등을 관리하며, G-code 명령어를 생성하고 추가합니다.
 */
class GCodeEmitter {
    // 생성된 G-code 문자열을 저장합니다.
    private gcode: string = '';
    // 마지막으로 이동한 위치를 추적하여 불필요한 이동 명령을 방지합니다.
    private lastPosition: Point = { x: 0, y: 0, z: 0 };
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
        this.lastPosition = { x, y, z: z ?? this.lastPosition.z };
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
        return { ...this.lastPosition };
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
    private readonly boundaryShapes: AnyNodeConfig[];
    // 마스킹을 위한 도형 (이미지 외의 도형)
    private readonly maskShapes: AnyNodeConfig[];
    // 마스킹 클리어런스 (코팅 폭의 절반과 마스킹 여유분 포함)
    private readonly maskClearance: number;

    constructor(settings: GcodeSettings, shapes: AnyNodeConfig[]) {
        this.settings = settings;
        // 도형들을 경계용과 마스킹용으로 나눕니다.
        this.boundaryShapes = shapes.filter((s): s is Extract<AnyNodeConfig, { type: 'image' }> => s.type === 'image');
        this.maskShapes = settings.enableMasking ? shapes.filter((s): s is Exclude<AnyNodeConfig, { type: 'image' }> => s.type !== 'image') : [];
        this.maskClearance = settings.maskingClearance + settings.coatingWidth / 2;
    }

    /**
     * G-code 경로를 생성하고 GCodeEmitter에 추가합니다.
     * @param emitter G-code를 생성할 Emitter 인스턴스
     * @param onProgress 진행 상황을 알리는 콜백 함수 (선택 사항)
     */
    /**
     * [개선된] G-code 경로를 생성하고 GCodeEmitter에 추가 (비동기 처리)
     */
    public async generatePaths(emitter: GCodeEmitter, onProgress?: ProgressCallback): Promise<void> {
        emitter.setZ(this.settings.safeHeight);

        try {
            if (onProgress) onProgress(5, '경로 분석 시작...');

            // 비동기로 안전 세그먼트 계산
            const allSafeSegments = await this.precalculateAllSafeSegmentsAsync(onProgress);

            console.log(`총 ${allSafeSegments.length}개의 안전 세그먼트 생성됨`);

            if (allSafeSegments.length === 0) {
                if (onProgress) onProgress(100, '생성할 경로가 없습니다');
                return;
            }

            if (onProgress) onProgress(30, '경로 그룹화 중...');

            const zones = this.clusterSegmentsIntoZones(allSafeSegments, 3, 3);
            const activeZones = zones.filter(zone => zone.length > 0);

            if (onProgress) onProgress(35, `${activeZones.length}개 활성 영역 생성`);

            // 각 영역 처리
            for (let i = 0; i < activeZones.length; i++) {
                const zone = activeZones[i];
                const zoneProgress = 35 + (i / activeZones.length) * 60;

                if (onProgress) {
                    onProgress(zoneProgress, `영역 ${i + 1}/${activeZones.length} 처리 중... (${zone.length}개 경로)`);
                }

                const zoneIndex = zones.indexOf(zone);
                emitter.addLine(`;(--- Processing Zone ${zoneIndex + 1}/${zones.length} ---)`);

                const startPoint = emitter.getCurrentPosition();
                const orderedPath = await this.findPathWithinZoneAsync(zone, startPoint);

                // G-code 생성
                for (const segment of orderedPath) {
                    emitter.travelTo(segment.start.x, segment.start.y);
                    emitter.setZ(this.settings.coatingHeight);
                    emitter.nozzleOn();
                    emitter.coatTo(segment.end.x, segment.end.y);
                    emitter.nozzleOff();
                    emitter.setZ(this.settings.safeHeight);
                }

                // UI 업데이트를 위한 양보
                if (i % 5 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }

            if (onProgress) onProgress(100, 'G-code 생성 완료');

        } catch (error) {
            console.error('경로 생성 중 오류:', error);
            if (onProgress) onProgress(0, `경로 생성 실패: ${error.message || '알 수 없는 오류'}`);
            throw error;
        }
    }

    /**
     * [새로 추가] 비동기 안전 세그먼트 계산
     */
    private async precalculateAllSafeSegmentsAsync(onProgress?: ProgressCallback): Promise<{ start: Point; end: Point }[]> {
        const segments: { start: Point; end: Point }[] = [];

        try {
            if (this.boundaryShapes.length === 0) {
                console.warn('경계 도형이 없습니다. 이미지 타입 도형을 추가해주세요.');
                return segments;
            }

            const directions: ('horizontal' | 'vertical')[] = [];
            if (this.settings.fillPattern === 'horizontal' || this.settings.fillPattern === 'both') {
                directions.push('horizontal');
            }
            if (this.settings.fillPattern === 'vertical' || this.settings.fillPattern === 'both') {
                directions.push('vertical');
            }

            if (directions.length === 0) {
                console.warn('채우기 패턴이 설정되지 않았습니다.');
                return segments;
            }

            const totalBoundaries = this.boundaryShapes.length;
            let processedBoundaries = 0;

            for (const boundary of this.boundaryShapes) {
                const by = boundary.y ?? 0;
                const bx = boundary.x ?? 0;
                const bw = boundary.width ?? 0;
                const bh = boundary.height ?? 0;

                console.log(`경계 도형 처리 중: x=${bx}, y=${by}, w=${bw}, h=${bh}`);

                for (const direction of directions) {
                    const isHorizontal = direction === 'horizontal';
                    const mainAxisStart = isHorizontal ? by : bx;
                    const mainAxisEnd = isHorizontal ? by + bh : bx + bw;

                    if (mainAxisStart >= mainAxisEnd) {
                        console.warn(`잘못된 경계 범위: start=${mainAxisStart}, end=${mainAxisEnd}`);
                        continue;
                    }

                    const totalLines = Math.ceil((mainAxisEnd - mainAxisStart) / this.settings.lineSpacing);
                    let processedLines = 0;

                    for (let mainAxis = mainAxisStart; mainAxis <= mainAxisEnd; mainAxis += this.settings.lineSpacing) {
                        const lineSegments = this.getLineSegments(mainAxis, direction, boundary);

                        for (const seg of lineSegments) {
                            if (seg.type === 'safe') {
                                const startPoint = isHorizontal
                                    ? { x: seg.start, y: mainAxis }
                                    : { x: mainAxis, y: seg.start };
                                const endPoint = isHorizontal
                                    ? { x: seg.end, y: mainAxis }
                                    : { x: mainAxis, y: seg.end };
                                segments.push({ start: startPoint, end: endPoint });
                            }
                        }

                        processedLines++;

                        // 진행률 업데이트 (5%~30% 구간)
                        if (onProgress && totalLines > 0 && processedLines % Math.max(1, Math.floor(totalLines / 10)) === 0) {
                            const boundaryProgress = (processedBoundaries / totalBoundaries);
                            const lineProgress = (processedLines / totalLines) / totalBoundaries;
                            const totalProgress = 5 + (boundaryProgress + lineProgress) * 25;
                            onProgress(Math.min(totalProgress, 30),
                                `경계 ${processedBoundaries + 1}/${totalBoundaries} 분석 중... (${segments.length}개 경로 발견)`);
                        }

                        // 주기적으로 UI 업데이트 기회 제공
                        if (processedLines % 50 === 0) {
                            await new Promise(resolve => setTimeout(resolve, 0));
                        }
                    }
                }

                processedBoundaries++;
                console.log(`경계 ${processedBoundaries}/${totalBoundaries} 완료, 현재 ${segments.length}개 세그먼트`);
            }

            console.log(`전체 ${segments.length}개의 안전 세그먼트 생성 완료`);
            return segments;

        } catch (error) {
            console.error('안전 세그먼트 계산 중 오류:', error);
            throw new Error(`경로 계산 실패: ${error.message || '알 수 없는 오류'}`);
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
                    orderedPath.push({ start: closestSegment.end, end: closestSegment.start });
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
     * 코팅할 모든 안전한 경로 세그먼트를 미리 계산합니다.
     * @returns { start: Point; end: Point }[] - 시작점과 끝점을 가진 세그먼트 배열
     */
    private precalculateAllSafeSegments(): { start: Point; end: Point }[] {
        const segments: { start: Point; end: Point }[] = [];
        const directions: ('horizontal' | 'vertical')[] = [];
        // 채우기 패턴에 따라 경로 방향을 결정합니다.
        if (this.settings.fillPattern === 'horizontal' || this.settings.fillPattern === 'both') directions.push('horizontal');
        if (this.settings.fillPattern === 'vertical' || this.settings.fillPattern === 'both') directions.push('vertical');

        for (const boundary of this.boundaryShapes) {
            // 경계 도형의 좌표와 크기를 가져옵니다.
            const by = boundary.y ?? 0;
            const bx = boundary.x ?? 0;
            const bw = boundary.width ?? 0;
            const bh = boundary.height ?? 0;

            for (const direction of directions) {
                const isHorizontal = direction === 'horizontal';
                // 주축(Main Axis)의 시작과 끝점을 계산합니다.
                const mainAxisStart = isHorizontal ? by : bx;
                const mainAxisEnd = isHorizontal ? by + bh : bx + bw;

                // 주축을 따라 선을 생성합니다. (라인 간격만큼 이동)
                for (let mainAxis = mainAxisStart; mainAxis <= mainAxisEnd; mainAxis += this.settings.lineSpacing) {
                    const lineSegments = this.getLineSegments(mainAxis, direction, boundary);
                    for (const seg of lineSegments) {
                        // 안전한(safe) 세그먼트만 추출합니다.
                        if (seg.type === 'safe') {
                            const startPoint = isHorizontal ? { x: seg.start, y: mainAxis } : { x: mainAxis, y: seg.start };
                            const endPoint = isHorizontal ? { x: seg.end, y: mainAxis } : { x: mainAxis, y: seg.end };
                            segments.push({ start: startPoint, end: endPoint });
                        }
                    }
                }
            }
        }
        return segments;
    }

    /**
     * 모든 세그먼트를 그리드 형태의 영역(zone)으로 클러스터링합니다.
     * @param segments 전체 세그먼트 배열
     * @param gridX X축 클러스터 개수
     * @param gridY Y축 클러스터 개수
     * @returns { start: Point; end: Point }[][] - 클러스터링된 세그먼트 배열
     */
    private clusterSegmentsIntoZones(
        segments: { start: Point; end: Point }[],
        gridX: number,
        gridY: number,
    ): { start: Point; end: Point }[][] {
        const zones: { start: Point; end: Point }[][] = Array(gridX * gridY)
            .fill(0)
            .map(() => []);
        const { width, height } = this.settings.workArea;
        const zoneWidth = width / gridX;
        const zoneHeight = height / gridY;

        for (const segment of segments) {
            // 세그먼트의 중간점을 기준으로 어떤 영역에 속하는지 계산합니다.
            const midPointX = (segment.start.x + segment.end.x) / 2;
            const midPointY = (segment.start.y + segment.end.y) / 2;
            const zoneCol = Math.floor(midPointX / zoneWidth);
            const zoneRow = Math.floor(midPointY / zoneHeight);
            // 인덱스를 계산하고, 범위를 벗어나지 않도록 보정합니다.
            const zoneIndex = Math.min(zoneRow * gridX + zoneCol, zones.length - 1);
            zones[zoneIndex].push(segment);
        }
        return zones;
    }

    /**
     * 특정 영역(zone) 내의 세그먼트들을 최적의 경로로 정렬합니다.
     * @param zone 정렬할 세그먼트가 담긴 영역
     * @param startPoint 시작 위치
     * @returns { start: Point; end: Point }[] - 정렬된 세그먼트 배열
     */
    private findPathWithinZone(
        zone: { start: Point; end: Point }[],
        startPoint: Point,
    ): { start: Point; end: Point }[] {
        if (zone.length === 0) return [];

        const remaining = new Set(zone); // 처리할 세그먼트 집합
        const orderedPath: { start: Point; end: Point }[] = [];
        let currentLocation = startPoint; // 현재 위치

        while (remaining.size > 0) {
            let closestSegment: { start: Point; end: Point } | null = null;
            let closestDistance = Infinity;
            let reversed = false; // 세그먼트 방향을 반전해야 하는지 여부

            // 현재 위치에서 가장 가까운 세그먼트를 찾습니다.
            for (const segment of remaining) {
                const distToStart = Math.hypot(currentLocation.x - segment.start.x, currentLocation.y - segment.start.y);
                const distToEnd = Math.hypot(currentLocation.x - segment.end.x, currentLocation.y - segment.end.y);

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

            // 가장 가까운 세그먼트가 있으면 순서대로 경로에 추가하고, 현재 위치를 업데이트합니다.
            if (closestSegment) {
                if (reversed) {
                    orderedPath.push({ start: closestSegment.end, end: closestSegment.start });
                    currentLocation = closestSegment.start;
                } else {
                    orderedPath.push(closestSegment);
                    currentLocation = closestSegment.end;
                }
                remaining.delete(closestSegment); // 처리된 세그먼트는 집합에서 제거
            }
        }
        return orderedPath;
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
        direction: 'horizontal' | 'vertical',
        boundary: AnyNodeConfig,
    ): PathSegment[] {
        const bx = boundary.x ?? 0;
        const by = boundary.y ?? 0;
        const bw = boundary.width ?? 0;
        const bh = boundary.height ?? 0;

        const { workArea } = this.settings;
        const isHorizontal = direction === 'horizontal';
        const lineStart = Math.max(isHorizontal ? bx : by, 0);
        const lineEnd = Math.min(isHorizontal ? bx + bw : by + bh, isHorizontal ? workArea.width : workArea.height);
        if (lineStart >= lineEnd) return [];

        // 마스킹 기능이 비활성화되어 있으면 전체 구간을 안전한 세그먼트로 반환
        if (!this.settings.enableMasking || this.maskShapes.length === 0) {
            return [{ type: 'safe', start: lineStart, end: lineEnd }];
        }

        // 마스킹 영역이 있는 경우, 안전한/위험한 구간을 계산
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
                    intersection = { start: centerCross - deltaCross, end: centerCross + deltaCross };
                }
            } else if (mask.type === 'rectangle') {
                const rectMinCross = isHorizontal ? mx : my;
                const rectMaxCross = isHorizontal ? mx + mw : my + mh;
                const rectMinMain = isHorizontal ? my : mx;
                const rectMaxMain = isHorizontal ? my + mh : mx + mw;
                if (mainAxis >= rectMinMain - this.maskClearance && mainAxis <= rectMaxMain + this.maskClearance) {
                    intersection = { start: rectMinCross - this.maskClearance, end: rectMaxCross + this.maskClearance };
                }
            }
            if (intersection) unsafeIntervals.push({ ...intersection, cause: mask });
        }

        if (unsafeIntervals.length === 0) return [{ type: 'safe', start: lineStart, end: lineEnd }];

        // 중첩된 위험 영역을 병합합니다.
        unsafeIntervals.sort((a, b) => a.start - b.start);
        const mergedUnsafe: { start: number; end: number; cause: AnyNodeConfig }[] = [];
        if (unsafeIntervals.length > 0) {
            let currentMerge = { ...unsafeIntervals[0] };
            for (let i = 1; i < unsafeIntervals.length; i++) {
                const next = unsafeIntervals[i];
                if (next.start < currentMerge.end) {
                    currentMerge.end = Math.max(currentMerge.end, next.end);
                } else {
                    mergedUnsafe.push(currentMerge);
                    currentMerge = { ...next };
                }
            }
            mergedUnsafe.push(currentMerge);
        }

        // 전체 라인을 안전/위험 세그먼트로 분리합니다.
        const allSegments: PathSegment[] = [];
        let cursor = lineStart;
        for (const unsafe of mergedUnsafe) {
            if (cursor < unsafe.start) allSegments.push({ type: 'safe', start: cursor, end: unsafe.start });
            allSegments.push({ type: 'unsafe', start: unsafe.start, end: unsafe.end, cause: unsafe.cause });
            cursor = unsafe.end;
        }
        if (cursor < lineEnd) allSegments.push({ type: 'safe', start: cursor, end: lineEnd });

        // 경계 내에 있는 유효한 세그먼트만 반환합니다.
        return allSegments
            .map((seg) => ({
                ...seg,
                start: Math.max(lineStart, seg.start),
                end: Math.min(lineEnd, seg.end),
            }))
            .filter((seg) => seg.end > seg.start);
    }
}

/**
 * [수정된] generateCoatingGCode 함수 - async/await 지원
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

// /**
//  * 바디 G-code만 생성하는 비동기 함수 (헤더/푸터 없음)
//  */
// export async function generateCoatingGCode(
//     shapes: AnyNodeConfig[],
//     settings: GcodeSettings,
//     onProgress?: ProgressCallback
// ): Promise<string> {
//     const emitter = new GCodeEmitter(settings);
//     const pathGenerator = new PathGenerator(settings, shapes);
//     pathGenerator.generatePaths(emitter,onProgress);
//     return emitter.getGCode();
// }

/* =========================
   스니펫 합성 유틸 & 통합 함수
   ========================= */

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
// export async function generateCoatingGCodeWithSnippets(
//     shapes: AnyNodeConfig[],
//     settings: GcodeSettings,
//     snippets: GCodeSnippet[],
//     onProgress?: ProgressCallback
// ): Promise<string> {
//     // 1) 코팅 바디 G-code만 생성
//     const body = await generateCoatingGCode(shapes, settings,onProgress);
//
//     // 2) 스니펫과 조합
//     const baseVars: Vars = {
//         unit: (settings.unit as any) ?? 'mm',
//         workArea: settings.workArea,
//         safeHeight: settings.safeHeight,
//         time: new Date().toISOString(),
//     };
//
//     let out = '';
//     // beforeAll 후크 스니펫 추가
//     out += emit(snippets, 'beforeAll', baseVars);
//     // beforeJob 후크 스니펫 추가
//     out += emit(snippets, 'beforeJob', baseVars);
//
//     // 단일 경로(코팅 작업)에 대한 변수 설정
//     const pathVars: Vars = { ...baseVars, pathIndex: 1, pathCount: 1, shapeName: 'Coating', shapeType: 'coating' };
//     // beforePath 후크 스니펫 추가
//     out += emit(snippets, 'beforePath', pathVars);
//     // 생성된 코팅 바디 G-code 추가
//     out += body.trim() + '\n';
//     // afterPath 후크 스니펫 추가
//     out += emit(snippets, 'afterPath', pathVars);
//
//     // afterJob 후크 스니펫 추가
//     out += emit(snippets, 'afterJob', baseVars);
//     // afterAll 후크 스니펫 추가
//     out += emit(snippets, 'afterAll', baseVars);
//
//     return out.trimEnd() + '\n';
// }