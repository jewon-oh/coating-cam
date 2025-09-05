import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import {toast} from "sonner";
import {ProjectFileType} from "@/types/project";
import {useSettings} from "@/contexts/settings-context";
import { setProjectName } from '@/store/slices/shape-slice';
import { isElectron } from '@/lib/electron-utils';
import { useRouter } from 'next/router';

type RecentFile = {
    name: string;
    filePath?: string;
    content?: string;
    timestamp: number;
};

function loadRecentFiles(): RecentFile[] {
    try {
        const raw = localStorage.getItem('recentFiles');
        return raw ? JSON.parse(raw) as RecentFile[] : [];
    } catch {
        return [];
    }
}

function saveRecentFiles(list: RecentFile[]) {
    try {
        localStorage.setItem('recentFiles', JSON.stringify(list.slice(0, 15)));
    } catch {}
}

function addRecentFile(file: RecentFile) {
    const list = loadRecentFiles();
    const filtered = list.filter(f => (f.filePath ? f.filePath !== file.filePath : f.name !== file.name));
    filtered.unshift(file);
    saveRecentFiles(filtered);
}

export function useProjectActions() {
    const dispatch = useAppDispatch();
    const router = useRouter(); // 클라이언트 사이드 네비게이션을 위해 useRouter 훅을 사용합니다.
    const shapes = useAppSelector((s) => s.shapes.shapes);
    const {gcodeSettings} = useSettings();

    const handleSaveProject = useCallback(async () => {
        const payload:ProjectFileType = {
            version: 1,
            shapes,
            coatingSettings: gcodeSettings
        };

        const projectJson = JSON.stringify({ payload }, null, 2);
        const defaultName = 'canvas-project.json';

        if (isElectron()) {
            try {
                const res = await window.projectApi.showSaveDialog({ defaultPath: defaultName, filters: [{ name: 'JSON', extensions: ['json'] }] });
                if (!res?.filePath) return;

                await window.projectApi.writeFile(res.filePath, projectJson, 'utf8');

                const filename = res.filePath.split(/[\\/]/).pop() || defaultName;
                dispatch(setProjectName(filename)); // 저장 후 프로젝트 이름을 업데이트합니다.
                addRecentFile({ name: filename, filePath: res.filePath, timestamp: Date.now() });
                toast.success('프로젝트 저장 완료');
            } catch (e) {
                console.error('save failed:', e);
                toast.error('저장 실패');
            }
        } else {
            // 웹: 다운로드 + 최근 파일 저장(내용도 보관)
            const blob = new Blob([projectJson], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = defaultName; a.click();
            URL.revokeObjectURL(url);
            addRecentFile({ name: defaultName, content: projectJson, timestamp: Date.now() });
        }
    }, [gcodeSettings, shapes, dispatch]);

    const handleLoadProject = useCallback(async () => {
        if (isElectron()) {
            try {
                const res = await window.projectApi.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] });
                const filePath: string | undefined = res?.filePaths?.[0];
                if (!filePath) return;
                addRecentFile({ name: filePath.split(/[\\/]/).pop() || 'project.json', filePath, timestamp: Date.now() });
                // window.location.href 대신 router.push를 사용하여 페이지를 새로고침하지 않고 이동합니다.
                const qp = new URLSearchParams({ filePath: filePath });
                await router.push(`/workspace?${qp.toString()}`);
            } catch (e) {
                console.error('open failed:', e);
                toast.error('불러오기 실패');
            }
        } else {
            const input = document.createElement('input');
            input.type = 'file'; input.accept = 'application/json';
            input.onchange = async () => {
                const file = input.files?.[0];
                if (!file) return;
                const text = await file.text();
                addRecentFile({ name: file.name, content: text, timestamp: Date.now() });
                // sessionStorage에 프로젝트 내용을 저장하고, 페이지 새로고침 없이 /workspace로 이동합니다.
                sessionStorage.setItem('pendingProject', text);
                await router.push(`/workspace`);
            };
            input.click();
        }
    }, [router]);

    return { handleSaveProject, handleLoadProject };
}