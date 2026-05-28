// HKMOD Bot — Cloudflare Worker
// Handles Telegram webhook + invoice creation + Stars payments
// ══════════════════════════════════════════════════════════════════════

const BOT_TOKEN    = (typeof BOT_TOKEN !== 'undefined') ? BOT_TOKEN : ''
const SUPABASE_URL = (typeof SUPABASE_URL !== 'undefined') ? SUPABASE_URL : ''
const SUPABASE_KEY = (typeof SUPABASE_KEY !== 'undefined') ? SUPABASE_KEY : ''
const TG_API       = `https://api.telegram.org/bot${BOT_TOKEN}`
const MINI_APP_URL = 'https://mileschan852.github.io/HKMO_D_Bot/'

const ADMIN_IDS = [1231127407, 6837870949]

const SB_HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
}

// ─── Helpers ─────────────────────────────────────────────────────────

async function tg(method, body = {}) {
  const res = await fetch(`${TG_API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function sb(table, method = 'GET', body = null, query = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query}`
  const opts = { method, headers: SB_HEADERS }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(url, opts)
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`SB ${method} ${table} ${res.status}: ${txt.slice(0,200)}`)
  }
  if (res.status === 204) return null
  return res.json()
}

function isAdmin(u) {
  return ADMIN_IDS.includes(u?.id)
}

// ─── Invoice creation ────────────────────────────────────────────────

async function createInvoice(type, userId) {
  const items = {
    raffle:     { title: 'Raffle Ticket',     desc: 'Enter the HKMOD raffle draw',           price: 50,   payload: { type: 'raffle', userId } },
    filters:    { title: 'Filter Unlock',     desc: 'Unlock advanced filters for 30 days',   price: 300,  payload: { type: 'filters', userId } },
    invisible:  { title: 'Invisible Mode',      desc: 'Browse invisibly for 30 days',           price: 2000, payload: { type: 'invisible', userId } },
    grid:       { title: 'Grid Row Unlock',   desc: 'Unlock 5 more grid rows',                price: 100,  payload: { type: 'grid', userId } },
  }
  const item = items[type]
  if (!item) return null

  const res = await tg('createInvoiceLink', {
    title: item.title,
    description: item.desc,
    payload: JSON.stringify(item.payload),
    provider_token: '',               // empty = Telegram Stars
    currency: 'XTR',
    prices: [{ label: item.title, amount: item.price }],
  })
  return res.ok ? res.result : null
}

// ─── Payment handlers ────────────────────────────────────────────────

async function handlePreCheckout(query) {
  // Always approve Stars pre-checkout; payload validation is lightweight
  await tg('answerPreCheckoutQuery', {
    pre_checkout_query_id: query.id,
    ok: true,
  })
}

async function handleSuccessfulPayment(payment) {
  const payload = JSON.parse(payment.invoice_payload || '{}')
  const userId  = payload.userId
  const type    = payload.type
  const amount  = payment.total_amount

  if (!userId || !type) {
    console.error('Missing payload', payload)
    return
  }

  try {
    switch (type) {
      case 'raffle': {
        // Find active raffle
        const raffles = await sb('raffles', 'GET', null, '?status=eq.active&limit=1')
        const raffle = raffles?.[0]
        if (!raffle) {
          await tg('sendMessage', { chat_id: userId, text: '❌ No active raffle right now.' })
          return
        }
        // Insert ticket
        await sb('raffle_tickets', 'POST', {
          raffle_id: raffle.id,
          user_id: userId,
          user_name: payment.from?.first_name || 'User',
          purchased_at: new Date().toISOString(),
        })
        // Increment counter
        await sb('raffles', 'PATCH', { current_tickets: (raffle.current_tickets || 0) + 1 }, `?id=eq.${raffle.id}`)

        // Auto-complete if target reached
        if ((raffle.current_tickets || 0) + 1 >= raffle.target_tickets) {
          await drawWinner(raffle.id)
        } else {
          await tg('sendMessage', { chat_id: userId, text: `🎟️ Ticket bought! ${raffle.current_tickets + 1}/${raffle.target_tickets} sold.` })
        }
        break
      }

      case 'filters': {
        const until = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        await sb('users', 'PATCH', {
          filters_unlocked: true,
          filters_unlocked_expires_at: until,
          filters_unlocked_at: new Date().toISOString(),
        }, `?id=eq.${userId}`)
        await tg('sendMessage', { chat_id: userId, text: '🔓 Filters unlocked for 30 days!' })
        break
      }

      case 'invisible': {
        const until = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        await sb('users', 'PATCH', {
          invisible_until: until,
          invisible_purchased_at: new Date().toISOString(),
        }, `?id=eq.${userId}`)
        await tg('sendMessage', { chat_id: userId, text: '👁️‍🗨️ Invisible mode active for 30 days!' })
        break
      }

      case 'grid': {
        // Read current rows
        const users = await sb('users', 'GET', null, `?id=eq.${userId}&select=grid_rows_unlocked`)
        const current = users?.[0]?.grid_rows_unlocked || 2
        await sb('users', 'PATCH', { grid_rows_unlocked: current + 5 }, `?id=eq.${userId}`)
        await tg('sendMessage', { chat_id: userId, text: `➕ Grid rows unlocked: ${current + 5} rows total.` })
        break
      }
    }
  } catch (err) {
    console.error('Payment fulfillment error:', err)
    await tg('sendMessage', { chat_id: userId, text: '⚠️ Payment received but fulfilment failed. Contact admin.' })
  }
}

// ─── Raffle draw ─────────────────────────────────────────────────────

async function drawWinner(raffleId) {
  try {
    // Get all tickets for this raffle
    const tickets = await sb('raffle_tickets', 'GET', null, `?raffle_id=eq.${raffleId}`)
    if (!tickets || tickets.length === 0) {
      await sb('raffles', 'PATCH', { status: 'completed', winner_id: null, winner_name: 'No tickets sold' }, `?id=eq.${raffleId}`)
      return
    }
    const winner = tickets[Math.floor(Math.random() * tickets.length)]
    await sb('raffles', 'PATCH', {
      status: 'completed',
      winner_id: winner.user_id,
      winner_name: winner.user_name,
      winner_notified: true,
    }, `?id=eq.${raffleId}`)

    // Apply prize
    const raffle = await sb('raffles', 'GET', null, `?id=eq.${raffleId}&select=prize_type`)
    const prizeType = raffle?.[0]?.prize_type
    if (prizeType === 'filters') {
      const until = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      await sb('users', 'PATCH', { filters_unlocked: true, filters_unlocked_expires_at: until }, `?id=eq.${winner.user_id}`)
    } else if (prizeType === 'invisible') {
      const until = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      await sb('users', 'PATCH', { invisible_until: until }, `?id=eq.${winner.user_id}`)
    }

    await tg('sendMessage', {
      chat_id: winner.user_id,
      text: `🎉 You won the raffle! Prize: ${prizeType} unlocked.`,
    })
  } catch (err) {
    console.error('Draw winner error:', err)
  }
}

// ─── Bot commands ────────────────────────────────────────────────────

async function handleCommand(msg) {
  const text = msg.text || ''
  const chatId = msg.chat.id
  const user   = msg.from

  if (text === '/start') {
    await tg('sendMessage', {
      chat_id: chatId,
      text: 'Welcome to HKMOD 🏳️‍🌈',
      reply_markup: {
        inline_keyboard: [[
          { text: 'Open HKMOD', web_app: { url: MINI_APP_URL } }
        ]]
      }
    })
    return
  }

  if (!isAdmin(user)) return

  if (text.startsWith('/raffle')) {
    const prize = text.split(' ')[1] || 'filters'
    const raffles = await sb('raffles', 'GET', null, '?status=eq.active&limit=1')
    if (raffles?.[0]) {
      await tg('sendMessage', { chat_id: chatId, text: 'Active raffle already exists.' })
      return
    }
    const newRaffle = await sb('raffles', 'POST', {
      prize_type: prize,
      status: 'active',
      target_tickets: 20,
      current_tickets: 0,
    })
    await tg('sendMessage', { chat_id: chatId, text: `✅ Raffle created: ${prize} (target: 20 tickets)` })
    return
  }

  if (text === '/draw') {
    const raffles = await sb('raffles', 'GET', null, '?status=eq.active&limit=1')
    const raffle = raffles?.[0]
    if (!raffle) {
      await tg('sendMessage', { chat_id: chatId, text: 'No active raffle.' })
      return
    }
    await drawWinner(raffle.id)
    await tg('sendMessage', { chat_id: chatId, text: `🏆 Winner drawn for raffle #${raffle.id}` })
    return
  }

  if (text === '/stats') {
    const raffles = await sb('raffles', 'GET', null, '?status=eq.active&limit=1')
    const raffle = raffles?.[0]
    if (!raffle) {
      await tg('sendMessage', { chat_id: chatId, text: 'No active raffle.' })
      return
    }
    const tickets = await sb('raffle_tickets', 'GET', null, `?raffle_id=eq.${raffle.id}`)
    const lines = tickets?.map((t, i) => `${i+1}. ${t.user_name || 'User'} (${t.user_id})`) || []
    await tg('sendMessage', {
      chat_id: chatId,
      text: `🎟️ Raffle #${raffle.id} — ${raffle.current_tickets}/${raffle.target_tickets}\n${lines.join('\n') || 'No tickets yet'}`,
    })
    return
  }
}

// ─── Webhook handler ─────────────────────────────────────────────────

async function handleUpdate(update) {
  if (update.pre_checkout_query) {
    await handlePreCheckout(update.pre_checkout_query)
    return
  }
  if (update.message?.successful_payment) {
    await handleSuccessfulPayment(update.message)
    return
  }
  if (update.message?.text?.startsWith('/')) {
    await handleCommand(update.message)
    return
  }
}

// ─── Worker fetch ────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const path = url.pathname

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    // ── Invoice creation API ──────────────────────────────────────
    if (path === '/api/create-invoice' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}))
      const invoiceUrl = await createInvoice(body.type, body.userId)
      if (!invoiceUrl) {
        return new Response(JSON.stringify({ error: 'Failed to create invoice' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        })
      }
      return new Response(JSON.stringify({ url: invoiceUrl }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    // ── Telegram webhook ──────────────────────────────────────────
    if (path === '/webhook' && request.method === 'POST') {
      const update = await request.json()
      ctx.waitUntil(handleUpdate(update))
      return new Response('OK', { status: 200 })
    }

    // ── Health check ──────────────────────────────────────────────
    if (path === '/' || path === '/health') {
      return new Response(JSON.stringify({ ok: true, bot: 'HKMOD' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response('Not found', { status: 404 })
  }
}
