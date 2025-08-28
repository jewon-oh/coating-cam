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
    Settings,
} from "lucide-react";
import React, {useState} from "react";
import {useAppDispatch, useAppSelector} from "@/hooks/redux";
import {setCoatingType, setCoatingTypeAndFillPattern, setTool} from "@/store/slices/tool-slice";
import {useSettings} from '@/contexts/settings-context';
import {useProjectActions} from "@/hooks/project/use-project-actions";
import {useInsertImage} from "@/hooks/use-insert-image";
import {Card, CardContent} from "@/components/ui/card";
import {Separator} from "@/components/ui/separator";
import {redo, undo} from "@/store/slices/shape-history-slice";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Collapsible, CollapsibleContent} from "@/components/ui/collapsible";

interface ToolbarProps {
    onGenerateGCode: () => void;
}

export const Toolbar = ({onGenerateGCode}: ToolbarProps) => {
    const dispatch = useAppDispatch();
    const {
        tool,
        coatingType,
        fillPattern,
        coatingSpeed,
        coatingWidth,
        coatingHeight,
        lineSpacing,
        maskingClearance,
        travelAvoidanceStrategy
    } = useAppSelector((state) => state.tool);
    const {past, future} = useAppSelector((state) => state.history);
    const {
        isGridVisible,
        setGridVisible,
        isSnappingEnabled,
        setSnappingEnabled,
    } = useSettings();
    const {handleSaveProject, handleLoadProject} = useProjectActions();
    const {handleImageInsert} = useInsertImage();
    const [isCoatingSettingsOpen, setIsCoatingSettingsOpen] = useState(false);

    const canUndo = past.length > 0;
    const canRedo = future.length > 0;

    // 코팅 설정 변경 핸들러
    const handleCoatingSettingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const {name, value} = e.target;
        dispatch({
            type: 'tool/updateCoatingSettings',
            payload: {[name]: parseFloat(value)}
        });
    };

    // 코팅 설정 셀렉트 변경 핸들러
    const handleCoatingSettingSelectChange = (name: string, value: string) => {
        dispatch({
            type: 'tool/updateCoatingSettings',
            payload: {[name]: value}
        });
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
            <span className="text-xs mt-1 text-muted-foreground">그리기 도구</span>
        </div>
    );

    return (
        <Card
            className="border-b border-t-0 border-l-0 border-r-0 p-0 rounded-none shadow-sm bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/95">
            <CardContent className="p-2 space-y-2">
                {/* 첫 번째 줄: 기존 도구들 */}
                <div className="flex items-center justify-between">
                    {/* 왼쪽: 주요 도구들 */}
                    <div className="flex items-center gap-4">
                        {renderShapeTools()}
                        {/* 코팅 타입 선택기*/}
                        <Separator orientation="vertical" className="h-8"/>
                        <div className="flex flex-col items-center">
                            <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
                                <ToolButton
                                    icon={<MoveHorizontal size={16}/>}
                                    label="수평채우기"
                                    active={coatingType === 'fill' && fillPattern === 'horizontal'}
                                    onClick={() => dispatch(setCoatingTypeAndFillPattern({
                                        coatingType: 'fill',
                                        fillPattern: 'horizontal'
                                    }))}
                                    className={coatingType === 'fill' && fillPattern === 'horizontal' ? 'bg-sky-200 border border-sky-400 hover:bg-sky-300' : 'hover:bg-sky-100'}
                                />
                                <ToolButton
                                    icon={<MoveVertical size={16}/>}
                                    label="수직채우기"
                                    active={coatingType === 'fill' && fillPattern === 'vertical'}
                                    onClick={() => dispatch(setCoatingTypeAndFillPattern({
                                        coatingType: 'fill',
                                        fillPattern: 'vertical'
                                    }))}
                                    className={coatingType === 'fill' && fillPattern === 'vertical' ? 'bg-sky-200 border border-sky-400 hover:bg-sky-300' : 'hover:bg-sky-100'}
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
                                icon={<Settings size={16}/>}
                                label="코팅설정"
                                active={isCoatingSettingsOpen}
                                onClick={() => setIsCoatingSettingsOpen(!isCoatingSettingsOpen)}
                                className={isCoatingSettingsOpen ? 'bg-primary/20 border border-primary/40' : ''}
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

                {/* 두 번째 줄: 코팅 설정 패널 */}
                <Collapsible open={isCoatingSettingsOpen}>
                    <CollapsibleContent className="border-t pt-2">
                        <div className="bg-muted/20 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-medium text-foreground">
                                        {coatingType === 'fill' ? '채우기' :
                                            coatingType === 'outline' ? '윤곽' : '마스킹'} 설정
                                    </h3>
                                    <div className={`w-3 h-3 rounded-full ${
                                        coatingType === 'fill' ? 'bg-sky-400' :
                                            coatingType === 'outline' ? 'bg-yellow-400' : 'bg-red-400'
                                    }`}/>
                                </div>
                            </div>
                            <div className="grid grid-cols-4 gap-4 items-center text-sm">
                                {/* 코팅폭 */}
                                <div className="flex items-center gap-2">
                                    <Label className="text-xs text-muted-foreground whitespace-nowrap">코팅폭</Label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        name="coatingWidth"
                                        value={coatingWidth}
                                        onChange={handleCoatingSettingChange}
                                        className="h-7 text-xs w-16"
                                    />
                                    <span className="text-xs text-muted-foreground">mm</span>
                                </div>

                                {/* 라인간격 (outline이 아닌 경우에만 표시) */}
                                {coatingType !== 'outline' && (
                                    <div className="flex items-center gap-2">
                                        <Label className="text-xs text-muted-foreground whitespace-nowrap">간격</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            name="lineSpacing"
                                            value={lineSpacing}
                                            onChange={handleCoatingSettingChange}
                                            className="h-7 text-xs w-16"
                                        />
                                        <span className="text-xs text-muted-foreground">mm</span>
                                    </div>
                                )}

                                {/* 코팅속도 */}
                                <div className="flex items-center gap-2">
                                    <Label className="text-xs text-muted-foreground whitespace-nowrap">속도</Label>
                                    <Input
                                        type="number"
                                        name="coatingSpeed"
                                        value={coatingSpeed}
                                        onChange={handleCoatingSettingChange}
                                        className="h-7 text-xs w-16"
                                    />
                                    <span className="text-xs text-muted-foreground">mm/min</span>
                                </div>

                                {/* 패턴 (fill 타입인 경우에만 표시) */}
                                {coatingType === 'fill' && (
                                    <div className="flex items-center gap-2">
                                        <Label className="text-xs text-muted-foreground whitespace-nowrap">패턴</Label>
                                        <Select
                                            value={fillPattern}
                                            onValueChange={(value) => handleCoatingSettingSelectChange('fillPattern', value)}
                                        >
                                            <SelectTrigger className="h-7 text-xs w-20">
                                                <SelectValue/>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="horizontal">수평</SelectItem>
                                                <SelectItem value="vertical">수직</SelectItem>
                                                <SelectItem value="auto">자동</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            </CardContent>
        </Card>
    );
};

export default Toolbar;