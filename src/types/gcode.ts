
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
