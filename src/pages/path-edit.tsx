'use client';

import { useState, useEffect } from 'react';
import { PathGroup } from '@/types/gcode-path';
import { useSettings } from '@/contexts/settings-context';
import { ShapeBasedPathEditor } from '@/lib/gcode/shape-based-path-editor';
import dynamic from "next/dynamic";
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const DynamicPathEditor = dynamic(() => import('@/components/path-editor/path-editor'), {
    ssr: false,
});

export default function PathEditPage() {
    const { workArea, gcodeSettings } = useSettings();
    const router = useRouter();
    const [pathGroups, setPathGroups] = useState<PathGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Shape에서 경로 생성 (실제로는 Redux/API에서 가져와야 함)
    useEffect(() => {
        const loadPaths = async () => {
            try {
                setIsLoading(true);

                // TODO: 실제 구현에서는 Redux store나 API에서 shapes를 가져옴
                const mockShapes = [
                    {
                        id: 'rect-1',
                        type: 'rectangle' as const,
                        x: 50,
                        y: 50,
                        width: 100,
                        height: 80,
                        coatingType: 'fill' as const,
                        name: 'PCB 영역'
                    },
                    {
                        id: 'rect-2',
                        type: 'rectangle' as const,
                        x: 200,
                        y: 100,
                        width: 60,
                        height: 60,
                        coatingType: 'outline' as const,
                        name: '패드 영역'
                    }
                ];

                const pathEditor = new ShapeBasedPathEditor(gcodeSettings, workArea);
                const generatedPaths = await pathEditor.generateEditablePaths(mockShapes);

                setPathGroups(generatedPaths);
                toast.success('경로가 성공적으로 생성되었습니다.');
            } catch (error) {
                console.error('경로 생성 실패:', error);
                toast.error('경로 생성에 실패했습니다.');
            } finally {
                setIsLoading(false);
            }
        };

        loadPaths();
    }, [gcodeSettings, workArea]);

    const handlePathsChange = (newPaths: PathGroup[]) => {
        setPathGroups(newPaths);
        // TODO: Redux store에 저장
    };

    const handleBackToWorkspace = () => {
        router.push('/');
    };

    const handleGenerateGCode = () => {
        try {
            const pathEditor = new ShapeBasedPathEditor(gcodeSettings, workArea);
            const gcode = pathEditor.generateGCodeFromPaths(pathGroups);

            // G-Code 다운로드
            const blob = new Blob([gcode], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `edited-gcode-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.gcode`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success('G-Code가 생성되었습니다.');
        } catch (error) {
            console.error('G-Code 생성 실패:', error);
            toast.error('G-Code 생성에 실패했습니다.');
        }
    };

    if (isLoading) {
        return (
            <div className="h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p>경로를 생성하는 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        onClick={handleBackToWorkspace}
                        className="flex items-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        워크스페이스로 돌아가기
                    </Button>
                    <div>
                        <h1 className="text-xl font-semibold">경로 편집기</h1>
                        <p className="text-sm text-gray-500">
                            생성된 경로를 수동으로 편집할 수 있습니다
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="default"
                        onClick={handleGenerateGCode}
                        className="flex items-center gap-2"
                        disabled={pathGroups.length === 0}
                    >
                        <FileText className="w-4 h-4" />
                        최종 G-Code 생성
                    </Button>
                </div>
            </div>

            {/* Path Editor */}
            <div className="flex-1">
                <DynamicPathEditor
                    initialPaths={pathGroups}
                    onPathsChange={handlePathsChange}
                    workArea={workArea}
                />
            </div>
        </div>
    );
}