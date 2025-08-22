import { GcodeSettings } from '@/types/gcode';
import { AnyNodeConfig } from '@/types/custom-konva-config';
import { Point } from '@/lib/gcode/point';
import { ProgressCallback } from '@/lib/gcode/progress-callback';
import { GCodeEmitter } from '@/lib/gcode/gcode-emitter';

/**
 * 개별 도형의 코팅 높이를 계산합니다.
 */
function getCoatingHeight(shape: AnyNodeConfig, settings: GcodeSettings): number {
    if (typeof shape.coatingHeight === 'number') {
        return shape.coatingHeight;
    }
    return settings.coatingHeight;
}

/**
 * 개별 도형의 코팅 속도를 계산합니다.
 */
function getCoatingSpeed(shape: AnyNodeConfig, settings: GcodeSettings): number {
    if (typeof shape.coatingSpeed === 'number') {
        return shape.coatingSpeed;
    }
    return settings.coatingSpeed;
}

/**
 * 경로 그룹화, 순서 최적화, 이동 경로 회피를 담당하는 클래스
 */
export class PathOptimizer {
    private readonly settings: GcodeSettings;
    private readonly maskShapes: AnyNodeConfig[];

    constructor(settings: GcodeSettings, maskShapes: AnyNodeConfig[]) {
        this.settings = settings;
        this.maskShapes = maskShapes;
    }

    /**
     * 최종 경로들을 받아 최적화된 G-code 명령 생성
     */
    public async optimizeAndEmit(
        segments: { start: Point; end: Point }[],
        emitter: GCodeEmitter,
        coatingShape: AnyNodeConfig,
        onProgress?: ProgressCallback
    ): Promise<void> {
        if (segments.length === 0) return;

        // 1. 클러스터링
        const zones = this.clusterSegmentsWithKMeans(segments, 5, 5);

        const shapeTypeLabel = coatingShape.type === 'image' ? 'PCB' : coatingShape.type.toUpperCase();
        emitter.addLine(`; ---- ${shapeTypeLabel} ${coatingShape.name ?? 'unknown'} start ----`);
        const shapeCoatingZ = getCoatingHeight(coatingShape, this.settings);

        // 2. 동적 영역 순회 및 G-code 생성
        let currentLocation = emitter.getCurrentPosition();
        const unvisitedZones = new Set(zones.filter(z => z.length > 0));
        let processedZoneCount = 0;
        const totalActiveZones = unvisitedZones.size;

        while (unvisitedZones.size > 0) {
            // 현재 위치에서 가장 가까운 진입점과 영역을 찾습니다.
            let bestNextZone: { start: Point; end: Point }[] | null = null;
            let closestEntryPoint: Point | null = null;
            let closestDistance = Infinity;

            for (const zone of unvisitedZones) {
                for (const segment of zone) {
                    const distToStart = Math.hypot(currentLocation.x - segment.start.x, currentLocation.y - segment.start.y);
                    if (distToStart < closestDistance) {
                        closestDistance = distToStart;
                        bestNextZone = zone;
                        closestEntryPoint = segment.start;
                    }
                    const distToEnd = Math.hypot(currentLocation.x - segment.end.x, currentLocation.y - segment.end.y);
                    if (distToEnd < closestDistance) {
                        closestDistance = distToEnd;
                        bestNextZone = zone;
                        closestEntryPoint = segment.end;
                    }
                }
            }

            if (bestNextZone && closestEntryPoint) {
                const intersectedMasks = this.findIntersectingMasks(currentLocation, closestEntryPoint);

                // 충돌이 없으면 직접 이동
                if (intersectedMasks.length === 0) {
                    emitter.travelTo(closestEntryPoint.x, closestEntryPoint.y);
                } else {
                    // 충돌 시 회피 전략에 따라 분기
                    const avoidanceStrategy = this.getEffectiveAvoidanceStrategy(intersectedMasks);
                    emitter.addLine(`; [INFO] Mask collision detected. Strategy: ${avoidanceStrategy}`);

                    if (avoidanceStrategy === 'contour' && intersectedMasks.length === 1) {
                        const detourPath = this.planDetourPath(currentLocation, closestEntryPoint, intersectedMasks[0]);
                        emitter.addLine(`; [INFO] Detouring around ${intersectedMasks[0].name} via ${detourPath.length} waypoints.`);

                        for (const waypoint of detourPath) {
                            emitter.travelTo(waypoint.x, waypoint.y);
                        }
                        emitter.travelTo(closestEntryPoint.x, closestEntryPoint.y);
                    } else {
                        emitter.addLine(`; [INFO] Falling back to Z-Lift maneuver.`);
                        emitter.setZ(this.settings.safeHeight);
                        emitter.travelTo(closestEntryPoint.x, closestEntryPoint.y);
                    }
                }

                // 코팅 시작 전 Z축 높이 설정
                emitter.setCoatingZ(shapeCoatingZ);

                // 개별 코팅 속도 적용
                const shapeCoatingSpeed = getCoatingSpeed(coatingShape, this.settings);

                const orderedPath = await this.findPathWithinZoneAsync(bestNextZone, closestEntryPoint);

                for (const segment of orderedPath) {
                    if (Math.abs(emitter.getCurrentPosition().x - segment.start.x) > 0.01 ||
                        Math.abs(emitter.getCurrentPosition().y - segment.start.y) > 0.01) {
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
                    const progress = 20 + (processedZoneCount / totalActiveZones) * 70;
                    onProgress(progress, `${shapeTypeLabel} - 영역 ${processedZoneCount}/${totalActiveZones} 처리 완료...`);
                }
            } else {
                break;
            }

            // UI 업데이트 양보
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        // 다음 코팅 도형으로 넘어가기 전 들어올리기
        emitter.setZ(this.settings.safeHeight);
        emitter.addLine(`; ---- ${shapeTypeLabel} ${coatingShape.name ?? 'unknown'} end ----`);
    }

    /**
     * 여러 마스크가 충돌할 때 효과적인 회피 전략을 결정합니다.
     */
    private getEffectiveAvoidanceStrategy(intersectedMasks: AnyNodeConfig[]): 'lift' | 'contour' {
        // 단일 마스크인 경우 해당 마스크의 개별 설정 확인
        if (intersectedMasks.length === 1) {
            const mask = intersectedMasks[0];
            if (mask.coatingType === 'masking' && mask.avoidanceStrategy) {
                return mask.avoidanceStrategy;
            }
        }

        // 여러 마스크가 충돌하거나 개별 설정이 없는 경우 전역 설정 사용
        return this.settings.travelAvoidanceStrategy;
    }

    /**
     * K-Means 알고리즘을 사용한 세그먼트 클러스터링
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

        // k개의 중심점을 무작위로 초기화
        let centroids = segmentMidpoints.slice(0, k);
        let assignments: number[] = [];

        for (let iter = 0; iter < maxIterations; iter++) {
            // 할당 단계
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

            // 업데이트 단계
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
                    newCentroids[i] = centroids[i];
                }
            }

            // 조기 종료 조건
            const centroidShift = centroids.reduce((sum, c, i) =>
                sum + Math.hypot(c.x - newCentroids[i].x, c.y - newCentroids[i].y), 0);
            if (centroidShift < 0.01) break;

            centroids = newCentroids;
        }

        // 최종 그룹화
        const zones: { start: Point; end: Point }[][] = Array(k).fill(0).map(() => []);
        for (let i = 0; i < segments.length; i++) {
            const clusterIndex = assignments[i];
            zones[clusterIndex].push(segments[i]);
        }

        return zones;
    }

    /**
     * 비동기 경로 최적화
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
     * 단일 장애물에 대한 최적의 우회 경로를 계획합니다.
     */
    private planDetourPath(start: Point, end: Point, obstacle: AnyNodeConfig): Point[] {
        if (obstacle.type === 'rectangle') {
            const maskClearance = this.getMaskClearance(obstacle);
            const mx = (obstacle.x ?? 0) - maskClearance;
            const my = (obstacle.y ?? 0) - maskClearance;
            const mw = (obstacle.width ?? 0) + maskClearance * 2;
            const mh = (obstacle.height ?? 0) + maskClearance * 2;

            const corners = [
                { x: mx, y: my },
                { x: mx + mw, y: my },
                { x: mx + mw, y: my + mh },
                { x: mx, y: my + mh },
            ];

            const findClosestCorner = (p: Point) => corners.reduce((prev, curr, idx) => {
                const dist = Math.hypot(p.x - curr.x, p.y - curr.y);
                return dist < prev.dist ? { idx, dist } : prev;
            }, { idx: -1, dist: Infinity });

            const startClosest = findClosestCorner(start);
            const endClosest = findClosestCorner(end);

            // 시계방향과 반시계방향 경로 계산
            const path1: Point[] = [];
            const path2: Point[] = [];

            for (let i = startClosest.idx; i !== endClosest.idx; i = (i + 1) % 4) {
                path1.push(corners[i]);
            }
            path1.push(corners[endClosest.idx]);

            for (let i = startClosest.idx; i !== endClosest.idx; i = (i + 3) % 4) {
                path2.push(corners[i]);
            }
            path2.push(corners[endClosest.idx]);

            // 더 짧은 경로 선택
            const calcPathLength = (points: Point[], s: Point, e: Point) => {
                if (points.length === 0) return Infinity;
                let len = Math.hypot(s.x - points[0].x, s.y - points[0].y);
                for (let i = 0; i < points.length - 1; i++) {
                    len += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
                }
                len += Math.hypot(points[points.length - 1].x - e.x, points[points.length - 1].y - e.y);
                return len;
            };

            return calcPathLength(path1, start, end) < calcPathLength(path2, start, end) ? path1 : path2;
        }

        return [end]; // 사각형이 아닌 경우 직접 이동
    }

    /**
     * 충돌하는 모든 마스킹 도형의 배열을 반환합니다.
     */
    private findIntersectingMasks(start: Point, end: Point): AnyNodeConfig[] {
        if (!this.settings.enableMasking || this.maskShapes.length === 0) {
            return [];
        }

        const intersectingMasks: AnyNodeConfig[] = [];
        for (const mask of this.maskShapes) {
            let intersects = false;
            if (mask.type === 'rectangle') {
                const clearance = this.getMaskClearance(mask);
                const rect = {
                    x: (mask.x ?? 0) - clearance,
                    y: (mask.y ?? 0) - clearance,
                    width: (mask.width ?? 0) + clearance * 2,
                    height: (mask.height ?? 0) + clearance * 2,
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

    private getMaskClearance(mask: AnyNodeConfig): number {
        if (mask.coatingType === 'masking' && typeof mask.maskingClearance === 'number') {
            return mask.maskingClearance + this.settings.coatingWidth / 2;
        }
        return this.settings.maskingClearance + this.settings.coatingWidth / 2;
    }

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
}