"use client";

import React, {useState, useEffect, useMemo, useRef} from 'react';
import {useAppSelector} from '@/hooks/redux';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {ScrollArea} from '@/components/ui/scroll-area';
import {ResizableHandle, ResizablePanel, ResizablePanelGroup} from '@/components/ui/resizable';
import {Slider} from '@/components/ui/slider';
import {Download, FileText, Play, RotateCcw, ChevronLeft, ChevronRight, Pause} from 'lucide-react';
import Preview3D, {PathPoint} from '@/components/preview-3d/preview-3d';
import {CustomShapeConfig} from "@/types/custom-konva-config";

/**
 * G0/G1 라인에서 좌표 추출
 */
function parseGMove(line: string, init: { x: number; y: number; z: number }) {
    let { x, y, z } = init;
    const xMatch = line.match(/X([+-]?\d*\.?\d+)/i);
    const yMatch = line.match(/Y([+-]?\d*\.?\d+)/i);
    const zMatch = line.match(/Z([+-]?\d*\.?\d+)/i);
    if (xMatch) x = parseFloat(xMatch[1]);
    if (yMatch) y = parseFloat(yMatch[1]);
    if (zMatch) z = parseFloat(zMatch[1]);
    return { x, y, z };
}

/**
 * G-code를 경로 데이터 객체의 배열로 파싱
 */
function parseGCodeToPathData(gcodeText: string): PathPoint[] {
    const lines = gcodeText?.split('\n') ?? [];
    const path: PathPoint[] = [];
    let x = 0, y = 0, z = 2; // 초기 위치

    lines.forEach((raw, idx) => {
        const trimmed = raw.trim();
        if (!trimmed) return;
        const code = trimmed.split(';')[0].trim();
        if (!code) return;
        if (!/^G/i.test(code)) return;

        const isG0 = /^G0(?:\s|$)/i.test(code) || /^G00(?:\s|$)/i.test(code);
        const isG1 = /^G1(?:\s|$)/i.test(code) || /^G01(?:\s|$)/i.test(code);
        if (!isG0 && !isG1) return;

        const next = parseGMove(code, { x, y, z });
        x = next.x; y = next.y; z = next.z;
        path.push({ pos: [x, y, z], isG1, line: idx });
    });
    return path;
}

/**
 * G-code 미리보기 및 내보내기 페이지
 * Redux 스토어에서 G-code를 가져와서 3D로 미리보기 제공
 */
export default function PreviewPage() {
    // const dispatch = useAppDispatch();
    const shapes = useAppSelector((state) => state.shapes.shapes);
    const {gcode,  isGenerating, lastGenerated} = useAppSelector((state) => state.gcode);
    // const {workArea} = useSettings();

    // G-code를 파싱하여 경로 데이터 생성
    const localPathData = useMemo(() => parseGCodeToPathData(gcode || ''), [gcode]);
    const maxStep = Math.max(0, localPathData.length - 1);
    const [step, setStep] = useState<number>(0);

    // G-code가 로드되면 마지막 스텝으로 초기화
    useEffect(() => {
        if (maxStep > 0) {
            setStep(maxStep);
        }
    }, [maxStep]);

    // 애니메이션 상태
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const animationRef = useRef<NodeJS.Timeout | null>(null);

    // 스크롤 관련 ref
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const activeLineRef = useRef<HTMLPreElement>(null);

    // 3D 툴헤드 포즈
    const [toolheadPos, setToolheadPos] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0]);

    // 이미지 shapes만 필터링
    const imageShapes = useMemo(() =>
            shapes.filter((shape): shape is Extract<CustomShapeConfig, { type: 'image' }> =>
                shape.type === 'image'
            ),
        [shapes]
    );

    // 슬라이더 변경 시 툴헤드 위치 반영
    useEffect(() => {
        if (localPathData.length === 0) return;
        const clampedStep = Math.min(step, maxStep);
        const { pos: [x, y, z] } = localPathData[clampedStep];
        setToolheadPos([x, y, z, 0, 0, 0, 0, 0]);
    }, [step, localPathData, maxStep]);

    // 슬라이더 수동 조작 시 애니메이션 정지
    const handleSliderChange = (value: number[]) => {
        if (isPlaying) {
            setIsPlaying(false);
            if (animationRef.current) {
                clearInterval(animationRef.current);
                animationRef.current = null;
            }
        }
        setStep(value[0] ?? 0);
    };

    // 컴포넌트 언마운트 시 정리
    useEffect(() => {
        return () => {
            if (animationRef.current) {
                clearInterval(animationRef.current);
            }
        };
    }, []);


    // G-code 다운로드 함수
    const handleDownloadGCode = () => {
        if (!gcode) return;

        const blob = new Blob([gcode], {type: 'text/plain'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gcode_${new Date().getTime()}.nc`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // 애니메이션 재생/정지 토글
    const handlePlayAnimation = () => {
        if (localPathData.length === 0) return;

        if (isPlaying) {
            // 애니메이션 일시정지
            setIsPlaying(false);
            if (animationRef.current) {
                clearInterval(animationRef.current);
                animationRef.current = null;
            }
        } else {
            // 애니메이션 시작 또는 재개
            setIsPlaying(true);
            let currentStep = step;

            // 만약 애니메이션이 끝에 도달했다면 처음부터 다시 시작
            if (currentStep >= maxStep) {
                currentStep = 0;
                setStep(0);
            }

            animationRef.current = setInterval(() => {
                currentStep++;
                if (currentStep <= maxStep) {
                    setStep(currentStep);
                } else {
                    // 애니메이션 완료되면 정지
                    setIsPlaying(false);
                    if (animationRef.current) {
                        clearInterval(animationRef.current);
                        animationRef.current = null;
                    }
                }
            }, 100); // 100ms 간격으로 스텝 진행
        }
    };

    // 툴헤드 위치 리셋 함수
    const handleResetPosition = () => {
        // 애니메이션 정지
        if (isPlaying) {
            setIsPlaying(false);
            if (animationRef.current) {
                clearInterval(animationRef.current);
                animationRef.current = null;
            }
        }

        setStep(0);
        if (localPathData.length > 0) {
            const [x, y, z] = localPathData[0].pos;
            setToolheadPos([x, y, z, 0, 0, 0, 0, 0]);
        } else {
            setToolheadPos([0, 0, 0, 0, 0, 0, 0, 0]);
        }
    };

    // 이전 스텝
    const handlePrevStep = () => {
        if (isPlaying) {
            setIsPlaying(false);
            if (animationRef.current) {
                clearInterval(animationRef.current);
                animationRef.current = null;
            }
        }
        setStep((s) => Math.max(0, s - 1));
    };

    // 다음 스텝
    const handleNextStep = () => {
        if (isPlaying) {
            setIsPlaying(false);
            if (animationRef.current) {
                clearInterval(animationRef.current);
                animationRef.current = null;
            }
        }
        setStep((s) => Math.min(maxStep, s + 1));
    };



    // G-code 통계 계산
    const gcodeStats = useMemo(() => {
        if (!gcode) return {totalLines: 0, gCommands: 0, mCommands: 0, estimatedTime: 0};

        const lines = gcode.split('\n').filter(line => line.trim().length > 0);
        return {
            totalLines: lines.length,
            gCommands: lines.filter(line => line.trim().startsWith('G')).length,
            mCommands: lines.filter(line => line.trim().startsWith('M')).length,
            estimatedTime: Math.ceil(lines.length * 0.1)
        };
    }, [gcode]);

    // 현재 스텝에 해당하는 원본 G-code 라인 인덱스
    const highlightedLineIndex = useMemo(() => {
        if (!gcode || localPathData.length === 0) return -1;
        const clampedStep = Math.min(step, maxStep);
        return localPathData[clampedStep]?.line ?? -1;
    }, [gcode, step, maxStep, localPathData]);

    // 하이라이트된 라인으로 자동 스크롤
    useEffect(() => {
        if (activeLineRef.current && scrollAreaRef.current) {
            const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                const activeElement = activeLineRef.current;
                const containerRect = scrollContainer.getBoundingClientRect();
                const activeRect = activeElement.getBoundingClientRect();

                if (activeRect.top < containerRect.top || activeRect.bottom > containerRect.bottom) {
                    activeElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                        inline: 'nearest'
                    });
                }
            }
        }
    }, [highlightedLineIndex]);



    // G-code가 없고 도형도 없는 경우
    if (!gcode && shapes.length === 0) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-background text-foreground">
                <Card className="w-96">
                    <CardContent className="text-center p-8">
                        <FileText className="mx-auto h-16 w-16 text-muted-foreground mb-4"/>
                        <h3 className="text-xl font-semibold mb-2">G-code가 없습니다</h3>
                        <p className="text-muted-foreground mb-4">
                            캔버스에서 도형을 생성하고 G-code를 생성하세요.
                        </p>
                        <Button onClick={() => window.history.back()}>
                            캔버스로 돌아가기
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="h-full w-full flex bg-background text-foreground">
            <ResizablePanelGroup direction="horizontal" className="h-full w-full">
                {/* 좌측 패널: G-code 정보 및 제어 */}
                <ResizablePanel defaultSize={25} minSize={20}>
                    <div className="h-full flex flex-col p-4 gap-4">
                        {/* 헤더 */}
                        <div>
                            <h1 className="text-xl font-bold mb-2">G-code 미리보기</h1>
                            <p className="text-sm text-muted-foreground">
                                3D로 경로를 미리보기하고 다운로드
                            </p>
                            {lastGenerated && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    생성 시간: {new Date(lastGenerated).toLocaleTimeString()}
                                </p>
                            )}
                        </div>

                        {/* 통계 정보 */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">정보</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>도형 수:</span>
                                    <span>{shapes.length}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>G-code 라인:</span>
                                    <span>{gcodeStats.totalLines}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>예상 시간:</span>
                                    <span>{Math.floor(gcodeStats.estimatedTime / 60)}분 {gcodeStats.estimatedTime % 60}초</span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 제어 버튼 */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">제어</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <Button
                                    onClick={handlePlayAnimation}
                                    disabled={!gcode || localPathData.length === 0}
                                    className="w-full"
                                    variant="outline"
                                >
                                    {isPlaying ? (
                                        <>
                                            <Pause className="w-4 h-4 mr-2"/>
                                            애니메이션 정지
                                        </>
                                    ) : (
                                        <>
                                            <Play className="w-4 h-4 mr-2"/>
                                            애니메이션 재생
                                        </>
                                    )}
                                </Button>
                                <Button
                                    onClick={handleResetPosition}
                                    disabled={!gcode}
                                    className="w-full"
                                    variant="outline"
                                >
                                    <RotateCcw className="w-4 h-4 mr-2"/>
                                    위치 리셋
                                </Button>
                                <Button
                                    onClick={handleDownloadGCode}
                                    disabled={!gcode || isGenerating}
                                    className="w-full"
                                >
                                    <Download className="w-4 h-4 mr-2"/>
                                    다운로드
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </ResizablePanel>

                <ResizableHandle withHandle/>

                {/* 중앙 패널: 3D 뷰 + 스텝 슬라이더 */}
                <ResizablePanel defaultSize={50} minSize={30}>
                    <Card className="h-full flex flex-col">
                        <CardHeader className="pb-2">
                            <CardTitle>3D 미리보기</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-grow p-2 flex flex-col gap-3">
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handlePrevStep}
                                    disabled={localPathData.length === 0 || step <= 0}
                                    title="이전 스텝"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>

                                <Slider
                                    value={[Math.min(step, maxStep)]}
                                    onValueChange={handleSliderChange}
                                    min={0}
                                    max={Math.max(0, maxStep)}
                                    step={1}
                                    className="flex-1"
                                />

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleNextStep}
                                    disabled={localPathData.length === 0 || step >= maxStep}
                                    title="다음 스텝"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </Button>

                                <div className="text-xs text-muted-foreground min-w-[120px] text-right">
                                    Step {localPathData.length === 0 ? 0 : step + 1}/{Math.max(1, localPathData.length)}
                                </div>
                            </div>

                            <div className="flex-1 min-h-0">
                                {localPathData.length > 0 ? (
                                    <Preview3D
                                        toolheadPos={toolheadPos}
                                        pathData={localPathData}                 // 전체 경로 그대로 전달
                                        activeCount={Math.min(step + 1, localPathData.length)} // 진행 개수만 전달
                                        imageShapes={imageShapes} // 여러 이미지 전달
                                    />
                                ) : (
                                    <div className="h-full flex items-center justify-center text-muted-foreground">
                                        G-code를 생성하는 중...
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </ResizablePanel>

                <ResizableHandle withHandle/>

                {/* 우측 패널: G-code 텍스트 (현재 스텝 하이라이트) */}
                <ResizablePanel defaultSize={25} minSize={20}>
                    <Card className="h-full flex flex-col">
                        <CardHeader>
                            <CardTitle className="text-base">G-code</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-grow p-0 overflow-hidden">
                            <ScrollArea className="h-full w-full" ref={scrollAreaRef}>
                                <div className="p-4 space-y-0.5">
                                    {(gcode?.split('\n') ?? ['// G-code를 생성하는 중입니다...']).map((line, idx) => {
                                        const isActive = idx === highlightedLineIndex;
                                        return (
                                            <pre
                                                key={idx}
                                                ref={isActive ? activeLineRef : null}
                                                className={[
                                                    "text-xs font-mono whitespace-pre-wrap leading-relaxed rounded px-1",
                                                    isActive ? "bg-primary/10 text-primary" : "text-foreground"
                                                ].join(' ')}
                                            >
                                                {line}
                                            </pre>
                                        );
                                    })}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </ResizablePanel>

            </ResizablePanelGroup>
        </div>
    );
}