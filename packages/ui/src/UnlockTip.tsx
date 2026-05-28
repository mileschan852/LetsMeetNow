import { useState, useEffect } from 'react'
import type { Lang } from 'dating-core/types'

export interface UnlockTipProps {
  lang: Lang
  gridRows: number
  channelFollowUnlock: number
  onClaimChannelFollow: () => void
}

export function UnlockTip({ lang, gridRows, channelFollowUnlock, onClaimChannelFollow }: UnlockTipProps) {
  const [idx, setIdx] = useState(0)

  const tips: Record<string, string[]> = {
    en: [
      'Base: 2 rows free',
      'Add a Telegram photo +1',
      'Boost @LetsMeetNowApp +1~4',
      '⭐ = charge stars per message',
      channelFollowUnlock ? 'Channel: +1 ✅' : 'Join @LetsMeetNowApp +1',
      'Buy rows with ⭐ Stars',
    ],
    tc: [
      '基本：免費2行',
      '加入 Telegram 照片 +1',
      '宣傳 @LetsMeetNowApp +1~4',
      '⭐ = 按訊息收費',
      channelFollowUnlock ? '頻道：+1 ✅' : '加入 @LetsMeetNowApp +1',
      '用 ⭐ Stars 購買行數',
    ],
    sc: [
      '基本：免费2行',
      '加入 Telegram 照片 +1',
      '宣传 @LetsMeetNowApp +1~4',
      '⭐ = 按消息收费',
      channelFollowUnlock ? '频道：+1 ✅' : '加入 @LetsMeetNowApp +1',
      '用 ⭐ Stars 购买行数',
    ],
  }

  const list = tips[lang] || tips.en

  useEffect(() => {
    const timer = setInterval(() => setIdx(i => (i + 1) % list.length), 3000)
    return () => clearInterval(timer)
  }, [list.length])

  return (
    <span
      className="text-[#8E8E93] cursor-pointer hover:text-[#FF6B35] transition-colors"
      onClick={onClaimChannelFollow}
    >
      {list[idx]}
    </span>
  )
}
