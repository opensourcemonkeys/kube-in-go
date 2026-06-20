import { useEffect, useMemo, useRef, useState } from 'react';

import { VscPlay, VscShield, VscRefresh, VscLinkExternal, VscExport } from 'react-icons/vsc';

import { DataTable, DataTableFilterMeta } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Tag } from 'primereact/tag';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { Message } from 'primereact/message';
import { TabView, TabPanel } from 'primereact/tabview';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { MultiSelect } from 'primereact/multiselect';
import { ProgressBar } from 'primereact/progressbar';
import { FilterMatchMode } from 'primereact/api';
import { BrowserOpenURL } from '../../../wailsjs/runtime/runtime';

import { GetNamespaces, TrivyListPodImages, TrivyScanImage, SaveReport } from '../../../wailsjs/go/controller_app/App';
import { models } from '../../../wailsjs/go/models';

type VulnRow = {
    _uid: string;
    image: string;
    target: string;
    vulnerabilityID: string;
    pkgName: string;
    installedVersion: string;
    fixedVersion: string;
    severity: string;
    title: string;
    primaryURL: string;
};

type Progress = { current: number; total: number; image: string } | null;
type PushToast = (severity: 'success' | 'warn' | 'error', summary: string, detail?: string) => void;

const SEVERITY_ORDER: Record<string, number> = {
    CRITICAL: 5, HIGH: 4, MEDIUM: 3, LOW: 2, UNKNOWN: 1,
};
const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'];

const DB_INFO = 'The first scan downloads the Trivy vulnerability database and may take a few minutes.';

function severitySeverity(sev: string): 'danger' | 'warning' | 'info' | undefined {
    switch (sev) {
        case 'CRITICAL':
        case 'HIGH':
            return 'danger';
        case 'MEDIUM':
            return 'warning';
        case 'LOW':
            return 'info';
        default:
            return undefined;
    }
}

// Trivy's PrimaryURL for CVEs (e.g. https://avd.aquasec.com/nvd/cve-2022-32221)
// is a redirect stub that 404s in a browser. Link to the official CVE.org
// record instead. Non-CVE IDs (GHSA, etc.) keep their PrimaryURL, which points
// at a valid advisory.
function vulnUrl(id: string, primaryURL: string): string {
    if (/^CVE-\d{4}-\d+$/i.test(id || '')) {
        return `https://www.cve.org/CVERecord?id=${id.toUpperCase()}`;
    }
    return primaryURL || '';
}

function rowsFromResult(image: string, res: models.TrivyScanResult): VulnRow[] {
    const out: VulnRow[] = [];
    (res.targets || []).forEach((t) => {
        (t.vulnerabilities || []).forEach((v, i) => {
            out.push({
                _uid: `${image}|${t.target}|${v.vulnerabilityID}|${v.pkgName}|${i}`,
                image,
                target: t.target,
                vulnerabilityID: v.vulnerabilityID,
                pkgName: v.pkgName,
                installedVersion: v.installedVersion,
                fixedVersion: v.fixedVersion,
                severity: (v.severity || 'UNKNOWN').toUpperCase(),
                title: v.title,
                primaryURL: v.primaryURL,
            });
        });
    });
    return out;
}

const SEVERITY_HEX: Record<string, string> = {
    CRITICAL: '#b3261e', HIGH: '#d9534f', MEDIUM: '#e2a85a', LOW: '#4a7bb5', UNKNOWN: '#888',
};

const escapeHtml = (s: string) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

// Build a standalone, printable HTML vulnerability report from the findings.
function buildHtmlReport(scope: string, clusterName: string, rows: VulnRow[]): string {
    const sorted = [...rows].sort((a, b) => (SEVERITY_ORDER[b.severity] || 0) - (SEVERITY_ORDER[a.severity] || 0));
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.severity] = (counts[r.severity] || 0) + 1;
    const generated = new Date().toLocaleString();

    const summary = SEVERITIES.filter((s) => counts[s])
        .map((s) => `<span class="badge" style="background:${SEVERITY_HEX[s]}">${s}: ${counts[s]}</span>`)
        .join(' ') || '<span class="muted">No vulnerabilities found.</span>';

    const body = sorted.map((r) => {
        const url = vulnUrl(r.vulnerabilityID, r.primaryURL);
        const id = url
            ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(r.vulnerabilityID)}</a>`
            : escapeHtml(r.vulnerabilityID);
        return `<tr>
      <td><span class="sev" style="background:${SEVERITY_HEX[r.severity] || '#888'}">${escapeHtml(r.severity)}</span></td>
      <td>${id}</td>
      <td>${escapeHtml(r.image)}</td>
      <td>${escapeHtml(r.pkgName)}</td>
      <td>${escapeHtml(r.installedVersion)}</td>
      <td>${escapeHtml(r.fixedVersion) || '—'}</td>
      <td>${escapeHtml(r.title)}</td>
    </tr>`;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>Vulnerability report — ${escapeHtml(scope)} — ${escapeHtml(clusterName)}</title>
<style>
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 2rem; color: #1a1a1a; }
  h1 { font-size: 1.5rem; margin: 0 0 .25rem; }
  .meta { color: #666; margin: 0 0 1rem; font-size: .9rem; }
  .summary { margin: 0 0 1.25rem; display: flex; flex-wrap: wrap; gap: .4rem; }
  .badge, .sev { color: #fff; border-radius: 4px; padding: 2px 8px; font-size: .8rem; font-weight: 600; white-space: nowrap; }
  .sev { font-size: .72rem; }
  table { border-collapse: collapse; width: 100%; font-size: .85rem; }
  th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #e3e3e3; vertical-align: top; }
  th { background: #f4f4f5; position: sticky; top: 0; }
  tr:hover td { background: #fafafa; }
  a { color: #0b6bcb; }
  .muted { color: #888; }
</style></head>
<body>
  <h1>Vulnerability report — ${escapeHtml(scope)}</h1>
  <p class="meta">Cluster: <b>${escapeHtml(clusterName)}</b> · Generated ${escapeHtml(generated)} · ${rows.length} finding(s)</p>
  <div class="summary">${summary}</div>
  <table>
    <thead><tr><th>Severity</th><th>Vulnerability</th><th>Image</th><th>Package</th><th>Installed</th><th>Fixed</th><th>Title</th></tr></thead>
    <tbody>
${body}
    </tbody>
  </table>
</body></html>`;
}

const defaultFilters: DataTableFilterMeta = {
    severity: { value: null, matchMode: FilterMatchMode.IN },
    vulnerabilityID: { value: null, matchMode: FilterMatchMode.CONTAINS },
    pkgName: { value: null, matchMode: FilterMatchMode.CONTAINS },
    image: { value: null, matchMode: FilterMatchMode.CONTAINS },
};

// ---- cell renderers (module scope: they don't close over component state) ----
const severityBody = (r: VulnRow) => <Tag value={r.severity} severity={severitySeverity(r.severity)} />;
const cveBody = (r: VulnRow) => {
    const url = vulnUrl(r.vulnerabilityID, r.primaryURL);
    return url ? (
        <a className="flex align-items-center gap-1 text-primary cursor-pointer" onClick={() => BrowserOpenURL(url)}>
            {r.vulnerabilityID} <VscLinkExternal />
        </a>
    ) : (
        <span>{r.vulnerabilityID}</span>
    );
};
const fixedBody = (r: VulnRow) =>
    r.fixedVersion ? <span>{r.fixedVersion}</span> : <span className="text-color-secondary">—</span>;
const severityFilterTemplate = (options: any) => (
    <MultiSelect
        value={options.value}
        options={SEVERITIES.map((s) => ({ label: s, value: s }))}
        onChange={(e) => options.filterApplyCallback(e.value)}
        placeholder="Severity"
        className="p-column-filter"
    />
);

// useImageScanner encapsulates the per-tab scan state and the sequential scan
// loop, so each tab (Cluster / Image / Pod) keeps its own independent results.
function useImageScanner(clusterName: string, pushToast: PushToast) {
    const [rows, setRows] = useState<VulnRow[]>([]);
    const [scanning, setScanning] = useState(false);
    const [progress, setProgress] = useState<Progress>(null);
    const [log, setLog] = useState('');
    const [error, setError] = useState('');

    // Scan images sequentially, appending results incrementally so the user
    // sees progress (the first scan downloads the vulnerability DB). `log` is a
    // single-line, console-style status of the current scan stage.
    const scanImages = async (images: string[]) => {
        if (images.length === 0) {
            setError('No images found to scan.');
            return;
        }
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
                        setLog(`[${i + 1}/${images.length}] ${image}  ·  ${res.error}`);
                    } else {
                        const found = rowsFromResult(image, res);
                        acc.push(...found);
                        setRows([...acc]);
                        setLog(`[${i + 1}/${images.length}] ${image}  ·  ${found.length} finding(s)`);
                    }
                } catch (e: any) {
                    pushToast('error', `Failed to scan ${image}`, String(e));
                    setLog(`[${i + 1}/${images.length}] ${image}  ·  failed`);
                }
            }
            setLog(`✓ done — ${acc.length} finding(s) across ${images.length} image(s)`);
            if (acc.length === 0) {
                pushToast('success', 'No vulnerabilities found', `${images.length} image(s) scanned clean.`);
            }
        } finally {
            setScanning(false);
            setProgress(null);
        }
    };

    return { rows, scanning, progress, log, error, setError, scanImages };
}

type Scanner = ReturnType<typeof useImageScanner>;

// ResultsTable renders the severity summary + filterable vulnerability table
// shared by all three tabs.
function ResultsTable({
    rows,
    scanning,
    progress,
    log,
    error,
    showImageColumn,
    clusterName,
    scope,
}: {
    rows: VulnRow[];
    scanning: boolean;
    progress: Progress;
    log: string;
    error: string;
    showImageColumn: boolean;
    clusterName: string;
    scope: string;
}) {
    const [globalFilter, setGlobalFilter] = useState('');
    const [filters, setFilters] = useState<DataTableFilterMeta>(defaultFilters);

    const exportHtml = async () => {
        const html = buildHtmlReport(scope, clusterName, rows);
        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        const name = `vuln-report-${scope}-${clusterName}-${stamp}.html`.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
        try {
            await SaveReport(name, html);
        } catch (e) {
            console.error('export failed:', e);
        }
    };

    const summary = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const r of rows) counts[r.severity] = (counts[r.severity] || 0) + 1;
        return counts;
    }, [rows]);

    const sortedRows = useMemo(
        () => [...rows].sort((a, b) => (SEVERITY_ORDER[b.severity] || 0) - (SEVERITY_ORDER[a.severity] || 0)),
        [rows]
    );

    return (
        <div className="flex flex-column gap-3">
            <Message severity="info" text={DB_INFO} />
            {error && <Message severity="error" text={error} />}

            {scanning && progress && (
                <div className="flex flex-column gap-1">
                    <div className="trivy-console">
                        <span className="trivy-console__prompt">›</span>
                        <span className="trivy-console__text">{log}</span>
                        <span className="trivy-console__caret" />
                    </div>
                    <ProgressBar value={Math.round((progress.current / progress.total) * 100)} style={{ height: 6 }} />
                </div>
            )}

            {rows.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {SEVERITIES.map((s) =>
                        summary[s] ? <Tag key={s} value={`${s}: ${summary[s]}`} severity={severitySeverity(s)} /> : null
                    )}
                    <Tag value={`Total: ${rows.length}`} />
                </div>
            )}

            <DataTable
                value={sortedRows}
                dataKey="_uid"
                size="small"
                scrollable
                paginator
                rows={50}
                rowsPerPageOptions={[25, 50, 100]}
                filters={filters}
                onFilter={(e) => setFilters(e.filters)}
                globalFilter={globalFilter}
                globalFilterFields={['vulnerabilityID', 'pkgName', 'image', 'title']}
                filterDisplay="menu"
                emptyMessage={scanning ? 'Scanning…' : 'No vulnerabilities to show. Run a scan.'}
                header={
                    <div className="flex justify-content-end align-items-center gap-2">
                        <Button
                            label="Export HTML"
                            icon={<VscExport />}
                            outlined
                            size="small"
                            disabled={rows.length === 0}
                            onClick={exportHtml}
                            tooltip="Save these findings as an HTML report"
                        />
                        <InputText value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} placeholder="Search…" />
                    </div>
                }
            >
                <Column field="severity" header="Severity" body={severityBody} sortable filter filterElement={severityFilterTemplate} showFilterMatchModes={false} style={{ width: 110 }} />
                <Column field="vulnerabilityID" header="Vulnerability" body={cveBody} sortable filter style={{ width: 170 }} />
                <Column field="pkgName" header="Package" sortable filter />
                <Column field="installedVersion" header="Installed" />
                <Column field="fixedVersion" header="Fixed" body={fixedBody} />
                {showImageColumn && <Column field="image" header="Image" sortable filter />}
                <Column field="title" header="Title" />
            </DataTable>
        </div>
    );
}

// ---- Tab 1: scan every image running in the cluster ----
function ClusterScanTab({ clusterName, scanner }: { clusterName: string; scanner: Scanner }) {
    const run = async () => {
        if (scanner.scanning) return;
        try {
            const images = await TrivyListPodImages(clusterName, '');
            await scanner.scanImages(images || []);
        } catch (e: any) {
            scanner.setError(`Failed to list images: ${String(e)}`);
        }
    };

    return (
        <div className="flex flex-column gap-3">
            <div className="flex align-items-center gap-2">
                <span className="text-color-secondary text-sm">
                    Scans every distinct image used by pods across all namespaces in <b>{clusterName}</b>.
                </span>
                <Button label="Scan cluster" icon={<VscPlay />} onClick={run} loading={scanner.scanning} />
            </div>
            <ResultsTable rows={scanner.rows} scanning={scanner.scanning} progress={scanner.progress} log={scanner.log} error={scanner.error} showImageColumn clusterName={clusterName} scope="cluster" />
        </div>
    );
}

// ---- Tab 2: scan a single user-entered image ----
function ImageScanTab({ clusterName, scanner, pushToast, imageInput, setImageInput }: {
    clusterName: string;
    scanner: Scanner;
    pushToast: PushToast;
    imageInput: string;
    setImageInput: (v: string) => void;
}) {
    const run = () => {
        const ref = imageInput.trim();
        if (!ref) {
            pushToast('warn', 'Enter an image', 'e.g. nginx:1.25 or registry/repo:tag');
            return;
        }
        scanner.scanImages([ref]);
    };

    return (
        <div className="flex flex-column gap-3">
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
            <ResultsTable rows={scanner.rows} scanning={scanner.scanning} progress={scanner.progress} log={scanner.log} error={scanner.error} showImageColumn={false} clusterName={clusterName} scope="image" />
        </div>
    );
}

// ---- Tab 3: list a namespace's images, scan all or one ----
function PodImagesTab({ clusterName, scanner, pushToast, namespace, setNamespace, namespaceOptions, podImages, setPodImages }: {
    clusterName: string;
    scanner: Scanner;
    pushToast: PushToast;
    namespace: string;
    setNamespace: (v: string) => void;
    namespaceOptions: { label: string; value: string }[];
    podImages: string[];
    setPodImages: (v: string[]) => void;
}) {
    const loadImages = async () => {
        if (!namespace) return;
        try {
            const images = await TrivyListPodImages(clusterName, namespace);
            setPodImages(images || []);
        } catch (e: any) {
            pushToast('error', 'Failed to list images', String(e));
        }
    };

    return (
        <div className="flex flex-column gap-3">
            <div className="flex flex-wrap align-items-center gap-2">
                <Dropdown
                    value={namespace}
                    options={namespaceOptions}
                    onChange={(e) => setNamespace(e.value)}
                    filter
                    placeholder="Select namespace"
                    disabled={scanner.scanning}
                    style={{ minWidth: 220 }}
                />
                <Button label="Load images" icon={<VscRefresh />} outlined onClick={loadImages} disabled={scanner.scanning || !namespace} />
                <Button
                    label="Scan all"
                    icon={<VscPlay />}
                    onClick={() => scanner.scanImages(podImages)}
                    loading={scanner.scanning}
                    disabled={podImages.length === 0}
                />
            </div>

            {podImages.length > 0 && (
                <DataTable value={podImages.map((img) => ({ image: img }))} size="small" scrollable scrollHeight="180px">
                    <Column field="image" header={`Images in ${namespace} (${podImages.length})`} />
                    <Column
                        header=""
                        style={{ width: 120 }}
                        body={(r: { image: string }) => (
                            <Button label="Scan" size="small" text icon={<VscPlay />} disabled={scanner.scanning} onClick={() => scanner.scanImages([r.image])} />
                        )}
                    />
                </DataTable>
            )}

            <ResultsTable rows={scanner.rows} scanning={scanner.scanning} progress={scanner.progress} log={scanner.log} error={scanner.error} showImageColumn clusterName={clusterName} scope="pod" />
        </div>
    );
}

export default function TrivyScanner({ clusterName }: { clusterName: string }) {
    const toast = useRef<Toast | null>(null);
    const pushToast: PushToast = (severity, summary, detail) =>
        toast.current?.show({ severity, summary, detail, life: 4000 });

    // All scan state lives here in the always-mounted parent, so each tab keeps
    // its own results table and inputs even though TabView unmounts inactive panels.
    const cluster = useImageScanner(clusterName, pushToast);
    const image = useImageScanner(clusterName, pushToast);
    const pod = useImageScanner(clusterName, pushToast);
    const [imageInput, setImageInput] = useState('');
    const [namespace, setNamespace] = useState('');
    const [namespaceOptions, setNamespaceOptions] = useState<{ label: string; value: string }[]>([]);
    const [podImages, setPodImages] = useState<string[]>([]);

    useEffect(() => {
        GetNamespaces(clusterName)
            .then((items: models.NamespaceInfo[]) =>
                setNamespaceOptions((items || []).map((n: any) => ({ label: n.name, value: n.name })))
            )
            .catch(() => setNamespaceOptions([]));
    }, [clusterName]);

    return (
        <div className="flex flex-column h-full p-3 gap-3" style={{ overflow: 'auto' }}>
            <Toast ref={toast} />

            <div className="flex align-items-center gap-2">
                <VscShield size={18} />
                <span className="font-semibold">Vulnerability Scan</span>
                <span className="text-color-secondary text-sm">• {clusterName}</span>
            </div>

            <TabView>
                <TabPanel header="Cluster Scan">
                    <ClusterScanTab clusterName={clusterName} scanner={cluster} />
                </TabPanel>
                <TabPanel header="Image Scan">
                    <ImageScanTab clusterName={clusterName} scanner={image} pushToast={pushToast} imageInput={imageInput} setImageInput={setImageInput} />
                </TabPanel>
                <TabPanel header="Pod Images">
                    <PodImagesTab clusterName={clusterName} scanner={pod} pushToast={pushToast} namespace={namespace} setNamespace={setNamespace} namespaceOptions={namespaceOptions} podImages={podImages} setPodImages={setPodImages} />
                </TabPanel>
            </TabView>
        </div>
    );
}
