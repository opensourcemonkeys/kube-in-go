import { useEffect, useMemo, useRef, useState } from 'react';

import { VscPlay, VscShield, VscLinkExternal, VscExport, VscStopCircle } from 'react-icons/vsc';

import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import { Message } from 'primereact/message';
import { TabView, TabPanel } from 'primereact/tabview';
import { InputText } from 'primereact/inputtext';
import { MultiSelect } from 'primereact/multiselect';
import { ProgressBar } from 'primereact/progressbar';
import { FilterMatchMode } from 'primereact/api';
import { BrowserOpenURL, EventsOn } from '../../../wailsjs/runtime/runtime';

import {
    TrivyListPodImages,
    TrivyScanImage,
    TrivyStartK8sScan,
    TrivyStopK8sScan,
    TrivyListPodImagesWithContext,
    SaveReport,
} from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';

// ─── Types ────────────────────────────────────────────────────────────────────

type VulnRow = {
    _uid: string;
    image: string;
    resourceKind: string;
    resourceName: string;
    resourceNs: string;
    target: string;
    vulnerabilityID: string;
    pkgName: string;
    installedVersion: string;
    fixedVersion: string;
    severity: string;
    title: string;
    description: string;
    primaryURL: string;
    references: string[];
    publishedDate: string;
};

type MisconfigRow = {
    _uid: string;
    resourceKind: string;
    resourceName: string;
    namespace: string;
    checkID: string;
    severity: string;
    title: string;
    message: string;
    description: string;
    resolution: string;
    primaryURL: string;
    references: string[];
};

type SecretRow = {
    _uid: string;
    resourceKind: string;
    resourceName: string;
    namespace: string;
    ruleID: string;
    category: string;
    severity: string;
    title: string;
    match: string;
};

// Matches models.TrivyK8sScanResult emitted via Wails event
type K8sScanResult = {
    misconfigs: Array<{
        resourceKind: string; resourceName: string; namespace: string;
        checkID: string; severity: string; title: string; message: string;
        description: string; resolution: string; primaryURL: string; references: string[]; status: string;
    }>;
    secrets: Array<{
        resourceKind: string; resourceName: string; namespace: string;
        ruleID: string; category: string; severity: string; title: string; match: string;
    }>;
    misconfigSummary: Record<string, number>;
    secretSummary: Record<string, number>;
    resourceCount: number;
    scannedAt: string;
};

type Progress = { current: number; total: number; image: string } | null;
type PushToast = (severity: 'success' | 'warn' | 'error', summary: string, detail?: string) => void;

// ─── Shared constants & helpers ───────────────────────────────────────────────

const SEVERITY_ORDER: Record<string, number> = {
    CRITICAL: 5, HIGH: 4, MEDIUM: 3, LOW: 2, UNKNOWN: 1,
};
const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'];
const SEVERITY_HEX: Record<string, string> = {
    CRITICAL: '#b3261e', HIGH: '#d9534f', MEDIUM: '#e2a85a', LOW: '#4a7bb5', UNKNOWN: '#888',
};

function severitySeverity(sev: string): 'danger' | 'warning' | 'info' | undefined {
    switch (sev) {
        case 'CRITICAL': case 'HIGH': return 'danger';
        case 'MEDIUM': return 'warning';
        case 'LOW': return 'info';
        default: return undefined;
    }
}

function vulnUrl(id: string, primaryURL: string): string {
    if (/^CVE-\d{4}-\d+$/i.test(id || '')) {
        return `https://www.cve.org/CVERecord?id=${id.toUpperCase()}`;
    }
    return primaryURL || '';
}

function rowsFromResult(imgInfo: models.TrivyK8sImageInfo, res: models.TrivyScanResult): VulnRow[] {
    const out: VulnRow[] = [];
    (res.targets || []).forEach((t) => {
        (t.vulnerabilities || []).forEach((v, i) => {
            out.push({
                _uid: `${imgInfo.image}|${t.target}|${v.vulnerabilityID}|${v.pkgName}|${i}`,
                image: imgInfo.image,
                resourceKind: imgInfo.resourceKind || '',
                resourceName: imgInfo.resourceName || '',
                resourceNs: imgInfo.namespace || '',
                target: t.target,
                vulnerabilityID: v.vulnerabilityID,
                pkgName: v.pkgName,
                installedVersion: v.installedVersion,
                fixedVersion: v.fixedVersion,
                severity: (v.severity || 'UNKNOWN').toUpperCase(),
                title: v.title,
                description: v.description || '',
                primaryURL: v.primaryURL,
                references: v.references || [],
                publishedDate: v.publishedDate || '',
            });
        });
    });
    return out;
}

const escapeHtml = (s: string) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

// ─── SeverityTag ──────────────────────────────────────────────────────────────

function SeverityTag({ sev }: { sev: string }) {
    return <Tag value={sev} severity={severitySeverity(sev)} />;
}

// ─── Finding detail modal ─────────────────────────────────────────────────────

// Trivy does not provide remediation for detected secrets, so we surface curated
// guidance keyed by the secret category (falling back to generic advice).
function secretRemediation(category: string, _ruleID: string): string {
    const c = (category || '').toLowerCase();
    const generic =
        'Treat this credential as compromised. Rotate/revoke it immediately at the provider, ' +
        'remove the literal value from the manifest, and purge it from Git history (e.g. git filter-repo / BFG). ' +
        'Store the secret in a Kubernetes Secret (or External Secrets / Sealed Secrets / a vault) and ' +
        'inject it via envFrom or a mounted volume instead of hardcoding it.';
    if (c.includes('aws'))
        return 'Rotate this AWS key in IAM (deactivate then delete the exposed access key) and audit CloudTrail for misuse. ' + generic;
    if (c.includes('gcp') || c.includes('google'))
        return 'Revoke this Google Cloud service-account key and create a new one; review IAM audit logs for misuse. ' + generic;
    if (c.includes('private') || c.includes('rsa') || c.includes('ssh'))
        return 'Consider this private key compromised: revoke/replace the key pair and rotate anything it protected. ' + generic;
    if (c.includes('token') || c.includes('jwt') || c.includes('github'))
        return 'Revoke this token at the issuing service and generate a new one with least-privilege scopes. ' + generic;
    return generic;
}

type DetailFinding = {
    kind: 'misconfig' | 'secret' | 'vuln';
    severity: string;
    title: string;
    idLabel: string; // e.g. "KSV001" | "CVE-2023-1234" | rule id
    resource: { kind: string; name: string; namespace: string };
    description: string;
    details: string;
    recommendation: string;
    references: string[];
    externalUrl: string;
};

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    if (!value) return null;
    return (
        <div className="flex flex-column gap-1">
            <span className="text-color-secondary text-xs uppercase font-semibold">{label}</span>
            <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: mono ? 'monospace' : undefined }}>{value}</span>
        </div>
    );
}

function FindingDetailDialog({ finding, onHide }: { finding: DetailFinding | null; onHide: () => void }) {
    if (!finding) return null;
    const res = finding.resource;
    const resourceLine = [res.kind, res.namespace ? `${res.namespace}/${res.name}` : res.name]
        .filter(Boolean)
        .join('  •  ');
    return (
        <Dialog
            visible={!!finding}
            onHide={onHide}
            dismissableMask
            style={{ width: 'min(960px, 94vw)' }}
            header={
                <div className="flex align-items-center gap-2 flex-wrap">
                    <SeverityTag sev={finding.severity} />
                    {finding.idLabel && <span className="font-semibold">{finding.idLabel}</span>}
                    <span className="text-color-secondary">{finding.title}</span>
                </div>
            }
        >
            <div className="flex flex-column gap-3">
                <DetailRow label="Resource" value={resourceLine} />
                <DetailRow label="Description" value={finding.description} />
                <DetailRow label="Details" value={finding.details} mono={finding.kind === 'secret'} />

                <div
                    className="flex flex-column gap-1 p-3 border-round"
                    style={{ background: 'rgba(74, 123, 181, 0.12)', border: '1px solid rgba(74, 123, 181, 0.4)' }}
                >
                    <span className="text-xs uppercase font-semibold" style={{ color: SEVERITY_HEX.LOW }}>
                        Recommendation
                    </span>
                    <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {finding.recommendation || 'No specific remediation available.'}
                    </span>
                </div>

                {finding.references.length > 0 && (
                    <div className="flex flex-column gap-1">
                        <span className="text-color-secondary text-xs uppercase font-semibold">References</span>
                        <ul className="m-0 pl-3 flex flex-column gap-1">
                            {finding.references.map((url) => (
                                <li key={url}>
                                    <a className="text-primary cursor-pointer" style={{ wordBreak: 'break-all' }} onClick={() => BrowserOpenURL(url)}>
                                        {url}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {finding.externalUrl && (
                    <div>
                        <Button
                            label="Open advisory"
                            icon={<VscLinkExternal className="mr-2" />}
                            size="small"
                            outlined
                            onClick={() => BrowserOpenURL(finding.externalUrl)}
                        />
                    </div>
                )}
            </div>
        </Dialog>
    );
}

// ─── Row → DetailFinding adapters ─────────────────────────────────────────────

function misconfigToFinding(r: MisconfigRow): DetailFinding {
    return {
        kind: 'misconfig',
        severity: r.severity,
        title: r.title,
        idLabel: r.checkID,
        resource: { kind: r.resourceKind, name: r.resourceName, namespace: r.namespace },
        description: r.description,
        details: r.message,
        recommendation: r.resolution,
        references: r.references,
        externalUrl: r.primaryURL,
    };
}

function secretToFinding(r: SecretRow): DetailFinding {
    const masked = r.match ? r.match.replace(/.(?=.{4})/g, '*') : '';
    return {
        kind: 'secret',
        severity: r.severity,
        title: r.title,
        idLabel: r.ruleID,
        resource: { kind: r.resourceKind, name: r.resourceName, namespace: r.namespace },
        description: r.category ? `Detected secret category: ${r.category}` : '',
        details: masked ? `Match: ${masked}` : '',
        recommendation: secretRemediation(r.category, r.ruleID),
        references: [],
        externalUrl: '',
    };
}

function vulnToFinding(r: VulnRow): DetailFinding {
    const recommendation = r.fixedVersion
        ? `Upgrade package "${r.pkgName}" from ${r.installedVersion || '?'} to ${r.fixedVersion} (or later).`
        : 'No fixed version is available yet. Track the advisory below and apply a fix when released, or mitigate by restricting exposure.';
    const details = [
        `Package: ${r.pkgName}`,
        `Installed: ${r.installedVersion || '—'}`,
        `Fixed: ${r.fixedVersion || '—'}`,
        r.publishedDate ? `Published: ${r.publishedDate}` : '',
    ].filter(Boolean).join('\n');
    return {
        kind: 'vuln',
        severity: r.severity,
        title: r.title,
        idLabel: r.vulnerabilityID,
        resource: { kind: r.resourceKind, name: r.resourceName, namespace: r.resourceNs },
        description: r.description,
        details,
        recommendation,
        references: r.references || [],
        externalUrl: vulnUrl(r.vulnerabilityID, r.primaryURL),
    };
}

// ─── SummaryGrid ──────────────────────────────────────────────────────────────

type SummaryCategory = { label: string; counts: Record<string, number> };

// A count cell — colored by its severity, dimmed when zero.
function SeverityCount({ sev, value }: { sev: string; value: number }) {
    const active = value > 0;
    return (
        <div
            className="flex flex-column align-items-center justify-content-center border-round py-2 px-1"
            style={{
                background: active ? `${SEVERITY_HEX[sev]}22` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${active ? `${SEVERITY_HEX[sev]}66` : 'rgba(255,255,255,0.06)'}`,
                minWidth: 0,
            }}
        >
            <span
                className="font-semibold"
                style={{ fontSize: '1.1rem', lineHeight: 1.1, color: active ? SEVERITY_HEX[sev] : 'var(--ink, #888)', opacity: active ? 1 : 0.4 }}
            >
                {value}
            </span>
            <span className="text-xs uppercase font-semibold mt-1" style={{ color: SEVERITY_HEX[sev], opacity: active ? 0.85 : 0.35 }}>
                {sev}
            </span>
        </div>
    );
}

// Aligned grid of all finding categories: one row per category, one column per
// severity (plus a Total), so the counts line up neatly instead of wrapping.
function SummaryGrid({ categories }: { categories: SummaryCategory[] }) {
    const visible = categories.filter((c) => Object.values(c.counts).reduce((a, b) => a + b, 0) > 0);
    if (visible.length === 0) return null;
    return (
        <div className="flex flex-column gap-2">
            {visible.map((cat) => {
                const total = Object.values(cat.counts).reduce((a, b) => a + b, 0);
                return (
                    <div
                        key={cat.label}
                        className="grid grid-nogutter align-items-center gap-2 p-2 border-round"
                        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                        <div className="col-12 md:col-2 flex align-items-center gap-2">
                            <span className="font-semibold text-sm">{cat.label}</span>
                            <Tag value={`${total}`} rounded />
                        </div>
                        <div className="col-12 md:col-10">
                            <div className="grid grid-nogutter" style={{ gap: 8 }}>
                                {SEVERITIES.map((s) => (
                                    <div key={s} style={{ flex: '1 1 0', minWidth: 64 }}>
                                        <SeverityCount sev={s} value={cat.counts[s] || 0} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Shared filter templates ──────────────────────────────────────────────────

const severityFilterTemplate = (options: any) => (
    <MultiSelect
        value={options.value}
        options={SEVERITIES.map((s) => ({ label: s, value: s }))}
        onChange={(e) => options.filterApplyCallback(e.value)}
        placeholder="Severity"
        className="p-column-filter"
    />
);

// ─── MisconfigTable ───────────────────────────────────────────────────────────

const defaultMisconfigFilters: DataTableFilterMeta = {
    severity: { value: null, matchMode: FilterMatchMode.IN },
    checkID: { value: null, matchMode: FilterMatchMode.CONTAINS },
    resourceKind: { value: null, matchMode: FilterMatchMode.CONTAINS },
    resourceName: { value: null, matchMode: FilterMatchMode.CONTAINS },
    namespace: { value: null, matchMode: FilterMatchMode.CONTAINS },
};

function MisconfigTable({ rows, scanning }: { rows: MisconfigRow[]; scanning: boolean }) {
    const [globalFilter, setGlobalFilter] = useState('');
    const [filters, setFilters] = useState<DataTableFilterMeta>(defaultMisconfigFilters);
    const [selected, setSelected] = useState<DetailFinding | null>(null);

    const sorted = useMemo(
        () => [...rows].sort((a, b) => (SEVERITY_ORDER[b.severity] || 0) - (SEVERITY_ORDER[a.severity] || 0)),
        [rows]
    );

    return (
        <>
        <DataTable
            value={sorted}
            dataKey="_uid"
            size="small"
            scrollable
            paginator
            rows={50}
            rowsPerPageOptions={[25, 50, 100]}
            filters={filters}
            onFilter={(e) => setFilters(e.filters)}
            globalFilter={globalFilter}
            globalFilterFields={['checkID', 'resourceKind', 'resourceName', 'namespace', 'title', 'message']}
            filterDisplay="menu"
            onRowDoubleClick={(e) => setSelected(misconfigToFinding(e.data as MisconfigRow))}
            rowClassName={() => 'cursor-pointer'}
            emptyMessage={scanning ? 'Scanning…' : 'No misconfigurations found. Run a scan.'}
            header={
                <div className="flex justify-content-end">
                    <InputText value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} placeholder="Search…" />
                </div>
            }
        >
            <Column field="severity" header="Severity" body={(r: MisconfigRow) => <SeverityTag sev={r.severity} />} sortable filter filterElement={severityFilterTemplate} showFilterMatchModes={false} style={{ width: 110 }} />
            <Column field="checkID" header="Check" sortable filter style={{ width: 100 }} />
            <Column field="resourceKind" header="Kind" sortable filter style={{ width: 120 }} />
            <Column field="resourceName" header="Resource" sortable filter />
            <Column field="namespace" header="Namespace" sortable filter style={{ width: 130 }} />
            <Column field="title" header="Title" />
            <Column field="resolution" header="Resolution" style={{ maxWidth: 300 }} />
        </DataTable>
        <FindingDetailDialog finding={selected} onHide={() => setSelected(null)} />
        </>
    );
}

// ─── SecretTable ──────────────────────────────────────────────────────────────

const defaultSecretFilters: DataTableFilterMeta = {
    severity: { value: null, matchMode: FilterMatchMode.IN },
    ruleID: { value: null, matchMode: FilterMatchMode.CONTAINS },
    resourceKind: { value: null, matchMode: FilterMatchMode.CONTAINS },
    resourceName: { value: null, matchMode: FilterMatchMode.CONTAINS },
};

function SecretTable({ rows, scanning }: { rows: SecretRow[]; scanning: boolean }) {
    const [globalFilter, setGlobalFilter] = useState('');
    const [filters, setFilters] = useState<DataTableFilterMeta>(defaultSecretFilters);
    const [selected, setSelected] = useState<DetailFinding | null>(null);

    const sorted = useMemo(
        () => [...rows].sort((a, b) => (SEVERITY_ORDER[b.severity] || 0) - (SEVERITY_ORDER[a.severity] || 0)),
        [rows]
    );

    return (
        <>
        <DataTable
            value={sorted}
            dataKey="_uid"
            size="small"
            scrollable
            paginator
            rows={50}
            rowsPerPageOptions={[25, 50, 100]}
            filters={filters}
            onFilter={(e) => setFilters(e.filters)}
            globalFilter={globalFilter}
            globalFilterFields={['ruleID', 'category', 'resourceKind', 'resourceName', 'namespace', 'title', 'match']}
            filterDisplay="menu"
            onRowDoubleClick={(e) => setSelected(secretToFinding(e.data as SecretRow))}
            rowClassName={() => 'cursor-pointer'}
            emptyMessage={scanning ? 'Scanning…' : 'No secrets found. Run a scan.'}
            header={
                <div className="flex justify-content-end">
                    <InputText value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} placeholder="Search…" />
                </div>
            }
        >
            <Column field="severity" header="Severity" body={(r: SecretRow) => <SeverityTag sev={r.severity} />} sortable filter filterElement={severityFilterTemplate} showFilterMatchModes={false} style={{ width: 110 }} />
            <Column field="ruleID" header="Rule ID" sortable filter style={{ width: 160 }} />
            <Column field="category" header="Category" sortable style={{ width: 160 }} />
            <Column field="resourceKind" header="Kind" sortable filter style={{ width: 120 }} />
            <Column field="resourceName" header="Resource" sortable filter />
            <Column field="namespace" header="Namespace" sortable style={{ width: 130 }} />
            <Column field="title" header="Title" />
            <Column field="match" header="Match" style={{ maxWidth: 220, fontFamily: 'monospace', fontSize: '0.8em' }} />
        </DataTable>
        <FindingDetailDialog finding={selected} onHide={() => setSelected(null)} />
        </>
    );
}

// ─── VulnTable ────────────────────────────────────────────────────────────────

const defaultVulnFilters: DataTableFilterMeta = {
    severity: { value: null, matchMode: FilterMatchMode.IN },
    vulnerabilityID: { value: null, matchMode: FilterMatchMode.CONTAINS },
    pkgName: { value: null, matchMode: FilterMatchMode.CONTAINS },
    image: { value: null, matchMode: FilterMatchMode.CONTAINS },
    resourceKind: { value: null, matchMode: FilterMatchMode.CONTAINS },
    resourceName: { value: null, matchMode: FilterMatchMode.CONTAINS },
};

const cveBody = (r: VulnRow) => {
    const url = vulnUrl(r.vulnerabilityID, r.primaryURL);
    return url ? (
        <a className="flex align-items-center gap-1 text-primary cursor-pointer" onClick={() => BrowserOpenURL(url)}>
            {r.vulnerabilityID} <VscLinkExternal />
        </a>
    ) : <span>{r.vulnerabilityID}</span>;
};
const fixedBody = (r: VulnRow) =>
    r.fixedVersion ? <span>{r.fixedVersion}</span> : <span className="text-color-secondary">—</span>;

function VulnTable({ rows, scanning, showImageColumn }: { rows: VulnRow[]; scanning: boolean; showImageColumn: boolean }) {
    const [globalFilter, setGlobalFilter] = useState('');
    const [filters, setFilters] = useState<DataTableFilterMeta>(defaultVulnFilters);
    const [selected, setSelected] = useState<DetailFinding | null>(null);

    const sorted = useMemo(
        () => [...rows].sort((a, b) => (SEVERITY_ORDER[b.severity] || 0) - (SEVERITY_ORDER[a.severity] || 0)),
        [rows]
    );

    return (
        <>
        <DataTable
            value={sorted}
            dataKey="_uid"
            size="small"
            scrollable
            paginator
            rows={50}
            rowsPerPageOptions={[25, 50, 100]}
            filters={filters}
            onFilter={(e) => setFilters(e.filters)}
            globalFilter={globalFilter}
            globalFilterFields={['vulnerabilityID', 'pkgName', 'image', 'title', 'resourceName']}
            filterDisplay="menu"
            onRowDoubleClick={(e) => setSelected(vulnToFinding(e.data as VulnRow))}
            rowClassName={() => 'cursor-pointer'}
            emptyMessage={scanning ? 'Scanning images…' : 'No vulnerabilities found. Run a scan.'}
            header={
                <div className="flex justify-content-end">
                    <InputText value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} placeholder="Search…" />
                </div>
            }
        >
            <Column field="severity" header="Severity" body={(r: VulnRow) => <SeverityTag sev={r.severity} />} sortable filter filterElement={severityFilterTemplate} showFilterMatchModes={false} style={{ width: 110 }} />
            <Column field="vulnerabilityID" header="Vulnerability" body={cveBody} sortable filter style={{ width: 170 }} />
            <Column field="pkgName" header="Package" sortable filter />
            <Column field="installedVersion" header="Installed" style={{ width: 110 }} />
            <Column field="fixedVersion" header="Fixed" body={fixedBody} style={{ width: 110 }} />
            {showImageColumn && <Column field="image" header="Image" sortable filter style={{ maxWidth: 280 }} />}
            <Column field="resourceKind" header="Kind" sortable filter style={{ width: 110 }} />
            <Column field="resourceName" header="Resource" sortable filter />
            <Column field="title" header="Title" />
        </DataTable>
        <FindingDetailDialog finding={selected} onHide={() => setSelected(null)} />
        </>
    );
}

// ─── useK8sScan hook ──────────────────────────────────────────────────────────

function useK8sScan(clusterName: string, pushToast: PushToast) {
    const [misconfigRows, setMisconfigRows] = useState<MisconfigRow[]>([]);
    const [secretRows, setSecretRows] = useState<SecretRow[]>([]);
    const [vulnRows, setVulnRows] = useState<VulnRow[]>([]);
    const [misconfigSummary, setMisconfigSummary] = useState<Record<string, number>>({});
    const [secretSummary, setSecretSummary] = useState<Record<string, number>>({});
    const [vulnSummary, setVulnSummary] = useState<Record<string, number>>({});
    const [scanning, setScanning] = useState(false);
    const [log, setLog] = useState('');
    const [vulnProgress, setVulnProgress] = useState<Progress>(null);
    const [error, setError] = useState('');

    // Stable scanId for the lifetime of this hook instance (one panel = one session)
    const scanId = useMemo(() => Math.random().toString(36).slice(2), []);

    // Wire Wails event listeners once on mount
    useEffect(() => {
        const offProgress = EventsOn(`trivy:k8s:progress:${scanId}`, (p: { phase: string; current: number; total: number; message: string }) => {
            setLog(`[${p.phase}] ${p.message} (${p.current}/${p.total})`);
        });

        const offDone = EventsOn(`trivy:k8s:done:${scanId}`, (result: K8sScanResult) => {
            const mc: MisconfigRow[] = (result.misconfigs || []).map((m, i) => ({
                _uid: `mc|${m.resourceKind}|${m.resourceName}|${m.namespace}|${m.checkID}|${i}`,
                resourceKind: m.resourceKind,
                resourceName: m.resourceName,
                namespace: m.namespace,
                checkID: m.checkID,
                severity: (m.severity || 'UNKNOWN').toUpperCase(),
                title: m.title,
                message: m.message,
                description: m.description || '',
                resolution: m.resolution,
                primaryURL: m.primaryURL || '',
                references: m.references || [],
            }));
            const sc: SecretRow[] = (result.secrets || []).map((s, i) => ({
                _uid: `sec|${s.resourceKind}|${s.resourceName}|${s.namespace}|${s.ruleID}|${i}`,
                resourceKind: s.resourceKind,
                resourceName: s.resourceName,
                namespace: s.namespace,
                ruleID: s.ruleID,
                category: s.category,
                severity: (s.severity || 'UNKNOWN').toUpperCase(),
                title: s.title,
                match: s.match,
            }));
            setMisconfigRows(mc);
            setSecretRows(sc);
            setMisconfigSummary(result.misconfigSummary || {});
            setSecretSummary(result.secretSummary || {});
        });

        const offError = EventsOn(`trivy:k8s:error:${scanId}`, (err: string) => {
            setError(err);
            pushToast('error', 'K8s scan failed', err);
        });

        return () => { offProgress(); offDone(); offError(); };
    }, [scanId]);

    const startScan = async (namespace: string) => {
        setScanning(true);
        setError('');
        setMisconfigRows([]);
        setSecretRows([]);
        setVulnRows([]);
        setMisconfigSummary({});
        setSecretSummary({});
        setVulnSummary({});
        setVulnProgress(null);

        try {
            // Phase 1: misconfig + secret (async via events; runs concurrently with phase 2)
            setLog('[fetch] Starting K8s resource scan…');
            TrivyStartK8sScan(scanId, clusterName, namespace).catch((e: any) => {
                setError(String(e));
                pushToast('error', 'K8s scan failed', String(e));
            });

            // Phase 2: vulnerability (sequential image scanning)
            setLog('[vuln] Listing pod images…');
            let images: models.TrivyK8sImageInfo[] = [];
            try {
                images = await TrivyListPodImagesWithContext(clusterName, namespace);
            } catch (e: any) {
                pushToast('warn', 'Could not list images', String(e));
            }

            if (images.length > 0) {
                const acc: VulnRow[] = [];
                const summ: Record<string, number> = {};
                for (let i = 0; i < images.length; i++) {
                    const imgInfo = images[i];
                    setVulnProgress({ current: i + 1, total: images.length, image: imgInfo.image });
                    setLog(`[vuln] [${i + 1}/${images.length}] scanning ${imgInfo.image}${i === 0 ? '  ·  (first run may download vuln DB)' : '…'}`);
                    try {
                        const res = await TrivyScanImage(clusterName, imgInfo.image);
                        if (res.error) {
                            pushToast('warn', `Scan issue: ${imgInfo.image}`, res.error);
                        } else {
                            const found = rowsFromResult(imgInfo, res);
                            acc.push(...found);
                            for (const r of found) summ[r.severity] = (summ[r.severity] || 0) + 1;
                            setVulnRows([...acc]);
                            setVulnSummary({ ...summ });
                        }
                    } catch (e: any) {
                        pushToast('error', `Failed to scan ${imgInfo.image}`, String(e));
                    }
                }
                setLog(`[vuln] ✓ done — ${acc.length} finding(s) across ${images.length} image(s)`);
            } else {
                setLog('[vuln] No images found to scan.');
            }
        } finally {
            setScanning(false);
            setVulnProgress(null);
        }
    };

    const stopScan = () => {
        TrivyStopK8sScan(scanId).catch(() => {});
        setScanning(false);
        setVulnProgress(null);
        setLog('Scan cancelled.');
    };

    return {
        misconfigRows, secretRows, vulnRows,
        misconfigSummary, secretSummary, vulnSummary,
        scanning, log, vulnProgress, error,
        startScan, stopScan,
    };
}

// ─── useImageScanner (for standalone Image Scan tab) ──────────────────────────

function useImageScanner(clusterName: string, pushToast: PushToast) {
    const [rows, setRows] = useState<VulnRow[]>([]);
    const [scanning, setScanning] = useState(false);
    const [progress, setProgress] = useState<Progress>(null);
    const [log, setLog] = useState('');
    const [error, setError] = useState('');

    const scanImages = async (images: string[]) => {
        if (images.length === 0) { setError('No images found.'); return; }
        setError('');
        setRows([]);
        setScanning(true);
        setLog(`$ trivy scan — ${images.length} image(s) queued`);
        const acc: VulnRow[] = [];
        try {
            for (let i = 0; i < images.length; i++) {
                const image = images[i];
                setProgress({ current: i + 1, total: images.length, image });
                setLog(`[${i + 1}/${images.length}] scanning ${image}${i === 0 ? '  ·  first run: downloading vulnerability DB…' : '…'}`);
                try {
                    const res = await TrivyScanImage(clusterName, image);
                    if (res.error) {
                        pushToast('warn', `Scan issue: ${image}`, res.error);
                    } else {
                        // plain image scan — no resource context
                        const fakeInfo: models.TrivyK8sImageInfo = { image, resourceKind: '', resourceName: '', namespace: '' };
                        const found = rowsFromResult(fakeInfo, res);
                        acc.push(...found);
                        setRows([...acc]);
                    }
                } catch (e: any) {
                    pushToast('error', `Failed to scan ${image}`, String(e));
                }
            }
            setLog(`✓ done — ${acc.length} finding(s) across ${images.length} image(s)`);
            if (acc.length === 0) pushToast('success', 'No vulnerabilities found');
        } finally {
            setScanning(false);
            setProgress(null);
        }
    };

    return { rows, scanning, progress, log, error, setError, scanImages };
}

// ─── K8s Security Scan Tab ────────────────────────────────────────────────────

function K8sSecurityTab({
    scan,
}: {
    scan: ReturnType<typeof useK8sScan>;
}) {
    const {
        misconfigRows, secretRows, vulnRows,
        misconfigSummary, secretSummary, vulnSummary,
        scanning, log, vulnProgress, error,
        startScan, stopScan,
    } = scan;

    const totalFindings = misconfigRows.length + secretRows.length + vulnRows.length;

    return (
        <div className="flex flex-column gap-3">
            {/* Controls — always scans the whole cluster (all namespaces) */}
            <div className="flex flex-wrap align-items-center gap-2">
                {!scanning ? (
                    <Button label="Scan cluster" icon={<VscPlay />} onClick={() => startScan('')} />
                ) : (
                    <Button label="Stop" icon={<VscStopCircle />} severity="danger" outlined onClick={stopScan} />
                )}
                <span className="text-color-secondary text-sm">
                    Scans all namespaces for misconfigurations, hardcoded secrets and image vulnerabilities.
                </span>
            </div>

            {/* Progress */}
            {log && (
                <div className="flex flex-column gap-1">
                    <div className="trivy-console">
                        <span className="trivy-console__prompt">›</span>
                        <span className="trivy-console__text">{log}</span>
                        {scanning && <span className="trivy-console__caret" />}
                    </div>
                    {vulnProgress && (
                        <ProgressBar value={Math.round((vulnProgress.current / vulnProgress.total) * 100)} showValue={false} style={{ height: 6 }} />
                    )}
                </div>
            )}

            {error && <Message severity="error" text={error} />}

            {/* Summary */}
            {totalFindings > 0 && (
                <SummaryGrid
                    categories={[
                        { label: 'Misconfigs', counts: misconfigSummary },
                        { label: 'Vulnerabilities', counts: vulnSummary },
                        { label: 'Secrets', counts: secretSummary },
                    ]}
                />
            )}

            {/* Results sub-tabs */}
            <TabView>
                <TabPanel header={`Misconfigs${misconfigRows.length ? ` (${misconfigRows.length})` : ''}`}>
                    <MisconfigTable rows={misconfigRows} scanning={scanning} />
                </TabPanel>
                <TabPanel header={`Vulnerabilities${vulnRows.length ? ` (${vulnRows.length})` : ''}`}>
                    <VulnTable rows={vulnRows} scanning={scanning} showImageColumn />
                </TabPanel>
                <TabPanel header={`Secrets${secretRows.length ? ` (${secretRows.length})` : ''}`}>
                    <SecretTable rows={secretRows} scanning={scanning} />
                </TabPanel>
            </TabView>
        </div>
    );
}

// ─── Image Scan Tab (standalone image scan, unchanged logic) ──────────────────

function ImageScanTab({
    clusterName,
    scanner,
    imageInput,
    setImageInput,
    pushToast,
}: {
    clusterName: string;
    scanner: ReturnType<typeof useImageScanner>;
    imageInput: string;
    setImageInput: (v: string) => void;
    pushToast: PushToast;
}) {
    const run = () => {
        const ref = imageInput.trim();
        if (!ref) { pushToast('warn', 'Enter an image', 'e.g. nginx:1.25 or registry/repo:tag'); return; }
        scanner.scanImages([ref]);
    };

    const exportHtml = async () => {
        const counts: Record<string, number> = {};
        for (const r of scanner.rows) counts[r.severity] = (counts[r.severity] || 0) + 1;
        const sorted = [...scanner.rows].sort((a, b) => (SEVERITY_ORDER[b.severity] || 0) - (SEVERITY_ORDER[a.severity] || 0));
        const body = sorted.map((r) => {
            const url = vulnUrl(r.vulnerabilityID, r.primaryURL);
            const id = url ? `<a href="${escapeHtml(url)}">${escapeHtml(r.vulnerabilityID)}</a>` : escapeHtml(r.vulnerabilityID);
            return `<tr><td>${escapeHtml(r.severity)}</td><td>${id}</td><td>${escapeHtml(r.pkgName)}</td><td>${escapeHtml(r.installedVersion)}</td><td>${escapeHtml(r.fixedVersion) || '—'}</td><td>${escapeHtml(r.title)}</td></tr>`;
        }).join('\n');
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Vuln report</title></head><body><table><thead><tr><th>Severity</th><th>CVE</th><th>Package</th><th>Installed</th><th>Fixed</th><th>Title</th></tr></thead><tbody>${body}</tbody></table></body></html>`;
        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        try { await SaveReport(`vuln-report-image-${clusterName}-${stamp}.html`, html); } catch { /* ignore */ }
    };

    const summary = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const r of scanner.rows) counts[r.severity] = (counts[r.severity] || 0) + 1;
        return counts;
    }, [scanner.rows]);

    return (
        <div className="flex flex-column gap-3">
            <Message severity="info" text="The first scan downloads the Trivy vulnerability database and may take a few minutes." />
            {scanner.error && <Message severity="error" text={scanner.error} />}

            <div className="flex flex-wrap align-items-center gap-2">
                <InputText
                    value={imageInput}
                    onChange={(e) => setImageInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && run()}
                    placeholder="nginx:1.25"
                    disabled={scanner.scanning}
                    style={{ minWidth: 280 }}
                />
                <Button label="Scan image" icon={<VscPlay />} onClick={run} loading={scanner.scanning} />
            </div>

            {scanner.scanning && scanner.progress && (
                <div className="flex flex-column gap-1">
                    <div className="trivy-console">
                        <span className="trivy-console__prompt">›</span>
                        <span className="trivy-console__text">{scanner.log}</span>
                        <span className="trivy-console__caret" />
                    </div>
                    <ProgressBar value={Math.round((scanner.progress.current / scanner.progress.total) * 100)} showValue={false} style={{ height: 6 }} />
                </div>
            )}

            {scanner.rows.length > 0 && (
                <div className="flex flex-wrap gap-2 align-items-center">
                    {SEVERITIES.map((s) => summary[s] ? <Tag key={s} value={`${s}: ${summary[s]}`} severity={severitySeverity(s)} /> : null)}
                    <Tag value={`Total: ${scanner.rows.length}`} />
                </div>
            )}

            <div className="flex justify-content-end">
                <Button
                    label="Export HTML"
                    icon={<VscExport />}
                    outlined
                    size="small"
                    disabled={scanner.rows.length === 0}
                    onClick={exportHtml}
                />
            </div>

            <VulnTable rows={scanner.rows} scanning={scanner.scanning} showImageColumn={false} />
        </div>
    );
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function TrivyScanner({ clusterName }: { clusterName: string }) {
    const toast = useRef<Toast | null>(null);
    const pushToast: PushToast = (severity, summary, detail) =>
        toast.current?.show({ severity, summary, detail, life: 4000 });

    // Scan state is lifted here so it survives switching between the top-level
    // tabs — PrimeReact's TabView unmounts the inactive panel, which would
    // otherwise destroy the hook, stop the running scan and clear the tables.
    const [imageInput, setImageInput] = useState('');
    const k8sScan = useK8sScan(clusterName, pushToast);
    const imageScanner = useImageScanner(clusterName, pushToast);

    return (
        <div className="flex flex-column h-full p-3 gap-3" style={{ overflow: 'auto' }}>
            <Toast ref={toast} />

            <div className="flex align-items-center gap-2">
                <VscShield size={18} />
                <span className="font-semibold">Security Scan</span>
                <span className="text-color-secondary text-sm">• {clusterName}</span>
            </div>

            <TabView>
                <TabPanel header="K8s Security">
                    <K8sSecurityTab scan={k8sScan} />
                </TabPanel>
                <TabPanel header="Image Scan">
                    <ImageScanTab
                        clusterName={clusterName}
                        scanner={imageScanner}
                        imageInput={imageInput}
                        setImageInput={setImageInput}
                        pushToast={pushToast}
                    />
                </TabPanel>
            </TabView>
        </div>
    );
}
