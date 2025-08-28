"use client";

import React, {useMemo} from 'react';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Badge} from '@/components/ui/badge';
import {Switch} from '@/components/ui/switch';
import {Slider} from '@/components/ui/slider';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Separator} from '@/components/ui/separator';
import {Collapsible, CollapsibleContent, CollapsibleTrigger} from '@/components/ui/collapsible';
import {useAppSelector, useAppDispatch} from '@/hooks/redux';
import {updateShape, batchUpdateShapes} from '@/store/slices/shape-slice';
import {CustomShapeConfig} from '@/types/custom-konva-config';
import {SmallNumberField} from '@/components/small-number-field';
import {
    Settings,
    Eye,
    EyeOff,
    Lock,
    Unlock,
    Square,
    Circle as CircleIcon,
    Image as ImageIcon,
    Layers,
    RotateCcw,
    ChevronDown,
    ChevronRight,
    Palette,
    Move,
    Target,
    SkipForward, Columns4, SquaresUnite, SquareX, Syringe, MoveHorizontal, MoveVertical
} from 'lucide-react';
import {cn} from '@/lib/utils';
import {ScrollArea} from "@/components/ui/scroll-area";
import {useSettings} from "@/contexts/settings-context";

interface PropertyPanelProps {
    className?: string;
}

export function PropertyPanel({className}: PropertyPanelProps) {
    const dispatch = useAppDispatch();
    const shapes = useAppSelector((state) => state.shapes.shapes);
    const selectedShapeIds = useAppSelector((state) => state.shapes.selectedShapeIds);
    const {gcodeSettings} = useSettings();


    // 선택된 도형들 가져오기
    const selectedShapes = useMemo(() => {
        return shapes.filter(shape => selectedShapeIds.includes(shape.id!));
    }, [shapes, selectedShapeIds]);

    // 단일 선택된 도형
    const singleSelectedShape = selectedShapes.length === 1 ? selectedShapes[0] : null;

    // 다중 선택 시 공통 속성 계산
    const commonProperties = useMemo(() => {
        if (selectedShapes.length === 0) return null;
        if (selectedShapes.length === 1) return selectedShapes[0];

        // 다중 선택 시 공통 속성만 추출
        const first = selectedShapes[0];
        const common: Partial<CustomShapeConfig> = {
            type: selectedShapes.every(s => s.type === first.type) ? first.type : undefined,
            visible: selectedShapes.every(s => s.visible === first.visible) ? first.visible : undefined,
            isLocked: selectedShapes.every(s => s.isLocked === first.isLocked) ? first.isLocked : undefined,
            skipCoating: selectedShapes.every(s => s.skipCoating === first.skipCoating) ? first.skipCoating : undefined,
            coatingType: selectedShapes.every(s => s.coatingType === first.coatingType) ? first.coatingType : undefined,
            coatingSpeed: selectedShapes.every(s => s.coatingSpeed === first.coatingSpeed) ? first.coatingSpeed : undefined,
            coatingHeight: selectedShapes.every(s => s.coatingHeight === first.coatingHeight) ? first.coatingHeight : undefined,
            coatingOrder: selectedShapes.every(s => s.coatingOrder === first.coatingOrder) ? first.coatingOrder : undefined,
            outlinePasses: selectedShapes.every(s => s.outlinePasses === first.outlinePasses) ? first.outlinePasses : undefined,
            outlineInterval: selectedShapes.every(s => s.outlineInterval === first.outlineInterval) ? first.outlineInterval : undefined,
            outlineStartPoint: selectedShapes.every(s => s.outlineStartPoint === first.outlineStartPoint) ? first.outlineStartPoint : undefined,
            lineSpacing: selectedShapes.every(s => s.lineSpacing === first.lineSpacing) ? first.lineSpacing : undefined,
            travelAvoidanceStrategy: selectedShapes.every(s => s.travelAvoidanceStrategy === first.travelAvoidanceStrategy) ? first.travelAvoidanceStrategy : undefined,
            coatingWidth: selectedShapes.every(s => s.coatingWidth === first.coatingWidth) ? first.coatingWidth : undefined,
        };


        return common;
    }, [selectedShapes]);

    // 속성 업데이트 핸들러
    const handlePropertyUpdate = (property: string, value: string | number | boolean | undefined) => {
        if (selectedShapeIds.length === 0) return;

        if (selectedShapeIds.length === 1) {
            dispatch(updateShape({
                id: selectedShapeIds[0],
                updatedProps: {[property]: value}
            }));
        } else {
            // 다중 선택 시 배치 업데이트
            const updates = selectedShapeIds.map(id => ({
                id,
                props: {[property]: value}
            }));
            dispatch(batchUpdateShapes(updates));
        }
    };

    // 섹션 상태 관리
    const [expandedSections, setExpandedSections] = React.useState({
        transform: true,
        appearance: true,
        coating: true,
    });

    const toggleSection = (section: keyof typeof expandedSections) => {
        setExpandedSections(prev => ({...prev, [section]: !prev[section]}));
    };

    // 도형 아이콘 가져오기
    const getShapeIcon = (type: string) => {
        switch (type) {
            case 'rectangle':
                return <Square className="w-3 h-3"/>;
            case 'circle':
                return <CircleIcon className="w-3 h-3"/>;
            case 'image':
                return <ImageIcon className="w-3 h-3"/>;
            case 'group':
                return <Layers className="w-3 h-3"/>;
            case 'polygon':
                return <Target className="w-3 h-3"/>;
            default:
                return <Square className="w-3 h-3"/>;
        }
    };

    // 선택 상태에 따른 헤더 렌더링
    const renderHeader = () => {
        if (selectedShapes.length === 0) {
            return (
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Settings className="w-4 h-4"/>
                        속성 패널
                    </CardTitle>
                </CardHeader>
            );
        }

        if (selectedShapes.length === 1) {
            const shape = singleSelectedShape!;
            return (
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        {getShapeIcon(shape.type)}
                        <span>{shape.name || shape.type}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 h-auto ml-auto">
                            {shape.type}
                        </Badge>
                    </CardTitle>
                </CardHeader>
            );
        }

        return (
            <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                    <Layers className="w-4 h-4"/>
                    <span>{selectedShapes.length}개 선택됨</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 h-auto ml-auto">
                        다중선택
                    </Badge>
                </CardTitle>
            </CardHeader>
        );
    };

    if (selectedShapes.length === 0) {
        return (
            <Card className={cn("h-full", className)}>
                {renderHeader()}
                <CardContent className="pt-0">
                    <div className="text-xs text-muted-foreground text-center py-8">
                        객체를 선택하여 속성을 편집하세요.
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={cn("h-full rounded-none", className)}>
            {renderHeader()}
            <ScrollArea className="h-full">
                <CardContent className="pt-1 pb-12 space-y-4 ">
                    {/* 변형 속성 섹션 */}
                    <Collapsible open={expandedSections.transform} onOpenChange={() => toggleSection('transform')}>
                        <CollapsibleTrigger
                            className="flex items-center justify-between w-full py-2 px-1 hover:bg-accent rounded-sm">
                            <div className="flex items-center gap-2">
                                <Move className="w-3 h-3"/>
                                <span className="text-xs font-medium">변형</span>
                            </div>
                            {expandedSections.transform ? <ChevronDown className="w-3 h-3"/> :
                                <ChevronRight className="w-3 h-3"/>}
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-3 pt-2">
                            {singleSelectedShape && (
                                <div className="space-y-3 p-3 bg-accent/10 rounded-md border">

                                    {/* 크기 - 사각형, 이미지, 폴리곤 */}
                                    {(singleSelectedShape.type === 'rectangle' ||
                                        singleSelectedShape.type === 'image' ||
                                        singleSelectedShape.type === 'polygon') && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <SmallNumberField
                                                id="obj-width"
                                                label="가로"
                                                value={Math.round(singleSelectedShape.width || 0)}
                                                onChange={(value) => handlePropertyUpdate('width', value || 0)}
                                            />
                                            <SmallNumberField
                                                id="obj-height"
                                                label="세로"
                                                value={Math.round(singleSelectedShape.height || 0)}
                                                onChange={(value) => handlePropertyUpdate('height', value || 0)}
                                            />
                                        </div>
                                    )}


                                    {/* 위치 */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <SmallNumberField
                                            id="obj-x"
                                            label="기준점 X"
                                            value={Math.round(singleSelectedShape.x || 0)}
                                            onChange={(value) => handlePropertyUpdate('x', value || 0)}
                                        />
                                        <SmallNumberField
                                            id="obj-y"
                                            label="기준점 Y"
                                            value={Math.round(singleSelectedShape.y || 0)}
                                            onChange={(value) => handlePropertyUpdate('y', value || 0)}
                                        />
                                    </div>


                                    {/* 원 반지름 */}
                                    {singleSelectedShape.type === 'circle' && (
                                        <SmallNumberField
                                            id="obj-radius"
                                            label="반지름"
                                            value={Math.round(singleSelectedShape.radius || 0)}
                                            onChange={(value) => handlePropertyUpdate('radius', value || 0)}
                                        />
                                    )}

                                    {/* 회전 */}
                                    {singleSelectedShape.rotation !== undefined && (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <RotateCcw className="w-3 h-3"/>
                                                    <span className="text-xs">회전</span>
                                                </div>
                                                <div className="w-20">
                                                    <SmallNumberField
                                                        id="obj-rotation"
                                                        label=""
                                                        value={Math.round(singleSelectedShape.rotation || 0)}
                                                        step={1}
                                                        onChange={(value) => handlePropertyUpdate('rotation', Math.max(-180, Math.min(180, value || 0)))}
                                                    />
                                                </div>
                                            </div>
                                            <div className="px-1">
                                                <Slider
                                                    value={[singleSelectedShape.rotation || 0]}
                                                    onValueChange={([value]) => handlePropertyUpdate('rotation', value)}
                                                    min={-180}
                                                    max={180}
                                                    step={1}
                                                    className="w-full"
                                                />
                                                <div
                                                    className="flex justify-between text-[10px] text-muted-foreground mt-1">
                                                    <span>-180°</span>
                                                    <span>0°</span>
                                                    <span>180°</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CollapsibleContent>
                    </Collapsible>

                    <Separator/>

                    {/* 외관 속성 섹션 */}
                    <Collapsible open={expandedSections.appearance} onOpenChange={() => toggleSection('appearance')}>
                        <CollapsibleTrigger
                            className="flex items-center justify-between w-full py-2 px-1 hover:bg-accent rounded-sm">
                            <div className="flex items-center gap-2">
                                <Palette className="w-3 h-3"/>
                                <span className="text-xs font-medium">외관</span>
                            </div>
                            {expandedSections.appearance ? <ChevronDown className="w-3 h-3"/> :
                                <ChevronRight className="w-3 h-3"/>}
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-3 pt-2">
                            <div className="space-y-3 p-3 bg-accent/10 rounded-md border">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {commonProperties?.visible !== false ? <Eye className="w-3 h-3"/> :
                                            <EyeOff className="w-3 h-3"/>}
                                        <span className="text-xs">표시</span>
                                    </div>
                                    <Switch
                                        checked={commonProperties?.visible !== false}
                                        onCheckedChange={(checked) => handlePropertyUpdate('visible', checked)}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {commonProperties?.isLocked
                                            ? <Lock className="w-3 h-3"/>
                                            : <Unlock className="w-3 h-3"/>
                                        }
                                        <span className="text-xs">잠금</span>
                                    </div>
                                    <Switch
                                        checked={commonProperties?.isLocked || false}
                                        onCheckedChange={(checked) => handlePropertyUpdate('isLocked', checked)}
                                    />
                                </div>
                            </div>
                        </CollapsibleContent>
                    </Collapsible>

                    <Separator/>

                    {/* 코팅 설정 섹션 */}
                    <Collapsible open={expandedSections.coating} onOpenChange={() => toggleSection('coating')}>
                        <CollapsibleTrigger
                            className="flex items-center justify-between w-full py-2 px-1 hover:bg-accent rounded-sm">
                            <div className="flex items-center gap-2">
                                <Syringe className="w-3 h-3"/>
                                <span className="text-xs font-medium">코팅 설정</span>
                            </div>
                            {expandedSections.coating ? <ChevronDown className="w-3 h-3"/> :
                                <ChevronRight className="w-3 h-3"/>}
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-3 pt-2">
                            {/* 코팅 제외 */}
                            <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                                <div className="flex items-center gap-2">
                                    <SkipForward className="w-3 h-3"/>
                                    <span className="text-xs">코팅 제외</span>
                                </div>
                                <Switch
                                    checked={commonProperties?.skipCoating || false}
                                    onCheckedChange={(checked) => handlePropertyUpdate('skipCoating', checked)}
                                />
                            </div>

                            {/* 개별 코팅 설정 (코팅이 활성화된 경우에만) */}
                            {!commonProperties?.skipCoating && singleSelectedShape && (
                                <>
                                    {/* 코팅 타입 */}
                                    {/*<div>*/}
                                    {/*    <span className="text-xs block mb-1">코팅 타입</span>*/}
                                    {/*    <Select*/}
                                    {/*        value={singleSelectedShape.coatingType || 'fill'}*/}
                                    {/*        onValueChange={(value) => handlePropertyUpdate('coatingType', value)}*/}
                                    {/*    >*/}
                                    {/*        <SelectTrigger className="h-7 text-xs">*/}
                                    {/*            <SelectValue/>*/}
                                    {/*        </SelectTrigger>*/}
                                    {/*        <SelectContent>*/}
                                    {/*            <SelectItem value="fill"><Columns4/> 채우기</SelectItem>*/}
                                    {/*            <SelectItem value="outline"><SquaresUnite/> 윤곽선</SelectItem>*/}
                                    {/*            <SelectItem value="masking"><SquareX/> 마스킹</SelectItem>*/}
                                    {/*        </SelectContent>*/}
                                    {/*    </Select>*/}
                                    {/*</div>*/}

                                    {/* 코팅 타입별 설정 - 배경색 적용 */}
                                    {singleSelectedShape.coatingType === 'fill' && (
                                        <div
                                            className="space-y-3 p-3 bg-sky-50 dark:bg-sky-950/20 rounded-md border border-sky-200 dark:border-sky-800">
                                            <div className="flex flex-row items-center text-xs font-medium text-sky-700 dark:text-sky-300 mb-2">
                                                <Columns4/> 채우기 설정
                                            </div>
                                            <div className="text-[10px] text-sky-600 dark:text-sky-400 mb-3">
                                                도형 내부를 설정된 패턴으로 채웁니다.
                                            </div>

                                            {/* 코팅 패턴*/}
                                            <label className="text-xs font-medium">
                                                패턴
                                                <span className="text-[10px] opacity-70 ml-1">
                                                        (기본: {gcodeSettings.fillPattern})
                                                    </span>
                                            </label>
                                            <Select
                                                value={singleSelectedShape.fillPattern || 'global'}
                                                onValueChange={(value) => handlePropertyUpdate('fillPattern', value === 'global' ? undefined : value)}
                                            >
                                                <SelectTrigger className="h-8">
                                                    <SelectValue/>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="global">전역 설정 사용</SelectItem>
                                                    <SelectItem value="horizontal"><MoveHorizontal size={16}/>수평</SelectItem>
                                                    <SelectItem value="vertical"><MoveVertical size={16}/>수직</SelectItem>
                                                </SelectContent>
                                            </Select>

                                            {/* 코팅 순서 */}
                                            <SmallNumberField
                                                id="coating-order"
                                                label="코팅 순서"
                                                value={singleSelectedShape.coatingOrder}
                                                onChange={(value) => handlePropertyUpdate('coatingOrder', value)}
                                            />

                                            {/* 코팅 높이와 속도 */}
                                            <div className="grid grid-cols-2 gap-2">
                                                <SmallNumberField
                                                    id="coating-height"
                                                    label={`높이 (기본: ${gcodeSettings.coatingHeight}mm)`}
                                                    value={singleSelectedShape.coatingHeight}
                                                    step={0.01}
                                                    onChange={(value) => handlePropertyUpdate('coatingHeight', value)}
                                                />
                                                <SmallNumberField
                                                    id="coating-speed"
                                                    label={`속도 (기본: ${gcodeSettings.coatingSpeed}mm/min)`}
                                                    value={singleSelectedShape.coatingSpeed}
                                                    onChange={(value) => handlePropertyUpdate('coatingSpeed', value)}
                                                />
                                            </div>

                                            {/* 라인 간격과 코팅 폭 */}
                                            <div className="grid grid-cols-2 gap-2">
                                                <SmallNumberField
                                                    id="line-spacing"
                                                    label={`라인 간격 (기본: ${gcodeSettings.lineSpacing}mm)`}
                                                    value={singleSelectedShape.lineSpacing}
                                                    step={0.1}
                                                    onChange={(value) => handlePropertyUpdate('lineSpacing', value)}
                                                />
                                                <SmallNumberField
                                                    id="coating-width"
                                                    label={`코팅 폭 (기본: ${gcodeSettings.coatingWidth}mm)`}
                                                    value={singleSelectedShape.coatingWidth}
                                                    step={0.1}
                                                    onChange={(value) => handlePropertyUpdate('coatingWidth', value)}
                                                />
                                            </div>

                                        </div>
                                    )}

                                    {singleSelectedShape.coatingType === 'outline' && (
                                        <div
                                            className="space-y-3 p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-md border border-yellow-200 dark:border-yellow-800">
                                            <div
                                                className="flex flex-row items-center text-xs font-medium text-yellow-700 dark:text-yellow-300 mb-2">
                                                <SquaresUnite/> 윤곽선 설정
                                            </div>
                                            <div className="text-[10px] text-yellow-600 dark:text-yellow-400 mb-3">
                                                도형의 가장자리를 따라 코팅합니다.
                                            </div>
                                            {/* 시작점 선택 */}
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-[10px] text-muted-foreground">시작점</label>
                                                </div>
                                                <Select
                                                    value={singleSelectedShape.outlineStartPoint || 'center'}
                                                    onValueChange={(value) => handlePropertyUpdate('outlineStartPoint', value)}
                                                >
                                                    <SelectTrigger className="h-6 text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="outside" className="text-xs">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-2 h-2 border border-current rounded-sm"/>
                                                                윤곽선 바깥
                                                            </div>
                                                        </SelectItem>
                                                        <SelectItem value="center" className="text-xs">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-2 h-2 border-2 border-current rounded-sm"/>
                                                                윤곽선 중심
                                                            </div>
                                                        </SelectItem>
                                                        <SelectItem value="inside" className="text-xs">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-2 h-2 bg-current rounded-sm"/>
                                                                윤곽선 안
                                                            </div>
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {/*  패스 수 설정 */}
                                            <div className="grid grid-cols-2 gap-2 mb-3">
                                                <SmallNumberField
                                                    id="outline-passes"
                                                    label="패스 수"
                                                    value={singleSelectedShape.outlinePasses}
                                                    onChange={(value) => handlePropertyUpdate('outlinePasses', Math.max(1, value || 1))}
                                                />
                                                <SmallNumberField
                                                    id="outline-interval"
                                                    label="간격 (mm)"
                                                    value={singleSelectedShape.outlineInterval}
                                                    step={0.1}
                                                    onChange={(value) => handlePropertyUpdate('outlineInterval', value)}
                                                />
                                            </div>

                                            {/* 코팅 순서 */}
                                            <SmallNumberField
                                                id="coating-order"
                                                label="코팅 순서"
                                                value={singleSelectedShape.coatingOrder}
                                                onChange={(value) => handlePropertyUpdate('coatingOrder', value)}
                                            />

                                            {/* 코팅 높이와 속도 */}
                                            <div className="grid grid-cols-2 gap-2">
                                                <SmallNumberField
                                                    id="coating-height"
                                                    label={`높이 (기본: ${gcodeSettings.coatingHeight}mm)`}
                                                    value={singleSelectedShape.coatingHeight}
                                                    step={0.01}
                                                    onChange={(value) => handlePropertyUpdate('coatingHeight', value)}
                                                />
                                                <SmallNumberField
                                                    id="coating-speed"
                                                    label={`속도 (기본: ${gcodeSettings.coatingSpeed}mm/min)`}
                                                    value={singleSelectedShape.coatingSpeed}
                                                    onChange={(value) => handlePropertyUpdate('coatingSpeed', value)}
                                                />
                                            </div>

                                            {/* 코팅 폭 */}
                                            <SmallNumberField
                                                id="coating-width-outline"
                                                label={`코팅 폭 (기본: ${gcodeSettings.coatingWidth}mm)`}
                                                value={singleSelectedShape.coatingWidth}
                                                step={0.1}
                                                onChange={(value) => handlePropertyUpdate('coatingWidth', value)}
                                            />
                                        </div>
                                    )}

                                    {singleSelectedShape.coatingType === 'masking' && (
                                        <div
                                            className="space-y-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-md border border-red-200 dark:border-red-800">
                                            <div className="flex flex-row items-center text-xs font-medium text-red-700 dark:text-red-300 mb-2">
                                                <SquareX/> 마스킹 설정
                                            </div>
                                            <div className="text-[10px] text-red-600 dark:text-red-400 mb-3">
                                                다른 도형의 코팅 경로를 차단하는 장애물 역할을 합니다.
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                {/* 마스킹 높이 설정 */}
                                                <SmallNumberField
                                                    id="masking-height"
                                                    label={`마스킹 높이 (기본: ${gcodeSettings.coatingHeight}mm)`}
                                                    value={singleSelectedShape.coatingHeight}
                                                    step={0.01}
                                                    onChange={(value) => handlePropertyUpdate('coatingHeight', value)}
                                                />
                                                {/* 마스킹 여유 거리 */}
                                                <SmallNumberField
                                                    id="masking-clearance"
                                                    label={`마스킹 여유 거리 (기본: ${gcodeSettings.maskingClearance}mm)`}
                                                    value={singleSelectedShape.maskingClearance}
                                                    step={0.01}
                                                    onChange={(value) => handlePropertyUpdate('maskingClearance', value)}
                                                />
                                            </div>
                                            {/* 마스킹 우회 전략 */}
                                            <div className="space-y-2">
                                                <label className="text-xs font-medium text-red-700 dark:text-red-300">
                                                    우회 방식
                                                    <span className="text-[10px] opacity-70 ml-1">
                                                        (기본: {gcodeSettings.travelAvoidanceStrategy === 'lift' ? 'Z-Lift' : '윤곽 우회'})
                                                    </span>
                                                </label>
                                                <Select
                                                    value={singleSelectedShape.travelAvoidanceStrategy || 'global'}
                                                    onValueChange={(value) => handlePropertyUpdate('travelAvoidanceStrategy', value === 'global' ? undefined : value)}
                                                >
                                                    <SelectTrigger className="h-8">
                                                        <SelectValue/>
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="global">전역 설정 사용</SelectItem>
                                                        <SelectItem value="lift">🔺 Z-Lift (들어올리기)</SelectItem>
                                                        <SelectItem value="contour">🔄 윤곽 따라 우회</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>


                                            {/* 마스킹 설명 추가 */}
                                            <div
                                                className="text-[10px] text-red-600/80 dark:text-red-400/80 bg-red-100/50 dark:bg-red-900/20 p-2 rounded border-l-2 border-red-400">
                                                <div className="font-medium mb-1">💡 마스킹 동작:</div>
                                                <ul className="space-y-1 list-disc list-inside ml-2">
                                                    <li><strong>높이</strong>: 이 높이보다 낮은 코팅 경로가 차단됩니다</li>
                                                    <li><strong>Z-Lift</strong>: 장애물을 만나면 안전 높이로 들어올립니다</li>
                                                    <li><strong>윤곽 우회</strong>: 장애물 가장자리를 따라 우회합니다</li>
                                                </ul>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </CollapsibleContent>
                    </Collapsible>
                </CardContent>
            </ScrollArea>
        </Card>
    );
}