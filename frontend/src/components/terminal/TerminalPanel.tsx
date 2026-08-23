import { useEffect, useRef, useState } from 'react';
import { IDockviewPanelProps } from 'dockview';
import { Terminal } from '@xterm/xterm';
import { useXtermTheme, xtermTheme } from '../../lib/xtermTheme';
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
import { renderPanelTitle } from '../../contexts/TabContext';
import { useT } from '../../i18n/useT';

export interface TerminalPanelParams {
    sessionId: string;
    clusterName?: string;
    titleKey?: string;
    titleVars?: Record<string, string | number | undefined>;
}

export default function TerminalPanel({ api, params }: IDockviewPanelProps<TerminalPanelParams>) {
    const t = useT();
    const { sessionId } = params;
    const containerRef = useRef<HTMLDivElement>(null);
    // Held so a theme switch can repaint the live terminal — see useXtermTheme.
    const termRef = useRef<Terminal | null>(null);
    useXtermTheme(termRef);

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
        // Retitle through the panel's own i18n key rather than by splicing the
        // current title string: that keeps the title translatable after a
        // language switch (DockviewContainer re-renders it from these params).
        const titleVars = { ...(params.titleVars ?? {}), suffix: next || undefined };
        api.updateParameters({ clusterName: next, titleVars });
        api.setTitle(renderPanelTitle(t, { titleKey: params.titleKey, titleVars }));
    };

    useEffect(() => {
        if (!containerRef.current) return;

        const term = new Terminal({
            cursorBlink: true,
            cursorStyle: 'underline',
            fontFamily: '"JetBrains Mono", "Cascadia Code", monospace',
            fontSize: 13,
            lineHeight: 1.4,
            theme: xtermTheme(),
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        termRef.current = term;
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

        // Fired when the shell exits on its own (the user typing `exit`). The
        // pty is gone at that point, so keystrokes have nowhere to go.
        let exited = false;
        const offExit = EventsOn(`terminal:exit:${sessionId}`, () => {
            if (exited) return;
            exited = true;
            term.write('\r\n[shell exited]\r\n');
            term.options.cursorBlink = false;
        });

        const onData = term.onData((data) => {
            if (exited) return;
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
            offExit();
            onData.dispose();
            observer.disconnect();
            CloseTerminalSession(sessionId).catch(() => {});
            if (termRef.current === term) termRef.current = null;
            term.dispose();
        };
    }, [sessionId]);

    return (
        <div className="flex flex-column h-full" style={{ background: 'var(--panel2)' }}>
            <div className="yaml-editor-toolbar flex align-items-center justify-content-between">
                <span className="yaml-editor-toolbar__label flex align-items-center gap-1">
                    <VscTerminal size={14} /> {t('panels:terminal.label')}
                </span>
                <Dropdown
                    value={cluster || null}
                    options={clusters}
                    onChange={(e) => handleClusterChange(e.value ?? '')}
                    placeholder={t('panels:terminal.selectCluster')}
                    className="yaml-editor-toolbar__cluster"
                    style={{ minWidth: '11rem' }}
                    aria-label={t('panels:terminal.clusterAria')}
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
