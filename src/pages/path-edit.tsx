'use client';

import {useState, useEffect} from 'react';
import {PathGroup} from '@/types/gcode-path';
import {useSettings} from '@/contexts/settings-context';

// Next.js의 동적 임포트를 위한 함수
import dynamic from "next/dynamic";

// SSR(서버 사이드 렌더링) 비활성화
// Konva.js와 같은 캔버스 라이브러리는 브라우저 환경에 의존하므로,
// 서버에서 렌더링되지 않도록 동적으로 임포트합니다.
const DynamicPathEditor = dynamic(() => import('@/components/path-editor'), {
    ssr: false,
});

export default function PathEditPage() {
    const {workArea} = useSettings();
    const [pathGroups, setPathGroups] = useState<PathGroup[]>([]);

    // G-Code에서 경로 데이터 로드 (예시)
    useEffect(() => {
        // 실제로는 Redux나 API에서 생성된 G-Code 경로를 가져와야 함
        const mockPaths: PathGroup[] = [
            {
                id: 'group-1',
                name: 'PCB 코팅 경로',
                visible: true,
                locked: false,
                segments: [
                    {
                        id: 'seg-1',
                        start: {x: 100, y: 100},
                        end: {x: 200, y: 100},
                        type: 'G1',
                        originalLine: 10,
                    },
                    {
                        id: 'seg-2',
                        start: {x: 200, y: 100},
                        end: {x: 200, y: 200},
                        type: 'G1',
                        originalLine: 11,
                    },
                ],
            },
        ];
        setPathGroups(mockPaths);
    }, []);

    const handlePathsChange = (newPaths: PathGroup[]) => {
        setPathGroups(newPaths);
        // 변경된 경로를 Redux나 API에 저장
    };

    return (
        <div className="h-screen flex flex-col">
            {/* 경로 편집기 */}
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