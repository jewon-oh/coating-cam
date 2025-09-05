"use client";

import React, { useState, useEffect } from 'react';
import { Minus, Square, X } from 'lucide-react';
import {isElectron} from "@/lib/electron-utils";

/**
 * Electron 환경에서 창 제어(최소화, 최대화, 닫기) 버튼을 렌더링하는 컴포넌트입니다.
 * Electron이 아닌 환경에서는 아무것도 렌더링하지 않습니다.
 */
export const WindowControls = () => {
    const [isElectronEnv, setIsElectronEnv] = useState(false);

    useEffect(() => {
        // 컴포넌트가 클라이언트 측에서 마운트된 후에 isElectron()을 호출하여 hydration 오류를 방지합니다.
        setIsElectronEnv(isElectron());
    }, []);

    if (!isElectronEnv) {
        return null;
    }

    const handleMinimize = () => window.windowApi?.minimize();
    const handleMaximize = () => window.windowApi?.maximize();
    const handleClose = () => window.windowApi?.close();

    return (
        <div style={{ position: 'absolute', top: 0, right: 0, zIndex: 9999, height: '36px' }}>
            {/* WindowControls에만 적용되는 스타일 */}
            {/* 이 컴포넌트는 Electron 환경에서만 렌더링되므로, 전역 스타일이 다른 곳에 영향을 주지 않습니다. */}
            <style jsx global>{`
                .window-controls {
                    display: flex;
                    height: 100%;
                    -webkit-app-region: no-drag; /* 이 영역은 드래그되지 않도록 설정 */
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
            <div className="window-controls">
                <button onClick={handleMinimize} title="Minimize"><Minus size={14} /></button>
                <button onClick={handleMaximize} title="Maximize"><Square size={14} /></button>
                <button onClick={handleClose} title="Close" className="close-btn"><X size={18} /></button>
            </div>
        </div>
    );
};