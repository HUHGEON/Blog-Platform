import express from 'express';
import Like from '../models/Like.js';
import Post from '../models/Post.js';
import { authenticateToken } from '../middlewares/auth.js';
import HTTP_STATUS from '../constants/httpStatusCodes.js';

const router = express.Router();

// 좋아요 (추가/취소)
router.post('/like', authenticateToken, async (req, res) => {
  try {
    const { post_id } = req.body;
    const user_id = req.user.id;

    // post_id 검증
    if (!post_id) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: '게시글 ID를 입력해주세요'
      });
    }

    // MongoDB ObjectId 형식 검증
    if (!post_id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: '올바르지 않은 게시글 ID 형식입니다'
      });
    }

    // 게시글 존재 여부 확인
    const post = await Post.findById(post_id);
    if (!post) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: '존재하지 않는 게시글입니다'
      });
    }

    // 좋아요 토글 실행 (Like 모델의 toggleLike 메서드 활용)
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
        current_like_count: updatedPost.post_like_count,
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

// 특정 게시글의 좋아요 상태 확인 (로그인한 사용자용)
router.get('/status/:postId', authenticateToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const user_id = req.user.id;

    // MongoDB ObjectId 형식 검증
    if (!postId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: '올바르지 않은 게시글 ID 형식입니다'
      });
    }

    // 좋아요 상태 확인 (Like 모델의 isLikedByUser 메서드 활용)
    const isLiked = await Like.isLikedByUser(user_id, postId);

    // 게시글 좋아요 수 조회
    const post = await Post.findById(postId).select('post_like_count');
    if (!post) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: '존재하지 않는 게시글입니다'
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: '좋아요 상태 조회 성공',
      data: {
        post_id: postId,
        is_liked: isLiked,
        like_count: post.post_like_count
      }
    });

  } catch (error) {
    console.error('좋아요 상태 조회 에러:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '서버 오류가 발생했습니다'
    });
  }
});

export default router;