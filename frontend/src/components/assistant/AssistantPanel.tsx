import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from 'primereact/button';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Toast } from 'primereact/toast';
import {
    AskAssistant,
    GetAIConfig,
    SaveAIConfig,
    GetChatHistory,
    SaveChatHistory,
    ClearChatHistory,
} from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    time: string;
}

const PROVIDER_OPTIONS = [
    { label: 'Claude (Anthropic)', value: 'claude' },
    { label: 'OpenAI (GPT-4o)', value: 'openai' },
];

export default function AssistantPanel() {
    const [open, setOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [provider, setProvider] = useState('claude');
    const [anthropicKey, setAnthropicKey] = useState('');
    const [openaiKey, setOpenaiKey] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const toast = useRef<Toast>(null);

    useEffect(() => {
        GetChatHistory().then((history) => {
            if (history && history.length > 0) {
                setMessages((history as Omit<Message, 'id'>[]).map((m) => ({ ...m, id: `${m.role}-${m.time}` })));
            }
        }).catch(() => {});

        GetAIConfig().then((cfg) => {
            setProvider(cfg.provider || 'claude');
            setAnthropicKey(cfg.anthropic_api_key || '');
            setOpenaiKey(cfg.openai_api_key || '');
        }).catch(() => {});
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const send = useCallback(async () => {
        const text = input.trim();
        if (!text || loading) return;

        const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text, time: new Date().toISOString() };
        const nextMessages = [...messages, userMsg];
        setMessages(nextMessages);
        setInput('');
        setLoading(true);

        try {
            const history: models.ChatMessage[] = nextMessages.map((m) =>
                models.ChatMessage.createFrom({ role: m.role, content: m.content, time: m.time })
            );
            const reply = await AskAssistant(text, history.slice(0, -1));
            const assistantMsg: Message = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: reply,
                time: new Date().toISOString(),
            };
            const updated = [...nextMessages, assistantMsg];
            setMessages(updated);
            await SaveChatHistory(
                updated.map((m) =>
                    models.ChatMessage.createFrom({ role: m.role, content: m.content, time: m.time })
                )
            );
        } catch (err: any) {
            toast.current?.show({
                severity: 'error',
                summary: 'Assistant Error',
                detail: err?.toString() ?? 'Unknown error',
                life: 5000,
            });
        } finally {
            setLoading(false);
        }
    }, [input, loading, messages]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    };

    const saveSettings = async () => {
        try {
            await SaveAIConfig(
                models.AIConfig.createFrom({
                    provider,
                    anthropic_api_key: anthropicKey,
                    openai_api_key: openaiKey,
                })
            );
            toast.current?.show({ severity: 'success', summary: 'Saved', detail: 'AI settings saved', life: 2000 });
            setSettingsOpen(false);
        } catch (err: any) {
            toast.current?.show({ severity: 'error', summary: 'Error', detail: err?.toString(), life: 4000 });
        }
    };

    const clearHistory = async () => {
        try {
            await ClearChatHistory();
            setMessages([]);
        } catch { /* ignore */ }
    };

    const formatTime = (iso: string) => {
        try {
            return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
            return '';
        }
    };

    const renderContent = (content: string) => {
        const parts = content.split(/(```[\s\S]*?```|`[^`]+`)/g).map((value, i) => ({
            id: `${i}-${value.length}-${value.charCodeAt(0) || 0}`,
            value,
        }));
        return parts.map(({ id, value }) => {
            if (value.startsWith('```') && value.endsWith('```')) {
                const lines = value.slice(3, -3).split('\n');
                const lang = lines[0];
                const code = lines.slice(1).join('\n');
                return (
                    <pre key={id} style={styles.codeBlock}>
                        {lang && <span style={styles.codeLang}>{lang}</span>}
                        <code>{code}</code>
                    </pre>
                );
            }
            if (value.startsWith('`') && value.endsWith('`')) {
                return <code key={id} style={styles.inlineCode}>{value.slice(1, -1)}</code>;
            }
            return <span key={id}>{value}</span>;
        });
    };

    return (
        <>
            <Toast ref={toast} position="bottom-right" />

            {/* Floating button */}
            <div style={styles.fabContainer}>
                <Button
                    icon="pi pi-comments"
                    rounded
                    style={styles.fab}
                    onClick={() => setOpen((v) => !v)}
                    tooltip="AI Assistant"
                    tooltipOptions={{ position: 'left' }}
                />
            </div>

            {/* Chat panel */}
            {open && (
                <div style={styles.panel}>
                    {/* Header */}
                    <div style={styles.header}>
                        <div style={styles.headerLeft}>
                            <i className="pi pi-sparkles" style={{ color: 'var(--primary-color)', fontSize: '1rem' }} />
                            <span style={styles.headerTitle}>AI Assistant</span>
                        </div>
                        <div style={styles.headerActions}>
                            <Button
                                icon="pi pi-trash"
                                text
                                size="small"
                                style={styles.headerBtn}
                                onClick={clearHistory}
                                tooltip="Clear history"
                                tooltipOptions={{ position: 'bottom' }}
                            />
                            <Button
                                icon="pi pi-cog"
                                text
                                size="small"
                                style={styles.headerBtn}
                                onClick={() => setSettingsOpen(true)}
                                tooltip="Settings"
                                tooltipOptions={{ position: 'bottom' }}
                            />
                            <Button
                                icon="pi pi-times"
                                text
                                size="small"
                                style={styles.headerBtn}
                                onClick={() => setOpen(false)}
                            />
                        </div>
                    </div>

                    {/* Messages */}
                    <div style={styles.messages}>
                        {messages.length === 0 && (
                            <div style={styles.emptyState}>
                                <i className="pi pi-sparkles" style={{ fontSize: '2rem', color: 'var(--primary-color)', opacity: 0.5 }} />
                                <p style={{ marginTop: '0.75rem', color: 'var(--text-color-secondary)', fontSize: '0.85rem' }}>
                                    Ask anything about Kubernetes, your cluster, or YAML configs.
                                </p>
                            </div>
                        )}
                        {messages.map((msg) => (
                            <div key={msg.id} style={msg.role === 'user' ? styles.userRow : styles.assistantRow}>
                                <div style={msg.role === 'user' ? styles.userBubble : styles.assistantBubble}>
                                    <div style={styles.bubbleContent}>{renderContent(msg.content)}</div>
                                    <div style={styles.bubbleTime}>{formatTime(msg.time)}</div>
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div style={styles.assistantRow}>
                                <div style={styles.assistantBubble}>
                                    <i className="pi pi-spin pi-spinner" style={{ fontSize: '0.9rem' }} />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div style={styles.inputArea}>
                        <InputTextarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask about Kubernetes... (Enter to send)"
                            autoResize
                            rows={2}
                            style={styles.textarea}
                            disabled={loading}
                        />
                        <Button
                            icon="pi pi-send"
                            rounded
                            size="small"
                            style={styles.sendBtn}
                            onClick={send}
                            loading={loading}
                            disabled={!input.trim()}
                        />
                    </div>
                </div>
            )}

            {/* Settings dialog */}
            <Dialog
                header="AI Assistant Settings"
                visible={settingsOpen}
                onHide={() => setSettingsOpen(false)}
                style={{ width: '420px' }}
                footer={
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <Button label="Cancel" text onClick={() => setSettingsOpen(false)} />
                        <Button label="Save" icon="pi pi-check" onClick={saveSettings} />
                    </div>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>
                    <div>
                        <label htmlFor="settings-provider" style={styles.label}>Provider</label>
                        <Dropdown
                            inputId="settings-provider"
                            value={provider}
                            options={PROVIDER_OPTIONS}
                            onChange={(e) => setProvider(e.value)}
                            style={{ width: '100%' }}
                        />
                    </div>
                    <div>
                        <label htmlFor="settings-anthropic-key" style={styles.label}>Anthropic API Key</label>
                        <InputText
                            id="settings-anthropic-key"
                            value={anthropicKey}
                            onChange={(e) => setAnthropicKey(e.target.value)}
                            placeholder="sk-ant-..."
                            style={{ width: '100%' }}
                            type="password"
                        />
                    </div>
                    <div>
                        <label htmlFor="settings-openai-key" style={styles.label}>OpenAI API Key</label>
                        <InputText
                            id="settings-openai-key"
                            value={openaiKey}
                            onChange={(e) => setOpenaiKey(e.target.value)}
                            placeholder="sk-..."
                            style={{ width: '100%' }}
                            type="password"
                        />
                    </div>
                </div>
            </Dialog>
        </>
    );
}

const styles: Record<string, React.CSSProperties> = {
    fabContainer: {
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 1000,
    },
    fab: {
        width: '48px',
        height: '48px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    },
    panel: {
        position: 'fixed',
        bottom: '84px',
        right: '24px',
        width: '380px',
        height: '520px',
        background: 'var(--surface-card)',
        border: '1px solid var(--surface-border)',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        zIndex: 999,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1rem',
        borderBottom: '1px solid var(--surface-border)',
        background: 'var(--surface-section)',
        flexShrink: 0,
    },
    headerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
    },
    headerTitle: {
        fontWeight: 600,
        fontSize: '0.9rem',
        color: 'var(--text-color)',
    },
    headerActions: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem',
    },
    headerBtn: {
        padding: '0.25rem',
        color: 'var(--text-color-secondary)',
    },
    messages: {
        flex: 1,
        overflowY: 'auto',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        textAlign: 'center',
        padding: '1rem',
    },
    userRow: {
        display: 'flex',
        justifyContent: 'flex-end',
    },
    assistantRow: {
        display: 'flex',
        justifyContent: 'flex-start',
    },
    userBubble: {
        background: 'var(--primary-color)',
        color: 'var(--primary-color-text)',
        borderRadius: '12px 12px 2px 12px',
        padding: '0.6rem 0.85rem',
        maxWidth: '85%',
        fontSize: '0.85rem',
        lineHeight: '1.5',
    },
    assistantBubble: {
        background: 'var(--surface-ground)',
        color: 'var(--text-color)',
        borderRadius: '12px 12px 12px 2px',
        padding: '0.6rem 0.85rem',
        maxWidth: '90%',
        fontSize: '0.85rem',
        lineHeight: '1.5',
        border: '1px solid var(--surface-border)',
    },
    bubbleContent: {
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
    },
    bubbleTime: {
        fontSize: '0.7rem',
        opacity: 0.6,
        marginTop: '0.3rem',
        textAlign: 'right',
    },
    codeBlock: {
        background: 'var(--surface-overlay)',
        borderRadius: '6px',
        padding: '0.5rem 0.75rem',
        fontSize: '0.78rem',
        overflowX: 'auto',
        margin: '0.4rem 0',
        fontFamily: 'JetBrains Mono, monospace',
    },
    codeLang: {
        display: 'block',
        fontSize: '0.7rem',
        opacity: 0.5,
        marginBottom: '0.25rem',
    },
    inlineCode: {
        background: 'var(--surface-overlay)',
        borderRadius: '4px',
        padding: '0.1rem 0.35rem',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '0.82em',
    },
    inputArea: {
        display: 'flex',
        alignItems: 'flex-end',
        gap: '0.5rem',
        padding: '0.75rem',
        borderTop: '1px solid var(--surface-border)',
        background: 'var(--surface-section)',
        flexShrink: 0,
    },
    textarea: {
        flex: 1,
        fontSize: '0.85rem',
        resize: 'none',
        maxHeight: '120px',
    },
    sendBtn: {
        width: '36px',
        height: '36px',
        flexShrink: 0,
    },
    label: {
        display: 'block',
        fontSize: '0.8rem',
        color: 'var(--text-color-secondary)',
        marginBottom: '0.4rem',
        fontWeight: 500,
    },
};
