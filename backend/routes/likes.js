import express from 'express';
import Like from '../models/Like.js';
import Post from '../models/Post.js';
import { authenticateToken } from '../middlewares/auth.js';
import HTTP_STATUS from '../constants/httpStatusCodes.js';

const router = express.Router();

// 좋아요 (추가/취소)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { post_id } = req.body;
    const user_id = req.user.id;

    // 좋아요 토글 실행
    const result = await Like.toggleLike(user_id, post_id);

    // 업데이트된 게시글 정보 조회
    const updatedPost = await Post.findById(post_id).select('post_like_count');

    const message = result.action === 'liked' ? '좋아요를 눌렀습니다' : '좋아요를 취소했습니다';

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: message,
      data: {
        post_id: post_id,
        action: result.action,
        is_liked: result.action === 'liked'
      }
    });

  } catch (error) {
    console.error('좋아요 에러:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '서버 오류가 발생했습니다'
    });
  }
});

export default router;