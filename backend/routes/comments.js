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

    // post_id 존재 여부 검증
    if (!post_id) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: '게시글 ID를 입력해주세요'
      });
    }

    // post_id 형식 검증 (DB 작업 전에!)
    if (!post_id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: '올바르지 않은 게시글 ID 형식입니다'
      });
    }

    // 댓글 내용 검증
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

    // 사용자 댓글 수 증가
    await User.findByIdAndUpdate(userId, {
      $inc: { user_comment_count: 1 }
    });

    // 게시글 댓글 수 증가
    await Post.findByIdAndUpdate(post_id, {
      $inc: { post_comment_count: 1 }
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

// 댓글 수정
router.put('/:id', authenticateToken, async (req, res) => {
  
  console.log('🔧 PUT 요청 받음!');
  console.log('댓글 ID:', req.params.id);
  console.log('요청 body:', req.body);
  console.log('사용자 ID:', req.user?.id);
  
  try {
    const commentId = req.params.id;
    const { comment_content } = req.body; // ✅ title이 아니라 comment_content
    const userId = req.user.id;

    // 댓글 ID 형식 검증
    if (!commentId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: '올바르지 않은 댓글 ID 형식입니다'
      });
    }

    // 댓글 내용 검증
    if (!comment_content || comment_content.trim() === '') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: '댓글 내용을 입력해주세요'
      });
    }
    
    // 댓글 존재 여부 확인
    const existingComment = await Comment.findById(commentId);
    if (!existingComment) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: '존재하지 않는 댓글입니다'
      });
    }

    // 작성자 권한 확인
    if (existingComment.user_id.toString() !== userId.toString()) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: '본인의 댓글만 수정할 수 있습니다'
      });
    }

    // 댓글 수정
    const updatedComment = await Comment.findByIdAndUpdate(
      commentId,
      {
        comment_content: comment_content.trim(),
        comment_update_time: new Date() // 
      },
      { new: true }
    );
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: '댓글이 수정되었습니다',
      data: {
        id: updatedComment._id,
        comment_content: updatedComment.comment_content, 
        comment_update_time: updatedComment.comment_update_time,
        updated_at_display: formatKoreanTime(updatedComment.comment_update_time)
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
    
    console.error('댓글 수정 에러:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '서버 오류가 발생했습니다'
    });
  }
});

export default router;