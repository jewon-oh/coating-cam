"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SettingsDialog } from "@/components/settings/settings-dialog";
import { Settings, LayoutGrid, Box, Minus, Square, X, Home} from 'lucide-react';
import { ThemeProvider } from "next-themes";
import { useSettings } from "@/contexts/settings-context";
import { cn } from "@/lib/utils";

// Window control buttons
const WindowControls = () => {
    const [isElectron, setIsElectron] = useState(false);

    useEffect(() => {
        setIsElectron(!!window.windowApi);
    }, []);

    if (!isElectron) {
        return null;
    }

    const handleMinimize = () => window.windowApi?.minimize();
    const handleMaximize = () => window.windowApi?.maximize();
    const handleClose = () => window.windowApi?.close();

    return (
        <div className="window-controls">
            <button onClick={handleMinimize} title="Minimize"><Minus size={14} /></button>
            <button onClick={handleMaximize} title="Maximize"><Square size={14} /></button>
            <button onClick={handleClose} title="Close" className="close-btn"><X size={18} /></button>
        </div>
    );
};

// Header 컴포넌트는 MainLayout 내부에서만 사용되도록 정의합니다.
function MainHeader() {
    const pathname = usePathname();
    const [isSettingsOpen, setSettingsOpen] = useState(false);

    const navLinks = [
        { href: '/workspace', label: '작업 공간', icon: <LayoutGrid className="w-4 h-4 mr-2" /> },
        { href: '/preview', label: '3D 미리보기', icon: <Box className="w-4 h-4 mr-2" /> },
    ];

    // const appName = process.env.NEXT_PUBLIC_APP_NAME?.trim() ?? "";


    return (
        <>
            <header id="main-header" className="flex items-center justify-between pl-2 pr-0 bg-zinc-900 text-primary-foreground shadow-sm z-10">
                <div className="flex items-center h-full">
                    <Link href="/" className="flex items-center gap-2 text-lg font-bold ml-2 mr-4">
                        <Home className="w-5 h-5" />
                    </Link>
                    <nav className="flex items-center space-x-1">
                        {navLinks.map(link => (
                            <Button
                                key={link.href}
                                variant={'ghost'}
                                asChild
                                className={cn(
                                    "h-8 text-sm text-white transition-colors hover:bg-zinc-700 hover:text-white",
                                    (pathname.startsWith(link.href)) && "bg-blue-600 hover:bg-blue-700"
                                )}
                            >
                                <Link href={link.href} className="flex items-center">
                                    {link.icon}
                                    {link.label}
                                </Link>
                            </Button>
                        ))}
                    </nav>
                </div>
                <div className="flex items-center h-full">
                    <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} className="h-8 w-8 text-white hover:bg-zinc-700 hover:text-white">
                        <Settings className="h-5 w-5" />
                    </Button>
                    <WindowControls />
                </div>
            </header>
            <SettingsDialog open={isSettingsOpen} onOpenChange={() => setSettingsOpen(false)} />
        </>
    );
}

// MainLayout 컴포넌트
export function MainLayout({ children }: { children: React.ReactNode }) {
    const { theme } = useSettings();
    const [isElectron, setIsElectron] = useState(false);

    useEffect(() => {
        setIsElectron(!!window.windowApi);
    }, []);

    return (
        <ThemeProvider
            attribute="class"
            defaultTheme={theme}
            enableSystem
            disableTransitionOnChange
        >
            {isElectron && (
                <style jsx global>{`
                    #main-header {
                        -webkit-app-region: drag;
                        height: 36px;
                    }
                    #main-header > div > *,
                    #main-header > div > nav > *,
                    #main-header > div > nav > button > *,
                    #main-header > div > button {
                        -webkit-app-region: no-drag;
                    }
                    .window-controls {
                        display: flex;
                        height: 100%;
                    }
                    .window-controls button {
                        width: 40px;
                        height: 100%;
                        border: none;
                        background: transparent;
                        color: white;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                        padding: 0;
                        transition: background-color 0.2s;
                    }
                    .window-controls button:hover {
                        background: #3f3f46; /* zinc-700 */
                    }
                    .window-controls button.close-btn:hover {
                        background: #ef4444; /* red-500 */
                        color: white;
                    }
                `}</style>
            )}
            <div className="flex flex-col h-screen bg-background text-foreground">
                <MainHeader />
                <main className="flex-1 overflow-hidden">
                    {children}
                </main>
            </div>
        </ThemeProvider>
    );
}
