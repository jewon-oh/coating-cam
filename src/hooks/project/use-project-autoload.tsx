"use client";

import { useEffect } from "react";
import { useCanvas } from "@/contexts/canvas-context";
import { useAppDispatch } from "@/hooks/redux";
import { resetHistory } from "@/store/slices/shape-history-slice";
import { setAllShapes } from "@/store/slices/shape-slice";
import { ProjectFileType } from "@/types/project";
import { useRouter } from "next/router";
import {useSettings} from "@/contexts/settings-context";

export function useProjectAutoLoad() {
    const { setLoading } = useCanvas();
    const dispatch = useAppDispatch();
    const router = useRouter();
    const {updateGcodeSettings} = useSettings();

    useEffect(() => {
        const loadProject = async () => {
            try {
                setLoading({isLoading:true,message:"프로젝트 로딩 중..."});

                let jsonText: string | null = null;

                // 1) Electron 환경: ?filePath=
                const filePath =
                    typeof router.query.filePath === "string"
                        ? router.query.filePath
                        : undefined;

                if (filePath && window.projectApi) {
                    jsonText = await window.projectApi.readFile(filePath, "utf8");
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
                    setLoading({isLoading:false,message:" 로딩 중..."});
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
                updateGcodeSettings(parsedGcodeSettings)
                dispatch(resetHistory(parsedShapes));

                setLoading({ message:"완료!"});
                setTimeout(() => {
                    setLoading({isLoading:false,message:" 로딩 중..."});
                }, 500);
            } catch (e) {
                console.error("Failed to load project:", e);
                setLoading({ message:"로딩 실패"});
                setTimeout(() => {
                    setLoading({isLoading:false,message:" 로딩 중..."});
                }, 800);
            }
        };

        if (router.isReady) {
            void loadProject();
        }
    }, [router.isReady, router.query, setLoading, dispatch, updateGcodeSettings]);
}