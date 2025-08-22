
export type GCodeHook =
    | 'beforeAll'     // 전체 생성 시작 직전(파일 헤더 등)
    | 'beforeJob'     // 작업 시작(한 프로젝트/세션 단위)
    | 'beforePath'    // 각 경로/레이어/도형 시작 직전
    | 'afterPath'     // 각 경로/레이어/도형 종료 직후
    | 'afterJob'      // 작업 종료(복귀 동작 등)
    | 'afterAll';     // 전체 생성 완료 직후(파일 푸터 등)

export const GCODE_HOOKS= [
    { value: "beforeAll", label: "전체 시작(beforeAll)" },
    { value: "beforeCoating", label: "작업 시작(beforeJob)" },
    { value: "beforePath", label: "경로 시작(beforePath)" },
    { value: "afterPath", label: "경로 종료(afterPath)" },
    { value: "afterJob", label: "작업 종료(afterJob)" },
    { value: "afterAll", label: "전체 종료(afterAll)" },
];

export type GCodeSnippet = {
    id: string;
    name: string;
    hook: GCodeHook;
    enabled: boolean;
    order: number;        // 동일 hook 내 정렬 우선순위(낮을수록 먼저)
    template: string;     // G-code 텍스트(템플릿 변수 포함 가능)
    description?: string; // 메모
};

export type GCodeContextVars = {
    // 공통 컨텍스트
    unit: 'mm' | 'inch';
    workArea: { width: number; height: number };
    safeHeight?: number;
    tool?: string;
    time?: string;

    // 현재 경로/도형 컨텍스트(없을 수 있음)
    pathIndex?: number;
    pathCount?: number;
    shapeName?: string;
    shapeType?: string;

    // 사용자 정의
    [key: string]: any;
};

export interface GcodeSettings {
    // 코팅 관련 설정
    coatingWidth: number;        // 코팅 폭 (mm)
    lineSpacing: number;         // 라인 간격 (mm)
    coatingSpeed: number;        // 코팅 속도 (mm/min)
    moveSpeed: number;           // 이동 속도 (mm/min)

    // Z축 설정
    safeHeight: number;          // 안전 높이 (mm)
    coatingHeight: number;       // 코팅 높이 (mm)

    // 패턴 설정
    fillPattern: 'horizontal' | 'vertical' | 'auto';  // 채우기 패턴

    // 마스킹 설정
    enableMasking: boolean;      // 마스킹 사용 여부
    maskingClearance: number;    // 마스킹 여유 거리 (mm)

    // workArea: { width: number; height: number };
    travelAvoidanceStrategy: 'lift' | 'contour'; // 이동 회피 전략 추가
    unit?: 'mm';
}

export interface GCodeState {
    gcode: string;
    gcodePath: number[][];
    lastGenerated: number | null;
    isGenerating: boolean;
    // gcodeSettings: GcodeSettings;
}
