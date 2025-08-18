// Next.js의 클라이언트 컴포넌트로 지정.
// 이 컴포넌트 내에서는 브라우저 API(window, localStorage 등)를 안전하게 사용할 수 있습니다.
"use client";

// Next.js의 동적 임포트를 위한 함수
import dynamic from "next/dynamic";
// 애플리케이션 상태 관리를 위한 캔버스 컨텍스트
import { CanvasProvider, useCanvas } from "@/contexts/canvas-context";
// UI 컴포넌트들
import { ObjectPanel } from "@/components/object-panel/object-panel";
import { GCodeSettingsDialog } from "@/components/gcode/gcode-settings-dialog";
import { Toolbar } from "@/components/tool/toolbar";
import React, { useEffect, useState } from "react";
import { WorkspaceOverlays } from "@/components/workspace/workspace-overlays";

// Redux 액션 및 훅
import { resetHistory } from "@/store/slices/history-slice";
import { setAllShapes } from "@/store/slices/shapes-slice";
import { useAppDispatch } from "@/hooks/redux";
import { useRouter } from "next/router";
import { ProjectFileType } from "@/types/project";
import { updateGcodeSettings } from "@/store/slices/gcode-slice";

// SSR(서버 사이드 렌더링) 비활성화
// Konva.js와 같은 캔버스 라이브러리는 브라우저 환경에 의존하므로,
// 서버에서 렌더링되지 않도록 동적으로 임포트합니다.
const DynamicCanvasStage = dynamic(() => import('@/components/workspace/canvas-stage'), {
    ssr: false,
});

/**
 * 프로젝트 로드 로직을 포함하는 내부 컴포넌트
 * 이 컴포넌트는 CanvasProvider의 컨텍스트에 접근해야 하므로,
 * CanvasProvider 내부에 위치해야 합니다.
 */
const WorkspaceContent = () => {
    // G-Code 설정 다이얼로그의 열림/닫힘 상태 관리
    const [isGCodeDialogOpen, setGCodeDialogOpen] = useState(false);
    // CanvasProvider 컨텍스트에서 상태 및 함수를 가져옵니다.
    const { setIsLoading, setLoadingMessage } = useCanvas();

    const router = useRouter();
    const dispatch = useAppDispatch();

    /**
     * 프로젝트 로드 효과 훅
     * 페이지가 로드될 때(router.isReady가 true일 때) 프로젝트 파일을 로드합니다.
     * 로드 우선순위: Electron IPC (filePath) → sessionStorage → URL 쿼리 (content)
     */
    useEffect(() => {
        // 프로젝트 로드 로직을 비동기 함수로 정의
        const loadProject = async () => {
            try {
                setIsLoading(true);
                setLoadingMessage('프로젝트 로딩 중...');

                let jsonText: string | null = null;

                // 1) Electron 환경: URL 쿼리 'filePath'를 통한 파일 로드
                // Electron의 IPC API가 존재하는지 확인하고, 파일 경로를 통해 파일을 읽습니다.
                const filePath = typeof router.query.filePath === "string" ? router.query.filePath : undefined;
                const projectApi = window.projectApi;
                if (filePath && projectApi) {
                    jsonText = await projectApi.readFile(filePath, "utf8");
                }

                // 2) 웹 환경: sessionStorage 'pendingProject' 확인
                // Electron이 아닌 웹 환경에서 파일 드래그앤드롭 등으로 저장된 임시 프로젝트를 로드합니다.
                if (!jsonText) {
                    const pending = sessionStorage.getItem("pendingProject");
                    if (pending) {
                        jsonText = pending;
                        sessionStorage.removeItem("pendingProject");
                    }
                }

                // 3) 하위호환성: ?content= URL 쿼리 파라미터로 내용 로드
                // Base64 인코딩된 프로젝트 내용을 디코딩하여 사용합니다.
                if (!jsonText && typeof router.query.content === "string") {
                    try {
                        jsonText = decodeURIComponent(atob(router.query.content));
                    } catch (e) {
                        console.warn("Failed to decode content query:", e);
                    }
                }

                // 로드할 내용이 없으면 로딩 상태를 초기화하고 함수를 종료합니다.
                if (!jsonText) {
                    setLoadingMessage('로딩 중...');
                    setIsLoading(false);
                    return;
                }

                // 프로젝트 JSON을 파싱하고 Redux 상태에 반영
                const parsed: ProjectFileType = JSON.parse(jsonText).payload;
                const { version: parsedVersion, shapes: parsedShapes, gcodeSettings: parsedGcodeSettings } = parsed;

                console.log(`[Project Load] Project file version: ${parsedVersion}`);
                // 도형(shapes)과 G-Code 설정을 Redux 스토어에 디스패치
                dispatch(setAllShapes(parsedShapes));
                dispatch(updateGcodeSettings(parsedGcodeSettings));
                // 히스토리(undo/redo)를 초기화하여 새 프로젝트로 시작
                dispatch(resetHistory(parsedShapes));

                // 로딩 완료 메시지를 잠깐 표시한 후 상태를 초기화합니다.
                setLoadingMessage('완료!');
                setTimeout(() => {
                    setIsLoading(false);
                    setLoadingMessage('로딩 중...');
                }, 500);
            } catch (e) {
                // 프로젝트 로딩 중 오류 발생 시, 에러를 로깅하고 사용자에게 알립니다.
                console.error("Failed to load project:", e);
                setLoadingMessage('로딩 실패');
                setTimeout(() => {
                    setIsLoading(false);
                    setLoadingMessage('로딩 중...');
                }, 800);
            }
        };

        // Next.js 라우터가 준비된 상태에서만 프로젝트 로드를 시작합니다.
        if (router.isReady) {
            void loadProject();
        }
    }, [router.isReady, router.query, dispatch, setIsLoading, setLoadingMessage]);

    // UI 레이아웃
    return (
        <div className="h-full w-full flex flex-col bg-background text-foreground relative">
            {/* 상단 툴바 컴포넌트 */}
            <Toolbar onGenerateGCode={() => setGCodeDialogOpen(true)} />

            <div className="flex flex-1 overflow-hidden relative">
                {/* 좌측 객체 목록 패널 */}
                <ObjectPanel />

                {/* 메인 캔버스 영역 */}
                <div className="flex-1 flex flex-col p-5 relative">
                    <div
                        className="flex-1 w-full h-full bg-muted/30 rounded-lg border relative overflow-hidden"
                    >
                        {/* 캔버스 Stage 컴포넌트 */}
                        {/*<div className="absolute inset-0">*/}
                            <DynamicCanvasStage />
                        {/*</div>*/}

                        {/* UI 오버레이 (마우스 커서, 그리드 등) */}
                        <WorkspaceOverlays />
                    </div>
                </div>
            </div>

            {/* G-Code 설정 다이얼로그 (열림/닫힘 상태에 따라 렌더링) */}
            <GCodeSettingsDialog
                isOpen={isGCodeDialogOpen}
                onClose={() => setGCodeDialogOpen(false)}
            />
        </div>
    );
};

/**
 * 워크스페이스 페이지의 메인 컴포넌트
 * CanvasProvider로 WorkspaceContent를 감싸서 컨텍스트를 제공합니다.
 */
export default function WorkspacePage() {
    return (
        <CanvasProvider>
            <WorkspaceContent />
        </CanvasProvider>
    );
}