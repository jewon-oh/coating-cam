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

    // 숫자 입력 필드를 위한 로컬 상태
    const [dimensionInputs, setDimensionInputs] = useState({
        width: '',
        height: '',
        radius: '',
        diameter: '',
        x: '',
        y: '',
    });
    const [lineCoordinates, setLineCoordinates] = useState({
        startX: '',
        startY: '',
        endX: '',
        endY: '',
    });
    const [coatingSettingInputs, setCoatingSettingInputs] = useState({
        coatingWidth: '',
        lineSpacing: '',
        coatingSpeed: '',
        coatingHeight: '',
        outlinePasses: '',
        outlineInterval: '',
        coatingOrder: '',
    });


    useEffect(() => {
        if (singleSelectedShape) {
            setName(singleSelectedShape.name || '');
            setIsEditingName(false); // 선택 변경 시 편집 모드 해제
            setDimensionInputs({
                width: ((singleSelectedShape.width || 0) / pixelsPerMm).toFixed(2),
                height: ((singleSelectedShape.height || 0) / pixelsPerMm).toFixed(2),
                radius: ((singleSelectedShape.radius || 0) / pixelsPerMm).toFixed(2),
                diameter: (((singleSelectedShape.radius || 0) * 2) / pixelsPerMm).toFixed(2),
                x: ((singleSelectedShape.x || 0) / pixelsPerMm).toFixed(2),
                y: ((singleSelectedShape.y || 0) / pixelsPerMm).toFixed(2),
            });

            if (singleSelectedShape.type === 'line') {
                const shapeX_px = singleSelectedShape.x || 0;
                const shapeY_px = singleSelectedShape.y || 0;
                const points = singleSelectedShape.points || [0, 0, 0, 0];
                const [startX_rel_px, startY_rel_px, endX_rel_px, endY_rel_px] = points;

                const startX_abs_px = shapeX_px + startX_rel_px;
                const startY_abs_px = shapeY_px + startY_rel_px;
                const endX_abs_px = shapeX_px + endX_rel_px;
                const endY_abs_px = shapeY_px + endY_rel_px;

                setLineCoordinates({
                    startX: (startX_abs_px / pixelsPerMm).toFixed(2),
                    startY: (startY_abs_px / pixelsPerMm).toFixed(2),
                    endX: (endX_abs_px / pixelsPerMm).toFixed(2),
                    endY: (endY_abs_px / pixelsPerMm).toFixed(2),
                });
            }
        } else {
            setIsEditingName(false);
        }
    }, [singleSelectedShape, pixelsPerMm]);

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

    useEffect(() => {
        if (commonProperties) {
            setCoatingSettingInputs({
                coatingWidth: (commonProperties.coatingWidth ?? gcodeSettings.coatingWidth).toFixed(2),
                lineSpacing: (commonProperties.lineSpacing ?? gcodeSettings.lineSpacing).toFixed(2),
                coatingSpeed: (commonProperties.coatingSpeed ?? gcodeSettings.coatingSpeed).toString(),
                coatingHeight: (commonProperties.coatingHeight ?? gcodeSettings.coatingHeight).toFixed(2),
                outlinePasses: (commonProperties.outlinePasses ?? 1).toString(),
                outlineInterval: (commonProperties.outlineInterval ?? 0).toFixed(2),
                coatingOrder: (commonProperties.coatingOrder ?? 0).toString(),
            });
        }
    }, [commonProperties, gcodeSettings]);

    // 속성 업데이트 핸들러
    const handlePropertyUpdate = (property: string, value: string | number | boolean | undefined) => {
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

    const handleDimensionUpdate = (property: 'width' | 'height' | 'x' | 'y', value: string) => {
        const mmValue = parseFloat(value) || 0;

        if (!isNaN(mmValue)) {
            handlePropertyUpdate(property, mmValue);
        }
        setDimensionInputs(prev => ({...prev, [property]: mmValue.toFixed(2)}));
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

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
        }
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
                icon: getShapeIcon(shape.type??'unknown'),
                // desc: `${shape.type} 객체의 속성을 편집할 수 있습니다.`,
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

        const handleSettingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const {name, value} = e.target;
            setCoatingSettingInputs(prev => ({...prev, [name]: value}));
        };

        const handleSettingBlur = (e: React.ChangeEvent<HTMLInputElement>) => {
            const {name, value} = e.target;
            const numValue = parseFloat(value) || 0;
            handlePropertyUpdate(name, numValue);

            const needsFormatting = ['coatingWidth', 'lineSpacing', 'coatingHeight', 'outlineInterval'].includes(name);
            setCoatingSettingInputs(prev => ({
                ...prev,
                [name]: needsFormatting ? numValue.toFixed(2) : numValue.toString()
            }));
        };

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
                                        value={coatingSettingInputs.coatingWidth}
                                        onChange={handleSettingChange}
                                        onBlur={handleSettingBlur}
                                        onKeyDown={handleKeyDown}
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
                                        value={coatingSettingInputs.lineSpacing}
                                        onChange={handleSettingChange}
                                        onBlur={handleSettingBlur}
                                        onKeyDown={handleKeyDown}
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
                                        step="10"
                                        name="coatingSpeed"
                                        value={coatingSettingInputs.coatingSpeed}
                                        onChange={handleSettingChange}
                                        onBlur={handleSettingBlur}
                                        onKeyDown={handleKeyDown}
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
                                        value={coatingSettingInputs.coatingHeight}
                                        onChange={handleSettingChange}
                                        onBlur={handleSettingBlur}
                                        onKeyDown={handleKeyDown}
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
                                        value={coatingSettingInputs.coatingWidth}
                                        onChange={handleSettingChange}
                                        onBlur={handleSettingBlur}
                                        onKeyDown={handleKeyDown}
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
                                        step="10"
                                        name="coatingSpeed"
                                        value={coatingSettingInputs.coatingSpeed}
                                        onChange={handleSettingChange}
                                        onBlur={handleSettingBlur}
                                        onKeyDown={handleKeyDown}
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
                                        value={coatingSettingInputs.coatingHeight}
                                        onChange={handleSettingChange}
                                        onBlur={handleSettingBlur}
                                        onKeyDown={handleKeyDown}
                                        className="h-7 text-xs"
                                    />
                                    <span className="text-xs text-muted-foreground">mm</span>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">패스 수</Label>
                                <Input
                                    type="number"
                                    step="1"
                                    min="1"
                                    max="10"
                                    name="outlinePasses"
                                    value={coatingSettingInputs.outlinePasses}
                                    onChange={handleSettingChange}
                                    onBlur={handleSettingBlur}
                                    onKeyDown={handleKeyDown}
                                    className="h-7 text-xs"
                                />
                            </div>
                        </div>
                        {/* 세 번째 줄: 윤곽 타입, 오프셋 */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">윤곽 타입</Label>
                                <Select
                                    value={commonProperties?.outlineType || 'center'}
                                    onValueChange={(value) => handlePropertyUpdate('outlineType', value)}
                                >
                                    <SelectTrigger className="h-7 text-xs">
                                        <SelectValue/>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="outside">외곽</SelectItem>
                                        <SelectItem value="center">중앙</SelectItem>
                                        <SelectItem value="inside">내부</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">윤곽 오프셋</Label>
                                <div className="flex items-center gap-1">
                                    <Input
                                        type="number"
                                        step="0.01"
                                        name="outlineInterval"
                                        value={coatingSettingInputs.outlineInterval}
                                        onChange={handleSettingChange}
                                        onBlur={handleSettingBlur}
                                        onKeyDown={handleKeyDown}
                                        className="h-7 text-xs"
                                    />
                                    <span className="text-xs text-muted-foreground">mm</span>
                                </div>
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
                                        step="10"
                                        name="coatingSpeed"
                                        value={coatingSettingInputs.coatingSpeed}
                                        onChange={handleSettingChange}
                                        onBlur={handleSettingBlur}
                                        onKeyDown={handleKeyDown}
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
                                        value={coatingSettingInputs.coatingHeight}
                                        onChange={handleSettingChange}
                                        onBlur={handleSettingBlur}
                                        onKeyDown={handleKeyDown}
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
        // 타입 가드를 통해 singleSelectedShape가 'line' 타입인지 확인합니다.
        if (singleSelectedShape?.type !== 'line') return null;

        const shapeX_px = singleSelectedShape.x || 0;
        const shapeY_px = singleSelectedShape.y || 0;
        // points는 shape의 (x, y)에 대한 상대 좌표입니다.
        const points = singleSelectedShape.points || [0, 0, 0, 0];
        const [startX_rel_px, startY_rel_px, endX_rel_px, endY_rel_px] = points;

        // UI에 표시할 절대 좌표를 계산합니다.
        const startX_abs_px = shapeX_px + startX_rel_px;
        const startY_abs_px = shapeY_px + startY_rel_px;
        const endX_abs_px = shapeX_px + endX_rel_px;
        const endY_abs_px = shapeY_px + endY_rel_px;

        /**
         * 입력된 절대 좌표를 기반으로 shape의 x, y와 points를 업데이트하는 핸들러입니다.
         * 데이터 일관성을 위해 라인의 시작점을 (x,y)에 맞추고 points를 [0, 0, ...]으로 정규화합니다.
         */
        const handleAbsolutePointUpdate = (pointType: 'start' | 'end', axis: 'x' | 'y', value: string) => {
            const mmValue = parseFloat(value) || 0;
            const newAbsCoord_px = mmValue * pixelsPerMm;

            let newShapeX: number;
            let newShapeY: number;
            const newPoints = [0, 0, 0, 0]; // 정규화를 위해 [0, 0, ...]으로 시작

            if (pointType === 'start') {
                // 시작점이 변경되면, shape의 (x, y)를 새로운 시작점의 절대 좌표로 업데이트합니다.
                newShapeX = axis === 'x' ? newAbsCoord_px : startX_abs_px;
                newShapeY = axis === 'y' ? newAbsCoord_px : startY_abs_px;
                // 끝점의 절대 위치는 유지되어야 하므로, 새로운 shape (x,y)에 대한 상대 위치를 재계산합니다.
                newPoints[2] = endX_abs_px - newShapeX;
                newPoints[3] = endY_abs_px - newShapeY;
            } else { // pointType === 'end'
                // 끝점이 변경되면, 시작점의 절대 위치(즉, shape의 x, y)는 유지됩니다.
                newShapeX = startX_abs_px;
                newShapeY = startY_abs_px;
                // 새로운 끝점의 절대 좌표를 기준으로 상대 위치를 계산합니다.
                newPoints[2] = (axis === 'x' ? newAbsCoord_px : endX_abs_px) - newShapeX;
                newPoints[3] = (axis === 'y' ? newAbsCoord_px : endY_abs_px) - newShapeY;
            }

            if(singleSelectedShape.id){
                // Redux 스토어를 여러 속성으로 한번에 업데이트합니다.
                dispatch(updateShape({
                    id: singleSelectedShape.id,
                    updatedProps: {
                        x: newShapeX,
                        y: newShapeY,
                        points: newPoints,
                    }
                }));
            }
        };

        // 라인 길이를 계산합니다.
        const length_px = Math.sqrt(
            Math.pow(endX_abs_px - startX_abs_px, 2) +
            Math.pow(endY_abs_px - startY_abs_px, 2)
        );
        const length_mm = (length_px / pixelsPerMm).toFixed(2);

        return (
            <>
                {/* 시작점 좌표 */}
                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">시작점</Label>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-1">
                            <Label className="text-xs w-4">X</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={lineCoordinates.startX}
                                onChange={(e) => setLineCoordinates(prev => ({...prev, startX: e.target.value}))}
                                onBlur={(e) => handleAbsolutePointUpdate('start', 'x', e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="h-7 text-xs"
                            />
                            <span className="text-xs text-muted-foreground">mm</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Label className="text-xs w-4">Y</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={lineCoordinates.startY}
                                onChange={(e) => setLineCoordinates(prev => ({...prev, startY: e.target.value}))}
                                onBlur={(e) => handleAbsolutePointUpdate('start', 'y', e.target.value)}
                                onKeyDown={handleKeyDown}
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
                                value={lineCoordinates.endX}
                                onChange={(e) => setLineCoordinates(prev => ({...prev, endX: e.target.value}))}
                                onBlur={(e) => handleAbsolutePointUpdate('end', 'x', e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="h-7 text-xs"
                            />
                            <span className="text-xs text-muted-foreground">mm</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Label className="text-xs w-4">Y</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={lineCoordinates.endY}
                                onChange={(e) => setLineCoordinates(prev => ({...prev, endY: e.target.value}))}
                                onBlur={(e) => handleAbsolutePointUpdate('end', 'y', e.target.value)}
                                onKeyDown={handleKeyDown}
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
            </>
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
                                    singleSelectedShape.type === 'image') && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">가로</Label>
                                            <div className="flex items-center gap-1">
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    name="width"
                                                    value={dimensionInputs.width}
                                                    onFocus={(e) => e.target.select()}
                                                    onChange={(e) => setDimensionInputs(prev => ({...prev, width: e.target.value}))}
                                                    onBlur={(e) => handleDimensionUpdate('width', e.target.value)}
                                                    onKeyDown={handleKeyDown}
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
                                                    value={dimensionInputs.height}
                                                    onFocus={(e) => e.target.select()}
                                                    onChange={(e) => setDimensionInputs(prev => ({...prev, height: e.target.value}))}
                                                    onBlur={(e) => handleDimensionUpdate('height', e.target.value)}
                                                    onKeyDown={handleKeyDown}
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
                                                    value={dimensionInputs.radius}
                                                    onChange={(e) => setDimensionInputs(prev => ({...prev, radius: e.target.value}))}
                                                    onBlur={(e) => {
                                                        const mmValue = parseFloat(e.target.value) || 0;
                                                        const radiusInPx = mmValue * pixelsPerMm;
                                                        handlePropertyUpdate('radius', radiusInPx);
                                                        setDimensionInputs(prev => ({
                                                            ...prev,
                                                            radius: mmValue.toFixed(2),
                                                            diameter: (mmValue * 2).toFixed(2)
                                                        }));
                                                    }}
                                                    onKeyDown={handleKeyDown}
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
                                                    value={dimensionInputs.diameter}
                                                    onChange={(e) => setDimensionInputs(prev => ({...prev, diameter: e.target.value}))}
                                                    onBlur={(e) => {
                                                        const mmValue = parseFloat(e.target.value) || 0;
                                                        const radiusInPx = (mmValue / 2) * pixelsPerMm;
                                                        handlePropertyUpdate('radius', radiusInPx);
                                                        setDimensionInputs(prev => ({
                                                            ...prev,
                                                            radius: (mmValue / 2).toFixed(2),
                                                            diameter: mmValue.toFixed(2)
                                                        }));
                                                    }}
                                                    onKeyDown={handleKeyDown}
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
                                {singleSelectedShape.type !== 'line' && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground">X 위치</Label>
                                            <div className="flex items-center gap-1">
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    name="x"
                                                    value={dimensionInputs.x}
                                                    onFocus={(e) => e.target.select()}
                                                    onChange={(e) => setDimensionInputs(prev => ({...prev, x: e.target.value}))}
                                                    onBlur={(e) => handleDimensionUpdate('x', e.target.value)}
                                                    onKeyDown={handleKeyDown}
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
                                                    value={dimensionInputs.y}
                                                    onFocus={(e) => e.target.select()}
                                                    onChange={(e) => setDimensionInputs(prev => ({...prev, y: e.target.value}))}
                                                    onBlur={(e) => handleDimensionUpdate('y', e.target.value)}
                                                    onKeyDown={handleKeyDown}
                                                    className="h-7 text-xs"
                                                />
                                                <span className="text-xs text-muted-foreground">mm</span>
                                            </div>
                                        </div>
                                    </div>
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
                                            step="1"
                                            min="0"
                                            name="coatingOrder"
                                            value={coatingSettingInputs.coatingOrder}
                                            onChange={(e) => setCoatingSettingInputs(prev => ({...prev, coatingOrder: e.target.value}))}
                                            onBlur={(e) => handlePropertyUpdate('coatingOrder', parseInt(e.target.value) || 0)}
                                            onKeyDown={handleKeyDown}
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
