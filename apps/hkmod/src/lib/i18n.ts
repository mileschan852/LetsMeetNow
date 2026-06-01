// HKMOD-specific i18n wrapper
// Re-exports from dating-core with HKMOD app-specific overrides

export type { Lang } from 'dating-core/i18n'
export { getLangLabel } from 'dating-core/i18n'

import { t as coreT, mergeDict, type Lang } from 'dating-core/i18n'

const HKMOD_OVERRIDES: Partial<Record<Lang, Record<string, string>>> = {
  en: {
    title: 'HKMOD',
    locationDesc: 'HKMOD needs your location to show nearby members. Your location is only used to calculate distances.',
    membersOnly: 'Members Only',
    membersOnlyDesc: 'This app is exclusively for members of',
    openInGroup: 'Open in Telegram Group',
    openFromGroup: 'If you are already a member, open this app from inside the group (forum topic).',
    clearUserConfirm: 'Clear @mileschan852 from database?',
    clearUserOk: '@mileschan852 removed!',
    clearUserFail: 'Failed to remove',
    unlockSelfDesc: 'Pay 100 ⭐ to unlock your profile filters',
    findingMembers: 'Finding nearby members...',
    moreNearby: 'more nearby',
    dbNotConfigured: 'Database not configured',
    dbConfigHint: 'Set VITE_SUPABASE_ANON_KEY env var to see nearby users.',
    // preference keys
    safe: 'Safe',
    raw: 'Raw',
    clean: 'Clean',
    party: 'Party',
    partyCheck: 'Party✓',
    oneOnOne: '1on1',
    group: 'Group',
    host: 'Host',
    travel: 'Travel',
    outdoor: 'Outdoor',
    sauna: 'Sauna',
    // role keys
    bottom0: '0 (Bottom)',
    top1: '1 (Top)',
    role: 'Role',
    allRoles: 'All',
  },
  tc: {
    title: 'HKMOD',
    locationDesc: 'HKMOD 需要你的位置來顯示附近成員。你的位置僅用於計算距離。',
    membersOnly: '僅限會員',
    membersOnlyDesc: '此應用僅供以下群組成員使用',
    openInGroup: '在 Telegram 群組中打開',
    openFromGroup: '如果您已是會員，請直接從群組內打開此應用。',
    clearUserConfirm: '從數據庫清除 @mileschan852？',
    clearUserOk: '@mileschan852 已移除！',
    clearUserFail: '移除失敗',
    unlockSelfDesc: '支付 100 ⭐ 解鎖你的資料過濾器',
    findingMembers: '尋找附近成員...',
    moreNearby: '更多附近用戶',
    dbNotConfigured: '數據庫未配置',
    dbConfigHint: '設置 VITE_SUPABASE_ANON_KEY 環境變量以查看附近用戶。',
    safe: '安全',
    raw: '無套',
    clean: '不用藥',
    party: '嗨',
    partyCheck: '有貨嗨',
    oneOnOne: '一對一',
    group: '多人',
    host: '有地',
    travel: '無地',
    outdoor: '戶外',
    sauna: '桑拿',
    bottom0: '0 (受方)',
    top1: '1 (攻方)',
    role: '角色',
    allRoles: '所有',
  },
  sc: {
    title: 'HKMOD',
    locationDesc: 'HKMOD 需要你的位置来显示附近成员。你的位置仅用于计算距离。',
    membersOnly: '仅限会员',
    membersOnlyDesc: '此应用仅供以下群组成员使用',
    openInGroup: '在 Telegram 群组中打开',
    openFromGroup: '如果您已是会员，请直接从群组内打开此应用。',
    clearUserConfirm: '从数据库清除 @mileschan852？',
    clearUserOk: '@mileschan852 已移除！',
    clearUserFail: '移除失败',
    unlockSelfDesc: '支付 100 ⭐ 解锁你的资料过滤器',
    findingMembers: '寻找附近成员...',
    moreNearby: '更多附近用户',
    dbNotConfigured: '数据库未配置',
    dbConfigHint: '设置 VITE_SUPABASE_ANON_KEY 环境变量以查看附近用户。',
    safe: '安全',
    raw: '无套',
    clean: '不用药',
    party: '嗨',
    partyCheck: '有货嗨',
    oneOnOne: '一对一',
    group: '群组',
    host: '有地',
    travel: '无地',
    outdoor: '户外',
    sauna: '桑拿',
    bottom0: '0 (受方)',
    top1: '1 (攻方)',
    role: '角色',
    allRoles: '所有',
  },
  ru: {
    title: 'HKMOD',
    locationDesc: 'HKMOD нужно ваше местоположение для показа участников рядом. Используется только для расчета расстояний.',
    membersOnly: 'Только для членов',
    membersOnlyDesc: 'Это приложение только для участников',
    openInGroup: 'Открыть в группе Telegram',
    openFromGroup: 'Если вы уже участник, откройте приложение из группы.',
    clearUserConfirm: 'Удалить @mileschan852 из базы?',
    clearUserOk: '@mileschan852 удален!',
    clearUserFail: 'Ошибка удаления',
    unlockSelfDesc: 'Заплатите 100 ⭐, чтобы разблокировать фильтры',
    findingMembers: 'Поиск участников...',
    moreNearby: 'больше рядом',
    dbNotConfigured: 'База данных не настроена',
    dbConfigHint: 'Установите VITE_SUPABASE_ANON_KEY для просмотра пользователей.',
    safe: 'Безопасно',
    raw: 'Без презерватива',
    clean: 'Чистый',
    party: 'Туса',
    partyCheck: 'Туса+',
    oneOnOne: '1на1',
    group: 'Группа',
    host: 'Есть место',
    travel: 'Без места',
    outdoor: 'На улице',
    sauna: 'Сауна',
    bottom0: '0 (Нижний)',
    top1: '1 (Верхний)',
    role: 'Роль',
    allRoles: 'Все',
  },
}

export function t(lang: Lang, key: string): string {
  return coreT(lang, key, HKMOD_OVERRIDES)
}

// Convenience: merge with overrides for components that need raw dict access
export function getDict(lang: Lang): Record<string, string> {
  return mergeDict(lang, HKMOD_OVERRIDES)
}

// Preference value → translation key mapping (HKMOD-specific)
const prefKeyMap: Record<string, string> = {
  'Safe': 'safe',
  'Raw': 'raw',
  'Clean': 'clean',
  'Party': 'party',
  'Party✓': 'partyCheck',
  '1on1': 'oneOnOne',
  'Group': 'group',
  'Host': 'host',
  'Travel': 'travel',
  'Outdoor': 'outdoor',
  'Sauna': 'sauna',
  'All': 'all',
}

export function tPref(lang: Lang, value: string): string {
  const key = prefKeyMap[value]
  if (!key) return value
  return t(lang, key)
}

export function tZodiac(_lang: Lang, sign: string): string {
  return sign
}
