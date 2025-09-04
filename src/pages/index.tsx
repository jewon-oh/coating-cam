import Link from 'next/link';
import {useEffect, useState} from "react";
import {useRouter} from "next/router";
import {useAppDispatch} from "@/hooks/redux";
import {clearShapes} from "@/store/slices/shape-slice";

type RecentFile = {
    name: string;
    filePath?: string;
    content?: string;
    timestamp: number;
};

export default function HomePage() {
    const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
    const router = useRouter();
    const dispatch = useAppDispatch();
    const appName = process.env.NEXT_PUBLIC_APP_NAME?.trim() ??"";

    useEffect(() => {
        try {
            const raw = localStorage.getItem('recentFiles');
            setRecentFiles(raw ? JSON.parse(raw) as RecentFile[] : []);
        } catch (error) {
            console.error('Failed to load recent files from localStorage:', error);
        }
    }, []);

    const handleNewProject = () => {
        dispatch(clearShapes());
    };

    const handleOpenFile = async (file: RecentFile) => {
        // Electron: 경로만 넘기고 /canvas에서 읽기
        // Web: sessionStorage를 사용해 대용량 쿼리 제거
        if (file.filePath && (window as Window & typeof globalThis & { projectApi?: { openFile: (path: string) => void } }).projectApi) {
            const qp = new URLSearchParams({filePath: file.filePath});
            await router.push(`/workspace?${qp.toString()}`);
            return;
        }
        if (file.content) {
            sessionStorage.setItem('pendingProject', file.content);
            await router.push('/workspace');
            return;
        }
        alert('파일 정보를 찾을 수 없습니다.');
    };

    return (
        <div className="h-full w-full flex flex-col items-center justify-center p-4">
            <h1 className="text-4xl font-bold mb-8">{appName}</h1>

            <div className="w-full max-w-xl p-6 bg-card text-card-foreground rounded-lg shadow-md">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-semibold">Recent Files</h2>
                    <Link href="/workspace" onClick={handleNewProject} className="text-sm text-blue-500 hover:underline">
                        새 프로젝트 만들기
                    </Link>
                </div>

                {recentFiles.length > 0 ? (
                    <ul className="space-y-2">
                        {recentFiles.map((file, idx) => (
                            <li key={idx}
                                className="flex justify-between items-center p-3 bg-muted/50 rounded-md hover:bg-muted transition-colors">
                <span className="flex-1 cursor-pointer" onClick={() => handleOpenFile(file)}>
                  <span className="font-medium">{file.name}</span>
                  <span className="ml-4 text-sm text-muted-foreground">
                    {new Date(file.timestamp).toLocaleString()}
                  </span>
                    {file.filePath && (
                        <span className="ml-2 text-xs text-muted-foreground truncate max-w-[180px]"
                              title={file.filePath}>
                      ({file.filePath})
                    </span>
                    )}
                </span>
                                <span className="ml-4 text-sm text-blue-500 hover:underline cursor-pointer"
                                      onClick={() => handleOpenFile(file)}>
                  Open
                </span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-center text-muted-foreground">최근 파일이 없습니다. 새 프로젝트를 시작하세요!</p>
                )}
            </div>
        </div>
    );
}