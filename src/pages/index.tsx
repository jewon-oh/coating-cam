import React from 'react';
import dynamic from 'next/dynamic';

// Context 및 컴포넌트 import
import { KonvaShapeProvider } from '@/contexts/shape-context';
import { HistoryProvider } from '@/contexts/history-context';
import { ToolProvider } from '@/contexts/tool-context';
import { SettingsProvider } from '@/contexts/settings-context';


// CanvasStage를 동적으로 임포트하여 SSR을 비활성화합니다.
const CanvasStage = dynamic(() => import('@/pages/canvas-stage'), { ssr: false });

function HomePageContent() {
    return (
        <div className="flex h-screen relative"> {/* Portal을 위한 relative position 추가 */}
            <CanvasStage />
        </div>
    );
}

// Context Provider 래퍼는 변경할 필요 없이 그대로 둡니다.
export default function HomeWrapper() {
    return (
        <KonvaShapeProvider>
            <SettingsProvider>
                <ToolProvider>
                    <HistoryProvider>
                        <HomePageContent />
                    </HistoryProvider>
                </ToolProvider>
            </SettingsProvider>
        </KonvaShapeProvider>
    );
}