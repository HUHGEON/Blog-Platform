import mongoose from 'mongoose';
import { getKoreanTime } from '../utils/timezone.js';

const postSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, '제목은 필수입니다'],
    trim: true,
    maxlength: [50, '제목은 50글자 이하여야 합니다']
  },
  post_content: {
    type: String,
    required: [true, '내용은 필수입니다']
  },
  post_like_count: {
    type: Number,
    default: 0,
    min: 0
  },
  post_comment_count: {
    type: Number,
    default: 0,
    min: 0
  },
  post_view_count: {
    type: Number,
    default: 0,
    min: 0
  },
  post_create_at: {
    type: Date,
    default: getKoreanTime,
    required: true
  },
  post_update_at: {
    type: Date,
    default: null
  },
  image_url: {
    type: String,
    default: null
  }
}, {
  collection: 'posts'
});

postSchema.index({ 
  title: 'text', 
  post_content: 'text' 
}, {
  weights: {
    title: 10,
    post_content: 5
  }
});

// 조회수 증가 메서드
postSchema.methods.incrementViews = function() {
  this.post_view_count += 1;
  return this.save();
};

// 수정 시간 업데이트 미들웨어
postSchema.pre('save', function(next) {
  if (!this.isNew && this.isModified()) {
    this.post_update_at = getKoreanTime();
  }
  next();
});

export default mongoose.model('Post', postSchema);