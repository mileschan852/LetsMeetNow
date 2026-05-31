/**
 * LMN Webhook Server
 * Handles: Stars payments, admin commands, raffle management
 */

import { Bot, webhookCallback } from 'grammy'
import { createClient } from '@supabase/supabase-js'
import express from 'express'

const BOT_TOKEN = process.env.LMN_BOT_TOKEN!
const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!
const WEBAPP_URL = process.env.LMN_WEBAPP_URL! // GitHub Pages URL

// ─── Owner & Admin Config ────────────────────────────────────────────
// Owner is always admin, no need to add manually
const OWNER_ID = parseInt(process.env.LMN_OWNER_ID || '0')

// Hardcoded fallback admins (also in app_admins table)
const ADMIN_IDS = [5202742795, 725368127]
const ADMIN_USERNAMES = ['mileschan852', 'MilesChan852', 'HKMembersOnly', 'hkmembersonly']

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function fetchAppAdmins(): Promise<string[]> {
  try {
    const { data } = await supabase.from('app_admins').select('username').eq('app', 'lmn')
    return (data || []).map(r => r.username.toLowerCase())
  } catch {
    return []
  }
}

async function isAdmin(ctx: any): Promise<boolean> {
  const user = ctx.from
  if (!user) return false
  // Owner always admin
  if (OWNER_ID && user.id === OWNER_ID) return true
  // Hardcoded IDs
  if (ADMIN_IDS.includes(user.id)) return true
  // Hardcoded usernames
  if (user.username && ADMIN_USERNAMES.includes(user.username.toLowerCase())) return true
  // Dynamic from DB
  const dbAdmins = await fetchAppAdmins()
  if (user.username && dbAdmins.includes(user.username.toLowerCase())) return true
  return false
}

function isOwner(ctx: any): boolean {
  const user = ctx.from
  if (!user) return false
  return OWNER_ID ? user.id === OWNER_ID : false
}

const PRICES = {
  invisible: { amount: 100, label: 'Invisible Mode (30 days)' },
  filters: { amount: 200, label: 'Unlock All Filters (30 days)' },
  grid3: { amount: 100, label: 'Unlock 3 Extra Rows (30 days)' },
  grid6: { amount: 150, label: 'Unlock 6 Extra Rows (30 days)' },
  raffle: { amount: 50, label: 'Raffle Ticket' },
}

const bot = new Bot(BOT_TOKEN)

bot.command('start', async (ctx) => {
  await ctx.reply('Welcome to Let\'s Meet Now 👋', {
    reply_markup: {
      inline_keyboard: [[
        { text: 'Open LMN 🚀', web_app: { url: WEBAPP_URL } }
      ]]
    }
  })
})

// ─── Admin Commands ────────────────────────────────────────────────────

// /addAdmin [username] — owner only
bot.command('addAdmin', async (ctx) => {
  if (!isOwner(ctx)) {
    await ctx.reply('❌ Only the bot owner can add admins.')
    return
  }
  const args = ctx.message?.text?.split(' ').slice(1)
  const username = args?.[0]?.replace(/^@/, '')
  if (!username) {
    await ctx.reply('Usage: /addAdmin <username>')
    return
  }
  const { error } = await supabase.from('app_admins').insert({
    app: 'lmn',
    username: username.toLowerCase(),
    added_by: ctx.from?.username || String(ctx.from?.id)
  })
  if (error) {
    if (error.message.includes('duplicate')) {
      await ctx.reply(`⚠️ @${username} is already an admin.`)
      return
    }
    await ctx.reply(`❌ Error: ${error.message}`)
    return
  }
  await ctx.reply(`✅ @${username} added as LMN admin.`)
})

// /deleteAdmin [username] — owner only
bot.command('deleteAdmin', async (ctx) => {
  if (!isOwner(ctx)) {
    await ctx.reply('❌ Only the bot owner can remove admins.')
    return
  }
  const args = ctx.message?.text?.split(' ').slice(1)
  const username = args?.[0]?.replace(/^@/, '')
  if (!username) {
    await ctx.reply('Usage: /deleteAdmin <username>')
    return
  }
  const { error } = await supabase.from('app_admins')
    .delete()
    .eq('app', 'lmn')
    .eq('username', username.toLowerCase())
  if (error) {
    await ctx.reply(`❌ Error: ${error.message}`)
    return
  }
  await ctx.reply(`✅ @${username} removed from LMN admins.`)
})

bot.command('raffle', async (ctx) => {
  if (!(await isAdmin(ctx))) return
  const args = ctx.message?.text?.split(' ').slice(1)
  const prizeType = args?.[0] as 'filters' | 'invisible' | undefined
  
  if (!prizeType || !['filters', 'invisible'].includes(prizeType)) {
    await ctx.reply('Usage: /raffle <filters|invisible>')
    return
  }
  
  const { data, error } = await supabase
    .from('lmn_raffles')
    .insert({ prize_type: prizeType, status: 'active', target_tickets: 20, tickets_sold: 0 })
    .select()
    .single()
  
  if (error) {
    await ctx.reply(`Error creating raffle: ${error.message}`)
    return
  }
  
  await ctx.reply(`🎫 New raffle created!\nID: ${data.id}\nPrize: ${prizeType}\nTickets needed: 20\nCost: 50 ⭐ each`)
})

bot.command('draw', async (ctx) => {
  if (!(await isAdmin(ctx))) return
  const args = ctx.message?.text?.split(' ').slice(1)
  const raffleId = parseInt(args?.[0] || '0')
  
  if (!raffleId) {
    await ctx.reply('Usage: /draw <raffle_id>')
    return
  }
  
  const { data, error } = await supabase.rpc('lmn_draw_raffle_winner', { p_raffle_id: raffleId })
  
  if (error) {
    await ctx.reply(`Error drawing winner: ${error.message}`)
    return
  }
  
  if (!data?.winner_id) {
    await ctx.reply('No tickets sold yet — no winner to draw.')
    return
  }
  
  await ctx.reply(`🎉 Winner drawn!\nWinner: ${data.winner_name || 'User ' + data.winner_id}\nRaffle #${raffleId} complete.`)
  
  try {
    await bot.api.sendMessage(data.winner_id, 
      `🎉 Congratulations! You won the raffle!\nPrize: ${data.prize_type === 'invisible' ? '30 days Invisible Mode' : '30 days Filter Unlock'}\nYour prize has been applied.`)
  } catch {}
})

bot.command('stats', async (ctx) => {
  if (!(await isAdmin(ctx))) return
  
  const { count: userCount } = await supabase.from('lmn_users').select('*', { count: 'exact', head: true })
  const { count: onlineCount } = await supabase.from('lmn_users').select('*', { count: 'exact', head: true }).eq('is_online', true)
  const { data: activeRaffle } = await supabase.from('lmn_raffles').select('*').eq('status', 'active').limit(1).single()
  
  let msg = `📊 LMN Stats\n👤 Total users: ${userCount || 0}\n🟢 Online now: ${onlineCount || 0}`
  
  if (activeRaffle) {
    msg += `\n🎫 Active raffle: ${activeRaffle.tickets_sold}/${activeRaffle.target_tickets} tickets sold`
  }
  
  await ctx.reply(msg)
})

// ─── Stars Payment Handler ───────────────────────────────────────────

bot.on('pre_checkout_query', async (ctx) => {
  await ctx.answerPreCheckoutQuery(true)
})

bot.on('message:successful_payment', async (ctx) => {
  const payment = ctx.message.successful_payment
  const userId = ctx.from.id
  const username = ctx.from.username || ctx.from.first_name
  
  if (!payment) return
  
  const payload = JSON.parse(payment.invoice_payload || '{}')
  const { type } = payload
  
  switch (type) {
    case 'invisible': {
      const until = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      await supabase.from('lmn_users').update({ 
        invisible_until: until,
        invisible_purchased_at: new Date().toISOString()
      }).eq('id', userId)
      await ctx.reply('✅ Invisible Mode activated for 30 days!')
      break
    }
    
    case 'filters': {
      const until = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      await supabase.from('lmn_users').update({ 
        filters_unlocked: true,
        filters_unlocked_expires_at: until
      }).eq('id', userId)
      await ctx.reply('✅ All filters unlocked for 30 days!')
      break
    }
    
    case 'grid3':
    case 'grid6': {
      const rows = type === 'grid3' ? 3 : 6
      await supabase.from('lmn_users').update({ grid_rows_unlocked: rows }).eq('id', userId)
      await ctx.reply(`✅ ${rows} extra grid rows unlocked for 30 days!`)
      break
    }
    
    case 'raffle': {
      const { error } = await supabase.rpc('lmn_buy_raffle_ticket', { 
        p_user_id: userId, 
        p_user_name: username 
      })
      
      if (error) {
        await ctx.reply(`❌ Error buying ticket: ${error.message}`)
        return
      }
      
      await ctx.reply('🎫 Raffle ticket purchased! Good luck!')
      break
    }
    
    default:
      await ctx.reply('✅ Payment received. Thank you!')
  }
})

// ─── Express Server ──────────────────────────────────────────────────

const app = express()
app.use(express.json())
app.use('/webhook', webhookCallback(bot, 'express'))

const PORT = process.env.LMN_PORT || 3001
app.listen(PORT, () => {
  console.log(`LMN webhook server running on port ${PORT}`)
})

export default app
