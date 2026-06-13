// LMN Supabase Client — table name configured via factory, no hardcoding
import { createSupabaseClient, hasValidKey, insertFlyingMessage, fetchFlyingMessages, getActiveRaffle, createRaffle, buyRaffleTicket, startRaffleCountdown, drawRaffleWinner, completeRaffle, setRaffleDrawToNextWednesday, checkRealPhoto } from 'dating-core'
export { hasValidKey, insertFlyingMessage, fetchFlyingMessages, getActiveRaffle, createRaffle, buyRaffleTicket, startRaffleCountdown, drawRaffleWinner, completeRaffle, setRaffleDrawToNextWednesday, checkRealPhoto }
export { type DbUser, type Raffle, type FlyingMessage } from 'dating-core'

const TABLE_NAME = 'lmn_users'

const client = createSupabaseClient(TABLE_NAME)

export const {
  upsertUser,
  fetchNearby,
  setOnlineStatus,
  fetchGlobalUnlock,
  fetchUserUnlockStatus,
  setGridRowsUnlocked,
  setFiltersUnlocked,
  updateInvisibleStatus,
  updateRealPhotoStatus,
  fetchUserPhotoStatus,
  relockUserFeatures,
  ensureFilterUnlock,
} = client
