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

        // Clipboard helpers. The TUI runs with mouse capture disabled (the backend
        // sets KUBEINS_TUI_NOMOUSE) so drag-to-select works natively in xterm here.
        // navigator.clipboard can be unavailable/blocked in the WebKitGTK webview,
        // so fall back to a hidden-textarea execCommand copy.
        const writeClipboard = (text: string) => {
            if (!text) return;
            if (navigator.clipboard?.writeText) {
                navigator.clipboard.writeText(text).catch(() => execCopy(text));
            } else {
                execCopy(text);
            }
        };
        const execCopy = (text: string) => {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand('copy');
            } catch {
                /* ignore */
            }
            document.body.removeChild(ta);
            term.focus();
        };
        const pasteClipboard = () => {
            navigator.clipboard
                ?.readText()
                .then((text) => {
                    if (text) WriteToCliModeSession(sessionId, text).catch(() => {});
                })
                .catch(() => {});
        };

        // Copy selection on Ctrl/Cmd+Shift+C, paste on Ctrl/Cmd+Shift+V. Plain
        // Ctrl+C is left untouched so it still sends SIGINT to the TUI.
        term.attachCustomKeyEventHandler((e) => {
            if (e.type !== 'keydown') return true;
            const combo = (e.ctrlKey && e.shiftKey) || e.metaKey;
            if (!combo) return true;
            const k = e.key.toLowerCase();
            if (k === 'c' && term.hasSelection()) {
                writeClipboard(term.getSelection());
                e.preventDefault();
                return false;
            }
            if (k === 'v') {
                pasteClipboard();
                e.preventDefault();
                return false;
            }
            return true;
        });

        // Auto-copy on drag-select (release), and right-click to paste.
        const el = containerRef.current;
        const onMouseUp = () => {
            if (term.hasSelection()) writeClipboard(term.getSelection());
        };
        const onContextMenu = (ev: MouseEvent) => {
            ev.preventDefault();
            if (term.hasSelection()) {
                writeClipboard(term.getSelection());
                term.clearSelection();
            } else {
                pasteClipboard();
            }
        };
        el.addEventListener('mouseup', onMouseUp);
        el.addEventListener('contextmenu', onContextMenu);

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
            el.removeEventListener('mouseup', onMouseUp);
            el.removeEventListener('contextmenu', onContextMenu);
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
