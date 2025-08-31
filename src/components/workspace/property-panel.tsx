"use client";

import React, {useMemo, useState, useEffect} from 'react';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Badge} from '@/components/ui/badge';
import {Switch} from '@/components/ui/switch';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Separator} from '@/components/ui/separator';
import {useAppSelector, useAppDispatch} from '@/hooks/redux';
import {updateShape, batchUpdateShapes} from '@/store/slices/shape-slice';
import {CustomShapeConfig} from '@/types/custom-konva-config';
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
    Target,
    Pencil,
    RotateCcw
} from 'lucide-react';
import {cn} from '@/lib/utils';
import {useSettings} from "@/contexts/settings-context";
import {SmallNumberField} from "@/components/small-number-field";
import {Slider} from "@/components/ui/slider";
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip";

interface PropertyPanelProps {
    className?: string;
}

export function PropertyPanel({className}: PropertyPanelProps) {
    const dispatch = useAppDispatch();
    const shapes = useAppSelector((state) => state.shapes.shapes);
    const selectedShapeIds = useAppSelector((state) => state.shapes.selectedShapeIds);
    const {gcodeSettings, pixelsPerMm} = useSettings();

    // 선택된 도형들 가져오기
    const selectedShapes = useMemo(() => {
        return shapes.filter(shape => selectedShapeIds.includes(shape.id!));
    }, [shapes, selectedShapeIds]);

    // 단일 선택된 도형
    const singleSelectedShape = selectedShapes.length === 1 ? selectedShapes[0] : null;

    // 이름 수정을 위한 로컬 상태
    const [name, setName] = useState('');
    const [isEditingName, setIsEditingName] = useState(false);

    useEffect(() => {
        if (singleSelectedShape) {
            setName(singleSelectedShape.name || '');
            setIsEditingName(false); // 선택 변경 시 편집 모드 해제
        } else {
            setIsEditingName(false);
        }
    }, [singleSelectedShape]);


    // 다중 선택 시 공통 속성 계산
    const commonProperties = useMemo(() => {
        if (selectedShapes.length === 0) return null;
        if (selectedShapes.length === 1) return selectedShapes[0];

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
            outlineType: selectedShapes.every(s => s.outlineType === first.outlineType) ? first.outlineType : undefined,
            lineSpacing: selectedShapes.every(s => s.lineSpacing === first.lineSpacing) ? first.lineSpacing : undefined,
            travelAvoidanceStrategy: selectedShapes.every(s => s.travelAvoidanceStrategy === first.travelAvoidanceStrategy) ? first.travelAvoidanceStrategy : undefined,
            coatingWidth: selectedShapes.every(s => s.coatingWidth === first.coatingWidth) ? first.coatingWidth : undefined,
            fillPattern: selectedShapes.every(s => s.fillPattern === first.fillPattern) ? first.fillPattern : undefined,
            maskingClearance: selectedShapes.every(s => s.maskingClearance === first.maskingClearance) ? first.maskingClearance : undefined,
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
            const updates = selectedShapeIds.map(id => ({
                id,
                props: {[property]: value}
            }));
            dispatch(batchUpdateShapes(updates));
        }
    };

    const handleDimensionUpdate = (property: string, value: string) => {
        const pxValue = parseFloat(value) * pixelsPerMm;
        if (!isNaN(pxValue)) {
            handlePropertyUpdate(property, pxValue);
        }
    };

    const handleNameUpdate = () => {
        if (singleSelectedShape && singleSelectedShape.name !== name) {
            handlePropertyUpdate('name', name);
        }
        setIsEditingName(false);
    };

    const handleCancelNameUpdate = () => {
        if (singleSelectedShape) {
            setName(singleSelectedShape.name || '');
        }
        setIsEditingName(false);
    };

    // 입력 변경 핸들러 (G-Code 설정용)
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const {name, value} = e.target;
        handlePropertyUpdate(name, parseFloat(value) || 0);
    };

    // 도형 아이콘 가져오기
    const getShapeIcon = (type: string) => {
        switch (type) {
            case 'rectangle':
                return <Square className="w-3.5 h-3.5"/>;
            case 'circle':
                return <CircleIcon className="w-3.5 h-3.5"/>;
            case 'image':
                return <ImageIcon className="w-3.5 h-3.5"/>;
            case 'group':
                return <Layers className="w-3.5 h-3.5"/>;
            case 'polygon':
                return <Target className="w-3.5 h-3.5"/>;
            default:
                return <Square className="w-3.5 h-3.5"/>;
        }
    };

    const shapeMeta = useMemo(() => {
        if (selectedShapes.length === 0) {
            return {
                label: "속성 패널",
                icon: <Settings className="w-3.5 h-3.5"/>,
                desc: "객체를 선택하여 속성을 편집하세요.",
            };
        }

        if (selectedShapes.length === 1) {
            const shape = singleSelectedShape!;
            return {
                label: shape.name || shape.type,
                icon: getShapeIcon(shape.type),
                desc: `${shape.type} 객체의 속성을 편집할 수 있습니다.`,
            };
        }

        return {
            label: `${selectedShapes.length}개 선택됨`,
            icon: <Layers className="w-3.5 h-3.5"/>,
            desc: "선택된 객체들의 공통 속성을 편집할 수 있습니다.",
        };
    }, [selectedShapes, singleSelectedShape]);

    const renderCoatingSettings = () => {
        const coatingType = commonProperties?.coatingType || 'fill';

        switch (coatingType) {
            case 'fill':
                return (
                    <div className="space-y-3">
                        {/* 첫 번째 줄: 코팅폭, 라인간격 */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">코팅폭</Label>
                                <div className="flex items-center gap-1">
                                    <Input
                                        type="number"
                                        step="0.01"
                                        name="coatingWidth"
                                        value={commonProperties?.coatingWidth || gcodeSettings.coatingWidth}
                                        onChange={handleInputChange}
                                        className="h-7 text-xs"
                                    />
                                    <span className="text-xs text-muted-foreground">mm</span>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">라인 간격</Label>
                                <div className="flex items-center gap-1">
                                    <Input
                                        type="number"
                                        step="0.01"
                                        name="lineSpacing"
                                        value={commonProperties?.lineSpacing || gcodeSettings.lineSpacing}
                                        onChange={handleInputChange}
                                        className="h-7 text-xs"
                                    />
                                    <span className="text-xs text-muted-foreground">mm</span>
                                </div>
                            </div>
                        </div>

                        {/* 두 번째 줄: 속도, 높이 */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">코팅 속도</Label>
                                <div className="flex items-center gap-1">
                                    <Input
                                        type="number"
                                        name="coatingSpeed"
                                        value={commonProperties?.coatingSpeed || gcodeSettings.coatingSpeed}
                                        onChange={handleInputChange}
                                        className="h-7 text-xs"
                                    />
                                    <span className="text-xs text-muted-foreground">mm/min</span>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">코팅 높이</Label>
                                <div className="flex items-center gap-1">
                                    <Input
                                        type="number"
                                        step="0.01"
                                        name="coatingHeight"
                                        value={commonProperties?.coatingHeight || gcodeSettings.coatingHeight}
                                        onChange={handleInputChange}
                                        className="h-7 text-xs"
                                    />
                                    <span className="text-xs text-muted-foreground">mm</span>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'outline':
                return (
                    <div className="space-y-3">
                        {/* 첫 번째 줄: 코팅폭, 속도 */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">코팅폭</Label>
                                <div className="flex items-center gap-1">
                                    <Input
                                        type="number"
                                        step="0.01"
                                        name="coatingWidth"
                                        value={commonProperties?.coatingWidth || gcodeSettings.coatingWidth}
                                        onChange={handleInputChange}
                                        className="h-7 text-xs"
                                    />
                                    <span className="text-xs text-muted-foreground">mm</span>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">코팅 속도</Label>
                                <div className="flex items-center gap-1">
                                    <Input
                                        type="number"
                                        name="coatingSpeed"
                                        value={commonProperties?.coatingSpeed || gcodeSettings.coatingSpeed}
                                        onChange={handleInputChange}
                                        className="h-7 text-xs"
                                    />
                                    <span className="text-xs text-muted-foreground">mm/min</span>
                                </div>
                            </div>
                        </div>

                        {/* 두 번째 줄: 높이, 패스 */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">코팅 높이</Label>
                                <div className="flex items-center gap-1">
                                    <Input
                                        type="number"
                                        step="0.01"
                                        name="coatingHeight"
                                        value={commonProperties?.coatingHeight || gcodeSettings.coatingHeight}
                                        onChange={handleInputChange}
                                        className="h-7 text-xs"
                                    />
                                    <span className="text-xs text-muted-foreground">mm</span>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">패스 수</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    max="10"
                                    name="outlinePasses"
                                    value={commonProperties?.outlinePasses || 1}
                                    onChange={handleInputChange}
                                    className="h-7 text-xs"
                                />
                            </div>
                        </div>
                    </div>
                );

            case 'masking':
            default:
                return (
                    <div className="space-y-3">
                        {/* 첫 번째 줄: 속도, 높이 */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">코팅 속도</Label>
                                <div className="flex items-center gap-1">
                                    <Input
                                        type="number"
                                        name="coatingSpeed"
                                        value={commonProperties?.coatingSpeed || gcodeSettings.coatingSpeed}
                                        onChange={handleInputChange}
                                        className="h-7 text-xs"
                                    />
                                    <span className="text-xs text-muted-foreground">mm/min</span>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">코팅 높이</Label>
                                <div className="flex items-center gap-1">
                                    <Input
                                        type="number"
                                        step="0.01"
                                        name="coatingHeight"
                                        value={commonProperties?.coatingHeight || gcodeSettings.coatingHeight}
                                        onChange={handleInputChange}
                                        className="h-7 text-xs"
                                    />
                                    <span className="text-xs text-muted-foreground">mm</span>
                                </div>
                            </div>
                        </div>
                    </div>
                );
        }
    };

    // Line 전용 속성 렌더링 함수 추가
    const renderLineSettings = () => {
        if (!singleSelectedShape || singleSelectedShape.type !== 'line') return null;

        const handlePointUpdate = (pointType: 'startPoint' | 'endPoint', axis: 'x' | 'y', value: string) => {
            const currentPoint = singleSelectedShape[pointType] || {x: 0, y: 0};
            const mmValue = parseFloat(value) || 0;
            const pxValue = mmValue * pixelsPerMm;
            handlePropertyUpdate(pointType, {...currentPoint, [axis]: pxValue});
        };

        const startX_mm = ((singleSelectedShape.startPoint?.x || 0) / pixelsPerMm).toFixed(2);
        const startY_mm = ((singleSelectedShape.startPoint?.y || 0) / pixelsPerMm).toFixed(2);
        const endX_mm = ((singleSelectedShape.endPoint?.x || 0) / pixelsPerMm).toFixed(2);
        const endY_mm = ((singleSelectedShape.endPoint?.y || 0) / pixelsPerMm).toFixed(2);

        const length_px = Math.sqrt(
            Math.pow((singleSelectedShape.endPoint?.x || 0) - (singleSelectedShape.startPoint?.x || 0), 2) +
            Math.pow((singleSelectedShape.endPoint?.y || 0) - (singleSelectedShape.startPoint?.y || 0), 2)
        );
        const length_mm = (length_px / pixelsPerMm).toFixed(2);


        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">라인 속성</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {/* 시작점 좌표 */}
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">시작점</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="flex items-center gap-1">
                                <Label className="text-xs w-4">X</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={startX_mm}
                                    onChange={(e) => handlePointUpdate('startPoint', 'x', e.target.value)}
                                    className="h-7 text-xs"
                                />
                                <span className="text-xs text-muted-foreground">mm</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Label className="text-xs w-4">Y</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={startY_mm}
                                    onChange={(e) => handlePointUpdate('startPoint', 'y', e.target.value)}
                                    className="h-7 text-xs"
                                />
                                <span className="text-xs text-muted-foreground">mm</span>
                            </div>
                        </div>
                    </div>

                    {/* 끝점 좌표 */}
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">끝점</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="flex items-center gap-1">
                                <Label className="text-xs w-4">X</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={endX_mm}
                                    onChange={(e) => handlePointUpdate('endPoint', 'x', e.target.value)}
                                    className="h-7 text-xs"
                                />
                                <span className="text-xs text-muted-foreground">mm</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Label className="text-xs w-4">Y</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={endY_mm}
                                    onChange={(e) => handlePointUpdate('endPoint', 'y', e.target.value)}
                                    className="h-7 text-xs"
                                />
                                <span className="text-xs text-muted-foreground">mm</span>
                            </div>
                        </div>
                    </div>

                    {/* 라인 길이 (읽기 전용) */}
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">길이</Label>
                        <div className="flex items-center gap-1">
                            <Input
                                type="text"
                                value={length_mm}
                                disabled
                                className="h-7 text-xs bg-muted"
                            />
                            <span className="text-xs text-muted-foreground">mm</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    };

    if (selectedShapes.length === 0) {
        return (
            <Card className={cn("h-full rounded-none border-0", className)}>
                <CardHeader className="py-3">
                    <div className="flex items-center gap-2">
                        <Settings className="w-3.5 h-3.5"/>
                        <CardTitle className="text-lg">속성 패널</CardTitle>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">객체를 선택하여 속성을 편집하세요.</p>
                </CardHeader>
                <Separator/>
                <CardContent className="pt-4">
                    <div className="text-xs text-muted-foreground text-center py-8">
                        객체를 선택하여 속성을 편집하세요.
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={cn("h-full rounded-none border-0 gap-0", className)}>
            <CardHeader className="py-0">
                <div className="flex items-center gap-2">
                    {shapeMeta.icon}
                    {singleSelectedShape && isEditingName ? (
                        <Input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onBlur={handleNameUpdate}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleNameUpdate();
                                if (e.key === 'Escape') handleCancelNameUpdate();
                            }}
                            className="h-8 text-lg font-semibold"
                            autoFocus
                        />
                    ) : (
                        <CardTitle className="text-lg">{shapeMeta.label}</CardTitle>
                    )}
                    {singleSelectedShape && !isEditingName && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button onClick={() => setIsEditingName(true)}
                                        className="p-1 hover:bg-accent rounded-sm">
                                    <Pencil className="w-3.5 h-3.5 text-muted-foreground"/>
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>이름 수정</p>
                            </TooltipContent>
                        </Tooltip>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                        {selectedShapes.length === 1 && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 h-auto">
                                {singleSelectedShape!.type}
                            </Badge>
                        )}
                        {selectedShapes.length > 1 && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 h-auto">
                                다중선택
                            </Badge>
                        )}
                    </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{shapeMeta.desc}</p>
            </CardHeader>
            <CardContent className="p-3 space-y-4">
                <Separator/>
                {/* 기본 속성 */}
                <div>
                    <div className="text-[11px] font-medium mb-2 text-muted-foreground">기본 속성</div>
                    <div className="space-y-3">
                        {/* 가시성 및 잠금 */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center gap-2">
                                <Switch
                                    checked={commonProperties?.visible !== false}
                                    onCheckedChange={(checked) => handlePropertyUpdate('visible', checked)}
                                />
                                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                    {commonProperties?.visible !== false ? <Eye className="w-3 h-3"/> :
                                        <EyeOff className="w-3 h-3"/>}
                                    표시
                                </Label>
                            </div>
                            <div className="flex items-center gap-2">
                                <Switch
                                    checked={commonProperties?.isLocked === true}
                                    onCheckedChange={(checked) => handlePropertyUpdate('isLocked', checked)}
                                />
                                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                    {commonProperties?.isLocked ? <Lock className="w-3 h-3"/> :
                                        <Unlock className="w-3 h-3"/>}
                                    잠금
                                </Label>
                            </div>
                        </div>

                        {/* 단일 객체일 때만 크기 정보 표시 */}
                        {singleSelectedShape && (
                            <>
                                {/* 크기 */}
                                {(singleSelectedShape.type === 'rectangle' ||
                                    singleSelectedShape.type === 'image' ||
                                    singleSelectedShape.type === 'polygon') && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">가로</Label>
                                            <div className="flex items-center gap-1">
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    name="width"
                                                    value={((singleSelectedShape.width || 0) / pixelsPerMm).toFixed(2)}
                                                    onChange={(e) => handleDimensionUpdate('width', e.target.value)}
                                                    className="h-7 text-xs"
                                                />
                                                <span className="text-xs text-muted-foreground">mm</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">세로</Label>
                                            <div className="flex items-center gap-1">
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    name="height"
                                                    value={((singleSelectedShape.height || 0) / pixelsPerMm).toFixed(2)}
                                                    onChange={(e) => handleDimensionUpdate('height', e.target.value)}
                                                    className="h-7 text-xs"
                                                />
                                                <span className="text-xs text-muted-foreground">mm</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 원의 경우 반지름과 지름 */}
                                {singleSelectedShape.type === 'circle' && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">반지름</Label>
                                            <div className="flex items-center gap-1">
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={((singleSelectedShape.radius || 0) / pixelsPerMm).toFixed(2)}
                                                    onChange={(e) => {
                                                        const radius = (parseFloat(e.target.value) || 0) * pixelsPerMm;
                                                        handlePropertyUpdate('radius', radius);
                                                    }}
                                                    className="h-7 text-xs"
                                                />
                                                <span className="text-xs text-muted-foreground">mm</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">지름</Label>
                                            <div className="flex items-center gap-1">
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={(((singleSelectedShape.radius || 0) * 2) / pixelsPerMm).toFixed(2)}
                                                    onChange={(e) => {
                                                        const diameter = parseFloat(e.target.value) || 0;
                                                        handlePropertyUpdate('radius', (diameter / 2) * pixelsPerMm);
                                                    }}
                                                    className="h-7 text-xs"
                                                />
                                                <span className="text-xs text-muted-foreground">mm</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Line 전용 설정 */}
                                {renderLineSettings()}

                                {/* 위치 */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">X 위치</Label>
                                        <div className="flex items-center gap-1">
                                            <Input
                                                type="number"
                                                step="0.01"
                                                name="x"
                                                value={((singleSelectedShape.x || 0) / pixelsPerMm).toFixed(2)}
                                                onChange={(e) => handleDimensionUpdate('x', e.target.value)}
                                                className="h-7 text-xs"
                                            />
                                            <span className="text-xs text-muted-foreground">mm</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Y 위치</Label>
                                        <div className="flex items-center gap-1">
                                            <Input
                                                type="number"
                                                step="0.01"
                                                name="y"
                                                value={((singleSelectedShape.y || 0) / pixelsPerMm).toFixed(2)}
                                                onChange={(e) => handleDimensionUpdate('y', e.target.value)}
                                                className="h-7 text-xs"
                                            />
                                            <span className="text-xs text-muted-foreground">mm</span>
                                        </div>
                                    </div>
                                </div>
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
                            </>
                        )}
                    </div>
                </div>

                <Separator/>

                {/* 코팅 설정 */}
                <div>
                    <div className="text-[11px] font-medium mb-2 text-muted-foreground">코팅 설정</div>
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            {/* 코팅 제외 및 코팅 순서 */}
                            {singleSelectedShape && singleSelectedShape.type === 'image' && (

                                <div className="flex items-center gap-2">
                                    <Switch
                                        checked={commonProperties?.skipCoating !== true}
                                        onCheckedChange={(checked) => handlePropertyUpdate('skipCoating', !checked)}
                                    />
                                    <Label className="text-xs text-muted-foreground">코팅 적용</Label>
                                </div>
                            )}

                            {singleSelectedShape && singleSelectedShape.type !== 'image' && singleSelectedShape.coatingType !== 'masking' && (
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">코팅 순서</Label>
                                    <div className="flex items-center gap-1">
                                        <Input
                                            type="number"
                                            min="0"
                                            name="coatingOrder"
                                            value={commonProperties?.coatingOrder || 0}
                                            onChange={handleInputChange}
                                            className="h-7 text-xs"
                                            disabled={commonProperties?.skipCoating === true}
                                        />
                                        <span className="text-xs text-muted-foreground ">번</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        {/* 코팅이 적용될 때만 나머지 설정 표시 */}
                        {commonProperties?.skipCoating !== true && renderCoatingSettings()}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
