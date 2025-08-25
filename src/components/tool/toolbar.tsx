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
    Play, SquaresUnite, Columns4, SquareX, Save, FolderOpen, SaveIcon,
} from "lucide-react";
import React from "react";
import {useAppDispatch, useAppSelector} from "@/hooks/redux";
import {setDefaultCoatingType, setTool} from "@/store/slices/tool-slice";
import {useSettings} from '@/contexts/settings-context';
import {useProjectActions} from "@/hooks/project/use-project-actions";
import {useInsertImage} from "@/hooks/use-insert-image";
import {Card, CardContent} from "@/components/ui/card";
import {Separator} from "@/components/ui/separator";
import {Button} from "@/components/ui/button";


import {redoWithSync, undoWithSync} from "@/store/thunks/history-thunk";
import {ProjectMenu} from "@/components/tool/project-menu";
import {DropdownMenuItem} from "@/components/ui/dropdown-menu";

interface ToolbarProps {
    onGenerateGCode: () => void;
}

export const Toolbar = ({onGenerateGCode}: ToolbarProps) => {
    const dispatch = useAppDispatch();
    const { tool, defaultCoatingType } = useAppSelector((state) => state.tool);
    const {past, future} = useAppSelector((state) => state.history);
    const {isGridVisible, setGridVisible, isSnappingEnabled, setSnappingEnabled} = useSettings();
    const {handleSaveProject, handleLoadProject} = useProjectActions();
    const {handleImageInsert} = useInsertImage();

    const canUndo = past.length > 0;
    const canRedo = future.length > 0;

    return (
        <Card
            className="border-b border-t-0 border-l-0 border-r-0 p-0 rounded-none shadow-sm bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/95">
            <CardContent className="p-2">
                <div className="flex items-center justify-between">
                    {/* 왼쪽: 주요 도구들 */}
                    <div className="flex items-center gap-4 ">
                        <div className="flex flex-col items-center">
                            {/* 그리기 도구 그룹 */}
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
                            <span className="text-xs mt-1 text-muted-foreground">그리기 도구</span>
                        </div>


                        <Separator orientation="vertical" className="h-8"/>

                        {/* 히스토리 컨트롤 */}
                        <div className="flex flex-col items-center">
                            <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
                                <ToolButton
                                    icon={<Undo size={16}/>}
                                    label="실행취소"
                                    onClick={() => dispatch(undoWithSync())}
                                    disabled={!canUndo}
                                />
                                <ToolButton
                                    icon={<Redo size={16}/>}
                                    label="다시실행"
                                    onClick={() => dispatch(redoWithSync())}
                                    disabled={!canRedo}
                                />
                            </div>
                            <span className="text-xs mt-1 text-muted-foreground">히스토리</span>
                        </div>

                        <Separator orientation="vertical" className="h-8"/>

                        {/* 코팅 타입 선택기 */}
                        {/* 코팅 타입 선택 버튼들 */}
                        <div className="flex flex-col items-center">
                            <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
                                <ToolButton
                                    icon={<Columns4 size={16}/>}
                                    label="채우기"
                                    active={defaultCoatingType === 'fill'}
                                    onClick={() => dispatch(setDefaultCoatingType('fill'))}
                                    className={defaultCoatingType === 'fill' ? 'bg-sky-200 border border-sky-400 hover:bg-sky-300' : 'hover:bg-sky-100'}
                                />
                                <ToolButton
                                    icon={<SquaresUnite size={16}/>}
                                    label="윤곽"
                                    active={defaultCoatingType === 'outline'}
                                    onClick={() => dispatch(setDefaultCoatingType('outline'))}
                                    className={defaultCoatingType === 'outline' ? 'bg-yellow-200 border border-yellow-400 hover:bg-yellow-300' : 'hover:bg-yellow-100'}
                                />
                                <ToolButton
                                    icon={<SquareX size={16}/>}
                                    label="마스킹"
                                    active={defaultCoatingType === 'masking'}
                                    onClick={() => dispatch(setDefaultCoatingType('masking'))}
                                    className={defaultCoatingType === 'masking' ? 'bg-red-200 border border-red-400 hover:bg-red-300' : 'hover:bg-red-100'}
                                />
                            </div>
                            <span className="text-xs mt-1 text-muted-foreground">코팅 타입</span>
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


                    {/* 오른쪽: 프로젝트 관리 및 추가 도구 */}
                    <div className="flex flex-col items-center">
                        <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
                            <ToolButton
                                icon={<Save size={16}/>}
                                label="저장하기"
                                onClick={handleSaveProject}
                            />

                            <ToolButton
                                icon={<FolderOpen size={16}/>}
                                label={"불러오기"}
                                onClick={handleLoadProject}
                            />

                            <ToolButton
                                icon={<Play size={16}/>}
                                label={"G-Code\n생성"}
                                className="w-25 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md"
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