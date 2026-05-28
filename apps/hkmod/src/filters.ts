export const HKMOD_FILTERS = [
  {
    key: 'role',
    label: { en: 'Role', tc: '角色', sc: '角色' },
    options: [
      { value: 'top', label: { en: 'Top', tc: '攻', sc: '攻' } },
      { value: 'bottom', label: { en: 'Bottom', tc: '受', sc: '受' } },
      { value: 'versatile', label: { en: 'Versatile', tc: '可攻可受', sc: '可攻可受' } },
    ],
  },
  {
    key: 'bodyType',
    label: { en: 'Body', tc: '體型', sc: '体型' },
    options: [
      { value: 'slim', label: { en: 'Slim', tc: '纖瘦', sc: '纤瘦' } },
      { value: 'average', label: { en: 'Average', tc: '標準', sc: '标准' } },
      { value: 'muscular', label: { en: 'Muscular', tc: '健美', sc: '健美' } },
      { value: 'chubby', label: { en: 'Chubby', tc: '豐滿', sc: '丰满' } },
    ],
  },
  {
    key: 'age',
    label: { en: 'Age', tc: '年齡', sc: '年龄' },
    options: [
      { value: '18-25', label: { en: '18-25', tc: '18-25', sc: '18-25' } },
      { value: '26-35', label: { en: '26-35', tc: '26-35', sc: '26-35' } },
      { value: '36-50', label: { en: '36-50', tc: '36-50', sc: '36-50' } },
      { value: '50+', label: { en: '50+', tc: '50+', sc: '50+' } },
    ],
  },
  {
    key: 'zodiac',
    label: { en: 'Zodiac', tc: '星座', sc: '星座' },
    options: [
      { value: 'Aries', label: { en: '♈ Aries', tc: '♈ 白羊座', sc: '♈ 白羊座' } },
      { value: 'Taurus', label: { en: '♉ Taurus', tc: '♉ 金牛座', sc: '♉ 金牛座' } },
      { value: 'Gemini', label: { en: '♊ Gemini', tc: '♊ 雙子座', sc: '♊ 双子座' } },
      { value: 'Cancer', label: { en: '♋ Cancer', tc: '♋ 巨蟹座', sc: '♋ 巨蟹座' } },
      { value: 'Leo', label: { en: '♌ Leo', tc: '♌ 獅子座', sc: '♌ 狮子座' } },
      { value: 'Virgo', label: { en: '♍ Virgo', tc: '♍ 處女座', sc: '♍ 处女座' } },
      { value: 'Libra', label: { en: '♎ Libra', tc: '♎ 天秤座', sc: '♎ 天秤座' } },
      { value: 'Scorpio', label: { en: '♏ Scorpio', tc: '♏ 天蠍座', sc: '♏ 天蝎座' } },
      { value: 'Sagittarius', label: { en: '♐ Sagittarius', tc: '♐ 射手座', sc: '♐ 射手座' } },
      { value: 'Capricorn', label: { en: '♑ Capricorn', tc: '♑ 摩羯座', sc: '♑ 摩羯座' } },
      { value: 'Aquarius', label: { en: '♒ Aquarius', tc: '♒ 水瓶座', sc: '♒ 水瓶座' } },
      { value: 'Pisces', label: { en: '♓ Pisces', tc: '♓ 雙魚座', sc: '♓ 双鱼座' } },
    ],
  },
];
