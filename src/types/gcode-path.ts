// types/gcode-path.ts
export interface PathSegment {
    id: string;
    start: { x: number; y: number };
    end: { x: number; y: number };
    type: 'G0' | 'G1'; // 이동 vs 코팅
    speed?: number;
    originalLine?: number; // 원본 G-code 라인 번호
    z?: number; // Z 높이 값
    feedRate?: number; // 이송 속도
    spindleSpeed?: number; // 스핀들 속도
    comment?: string; // 주석
}

export interface PathGroup {
    id: string;
    name: string;
    segments: PathSegment[];
    visible: boolean;
    locked: boolean;
    color?: string; // 시각화를 위한 색상
    order?: number; // 실행 순서
}

// 경로 편집을 위한 추가 타입들
export interface PathEditOperation {
    type: 'move' | 'add' | 'delete' | 'split' | 'merge';
    segmentIds: string[];
    data?: any;
}

export interface PathEditHistory {
    operations: PathEditOperation[];
    timestamp: number;
}