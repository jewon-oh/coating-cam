
"use client";

import React, {  useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { useAppSelector, useAppDispatch } from '@/hooks/redux';
import { updateShape, batchUpdateShapes } from '@/store/slices/shapes-slice';
import { AnyNodeConfig } from '@/types/custom-konva-config';
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
    RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {Separator} from "@radix-ui/react-menu";

interface PropertyPanelProps {
    className?: string;
}

export function PropertyPanel({ className }: PropertyPanelProps) {
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
            listening: selectedShapes.every(s => s.listening === first.listening) ? first.listening : undefined,
        };

        return common;
    }, [selectedShapes]);

    // 속성 업데이트 핸들러
    const handlePropertyUpdate = (property: string, value: any) => {
        if (selectedShapeIds.length === 0) return;

        if (selectedShapeIds.length === 1) {
            dispatch(updateShape({
                id: selectedShapeIds[0],
                updatedProps: { [property]: value }
            }));
        } else {
            // 다중 선택 시 배치 업데이트
            const updates = selectedShapeIds.map(id => ({
                id,
                props: { [property]: value }
            }));
            dispatch(batchUpdateShapes(updates));
        }
    };

    // 객체 속성 렌더링
    const renderObjectProperties = () => {
        if (selectedShapes.length === 0) {
            return (
                <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                        객체를 선택하여 속성을 편집하세요.
                    </p>
                </div>
            );
        }

        if (selectedShapes.length === 1) {
            // 단일 객체 속성
            const shape = singleSelectedShape!;
            const shapeIcon = {
                rectangle: <Square className="w-3 h-3" />,
                circle: <CircleIcon className="w-3 h-3" />,
                image: <ImageIcon className="w-3 h-3" />,
                group: <Layers className="w-3 h-3" />
            }[shape.type] || <Square className="w-3 h-3" />;

            return (
                <div className="space-y-2.5">
                    <div className="flex items-center space-x-2">
                        {shapeIcon}
                        <h4 className="text-xs font-medium">{shape.name || shape.type}</h4>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 h-auto">
                            {shape.type}
                        </Badge>
                    </div>

                    {/* 기본 속성 */}
                    <div className="grid grid-cols-2 gap-1.5">
                        <div>
                            <Label htmlFor="obj-x" className="text-xs">X</Label>
                            <Input
                                id="obj-x"
                                type="number"
                                value={Math.round(shape.x || 0)}
                                onChange={(e) => handlePropertyUpdate('x', parseFloat(e.target.value) || 0)}
                                className="h-6 text-xs px-2"
                            />
                        </div>
                        <div>
                            <Label htmlFor="obj-y" className="text-xs">Y</Label>
                            <Input
                                id="obj-y"
                                type="number"
                                value={Math.round(shape.y || 0)}
                                onChange={(e) => handlePropertyUpdate('y', parseFloat(e.target.value) || 0)}
                                className="h-6 text-xs px-2"
                            />
                        </div>
                    </div>

                    {/* 크기 속성 - 사각형, 이미지 공통 */}
                    {(shape.type === 'rectangle' || shape.type === 'image') && (
                        <div className="grid grid-cols-2 gap-1.5">
                            <div>
                                <Label htmlFor="obj-width" className="text-xs">너비</Label>
                                <Input
                                    id="obj-width"
                                    type="number"
                                    value={Math.round(shape.width || 0)}
                                    onChange={(e) => handlePropertyUpdate('width', parseFloat(e.target.value) || 0)}
                                    className="h-6 text-xs px-2"
                                />
                            </div>
                            <div>
                                <Label htmlFor="obj-height" className="text-xs">높이</Label>
                                <Input
                                    id="obj-height"
                                    type="number"
                                    value={Math.round(shape.height || 0)}
                                    onChange={(e) => handlePropertyUpdate('height', parseFloat(e.target.value) || 0)}
                                    className="h-6 text-xs px-2"
                                />
                            </div>
                        </div>
                    )}

                    {/* 원 반지름 */}
                    {shape.type === 'circle' && (
                        <div>
                            <Label htmlFor="obj-radius" className="text-xs">반지름</Label>
                            <Input
                                id="obj-radius"
                                type="number"
                                value={Math.round(shape.radius || 0)}
                                onChange={(e) => handlePropertyUpdate('radius', parseFloat(e.target.value) || 0)}
                                className="h-6 text-xs px-2"
                            />
                        </div>
                    )}
                    {/* 회전 - 모든 도형 타입 */}
                    {shape.rotation !== undefined && (
                        <div>
                            <div className="flex items-center space-x-2 mb-1">
                                <RotateCcw className="w-3 h-3" />
                                <Label className="text-xs">회전: {Math.round(shape.rotation || 0)}°</Label>
                            </div>
                            <Slider
                                value={[shape.rotation || 0]}
                                onValueChange={([value]) => handlePropertyUpdate('rotation', value)}
                                min={-180}
                                max={180}
                                step={1}
                                className="w-full"
                            />
                        </div>
                    )}

                    {/* 가시성 및 잠금 - 모든 도형 타입 */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1.5">
                                {shape.visible !== false ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                <Label className="text-xs">표시</Label>
                            </div>
                            <Switch
                                checked={shape.visible !== false}
                                onCheckedChange={(checked) => handlePropertyUpdate('visible', checked)}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1.5">
                                {shape.listening ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                                <Label className="text-xs">잠금</Label>
                            </div>
                            <Switch
                                checked={shape.listening || false}
                                onCheckedChange={(checked) => handlePropertyUpdate('listening', checked)}
                            />
                        </div>
                    </div>

                    {/* 코팅 설정 - 모든 도형 타입 */}
                    {(shape.type === 'rectangle' || shape.type === 'circle' || shape.type === 'image') && (
                        <div className="space-y-2">
                            <div className="flex items-center space-x-1.5 mb-1">
                                <Settings className="w-3 h-3" />
                                <Label className="text-xs font-medium">코팅 설정</Label>
                            </div>

                            <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center space-x-1.5">
                                    <Switch
                                        checked={shape.useCustomCoating || false}
                                        onCheckedChange={(checked) => handlePropertyUpdate('useCustomCoating', checked)}
                                    />
                                    <Label className="text-xs">개별 설정</Label>
                                </div>
                            </div>

                            <Separator  />
                            <div>
                                <Label htmlFor="coating-height" className="text-xs">
                                    코팅 높이 (mm)
                                    {!shape.useCustomCoating && (
                                        <span className="text-muted-foreground ml-1">
                                            (기본값: {gcodeSettings.coatingHeight})
                                        </span>
                                    )}
                                </Label>
                                <Input
                                    id="coating-height"
                                    type="number"
                                    step="0.01"
                                    value={shape.useCustomCoating ? (shape.coatingHeight || '') : ''}
                                    onChange={(e) => handlePropertyUpdate('coatingHeight', parseFloat(e.target.value) || gcodeSettings.coatingHeight)}
                                    className="h-6 text-xs px-2"
                                    placeholder={`기본값: ${gcodeSettings.coatingHeight}`}
                                    disabled={!shape.useCustomCoating}
                                />
                            </div>
                            {/* 테두리 코팅 설정 - 사각형과 원만 */}
                            {(shape.type === 'rectangle' || shape.type === 'circle') && (
                                <div className="space-y-2 pt-2 border-t border-muted">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div className="flex items-center space-x-1.5">
                                            <Switch
                                                checked={shape.enableOutlineCoating || false}
                                                onCheckedChange={(checked) => handlePropertyUpdate('enableOutlineCoating', checked)}
                                            />
                                            <Label className="text-xs">테두리 코팅</Label>
                                        </div>
                                    </div>

                                    {shape.enableOutlineCoating && (
                                        <div className="space-y-2 pl-4 border-l border-muted">
                                            <div>
                                                <Label htmlFor="outline-passes" className="text-xs">코팅 회수</Label>
                                                <Input
                                                    id="outline-passes"
                                                    type="number"
                                                    min="1"
                                                    max="10"
                                                    value={shape.outlineCoatingPasses || 1}
                                                    onChange={(e) => handlePropertyUpdate('outlineCoatingPasses', parseInt(e.target.value) || 1)}
                                                    className="h-6 text-xs px-2"
                                                />
                                            </div>

                                            <div>
                                                <Label htmlFor="outline-offset" className="text-xs">오프셋 (mm)</Label>
                                                <Input
                                                    id="outline-offset"
                                                    type="number"
                                                    step="0.1"
                                                    value={shape.outlineCoatingOffset || 0}
                                                    onChange={(e) => handlePropertyUpdate('outlineCoatingOffset', parseFloat(e.target.value) || 0)}
                                                    className="h-6 text-xs px-2"
                                                    placeholder="0"
                                                />
                                            </div>

                                            <div>
                                                <Label htmlFor="outline-speed" className="text-xs">
                                                    속도 (mm/min)
                                                    <span className="text-muted-foreground ml-1">
                                                        (기본값: {gcodeSettings.coatingSpeed})
                                                    </span>
                                                </Label>
                                                <Input
                                                    id="outline-speed"
                                                    type="number"
                                                    value={shape.outlineCoatingSpeed || ''}
                                                    onChange={(e) => handlePropertyUpdate('outlineCoatingSpeed', parseFloat(e.target.value) || gcodeSettings.coatingSpeed)}
                                                    className="h-6 text-xs px-2"
                                                    placeholder={`기본값: ${gcodeSettings.coatingSpeed}`}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}


                </div>
            );
        } else {
            // 다중 선택 속성 - 기존 코드 유지
            return (
                <div className="space-y-2.5">
                    <div className="flex items-center space-x-2">
                        <Layers className="w-3 h-3" />
                        <h4 className="text-xs font-medium">다중 선택</h4>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 h-auto">
                            {selectedShapes.length}개 객체
                        </Badge>
                    </div>

                    {/* 코팅 가능한 도형들만 필터링 */}
                    {selectedShapes.some(s => s.type === 'rectangle' || s.type === 'circle' || s.type === 'image') && (
                        <div className="space-y-2">
                            <div className="flex items-center space-x-1.5 mb-1">
                                <Settings className="w-3 h-3" />
                                <Label className="text-xs font-medium">코팅 설정</Label>
                            </div>

                            <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center space-x-1.5">
                                    <Switch
                                        checked={selectedShapes.some(s => s.useCustomCoating)}
                                        onCheckedChange={(checked) => handlePropertyUpdate('useCustomCoating', checked)}
                                    />
                                    <Label className="text-xs">개별 설정</Label>
                                </div>
                            </div>

                            <div>
                                <Label className="text-xs">
                                    코팅 높이 (mm)
                                    <span className="text-muted-foreground ml-1">
                                        (프로젝트 기본값: {gcodeSettings.coatingHeight})
                                    </span>
                                </Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    onChange={(e) => handlePropertyUpdate('coatingHeight', parseFloat(e.target.value) || gcodeSettings.coatingHeight)}
                                    className="h-6 text-xs px-2"
                                    placeholder={`기본값: ${gcodeSettings.coatingHeight}`}
                                />
                            </div>

                        </div>
                    )}


                    {/* 공통 속성만 표시 */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1.5">
                                <Eye className="w-3 h-3" />
                                <Label className="text-xs">표시</Label>
                            </div>
                            <Switch
                                checked={commonProperties?.visible !== false}
                                onCheckedChange={(checked) => handlePropertyUpdate('visible', checked)}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1.5">
                                <Lock className="w-3 h-3" />
                                <Label className="text-xs">잠금</Label>
                            </div>
                            <Switch
                                checked={commonProperties?.listening || false}
                                onCheckedChange={(checked) => handlePropertyUpdate('listening', checked)}
                            />
                        </div>
                    </div>
                </div>
            );
        }
    };
    return (
        <Card className={cn("h-full rounded-none border-0 flex flex-col ", className)}>
            <CardHeader className="px-3 py-0.5">
                <CardTitle className="text-lg flex items-center space-x-2">
                    <Settings className="w-3 h-3" />
                    <span>속성</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 px-3 py-2 space-y-3">
                {/* 객체 속성 섹션 */}
                <div>
                    <h3 className="text-xs font-medium text-muted-foreground mb-1.5">객체 속성</h3>
                    {renderObjectProperties()}
                </div>
            </CardContent>
        </Card>
    );


}