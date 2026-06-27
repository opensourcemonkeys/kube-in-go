import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { EventsOn } from '../../../wailsjs/runtime/runtime';
import {
    CreateCliModeSession,
    WriteToCliModeSession,
    ResizeCliModeSession,
    CloseCliModeSession,
} from '../../../wailsjs/go/controller_app/App';

// CliModeOverlay renders a fullscreen xterm that hosts the kube-ins terminal UI
// (the GUI re-execs itself with --tui in a pty). It covers the dockview + menu;
// when the TUI process exits (climode:exit) or the user clicks "Exit", onClose
// restores the GUI. Dockview/menu stay mounted underneath, preserving state.
export default function CliModeOverlay({ onClose }: { onClose: () => void }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef(onClose);
    closeRef.current = onClose;

    useEffect(() => {
        if (!containerRef.current) return;

        const sessionId = `climode-${Date.now()}`;
        const term = new Terminal({
            cursorBlink: true,
            fontFamily: '"JetBrains Mono", "Cascadia Code", monospace',
            fontSize: 13,
            lineHeight: 1.2,
            theme: {
                background: '#10141a',
                foreground: '#dfe2eb',
                cursor: '#2dd4bf',
                cursorAccent: '#10141a',
            },
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(containerRef.current);

        const fitTimer = setTimeout(() => {
            fitAddon.fit();
            ResizeCliModeSession(sessionId, term.cols, term.rows).catch(() => {});
        }, 50);

        CreateCliModeSession(sessionId).catch((err: unknown) => {
            term.write(`\r\nCLI mode error: ${err}\r\n`);
        });

        const offOutput = EventsOn(`climode:output:${sessionId}`, (data: string) => {
            term.write(data);
        });
        const offExit = EventsOn(`climode:exit:${sessionId}`, () => {
            closeRef.current();
        });

        const onData = term.onData((data) => {
            WriteToCliModeSession(sessionId, data).catch(() => {});
        });

        const observer = new ResizeObserver(() => {
            fitAddon.fit();
            ResizeCliModeSession(sessionId, term.cols, term.rows).catch(() => {});
        });
        observer.observe(containerRef.current);

        term.focus();

        return () => {
            clearTimeout(fitTimer);
            offOutput();
            offExit();
            onData.dispose();
            observer.disconnect();
            CloseCliModeSession(sessionId).catch(() => {});
            term.dispose();
        };
    }, []);

    return (
        <div
            style={{
                position: 'absolute',
                inset: 0,
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                background: '#10141a',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 10px',
                    borderBottom: '1px solid #2a323d',
                    color: '#8b95a7',
                    fontSize: 12,
                    fontFamily: '"JetBrains Mono", monospace',
                }}
            >
                <span>
                    <span style={{ color: '#2dd4bf', fontWeight: 600 }}>CLI MODE</span>
                    &nbsp;— terminal UI
                </span>
                <button
                    onClick={() => closeRef.current()}
                    style={{
                        background: 'transparent',
                        border: '1px solid #2a323d',
                        color: '#dfe2eb',
                        borderRadius: 4,
                        padding: '2px 10px',
                        cursor: 'pointer',
                        fontSize: 12,
                    }}
                >
                    Exit CLI Mode
                </button>
            </div>
            <div
                ref={containerRef}
                style={{
                    flex: 1,
                    padding: '4px',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                }}
            />
        </div>
    );
}
