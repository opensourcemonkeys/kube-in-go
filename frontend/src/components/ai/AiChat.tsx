import { useCallback, useEffect, useRef, useState } from 'react';
import { VscClose, VscSend, VscTrash, VscRefresh, VscHubot, VscCheck, VscChromeClose, VscCloudDownload, VscArrowLeft, VscChevronRight, VscChevronDown } from 'react-icons/vsc';
import { Dropdown } from 'primereact/dropdown';
import { EventsOn, EventsOff, BrowserOpenURL } from '../../../wailsjs/runtime/runtime';
import { StartAiChat, StopAiChat, ListAiModels, ConfirmToolCall, AiAvailable, AiModelSupportsTools, ListAiModelCatalog, ListAiModelTags, PullAiModel, StopAiPull } from '../../../wailsjs/go/controller_app/App';
import { models as goModels } from '../../../wailsjs/go/models';
import { useTabContext } from '../../contexts/TabContext';
import { useClusterContext } from '../../contexts/ClusterContext';
import { useAiChatStore, ChatMessage, ToolLine } from '../../stores/aiChatStore';
import { Trans } from 'react-i18next';
import { useT } from '../../i18n/useT';

interface ConfirmReq { id: string; name: string; args: Record<string, unknown>; }
interface PullState { percent: number; status: string; error?: string; }

const OLLAMA_DOWNLOAD_URL = 'https://ollama.com/download';

function buildContext(api: ReturnType<ReturnType<typeof useTabContext>['getApi']>, activeCluster: string): string {
    const panels: any[] = (api as any)?.panels ?? [];
    const active: any = (api as any)?.activePanel ?? null;
    const tab = (p: any) => ({ id: p?.id, title: p?.title, view: p?.params?.view, cluster: p?.params?.clusterName, params: p?.params });
    return JSON.stringify({
        activeCluster,
        openTabs: panels.map(tab),
        activeTab: active ? tab(active) : null,
    }, null, 2);
}

function fmtBytes(n?: number): string {
    if (!n) return '';
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0, v = n;
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

export default function AiChat() {
    const t = useT();
    const { open, setOpen, host, model, messages, setModel, setMessages, clear } = useAiChatStore();
    const { getApi } = useTabContext();
    const { activeCluster } = useClusterContext();

    const [available, setAvailable] = useState<boolean | null>(null);
    const [toolSupport, setToolSupport] = useState<boolean | null>(null);
    const [view, setView] = useState<'chat' | 'models'>('chat');
    const [modelList, setModelList] = useState<string[]>([]);
    const [catalog, setCatalog] = useState<goModels.OllamaModelInfo[]>([]);
    const [catalogError, setCatalogError] = useState('');
    const [modelSearch, setModelSearch] = useState('');
    const [pullInput, setPullInput] = useState('');
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [tags, setTags] = useState<Record<string, string[] | 'loading' | 'error'>>({});
    const [pulls, setPulls] = useState<Record<string, PullState>>({});
    const [input, setInput] = useState('');
    const [streaming, setStreaming] = useState(false);
    const [liveText, setLiveText] = useState('');
    const [liveTools, setLiveTools] = useState<ToolLine[]>([]);
    const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
    const [confirmQueue, setConfirmQueue] = useState<ConfirmReq[]>([]);

    const sessionId = useRef(`ai-${Date.now()}`).current;
    const liveTextRef = useRef('');
    const liveToolsRef = useRef<ToolLine[]>([]);
    const scrollRef = useRef<HTMLDivElement | null>(null);

    // ---- availability + model lists ----
    const checkAvailable = useCallback(() => {
        setAvailable(null);
        AiAvailable(host).then(setAvailable).catch(() => setAvailable(false));
    }, [host]);

    const loadModels = useCallback(() => {
        ListAiModels(host)
            .then((m) => {
                setModelList(m || []);
                if (!useAiChatStore.getState().model && m && m.length) setModel(m[0]);
            })
            .catch(() => { /* gated by availability */ });
    }, [host, setModel]);

    const loadCatalog = useCallback(() => {
        setCatalogError('');
        ListAiModelCatalog(host)
            .then((c) => setCatalog(c || []))
            .catch((e) => setCatalogError(String(e)));
    }, [host]);

    useEffect(() => { if (open) checkAvailable(); }, [open, checkAvailable]);
    useEffect(() => { if (open && available) { loadModels(); loadCatalog(); } }, [open, available, loadModels, loadCatalog]);

    // Detect whether the selected model can do tool calling (function calling).
    useEffect(() => {
        if (!open || !available || !model) { setToolSupport(null); return; }
        let cancelled = false;
        setToolSupport(null);
        AiModelSupportsTools(host, model)
            .then((ok) => { if (!cancelled) setToolSupport(ok); })
            .catch(() => { if (!cancelled) setToolSupport(null); });
        return () => { cancelled = true; };
    }, [open, available, host, model]);

    // ---- chat streaming events ----
    const finalize = useCallback((errText?: string) => {
        const content = errText ? (liveTextRef.current ? liveTextRef.current + '\n\n' : '') + `⚠️ ${errText}` : liveTextRef.current;
        const msg: ChatMessage = { role: 'assistant', content, tools: liveToolsRef.current.slice() };
        setMessages([...useAiChatStore.getState().messages, msg]);
        liveTextRef.current = '';
        liveToolsRef.current = [];
        setLiveText('');
        setLiveTools([]);
        setStreaming(false);
        setConfirmQueue([]);
    }, [setMessages]);

    useEffect(() => {
        const onToken = (t: string) => { liveTextRef.current += t; setLiveText(liveTextRef.current); };
        const onTool = (ev: ToolLine) => {
            const arr = liveToolsRef.current.slice();
            const i = arr.findIndex((x) => x.id === ev.id);
            if (i >= 0) arr[i] = { ...arr[i], ...ev }; else arr.push(ev);
            liveToolsRef.current = arr;
            setLiveTools(arr);
        };
        const onConfirm = (req: ConfirmReq) => setConfirmQueue((q) => [...q, req]);
        const onDone = () => finalize();
        const onError = (e: string) => finalize(e || 'request failed');

        EventsOn(`ai:token:${sessionId}`, onToken);
        EventsOn(`ai:tool:${sessionId}`, onTool);
        EventsOn(`ai:confirm:${sessionId}`, onConfirm);
        EventsOn(`ai:done:${sessionId}`, onDone);
        EventsOn(`ai:error:${sessionId}`, onError);
        return () => {
            EventsOff(`ai:token:${sessionId}`);
            EventsOff(`ai:tool:${sessionId}`);
            EventsOff(`ai:confirm:${sessionId}`);
            EventsOff(`ai:done:${sessionId}`);
            EventsOff(`ai:error:${sessionId}`);
        };
    }, [sessionId, finalize]);

    // ---- pull (download) events ----
    useEffect(() => {
        const onProg = (p: any) => setPulls((prev) => ({ ...prev, [p.model]: { percent: p.percent || 0, status: p.status || '' } }));
        const onDone = (p: any) => {
            setPulls((prev) => { const n = { ...prev }; delete n[p.model]; return n; });
            loadModels(); loadCatalog();
            if (!useAiChatStore.getState().model) setModel(p.model);
        };
        const onErr = (p: any) => setPulls((prev) => ({ ...prev, [p.model]: { percent: prev[p.model]?.percent || 0, status: 'error', error: p.error } }));
        EventsOn('ai:pull', onProg);
        EventsOn('ai:pull-done', onDone);
        EventsOn('ai:pull-error', onErr);
        return () => { EventsOff('ai:pull'); EventsOff('ai:pull-done'); EventsOff('ai:pull-error'); };
    }, [loadModels, loadCatalog, setModel]);

    // autoscroll chat
    useEffect(() => {
        const el = scrollRef.current;
        if (el && view === 'chat') el.scrollTop = el.scrollHeight;
    }, [messages, liveText, liveTools, confirmQueue, open, view]);

    const send = () => {
        const text = input.trim();
        if (!text || streaming || !model || !available) return;
        const next = [...messages, { role: 'user' as const, content: text }];
        setMessages(next);
        setInput('');
        liveTextRef.current = '';
        liveToolsRef.current = [];
        setLiveText('');
        setLiveTools([]);
        setStreaming(true);
        const payload = JSON.stringify(next.map((m) => ({ role: m.role, content: m.content })));
        const context = buildContext(getApi(), activeCluster);
        StartAiChat(sessionId, host, model, activeCluster, payload, context).catch((e) => finalize(String(e)));
    };

    const answerConfirm = (approved: boolean) => {
        const req = confirmQueue[0];
        if (!req) return;
        ConfirmToolCall(sessionId, req.id, approved).catch(() => { /* ignore */ });
        setConfirmQueue((q) => q.slice(1));
    };

    const stop = () => { StopAiChat(sessionId).catch(() => {}); };

    const startPull = (name: string) => {
        setPulls((prev) => ({ ...prev, [name]: { percent: 0, status: 'starting…' } }));
        PullAiModel(host, name).catch((e) => setPulls((prev) => ({ ...prev, [name]: { percent: 0, status: 'error', error: String(e) } })));
    };
    const cancelPull = (name: string) => {
        StopAiPull(name).catch(() => {});
        setPulls((prev) => { const n = { ...prev }; delete n[name]; return n; });
    };
    const pullFreeText = () => {
        const v = pullInput.trim();
        if (!v) return;
        startPull(v);
        setPullInput('');
    };
    const toggleExpand = (base: string) => {
        setExpanded((prev) => ({ ...prev, [base]: !prev[base] }));
        if (!tags[base]) {
            setTags((prev) => ({ ...prev, [base]: 'loading' }));
            ListAiModelTags(base)
                .then((t) => setTags((prev) => ({ ...prev, [base]: t || [] })))
                .catch(() => setTags((prev) => ({ ...prev, [base]: 'error' })));
        }
    };

    if (!open) return null;

    const style: React.CSSProperties = pos ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : {};

    const onDragStart = (e: React.PointerEvent) => {
        const startX = e.clientX, startY = e.clientY;
        const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
        const baseX = rect.left, baseY = rect.top;
        const move = (ev: PointerEvent) => setPos({ x: baseX + (ev.clientX - startX), y: baseY + (ev.clientY - startY) });
        const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };

    const confirm = confirmQueue[0];
    const installedSet = new Set(modelList);
    const isInstalled = (ref: string) => installedSet.has(ref) || installedSet.has(`${ref}:latest`);
    const activePulls = Object.entries(pulls);
    const filteredCatalog = catalog.filter((m) => {
        const q = modelSearch.trim().toLowerCase();
        if (!q) return true;
        return m.name.toLowerCase().includes(q) || (m.description || '').toLowerCase().includes(q);
    });

    return (
        <div className="ai-float" style={style}>
            <div className="ai-float__head" onPointerDown={onDragStart}>
                {view === 'models' ? (
                    <>
                        <button className="ai-float__icon" title={t('panels:ai.backToChat')} onClick={(e) => { e.stopPropagation(); setView('chat'); }}><VscArrowLeft size={15} /></button>
                        <span className="ai-float__title">{t('panels:ai.models')}</span>
                        <button className="ai-float__icon" style={{ marginLeft: 'auto' }} title={t('panels:ai.refresh')} onClick={(e) => { e.stopPropagation(); loadCatalog(); }}><VscRefresh size={13} /></button>
                    </>
                ) : (
                    <>
                        <VscHubot size={15} className="ai-float__logo" />
                        <span className="ai-float__title">{t('panels:ai.assistant')}</span>
                        <Dropdown
                            className="ai-float__model"
                            panelClassName="ai-model-dropdown"
                            appendTo={document.body}
                            value={model}
                            options={modelList.map((m) => ({ label: m, value: m }))}
                            onChange={(e) => setModel(e.value)}
                            placeholder={t('panels:ai.modelPlaceholder')}
                            disabled={!available}
                            filter={modelList.length > 6}
                            onClick={(e) => e.stopPropagation()}
                        />
                        <button className="ai-float__icon" title={t('panels:ai.manageModels')} disabled={!available} onClick={(e) => { e.stopPropagation(); setView('models'); loadCatalog(); }}><VscCloudDownload size={14} /></button>
                        <button className="ai-float__icon" title={t('panels:ai.clearChat')} onClick={(e) => { e.stopPropagation(); clear(); }}><VscTrash size={13} /></button>
                    </>
                )}
                <button className="ai-float__icon" title={t('panels:ai.close')} onClick={(e) => { e.stopPropagation(); setOpen(false); }}><VscClose size={14} /></button>
            </div>

            {/* Not-available gate */}
            {available === false && (
                <div className="ai-install">
                    <VscHubot size={34} className="ai-install__logo" />
                    <div className="ai-install__title">{t('panels:ai.ollamaMissingTitle')}</div>
                    <div className="ai-install__text">
                        <Trans t={t} i18nKey="panels:ai.ollamaMissing" values={{ host }} components={{ 1: <code /> }} />
                    </div>
                    <div className="ai-install__btns">
                        <button className="ai-install__primary" onClick={() => BrowserOpenURL(OLLAMA_DOWNLOAD_URL)}><VscCloudDownload size={13} /> {t('panels:ai.installOllama')}</button>
                        <button className="ai-install__retry" onClick={checkAvailable}><VscRefresh size={13} /> {t('action.retry')}</button>
                    </div>
                </div>
            )}

            {available === null && (
                <div className="ai-float__empty" style={{ flex: 1 }}>{t('panels:ai.connecting')}</div>
            )}

            {/* Model manager */}
            {available && view === 'models' && (
                <div className="ai-models">
                    <div className="ai-models__search">
                        <input value={modelSearch} onChange={(e) => setModelSearch(e.target.value)} placeholder={t('panels:ai.searchCatalog')} />
                    </div>
                    <div className="ai-models__pull">
                        <input
                            value={pullInput}
                            onChange={(e) => setPullInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); pullFreeText(); } }}
                            placeholder={t('panels:ai.pullPlaceholder')}
                        />
                        <button className="ai-model__dl" title={t('panels:ai.download')} disabled={!pullInput.trim()} onClick={pullFreeText}><VscCloudDownload size={14} /></button>
                    </div>
                    {catalogError && <div className="ai-float__hint">{t('panels:ai.catalogError', { error: catalogError })}</div>}

                    <div className="ai-models__list">
                        {/* active downloads (covers free-text pulls not shown elsewhere) */}
                        {activePulls.length > 0 && (
                            <div className="ai-models__active">
                                {activePulls.map(([name, pull]) => (
                                    <div className="ai-model ai-model--pulling" key={`p-${name}`}>
                                        <div className="ai-model__info">
                                            <div className="ai-model__name">{name}</div>
                                            <div className="ai-model__progress">
                                                <div className="ai-model__bar"><div className="ai-model__barfill" style={{ width: `${Math.max(2, pull.percent)}%` }} /></div>
                                                <div className={`ai-model__pstatus${pull.error ? ' ai-model__pstatus--err' : ''}`}>
                                                    {pull.error ? `error: ${pull.error}` : `${pull.status}${pull.percent ? ` · ${pull.percent.toFixed(0)}%` : ''}`}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="ai-model__action">
                                            <button className="ai-model__cancel" title={t('panels:ai.cancel')} onClick={() => cancelPull(name)}><VscChromeClose size={13} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {filteredCatalog.map((m) => {
                            const base = m.name.split(':')[0];
                            const pull = pulls[m.name];
                            const isOpen = !!expanded[base];
                            const tagState = tags[base];
                            return (
                                <div className="ai-model-group" key={m.name}>
                                    <div className="ai-model">
                                        <button className="ai-model__expand" title={t('panels:ai.showSizes')} onClick={() => toggleExpand(base)}>
                                            {isOpen ? <VscChevronDown size={13} /> : <VscChevronRight size={13} />}
                                        </button>
                                        <div className="ai-model__info" onClick={() => toggleExpand(base)} style={{ cursor: 'pointer' }}>
                                            <div className="ai-model__name">
                                                {m.name}
                                                {m.installed && <span className="ai-model__badge">{t('panels:ai.installed')}</span>}
                                                {!!m.vramBytes && <span className="ai-model__meta">~{fmtBytes(m.vramBytes)} VRAM</span>}
                                            </div>
                                            {m.description && <div className="ai-model__desc">{m.description}</div>}
                                        </div>
                                        <div className="ai-model__action">
                                            {isInstalled(m.name) ? (
                                                <span className="ai-model__installed"><VscCheck size={14} /></span>
                                            ) : pull && !pull.error ? (
                                                <button className="ai-model__cancel" title={t('panels:ai.cancel')} onClick={() => cancelPull(m.name)}><VscChromeClose size={13} /></button>
                                            ) : (
                                                <button className="ai-model__dl" title={`Download ${m.name}`} onClick={() => startPull(m.name)}><VscCloudDownload size={14} /></button>
                                            )}
                                        </div>
                                    </div>

                                    {isOpen && (
                                        <div className="ai-variants">
                                            {tagState === 'loading' && <div className="ai-variants__msg">{t('panels:ai.loadingSizes')}</div>}
                                            {tagState === 'error' && <div className="ai-variants__msg">{t('panels:ai.sizesError')}</div>}
                                            {Array.isArray(tagState) && tagState.length === 0 && <div className="ai-variants__msg">{t('panels:ai.noTags')}</div>}
                                            {Array.isArray(tagState) && tagState.map((tag) => {
                                                const ref = `${base}:${tag}`;
                                                const vpull = pulls[ref];
                                                return (
                                                    <div className="ai-variant" key={ref}>
                                                        <span className="ai-variant__tag">{tag}</span>
                                                        {vpull && (
                                                            <span className={`ai-variant__status${vpull.error ? ' ai-model__pstatus--err' : ''}`}>
                                                                {vpull.error ? t('panels:ai.pullError') : `${vpull.percent ? vpull.percent.toFixed(0) + '%' : vpull.status}`}
                                                            </span>
                                                        )}
                                                        {isInstalled(ref) ? (
                                                            <span className="ai-model__installed"><VscCheck size={13} /></span>
                                                        ) : vpull && !vpull.error ? (
                                                            <button className="ai-model__cancel" title={t('panels:ai.cancel')} onClick={() => cancelPull(ref)}><VscChromeClose size={12} /></button>
                                                        ) : (
                                                            <button className="ai-model__dl ai-model__dl--sm" title={`Download ${ref}`} onClick={() => startPull(ref)}><VscCloudDownload size={13} /></button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {filteredCatalog.length === 0 && !catalogError && <div className="ai-float__empty">{t('panels:ai.noModelsMatch')}</div>}
                    </div>
                </div>
            )}

            {/* Chat */}
            {available && view === 'chat' && (
                <>
                    <div className="ai-float__body" ref={scrollRef}>
                        {model && toolSupport === false && (
                            <div className="ai-float__warn">
                                <Trans
                                    t={t}
                                    i18nKey="panels:ai.noToolSupport"
                                    values={{ model }}
                                    components={{ 1: <b />, 3: <b />, 5: <code />, 7: <code /> }}
                                />
                            </div>
                        )}
                        {modelList.length === 0 && (
                            <div className="ai-float__hint">
                                <Trans t={t} i18nKey="panels:ai.noModelsInstalled" components={{ 1: <b />, 3: <code /> }} />
                            </div>
                        )}
                        {messages.length === 0 && !streaming && (
                            <div className="ai-float__empty">{t('panels:ai.emptyChat')}</div>
                        )}
                        {messages.map((m, i) => <Message key={i} msg={m} />)}
                        {streaming && (
                            <div className="ai-msg ai-msg--assistant">
                                <ToolLines tools={liveTools} />
                                {liveText && <div className="ai-msg__text">{liveText}</div>}
                                <div className="ai-working" aria-label={t('panels:ai.working')}>
                                    <span /><span /><span />
                                    <em>{t('panels:ai.workingEllipsis')}</em>
                                </div>
                            </div>
                        )}
                    </div>

                    {confirm && (
                        <div className="ai-confirm">
                            <div className="ai-confirm__title">{t('panels:ai.approveAction')} <b>{confirm.name}</b></div>
                            <pre className="ai-confirm__args">{JSON.stringify(confirm.args, null, 2)}</pre>
                            <div className="ai-confirm__btns">
                                <button className="ai-confirm__deny" onClick={() => answerConfirm(false)}><VscChromeClose size={12} /> {t('panels:ai.deny')}</button>
                                <button className="ai-confirm__approve" onClick={() => answerConfirm(true)}><VscCheck size={12} /> {t('panels:ai.approve')}</button>
                            </div>
                        </div>
                    )}

                    <div className="ai-float__input">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                            placeholder={t(model ? 'panels:ai.messagePlaceholder' : 'panels:ai.noModelPlaceholder')}
                            rows={2}
                        />
                        {streaming
                            ? <button className="ai-float__send ai-float__send--stop" onClick={stop} title={t('panels:ai.stop')}><VscChromeClose size={15} /></button>
                            : <button className="ai-float__send" onClick={send} disabled={!input.trim() || !model} title={t('panels:ai.send')}><VscSend size={15} /></button>}
                    </div>
                </>
            )}
        </div>
    );
}

function Message({ msg }: { msg: ChatMessage }) {
    return (
        <div className={`ai-msg ai-msg--${msg.role}`}>
            {msg.tools && msg.tools.length > 0 && <ToolLines tools={msg.tools} />}
            {msg.content && <div className="ai-msg__text">{msg.content}</div>}
        </div>
    );
}

function ToolLines({ tools }: { tools: ToolLine[] }) {
    const t = useT();
    if (!tools.length) return null;
    return (
        <div className="ai-tools">
            {tools.map((tool) => (
                <div key={tool.id} className={`ai-tool ai-tool--${tool.status}`}>
                    <span className="ai-tool__dot" />
                    <span className="ai-tool__name">{tool.name}</span>
                    {tool.mutating && <span className="ai-tool__badge">{t('panels:ai.mutating')}</span>}
                    <span className="ai-tool__status">{tool.status}</span>
                </div>
            ))}
        </div>
    );
}
