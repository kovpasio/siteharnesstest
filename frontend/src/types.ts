export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type Zone = '.ru' | '.com' | '.io';

export interface User {
  id: number;
  telegram_id: number;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  balance: number;
  pity_counter: number;
  total_spins: number;
  created_at: string;
}

export interface Domain {
  id: number;
  name: string;
  zone: Zone;
  full_name: string;
  rarity: Rarity;
  weight: number;
  price: number;
}

export interface MeStats {
  collection_count: number;
  collection_value: number;
  collection_by_rarity: Record<Rarity, number>;
  rank: number | null;
  total_players: number;
  pity_counter: number;
  pity_threshold: number;
  spin_cost: number;
  daily_bonus: number;
  daily_available_at: string | null;
  can_daily_bonus: boolean;
}

export interface MeResponse {
  user: User;
  stats: MeStats;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Commitment {
  commitment_id: number;
  server_seed_hash: string;
  client_seed: string;
  nonce: number;
  created_at: string;
}

export interface SpinResult {
  id: number;
  domain: Domain;
  rarity: Rarity;
  base_rarity: Rarity;
  price: number;
  server_seed: string;
  server_seed_hash: string;
  client_seed: string;
  nonce: number;
  rarity_roll: number;
  domain_roll: number;
  domain_index: number;
  bucket_size: number;
  pity_applied: boolean;
  pity_counter: number;
  balance: number;
  created_at: string;
}

export interface InventoryItem {
  id: number;
  domain: Domain;
  acquired_at: string;
  sold_at: string | null;
  sold_price: number | null;
}

export interface SellResult {
  item_id: number;
  sold_price: number;
  balance: number;
  domain: Domain;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  score: number;
  domains_count: number;
  is_me: boolean;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  me: LeaderboardEntry | null;
  total_players: number;
}

export interface Drop {
  spin_id: number;
  user_id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  domain: Domain;
  rarity: Rarity;
  price: number;
  pity_applied: boolean;
  created_at: string;
}

export interface DropsResponse {
  drops: Drop[];
}

export interface DailyBonusResponse {
  rewarded: boolean;
  amount: number;
  balance: number;
  next_available_at: string | null;
  user: User;
}

export interface VerifyResult {
  spin_id: number | null;
  username: string | null;
  domain: Domain;
  rarity: Rarity;
  base_rarity: Rarity;
  server_seed: string;
  server_seed_hash: string;
  hash_valid: boolean;
  client_seed: string;
  nonce: number;
  rarity_roll: number;
  domain_roll: number;
  domain_index: number;
  bucket_size: number;
  pity_applied: boolean;
  computed_rarity: Rarity;
  computed_domain: Domain;
  verified: boolean;
  created_at: string | null;
  formula: string;
}

export interface Meta {
  app_name: string;
  zones: Zone[];
  rarities: Array<{
    key: Rarity;
    title: string;
    weight: number;
    price: number;
    length: string;
    color: string;
    glow: string;
    probability: number;
  }>;
  economy: {
    start_balance: number;
    spin_cost: number;
    daily_bonus: number;
    daily_cooldown_hours: number;
    expected_value: number;
    house_edge: number;
    pity_threshold: number;
    sell_prices: Record<Rarity, number>;
  };
  total_weight: number;
  provably_fair: Record<string, string>;
}

export interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { user?: TelegramWebAppUser; start_param?: string };
  ready: () => void;
  expand: () => void;
  close: () => void;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  disableVerticalSwipes?: () => void;
  enableClosingConfirmation?: () => void;
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  themeParams?: Record<string, string>;
  colorScheme?: 'light' | 'dark';
  viewportStableHeight?: number;
  platform?: string;
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}
