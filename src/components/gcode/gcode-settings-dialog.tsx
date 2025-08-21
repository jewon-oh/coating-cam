'use client';

import React, {useEffect, useState} from 'react';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppSelector, useAppDispatch } from '@/hooks/redux';
import { setGCode, setGenerating, updateGcodeSettings } from '@/store/slices/gcode-slice';
import { Input } from '../ui/input';
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettings } from '@/contexts/settings-context';
import {generateCoatingGCodeWithSnippets} from "@/lib/generate-coating-gcode-with-snippets";
import {Progress} from "@/components/ui/progress";

interface GCodeSettingsDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

// G-code를 경로 데이터로 파싱하는 함수
const parseGCodeToPath = (gcodeText: string): number[][] => {
    const lines = gcodeText.split('\n');
    const path: number[][] = [];
    let currentX = 0;
    let currentY = 0;
    let currentZ = 5; // 안전 높이

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('G')) continue;

        // G0, G1 명령 파싱
        if (trimmed.startsWith('G0') || trimmed.startsWith('G1')) {
            const xMatch = trimmed.match(/X([+-]?\d*\.?\d+)/);
            const yMatch = trimmed.match(/Y([+-]?\d*\.?\d+)/);
            const zMatch = trimmed.match(/Z([+-]?\d*\.?\d+)/);

            if (xMatch) currentX = parseFloat(xMatch[1]);
            if (yMatch) currentY = parseFloat(yMatch[1]);
            if (zMatch) currentZ = parseFloat(zMatch[1]);

            // 경로에 점 추가
            path.push([ currentX, currentY, currentZ]);
        }
    }

    return path;
};

export const GCodeSettingsDialog: React.FC<GCodeSettingsDialogProps> = ({ isOpen, onClose }) => {
    const router = useRouter();
    const dispatch = useAppDispatch();
    const { shapes } = useAppSelector((state) => state.shapes);
    const {gcodeSettings,isGenerating} = useAppSelector((state) => state.gcode);
    const {gcodeSnippets,workArea} = useSettings();

    // 로딩 상태를 위한 새로운 상태 추가
    const [progress, setProgress] = useState(0);
    const [progressMessage, setProgressMessage] = useState('준비 중...');

    // Dialog가 열릴 때마다 로딩 상태 초기화
    useEffect(() => {
        if (isOpen) {
            setProgress(0);
            setProgressMessage('준비 중...');
        }
    }, [isOpen]);
    /**
     * 인풋(Input) 요소의 변경을 처리하는 함수.
     * value를 float로 파싱하여 Redux 스토어에 디스패치합니다.
     */
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        // Redux 액션을 직접 디스패치합니다.
        dispatch(updateGcodeSettings({ [name]: parseFloat(value) }));
    };

    /**
     * 셀렉트(Select) 요소의 변경을 처리하는 함수.
     * string 값을 Redux 스토어에 디스패치합니다.
     */
    const handleSelectChange = (name: string, value: string) => {
        // Redux 액션을 직접 디스패치합니다.
        dispatch(updateGcodeSettings({ [name]: value }));
    };

    /**
     * 체크박스(Checkbox) 요소의 변경을 처리하는 함수.
     * boolean 값을 Redux 스토어에 디스패치합니다.
     */
    const handleCheckboxChange = (name: string, checked: boolean) => {
        // Redux 액션을 직접 디스패치합니다.
        dispatch(updateGcodeSettings({ [name]: checked }));
    };


    const handleGenerate = async () => {
        if (shapes.length === 0) {
            alert('G-code를 생성하려면 먼저 도형을 생성하세요.');
            return;
        }

        dispatch(setGenerating(true));
        setProgress(0);
        setProgressMessage('준비 중...');

        try {
            // 프로그레스 콜백 함수 - 상태 업데이트를 즉시 반영
            const onProgress = (progress: number, message: string) => {
                setProgress(Math.min(Math.max(progress, 0), 100)); // 0-100 범위 보장
                setProgressMessage(message);
                console.log(`Progress: ${progress.toFixed(1)}% - ${message}`);
            };

            // 설정 동기화
            dispatch(updateGcodeSettings(gcodeSettings));

            onProgress(1, 'G-code 생성 시작...');

            // G-code 생성 - await 사용으로 완료까지 대기
            const gcode = await generateCoatingGCodeWithSnippets(
                shapes,
                gcodeSettings,
                gcodeSnippets,
                onProgress
            );

            onProgress(95, 'G-code 파싱 중...');

            // G-code 파싱
            const path = parseGCodeToPath(gcode);
            dispatch(setGCode({ gcode, path }));

            onProgress(100, '완료! 미리보기로 이동합니다...');

            // 짧은 딜레이 후 이동 (사용자가 완료 메시지를 볼 수 있도록)
            await new Promise(resolve => setTimeout(resolve, 500));

            // 미리보기로 이동
            await router.push('/preview');

        } catch (error) {
            console.error('G-code 생성 실패:', error);
            setProgressMessage('생성 실패');
            alert('G-code 생성에 실패했습니다.');
            return; // finally에서 onClose()하지 않도록
        } finally {
            dispatch(setGenerating(false));
            onClose();
        }
    };


    // 마스킹 가능한 도형 개수 계산
    const maskingShapes = shapes.filter(shape =>
        shape.type === 'rectangle' || shape.type === 'circle'
    );

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>PCB 코팅 G-code 설정</DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="coating" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="coating">코팅 설정</TabsTrigger>
                        <TabsTrigger value="motion">동작 설정</TabsTrigger>
                        <TabsTrigger value="masking">마스킹 설정</TabsTrigger>
                    </TabsList>

                    <TabsContent value="coating" className="space-y-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="coatingWidth" className="text-right">
                                코팅 폭 (mm)
                            </Label>
                            <Input
                                id="coatingWidth"
                                name="coatingWidth"
                                type="number"
                                step="0.01"
                                value={gcodeSettings.coatingWidth}
                                onChange={handleInputChange}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="lineSpacing" className="text-right">
                                라인 간격 (mm)
                            </Label>
                            <Input
                                id="lineSpacing"
                                name="lineSpacing"
                                type="number"
                                step="0.01"
                                value={gcodeSettings.lineSpacing}
                                onChange={handleInputChange}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">채우기 패턴</Label>
                            <Select
                                value={gcodeSettings.fillPattern}
                                onValueChange={(value) => handleSelectChange('fillPattern', value)}
                            >
                                <SelectTrigger className="col-span-3">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="auto">자동</SelectItem>
                                    <SelectItem value="horizontal">수평</SelectItem>
                                    <SelectItem value="vertical">수직</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </TabsContent>

                    <TabsContent value="motion" className="space-y-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="coatingSpeed" className="text-right">
                                코팅 속도 (mm/min)
                            </Label>
                            <Input
                                id="coatingSpeed"
                                name="coatingSpeed"
                                type="number"
                                value={gcodeSettings.coatingSpeed}
                                onChange={handleInputChange}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="moveSpeed" className="text-right">
                                이동 속도 (mm/min)
                            </Label>
                            <Input
                                id="moveSpeed"
                                name="moveSpeed"
                                type="number"
                                value={gcodeSettings.moveSpeed}
                                onChange={handleInputChange}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="safeHeight" className="text-right">
                                안전 높이 (mm)
                            </Label>
                            <Input
                                id="safeHeight"
                                name="safeHeight"
                                type="number"
                                step="0.1"
                                value={gcodeSettings.safeHeight}
                                onChange={handleInputChange}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="coatingHeight" className="text-right">
                                코팅 높이 (mm)
                            </Label>
                            <Input
                                id="coatingHeight"
                                name="coatingHeight"
                                type="number"
                                step="0.01"
                                value={gcodeSettings.coatingHeight}
                                onChange={handleInputChange}
                                className="col-span-3"
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="masking" className="space-y-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">마스킹 사용</Label>
                            <div className="col-span-3 flex items-center space-x-2">
                                <Checkbox
                                    id="enableMasking"
                                    checked={gcodeSettings.enableMasking}
                                    onCheckedChange={(checked) => handleCheckboxChange('enableMasking', !!checked)}
                                />
                                <Label htmlFor="enableMasking" className="text-sm">
                                    도형 피해가기 활성화 ({maskingShapes.length}개 도형)
                                </Label>
                            </div>
                        </div>

                        {gcodeSettings.enableMasking && (
                            <>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="maskingClearance" className="text-right">
                                        여유 거리 (mm)
                                    </Label>
                                    <Input
                                        id="maskingClearance"
                                        name="maskingClearance"
                                        type="number"
                                        step="0.01"
                                        value={gcodeSettings.maskingClearance}
                                        onChange={handleInputChange}
                                        className="col-span-3"
                                    />
                                    <Label htmlFor="travelAvoidanceStrategy" className="text-right">
                                        마스킹 우회 방식
                                    </Label>
                                    <Select
                                        value={gcodeSettings.travelAvoidanceStrategy}
                                        onValueChange={(value) => handleSelectChange('travelAvoidanceStrategy', value)}
                                    >
                                        <SelectTrigger className="col-span-3">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="contour">윤곽 우회</SelectItem>
                                            <SelectItem value="lift">Z축 들어올리기</SelectItem>
                                        </SelectContent>
                                    </Select>

                                </div>
                            </>
                        )}
                    </TabsContent>
                </Tabs>
                
                {isGenerating && (
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <p className="text-sm text-muted-foreground">{progressMessage}</p>
                            <span className="text-xs text-muted-foreground">{Math.round(progress)}%</span>
                        </div>
                        <Progress value={progress} className="w-full" />
                        {progress > 0 && progress < 100 && (
                            <p className="text-xs text-center text-muted-foreground">
                                잠시만 기다려주세요...
                            </p>
                        )}
                    </div>
                )}

                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">
                            취소
                        </Button>
                    </DialogClose>
                    <Button type="button" onClick={handleGenerate}>
                        코팅 G-code 생성 후 미리보기
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};