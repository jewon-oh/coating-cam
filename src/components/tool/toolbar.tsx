import {ToolButton} from "@/components/tool/tool-button";
import {
    Circle as CircleIcon,
    ImageUp,
    MousePointer2,
    RectangleHorizontal as RectangleHorizontalIcon,
    Redo,
    Undo,
    Grid as GridIcon,
    Magnet as MagnetIcon,
    Play,
    SquaresUnite,
    SquareX,
    Save,
    FolderOpen,
    MoveHorizontal,
    MoveVertical,
    PencilRuler,
    Shapes,
    Pen,
    Minus,
    Edit3,
    MousePointer
} from "lucide-react";
import React from "react";
import {useAppDispatch, useAppSelector} from "@/hooks/redux";
import {setCoatingType, setCoatingTypeAndFillPattern, setTool, setWorkspaceMode} from "@/store/slices/tool-slice";
import {useSettings} from '@/contexts/settings-context';
import {useProjectActions} from "@/hooks/project/use-project-actions";
import {useInsertImage} from "@/hooks/use-insert-image";
import {Card, CardContent} from "@/components/ui/card";
import {Separator} from "@/components/ui/separator";
import {redo, undo} from "@/store/slices/shape-history-slice";

interface ToolbarProps {
    onGenerateGCode: () => void;
}

export const Toolbar = ({ onGenerateGCode }: ToolbarProps) => {
    const dispatch = useAppDispatch();
    const { tool, coatingType, fillPattern, workspaceMode } = useAppSelector((state) => state.tool);
    const { past, future } = useAppSelector((state) => state.history);
    const { isGridVisible, setGridVisible, isSnappingEnabled, setSnappingEnabled } = useSettings();
    const { handleSaveProject, handleLoadProject } = useProjectActions();
    const { handleImageInsert } = useInsertImage();

    const canUndo = past.length > 0;
    const canRedo = future.length > 0;

    // 워크스페이스 모드 변경 핸들러
    const handleWorkspaceModeChange = (mode: 'shape' | 'path') => {
        dispatch(setWorkspaceMode(mode));
    };

    // 현재 모드에 따른 도구들 렌더링
    const renderShapeTools = () => (
        <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
                <ToolButton
                    icon={<MousePointer2 size={16}/>}
                    label="선택"
                    active={tool === 'select'}
                    onClick={() => dispatch(setTool('select'))}
                    className={tool === 'select' ? 'bg-primary/20 border border-primary/40' : ''}
                />
                <ToolButton
                    icon={<RectangleHorizontalIcon size={16}/>}
                    label="사각형"
                    active={tool === 'rectangle'}
                    onClick={() => dispatch(setTool('rectangle'))}
                    className={tool === 'rectangle' ? 'bg-primary/20 border border-primary/40' : ''}
                />
                <ToolButton
                    icon={<CircleIcon size={16}/>}
                    label="원"
                    active={tool === 'circle'}
                    onClick={() => dispatch(setTool('circle'))}
                    className={tool === 'circle' ? 'bg-primary/20 border border-primary/40' : ''}
                />
                <ToolButton
                    icon={<ImageUp size={16}/>}
                    label="이미지"
                    active={false}
                    onClick={handleImageInsert}
                />
            </div>
            <span className="text-xs mt-1 text-muted-foreground">Shape 도구</span>
        </div>
    );

    const renderPathTools = () => (
        <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
                <ToolButton
                    icon={<MousePointer size={16}/>}
                    label="선택"
                    active={tool === 'path-select'}
                    onClick={() => dispatch(setTool('path-select'))}
                    className={tool === 'path-select' ? 'bg-primary/20 border border-primary/40' : ''}
                />
                <ToolButton
                    icon={<Edit3 size={16}/>}
                    label="노드편집"
                    active={tool === 'path-node'}
                    onClick={() => dispatch(setTool('path-node'))}
                    className={tool === 'path-node' ? 'bg-primary/20 border border-primary/40' : ''}
                />
                <ToolButton
                    icon={<Pen size={16}/>}
                    label="펜"
                    active={tool === 'path-pen'}
                    onClick={() => dispatch(setTool('path-pen'))}
                    className={tool === 'path-pen' ? 'bg-primary/20 border border-primary/40' : ''}
                />
                <ToolButton
                    icon={<Minus size={16}/>}
                    label="직선"
                    active={tool === 'path-line'}
                    onClick={() => dispatch(setTool('path-line'))}
                    className={tool === 'path-line' ? 'bg-primary/20 border border-primary/40' : ''}
                />
            </div>
            <span className="text-xs mt-1 text-muted-foreground">Path 도구</span>
        </div>
    );

    return (
        <Card className="border-b border-t-0 border-l-0 border-r-0 p-0 rounded-none shadow-sm bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/95">
            <CardContent className="p-2">
                <div className="flex items-center justify-between">
                    {/* 왼쪽: 주요 도구들 */}
                    <div className="flex items-center gap-4">
                        {/* 워크스페이스 모드 */}
                        <div className="flex flex-col items-center">
                            <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
                                <ToolButton
                                    icon={<Shapes size={16}/>}
                                    label="Shape"
                                    active={workspaceMode === 'shape'}
                                    onClick={() => handleWorkspaceModeChange('shape')}
                                    className={workspaceMode === 'shape' ? 'bg-emerald-200 border border-emerald-400 hover:bg-emerald-300' : 'hover:bg-emerald-100'}
                                />
                                <ToolButton
                                    icon={<PencilRuler size={16}/>}
                                    label="Path"
                                    active={workspaceMode === 'path'}
                                    onClick={() => handleWorkspaceModeChange('path')}
                                    className={workspaceMode === 'path' ? 'bg-purple-200 border border-purple-400 hover:bg-purple-300' : 'hover:bg-purple-100'}
                                />
                            </div>
                            <span className="text-xs mt-1 text-muted-foreground">편집 모드</span>
                        </div>

                        <Separator orientation="vertical" className="h-8"/>

                        {/* 모드별 도구 그룹 */}
                        {workspaceMode === 'shape' ? renderShapeTools() : renderPathTools()}

                        {/* 코팅 타입 선택기 (Shape 모드에만 표시) */}
                        {workspaceMode === 'shape' && (
                            <>
                                <Separator orientation="vertical" className="h-8"/>
                                <div className="flex flex-col items-center">
                                    <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
                                        <ToolButton
                                            icon={<MoveHorizontal size={16}/>}
                                            label="수평채우기"
                                            active={coatingType === 'fill' && fillPattern === 'horizontal'}
                                            onClick={() => dispatch(setCoatingTypeAndFillPattern({coatingType:'fill',fillPattern: 'horizontal'}))}
                                            className={coatingType === 'fill' && fillPattern === 'horizontal' ? 'bg-sky-200 border border-sky-400 hover:bg-sky-300' : 'hover:bg-sky-100'}
                                        />
                                        <ToolButton
                                            icon={<MoveVertical size={16}/>}
                                            label="수직채우기"
                                            active={coatingType === 'fill' && fillPattern === 'vertical'}
                                            onClick={() => dispatch(setCoatingTypeAndFillPattern({coatingType:'fill',fillPattern: 'vertical'}))}
                                            className={coatingType === 'fill'&& fillPattern === 'vertical' ? 'bg-sky-200 border border-sky-400 hover:bg-sky-300' : 'hover:bg-sky-100'}
                                        />
                                        <ToolButton
                                            icon={<SquaresUnite size={16}/>}
                                            label="윤곽"
                                            active={coatingType === 'outline'}
                                            onClick={() => dispatch(setCoatingType('outline'))}
                                            className={coatingType === 'outline' ? 'bg-yellow-200 border border-yellow-400 hover:bg-yellow-300' : 'hover:bg-yellow-100'}
                                        />
                                        <ToolButton
                                            icon={<SquareX size={16}/>}
                                            label="마스킹"
                                            active={coatingType === 'masking'}
                                            onClick={() => dispatch(setCoatingType('masking'))}
                                            className={coatingType === 'masking' ? 'bg-red-200 border border-red-400 hover:bg-red-300' : 'hover:bg-red-100'}
                                        />
                                    </div>
                                    <span className="text-xs mt-1 text-muted-foreground">코팅 타입</span>
                                </div>
                            </>
                        )}

                        {/* Path 모드 전용 옵션들 */}
                        {workspaceMode === 'path' && (
                            <>
                                <Separator orientation="vertical" className="h-8"/>
                                <div className="flex flex-col items-center">
                                    <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
                                        {/* Path 관련 옵션들이 여기에 추가될 수 있습니다 */}
                                        <ToolButton
                                            icon={<div className="w-4 h-4 border border-current rounded-sm" />}
                                            label="Fill"
                                            active={false}
                                            onClick={() => {/* Path fill logic */}}
                                        />
                                        <ToolButton
                                            icon={<div className="w-4 h-4 border-2 border-current" />}
                                            label="Stroke"
                                            active={false}
                                            onClick={() => {/* Path stroke logic */}}
                                        />
                                    </div>
                                    <span className="text-xs mt-1 text-muted-foreground">Path 옵션</span>
                                </div>
                            </>
                        )}

                        <Separator orientation="vertical" className="h-8"/>

                        {/* 히스토리 컨트롤 */}
                        <div className="flex flex-col items-center">
                            <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
                                <ToolButton
                                    icon={<Undo size={16}/>}
                                    label="실행취소"
                                    onClick={() => dispatch(undo())}
                                    disabled={!canUndo}
                                />
                                <ToolButton
                                    icon={<Redo size={16}/>}
                                    label="다시실행"
                                    onClick={() => dispatch(redo())}
                                    disabled={!canRedo}
                                />
                            </div>
                            <span className="text-xs mt-1 text-muted-foreground">히스토리</span>
                        </div>

                        <Separator orientation="vertical" className="h-8"/>

                        {/* 뷰 컨트롤 */}
                        <div className="flex flex-col items-center">
                            <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
                                <ToolButton
                                    icon={<GridIcon size={16}/>}
                                    label="격자"
                                    active={isGridVisible}
                                    onClick={() => setGridVisible(!isGridVisible)}
                                    className={isGridVisible ? 'bg-primary/20 border border-primary/40' : ''}
                                />
                                <ToolButton
                                    icon={<MagnetIcon size={16}/>}
                                    label="스냅"
                                    active={isSnappingEnabled}
                                    onClick={() => setSnappingEnabled(!isSnappingEnabled)}
                                    className={isSnappingEnabled ? 'bg-primary/20 border border-primary/40' : ''}
                                />
                            </div>
                            <span className="text-xs mt-1 text-muted-foreground">뷰 옵션</span>
                        </div>
                    </div>

                    {/* 오른쪽: 프로젝트 관리 */}
                    <div className="flex flex-col items-center">
                        <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
                            <ToolButton
                                icon={<Save size={16}/>}
                                label="저장"
                                onClick={handleSaveProject}
                            />
                            <ToolButton
                                icon={<FolderOpen size={16}/>}
                                label="불러오기"
                                onClick={handleLoadProject}
                            />
                            <ToolButton
                                icon={<Play size={16}/>}
                                label="G-Code생성"
                                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md"
                                onClick={onGenerateGCode}
                            />
                        </div>
                        <span className="text-xs mt-1 text-muted-foreground">프로젝트</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default Toolbar;