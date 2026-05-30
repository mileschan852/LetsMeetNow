// LMN-specific i18n wrapper
// Re-exports from dating-core with LMN app-specific overrides

export type { Lang } from 'dating-core/i18n'
export { tPref, tRole, tZodiac, getLangLabel } from 'dating-core/i18n'

import { t as coreT, mergeDict, type Lang } from 'dating-core/i18n'

const LMN_OVERRIDES: Partial<Record<Lang, Record<string, string>>> = {
  en: {
    title: 'LetsMeetNow',
    locationDesc: 'LetsMeetNow needs your location to show nearby people. Your location is only used to calculate distances.',
    membersOnly: 'Members Only',
    membersOnlyDesc: 'This app is exclusively for members of',
    openInGroup: 'Open in Telegram Group',
    openFromGroup: 'If you are already a member, open this app from inside the group.',
    clearUserConfirm: 'Clear @mileschan852 from database?',
    clearUserOk: '@mileschan852 removed!',
    clearUserFail: 'Failed to remove',
    unlockSelfDesc: 'Pay 100 ⭐ to unlock your profile',
  },
  tc: {
    title: 'LetsMeetNow',
    locationDesc: 'LetsMeetNow 需要你的位置來顯示附近的人。你的位置僅用於計算距離。',
    membersOnly: '僅限會員',
    membersOnlyDesc: '此應用僅供以下群組成員使用',
    openInGroup: '在 Telegram 群組中打開',
    openFromGroup: '如果您已是會員，請直接從群組內打開此應用。',
    clearUserConfirm: '從數據庫清除 @mileschan852？',
    clearUserOk: '@mileschan852 已移除！',
    clearUserFail: '移除失敗',
    unlockSelfDesc: '支付 100 ⭐ 解鎖你的資料',
  },
  sc: {
    title: 'LetsMeetNow',
    locationDesc: 'LetsMeetNow 需要你的位置来显示附近的人。你的位置仅用于计算距离。',
    membersOnly: '仅限会员',
    membersOnlyDesc: '此应用仅供以下群组成员使用',
    openInGroup: '在 Telegram 群组中打开',
    openFromGroup: '如果您已是会员，请直接从群组内打开此应用。',
    clearUserConfirm: '从数据库清除 @mileschan852？',
    clearUserOk: '@mileschan852 已移除！',
    clearUserFail: '移除失败',
    unlockSelfDesc: '支付 100 ⭐ 解锁你的资料',
  },
  ru: {
    title: 'LetsMeetNow',
    locationDesc: 'LetsMeetNow нужно ваше местоположение для показа людей рядом. Используется только для расчета расстояний.',
    membersOnly: 'Только для членов',
    membersOnlyDesc: 'Это приложение только для участников',
    openInGroup: 'Открыть в группе Telegram',
    openFromGroup: 'Если вы уже участник, откройте приложение из группы.',
    clearUserConfirm: 'Удалить @mileschan852 из базы?',
    clearUserOk: '@mileschan852 удален!',
    clearUserFail: 'Ошибка удаления',
    unlockSelfDesc: 'Заплатите 100 ⭐, чтобы разблокировать профиль',
  },
}

export function t(lang: Lang, key: string): string {
  return coreT(lang, key, LMN_OVERRIDES)
}

// Convenience: merge with overrides for components that need raw dict access
export function getDict(lang: Lang): Record<string, string> {
  return mergeDict(lang, LMN_OVERRIDES)
}
