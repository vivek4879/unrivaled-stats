import { buildPlayerTable } from './tables';
import type { PlayerRow } from './tables';
import type { Club, Rank, StatsData } from './types';

/** A player needs this many games to appear on a leaders card. */
export const MIN_GAMES = 5;

/** How many players a leaders card lists. */
export const LEADERS_PER_CARD = 5;

export interface LeaderCardConfig {
    key: string;
    name: string;
    label: string;
}

export interface LeaderGroupConfig {
    name: string;
    cards: LeaderCardConfig[];
}

export const LEADER_GROUPS: LeaderGroupConfig[] = [
    {
        name: 'Offense',
        cards: [
            { key: 'pts', name: 'Points', label: 'PTS' },
            { key: 'ast', name: 'Assists', label: 'AST' },
            { key: 'tpm', name: '3-Pointers Made', label: '3PM' },
            { key: 'gw', name: 'Game Winners', label: 'GW' },
        ],
    },
    {
        name: 'Defense',
        cards: [
            { key: 'reb', name: 'Rebounds', label: 'REB' },
            { key: 'blk', name: 'Blocks', label: 'BLK' },
            { key: 'stl', name: 'Steals', label: 'STL' },
            { key: 'min', name: 'Minutes', label: 'MIN' },
        ],
    },
];

/**
 * The preview has no game winners, so the top scorers carry these placeholder counts
 * and the card shows its shape. Remove once real data exists.
 */
export const GAME_WINNER_PLACEHOLDER = [2, 2, 1, 1, 1];

export interface LeaderRow {
    name: string;
    slug: string;
    club: Club;
    value: number;
    display: string;
    rank: Rank;
}

export interface LeaderCard extends LeaderCardConfig {
    rows: LeaderRow[];
    /** True when "Complete leaders" can open Player Stats sorted by this stat (the stat is a player column). */
    sortable: boolean;
}

export interface LeaderGroup {
    name: string;
    cards: LeaderCard[];
}

function cardRows(card: LeaderCardConfig, pool: PlayerRow[]): LeaderRow[] {
    type Entry = { player: PlayerRow; value: number; display: string };
    let entries: Entry[];
    if (card.key === 'gw') {
        entries = [...pool]
            .sort((a, b) => (b.v.pts as number) - (a.v.pts as number))
            .slice(0, GAME_WINNER_PLACEHOLDER.length)
            .map((player, i) => ({
                player,
                value: GAME_WINNER_PLACEHOLDER[i],
                display: String(GAME_WINNER_PLACEHOLDER[i]),
            }));
    } else {
        entries = pool
            .filter((r) => r.v[card.key] !== null && (r.v[card.key] as number) > 0)
            .map((player) => ({
                player,
                value: player.v[card.key] as number,
                display: player.d[card.key],
            }));
    }
    entries.sort((a, b) => b.value - a.value);

    // Ranks count everyone on the card, not just the top five, so a tie at the cut-off still reads as tied.
    return entries.slice(0, LEADERS_PER_CARD).map((x) => ({
        name: x.player.name,
        slug: x.player.slug,
        club: x.player.club,
        value: x.value,
        display: x.display,
        rank: {
            n: entries.filter((y) => y.value > x.value).length + 1,
            tied: entries.filter((y) => y.value === x.value).length > 1,
        },
    }));
}

/** The leaders page: the top players in each stat, from the player preview, grouped into cards. */
export function buildLeaders(data: StatsData): LeaderGroup[] {
    const table = buildPlayerTable(data, { sort: 'pts', dir: 'desc', club: 'all' });
    const pool = table.rows.filter((r) => r.v.gp !== null && r.v.gp >= MIN_GAMES);
    return LEADER_GROUPS.map((group) => ({
        name: group.name,
        cards: group.cards.map((card) => ({
            ...card,
            rows: cardRows(card, pool),
            sortable: table.columns.some((c) => c.key === card.key),
        })),
    }));
}
