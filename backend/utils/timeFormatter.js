import moment from 'moment';

export const formatStoryTime = (date) => {
  const now = moment();
  const storyTime = moment(date);
  const diffMinutes = now.diff(storyTime, 'minutes');
  const diffHours = now.diff(storyTime, 'hours');

  if (diffMinutes < 60) {
    return `${diffMinutes}분전`;
  } else {
    return `${diffHours}시간전`;
  }
};