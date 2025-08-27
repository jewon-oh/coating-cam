"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { SettingsDialog } from "@/components/settings/settings-dialog";
import { Settings } from 'lucide-react';
import {ThemeProvider} from "next-themes";
import {useSettings} from "@/contexts/settings-context";


// Header 컴포넌트는 MainLayout 내부에서만 사용되도록 정의합니다.
function MainHeader() {
    const pathname = usePathname();
    const [isSettingsOpen, setSettingsOpen] = useState(false);

    const navLinks = [
        { href: '/workspace', label: '작업 공간' },
        { href: '/preview', label: '3D 미리보기' },
    ];

    const appName = process.env.NEXT_PUBLIC_APP_NAME?.trim()?? "";

    return (
        <>
            <header className="flex items-center justify-between px-4 py-2 border-b">
                <div className="flex items-center">
                    <Link href="/" className="text-xl font-bold mr-6">{appName}</Link>
                    <nav className="flex items-center space-x-2">
                        {navLinks.map(link => (
                            <Button
                                key={link.href}
                                variant={pathname === link.href ? 'secondary' : 'ghost'}
                                asChild
                            >
                                <Link href={link.href}>{link.label}</Link>
                            </Button>
                        ))}
                    </nav>
                </div>
                <div className="flex items-center space-x-4">
                    <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)}>
                        <Settings className="h-5 w-5" />
                    </Button>
                </div>
            </header>
            <SettingsDialog open={isSettingsOpen} onOpenChange={() => setSettingsOpen(false)} />
        </>
    );
}

// MainLayout 컴포넌트
export function MainLayout({ children }: { children: React.ReactNode }) {
    const {theme} = useSettings();
    return (
        <ThemeProvider
            attribute="class"
            defaultTheme={theme}
            enableSystem
            disableTransitionOnChange
        >
            <div className="flex flex-col h-screen bg-background text-foreground">
                <MainHeader />
                <main className="flex-1 overflow-hidden">
                    {children}
                </main>
            </div>
        </ThemeProvider>
    );
}