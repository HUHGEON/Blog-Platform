import moment from 'moment-timezone';

const KOREA_TIMEZONE = 'Asia/Seoul';

// 현재 한국 시간 반환
export const getKoreanTime = () => {
  return moment().tz(KOREA_TIMEZONE).toDate();
};

// 특정 날짜를 한국 시간으로 변환
export const toKoreanTime = (date) => {
  return moment(date).tz(KOREA_TIMEZONE).toDate();
};

// 한국 시간 문자열 포맷
export const formatKoreanTime = (date, format = 'YYYY-MM-DD HH:mm:ss') => {
  return moment(date).tz(KOREA_TIMEZONE).format(format);
};

export default {
  getKoreanTime,
  toKoreanTime,
  formatKoreanTime,
  KOREA_TIMEZONE
};