"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Settings, LayoutGrid, Box, Home} from 'lucide-react';
import { useAppSelector } from "@/hooks/redux";
import { ThemeProvider } from "next-themes";
import { useSettings } from "@/contexts/settings-context";
import { cn } from "@/lib/utils";
import {isElectron} from "@/lib/electron-utils";
import {Toaster} from "@/components/ui/sonner";

// 메인 내비게이션 링크
const mainNavLinks = [
    { href: '/', label: '', icon: <Home className="w-4 h-4" /> },
    { href: '/workspace', label: '작업 공간', icon: <LayoutGrid className="w-4 h-4 mr-2" /> },
    { href: '/preview', label: '3D 미리보기', icon: <Box className="w-4 h-4 mr-2" /> },
    { href: '/settings', label: '설정', icon: <Settings className="w-4 h-4 mr-2" /> }
];

function AppNav({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
    const pathname = usePathname();

    return (
        // w-full과 justify-between을 추가하여 왼쪽과 오른쪽 그룹으로 나눕니다.
        <nav className={cn("flex items-center justify-between space-x-1 h-full w-full", className)} {...props}>
            {/* 왼쪽 내비게이션 그룹 */}
            <div className="flex items-center space-x-1 h-full">
                {mainNavLinks.map(link => {
                    const isActive = link.href === '/' ? pathname === link.href : pathname.startsWith(link.href);
                    return (
                        <Button
                            key={link.href}
                            variant={'ghost'}
                            asChild
                            className={cn(
                                "h-8 text-sm text-white transition-colors hover:bg-zinc-700 hover:text-white",
                                !link.label && "p-2",
                                isActive && "bg-blue-600 hover:bg-blue-700"
                            )}
                        >
                            <Link href={link.href} className="flex items-center">
                                {link.icon}
                                {link.label}
                            </Link>
                        </Button>
                    );
                })}
            </div>

        </nav>
    );
}


// Header 컴포넌트는 MainLayout 내부에서만 사용되도록 정의합니다.
function MainHeader() {
    return (
        // 배경색을 TitleBar(bg-zinc-900)보다 한 단계 밝은 bg-zinc-800으로 변경하여 시각적으로 구분합니다.
        <header id="main-header" className="flex items-center justify-between px-2 bg-zinc-800 text-primary-foreground shadow-sm z-10">
            <AppNav />
        </header>
    );
}

/**
 * Electron 환경에서 창을 드래그할 수 있는 영역을 제공하는 타이틀 바 컴포넌트입니다.
 * WindowControls는 _app.tsx에서 절대 위치로 이 위에 렌더링됩니다.
 */
function TitleBar() {
    // Redux 스토어에서 현재 프로젝트 이름을 가져옵니다.
    // Redux 스토어에서 현재 프로젝트 이름을 안전하게 가져옵니다.
    const projectName = useAppSelector(state => state.shapes.projectName);
    // .env.local 또는 .env.production 파일에서 앱 이름을 가져옵니다.
    const appName = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Coating CAM";

    return (
        <div id="title-bar" className="h-[36px] w-full bg-zinc-900 grid grid-cols-3 items-center px-2 text-sm text-neutral-400">
            {/* 왼쪽: 프로그램 이름 */}
            <div className="text-left truncate">
                <span>{appName}</span>
            </div>
            {/* 중앙: 현재 프로젝트 파일 이름 */}
            <div className="text-center truncate">
                <span>{projectName || '제목 없음'}</span>
            </div>
            {/* 오른쪽: WindowControls를 위한 공간 */}
            <div className="text-right"></div>
        </div>
    );
}

// MainLayout 컴포넌트
export function MainLayout({ children }: { children: React.ReactNode }) {
    const { theme } = useSettings();
    const [isElectronEnv, setIsElectronEnv] = useState(false);

    useEffect(() => {
        // 컴포넌트가 클라이언트 측에서 마운트된 후에 isElectron()을 호출하여 hydration 오류를 방지합니다.
        setIsElectronEnv(isElectron());
    }, []);

    return (
        <ThemeProvider
            attribute="class"
            defaultTheme={theme}
            enableSystem
            disableTransitionOnChange
        >
            {isElectronEnv && (
                <style jsx global>{`
                    /* 타이틀 바 영역을 드래그 가능하게 설정합니다. */
                    #title-bar {
                        -webkit-app-region: drag;
                    }
                    /* MainHeader 내부의 모든 요소는 드래그 불가능하도록 설정합니다. */
                    #main-header, #main-header * {
                        -webkit-app-region: no-drag;
                    }
                `}</style>
            )}
            <div className="flex flex-col h-screen bg-background text-foreground">
                {/* Electron 환경일 경우, MainHeader 위에 TitleBar를 추가하여 WindowControls를 위한 공간을 확보합니다. */}
                {isElectronEnv && <TitleBar />}
                <MainHeader />
                <main className="flex-1 overflow-hidden">
                    {children}
                </main>
            </div>
            <Toaster
                richColors
                toastOptions={{
                    classNames: {
                        toast: 'bg-muted text-foreground',
                        description: 'text-foreground/80',
                    },
                }}
            />
        </ThemeProvider>
    );
}
