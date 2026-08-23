import { useState } from 'react';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { VscArrowBoth, VscDebugRestart, VscDebugPause, VscDebugStart } from 'react-icons/vsc';
import { RestartWorkload, SetCronJobSuspend } from '../../../wailsjs/go/controller_app/App';
import ScaleDialog from './ScaleDialog';
import ConfirmActionDialog from './ConfirmActionDialog';
import { Trans } from 'react-i18next';
import { useT } from '../../i18n/useT';

export type ScalableKind = 'deployment' | 'statefulset' | 'replicaset';
export type RestartableKind = 'deployment' | 'statefulset' | 'daemonset';

/**
 * Per-row mutating actions for workload lists (scale / rollout restart / cronjob
 * suspend). It owns both the buttons and their dialogs so each view adds one
 * element to its action column instead of repeating the whole block.
 *
 * `clusterName`, `reload` and `toastRef` must be explicit props: DataTable body
 * renderers are declared at module scope and cannot close over the list
 * component's values.
 *
 * Which buttons appear is decided by the caller, because the capability matrix
 * is not uniform — ReplicaSets have no rollout, DaemonSets have no replica
 * count, CronJobs have neither. The backend independently rejects unsupported
 * (kind, action) pairs; this only keeps dead buttons off the screen.
 */
export default function WorkloadActions({
    clusterName,
    name,
    namespace,
    reload,
    toastRef,
    scale,
    restart,
    suspend,
}: {
    clusterName: string;
    name: string;
    namespace: string;
    reload: () => Promise<void>;
    toastRef: React.RefObject<Toast>;
    /** Enables the Scale button for a scalable kind, seeded with its current replica count. */
    scale?: { kind: ScalableKind; replicas: number };
    /** Enables the Restart button for a kind that has a rollout. */
    restart?: { kind: RestartableKind };
    /** Enables the Pause/Resume toggle for CronJobs. `suspended` picks which way it goes. */
    suspend?: { suspended: boolean };
}) {
    const t = useT();
    const [scaleOpen, setScaleOpen] = useState(false);
    const [restartOpen, setRestartOpen] = useState(false);
    const [suspendOpen, setSuspendOpen] = useState(false);

    const notify = (detail: string) =>
        toastRef.current?.show({ severity: 'success', summary: t('panels:workload.doneSummary'), detail, life: 3000 });

    const target = `${namespace}/${name}`;

    return (
        <>
            {scale && (
                <Button
                    icon={<VscArrowBoth size={16} />}
                    text
                    size="small"
                    severity="secondary"
                    style={{ padding: '0.2rem', fontSize: '0.7rem' }}
                    tooltip={t('panels:workload.scale')}
                    tooltipOptions={{ position: 'top' }}
                    aria-label={t('panels:workload.scale')}
                    onClick={(e) => {
                        e.stopPropagation();
                        setScaleOpen(true);
                    }}
                />
            )}
            {restart && (
                <Button
                    icon={<VscDebugRestart size={16} />}
                    text
                    size="small"
                    severity="secondary"
                    style={{ padding: '0.2rem', fontSize: '0.7rem' }}
                    tooltip={t('panels:workload.restart')}
                    tooltipOptions={{ position: 'top' }}
                    aria-label={t('panels:workload.restart')}
                    onClick={(e) => {
                        e.stopPropagation();
                        setRestartOpen(true);
                    }}
                />
            )}
            {suspend && (
                <Button
                    icon={suspend.suspended ? <VscDebugStart size={16} /> : <VscDebugPause size={16} />}
                    text
                    size="small"
                    severity="secondary"
                    style={{ padding: '0.2rem', fontSize: '0.7rem' }}
                    tooltip={t(suspend.suspended ? 'panels:workload.resume' : 'panels:workload.suspend')}
                    tooltipOptions={{ position: 'top' }}
                    aria-label={t(suspend.suspended ? 'panels:workload.resume' : 'panels:workload.suspend')}
                    onClick={(e) => {
                        e.stopPropagation();
                        setSuspendOpen(true);
                    }}
                />
            )}

            {scale && (
                <ScaleDialog
                    visible={scaleOpen}
                    clusterName={clusterName}
                    kind={scale.kind}
                    name={name}
                    namespace={namespace}
                    currentReplicas={scale.replicas}
                    onHide={() => setScaleOpen(false)}
                    onDone={async (replicas) => {
                        notify(t('panels:workload.scaled', { target, replicas }));
                        await reload();
                    }}
                />
            )}

            {restart && (
                <ConfirmActionDialog
                    visible={restartOpen}
                    header={t('panels:workload.restartHeader')}
                    message={
                        <Trans
                            t={t}
                            i18nKey="panels:workload.restartMessage"
                            values={{ target }}
                            components={{ 1: <strong /> }}
                        />
                    }
                    warning={t('panels:workload.restartWarning')}
                    confirmLabel={t('panels:workload.restartConfirm')}
                    onHide={() => setRestartOpen(false)}
                    onConfirm={async () => {
                        await RestartWorkload(clusterName, restart.kind, name, namespace);
                        notify(t('panels:workload.restarted', { target }));
                        await reload();
                    }}
                />
            )}

            {suspend && (
                <ConfirmActionDialog
                    visible={suspendOpen}
                    header={t(suspend.suspended ? 'panels:workload.resumeHeader' : 'panels:workload.suspendHeader')}
                    message={
                        <Trans
                            t={t}
                            i18nKey={suspend.suspended ? 'panels:workload.resumeMessage' : 'panels:workload.suspendMessage'}
                            values={{ target }}
                            components={{ 1: <strong /> }}
                        />
                    }
                    warning={suspend.suspended ? undefined : t('panels:workload.suspendWarning')}
                    confirmLabel={t(suspend.suspended ? 'panels:workload.resume' : 'panels:workload.suspend')}
                    onHide={() => setSuspendOpen(false)}
                    onConfirm={async () => {
                        await SetCronJobSuspend(clusterName, name, namespace, !suspend.suspended);
                        notify(t(suspend.suspended ? 'panels:workload.resumed' : 'panels:workload.suspended', { target }));
                        await reload();
                    }}
                />
            )}
        </>
    );
}
