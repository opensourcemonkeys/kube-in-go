import { useEffect } from 'react';
import { useTabContext } from '../../contexts/TabContext';
import { useInstanceContext } from '../../contexts/InstanceContext';

// Wires InstanceContext's tab:received event to TabContext's openReceivedPanel.
// Must be rendered inside both InstanceProvider and TabProvider.
export default function TabInstanceBridge() {
    const { setOnPanelReceived } = useInstanceContext();
    const { openReceivedPanel } = useTabContext();

    useEffect(() => {
        setOnPanelReceived(openReceivedPanel);
    }, [setOnPanelReceived, openReceivedPanel]);

    return null;
}
