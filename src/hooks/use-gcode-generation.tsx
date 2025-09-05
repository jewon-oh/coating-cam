"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { useSettings } from '@/contexts/settings-context';
import {ExternalToast, toast} from 'sonner';
import { generateGcode } from '@/lib/gcode/generate-gcode';
import { setGCode } from '@/store/slices/gcode-slice';
import { Progress } from "@/components/ui/progress";

/**
 * G-Code 생성 진행률을 표시하는 토스트 컴포넌트
 */
const GCodeGenerationToast = ({ progress, message }: { progress: number; message: string }) => (
    <div className="flex flex-col gap-2 w-full">
        <div className="text-sm">{message}</div>
        <Progress value={progress} className="h-2" />
    </div>
);

/**
 * G-Code 생성 완료 정보를 표시하는 토스트 컴포넌트 (사라지는 시간 인디케이터 포함)
 */
const SuccessToastDescription = ({ duration, completionTime, autoCloseDuration }: { duration: string; completionTime: string; autoCloseDuration: number; }) => {
    const [progress, setProgress] = useState(100);

    useEffect(() => {
        if (autoCloseDuration && autoCloseDuration !== Infinity) {
            const interval = setInterval(() => {
                setProgress(prev => {
                    const next = prev - (100 / (autoCloseDuration / 100));
                    if (next <= 0) {
                        clearInterval(interval);
                        return 0;
                    }
                    return next;
                });
            }, 100);

            return () => clearInterval(interval);
        }
    }, [autoCloseDuration]);


    return (
        <div className="flex flex-col gap-1 text-sm">
            <span>총 소요 시간: {duration}초</span>
            <span>완료 시간: {completionTime}</span>
            <span className="text-xs text-muted-foreground mt-2">
                미리보기 페이지로 이동하여 결과를 확인하세요.
            </span>
            {/* 💡 React state와 동기화되는 인디케이터 바 */}
            <div className="relative h-1 w-full bg-muted rounded-full overflow-hidden mt-2">
                <div
                    className="absolute top-0 left-0 h-full bg-primary transition-all duration-100 ease-linear"
                    style={{ width: `${progress}%` }}
                ></div>
            </div>
        </div>
    );
};

/**
 * G-Code 텍스트를 3D 경로 배열로 파싱하는 헬퍼 함수
 * @param gcodeText - 파싱할 G-Code 문자열
 * @returns 3D 좌표 배열 (number[][])
 */
const parseGCodeToPath = (gcodeText: string): number[][] => {
    const lines = gcodeText.split('\n');
    const path: number[][] = [];
    let currentX = 0;
    let currentY = 0;
    let currentZ = 5;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('G')) continue;

        if (trimmed.startsWith('G0') || trimmed.startsWith('G1')) {
            const xMatch = trimmed.match(/X([+-]?\d*\.?\d+)/);
            const yMatch = trimmed.match(/Y([+-]?\d*\.?\d+)/);
            const zMatch = trimmed.match(/Z([+-]?\d*\.?\d+)/);

            if (xMatch) currentX = parseFloat(xMatch[1]);
            if (yMatch) currentY = parseFloat(yMatch[1]);
            if (zMatch) currentZ = parseFloat(zMatch[1]);

            path.push([ currentX, currentY, currentZ]);
        }
    }

    return path;
};

/**
 * G-Code 생성 로직을 캡슐화한 커스텀 훅.
 * 진행률 표시, 성공/실패 알림, Redux 상태 업데이트를 포함합니다.
 */
export function useGCodeGeneration() {
    const dispatch = useAppDispatch();
    const router = useRouter();
    const shapes = useAppSelector((state) => state.shapes.shapes);
    const { gcodeSettings, workArea, gcodeSnippets } = useSettings();

    const generate = useCallback(async (options?: { isRegeneration?: boolean, onSuccess?: () => void }) => {
        if (shapes.length === 0) {
            toast.error("G-Code를 생성할 도형이 없습니다.");
            return;
        }

        const startTime = Date.now();
        const isRegeneration = options?.isRegeneration ?? false;

        const initialMessage = isRegeneration ? "G-Code 재생성 중..." : "G-Code 생성 준비 중...";
        const initialDescription = isRegeneration ? "최신 도형 데이터로 업데이트합니다..." : "잠시만 기다려주세요...";

        const toastId = toast.loading(
            <GCodeGenerationToast progress={0} message={initialMessage} />,
            { description: initialDescription }
        );

        try {
            const mapProgress = (
                rawPercent: number,
                message: string,
                totals: { pathIndex?: number; pathTotal?: number; areaIndex?: number; areaTotal?: number }
            ) => {
                const START_INIT = 0, END_INIT = 5, START_PATHS = 5, END_PATHS = 95;
                const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
                const pIdx = totals.pathIndex ?? 0, pTot = totals.pathTotal ?? 0;
                if (pTot > 0) {
                    const perPathSpan = (END_PATHS - START_PATHS) / pTot;
                    const pathStart = START_PATHS + (pIdx - 1) * perPathSpan;
                    const pathEnd = pathStart + perPathSpan;
                    let withinPathRatio: number;
                    const areaMatch = /영역\s+(\d+)\s*\/\s*(\d+)/.exec(message);
                    if (areaMatch) {
                        const ai = Number(areaMatch[1]), at = Number(areaMatch[2]);
                        withinPathRatio = at > 0 ? ai / at : rawPercent / 100;
                    } else {
                        withinPathRatio = rawPercent / 100;
                    }
                    const overall = pathStart + (pathEnd - pathStart) * withinPathRatio;
                    return clamp(overall, START_PATHS, END_PATHS);
                }
                return clamp(START_INIT + (END_INIT - START_INIT) * (rawPercent / 100), START_INIT, END_INIT);
            };

            let currentPathIndex = 0, totalPaths = 0;

            const onProgress = (raw: number, message: string) => {
                const pathMatch = /(\d+)\s*\/\s*(\d+)\s*경로\s*계산\s*중/.exec(message);
                if (pathMatch) { currentPathIndex = Number(pathMatch[1]); totalPaths = Number(pathMatch[2]); }
                const areaMatch = /영역\s+(\d+)\s*\/\s*(\d+)/.exec(message);
                const areaIndex = areaMatch ? Number(areaMatch[1]) : undefined;
                const areaTotal = areaMatch ? Number(areaMatch[2]) : undefined;
                const overall = mapProgress(raw, message, { pathIndex: currentPathIndex || undefined, pathTotal: totalPaths || undefined, areaIndex, areaTotal });
                toast.loading(<GCodeGenerationToast progress={overall} message={`[${Math.round(overall)}%] ${message}`} />, { id: toastId, description: "작업이 백그라운드에서 실행 중입니다." });
            };

            const gcode = await generateGcode(shapes, gcodeSettings, workArea, gcodeSnippets, onProgress);
            const path = parseGCodeToPath(gcode);
            dispatch(setGCode({ gcode, path }));

            const endTime = Date.now();
            const duration = ((endTime - startTime) / 1000).toFixed(2);
            const completionTime = new Date(endTime).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

            const autoCloseDuration = 10000; // 10초

            const successToastOptions: ExternalToast = {
                id: toastId,
                description: <SuccessToastDescription duration={duration} completionTime={completionTime} autoCloseDuration={autoCloseDuration} />,
                cancel: { label: "닫기", onClick: () => toast.dismiss(toastId) },
                duration: autoCloseDuration,
            };

            if (!isRegeneration) {
                successToastOptions.action = { label: "바로가기", onClick: () => { toast.dismiss(toastId); router.push('/preview'); } };
            }

            toast.success("G-Code 생성 완료!", successToastOptions);
            options?.onSuccess?.();

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('G-code 생성 중 오류:', errorMessage);
            toast.error("G-Code 생성 실패", { id: toastId, description: errorMessage });
        }
    }, [shapes, gcodeSettings, workArea, gcodeSnippets, dispatch, router]);

    return { generate };
}
