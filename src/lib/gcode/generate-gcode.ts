// G-Code 생성에 필요한 커스텀 도형, 설정, 스니펫 타입들을 가져옵니다.
import {CustomShapeConfig} from '@/types/custom-konva-config';
import { GCodeSnippet, GCodeHook} from '@/types/gcode';
import {CoatingSettings} from "@/types/coating";
import {GCodeEmitter} from "@/lib/gcode/gcode-emitter";
import {GCodeGenerator} from "@/lib/gcode/g-code-generator";
import {ProgressCallback} from "@/lib/gcode/progress-callback";


/**
 * Generates G-code for coating based on the provided shapes, settings, and work area dimensions.
 *
 * @param {CustomShapeConfig[]} shapes - An array of shape configurations defining the geometry to be coated.
 * @param {CoatingSettings} settings - The G-code configuration settings for generation.
 * @param {{ width: number, height: number }} workArea - The dimensions of the work area to constrain the generated paths.
 * @param {ProgressCallback} [onProgress] - Optional callback function invoked to report progress during path generation.
 * @return {Promise<string>} A promise that resolves to the generated G-code as a string.
 */
export async function generateCoatingGCode(
    shapes: CustomShapeConfig[],
    settings: CoatingSettings,
    workArea: { width: number; height: number },
    onProgress?: ProgressCallback
): Promise<string> {
    const emitter = new GCodeEmitter(settings);
    const gCodeGenerator = new GCodeGenerator(settings, workArea,shapes);

    // await 키워드 추가
    await gCodeGenerator.generatePaths(emitter, onProgress);

    return emitter.getGCode();
}

/**
 * 스니펫 합성 유틸 & 통합 함수
 */
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
    [k: string]: any; // Allow any other properties
};

// G-code 템플릿 문자열을 변수 값으로 렌더링하는 유틸 함수
function renderTemplate(tpl: string, vars: Vars): string {
    if (!tpl) return '';
    return tpl.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*}}/g, (_m, key) => {
        // ✨ FIX: 'acc'와 'k' 파라미터에 명시적인 타입을 지정하여 TS7006 오류를 해결합니다.
        const v = key.split('.').reduce((acc: any, k: string) => (acc && typeof acc === 'object' ? acc[k] : undefined), vars);
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
 * @param workArea 작업 영역 (너비, 높이)
 * @param snippets G-code 스니펫 목록
 * @param onProgress onProgress 진행 상황을 알리는 콜백 함수 (선택 사항)
 * @returns 최종 G-code 문자열
 */
export async function generateGcode(
    shapes: CustomShapeConfig[],
    settings: CoatingSettings,
    workArea: { width: number; height: number },
    snippets: GCodeSnippet[],
    onProgress?: ProgressCallback
): Promise<string> {

    console.log('G-code 생성 시작:', {
        shapesCount: shapes.length,
        fillPattern: settings.fillPattern,
        lineSpacing: settings.lineSpacing
    });

    // 1) 코팅 바디 G-code만 생성 (await 추가)
    const body = await generateCoatingGCode(shapes, settings,workArea, onProgress);

    if (!body || body.trim().length === 0) {
        throw new Error('G-code 바디가 생성되지 않았습니다. 도형과 설정을 확인해주세요.');
    }

    // 2) 스니펫과 조합
    const baseVars: Vars = {
        unit: settings.unit ?? 'mm',
        workArea: workArea,
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
}
