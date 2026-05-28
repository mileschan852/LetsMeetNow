// ─── Supabase Client ────────────────────────────────────────────────
// Shared Supabase operations for dating apps

import type { DbUser, Raffle, FlyingMessage } from './types'

const SB_HEADERS = (key: string) => ({
  'apikey': key,
  'Authorization': `Bearer ${key}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
})

export function createSupabaseClient(url: string, key: string) {
  const headers = SB_HEADERS(key)

  async function request(table: string, method: string = 'GET', body: any = null, query: string = '') {
    const res = await fetch(`${url}/rest/v1/${table}${query}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const txt = await res.text()
      throw new Error(`Supabase ${method} ${table} ${res.status}: ${txt.slice(0, 200)}`)
    }
    if (res.status === 204) return null
    return res.json()
  }

  return {
    // ── Users ─────────────────────────────────────────────────
    async upsertUser(user: Partial<DbUser> & { id: number }): Promise<DbUser> {
      const existing = await request('users', 'GET', null, `?id=eq.${user.id}&limit=1`)
      if (existing?.[0]) {
        return request('users', 'PATCH', user, `?id=eq.${user.id}`)?.[0]
      }
      return request('users', 'POST', { ...user, created_at: new Date().toISOString() })?.[0]
    },

    async fetchUser(userId: number): Promise<DbUser | null> {
      const res = await request('users', 'GET', null, `?id=eq.${userId}&limit=1`)
      return res?.[0] || null
    },

    async fetchNearby(lat: number, lng: number, radiusKm: number = 50, limit: number = 100): Promise<DbUser[]> {
      // Use PostgREST approximate box query for performance
      const latDelta = radiusKm / 111
      const lngDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180))
      const query = `?latitude=gte.${lat - latDelta}&latitude=lte.${lat + latDelta}&longitude=gte.${lng - lngDelta}&longitude=lte.${lng + lngDelta}&limit=${limit}`
      return request('users', 'GET', null, query) || []
    },

    async setOnlineStatus(userId: number, online: boolean): Promise<void> {
      await request('users', 'PATCH', { online, last_seen: new Date().toISOString() }, `?id=eq.${userId}`)
    },

    // ── Raffles ───────────────────────────────────────────────
    async getActiveRaffle(): Promise<Raffle | null> {
      const res = await request('raffles', 'GET', null, '?status=eq.active&limit=1&order=created_at.desc')
      return res?.[0] || null
    },

    async buyRaffleTicket(userId: number, userName: string, raffleId: string): Promise<boolean> {
      try {
        await request('raffle_tickets', 'POST', {
          raffle_id: raffleId,
          user_id: userId,
          user_name: userName,
          purchased_at: new Date().toISOString(),
        })
        return true
      } catch {
        return false
      }
    },

    async createRaffle(prizeType: string, targetTickets: number = 20): Promise<Raffle> {
      return request('raffles', 'POST', {
        prize_type: prizeType,
        status: 'active',
        target_tickets: targetTickets,
        current_tickets: 0,
        created_at: new Date().toISOString(),
      })
    },

    async drawRaffleWinner(raffleId: string): Promise<{ userId: number; userName: string } | null> {
      const tickets = await request('raffle_tickets', 'GET', null, `?raffle_id=eq.${raffleId}`)
      if (!tickets?.length) return null
      const winner = tickets[Math.floor(Math.random() * tickets.length)]
      await request('raffles', 'PATCH', {
        status: 'completed',
        winner_id: winner.user_id,
        winner_name: winner.user_name,
        winner_notified: true,
      }, `?id=eq.${raffleId}`)
      return { userId: winner.user_id, userName: winner.user_name }
    },

    async setRaffleDrawToNextWednesday(raffleId: string): Promise<void> {
      const now = new Date()
      const nextWed = new Date(now)
      nextWed.setDate(now.getDate() + ((3 - now.getDay() + 7) % 7 || 7))
      nextWed.setHours(20, 0, 0, 0)
      await request('raffles', 'PATCH', { draw_date: nextWed.toISOString() }, `?id=eq.${raffleId}`)
    },

    // ── Flying Messages ───────────────────────────────────────
    async insertFlyingMessage(fromId: number, fromName: string, toId: number, content: string): Promise<FlyingMessage> {
      return request('flying_messages', 'POST', {
        from_user_id: fromId,
        from_user_name: fromName,
        to_user_id: toId,
        content,
        created_at: new Date().toISOString(),
      })
    },

    async fetchFlyingMessages(userId: number, since?: string): Promise<FlyingMessage[]> {
      const query = since
        ? `?to_user_id=eq.${userId}&created_at=gt.${since}&order=created_at.desc&limit=50`
        : `?to_user_id=eq.${userId}&order=created_at.desc&limit=50`
      return request('flying_messages', 'GET', null, query) || []
    },

    // ── Unlock Status ─────────────────────────────────────────
    async fetchUserUnlockStatus(userId: number): Promise<{
      grid_rows_unlocked: number
      filters_unlocked: boolean
      filters_unlocked_expires_at: string | null
      invisible_until: string | null
      channel_follow_unlock: boolean
    }> {
      const res = await request('users', 'GET', null, `?id=eq.${userId}&select=grid_rows_unlocked,filters_unlocked,filters_unlocked_expires_at,invisible_until,channel_follow_unlock&limit=1`)
      const user = res?.[0]
      return {
        grid_rows_unlocked: user?.grid_rows_unlocked || 2,
        filters_unlocked: user?.filters_unlocked || false,
        filters_unlocked_expires_at: user?.filters_unlocked_expires_at || null,
        invisible_until: user?.invisible_until || null,
        channel_follow_unlock: user?.channel_follow_unlock || false,
      }
    },

    async ensureFilterUnlock(userId: number): Promise<boolean> {
      const status = await this.fetchUserUnlockStatus(userId)
      if (!status.filters_unlocked) return false
      if (status.filters_unlocked_expires_at && new Date(status.filters_unlocked_expires_at) < new Date()) {
        // Expired - reset
        await request('users', 'PATCH', {
          filters_unlocked: false,
          filters_unlocked_expires_at: null,
        }, `?id=eq.${userId}`)
        return false
      }
      return true
    },
  }
}
