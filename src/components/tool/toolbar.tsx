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
    Save,
    FolderOpen,
    Play,
    ChevronDown,
    Code,
    Download,
} from "lucide-react";
import React from "react";
import {useAppDispatch, useAppSelector} from "@/hooks/redux";
import {setTool} from "@/store/slices/tool-slice";
import {useSettings} from '@/contexts/settings-context';
import {useProjectActions} from "@/hooks/use-project-actions";
import {useInsertImage} from "@/hooks/use-insert-image";
import {Card, CardContent} from "@/components/ui/card";
import {Separator} from "@/components/ui/separator";
import {Button} from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

import {redoWithSync, undoWithSync} from "@/store/thunks/history-thunk";

interface ToolbarProps {
    onGenerateGCode: () => void;
}

// 프로젝트 메뉴 컴포넌트
const ProjectMenu = ({
                         onSave,
                         onLoad,
                         onGenerateGCode
                     }: {
    onSave: () => void;
    onLoad: () => void;
    onGenerateGCode: () => void;
}) => (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
                <FolderOpen size={16} className="mr-2"/>
                프로젝트
                <ChevronDown size={12} className="ml-2 opacity-50"/>
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel>프로젝트 관리</DropdownMenuLabel>
            <DropdownMenuSeparator/>
            <DropdownMenuItem onClick={onSave}>
                <Save size={16} className="mr-2"/>
                저장하기
                <kbd className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded">Ctrl+S</kbd>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onLoad}>
                <FolderOpen size={16} className="mr-2"/>
                불러오기
                <kbd className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded">Ctrl+O</kbd>
            </DropdownMenuItem>
            <DropdownMenuItem>
                <Download size={16} className="mr-2"/>
                내보내기
            </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>
);

export const Toolbar = ({onGenerateGCode}: ToolbarProps) => {
    const dispatch = useAppDispatch();
    const tool = useAppSelector((state) => state.tool.tool);
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
                    <div className="flex items-center gap-2">
                        <ProjectMenu
                            onSave={handleSaveProject}
                            onLoad={handleLoadProject}
                            onGenerateGCode={onGenerateGCode}
                        />

                        <Button
                            variant="default"
                            size="sm"
                            className="h-9 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md px-4"
                            onClick={onGenerateGCode}
                        >
                            <Play size={16} className="mr-2"/>
                            G-Code 생성
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default Toolbar;