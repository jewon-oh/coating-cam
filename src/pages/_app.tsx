import "@/styles/globals.css";
import type {AppProps} from "next/app";

import {Provider} from 'react-redux';
import {store} from '@/store/store';
import {MainLayout} from "@/components/layout/main-layout";
import {SettingsProvider} from "@/contexts/settings-context";
import {Toaster} from "@/components/ui/sonner";


export default function App({Component, pageProps}: AppProps) {
    return (
        <Provider store={store}>
            <SettingsProvider>
                <MainLayout>
                    <Component {...pageProps} />
                </MainLayout>
                <Toaster/>
            </SettingsProvider>
        </Provider>
    );
}
