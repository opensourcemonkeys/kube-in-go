import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { EventsOn } from '../../wailsjs/runtime/runtime';
import { GetInstances, GetSelfInstanceInfo, TransferTab } from '../../wailsjs/go/controller_app/App';
import { models } from '../../wailsjs/go/models';
import { isPrimaryWindow } from '../lib/shellWindows';

export type InstanceInfo = models.InstanceInfo;
export type SerializedPanel = models.SerializedPanel;

interface InstanceContextValue {
    instances: InstanceInfo[];
    selfInfo: InstanceInfo | null;
    transferTab: (targetInstanceId: string, panel: SerializedPanel) => Promise<void>;
    onPanelReceived: ((panel: SerializedPanel) => void) | null;
    setOnPanelReceived: (fn: (panel: SerializedPanel) => void) => void;
}

const InstanceContext = createContext<InstanceContextValue | null>(null);

export function InstanceProvider({ children }: { children: React.ReactNode }) {
    const [instances, setInstances] = useState<InstanceInfo[]>([]);
    const [selfInfo, setSelfInfo] = useState<InstanceInfo | null>(null);
    const onPanelReceivedRef = useRef<((panel: SerializedPanel) => void) | null>(null);

    useEffect(() => {
        GetSelfInstanceInfo().then(setSelfInfo).catch(() => {});

        const poll = () => {
            GetInstances().then(setInstances).catch(() => {});
        };
        poll();
        const id = setInterval(poll, 3000);
        return () => clearInterval(id);
    }, []);

    // Panels arriving from another *process*, over the ipc hub.
    //
    // Only the primary window listens: all windows of this process share one
    // sidecar, and the Go server broadcasts events to every /events client, so
    // otherwise a single transfer would open the panel in each window at once.
    useEffect(() => {
        if (!isPrimaryWindow()) return;
        const off = EventsOn('tab:received', (panel: SerializedPanel) => {
            onPanelReceivedRef.current?.(panel);
        });
        return () => { if (typeof off === 'function') off(); };
    }, []);

    // Panels arriving from a sibling window of this process (Electron IPC) are
    // handled in DockviewContainer, which can honour a cross-window drag's drop
    // position; plain default placement would lose it.

    const transferTab = useCallback(async (targetInstanceId: string, panel: SerializedPanel) => {
        await TransferTab(targetInstanceId, panel);
    }, []);

    const setOnPanelReceived = useCallback((fn: (panel: SerializedPanel) => void) => {
        onPanelReceivedRef.current = fn;
    }, []);

    return (
        <InstanceContext.Provider value={{
            instances,
            selfInfo,
            transferTab,
            onPanelReceived: onPanelReceivedRef.current,
            setOnPanelReceived,
        }}>
            {children}
        </InstanceContext.Provider>
    );
}

export function useInstanceContext() {
    const ctx = useContext(InstanceContext);
    if (!ctx) throw new Error('useInstanceContext must be used within InstanceProvider');
    return ctx;
}
