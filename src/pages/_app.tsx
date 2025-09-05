import "@/styles/globals.css";
import type {AppProps} from "next/app";

import {Provider} from 'react-redux';
import {store} from '@/store/store';
import {MainLayout} from "@/components/layout/main-layout";
import {SettingsProvider} from "@/contexts/settings-context";
import {WindowControls} from "@/components/window-controls";
import React from "react";


export default function App({Component, pageProps}: AppProps) {
    return (
        <Provider store={store}>
            <SettingsProvider>
                <MainLayout>
                    <Component {...pageProps} />
                </MainLayout>
            </SettingsProvider>
            {/* WindowControls를 앱의 최상단에 렌더링하여 다른 UI와 독립적으로 위치하도록 합니다. */}
            <WindowControls />
        </Provider>
    );
}
