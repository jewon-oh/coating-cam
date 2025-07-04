'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
} from '@/components/ui/dialog';
import { useShapeContext } from '@/contexts/shape-context';
import { generateGCode, GCodeSettings, GCodeShape } from '@/lib/gcode-generator';
import { Input } from '../ui/input';
import {Label} from "@/components/ui/label";
import {RadioGroup, RadioGroupItem} from "@/components/ui/radio-group";

interface GCodeSettingsDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export const GCodeSettingsDialog: React.FC<GCodeSettingsDialogProps> = ({ isOpen, onClose }) => {
    const { shapes, selectedShapeIds } = useShapeContext();
    const selectedShape = shapes.find(s => selectedShapeIds.includes(s.id));
    const [settings, setSettings] = useState<GCodeSettings>({
        nozzleDiameter: 0.4,
        fillType: 'fill',
        fillSpacing: 100,
        feedRate: 1500,
        workSpeed: 1000,
        safeZHeight: 5,
        workZHeight: 0,
        maskingBehavior: 'lift',
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setSettings((prev) => ({ ...prev, [name]: parseFloat(value) }));
    };

    const handleMaskingBehaviorChange = (value: 'lift' | 'avoid') => {
        setSettings((prev) => ({ ...prev, maskingBehavior: value }));
    };

    const handleGenerate = () => {
        if (!selectedShape || selectedShape.type !== 'image') {
            alert('G-code를 생성하려면 먼저 이미지를 선택하세요.');
            return;
        }

        const scaleFactor = 10;

        const targetImage: GCodeShape = {
            ...selectedShape,
            type: 'image',
            x: selectedShape.x / scaleFactor,
            y: selectedShape.y / scaleFactor,
            width: selectedShape.width ? selectedShape.width / scaleFactor : 0,
            height: selectedShape.height ? selectedShape.height / scaleFactor : 0,
        };

        const maskingShapes: GCodeShape[] = shapes
            .filter((shape) => shape.id !== selectedShape.id && (shape.type === 'rect' || shape.type === 'circle'))
            .map(shape => ({
                ...shape,
                type: shape.type.toLowerCase() as 'rect' | 'circle',
                x: shape.x / scaleFactor,
                y: shape.y / scaleFactor,
                width: shape.width ? shape.width / scaleFactor : undefined,
                height: shape.height ? shape.height / scaleFactor : undefined,
                radius: shape.radius ? shape.radius / scaleFactor : undefined,
            }));

        const gcode = generateGCode(targetImage, maskingShapes, settings);
        const blob = new Blob([gcode], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'output.gcode';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>G-code 생성 설정</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="nozzleDiameter" className="text-right">
                            코팅 폭 (mm)
                        </Label>
                        <Input
                            id="nozzleDiameter"
                            name="nozzleDiameter"
                            type="number"
                            value={settings.nozzleDiameter}
                            onChange={handleInputChange}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="fillSpacing" className="text-right">
                            채우기 간격 (%)
                        </Label>
                        <Input
                            id="fillSpacing"
                            name="fillSpacing"
                            type="number"
                            value={settings.fillSpacing}
                            onChange={handleInputChange}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="feedRate" className="text-right">
                            이송 속도 (mm/min)
                        </Label>
                        <Input
                            id="feedRate"
                            name="feedRate"
                            type="number"
                            value={settings.feedRate}
                            onChange={handleInputChange}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="workSpeed" className="text-right">
                            작업 속도 (mm/min)
                        </Label>
                        <Input
                            id="workSpeed"
                            name="workSpeed"
                            type="number"
                            value={settings.workSpeed}
                            onChange={handleInputChange}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="safeZHeight" className="text-right">
                            안전 높이 (mm)
                        </Label>
                        <Input
                            id="safeZHeight"
                            name="safeZHeight"
                            type="number"
                            value={settings.safeZHeight}
                            onChange={handleInputChange}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="workZHeight" className="text-right">
                            작업 높이 (mm)
                        </Label>
                        <Input
                            id="workZHeight"
                            name="workZHeight"
                            type="number"
                            value={settings.workZHeight}
                            onChange={handleInputChange}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">마스킹 처리</Label>
                        <RadioGroup
                            value={settings.maskingBehavior}
                            onValueChange={handleMaskingBehaviorChange}
                            className="col-span-3 flex space-x-4"
                        >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="lift" id="lift" />
                                <Label htmlFor="lift">위로 지나가기</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="avoid" id="avoid" />
                                <Label htmlFor="avoid">피해 가기</Label>
                            </div>
                        </RadioGroup>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">
                            취소
                        </Button>
                    </DialogClose>
                    <Button type="button" onClick={handleGenerate}>
                        생성 및 다운로드
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};