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
debugger
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

            {/* Seçilen değeri kontrol etmek istersen: */}
            {selectedItems && (
                <div style={{ marginTop: '10px' }}>
                    Seçilen Kod: <b>{selectedItems.code}</b>
                </div>
            )}
        </div>
    );
}