import React from 'react'
import {createRoot} from 'react-dom/client'
import './style.css'
import '/node_modules/primeflex/primeflex.css'
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';

import Info from './pages/info/Info'

const container = document.getElementById('root')

const root = createRoot(container!)
import { HashRouter, Routes, Route } from "react-router-dom";
import "primereact/resources/themes/lara-dark-cyan/theme.css";

// root.render(
//     <React.StrictMode>
//         <App/>
//     </React.StrictMode>
// )
import { PrimeReactProvider, PrimeReactContext } from 'primereact/api';
import Appmain from './pages/main/appmain'

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