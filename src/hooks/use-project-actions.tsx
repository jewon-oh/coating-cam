import { useCallback } from 'react';
import { useAppSelector } from '@/hooks/redux';
import {toast} from "sonner";
import {ProjectFileType} from "@/types/project";

type RecentFile = {
    name: string;
    filePath?: string;
    content?: string;
    timestamp: number;
};

function isElectron() {
    return typeof window !== 'undefined' && !! window.projectApi;
}

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
    const shapes = useAppSelector((s) => s.shapes.shapes);
    const {gcodeSettings} = useAppSelector(s => s.gcode);

    const handleSaveProject = useCallback(async () => {
        const payload:ProjectFileType = {
            version: 1,
            shapes,
            gcodeSettings
        };

        const projectJson = JSON.stringify({ payload }, null, 2);
        const defaultName = 'canvas-project.json';

        if (isElectron()) {
            try {
                const res = await window.projectApi.showSaveDialog({ defaultPath: defaultName, filters: [{ name: 'JSON', extensions: ['json'] }] });
                if (!res?.filePath) return;
                await window.projectApi.writeFile(res.filePath, projectJson, 'utf8');
                addRecentFile({ name: res.filePath.split(/[\\/]/).pop() || defaultName, filePath: res.filePath, timestamp: Date.now() });
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
    }, [gcodeSettings, shapes]);

    const handleLoadProject = useCallback(async () => {
        if (isElectron()) {
            try {
                const res = await window.projectApi.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] });
                const filePath: string | undefined = res?.filePaths?.[0];
                if (!filePath) return;
                addRecentFile({ name: filePath.split(/[\\/]/).pop() || 'project.json', filePath, timestamp: Date.now() });
                // 경로만 전달(짧음) → /workspace에서 파일 읽기
                const qp = new URLSearchParams({ filePath: filePath });
                window.location.href = `/workspace?${qp.toString()}`;
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
                // URL에 내용 넣지 말고 sessionStorage 이용
                sessionStorage.setItem('pendingProject', text);
                window.location.href = `/workspace`;
            };
            input.click();
        }
    }, []);

    return { handleSaveProject, handleLoadProject };
}