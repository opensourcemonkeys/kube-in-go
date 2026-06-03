import { useEffect, useRef, useState, useCallback } from 'react';
import FormatAlignLeftOutlined from '@mui/icons-material/FormatAlignLeftOutlined';
import { IDockviewPanelProps } from 'dockview';
import { LazyLog } from '@melloware/react-logviewer';
import { Dropdown } from 'primereact/dropdown';
import { EventsOn } from '../../../wailsjs/runtime/runtime';
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
    resourceKind: WorkloadKind;
    name: string;
    namespace: string;
}

async function fetchPodsForKind(kind: WorkloadKind, name: string, namespace: string): Promise<string[]> {
    switch (kind) {
        case 'deployment':   return GetDeploymentPods(name, namespace);
        case 'statefulset':  return GetStatefulSetPods(name, namespace);
        case 'replicaset':   return GetReplicaSetPods(name, namespace);
        case 'daemonset':    return GetDaemonSetPods(name, namespace);
        case 'job':          return GetJobPods(name, namespace);
        case 'cronjob':      return GetCronJobPods(name, namespace);
        default:             return [];
    }
}

const ALL_CONTAINERS = '';

export default function LogViewerPanel({ params }: IDockviewPanelProps<LogViewerPanelParams>) {
    const { resourceKind, name, namespace } = params;

    const [pods, setPods] = useState<string[]>([]);
    const [selectedPod, setSelectedPod] = useState('');
    const [containers, setContainers] = useState<string[]>([]);
    const [selectedContainer, setSelectedContainer] = useState(ALL_CONTAINERS);
    const [logText, setLogText] = useState(' ');

    const pendingRef = useRef('');
    const sessionIdsRef = useRef<string[]>([]);
    const offHandlersRef = useRef<Array<() => void>>([]);

    // Flush accumulated log data to state every 120ms
    useEffect(() => {
        const timer = setInterval(() => {
            if (pendingRef.current) {
                setLogText(prev => prev === ' ' ? pendingRef.current : prev + pendingRef.current);
                pendingRef.current = '';
            }
        }, 120);
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
            fetchPodsForKind(resourceKind, name, namespace)
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
        GetPodContainers(selectedPod, namespace)
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
        pendingRef.current = '';
        setLogText(' ');

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

            StartLogStream(sessionId, selectedPod, namespace, container).catch((err: unknown) => {
                pendingRef.current += `[error] ${String(err)}\n`;
            });
        });

        sessionIdsRef.current = newSessionIds;
        offHandlersRef.current = newOffHandlers;

        return stopStreams;
    }, [selectedPod, selectedContainer, containers, namespace, stopStreams]);

    const containerOptions = [
        { label: 'All containers', value: ALL_CONTAINERS },
        ...containers.map(c => ({ label: c, value: c })),
    ];

    return (
        <div className="log-viewer-panel">
            <div className="log-viewer-toolbar">
                <FormatAlignLeftOutlined style={{ fontSize: '0.9rem' }} />
                <span className="log-viewer-toolbar__label">Logs</span>

                {resourceKind !== 'pod' && pods.length > 0 && (
                    <Dropdown
                        value={selectedPod}
                        options={pods}
                        onChange={e => setSelectedPod(e.value)}
                        placeholder="Select Pod"
                        className="log-viewer-dropdown"
                    />
                )}

                {containers.length > 0 && (
                    <Dropdown
                        value={selectedContainer}
                        options={containerOptions}
                        onChange={e => setSelectedContainer(e.value)}
                        placeholder="Container"
                        className="log-viewer-dropdown"
                    />
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
