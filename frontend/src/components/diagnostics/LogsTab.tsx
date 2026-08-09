import { useEffect, useMemo, useRef, useState } from 'react';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { MultiSelect } from 'primereact/multiselect';
import { Checkbox } from 'primereact/checkbox';
import { models } from '../../../wailsjs/go/models';
import { TailLogs, SetLogLevel, GetLogLevel } from '../../../wailsjs/go/controller_app/App';
import { useDiagnosticsStore, type LevelFilter } from '../../stores/diagnosticsStore';

const TAIL_ROWS = 500;
const POLL_MS = 2000;

const LEVELS: { label: string; value: LevelFilter }[] = [
    { label: 'All levels', value: '' },
    { label: 'DEBUG and up', value: 'DEBUG' },
    { label: 'INFO and up', value: 'INFO' },
    { label: 'WARN and up', value: 'WARN' },
    { label: 'ERROR only', value: 'ERROR' },
];

const BACKEND_LEVELS = ['DEBUG', 'INFO', 'WARN', 'ERROR'].map((l) => ({ label: l, value: l }));

const ROLES = [
    { label: 'backend', value: 'backend' },
    { label: 'cli', value: 'cli' },
    { label: 'shell', value: 'shell' },
];

/**
 * Live tail of today's log file.
 *
 * Level and text filtering run on the backend so a search covers the whole
 * window on disk rather than only the rows already fetched. Role and pid
 * filtering are client-side: they are cheap, and they exist because one file
 * carries every process — the backend, the CLI, and the Electron shell — which
 * is confusing without a way to narrow it down.
 */
export default function LogsTab({ active, ownPid }: { active: boolean; ownPid: number }) {
    const {
        levelFilter, setLevelFilter,
        query, setQuery,
        roleFilter, setRoleFilter,
        thisProcessOnly, setThisProcessOnly,
        autoFollow, setAutoFollow,
    } = useDiagnosticsStore();

    const [entries, setEntries] = useState<models.LogEntry[]>([]);
    const [backendLevel, setBackendLevel] = useState('INFO');
    const [error, setError] = useState<string | null>(null);

    // Debounced copy of the query, so typing does not fire a call per keystroke.
    const [debouncedQuery, setDebouncedQuery] = useState(query);
    useEffect(() => {
        const t = setTimeout(() => setDebouncedQuery(query), 300);
        return () => clearTimeout(t);
    }, [query]);

    useEffect(() => {
        GetLogLevel().then(setBackendLevel).catch(() => { /* keep the default */ });
    }, []);

    useEffect(() => {
        if (!active) return; // usePanelActive: a backgrounded tab must not poll
        let cancelled = false;

        const load = () => {
            TailLogs(TAIL_ROWS, levelFilter, debouncedQuery)
                .then((rows) => {
                    if (cancelled) return;
                    setEntries(rows ?? []);
                    setError(null);
                })
                .catch((e) => {
                    if (!cancelled) setError(String(e));
                });
        };

        load();
        const id = setInterval(load, POLL_MS);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [active, levelFilter, debouncedQuery]);

    const rows = useMemo(() => {
        let out = entries;
        if (roleFilter.length) out = out.filter((e) => roleFilter.includes(e.role));
        if (thisProcessOnly && ownPid) out = out.filter((e) => e.pid === ownPid);
        return out;
    }, [entries, roleFilter, thisProcessOnly, ownPid]);

    const bottomRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        if (autoFollow) bottomRef.current?.scrollIntoView({ block: 'end' });
    }, [rows, autoFollow]);

    return (
        <div className="diag-tab diag-tab--logs">
            <div className="diag-toolbar">
                <Dropdown
                    value={levelFilter}
                    options={LEVELS}
                    onChange={(e) => setLevelFilter(e.value)}
                    className="diag-toolbar__level"
                />
                <InputText
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search the log…"
                    className="diag-toolbar__search"
                />
                <MultiSelect
                    value={roleFilter}
                    options={ROLES}
                    onChange={(e) => setRoleFilter(e.value)}
                    placeholder="All roles"
                    className="diag-toolbar__roles"
                    showClear
                />
                <label className="diag-toggle">
                    <Checkbox
                        checked={thisProcessOnly}
                        onChange={(e) => setThisProcessOnly(Boolean(e.checked))}
                    />
                    <span>This process only</span>
                </label>
                <label className="diag-toggle">
                    <Checkbox
                        checked={autoFollow}
                        onChange={(e) => setAutoFollow(Boolean(e.checked))}
                    />
                    <span>Follow</span>
                </label>
            </div>

            <div className="diag-levelbar">
                <span className="diag-levelbar__label">Backend log level</span>
                <Dropdown
                    value={backendLevel}
                    options={BACKEND_LEVELS}
                    onChange={(e) => {
                        SetLogLevel(e.value)
                            .then(() => GetLogLevel())
                            .then(setBackendLevel)
                            .catch(() => { /* the dropdown snaps back below */ });
                    }}
                />
                <span className="diag-levelbar__hint">
                    Applies to this window&apos;s backend. Other windows of this app share it;
                    a separately launched instance does not, until it restarts.
                </span>
            </div>

            {error && <div className="diag-error">{error}</div>}

            <div className="diag-log">
                {rows.length === 0 && (
                    <div className="diag-empty">
                        Nothing matches. The log only holds today&apos;s records.
                    </div>
                )}
                {rows.map((e, i) => (
                    <div className="diag-log-row" key={`${e.timestamp}-${i}`}>
                        <span className={`diag-pill diag-pill--${e.level.toLowerCase()}`}>
                            {e.level}
                        </span>
                        <span className="diag-log-row__ts">{e.timestamp}</span>
                        <span className="diag-log-row__role">{e.role}</span>
                        <span className="diag-log-row__logger">{e.logger}</span>
                        <span className="diag-log-row__msg">{e.message}</span>
                        {e.fields && <span className="diag-log-row__fields">{e.fields}</span>}
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>
        </div>
    );
}
