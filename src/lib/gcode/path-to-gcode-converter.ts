import { PathGroup, PathSegment } from '@/types/gcode-path';
import { GcodeSettings } from '@/types/gcode';

/**
 * 편집된 PathSegment들을 G-Code로 변환하는 클래스
 */
export class PathToGcodeConverter {
    private settings: GcodeSettings;

    constructor(settings: GcodeSettings) {
        this.settings = settings;
    }

    /**
     * PathGroup들을 G-Code 문자열로 변환
     */
    convertToGCode(pathGroups: PathGroup[]): string {
        const lines: string[] = [];

        // 헤더 추가
        lines.push('; Generated from Path Editor');
        lines.push('; Units: ' + (this.settings.unit || 'mm'));
        lines.push('');

        // 초기 설정
        lines.push(`G21 ; Set units to millimeters`);
        lines.push(`G90 ; Absolute positioning`);
        lines.push(`G94 ; Feed rate per minute`);
        lines.push(`G17 ; XY plane selection`);
        lines.push('');

        // 안전 높이로 이동
        lines.push(`G0 Z${this.settings.safeHeight} ; Move to safe height`);
        lines.push('');

        // 각 그룹 처리
        const visibleGroups = pathGroups
            .filter(group => group.visible)
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        for (const group of visibleGroups) {
            if (group.segments.length === 0) continue;

            lines.push(`; === ${group.name} ===`);

            // 첫 번째 세그먼트 시작점으로 빠르게 이동
            const firstSegment = group.segments[0];
            lines.push(`G0 X${firstSegment.start.x.toFixed(3)} Y${firstSegment.start.y.toFixed(3)} ; Move to start`);

            // 코팅 높이로 하강 (첫 세그먼트가 G1인 경우)
            if (firstSegment.type === 'G1') {
                const zHeight = firstSegment.z ?? this.settings.coatingHeight;
                lines.push(`G1 Z${zHeight.toFixed(3)} F${this.settings.plungeRate} ; Lower to coating height`);
            }

            // 각 세그먼트 처리
            for (let i = 0; i < group.segments.length; i++) {
                const segment = group.segments[i];
                const gcodeLine = this.convertSegmentToGCode(segment, i === 0);
                lines.push(gcodeLine);
            }

            // 안전 높이로 복귀
            lines.push(`G0 Z${this.settings.safeHeight} ; Return to safe height`);
            lines.push('');
        }

        // 마무리
        lines.push(`G0 X0 Y0 ; Return to origin`);
        lines.push(`M30 ; Program end`);

        return lines.join('\n');
    }

    /**
     * 단일 PathSegment를 G-Code 라인으로 변환
     */
    private convertSegmentToGCode(segment: PathSegment, isFirst: boolean): string {
        const { end, type, feedRate, z, comment } = segment;

        let line = `${type} X${end.x.toFixed(3)} Y${end.y.toFixed(3)}`;

        // Z 좌표 추가 (필요한 경우)
        if (z !== undefined) {
            line += ` Z${z.toFixed(3)}`;
        }

        // 이송 속도 추가
        if (feedRate !== undefined) {
            line += ` F${feedRate}`;
        }

        // 주석 추가
        if (comment) {
            line += ` ; ${comment}`;
        }

        return line;
    }

    /**
     * 경로 최적화 (선택적)
     */
    optimizePaths(pathGroups: PathGroup[]): PathGroup[] {
        // 간단한 최적화: 연속된 같은 타입의 세그먼트들을 병합
        return pathGroups.map(group => ({
            ...group,
            segments: this.optimizeSegments(group.segments)
        }));
    }

    /**
     * 세그먼트 최적화
     */
    private optimizeSegments(segments: PathSegment[]): PathSegment[] {
        if (segments.length <= 1) return segments;

        const optimized: PathSegment[] = [];
        let currentSegment = segments[0];

        for (let i = 1; i < segments.length; i++) {
            const nextSegment = segments[i];

            // 같은 타입이고 연결되어 있으면 병합 가능한지 확인
            if (this.canMergeSegments(currentSegment, nextSegment)) {
                currentSegment = this.mergeSegments(currentSegment, nextSegment);
            } else {
                optimized.push(currentSegment);
                currentSegment = nextSegment;
            }
        }

        optimized.push(currentSegment);
        return optimized;
    }

    /**
     * 두 세그먼트가 병합 가능한지 확인
     */
    private canMergeSegments(seg1: PathSegment, seg2: PathSegment): boolean {
        // 같은 타입이고, 첫 번째 세그먼트의 끝점이 두 번째 세그먼트의 시작점과 일치
        return seg1.type === seg2.type &&
               Math.abs(seg1.end.x - seg2.start.x) < 0.001 &&
               Math.abs(seg1.end.y - seg2.start.y) < 0.001;
    }

    /**
     * 두 세그먼트 병합
     */
    private mergeSegments(seg1: PathSegment, seg2: PathSegment): PathSegment {
        return {
            ...seg1,
            end: seg2.end,
            comment: `${seg1.comment || ''} + ${seg2.comment || ''}`.trim()
        };
    }
}