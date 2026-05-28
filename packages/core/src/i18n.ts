// ─── Internationalization ───────────────────────────────────────────

import type { Lang } from './types'

export const DEFAULT_LANG: Lang = 'en'

export function t(lang: Lang, key: string): string {
  return TRANSLATIONS[key]?.[lang] || TRANSLATIONS[key]?.[DEFAULT_LANG] || key
}

export function getLangLabel(lang: Lang): string {
  const labels: Record<Lang, string> = {
    en: 'English', tc: '繁體中文', sc: '简体中文',
    ru: 'Русский', ja: '日本語', ko: '한국어',
    de: 'Deutsch', fr: 'Français', es: 'Español',
    th: 'ไทย', vi: 'Tiếng Việt',
  }
  return labels[lang] || lang
}

const TRANSLATIONS: Record<string, Record<Lang, string>> = {
  // Grid / Navigation
  nearby: {
    en: 'Nearby', tc: '附近', sc: '附近', ru: 'Рядом', ja: '近く', ko: '근처',
    de: 'In der Nähe', fr: 'Proche', es: 'Cerca', th: 'ใกล้เคียง', vi: 'Gần đây',
  },
  active1h: {
    en: 'Active 1h', tc: '1小時內活躍', sc: '1小时内活跃', ru: 'Активны 1ч', ja: '1時間以内', ko: '1시간 내',
    de: 'Aktiv 1h', fr: 'Actif 1h', es: 'Activo 1h', th: 'ใช้งาน 1ชม.', vi: 'Hoạt động 1h',
  },
  refresh: {
    en: 'Refresh', tc: '刷新', sc: '刷新', ru: 'Обновить', ja: '更新', ko: '새로고침',
    de: 'Aktualisieren', fr: 'Actualiser', es: 'Actualizar', th: 'รีเฟรช', vi: 'Làm mới',
  },
  unlock: {
    en: 'Unlock', tc: '解鎖', sc: '解锁', ru: 'Разблокировать', ja: 'ロック解除', ko: '잠금 해제',
    de: 'Freischalten', fr: 'Déverrouiller', es: 'Desbloquear', th: 'ปลดล็อค', vi: 'Mở khóa',
  },
  unlocked: {
    en: 'Unlocked', tc: '已解鎖', sc: '已解锁', ru: 'Разблокировано', ja: '解除済み', ko: '해제됨',
    de: 'Freigeschaltet', fr: 'Déverrouillé', es: 'Desbloqueado', th: 'ปลดล็อคแล้ว', vi: 'Đã mở khóa',
  },
  lock: {
    en: 'Lock', tc: '鎖定', sc: '锁定', ru: 'Заблокировать', ja: 'ロック', ko: '잠금',
    de: 'Sperren', fr: 'Verrouiller', es: 'Bloquear', th: 'ล็อค', vi: 'Khóa',
  },
  rows: {
    en: 'Rows', tc: '行數', sc: '行数', ru: 'Строк', ja: '行', ko: '행',
    de: 'Reihen', fr: 'Lignes', es: 'Filas', th: 'แถว', vi: 'Hàng',
  },

  // Profile
  profile: {
    en: 'Profile', tc: '個人資料', sc: '个人资料', ru: 'Профиль', ja: 'プロフィール', ko: '프로필',
    de: 'Profil', fr: 'Profil', es: 'Perfil', th: 'โปรไฟล์', vi: 'Hồ sơ',
  },
  editProfile: {
    en: 'Edit Profile', tc: '編輯個人資料', sc: '编辑个人资料', ru: 'Редактировать', ja: '編集', ko: '프로필 수정',
    de: 'Profil bearbeiten', fr: 'Modifier', es: 'Editar perfil', th: 'แก้ไขโปรไฟล์', vi: 'Chỉnh sửa',
  },
  name: {
    en: 'Name', tc: '名稱', sc: '名称', ru: 'Имя', ja: '名前', ko: '이름',
    de: 'Name', fr: 'Nom', es: 'Nombre', th: 'ชื่อ', vi: 'Tên',
  },
  age: {
    en: 'Age', tc: '年齡', sc: '年龄', ru: 'Возраст', ja: '年齢', ko: '나이',
    de: 'Alter', fr: 'Âge', es: 'Edad', th: 'อายุ', vi: 'Tuổi',
  },
  height: {
    en: 'Height', tc: '身高', sc: '身高', ru: 'Рост', ja: '身長', ko: '키',
    de: 'Größe', fr: 'Taille', es: 'Altura', th: 'ส่วนสูง', vi: 'Chiều cao',
  },
  weight: {
    en: 'Weight', tc: '體重', sc: '体重', ru: 'Вес', ja: '体重', ko: '몸무게',
    de: 'Gewicht', fr: 'Poids', es: 'Peso', th: 'น้ำหนัก', vi: 'Cân nặng',
  },
  bodyType: {
    en: 'Body Type', tc: '體型', sc: '体型', ru: 'Телосложение', ja: '体型', ko: '체형',
    de: 'Körpertyp', fr: 'Corps', es: 'Tipo de cuerpo', th: 'รูปร่าง', vi: 'Vóc dáng',
  },
  skinTone: {
    en: 'Skin Tone', tc: '膚色', sc: '肤色', ru: 'Тон кожи', ja: '肌色', ko: '피부톤',
    de: 'Hautton', fr: 'Teint', es: 'Tono de piel', th: 'สีผิว', vi: 'Màu da',
  },
  zodiac: {
    en: 'Zodiac', tc: '星座', sc: '星座', ru: 'Зодиак', ja: '星座', ko: '별자리',
    de: 'Tierkreis', fr: 'Zodiaque', es: 'Zodiaco', th: 'ราศี', vi: 'Cung hoàng đạo',
  },
  bio: {
    en: 'Bio', tc: '自我介紹', sc: '自我介绍', ru: 'О себе', ja: '自己紹介', ko: '소개',
    de: 'Bio', fr: 'Bio', es: 'Biografía', th: 'ประวัติ', vi: 'Giới thiệu',
  },
  into: {
    en: 'Into', tc: '喜好', sc: '喜好', ru: 'Интересы', ja: '趣味', ko: '취향',
    de: 'Interessen', fr: 'Intérêts', es: 'Intereses', th: 'สิ่งที่ชอบ', vi: 'Sở thích',
  },
  lookingFor: {
    en: 'Looking For', tc: '尋找', sc: '寻找', ru: 'Ищу', ja: '探している', ko: '찾는 것',
    de: 'Suche nach', fr: 'Recherche', es: 'Buscando', th: 'กำลังมองหา', vi: 'Tìm kiếm',
  },
  location: {
    en: 'Location', tc: '位置', sc: '位置', ru: 'Местоположение', ja: '位置', ko: '위치',
    de: 'Standort', fr: 'Lieu', es: 'Ubicación', th: 'ตำแหน่ง', vi: 'Vị trí',
  },
  distance: {
    en: 'Distance', tc: '距離', sc: '距离', ru: 'Расстояние', ja: '距離', ko: '거리',
    de: 'Entfernung', fr: 'Distance', es: 'Distancia', th: 'ระยะทาง', vi: 'Khoảng cách',
  },

  // Actions
  sendMessage: {
    en: 'Send Message', tc: '發送訊息', sc: '发送讯息', ru: 'Отправить', ja: 'メッセージ', ko: '메시지',
    de: 'Nachricht', fr: 'Message', es: 'Enviar', th: 'ส่งข้อความ', vi: 'Gửi tin',
  },
  chat: {
    en: 'Chat', tc: '聊天', sc: '聊天', ru: 'Чат', ja: 'チャット', ko: '채팅',
    de: 'Chat', fr: 'Chat', es: 'Chat', th: 'แชท', vi: 'Trò chuyện',
  },
  follow: {
    en: 'Follow', tc: '追蹤', sc: '追踪', ru: 'Подписаться', ja: 'フォロー', ko: '팔로우',
    de: 'Folgen', fr: 'Suivre', es: 'Seguir', th: 'ติดตาม', vi: 'Theo dõi',
  },
  unfollow: {
    en: 'Unfollow', tc: '取消追蹤', sc: '取消追踪', ru: 'Отписаться', ja: 'フォロー解除', ko: '언팔로우',
    de: 'Entfolgen', fr: 'Ne plus suivre', es: 'Dejar de seguir', th: 'เลิกติดตาม', vi: 'Bỏ theo dõi',
  },
  block: {
    en: 'Block', tc: '封鎖', sc: '封锁', ru: 'Заблокировать', ja: 'ブロック', ko: '차단',
    de: 'Blockieren', fr: 'Bloquer', es: 'Bloquear', th: 'บล็อค', vi: 'Chặn',
  },
  unblock: {
    en: 'Unblock', tc: '解除封鎖', sc: '解除封锁', ru: 'Разблокировать', ja: 'ブロック解除', ko: '차단 해제',
    de: 'Entblocken', fr: 'Débloquer', es: 'Desbloquear', th: 'ปลดบล็อค', vi: 'Bỏ chặn',
  },
  report: {
    en: 'Report', tc: '舉報', sc: '举报', ru: 'Пожаловаться', ja: '報告', ko: '신고',
    de: 'Melden', fr: 'Signaler', es: 'Reportar', th: 'รายงาน', vi: 'Báo cáo',
  },

  // Payments / Stars
  stars: {
    en: 'Stars', tc: '星星', sc: '星星', ru: 'Звёзды', ja: 'スター', ko: '별',
    de: 'Sterne', fr: 'Étoiles', es: 'Estrellas', th: 'ดาว', vi: 'Sao',
  },
  buyStars: {
    en: 'Buy Stars', tc: '購買星星', sc: '购买星星', ru: 'Купить звёзды', ja: 'スター購入', ko: '별 구매',
    de: 'Sterne kaufen', fr: 'Acheter', es: 'Comprar', th: 'ซื้อดาว', vi: 'Mua sao',
  },
  unlockFilters: {
    en: 'Unlock Filters', tc: '解鎖篩選', sc: '解锁筛选', ru: 'Разблокировать фильтры', ja: 'フィルター解除', ko: '필터 잠금 해제',
    de: 'Filter freischalten', fr: 'Déverrouiller filtres', es: 'Desbloquear filtros', th: 'ปลดล็อคตัวกรอง', vi: 'Mở khóa bộ lọc',
  },
  invisibleMode: {
    en: 'Invisible Mode', tc: '隱形模式', sc: '隐形模式', ru: 'Невидимый режим', ja: '透明モード', ko: '투명 모드',
    de: 'Unsichtbarer Modus', fr: 'Mode invisible', es: 'Modo invisible', th: 'โหมดล่องหน', vi: 'Chế độ ẩn',
  },
  raffleTicket: {
    en: 'Raffle Ticket', tc: '抽獎券', sc: '抽奖券', ru: 'Лотерейный билет', ja: '抽選券', ko: '추첨권',
    de: 'Los', fr: 'Ticket', es: 'Boleto', th: 'ตั๋วจับรางวัล', vi: 'Vé xổ số',
  },
  boostProfile: {
    en: 'Boost Profile', tc: '提升曝光', sc: '提升曝光', ru: 'Продвинуть', ja: 'ブースト', ko: '부스트',
    de: 'Profil boosten', fr: 'Booster', es: 'Impulsar', th: 'บูสต์โปรไฟล์', vi: 'Tăng cường',
  },
  price: {
    en: 'Price', tc: '價格', sc: '价格', ru: 'Цена', ja: '価格', ko: '가격',
    de: 'Preis', fr: 'Prix', es: 'Precio', th: 'ราคา', vi: 'Giá',
  },
  duration: {
    en: 'Duration', tc: '有效期', sc: '有效期', ru: 'Длительность', ja: '期間', ko: '기간',
    de: 'Dauer', fr: 'Durée', es: 'Duración', th: 'ระยะเวลา', vi: 'Thời hạn',
  },
  days: {
    en: 'days', tc: '天', sc: '天', ru: 'дней', ja: '日', ko: '일',
    de: 'Tage', fr: 'jours', es: 'días', th: 'วัน', vi: 'ngày',
  },

  // Status
  online: {
    en: 'Online', tc: '在線', sc: '在线', ru: 'Онлайн', ja: 'オンライン', ko: '온라인',
    de: 'Online', fr: 'En ligne', es: 'En línea', th: 'ออนไลน์', vi: 'Trực tuyến',
  },
  offline: {
    en: 'Offline', tc: '離線', sc: '离线', ru: 'Офлайн', ja: 'オフライン', ko: '오프라인',
    de: 'Offline', fr: 'Hors ligne', es: 'Desconectado', th: 'ออฟไลน์', vi: 'Ngoại tuyến',
  },
  recently: {
    en: 'Recently', tc: '最近', sc: '最近', ru: 'Недавно', ja: '最近', ko: '최근',
    de: 'Kürzlich', fr: 'Récemment', es: 'Recientemente', th: 'ล่าสุด', vi: 'Gần đây',
  },
  away: {
    en: 'Away', tc: '離開', sc: '离开', ru: 'Отошёл', ja: '離席', ko: '자리 비움',
    de: 'Abwesend', fr: 'Absent', es: 'Ausente', th: 'ไม่อยู่', vi: 'Vắng mặt',
  },

  // Misc
  save: {
    en: 'Save', tc: '儲存', sc: '储存', ru: 'Сохранить', ja: '保存', ko: '저장',
    de: 'Speichern', fr: 'Enregistrer', es: 'Guardar', th: 'บันทึก', vi: 'Lưu',
  },
  cancel: {
    en: 'Cancel', tc: '取消', sc: '取消', ru: 'Отмена', ja: 'キャンセル', ko: '취소',
    de: 'Abbrechen', fr: 'Annuler', es: 'Cancelar', th: 'ยกเลิก', vi: 'Hủy',
  },
  done: {
    en: 'Done', tc: '完成', sc: '完成', ru: 'Готово', ja: '完了', ko: '완료',
    de: 'Fertig', fr: 'Terminé', es: 'Hecho', th: 'เสร็จสิ้น', vi: 'Xong',
  },
  close: {
    en: 'Close', tc: '關閉', sc: '关闭', ru: 'Закрыть', ja: '閉じる', ko: '닫기',
    de: 'Schließen', fr: 'Fermer', es: 'Cerrar', th: 'ปิด', vi: 'Đóng',
  },
  back: {
    en: 'Back', tc: '返回', sc: '返回', ru: 'Назад', ja: '戻る', ko: '뒤로',
    de: 'Zurück', fr: 'Retour', es: 'Atrás', th: 'กลับ', vi: 'Quay lại',
  },
  loading: {
    en: 'Loading...', tc: '載入中...', sc: '载入中...', ru: 'Загрузка...', ja: '読み込み中...', ko: '로딩 중...',
    de: 'Laden...', fr: 'Chargement...', es: 'Cargando...', th: 'กำลังโหลด...', vi: 'Đang tải...',
  },
  error: {
    en: 'Error', tc: '錯誤', sc: '错误', ru: 'Ошибка', ja: 'エラー', ko: '오류',
    de: 'Fehler', fr: 'Erreur', es: 'Error', th: 'ข้อผิดพลาด', vi: 'Lỗi',
  },
  retry: {
    en: 'Retry', tc: '重試', sc: '重试', ru: 'Повторить', ja: '再試行', ko: '재시도',
    de: 'Wiederholen', fr: 'Réessayer', es: 'Reintentar', th: 'ลองใหม่', vi: 'Thử lại',
  },
  noResults: {
    en: 'No results', tc: '沒有結果', sc: '没有结果', ru: 'Нет результатов', ja: '結果なし', ko: '결과 없음',
    de: 'Keine Ergebnisse', fr: 'Aucun résultat', es: 'Sin resultados', th: 'ไม่มีผลลัพธ์', vi: 'Không có kết quả',
  },
}

// ─── Zodiac ─────────────────────────────────────────────────────────

export const ZODIAC_SIGNS = [
  { name: 'Aries', emoji: '♈' },
  { name: 'Taurus', emoji: '♉' },
  { name: 'Gemini', emoji: '♊' },
  { name: 'Cancer', emoji: '♋' },
  { name: 'Leo', emoji: '♌' },
  { name: 'Virgo', emoji: '♍' },
  { name: 'Libra', emoji: '♎' },
  { name: 'Scorpio', emoji: '♏' },
  { name: 'Sagittarius', emoji: '♐' },
  { name: 'Capricorn', emoji: '♑' },
  { name: 'Aquarius', emoji: '♒' },
  { name: 'Pisces', emoji: '♓' },
] as const

export function getZodiac(birthDate: string): string {
  const date = new Date(birthDate)
  const month = date.getMonth() + 1
  const day = date.getDate()

  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'Aries'
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'Taurus'
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'Gemini'
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'Cancer'
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'Leo'
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'Virgo'
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'Libra'
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'Scorpio'
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'Sagittarius'
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 'Capricorn'
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'Aquarius'
  return 'Pisces'
}

export function getZodiacEmoji(zodiac: string): string {
  return ZODIAC_SIGNS.find(z => z.name === zodiac)?.emoji || '✨'
}

export function getAge(birthDate: string): number {
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}
