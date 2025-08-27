// PathPoint 타입 정의 및 export
export type PathPoint = {
    pos: [number, number, number]; // [x,y,z]
    isG1: boolean;                 // true: G1, false: G0
    line: number;                  // 원본 G-code 라인 번호
};
