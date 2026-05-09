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
            fontFamily: '"Cascadia Code", "Fira Code", monospace',
            fontSize: 13,
            lineHeight: 1.2,
            theme: {
                background: '#060e20',
                foreground: '#c0caf5',
                cursor: '#7aa2f7',
                cursorAccent: '#060e20',
                black: '#15161e',
                red: '#f7768e',
                green: '#9ece6a',
                yellow: '#e0af68',
                blue: '#7aa2f7',
                magenta: '#bb9af7',
                cyan: '#7dcfff',
                white: '#a9b1d6',
                brightBlack: '#414868',
                brightRed: '#f7768e',
                brightGreen: '#9ece6a',
                brightYellow: '#e0af68',
                brightBlue: '#7aa2f7',
                brightMagenta: '#bb9af7',
                brightCyan: '#7dcfff',
                brightWhite: '#c0caf5',
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
                background: '#060e20',
                overflow: 'hidden',
            }}
        />
    );
}
