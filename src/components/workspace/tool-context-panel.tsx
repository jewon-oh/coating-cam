
"use client";

import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    MousePointer2,
    RectangleHorizontal as RectangleHorizontalIcon,
    Circle as CircleIcon,
    Info,
    MoveHorizontal,
    MoveVertical,
    SquaresUnite,
    SquareX,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { setTool, setCoatingType, setCoatingTypeAndFillPattern } from "@/store/slices/tool-slice";
import { cn } from "@/lib/utils";

export function ToolContextPanel() {
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
        travelAvoidanceStrategy,
        // 윤곽 관련 추가
        outlineType,
        outlinePasses,
        outlineInterval,
    } = useAppSelector((state) => state.tool);

    // 코팅 설정 변경 핸들러
    const handleCoatingSettingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        dispatch({
            type: 'tool/updateCoatingSettings',
            payload: { [name]: parseFloat(value) }
        });
    };

    // 코팅 설정 셀렉트 변경 핸들러
    const handleCoatingSettingSelectChange = (name: string, value: string) => {
        dispatch({
            type: 'tool/updateCoatingSettings',
            payload: { [name]: value }
        });
    };

    // 선택 도구인지 확인
    const isSelectTool = tool === 'select';

    const toolMeta = useMemo(() => {
        switch (tool) {
            case "select":
                return {
                    label: "선택 도구",
                    icon: <MousePointer2 className="w-3.5 h-3.5" />,
                    tips: [
                        "Shift: 다중 선택 / 범위 선택",
                        "Ctrl/Cmd: 개별 토글 선택",
                        "Delete: 선택 삭제",
                        "드래그: 객체 이동",
                    ],
                    desc: "객체 선택, 이동, 그룹 작업을 수행합니다.",
                };
            case "rectangle":
                return {
                    label: "사각형 도구",
                    icon: <RectangleHorizontalIcon className="w-3.5 h-3.5" />,
                    tips: [
                        // "Shift: 정사각형으로 고정",
                        // "Alt: 중심 기준으로 드래그",
                        "Esc: 도구 취소",
                    ],
                    desc: "캔버스에 사각형을 드래그해서 생성합니다.",
                };
            case "circle":
                return {
                    label: "원 도구",
                    icon: <CircleIcon className="w-3.5 h-3.5" />,
                    tips: [
                        // "Shift: 원형 유지", "Alt: 중심 기준으로 드래그",
                        "Esc: 도구 취소"
                    ],
                    desc: "캔버스에 원을 드래그해서 생성합니다.",
                };
            default:
                return {
                    label: "도구",
                    icon: <Info className="w-3.5 h-3.5" />,
                    tips: [],
                    desc: "현재 도구에 대한 정보와 옵션이 표시됩니다.",
                };
        }
    }, [tool]);

    // 코팅 설정 렌더링
    const renderCoatingSettings = () => {
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
                                        value={coatingWidth}
                                        onChange={handleCoatingSettingChange}
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
                                        value={lineSpacing}
                                        onChange={handleCoatingSettingChange}
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
                                        value={coatingSpeed}
                                        onChange={handleCoatingSettingChange}
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
                                        value={coatingHeight}
                                        onChange={handleCoatingSettingChange}
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
                                        value={coatingWidth}
                                        onChange={handleCoatingSettingChange}
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
                                        value={coatingSpeed}
                                        onChange={handleCoatingSettingChange}
                                        className="h-7 text-xs"
                                    />
                                    <span className="text-xs text-muted-foreground">mm/min</span>
                                </div>
                            </div>
                        </div>

                        {/* 두 번째 줄: 높이, 횟수 */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">코팅 높이</Label>
                                <div className="flex items-center gap-1">
                                    <Input
                                        type="number"
                                        step="0.01"
                                        name="coatingHeight"
                                        value={coatingHeight}
                                        onChange={handleCoatingSettingChange}
                                        className="h-7 text-xs"
                                    />
                                    <span className="text-xs text-muted-foreground">mm</span>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">윤곽 횟수</Label>
                                <div className="flex items-center gap-1">
                                    <Input
                                        type="number"
                                        min="1"
                                        name="outlinePasses"
                                        value={outlinePasses || 1}
                                        onChange={handleCoatingSettingChange}
                                        className="h-7 text-xs"
                                    />
                                    <span className="text-xs text-muted-foreground">회</span>
                                </div>
                            </div>
                        </div>

                        {/* 세 번째 줄: 오프셋, 윤곽 타입 */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">윤곽 타입</Label>
                                <Select
                                    value={outlineType || 'center'}
                                    onValueChange={(value) => handleCoatingSettingSelectChange('outlineType', value)}
                                >
                                    <SelectTrigger className="h-7 text-xs">
                                        <SelectValue />
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
                                        value={outlineInterval || 0}
                                        onChange={handleCoatingSettingChange}
                                        className="h-7 text-xs"
                                    />
                                    <span className="text-xs text-muted-foreground">mm</span>
                                </div>
                            </div>

                        </div>
                    </div>
                );

            case 'masking':
                return (
                    <div className="space-y-3">
                        {/* 첫 번째 줄: 높이, 여유거리 */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">코팅 높이</Label>
                                <div className="flex items-center gap-1">
                                    <Input
                                        type="number"
                                        step="0.01"
                                        name="coatingHeight"
                                        value={coatingHeight}
                                        onChange={handleCoatingSettingChange}
                                        className="h-7 text-xs"
                                    />
                                    <span className="text-xs text-muted-foreground">mm</span>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">여유 거리</Label>
                                <div className="flex items-center gap-1">
                                    <Input
                                        type="number"
                                        step="0.01"
                                        name="maskingClearance"
                                        value={maskingClearance || 0}
                                        onChange={handleCoatingSettingChange}
                                        className="h-7 text-xs"
                                    />
                                    <span className="text-xs text-muted-foreground">mm</span>
                                </div>
                            </div>
                        </div>

                        {/* 회피 전략 선택 */}
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">이동 회피 전략</Label>
                            <Select
                                value={travelAvoidanceStrategy}
                                onValueChange={(value) => handleCoatingSettingSelectChange('travelAvoidanceStrategy', value)}
                            >
                                <SelectTrigger className="h-7 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="global">전역 회피</SelectItem>
                                    <SelectItem value="lift">리프트</SelectItem>
                                    <SelectItem value="contour">윤곽 따라</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <Card className="h-full rounded-none border-0 gap-0">
            <CardHeader className="py-3 ">
                <div className="flex items-center gap-2">
                    {toolMeta.icon}
                    <CardTitle className="text-lg">{toolMeta.label}</CardTitle>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{toolMeta.desc}</p>
                {/* 도구 힌트 */}
                <div>
                    <div className="text-[11px] font-medium mb-2 text-muted-foreground">도구 힌트</div>
                    <ul className="space-y-1">
                        {toolMeta.tips.map((t, idx) => (
                            <li key={idx} className="text-xs text-muted-foreground flex items-center gap-2">
                                <Info className="w-3 h-3 opacity-70" />
                                {t}
                            </li>
                        ))}
                        {toolMeta.tips.length === 0 && (
                            <li className="text-xs text-muted-foreground">해당 도구에 대한 힌트가 없습니다.</li>
                        )}
                    </ul>
                </div>
            </CardHeader>
            <CardContent className="p-3 space-y-4">
                {/* 선택 도구가 아닐 때만 코팅 관련 설정 표시 */}
                {!isSelectTool && (
                    <>
                        <Separator />
                        {/* 코팅 타입 선택 */}
                        <div>
                            <div className="text-[11px] font-medium mb-2 text-muted-foreground">코팅 타입</div>
                            <div className="grid grid-cols-2 gap-1">
                                <Button
                                    variant={coatingType === 'fill' && fillPattern === 'horizontal' ? "default" : "outline"}
                                    size="sm"
                                    className={cn(
                                        "h-8 text-xs justify-start",
                                        coatingType === 'fill' && fillPattern === 'horizontal' && "bg-sky-500 hover:bg-sky-600"
                                    )}
                                    onClick={() => dispatch(setCoatingTypeAndFillPattern({
                                        coatingType: 'fill',
                                        fillPattern: 'horizontal'
                                    }))}
                                >
                                    <MoveHorizontal className="w-3.5 h-3.5 mr-1" />
                                    수평채우기
                                </Button>
                                <Button
                                    variant={coatingType === 'fill' && fillPattern === 'vertical' ? "default" : "outline"}
                                    size="sm"
                                    className={cn(
                                        "h-8 text-xs justify-start",
                                        coatingType === 'fill' && fillPattern === 'vertical' && "bg-sky-500 hover:bg-sky-600"
                                    )}
                                    onClick={() => dispatch(setCoatingTypeAndFillPattern({
                                        coatingType: 'fill',
                                        fillPattern: 'vertical'
                                    }))}
                                >
                                    <MoveVertical className="w-3.5 h-3.5 mr-1" />
                                    수직채우기
                                </Button>
                                <Button
                                    variant={coatingType === 'outline' ? "default" : "outline"}
                                    size="sm"
                                    className={cn(
                                        "h-8 text-xs justify-start",
                                        coatingType === 'outline' && "bg-yellow-500 hover:bg-yellow-600"
                                    )}
                                    onClick={() => dispatch(setCoatingType('outline'))}
                                >
                                    <SquaresUnite className="w-3.5 h-3.5 mr-1" />
                                    윤곽
                                </Button>
                                <Button
                                    variant={coatingType === 'masking' ? "default" : "outline"}
                                    size="sm"
                                    className={cn(
                                        "h-8 text-xs justify-start",
                                        coatingType === 'masking' && "bg-red-500 hover:bg-red-600"
                                    )}
                                    onClick={() => dispatch(setCoatingType('masking'))}
                                >
                                    <SquareX className="w-3.5 h-3.5 mr-1" />
                                    마스킹
                                </Button>
                            </div>
                        </div>

                        <Separator />

                        {/* 코팅 설정 */}
                        <div>
                            <div className="flex items-center gap-2 mb-3">

                                <div className="text-[11px] font-medium text-muted-foreground">
                                    {coatingType === 'fill' ? '채우기' :
                                        coatingType === 'outline' ? '윤곽' : '마스킹'} 설정
                                </div>
                            </div>

                            {renderCoatingSettings()}
                        </div>
                    </>
                )}

                <Separator />

                {/* 빠른 도구 전환 */}
                <div className="space-y-2">
                    <div className="text-[11px] font-medium text-muted-foreground">빠른 작업</div>
                    {isSelectTool ? (
                        <div className="grid grid-cols-2 gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs justify-start"
                                onClick={() => dispatch(setTool("rectangle"))}
                            >
                                <RectangleHorizontalIcon className="w-3.5 h-3.5 mr-1" />
                                사각형
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs justify-start"
                                onClick={() => dispatch(setTool("circle"))}
                            >
                                <CircleIcon className="w-3.5 h-3.5 mr-1" />
                                원
                            </Button>
                        </div>
                    ) : (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs w-full"
                            onClick={() => dispatch(setTool("select"))}
                        >
                            <MousePointer2 className="w-3.5 h-3.5 mr-1" />
                            선택 도구로 전환
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

export default ToolContextPanel;