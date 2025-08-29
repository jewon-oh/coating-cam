
// types/path.ts
import {Point} from "@/lib/gcode/point";


// 단순한 경로 세그먼트 (G-code 관련 제거)
export interface PathSegment {
    id: string;
    start: Point;
    end: Point;
}

// 단순화된 PathGroup (G-code 관련 제거)
export interface PathGroup {
    id: string;
    name: string;
    segments: PathSegment[];
    visible: boolean;
    color?: string;
    order?: number;

    // Shape 연결 정보만 유지
    sourceShapeId?: string;  // 연결된 shape ID
}
