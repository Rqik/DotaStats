import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { calculateProfit, type BetResult } from '../../domain/bankroll';

export type { BetResult } from '../../domain/bankroll';

export interface Bet {
  id: string;
  date: string;
  tournament: string;
  match: string;
  selection: string;
  odds: number;
  stake: number;
  result: BetResult;
  profit: number;
}

interface BetStore {
  bets: Bet[];
  addBet: (bet: Bet) => void;
  settleBet: (id: string, result: BetResult) => void;
}

const seedBets: Bet[] = [
  { id: 'bet-1', date: '18 июл., 21:30', tournament: 'Riyadh Masters', match: 'Team Spirit — Aurora', selection: 'Spirit −7.5 убийств', odds: 1.82, stake: 1200, result: 'win', profit: 984 },
  { id: 'bet-2', date: '17 июл., 19:00', tournament: 'FISSURE Universe', match: 'PARIVISION — Tundra', selection: 'PARIVISION победа', odds: 1.68, stake: 1500, result: 'loss', profit: -1500 },
  { id: 'bet-3', date: '16 июл., 16:30', tournament: 'Elite League', match: 'Falcons — Vici Gaming', selection: 'Vici +20.5 убийств', odds: 1.65, stake: 1000, result: 'pending', profit: 0 },
];

export const useBetStore = create<BetStore>()(
  persist(
    (set) => ({
      bets: seedBets,
      addBet: (bet) => set((state) => ({ bets: state.bets.some(({ id }) => id === bet.id) ? state.bets : [bet, ...state.bets] })),
      settleBet: (id, result) => set((state) => ({
        bets: state.bets.map((bet) => bet.id === id ? { ...bet, result, profit: calculateProfit({ stake: bet.stake, odds: bet.odds, stakeType: 'cash', result }) } : bet),
      })),
    }),
    { name: 'dota-pulse-bets:v1', version: 1 },
  ),
);

export const formatMoney = (value: number): string => `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value)} ₽`;
