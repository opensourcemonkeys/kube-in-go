import { useEffect, useMemo, useRef, useState } from 'react';

import { VscPlay, VscShield, VscRefresh, VscLinkExternal } from 'react-icons/vsc';

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

import { GetNamespaces, TrivyListPodImages, TrivyScanImage } from '../../../wailsjs/go/controller_app/App';
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
    const [error, setError] = useState('');

    // Scan images sequentially, appending results incrementally so the user
    // sees progress (the first scan downloads the vulnerability DB).
    const scanImages = async (images: string[]) => {
        if (images.length === 0) {
            setError('No images found to scan.');
            return;
        }
        setError('');
        setRows([]);
        setScanning(true);
        const acc: VulnRow[] = [];
        try {
            for (let i = 0; i < images.length; i++) {
                const image = images[i];
                setProgress({ current: i + 1, total: images.length, image });
                try {
                    const res = await TrivyScanImage(clusterName, image);
                    if (res.error) pushToast('warn', `Scan issue: ${image}`, res.error);
                    acc.push(...rowsFromResult(image, res));
                    setRows([...acc]);
                } catch (e: any) {
                    pushToast('error', `Failed to scan ${image}`, String(e));
                }
            }
            if (acc.length === 0) {
                pushToast('success', 'No vulnerabilities found', `${images.length} image(s) scanned clean.`);
            }
        } finally {
            setScanning(false);
            setProgress(null);
        }
    };

    return { rows, scanning, progress, error, setError, scanImages };
}

// ResultsTable renders the severity summary + filterable vulnerability table
// shared by all three tabs.
function ResultsTable({
    rows,
    scanning,
    progress,
    error,
    showImageColumn,
}: {
    rows: VulnRow[];
    scanning: boolean;
    progress: Progress;
    error: string;
    showImageColumn: boolean;
}) {
    const [globalFilter, setGlobalFilter] = useState('');
    const [filters, setFilters] = useState<DataTableFilterMeta>(defaultFilters);

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
                    <span className="text-sm text-color-secondary">
                        Scanning {progress.current}/{progress.total}: {progress.image}
                    </span>
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
                    <div className="flex justify-content-end">
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
function ClusterScanTab({ clusterName, pushToast }: { clusterName: string; pushToast: PushToast }) {
    const { rows, scanning, progress, error, setError, scanImages } = useImageScanner(clusterName, pushToast);

    const run = async () => {
        if (scanning) return;
        try {
            const images = await TrivyListPodImages(clusterName, '');
            await scanImages(images || []);
        } catch (e: any) {
            setError(`Failed to list images: ${String(e)}`);
        }
    };

    return (
        <div className="flex flex-column gap-3">
            <div className="flex align-items-center gap-2">
                <span className="text-color-secondary text-sm">
                    Scans every distinct image used by pods across all namespaces in <b>{clusterName}</b>.
                </span>
                <Button label="Scan cluster" icon={<VscPlay />} onClick={run} loading={scanning} />
            </div>
            <ResultsTable rows={rows} scanning={scanning} progress={progress} error={error} showImageColumn />
        </div>
    );
}

// ---- Tab 2: scan a single user-entered image ----
function ImageScanTab({ clusterName, pushToast }: { clusterName: string; pushToast: PushToast }) {
    const { rows, scanning, progress, error, scanImages } = useImageScanner(clusterName, pushToast);
    const [imageInput, setImageInput] = useState('');

    const run = () => {
        const ref = imageInput.trim();
        if (!ref) {
            pushToast('warn', 'Enter an image', 'e.g. nginx:1.25 or registry/repo:tag');
            return;
        }
        scanImages([ref]);
    };

    return (
        <div className="flex flex-column gap-3">
            <div className="flex flex-wrap align-items-center gap-2">
                <InputText
                    value={imageInput}
                    onChange={(e) => setImageInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && run()}
                    placeholder="nginx:1.25"
                    disabled={scanning}
                    style={{ minWidth: 280 }}
                />
                <Button label="Scan image" icon={<VscPlay />} onClick={run} loading={scanning} />
            </div>
            <ResultsTable rows={rows} scanning={scanning} progress={progress} error={error} showImageColumn={false} />
        </div>
    );
}

// ---- Tab 3: list a namespace's images, scan all or one ----
function PodImagesTab({ clusterName, pushToast }: { clusterName: string; pushToast: PushToast }) {
    const { rows, scanning, progress, error, scanImages } = useImageScanner(clusterName, pushToast);
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
                    disabled={scanning}
                    style={{ minWidth: 220 }}
                />
                <Button label="Load images" icon={<VscRefresh />} outlined onClick={loadImages} disabled={scanning || !namespace} />
                <Button
                    label="Scan all"
                    icon={<VscPlay />}
                    onClick={() => scanImages(podImages)}
                    loading={scanning}
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
                            <Button label="Scan" size="small" text icon={<VscPlay />} disabled={scanning} onClick={() => scanImages([r.image])} />
                        )}
                    />
                </DataTable>
            )}

            <ResultsTable rows={rows} scanning={scanning} progress={progress} error={error} showImageColumn />
        </div>
    );
}

export default function TrivyScanner({ clusterName }: { clusterName: string }) {
    const toast = useRef<Toast | null>(null);
    const pushToast: PushToast = (severity, summary, detail) =>
        toast.current?.show({ severity, summary, detail, life: 4000 });

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
                    <ClusterScanTab clusterName={clusterName} pushToast={pushToast} />
                </TabPanel>
                <TabPanel header="Image Scan">
                    <ImageScanTab clusterName={clusterName} pushToast={pushToast} />
                </TabPanel>
                <TabPanel header="Pod Images">
                    <PodImagesTab clusterName={clusterName} pushToast={pushToast} />
                </TabPanel>
            </TabView>
        </div>
    );
}
