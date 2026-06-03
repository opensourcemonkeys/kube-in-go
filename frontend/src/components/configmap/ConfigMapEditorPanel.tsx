import { useEffect, useRef, useState } from 'react';
import { IDockviewPanelProps } from 'dockview';
import { Button } from 'primereact/button';
import Close from '@mui/icons-material/Close';
import Add from '@mui/icons-material/Add';
import UndoOutlined from '@mui/icons-material/UndoOutlined';
import CheckOutlined from '@mui/icons-material/CheckOutlined';
import TuneOutlined from '@mui/icons-material/TuneOutlined';
import { Column, ColumnEditorOptions, ColumnEvent } from 'primereact/column';
import { DataTable } from 'primereact/datatable';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Toast } from 'primereact/toast';
import { GetConfigMapData, UpdateConfigMapData } from '../../../wailsjs/go/controller_app/App';

interface ConfigMapEditorPanelParams {
    name: string;
    namespace: string;
}

interface KeyValueRow {
    id: number;
    key: string;
    value: string;
}

let rowCounter = 0;
const nextId = () => ++rowCounter;

const dataToRows = (data: Record<string, string>): KeyValueRow[] =>
    Object.entries(data)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => ({ id: nextId(), key, value }));

const rowsEqual = (a: KeyValueRow[], b: KeyValueRow[]) => {
    if (a.length !== b.length) return false;
    return a.every((row, i) => row.key === b[i].key && row.value === b[i].value);
};

export default function ConfigMapEditorPanel({ params }: IDockviewPanelProps<ConfigMapEditorPanelParams>) {
    const { name, namespace } = params;
    const [rows, setRows] = useState<KeyValueRow[]>([]);
    const [originalRows, setOriginalRows] = useState<KeyValueRow[]>([]);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const toast = useRef<Toast | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await GetConfigMapData(name, namespace);
                const loaded = dataToRows(data ?? {});
                setRows(loaded);
                setOriginalRows(loaded.map(r => ({ ...r })));
            } catch {
                toast.current?.show({ severity: 'error', summary: 'Load failed', detail: `${namespace}/${name} could not be loaded`, life: 3500 });
            }
        };
        load();
    }, [name, namespace]);

    const onCellEditComplete = (e: ColumnEvent) => {
        const { rowIndex, field, newValue } = e;
        setRows(prev => {
            const next = prev.map((r, i) => i === rowIndex ? { ...r, [field]: newValue ?? '' } : r);
            setDirty(!rowsEqual(next, originalRows));
            return next;
        });
    };

    const addRow = () => {
        setRows(prev => {
            const next = [...prev, { id: nextId(), key: '', value: '' }];
            setDirty(!rowsEqual(next, originalRows));
            return next;
        });
    };

    const removeRow = (id: number) => {
        setRows(prev => {
            const next = prev.filter(r => r.id !== id);
            setDirty(!rowsEqual(next, originalRows));
            return next;
        });
    };

    const handleSave = async () => {
        const data: Record<string, string> = {};
        for (const row of rows) {
            if (row.key.trim()) data[row.key.trim()] = row.value;
        }
        setSaving(true);
        try {
            await UpdateConfigMapData(name, namespace, data);
            const saved = dataToRows(data);
            setOriginalRows(saved.map(r => ({ ...r })));
            setDirty(false);
            toast.current?.show({ severity: 'success', summary: 'Updated', detail: `${namespace}/${name} updated`, life: 2500 });
        } catch {
            toast.current?.show({ severity: 'error', summary: 'Update failed', detail: `${namespace}/${name} could not be updated`, life: 3500 });
        } finally {
            setSaving(false);
        }
    };

    const handleRevert = () => {
        setRows(originalRows.map(r => ({ ...r })));
        setDirty(false);
    };

    const keyEditor = (options: ColumnEditorOptions) => (
        <InputText
            value={options.value}
            onChange={(e) => options.editorCallback!(e.target.value)}
            style={{ fontFamily: 'monospace', fontSize: '0.85rem', width: '100%' }}
            autoFocus
        />
    );

    const valueEditor = (options: ColumnEditorOptions) => (
        <InputTextarea
            value={options.value}
            onChange={(e) => options.editorCallback!(e.target.value)}
            style={{ fontFamily: 'monospace', fontSize: '0.85rem', width: '100%', minHeight: '72px' }}
            autoResize
            rows={3}
        />
    );

    const valueBody = (rowData: KeyValueRow) => (
        <span style={{
            fontFamily: 'monospace',
            fontSize: '0.85rem',
            whiteSpace: 'pre',
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxHeight: '4.5rem',
            color: 'var(--text-color-secondary)',
        }}>
            {rowData.value}
        </span>
    );

    const actionsBody = (rowData: KeyValueRow) => (
        <Button
            icon={<Close fontSize="small" />}
            text
            severity="danger"
            size="small"
            onClick={() => removeRow(rowData.id)}
            disabled={saving}
            style={{ padding: '0.2rem' }}
        />
    );

    const tableHeader = (
        <div className="flex justify-content-between align-items-center gap-2">
            <span className="yaml-editor-toolbar__label flex align-items-center gap-1" style={{ fontSize: '0.85rem' }}>
                <TuneOutlined style={{ fontSize: '0.9rem' }} />
                {namespace}/{name}
            </span>
            <div className="flex align-items-center gap-1">
                <Button label="Add Key" icon={<Add fontSize="small" />} text size="small" onClick={addRow} disabled={saving} />
                <Button label="Revert" icon={<UndoOutlined fontSize="small" />} text size="small" disabled={!dirty || saving} onClick={handleRevert} />
                <Button label="Save" icon={<CheckOutlined fontSize="small" />} size="small" loading={saving} disabled={!dirty} onClick={handleSave} />
            </div>
        </div>
    );

    return (
        <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Toast ref={toast} position="bottom-right" />

            <DataTable
                value={rows}
                dataKey="id"
                editMode="cell"
                header={tableHeader}
                scrollable
                scrollHeight="flex"
                showGridlines
                stripedRows
                emptyMessage="No data entries. Click 'Add Key' to add one."
                style={{ flex: 1 }}
            >
                <Column
                    field="key"
                    header="Key"
                    editor={keyEditor}
                    onCellEditComplete={onCellEditComplete}
                    style={{ width: '30%', minWidth: '10rem', fontFamily: 'monospace', fontSize: '0.85rem' }}
                />
                <Column
                    field="value"
                    header="Value"
                    editor={valueEditor}
                    onCellEditComplete={onCellEditComplete}
                    body={valueBody}
                    style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                />
                <Column
                    header=""
                    body={actionsBody}
                    style={{ width: '3.5rem', textAlign: 'center' }}
                />
            </DataTable>
        </div>
    );
}
