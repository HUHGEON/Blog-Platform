import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  post_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true
  },
  comment_content: {
    type: String,
    required: [true, '댓글을 입력해 주세요'],
    trim: true,
    maxlength: [100, '댓글은 100글자 이하로 입력해 주세요']
  },
  comment_create_at: {
    type: Date,
    default: Date.now,  // UTC로 저장
    required: true
  },
  comment_update_time: {
    type: Date,
    default: null
  }
}, {
  collection: 'comments'
});

// 댓글 생성 후 게시글의 댓글 수와 사용자의 댓글 수 증가
commentSchema.post('save', async function() {
  const Post = mongoose.model('Post');
  const User = mongoose.model('User');
  
  // 게시글의 댓글 수 증가
  await Post.findByIdAndUpdate(this.post_id, {
    $inc: { post_comment_count: 1 }
  });
  
  // 댓글 작성자의 댓글 수 증가
  await User.findByIdAndUpdate(this.user_id, {
    $inc: { user_comment_count: 1 }
  });
});

// 댓글 삭제 후 게시글의 댓글 수와 사용자의 댓글 수 감소
commentSchema.post('findOneAndDelete', async function(doc) {
  if (doc) {
    const Post = mongoose.model('Post');
    const User = mongoose.model('User');
    
    // 게시글의 댓글 수 감소
    await Post.findByIdAndUpdate(doc.post_id, {
      $inc: { post_comment_count: -1 }
    });
    
    // 댓글 작성자의 댓글 수 감소
    await User.findByIdAndUpdate(doc.user_id, {
      $inc: { user_comment_count: -1 }
    });
  }
});

// 수정 시간 업데이트 미들웨어
commentSchema.pre('save', function(next) {
  if (!this.isNew && this.isModified('comment_content')) {
    this.comment_update_time = new Date(); // UTC로 저장
  }
  next();
});

export default mongoose.model('Comment', commentSchema);