import mongoose from 'mongoose';

const likeSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  post_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true
  }
}, {
  collection: 'likes'
});

// 한 사용자가 같은 게시글에 중복 좋아요 방지
likeSchema.index({ user_id: 1, post_id: 1 }, { unique: true });

// 좋아요 토글 기능을 위한 정적 메서드
likeSchema.statics.toggleLike = async function(userId, postId) {
  const Post = mongoose.model('Post');
  const User = mongoose.model('User');
  
  try {
    // 기존 좋아요 확인
    const existingLike = await this.findOne({ user_id: userId, post_id: postId });
    
    if (existingLike) {
      // 좋아요 취소
      await this.findOneAndDelete({ user_id: userId, post_id: postId });
      
      // 게시글의 좋아요 수 감소
      const post = await Post.findByIdAndUpdate(postId, {
        $inc: { post_like_count: -1 }
      });
      
      // 게시글 작성자의 받은 좋아요 수 감소
      if (post) {
        await User.findByIdAndUpdate(post.user_id, {
          $inc: { user_like_count: -1 }
        });
      }
      
      return { action: 'unliked'};
      
    } else {
      // 좋아요 추가
      await this.create({ user_id: userId, post_id: postId });
      
      // 게시글의 좋아요 수 증가
      const post = await Post.findByIdAndUpdate(postId, {
        $inc: { post_like_count: 1 }
      });
      
      // 게시글 작성자의 받은 좋아요 수 증가
      if (post) {
        await User.findByIdAndUpdate(post.user_id, {
          $inc: { user_like_count: 1 }
        });
      }
      
      return { action: 'liked'};
    }
  } catch (error) {
    throw new Error('좋아요 처리 중 오류가 발생하였습니다');
  }
};

// 사용자가 특정 게시글에 좋아요 했는지 확인하는 정적 메서드
likeSchema.statics.isLikedByUser = async function(userId, postId) {
  const like = await this.findOne({ user_id: userId, post_id: postId });
  return !!like; // boolean 반환
};

export default mongoose.model('Like', likeSchema);