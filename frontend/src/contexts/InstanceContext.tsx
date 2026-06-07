import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { EventsOn } from '../../wailsjs/runtime/runtime';
import { GetInstances, GetSelfInstanceInfo, TransferTab } from '../../wailsjs/go/controller_app/App';
import { models } from '../../wailsjs/go/models';

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

    useEffect(() => {
        const off = EventsOn('tab:received', (panel: SerializedPanel) => {
            onPanelReceivedRef.current?.(panel);
        });
        return () => { if (typeof off === 'function') off(); };
    }, []);

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
