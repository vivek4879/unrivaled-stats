/** 77.7 per game, 1,088 in totals. Missing values show as an empty string. */
export function formatTeamValue(value: number | null | undefined, perMode: string): string {
    if (value === null || value === undefined || Number.isNaN(value)) return '';
    return perMode === 'Total' ? Math.round(value).toLocaleString('en-US') : value.toFixed(1);
}

/** Player values: counts print as-is, everything else to one decimal. Missing values show as an empty string. */
export function formatPlayerValue(value: number | null, kind: 'count' | 'percent' | undefined): string {
    if (value === null) return '';
    return kind === 'count' ? String(value) : value.toFixed(1);
}
