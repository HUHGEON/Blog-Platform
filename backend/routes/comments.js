import express from 'express';
import Comment from '../models/Comment.js';
import Post from '../models/Post.js';
import User from '../models/User.js';
import { authenticateToken } from '../middlewares/auth.js';
import HTTP_STATUS from '../constants/httpStatusCodes.js';
import moment from 'moment-timezone';

const router = express.Router();

// 한국 시간 24시간 형식
const formatKoreanTime = (date) => {
  return moment(date).tz('Asia/Seoul').format('HH시 mm분 ss초');
};

// 댓글 작성
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { post_id, comment_content } = req.body;
    const userId = req.user.id;

    // 필수 필드 검증
    if (!post_id) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: '게시글 ID를 입력해주세요'
      });
    }

    if (!comment_content || comment_content.trim() === '') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: '댓글을 입력해 주세요'
      });
    }

    // 댓글 생성
    const newComment = new Comment({
      user_id: userId,
      post_id,
      comment_content: comment_content.trim()
    });

    await newComment.save();

    await User.findByIdAndUpdate(userId, {
      $inc: { user_comment_count: 1 }
    });

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: '댓글이 등록되었습니다',
      data: {
        id: newComment._id,
        comment_content: newComment.comment_content,
        comment_create_at: newComment.comment_create_at,
        created_at_display: formatKoreanTime(newComment.comment_create_at)
      }
    });

  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: messages.join(', ')
      });
    }

    console.error('댓글 작성 에러:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '서버 오류가 발생했습니다'
    });
  }
});

export default router;