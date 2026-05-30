import { useEffect, useRef } from 'react';
import { IDockviewPanelProps } from 'dockview';
import { Terminal } from '@xterm/xterm';
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
    sessionId: string;
    name: string;
    namespace: string;
    container: string;
}

export default function PodExecPanel({ params }: IDockviewPanelProps<PodExecPanelParams>) {
    const { sessionId, name, namespace, container } = params;
    const containerRef = useRef<HTMLDivElement>(null);

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

        const fitTimer = setTimeout(() => {
            fitAddon.fit();
            ResizePodExecSession(sessionId, term.cols, term.rows).catch(() => {});
        }, 50);

        term.write(`Connecting to ${namespace}/${name}${container ? ` [${container}]` : ''}...\r\n`);

        CreatePodExecSession(sessionId, namespace, name, container).catch((err: unknown) => {
            term.write(`\r\nFailed to connect: ${err}\r\n`);
        });

        const offOutput = EventsOn(`exec:output:${sessionId}`, (data: string) => {
            term.write(data);
        });

        const onData = term.onData((data) => {
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
            onData.dispose();
            observer.disconnect();
            ClosePodExecSession(sessionId).catch(() => {});
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
                background: '#10141a',
                overflow: 'hidden',
            }}
        />
    );
}
