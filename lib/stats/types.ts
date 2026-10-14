export type SortDir = 'asc' | 'desc';
export type Better = 'high' | 'low';

/** A rank within the league. `tied` is true when another row has the same value (shown as "T-2"). */
export interface Rank {
    n: number;
    tied: boolean;
}

export interface Club {
    slug: string;
    name: string;
    primary: string;
    secondary: string;
    logo: string;
    url: string;
}

export interface Season {
    year: string;
    label: string;
}

/** A stat column on the team table. */
export interface TeamColumn {
    key: string;
    label: string;
    name: string;
    group: string;
    better: Better;
}

/** A stat column on the player table. `kind` is only set for counts (GP) and percentages. */
export interface PlayerColumn {
    key: string;
    label: string;
    name: string;
    better: Better;
    kind?: 'count' | 'percent';
}

export interface TeamSourceRow {
    club: string;
    gp: number;
    perGame: Record<string, number>;
    total: Record<string, number>;
}

/** `name` and `club` are strings; every other field is a stat that may be null (e.g. a percentage with no attempts). */
export interface PlayerSourceRow {
    name: string;
    club: string;
    [stat: string]: string | number | null;
}

export interface PlayerPreview {
    season: string;
    seasonType: string;
    perMode: string;
    columns: PlayerColumn[];
    rows: PlayerSourceRow[];
}

/** The shape of the supplied stats snapshot (`lib/stats-data.js`). */
export interface StatsData {
    seasons: Season[];
    defaultSeason: string;
    seasonTypes: string[];
    perModes: string[];
    columns: TeamColumn[];
    clubs: Record<string, Club>;
    /** Keyed by `${season}|${seasonType}`, e.g. "2025|Regular Season". */
    tables: Record<string, TeamSourceRow[]>;
    playerPreview: PlayerPreview;
}

/** Already-validated team table state. Parsing and falling back to defaults is the parser's job. */
export interface TeamState {
    season: string;
    seasonType: string;
    perMode: string;
    sort: string;
    dir: SortDir;
}

/** Already-validated player table state. */
export interface PlayerState {
    sort: string;
    dir: SortDir;
    /** A club slug, or 'all'. */
    club: string;
}
