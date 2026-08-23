// Unreferenced demo component — nothing in src/ imports it. Left out of
// the i18n migration (beta-plan S12b) rather than translated: adding
// catalog keys for dead code would leave S13 translating strings no
// user can reach. Delete it or wire it up; do not translate it in place.
/* eslint-disable i18next/no-literal-string */
import React, { useState } from "react";
import { ListBox, ListBoxChangeEvent } from 'primereact/listbox';

interface ListModel {
    name: string;
    code: string;
}


interface ListBoxProps {
    data: [string, string][]; 
}

export default function ListBoxComponent({ data }: ListBoxProps) {
    const [selectedItems, setSelectedItem] = useState<ListModel | null>(null);
    const items: ListModel[] = data.map((item) => ({
        name: item[0], 
        code: item[1] 
    }));

    return (
        <div className="card flex justify-content-center">
            <ListBox
                value={selectedItems}
                onChange={(e: ListBoxChangeEvent) => setSelectedItem(e.value)}
                options={items}
                optionLabel="name"
                className="w-full md:w-14rem"
            />

            {/* To inspect selected value: */}
            {selectedItems && (
                <div style={{ marginTop: '10px' }}>
                    Selected Code: <b>{selectedItems.code}</b>
                </div>
            )}
        </div>
    );
}