// Must come first: installs window.go / window.runtime when we are not running
// under Wails, so the generated bindings work under a Chromium shell too.
import './lib/wailsBridge'

// After wailsBridge (which installs window.go / window.runtime) and before the
// app tree: initI18n() is awaited below, so every t() call is synchronous from
// the first render on and nothing ever suspends on a translation.
import { initI18n } from './i18n'
import { storedLocale } from './stores/localeStore'

import React from 'react'
import {createRoot} from 'react-dom/client'
import './style.css'
import 'primeflex/primeflex.css'
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';

import Info from './pages/info/Info'

const container = document.getElementById('root')


const root = createRoot(container!)
import { HashRouter, Routes, Route } from "react-router-dom";
import "primereact/resources/themes/lara-dark-cyan/theme.css";
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import './theme-monolith.css';

// root.render(
//     <React.StrictMode>
//         <App/>
//     </React.StrictMode>
// )
import { PrimeReactProvider } from 'primereact/api';
import Appmain from './pages/main/appmain'

// Monaco is deliberately NOT imported here. Its setup lives in
// lib/monacoBootstrap.ts, which each (lazily loaded) editor panel imports, so
// Monaco is fetched with the first YAML tab rather than on every launch.

initI18n(storedLocale()).then(() => {
    root.render(
        <React.StrictMode>
            <PrimeReactProvider>
                <HashRouter basename="/">
                    <Routes>
                        <Route path="/" element={<Appmain />} />
                        <Route path="/info" element={<Info />} />
                    </Routes>
                </HashRouter>
            </PrimeReactProvider>
        </React.StrictMode>
    );
});