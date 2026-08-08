import { useEffect, useRef, useState } from 'react';
import { IDockviewPanelProps } from 'dockview';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Dropdown } from 'primereact/dropdown';
import { VscTerminal } from 'react-icons/vsc';
import { EventsOn } from '../../../wailsjs/runtime/runtime';
import {
    CreateTerminalSession,
    SetTerminalSessionCluster,
    WriteToTerminalSession,
    ResizeTerminalSession,
    CloseTerminalSession,
} from '../../../wailsjs/go/controller_app/App';
import { useClusterContext } from '../../contexts/ClusterContext';

export interface TerminalPanelParams {
    sessionId: string;
    clusterName?: string;
}

export default function TerminalPanel({ api, params }: IDockviewPanelProps<TerminalPanelParams>) {
    const { sessionId } = params;
    const containerRef = useRef<HTMLDivElement>(null);

    const { clusters, activeCluster } = useClusterContext();
    // Same contract as the apply-yaml panel: the seeded cluster is only a
    // default, and the choice is mirrored back into params so the panel keeps
    // its target across a layout restore.
    const [cluster, setCluster] = useState(params.clusterName || activeCluster || '');
    // The session is created once per sessionId; reading the cluster through a
    // ref keeps it out of the effect's deps, so retargeting never restarts the
    // shell.
    const clusterRef = useRef(cluster);
    clusterRef.current = cluster;

    const handleClusterChange = (next: string) => {
        setCluster(next);
        SetTerminalSessionCluster(sessionId, next).catch(() => {});
        api.updateParameters({ clusterName: next });
        const label = api.title?.split(' • ')[0] ?? 'Terminal';
        api.setTitle(next ? `${label} • ${next}` : label);
    };

    useEffect(() => {
        if (!containerRef.current) return;

        const term = new Terminal({
            cursorBlink: true,
            cursorStyle: 'underline',
            fontFamily: '"JetBrains Mono", "Cascadia Code", monospace',
            fontSize: 13,
            lineHeight: 1.4,
            theme: {
                background:    '#10141a',
                foreground:    '#dfe2eb',
                cursor:        '#a2c9ff',
                cursorAccent:  '#10141a',
                black:         '#181c22',
                red:           '#ffb4ab',
                green:         '#69e6a0',
                yellow:        '#ffba42',
                blue:          '#a2c9ff',
                magenta:       '#d4b5ff',
                cyan:          '#58a6ff',
                white:         '#c0c7d4',
                brightBlack:   '#414752',
                brightRed:     '#ffb4ab',
                brightGreen:   '#69e6a0',
                brightYellow:  '#ffba42',
                brightBlue:    '#a2c9ff',
                brightMagenta: '#d4b5ff',
                brightCyan:    '#58a6ff',
                brightWhite:   '#dfe2eb',
            },
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(containerRef.current);

        // small delay so the DOM has settled before fitting
        const fitTimer = setTimeout(() => {
            fitAddon.fit();
            ResizeTerminalSession(sessionId, term.cols, term.rows).catch(() => {});
        }, 50);

        CreateTerminalSession(sessionId, clusterRef.current).catch((err: unknown) => {
            term.write(`\r\nSession error: ${err}\r\n`);
        });

        const offOutput = EventsOn(`terminal:output:${sessionId}`, (data: string) => {
            term.write(data);
        });

        const onData = term.onData((data) => {
            WriteToTerminalSession(sessionId, data).catch(() => {});
        });

        const observer = new ResizeObserver(() => {
            fitAddon.fit();
            ResizeTerminalSession(sessionId, term.cols, term.rows).catch(() => {});
        });
        observer.observe(containerRef.current);

        return () => {
            clearTimeout(fitTimer);
            offOutput();
            onData.dispose();
            observer.disconnect();
            CloseTerminalSession(sessionId).catch(() => {});
            term.dispose();
        };
    }, [sessionId]);

    return (
        <div className="flex flex-column h-full" style={{ background: '#10141a' }}>
            <div className="yaml-editor-toolbar flex align-items-center justify-content-between">
                <span className="yaml-editor-toolbar__label flex align-items-center gap-1">
                    <VscTerminal size={14} /> Terminal
                </span>
                <Dropdown
                    value={cluster || null}
                    options={clusters}
                    onChange={(e) => handleClusterChange(e.value ?? '')}
                    placeholder="Select cluster"
                    className="yaml-editor-toolbar__cluster"
                    style={{ minWidth: '11rem' }}
                    aria-label="Kubeconfig cluster"
                />
            </div>

            <div
                ref={containerRef}
                style={{
                    flex: 1,
                    minHeight: 0,
                    padding: '4px',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                }}
            />
        </div>
    );
}
