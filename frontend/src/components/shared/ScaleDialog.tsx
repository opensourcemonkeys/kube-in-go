import { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputNumber } from 'primereact/inputnumber';
import { Slider } from 'primereact/slider';
import { VscClose, VscCheck } from 'react-icons/vsc';
import { ScaleWorkload, GetWorkloadAutoscaler } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';
import { errText } from '../../lib/errText';

/**
 * Replica-count dialog for Deployments, StatefulSets and ReplicaSets.
 *
 * The current count comes from the list row, which already carries `replicas`
 * — no extra API call to open the dialog.
 */
export default function ScaleDialog({
    visible,
    clusterName,
    kind,
    name,
    namespace,
    currentReplicas,
    onHide,
    onDone,
}: {
    visible: boolean;
    clusterName: string;
    /** Singular lowercase kind, matching the backend's vocabulary. */
    kind: 'deployment' | 'statefulset' | 'replicaset';
    name: string;
    namespace: string;
    currentReplicas: number;
    onHide: () => void;
    onDone: (replicas: number) => void;
}) {
    const [replicas, setReplicas] = useState<number>(currentReplicas);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hpa, setHpa] = useState<models.HPAInfo | null>(null);

    // Replica counts have no natural upper bound, but a slider needs one. The
    // ceiling is therefore *latched state*, not a derived value: it is seeded
    // from the current count when the dialog opens and only ever grows (when an
    // HPA reveals a higher max, or when the user types past it). Deriving it
    // from `replicas` instead would make it shrink while dragging the handle
    // left, and the handle would jump back to the far right under the cursor.
    const [sliderMax, setSliderMax] = useState(10);

    // Reset to the row's live value every time the dialog opens: the same
    // component instance is reused across openings, so stale state from the
    // previous target would otherwise be pre-filled.
    useEffect(() => {
        if (!visible) return;
        setReplicas(currentReplicas);
        setError(null);
        setHpa(null);
        setSliderMax(Math.max(10, currentReplicas * 2));
    }, [visible, currentReplicas]);

    useEffect(() => {
        if (hpa) setSliderMax((max) => Math.max(max, hpa.max_replicas));
    }, [hpa]);

    // Keeps the handle reachable when a value above the ceiling is typed in.
    const setReplicaCount = (value: number) => {
        setReplicas(value);
        setSliderMax((max) => Math.max(max, value));
    };

    // The backend returns null both when no HPA targets this workload and when
    // it could not find out (no RBAC verb, or a pre-1.23 cluster). Both mean
    // "no warning to show" — never a reason to block the scale.
    useEffect(() => {
        if (!visible) return;
        let cancelled = false;
        GetWorkloadAutoscaler(clusterName, kind, name, namespace)
            .then((found) => {
                if (!cancelled) setHpa(found ?? null);
            })
            .catch(() => {
                if (!cancelled) setHpa(null);
            });
        return () => {
            cancelled = true;
        };
    }, [visible, clusterName, kind, name, namespace]);

    const close = () => {
        if (busy) return;
        onHide();
    };

    const submit = async () => {
        setBusy(true);
        setError(null);
        try {
            await ScaleWorkload(clusterName, kind, name, namespace, replicas);
            onDone(replicas);
            onHide();
        } catch (e) {
            setError(errText(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog
            header={`Scale ${kind}`}
            visible={visible}
            style={{ width: '28rem' }}
            modal
            onHide={close}
            footer={
                <div className="flex justify-content-end gap-2">
                    <Button label="Cancel" icon={<VscClose size={16} />} text onClick={close} disabled={busy} />
                    <Button
                        label="Scale"
                        icon={<VscCheck size={16} />}
                        onClick={submit}
                        loading={busy}
                        disabled={replicas == null || replicas < 0}
                    />
                </div>
            }
        >
            <div className="flex flex-column gap-3">
                <span style={{ fontSize: '0.85rem', color: 'var(--ink2)', wordBreak: 'break-all' }}>
                    {namespace}/{name}
                </span>

                {/* Slider for the common case (a handful of replicas), number
                    input for exact or large values the slider cannot reach. */}
                <div className="flex flex-column gap-2">
                    <label htmlFor="scale-replicas" style={{ fontSize: '0.8rem', color: 'var(--ink2)' }}>
                        Replicas <span style={{ opacity: 0.7 }}>(currently {currentReplicas})</span>
                    </label>
                    <div className="flex align-items-center gap-3">
                        <Slider
                            value={replicas}
                            min={0}
                            max={sliderMax}
                            onChange={(e) => setReplicaCount(typeof e.value === 'number' ? e.value : e.value[0])}
                            style={{ flex: 1 }}
                            aria-label="Replicas"
                        />
                        <InputNumber
                            inputId="scale-replicas"
                            value={replicas}
                            min={0}
                            autoFocus
                            inputStyle={{ width: '4rem', textAlign: 'center' }}
                            onValueChange={(e) => setReplicaCount(e.value ?? 0)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !busy) submit();
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--ink3)' }}>
                        <span>0</span>
                        <span>{sliderMax}</span>
                    </div>
                </div>

                {hpa && (
                    <span style={{ color: 'var(--amber)', fontSize: '0.8rem' }}>
                        Managed by HorizontalPodAutoscaler &quot;{hpa.name}&quot; (min {hpa.min_replicas}, max{' '}
                        {hpa.max_replicas}) — a manual change will be reverted within seconds.
                    </span>
                )}

                {replicas === 0 && (
                    <span style={{ color: 'var(--amber)', fontSize: '0.8rem' }}>
                        0 replicas stops all pods for this workload.
                    </span>
                )}

                {error && (
                    <span style={{ color: 'var(--red)', fontSize: '0.8rem', wordBreak: 'break-word' }}>{error}</span>
                )}
            </div>
        </Dialog>
    );
}
