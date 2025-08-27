import mongoose from 'mongoose';

const storySchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: [true, '스토리 내용을 입력해 주세요'],
    trim: true,
    maxlength: [20, '스토리는 30글자 이하로 입력해 주세요']
  },
  image_url: {
    type: String,
    required: [true, '스토리 이미지를 업로드해주세요']
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  viewed_by: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    default: []
  }
}, {
  collection: 'stories'
});

storySchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });   //24시간이 지나면 자동 삭제

export default mongoose.model('Story', storySchema);
