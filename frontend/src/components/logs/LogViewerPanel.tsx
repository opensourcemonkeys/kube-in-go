import { useEffect, useRef, useState, useCallback } from 'react';
import { VscListFlat } from 'react-icons/vsc';
import { IDockviewPanelProps } from 'dockview';
import { LazyLog } from '@melloware/react-logviewer';
import { Dropdown } from 'primereact/dropdown';
import { EventsOn } from '../../../wailsjs/runtime/runtime';
import { useT } from '../../i18n/useT';
import {
    GetPodContainers,
    GetDeploymentPods,
    GetStatefulSetPods,
    GetReplicaSetPods,
    GetDaemonSetPods,
    GetJobPods,
    GetCronJobPods,
    StartLogStream,
    StopLogStream,
} from '../../../wailsjs/go/controller_app/App';

export type WorkloadKind = 'pod' | 'deployment' | 'statefulset' | 'replicaset' | 'daemonset' | 'job' | 'cronjob';

export interface LogViewerPanelParams {
    clusterName: string;
    resourceKind: WorkloadKind;
    name: string;
    namespace: string;
}

async function fetchPodsForKind(clusterName: string, kind: WorkloadKind, name: string, namespace: string): Promise<string[]> {
    switch (kind) {
        case 'deployment':   return GetDeploymentPods(clusterName, name, namespace);
        case 'statefulset':  return GetStatefulSetPods(clusterName, name, namespace);
        case 'replicaset':   return GetReplicaSetPods(clusterName, name, namespace);
        case 'daemonset':    return GetDaemonSetPods(clusterName, name, namespace);
        case 'job':          return GetJobPods(clusterName, name, namespace);
        case 'cronjob':      return GetCronJobPods(clusterName, name, namespace);
        default:             return [];
    }
}

const ALL_CONTAINERS = '';

/**
 * How many log lines the viewer keeps. A chatty pod emits megabytes a minute,
 * and the panel used to hold every byte of it in one ever-growing string —
 * a renderer OOM given enough time. Same shape as `stores/metricsStore`'s
 * MAX_POINTS: keep the newest N, say so on screen, drop the rest.
 */
const MAX_LOG_LINES = 5000;

/** Flush interval for accumulated stream output, in ms. */
const FLUSH_MS = 120;

export default function LogViewerPanel({ params }: IDockviewPanelProps<LogViewerPanelParams>) {
    const t = useT();
    const { clusterName, resourceKind, name, namespace } = params;
    const cn = clusterName ?? '';

    const [pods, setPods] = useState<string[]>([]);
    const [selectedPod, setSelectedPod] = useState('');
    const [containers, setContainers] = useState<string[]>([]);
    const [selectedContainer, setSelectedContainer] = useState(ALL_CONTAINERS);
    const [logText, setLogText] = useState(' ');
    const [truncated, setTruncated] = useState(false);

    const pendingRef = useRef('');
    const sessionIdsRef = useRef<string[]>([]);
    const offHandlersRef = useRef<Array<() => void>>([]);
    // The ring buffer: complete lines, newest last. `tailRef` holds the partial
    // last line, because a stream chunk boundary is not a line boundary —
    // appending it to the buffer would split one log line into two.
    const linesRef = useRef<string[]>([]);
    const tailRef = useRef('');

    const resetBuffer = useCallback(() => {
        pendingRef.current = '';
        linesRef.current = [];
        tailRef.current = '';
        setTruncated(false);
        setLogText(' ');
    }, []);

    // Batch the stream into one state update per tick: an event per line would
    // re-render (and re-layout LazyLog) hundreds of times a second.
    useEffect(() => {
        const timer = setInterval(() => {
            if (!pendingRef.current) return;
            const chunk = tailRef.current + pendingRef.current;
            pendingRef.current = '';
            const parts = chunk.split('\n');
            tailRef.current = parts.pop() ?? '';
            const lines = linesRef.current;
            for (const part of parts) lines.push(part);
            if (lines.length > MAX_LOG_LINES) {
                lines.splice(0, lines.length - MAX_LOG_LINES);
                setTruncated(true);
            }
            const text = tailRef.current ? [...lines, tailRef.current].join('\n') : lines.join('\n');
            // LazyLog treats '' as "no content at all"; a single space is what
            // this panel has always used for the empty state.
            setLogText(text || ' ');
        }, FLUSH_MS);
        return () => clearInterval(timer);
    }, []);

    const stopStreams = useCallback(() => {
        offHandlersRef.current.forEach(off => off());
        offHandlersRef.current = [];
        sessionIdsRef.current.forEach(id => StopLogStream(id).catch(() => {}));
        sessionIdsRef.current = [];
    }, []);

    // For pods use the name directly; for other workloads fetch pod list
    useEffect(() => {
        if (resourceKind === 'pod') {
            setSelectedPod(name);
        } else {
            fetchPodsForKind(cn, resourceKind, name, namespace)
                .then(podNames => {
                    setPods(podNames);
                    if (podNames.length > 0) setSelectedPod(podNames[0]);
                    else setSelectedPod('');
                })
                .catch(() => setPods([]));
        }
    }, [resourceKind, name, namespace]);

    // Load containers when selected pod changes
    useEffect(() => {
        if (!selectedPod) return;
        GetPodContainers(cn, selectedPod, namespace)
            .then(names => {
                setContainers(names);
                setSelectedContainer(ALL_CONTAINERS);
            })
            .catch(() => setContainers([]));
    }, [selectedPod, namespace]);

    // Start / restart streams whenever pod or container selection changes
    useEffect(() => {
        if (!selectedPod || containers.length === 0) return;

        stopStreams();
        resetBuffer();

        const containersToStream = selectedContainer ? [selectedContainer] : containers;
        const newSessionIds: string[] = [];
        const newOffHandlers: Array<() => void> = [];

        containersToStream.forEach(container => {
            const sessionId = `log:${namespace}:${selectedPod}:${container}:${Date.now()}`;
            newSessionIds.push(sessionId);

            const prefix = containersToStream.length > 1 ? `[${container}] ` : '';

            const off = EventsOn(`log:output:${sessionId}`, (data: string) => {
                pendingRef.current += prefix + data;
            });
            newOffHandlers.push(off);

            StartLogStream(cn, sessionId, selectedPod, namespace, container).catch((err: unknown) => {
                pendingRef.current += `[error] ${String(err)}\n`;
            });
        });

        sessionIdsRef.current = newSessionIds;
        offHandlersRef.current = newOffHandlers;

        return stopStreams;
    }, [selectedPod, selectedContainer, containers, namespace, stopStreams, resetBuffer]);

    const containerOptions = [
        { label: 'All containers', value: ALL_CONTAINERS },
        ...containers.map(c => ({ label: c, value: c })),
    ];

    return (
        <div className="log-viewer-panel">
            <div className="log-viewer-toolbar">
                <VscListFlat size={14} />
                <span className="log-viewer-toolbar__label">{t('panels:logs.label')}</span>

                {resourceKind !== 'pod' && pods.length > 0 && (
                    <Dropdown
                        value={selectedPod}
                        options={pods}
                        onChange={e => setSelectedPod(e.value)}
                        placeholder={t('panels:logs.selectPod')}
                        className="log-viewer-dropdown"
                    />
                )}

                {containers.length > 0 && (
                    <Dropdown
                        value={selectedContainer}
                        options={containerOptions}
                        onChange={e => setSelectedContainer(e.value)}
                        placeholder={t('panels:logs.container')}
                        className="log-viewer-dropdown"
                    />
                )}

                {truncated && (
                    <span className="log-viewer-toolbar__note">
                        {t('panels:logs.truncated', { lines: MAX_LOG_LINES })}
                    </span>
                )}
            </div>

            <div className="log-viewer-body">
                <LazyLog
                    text={logText}
                    follow={true}
                    enableSearch={true}
                    selectableLines={true}
                    wrapLines={false}
                    height="auto"
                    width="auto"
                />
            </div>
        </div>
    );
}
