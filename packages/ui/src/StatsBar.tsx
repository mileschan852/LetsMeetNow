import { type Lang } from 'dating-core'

// Core version — bump this in dating-core when shared code changes
// All apps show the same core version
export const CORE_VERSION = '18'

export interface StatsBarProps {
  lang: Lang
  isPremium: boolean
  gridRowsUnlocked: number
  channelFollowUnlock: number
  hasRealPhoto?: boolean
  appVersion: string
  children?: React.ReactNode
}

export function StatsBar({
  lang,
  isPremium,
  gridRowsUnlocked,
  channelFollowUnlock,
  hasRealPhoto,
  appVersion,
  children,
}: StatsBarProps) {
  const totalRows = 2 + (isPremium ? 1 : 0) + gridRowsUnlocked + channelFollowUnlock + (hasRealPhoto ? 1 : 0)
  const rowsLabel = lang === 'tc' ? '已解鎖行數' : lang === 'sc' ? '已解锁行数' : 'Rows'
  const version = `v${CORE_VERSION}.${appVersion}`

  return (
    <div className="px-3 pt-1 flex items-center gap-2 text-[10px] text-[#8E8E93]">
      <span className="text-[#FF6B35] font-bold whitespace-nowrap flex-shrink-0">
        {rowsLabel}: {totalRows}
      </span>
      <span className="text-[#2C2C2E]">|</span>
      <span className="text-[#5AC8FA] whitespace-nowrap">{version}</span>
      {children && (
        <>
          <span className="text-[#2C2C2E]">|</span>
          {children}
        </>
      )}
    </div>
  )
}
