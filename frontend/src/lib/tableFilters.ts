import { FilterService } from 'primereact/api';
import type { DataTableFilterMeta } from 'primereact/datatable';

// PrimeReact `matchMode`'u yerleşik modlardan oluşan kapalı bir union olarak
// tipliyor ve kayıtlı özel modları tanımıyor (DataTableFilterMetaData de dışa
// aktarılmıyor, o yüzden tipi buradan türetiyoruz). Daraltmayı tek bir yerde
// yapıp çağrı yerlerinin temiz kalmasını sağlıyoruz.
type MatchMode = Extract<DataTableFilterMeta[string], { matchMode: unknown }>['matchMode'];

const ARRAY_IN_MODE: string = 'arrayIn';

/**
 * IN filtresinin dizi değerli satır alanları için karşılığı: satırın dizisi
 * seçilenlerden en az biriyle kesişiyorsa eşleşir.
 *
 * PrimeReact'ın yerleşik `in` modu satır değerini skaler kabul ettiği için
 * (`ObjectUtils.equals(value, filter[i])`) dizi değerli bir alanla asla
 * eşleşmez. `<Column filterFunction>` de bir çözüm değil: PrimeReact onu
 * yalnızca `filters` prop'u verilmediğinde kaydediyor, bizim tablolar ise her
 * zaman kontrollü `filters` geçiyor. Bu yüzden match mode'u global olarak
 * kaydediyoruz — `executeLocalFilter` doğrudan `FilterService.filters[mode]`
 * üzerinden çözdüğü için bu yol sorunsuz çalışıyor.
 */
export const ARRAY_IN = ARRAY_IN_MODE as MatchMode;

FilterService.register(ARRAY_IN_MODE, (value: unknown, filter: unknown[] | null) => {
    // Yerleşik `in` ile aynı boş-değer semantiği: hiçbir şey seçili değilken
    // (MultiSelect tümü kaldırılınca `[]` gönderir) filtre uygulanmaz.
    if (filter == null || filter.length === 0) return true;
    if (value == null) return false;
    const values = (Array.isArray(value) ? value : [value]).map(String);
    return filter.some((f) => values.includes(String(f)));
});
