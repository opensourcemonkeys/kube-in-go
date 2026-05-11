import { useEffect, useRef } from 'react';
import { IDockviewPanelProps } from 'dockview';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { EventsOn } from '../../../wailsjs/runtime/runtime';
import {
    CreateTerminalSession,
    WriteToTerminalSession,
    ResizeTerminalSession,
    CloseTerminalSession,
} from '../../../wailsjs/go/controller_app/App';

export interface TerminalPanelParams {
    sessionId: string;
}

export default function TerminalPanel({ params }: IDockviewPanelProps<TerminalPanelParams>) {
    const { sessionId } = params;
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

        // small delay so the DOM has settled before fitting
        const fitTimer = setTimeout(() => {
            fitAddon.fit();
            ResizeTerminalSession(sessionId, term.cols, term.rows).catch(() => {});
        }, 50);

        CreateTerminalSession(sessionId).catch((err: unknown) => {
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
