import { supabase } from './supabase'

export async function insertFlyingMessage(userId: number, name: string, text: string) {
  const { error } = await supabase
    .from('flying_messages')
    .insert({ user_id: userId, name, text })
  if (error) throw error
}

export async function fetchFlyingMessages() {
  const { data, error } = await supabase
    .from('flying_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data || []
}

export async function buyRaffleTicket(userId: number, name: string, raffleId: string) {
  const { error } = await supabase
    .from('raffle_tickets')
    .insert({ user_id: userId, name, raffle_id: raffleId })
  if (error) throw error
}
