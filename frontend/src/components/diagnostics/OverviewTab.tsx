import { useCallback, useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { models } from '../../../wailsjs/go/models';
import { GetDiagnostics, RunHealthChecks } from '../../../wailsjs/go/controller_app/App';
import { useAiChatStore } from '../../stores/aiChatStore';
import HealthCheckList from './HealthCheckList';

function Row({ label, value }: { label: string; value: string | number | undefined }) {
    if (value === undefined || value === '' || value === null) return null;
    return (
        <div className="diag-row">
            <span className="diag-row__label">{label}</span>
            <span className="diag-row__value">{value}</span>
        </div>
    );
}

/**
 * Environment facts plus the on-demand preflight.
 *
 * The checks do not auto-refresh: they reach every configured cluster and the
 * update manifest, so running them on a timer would turn a diagnostics tab into
 * a background load generator.
 */
export default function OverviewTab({
    report,
    onReport,
}: {
    report: models.DiagnosticsReport | null;
    onReport: (r: models.DiagnosticsReport) => void;
}) {
    const [checks, setChecks] = useState<models.HealthCheck[]>([]);
    const [running, setRunning] = useState(false);
    const ollamaHost = useAiChatStore((s) => s.host);

    const refresh = useCallback(() => {
        GetDiagnostics().then(onReport).catch(() => { /* panel still renders */ });
    }, [onReport]);

    const runChecks = useCallback(() => {
        setRunning(true);
        RunHealthChecks(ollamaHost)
            .then(setChecks)
            .catch(() => setChecks([]))
            .finally(() => setRunning(false));
    }, [ollamaHost]);

    useEffect(() => {
        refresh();
        runChecks();
        // Deliberately once per mount: see the note above about load.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="diag-tab">
            <section className="diag-section">
                <h3 className="diag-section__title">Environment</h3>
                <Row label="Version" value={report?.appVersion} />
                <Row label="Commit" value={report?.commit} />
                <Row label="Built" value={report?.buildDate} />
                <Row label="Go" value={report?.goVersion} />
                <Row
                    label="Platform"
                    value={report ? `${report.goos}/${report.goarch}` : undefined}
                />
                <Row label="OS" value={report?.osRelease} />
                <Row label="Shell" value={report?.shell} />
                <Row label="Instance hub" value={report?.hub?.role} />
                <Row label="This instance" value={report?.hub?.instanceName} />
                <Row label="Instances" value={report?.hub?.instanceCount} />
            </section>

            <section className="diag-section">
                <h3 className="diag-section__title">Configuration</h3>
                <Row label="Clusters" value={`${report?.clusterCount ?? 0} (names redacted)`} />
                <Row label="Active cluster" value={report?.activeCluster || '—'} />
                <Row label="Log directory" value={report?.logDir} />
                <Row label="Log level" value={report?.logLevel} />
            </section>

            <section className="diag-section">
                <div className="diag-section__head">
                    <h3 className="diag-section__title">Health checks</h3>
                    <Button
                        label={running ? 'Running…' : 'Re-run checks'}
                        icon="pi pi-refresh"
                        size="small"
                        outlined
                        disabled={running}
                        onClick={() => {
                            refresh();
                            runChecks();
                        }}
                    />
                </div>
                <HealthCheckList checks={checks} running={running} />
            </section>
        </div>
    );
}
