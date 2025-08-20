// types/gcode-path.ts
export interface PathSegment {
    id: string;
    start: { x: number; y: number };
    end: { x: number; y: number };
    type: 'G0' | 'G1'; // 이동 vs 코팅
    speed?: number;
    originalLine?: number; // 원본 G-code 라인 번호
}

export interface PathGroup {
    id: string;
    name: string;
    segments: PathSegment[];
    visible: boolean;
    locked: boolean;
}