
"use client";

import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    MousePointer2,
    RectangleHorizontal as RectangleHorizontalIcon,
    Circle as CircleIcon,
    Info,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { setTool } from "@/store/slices/tool-slice";
import { cn } from "@/lib/utils";

export function ToolContextPanel() {
    const dispatch = useAppDispatch();
    const tool = useAppSelector((state) => state.tool.tool);


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
                    ],
                    desc: "객체 선택, 이동, 그룹 작업을 수행합니다.",
                };
            case "rectangle":
                return {
                    label: "사각형 도구",
                    icon: <RectangleHorizontalIcon className="w-3.5 h-3.5" />,
                    tips: [
                        "Shift: 정사각형으로 고정",
                        "Alt: 중심 기준으로 드래그",
                        "Esc: 도구 취소",
                    ],
                    desc: "캔버스에 사각형을 드래그해서 생성합니다.",
                };
            case "circle":
                return {
                    label: "원 도구",
                    icon: <CircleIcon className="w-3.5 h-3.5" />,
                    tips: ["Shift: 원형 유지", "Alt: 중심 기준으로 드래그", "Esc: 도구 취소"],
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

    return (
        <Card className="h-full rounded-none border-0">
            <CardHeader className="py-3">
                <div className="flex items-center gap-2 ">
                    {toolMeta.icon}
                    <CardTitle className="text-lg">{toolMeta.label}</CardTitle>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{toolMeta.desc}</p>
            </CardHeader>
            <Separator />
            <CardContent className="p-3 space-y-4">
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

                <Separator />

                <div className="space-y-2">
                    <div className="text-[11px] font-medium text-muted-foreground">빠른 작업</div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className={cn("h-7 text-xs flex-1", tool === "select" && "border-primary/50")}
                            onClick={() => dispatch(setTool("select"))}
                        >
                            <MousePointer2 className="w-3.5 h-3.5 mr-1" />
                            선택 도구
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default ToolContextPanel;