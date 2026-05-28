import type { FilterConfig } from 'dating-core/types'

export const LMN_FILTERS: FilterConfig[] = [
  {
    key: 'gender',
    label: { en: 'Gender', tc: '性別', sc: '性别', ru: 'Пол', ja: '性別', ko: '성별' },
    options: [
      { value: 'male', label: { en: 'Male', tc: '男', sc: '男', ru: 'Мужчина', ja: '男性', ko: '남성' } },
      { value: 'female', label: { en: 'Female', tc: '女', sc: '女', ru: 'Женщина', ja: '女性', ko: '여성' } },
      { value: 'nonbinary', label: { en: 'Non-binary', tc: '非二元', sc: '非二元', ru: 'Небинарный', ja: 'ノンバイナリー', ko: '논바이너리' } },
    ],
  },
  {
    key: 'age',
    label: { en: 'Age', tc: '年齡', sc: '年龄', ru: 'Возраст', ja: '年齢', ko: '나이' },
    options: [
      { value: '18-25', label: { en: '18-25', tc: '18-25', sc: '18-25', ru: '18-25', ja: '18-25', ko: '18-25' } },
      { value: '26-35', label: { en: '26-35', tc: '26-35', sc: '26-35', ru: '26-35', ja: '26-35', ko: '26-35' } },
      { value: '36-50', label: { en: '36-50', tc: '36-50', sc: '36-50', ru: '36-50', ja: '36-50', ko: '36-50' } },
      { value: '50+', label: { en: '50+', tc: '50+', sc: '50+', ru: '50+', ja: '50+', ko: '50+' } },
    ],
  },
  {
    key: 'zodiac',
    label: { en: 'Zodiac', tc: '星座', sc: '星座', ru: 'Зодиак', ja: '星座', ko: '별자리' },
    options: [
      { value: 'Aries', label: { en: '♈ Aries', tc: '♈ 白羊座', sc: '♈ 白羊座', ru: '♈ Овен', ja: '♈ 牡羊座', ko: '♈ 양자리' } },
      { value: 'Taurus', label: { en: '♉ Taurus', tc: '♉ 金牛座', sc: '♉ 金牛座', ru: '♉ Телец', ja: '♉ 牡牛座', ko: '♉ 황소자리' } },
      { value: 'Gemini', label: { en: '♊ Gemini', tc: '♊ 雙子座', sc: '♊ 双子座', ru: '♊ Близнецы', ja: '♊ 双子座', ko: '♊ 쌍둥이자리' } },
      { value: 'Cancer', label: { en: '♋ Cancer', tc: '♋ 巨蟹座', sc: '♋ 巨蟹座', ru: '♋ Рак', ja: '♋ 蟹座', ko: '♋ 게자리' } },
      { value: 'Leo', label: { en: '♌ Leo', tc: '♌ 獅子座', sc: '♌ 狮子座', ru: '♌ Лев', ja: '♌ 獅子座', ko: '♌ 사자자리' } },
      { value: 'Virgo', label: { en: '♍ Virgo', tc: '♍ 處女座', sc: '♍ 处女座', ru: '♍ Дева', ja: '♍ 乙女座', ko: '♍ 처녀자리' } },
      { value: 'Libra', label: { en: '♎ Libra', tc: '♎ 天秤座', sc: '♎ 天秤座', ru: '♎ Весы', ja: '♎ 天秤座', ko: '♎ 천칭자리' } },
      { value: 'Scorpio', label: { en: '♏ Scorpio', tc: '♏ 天蠍座', sc: '♏ 天蝎座', ru: '♏ Скорпион', ja: '♏ 蠍座', ko: '♏ 전갈자리' } },
      { value: 'Sagittarius', label: { en: '♐ Sagittarius', tc: '♐ 射手座', sc: '♐ 射手座', ru: '♐ Стрелец', ja: '♐ 射手座', ko: '♐ 궁수자리' } },
      { value: 'Capricorn', label: { en: '♑ Capricorn', tc: '♑ 摩羯座', sc: '♑ 摩羯座', ru: '♑ Козерог', ja: '♑ 山羊座', ko: '♑ 염소자리' } },
      { value: 'Aquarius', label: { en: '♒ Aquarius', tc: '♒ 水瓶座', sc: '♒ 水瓶座', ru: '♒ Водолей', ja: '♒ 水瓶座', ko: '♒ 물병자리' } },
      { value: 'Pisces', label: { en: '♓ Pisces', tc: '♓ 雙魚座', sc: '♓ 双鱼座', ru: '♓ Рыбы', ja: '♓ 魚座', ko: '♓ 물고기자리' } },
    ],
  },
  {
    key: 'online',
    label: { en: 'Status', tc: '狀態', sc: '状态', ru: 'Статус', ja: 'ステータス', ko: '상태' },
    options: [
      { value: 'online', label: { en: '🟢 Online', tc: '🟢 在線', sc: '🟢 在线', ru: '🟢 Онлайн', ja: '🟢 オンライン', ko: '🟢 온라인' } },
      { value: 'recently', label: { en: '🟡 Recently', tc: '🟡 最近', sc: '🟡 最近', ru: '🟡 Недавно', ja: '🟡 最近', ko: '🟡 최근' } },
    ],
  },
]
