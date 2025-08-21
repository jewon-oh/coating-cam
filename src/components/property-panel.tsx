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
import {updateShape, batchUpdateShapes} from '@/store/slices/shapes-slice';
import {AnyNodeConfig} from '@/types/custom-konva-config';
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
    Zap,
    Target,
    SkipForward
} from 'lucide-react';
import {cn} from '@/lib/utils';
import {ScrollArea} from "@/components/ui/scroll-area";

interface PropertyPanelProps {
    className?: string;
}

export function PropertyPanel({className}: PropertyPanelProps) {
    const dispatch = useAppDispatch();
    const shapes = useAppSelector((state) => state.shapes.shapes);
    const selectedShapeIds = useAppSelector((state) => state.shapes.selectedShapeIds);
    const gcodeSettings = useAppSelector((state) => state.gcode.gcodeSettings);

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
        const common: Partial<AnyNodeConfig> = {
            type: selectedShapes.every(s => s.type === first.type) ? first.type : undefined,
            visible: selectedShapes.every(s => s.visible === first.visible) ? first.visible : undefined,
            isLocked: selectedShapes.every(s => s.isLocked === first.isLocked) ? first.isLocked : undefined,
            skipCoating: selectedShapes.every(s => s.skipCoating === first.skipCoating) ? first.skipCoating : undefined,
            useCustomCoating: selectedShapes.every(s => s.useCustomCoating === first.useCustomCoating) ? first.useCustomCoating : undefined,
            coatingType: selectedShapes.every(s => s.coatingType === first.coatingType) ? first.coatingType : undefined,
            coatingSpeed: selectedShapes.every(s => s.coatingSpeed === first.coatingSpeed) ? first.coatingSpeed : undefined,
            coatingHeight: selectedShapes.every(s => s.coatingHeight === first.coatingHeight) ? first.coatingHeight : undefined,
            coatingOrder: selectedShapes.every(s => s.coatingOrder === first.coatingOrder) ? first.coatingOrder : undefined,
            outlinePasses: selectedShapes.every(s => s.outlinePasses === first.outlinePasses) ? first.outlinePasses : undefined,
            outlineInterval: selectedShapes.every(s => s.outlineInterval === first.outlineInterval) ? first.outlineInterval : undefined,
        };


        return common;
    }, [selectedShapes]);

    // 속성 업데이트 핸들러
    const handlePropertyUpdate = (property: string, value: any) => {
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
                                <>
                                    {/* 위치 */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <SmallNumberField
                                            id="obj-x"
                                            label="X"
                                            value={Math.round(singleSelectedShape.x || 0)}
                                            onChange={(value) => handlePropertyUpdate('x', value)}
                                        />
                                        <SmallNumberField
                                            id="obj-y"
                                            label="Y"
                                            value={Math.round(singleSelectedShape.y || 0)}
                                            onChange={(value) => handlePropertyUpdate('y', value)}
                                        />
                                    </div>

                                    {/* 크기 - 사각형, 이미지, 폴리곤 */}
                                    {(singleSelectedShape.type === 'rectangle' ||
                                        singleSelectedShape.type === 'image' ||
                                        singleSelectedShape.type === 'polygon') && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <SmallNumberField
                                                id="obj-width"
                                                label="너비"
                                                value={Math.round(singleSelectedShape.width || 0)}
                                                onChange={(value) => handlePropertyUpdate('width', value)}
                                            />
                                            <SmallNumberField
                                                id="obj-height"
                                                label="높이"
                                                value={Math.round(singleSelectedShape.height || 0)}
                                                onChange={(value) => handlePropertyUpdate('height', value)}
                                            />
                                        </div>
                                    )}

                                    {/* 원 반지름 */}
                                    {singleSelectedShape.type === 'circle' && (
                                        <SmallNumberField
                                            id="obj-radius"
                                            label="반지름"
                                            value={Math.round(singleSelectedShape.radius || 0)}
                                            onChange={(value) => handlePropertyUpdate('radius', value)}
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
                                                        onChange={(value) => handlePropertyUpdate('rotation', Math.max(-180, Math.min(180, value)))}
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

                                </>
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
                                    {/* 아이콘 로직 수정: isLocked가 true면 Lock 아이콘 */}
                                    {commonProperties?.isLocked
                                        ? <Lock className="w-3 h-3"/>
                                        : <Unlock className="w-3 h-3"/>
                                    }
                                    <span className="text-xs">잠금</span> {/* 레이블도 변경 */}
                                </div>
                                <Switch
                                    checked={commonProperties?.isLocked || false}
                                    onCheckedChange={(checked) => handlePropertyUpdate('isLocked', checked)}
                                />
                            </div>

                        </CollapsibleContent>
                    </Collapsible>

                    <Separator/>

                    {/* 코팅 설정 섹션 */}
                    <Collapsible open={expandedSections.coating} onOpenChange={() => toggleSection('coating')}>
                        <CollapsibleTrigger
                            className="flex items-center justify-between w-full py-2 px-1 hover:bg-accent rounded-sm">
                            <div className="flex items-center gap-2">
                                <Zap className="w-3 h-3"/>
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
                            {!commonProperties?.skipCoating && (
                                <>
                                    {/* 코팅 타입 */}
                                    {singleSelectedShape && (
                                        <>
                                            <div>
                                                <span className="text-xs block mb-1">코팅 타입</span>
                                                <Select
                                                    value={singleSelectedShape.coatingType || 'fill'}
                                                    onValueChange={(value) => handlePropertyUpdate('coatingType', value)}
                                                >
                                                    <SelectTrigger className="h-7 text-xs">
                                                        <SelectValue/>
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="fill">🔄 채우기</SelectItem>
                                                        <SelectItem value="outline">📐 윤곽선</SelectItem>
                                                        <SelectItem value="masking">🚫 마스킹</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            {/* 윤곽선 관련 설정 (outline 타입일 때만) */}
                                            {singleSelectedShape.coatingType === 'outline' && (
                                                <div
                                                    className="space-y-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded border">
                                                    <div
                                                        className="text-xs font-medium text-blue-700 dark:text-blue-300">윤곽선
                                                        설정
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <SmallNumberField
                                                            id="outline-passes"
                                                            label="패스 수"
                                                            value={singleSelectedShape.outlinePasses || 1}
                                                            onChange={(value) => handlePropertyUpdate('outlinePasses', Math.max(1, value))}
                                                        />
                                                        <SmallNumberField
                                                            id="outline-interval"
                                                            label="간격 (mm)"
                                                            value={singleSelectedShape.outlineInterval || 1}
                                                            step={0.1}
                                                            onChange={(value) => handlePropertyUpdate('outlineInterval', value)}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Settings className="w-3 h-3"/>
                                            <span className="text-xs">개별 설정 사용</span>
                                        </div>
                                        <Switch
                                            checked={commonProperties?.useCustomCoating || false}
                                            onCheckedChange={(checked) => handlePropertyUpdate('useCustomCoating', checked)}
                                        />
                                    </div>


                                    {/* 개별 설정이 활성화된 경우 */}
                                    {commonProperties?.useCustomCoating && singleSelectedShape && (
                                        <div
                                            className="space-y-3 p-3 bg-accent/20 rounded-md border-l-2 border-primary/30">
                                            <div className="text-xs font-medium text-muted-foreground mb-2">개별 코팅 설정
                                            </div>

                                            {/* 코팅 순서 */}
                                            <SmallNumberField
                                                id="coating-order"
                                                label="코팅 순서"
                                                value={singleSelectedShape.coatingOrder || 0}
                                                onChange={(value) => handlePropertyUpdate('coatingOrder', value)}
                                            />

                                            {/* 코팅 높이와 속도 */}
                                            <div className="grid grid-cols-2 gap-2">
                                                <SmallNumberField
                                                    id="coating-height"
                                                    label="높이 (mm)"
                                                    value={singleSelectedShape.coatingHeight || gcodeSettings.coatingHeight}
                                                    step={0.01}
                                                    onChange={(value) => handlePropertyUpdate('coatingHeight', value)}
                                                />
                                                <SmallNumberField
                                                    id="coating-speed"
                                                    label="속도 (mm/min)"
                                                    value={singleSelectedShape.coatingSpeed || gcodeSettings.coatingSpeed}
                                                    onChange={(value) => handlePropertyUpdate('coatingSpeed', value)}
                                                />
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