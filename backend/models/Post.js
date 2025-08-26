import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, '제목을 입력해 주세요'],
    trim: true,
    maxlength: [50, '제목은 50글자 이하로 입력해 주세요']
  },
  post_content: {
    type: String,
    required: [true, '내용은 필수로 입력해 주세요']
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
    default: Date.now,  // 단순하게 UTC로 저장
    required: true
  },
  post_update_at: {
    type: Date,
    default: null
  },
  image_url: {
    type: String,
    default: null
  },
  // 형태소 분석된 키워드를 저장 (유사한 글 추천용)
  analyzed_keywords_text: {
    type: String,
    default: ''
  }
}, {
  collection: 'posts'
});

// 유사한 글 추천을 위한 단일 텍스트 인덱스 (analyzed_keywords_text에만 적용)
// MongoDB는 컬렉션당 하나의 텍스트 인덱스만 허용
postSchema.index({
  analyzed_keywords_text: 'text'
}, {
  name: 'analyzedKeywordsTextIndex'
});

// 조회수 증가 메서드
postSchema.methods.incrementViews = function() {
  this.post_view_count += 1;
  return this.save();
};

// 수정 시간 업데이트 미들웨어
postSchema.pre('save', function(next) {
  if (!this.isNew && this.isModified()) {
    this.post_update_at = new Date(); // UTC로 저장
  }
  next();
});

export default mongoose.model('Post', postSchema);
