export type ToolType =
// Shape 모드 도구들
    | 'select'
    | 'rectangle'
    | 'circle'
    // Path 모드 도구들
    | 'path-pen'        // 펜 도구 (베지어 곡선)
    | 'path-line'       // 직선 도구
    | 'path-select'     // 패스 선택 도구
    | 'path-node'       // 노드 편집 도구
    ;

export type CoatingType = 'fill' | 'outline' | 'masking';

// 워크스페이스 모드별 사용 가능한 도구들
export const SHAPE_TOOLS: ToolType[] = ['select', 'rectangle', 'circle'];
export const PATH_TOOLS: ToolType[] = ['path-pen', 'path-line', 'path-select', 'path-node'];

// 기본 도구 (모드별)
export const DEFAULT_TOOLS: Record<'shape' | 'path', ToolType> = {
    shape: 'select',
    path: 'path-select'
};