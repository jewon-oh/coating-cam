"use client";

import { useEffect } from "react";
import { useCanvas } from "@/contexts/canvas-context";
import { useAppDispatch } from "@/hooks/redux";
import { resetHistory } from "@/store/slices/history-slice";
import { setAllShapes } from "@/store/slices/shapes-slice";
import { updateGcodeSettings } from "@/store/slices/gcode-slice";
import { ProjectFileType } from "@/types/project";
import { useRouter } from "next/router";

export function useProjectAutoLoad() {
    const { setIsLoading, setLoadingMessage } = useCanvas();
    const dispatch = useAppDispatch();
    const router = useRouter();

    useEffect(() => {
        const loadProject = async () => {
            try {
                setIsLoading(true);
                setLoadingMessage("프로젝트 로딩 중...");

                let jsonText: string | null = null;

                // 1) Electron 환경: ?filePath=
                const filePath =
                    typeof router.query.filePath === "string"
                        ? router.query.filePath
                        : undefined;

                if (filePath && (window as any).projectApi) {
                    jsonText = await (window as any).projectApi.readFile(filePath, "utf8");
                }

                // 2) 웹 환경: sessionStorage
                if (!jsonText) {
                    const pending = sessionStorage.getItem("pendingProject");
                    if (pending) {
                        jsonText = pending;
                        sessionStorage.removeItem("pendingProject");
                    }
                }

                // 3) 하위호환: ?content= (base64-encoded, URI-encoded)
                if (!jsonText && typeof router.query.content === "string") {
                    try {
                        jsonText = decodeURIComponent(atob(router.query.content));
                    } catch (e) {
                        console.warn("Failed to decode content query:", e);
                    }
                }

                if (!jsonText) {
                    setLoadingMessage("로딩 중...");
                    setIsLoading(false);
                    return;
                }

                // 파싱 및 스토어 반영
                const parsed: ProjectFileType = JSON.parse(jsonText).payload;
                const {
                    version: parsedVersion,
                    shapes: parsedShapes,
                    gcodeSettings: parsedGcodeSettings,
                } = parsed;

                console.log(`[Project Load] Project file version: ${parsedVersion}`);

                dispatch(setAllShapes(parsedShapes));
                dispatch(updateGcodeSettings(parsedGcodeSettings));
                dispatch(resetHistory(parsedShapes));

                setLoadingMessage("완료!");
                setTimeout(() => {
                    setIsLoading(false);
                    setLoadingMessage("로딩 중...");
                }, 500);
            } catch (e) {
                console.error("Failed to load project:", e);
                setLoadingMessage("로딩 실패");
                setTimeout(() => {
                    setIsLoading(false);
                    setLoadingMessage("로딩 중...");
                }, 800);
            }
        };

        if (router.isReady) {
            void loadProject();
        }
    }, [router.isReady, router.query, setIsLoading, setLoadingMessage, dispatch]);
}