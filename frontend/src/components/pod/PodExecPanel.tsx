import { useEffect, useRef } from 'react';
import { IDockviewPanelProps } from 'dockview';
import { Terminal } from '@xterm/xterm';
import { useXtermTheme, xtermTheme } from '../../lib/xtermTheme';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { EventsOn } from '../../../wailsjs/runtime/runtime';
import {
    CreatePodExecSession,
    WriteToPodExecSession,
    ResizePodExecSession,
    ClosePodExecSession,
} from '../../../wailsjs/go/controller_app/App';

export interface PodExecPanelParams {
    clusterName: string;
    sessionId: string;
    name: string;
    namespace: string;
    container: string;
}

export default function PodExecPanel({ params }: IDockviewPanelProps<PodExecPanelParams>) {
    const { clusterName, sessionId, name, namespace, container } = params;
    const cn = clusterName ?? '';
    const containerRef = useRef<HTMLDivElement>(null);
    // Held so a theme switch can repaint the live terminal — see useXtermTheme.
    const termRef = useRef<Terminal | null>(null);
    useXtermTheme(termRef);

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

        const fitTimer = setTimeout(() => {
            fitAddon.fit();
            ResizePodExecSession(sessionId, term.cols, term.rows).catch(() => {});
        }, 50);

        term.write(`Connecting to ${namespace}/${name}${container ? ` [${container}]` : ''}...\r\n`);

        CreatePodExecSession(cn, sessionId, namespace, name, container).catch((err: unknown) => {
            term.write(`\r\nFailed to connect: ${err}\r\n`);
        });

        const offOutput = EventsOn(`exec:output:${sessionId}`, (data: string) => {
            term.write(data);
        });

        // The backend fires this when the session ends on its own — the remote
        // shell exiting, the pod going away, the stream breaking. Without it the
        // panel just stopped responding, which is indistinguishable from a hang.
        let closed = false;
        const offClosed = EventsOn(`exec:closed:${sessionId}`, () => {
            if (closed) return;
            closed = true;
            term.write('\r\n[session closed]\r\n');
            term.options.cursorBlink = false;
        });

        const onData = term.onData((data) => {
            if (closed) return;
            WriteToPodExecSession(sessionId, data).catch(() => {});
        });

        const observer = new ResizeObserver(() => {
            fitAddon.fit();
            ResizePodExecSession(sessionId, term.cols, term.rows).catch(() => {});
        });
        observer.observe(containerRef.current);

        return () => {
            clearTimeout(fitTimer);
            offOutput();
            offClosed();
            onData.dispose();
            observer.disconnect();
            ClosePodExecSession(sessionId).catch(() => {});
            if (termRef.current === term) termRef.current = null;
            term.dispose();
        };
    }, [sessionId, name, namespace, container]);

    return (
        <div
            ref={containerRef}
            style={{
                width: '100%',
                height: '100%',
                padding: '4px',
                boxSizing: 'border-box',
                background: 'var(--panel2)',
                overflow: 'hidden',
            }}
        />
    );
}
