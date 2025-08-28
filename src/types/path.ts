
// types/path.ts
import {Point} from "@/lib/gcode/point";

export interface PathSegment {
    id: string;
    // 상대 좌표로 변경 (shape 기준)
    start: Point;
    end: Point;
    type: 'G0' | 'G1';
    speed?: number;
    originalLine?: number;
    feedRate?: number;
    comment?: string;
}

export interface PathGroup {
    id: string;
    name: string;
    segments: PathSegment[];
    visible: boolean;
    locked: boolean;
    color?: string;
    order?: number;

    // Shape 연결 정보 추가
    sourceShapeId?: string;  // 연결된 shape ID
    isRelative: boolean;     // 상대 좌표 여부
    baseTransform?: {        // 생성 시점의 shape 변환 정보
        x: number;
        y: number;
        rotation: number;
        scaleX: number;
        scaleY: number;
    };
}