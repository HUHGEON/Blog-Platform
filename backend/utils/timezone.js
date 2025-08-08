import moment from 'moment-timezone';

const KOREA_TIMEZONE = 'Asia/Seoul';

export const getKoreanTime = () => {
  return moment.tz(KOREA_TIMEZONE).toDate();
};

export const toKoreanTime = (date) => {
  return moment(date).tz(KOREA_TIMEZONE).toDate();
};

export const formatKoreanTime = (date, format = 'YYYY-MM-DD HH:mm:ss') => {
  return moment(date).tz(KOREA_TIMEZONE).format(format);
};

export const formatKoreanTime12 = (date) => {
  return moment(date).tz(KOREA_TIMEZONE).format('A h시 mm분 ss초');
};

export default {
  getKoreanTime,
  toKoreanTime,
  formatKoreanTime,
  formatKoreanTime12,
  KOREA_TIMEZONE
};