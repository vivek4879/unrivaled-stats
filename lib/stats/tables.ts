import { formatPlayerValue, formatTeamValue } from './format';
import type {
    Better,
    Club,
    PlayerColumn,
    PlayerState,
    Rank,
    StatsData,
    TeamColumn,
    TeamState,
} from './types';

/** A percentage on fewer attempts than this says little: it is not ranked and sorts last. */
export const MIN_ATTEMPTS = 10;

// ---------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------

/** The rank `x` earns among `values`, best first. Equal values share a rank and are marked tied. */
export function rankAmong(values: number[], x: number, better: Better): Rank {
    const ahead = values.filter((y) => (better === 'low' ? y < x : y > x)).length;
    const same = values.filter((y) => y === x).length;
    return { n: ahead + 1, tied: same > 1 };
}

function bestOf(values: number[], better: Better): number | null {
    if (!values.length) return null;
    return better === 'low' ? Math.min(...values) : Math.max(...values);
}

// ---------------------------------------------------------------------
// Team table
// ---------------------------------------------------------------------

export interface TeamColumnStats {
    min: number;
    max: number;
    avg: number;
    avgDisplay: string;
    best: number;
    worst: number;
    spread: number;
    /** Slugs of every club holding the best value. */
    leaders: string[];
}

export interface TeamRow {
    slug: string;
    name: string;
    club: Club;
    gp: number;
    /** Raw values by stat key. */
    v: Record<string, number>;
    /** Display strings by stat key. */
    d: Record<string, string>;
    /** League rank by stat key. Rank 1 is the league best: most for most stats, fewest for TO and PF. */
    rank: Record<string, Rank>;
}

export interface TeamTable {
    columns: TeamColumn[];
    rows: TeamRow[];
    stats: Record<string, TeamColumnStats>;
    state: TeamState;
}

/**
 * The team table for a state: ranked, with league stats, sorted by `state.sort`.
 * Returns null when there are no games for that season and type (see `teamEmptyState`).
 * The state must already be valid; parsing is the parser's job.
 */
export function buildTeamTable(data: StatsData, state: TeamState): TeamTable | null {
    const source = data.tables[`${state.season}|${state.seasonType}`];
    if (!source || !source.length) return null;
    if (!data.columns.some((c) => c.key === state.sort)) {
        throw new Error(`Unknown team sort column: ${state.sort}`);
    }

    const columns = data.columns;
    const perMode = state.perMode;
    const total = perMode === 'Total';
    const valuesByRow = source.map((r) => (total ? r.total : r.perGame));

    const ranks: Record<string, Rank>[] = source.map(() => ({}));
    const stats: Record<string, TeamColumnStats> = {};
    for (const col of columns) {
        const vals = valuesByRow.map((v) => v[col.key]);
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        const best = col.better === 'low' ? min : max;
        const worst = col.better === 'low' ? max : min;
        vals.forEach((x, i) => {
            ranks[i][col.key] = rankAmong(vals, x, col.better);
        });
        stats[col.key] = {
            min,
            max,
            avg,
            avgDisplay: formatTeamValue(avg, perMode),
            best,
            worst,
            spread: max - min,
            leaders: source.filter((_, i) => vals[i] === best).map((r) => r.club),
        };
    }

    const rows: TeamRow[] = source.map((r, i) => {
        const club = data.clubs[r.club];
        const v: Record<string, number> = {};
        const d: Record<string, string> = {};
        for (const col of columns) {
            v[col.key] = valuesByRow[i][col.key];
            d[col.key] = formatTeamValue(v[col.key], perMode);
        }
        return { slug: r.club, name: club.name, club, gp: r.gp, v, d, rank: ranks[i] };
    });

    const sign = state.dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
        const diff = (a.v[state.sort] - b.v[state.sort]) * sign;
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
    });

    return { columns, rows, stats, state };
}

export type TeamEmptyKind = 'future-season' | 'no-games';

export interface TeamEmptyState {
    kind: TeamEmptyKind;
    title: string;
    body: string;
}

/** What the team page says when its table is empty, by cause. Null when the table has games. */
export function teamEmptyState(data: StatsData, state: TeamState): TeamEmptyState | null {
    if (data.tables[`${state.season}|${state.seasonType}`]) return null;
    const label = data.seasons.find((x) => x.year === state.season)?.label ?? state.season;
    const hasAnyGames = data.seasonTypes.some((t) => !!data.tables[`${state.season}|${t}`]);
    if (!hasAnyGames) {
        return {
            kind: 'future-season',
            title: `${label} has not tipped off`,
            body: `Team stats fill in after the first game of ${label}.`,
        };
    }
    const playoffs = state.seasonType === 'Playoffs';
    return {
        kind: 'no-games',
        title: `No ${playoffs ? 'playoff' : 'regular season'} games yet`,
        body: `Team stats for the ${state.season} ${playoffs ? 'playoffs' : 'regular season'} fill in after the first game.`,
    };
}

// ---------------------------------------------------------------------
// Player table
// ---------------------------------------------------------------------

export type PlayerValues = Record<string, number | null>;

/** Attempts behind a percentage column (per-game attempts times games played), or null if it has none. */
export function attempts(values: PlayerValues, key: string): number | null {
    const perGame =
        key === 'fgPct' ? values.fga : key === 'tpPct' ? values.tpa : key === 'ftPct' ? values.fta : null;
    const gp = values.gp;
    if (perGame === null || perGame === undefined || gp === null || gp === undefined) return null;
    return Math.round(perGame * gp);
}

/** Whether a player's value in a column is ranked. Percentages also need `MIN_ATTEMPTS` attempts. */
export function qualifies(values: PlayerValues, col: PlayerColumn): boolean {
    const value = values[col.key];
    if (col.kind !== 'percent') return value !== null && value !== undefined;
    const a = attempts(values, col.key);
    return value !== null && value !== undefined && a !== null && a >= MIN_ATTEMPTS;
}

export interface PlayerRow {
    name: string;
    slug: string;
    club: Club;
    /** Raw values by stat key; null where the player has no value. */
    v: PlayerValues;
    /** Display strings by stat key; '' where the value is null. */
    d: Record<string, string>;
    /** League rank by stat key, or null when the value is not ranked (see `qualifies`). */
    rank: Record<string, Rank | null>;
}

export interface PlayerTable {
    columns: PlayerColumn[];
    rows: PlayerRow[];
    /** The best ranked value per stat key, or null if nobody qualifies. */
    best: Record<string, number | null>;
    sort: string;
    dir: PlayerState['dir'];
    club: string;
    season: string;
    seasonType: string;
    perMode: string;
}

function valuesOf(source: Record<string, string | number | null>, columns: PlayerColumn[]): PlayerValues {
    const v: PlayerValues = {};
    for (const col of columns) v[col.key] = source[col.key] as number | null;
    return v;
}

/**
 * The player table for a state (the 2025 regular season preview, per game).
 * Ranks are league ranks and are computed before the club filter, so a club's players keep theirs.
 * Percentages rank only among players with enough attempts; the rest are unranked and sort last.
 * The state must already be valid; parsing is the parser's job.
 */
export function buildPlayerTable(data: StatsData, state: PlayerState): PlayerTable {
    const preview = data.playerPreview;
    const columns = preview.columns;
    const sortCol = columns.find((c) => c.key === state.sort);
    if (!sortCol) throw new Error(`Unknown player sort column: ${state.sort}`);

    const valuesByRow = preview.rows.map((r) => valuesOf(r, columns));

    const ranks: Record<string, Rank | null>[] = preview.rows.map(() => ({}));
    const best: Record<string, number | null> = {};
    for (const col of columns) {
        const ranked: number[] = [];
        valuesByRow.forEach((v) => {
            if (qualifies(v, col)) ranked.push(v[col.key] as number);
        });
        best[col.key] = bestOf(ranked, col.better);
        valuesByRow.forEach((v, i) => {
            ranks[i][col.key] = qualifies(v, col) ? rankAmong(ranked, v[col.key] as number, col.better) : null;
        });
    }

    const all: PlayerRow[] = preview.rows.map((r, i) => {
        const club = data.clubs[r.club];
        const v = valuesByRow[i];
        const d: Record<string, string> = {};
        for (const col of columns) d[col.key] = formatPlayerValue(v[col.key], col.kind);
        return { name: r.name, slug: r.club, club, v, d, rank: ranks[i] };
    });

    // Best first (or fewest first for low-is-better stats and for the other direction), nulls last, ties by name.
    const sign = state.dir === 'asc' ? 1 : -1;
    const sorted = all.sort((a, b) => {
        const x = a.v[state.sort];
        const y = b.v[state.sort];
        if (x === null && y === null) return a.name.localeCompare(b.name);
        if (x === null) return 1;
        if (y === null) return -1;
        return (x - y) * sign || a.name.localeCompare(b.name);
    });

    // A percentage column lists qualified players first; unqualified ones follow in the same order.
    let rows = sorted;
    if (sortCol.kind === 'percent') {
        const rankedFirst = sorted.filter((r) => r.rank[sortCol.key] !== null);
        const rest = sorted.filter((r) => r.rank[sortCol.key] === null);
        rows = rankedFirst.concat(rest);
    }

    // The club filter narrows the list after ranking.
    if (state.club !== 'all') rows = rows.filter((r) => r.slug === state.club);

    return {
        columns,
        rows,
        best,
        sort: state.sort,
        dir: state.dir,
        club: state.club,
        season: preview.season,
        seasonType: preview.seasonType,
        perMode: preview.perMode,
    };
}