import type {
  AuthResponse,
  Commitment,
  DailyBonusResponse,
  Domain,
  DropsResponse,
  InventoryItem,
  LeaderboardResponse,
  MeResponse,
  Meta,
  Rarity,
  SellResult,
  SpinResult,
  VerifyResult,
} from '@/types';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || '/api';
const TOKEN_KEY = 'dropzone.jwt';
const DEV_USER_KEY = 'dropzone.devUser';

export class ApiError extends Error {
  status: number;
  retryAfter?: number;

  constructor(message: string, status: number, retryAfter?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function apiUrl(path: string): string {
  return `${API_BASE.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

function detailToString(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === 'object' && item && 'msg' in item) return String(item.msg);
        return String(item);
      })
      .join('; ');
  }
  return 'Не удалось выполнить запрос';
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  withAuth = true,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (withAuth) {
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(apiUrl(path), { ...options, headers });
  } catch {
    throw new ApiError('Нет связи с сервером. Проверьте интернет.', 0);
  }

  if (!response.ok) {
    let message = `Ошибка ${response.status}`;
    let detail: unknown;
    try {
      const data = await response.json();
      detail = data?.detail;
      message = detailToString(detail);
    } catch {
      // non-JSON response
    }
    const retryAfter = Number(response.headers.get('Retry-After') ?? 0) || undefined;
    throw new ApiError(message, response.status, retryAfter);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function getDevUser(): { id: number; username: string; first_name: string } {
  const raw = localStorage.getItem(DEV_USER_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { id: number; username: string; first_name: string };
      if (parsed?.id) return parsed;
    } catch {
      // regenerate
    }
  }
  const id = 100_000_000 + Math.floor(Math.random() * 800_000_000);
  const user = { id, username: 'demo_pilot', first_name: 'Demo' };
  localStorage.setItem(DEV_USER_KEY, JSON.stringify(user));
  return user;
}

export async function authenticateTelegram(): Promise<AuthResponse> {
  const tg = window.Telegram?.WebApp;
  const initData = tg?.initData ?? '';
  const payload: Record<string, unknown> = { init_data: initData };
  if (!initData) {
    payload.dev_user = getDevUser();
  }

  const result = await request<AuthResponse>(
    '/auth/telegram',
    { method: 'POST', body: JSON.stringify(payload) },
    false,
  );
  setToken(result.access_token);
  return result;
}

export const api = {
  me: () => request<MeResponse>('/me'),

  prepareSpin: (clientSeed?: string) =>
    request<Commitment>('/spin/prepare', {
      method: 'POST',
      body: JSON.stringify(clientSeed ? { client_seed: clientSeed } : {}),
    }),

  spin: (commitmentId?: number) =>
    request<SpinResult>('/spin', {
      method: 'POST',
      body: JSON.stringify(commitmentId ? { commitment_id: commitmentId } : {}),
    }),

  inventory: (params?: { zone?: string; rarity?: Rarity }) => {
    const query = new URLSearchParams();
    if (params?.zone) query.set('zone', params.zone);
    if (params?.rarity) query.set('rarity', params.rarity);
    const serialized = query.toString();
    const suffix = serialized ? `?${serialized}` : '';
    return request<InventoryItem[]>(`/inventory${suffix}`);
  },

  sell: (itemId: number) =>
    request<SellResult>(`/inventory/${itemId}/sell`, { method: 'POST' }),

  leaderboard: () => request<LeaderboardResponse>('/leaderboard'),

  domains: (params?: { zone?: string; rarity?: string }) => {
    const query = new URLSearchParams();
    if (params?.zone) query.set('zone', params.zone);
    if (params?.rarity) query.set('rarity', params.rarity);
    const serialized = query.toString();
    const suffix = serialized ? `?${serialized}` : '';
    return request<Domain[]>(`/domains${suffix}`);
  },

  drops: () => request<DropsResponse>('/drops/recent'),

  dailyBonus: () =>
    request<DailyBonusResponse>('/daily-bonus', { method: 'POST' }),

  verifySpin: (spinId: number) =>
    request<VerifyResult>(`/verify/${spinId}`, {}, false),

  verifySeeds: (payload: {
    server_seed: string;
    client_seed: string;
    nonce: number;
    pity_counter?: number;
  }) =>
    request<VerifyResult>(
      '/verify',
      { method: 'POST', body: JSON.stringify(payload) },
      false,
    ),

  meta: () => request<Meta>('/meta', {}, false),
};

export function dropsWebSocketUrl(): string {
  const token = getToken() ?? '';
  const base = new URL(API_BASE.replace(/\/$/, ''), window.location.origin);
  base.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  base.pathname = `${base.pathname.replace(/\/$/, '')}/drops/recent`;
  base.search = new URLSearchParams({ token }).toString();
  base.hash = '';
  return base.toString();
}
