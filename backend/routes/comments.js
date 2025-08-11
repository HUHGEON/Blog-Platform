import express from 'express';
import Comment from '../models/Comment.js';
import Post from '../models/Post.js';
import User from '../models/User.js';
import { authenticateToken } from '../middlewares/auth.js';
import HTTP_STATUS from '../constants/httpStatusCodes.js';
import moment from 'moment-timezone';

const router = express.Router();

// 한국 시간 24시간 형식
const format_korean_time = (date) => {
  return moment(date).tz('Asia/Seoul').format('HH시 mm분 ss초');
};

// 댓글 작성
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { post_id, comment_content } = req.body;
    const user_id = req.user.id;

    // 댓글 내용 검증만
    if (!comment_content || comment_content.trim() === '') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: '댓글을 입력해 주세요'
      });
    }

    // 댓글 생성
    const new_comment = new Comment({
      user_id: user_id,
      post_id,
      comment_content: comment_content.trim()
    });

    await new_comment.save();

    // 사용자 댓글 수 증가
    await User.findByIdAndUpdate(user_id, {
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
        id: new_comment._id,
        comment_content: new_comment.comment_content,
        comment_create_at: new_comment.comment_create_at,
        created_at_display: format_korean_time(new_comment.comment_create_at)
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
  try {
    const comment_id = req.params.id;
    const { comment_content } = req.body;
    const user_id = req.user.id;

    // 댓글 내용 검증
    if (!comment_content || comment_content.trim() === '') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: '댓글 내용을 입력해주세요'
      });
    }
    
    // 댓글 조회 및 작성자 권한 확인
    const existing_comment = await Comment.findById(comment_id);
    if (!existing_comment) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: '존재하지 않는 댓글입니다'
      });
    }

    // 작성자 권한 확인
    if (existing_comment.user_id.toString() !== user_id.toString()) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: '본인의 댓글만 수정할 수 있습니다'
      });
    }

    // 댓글 수정
    const updated_comment = await Comment.findByIdAndUpdate(
      comment_id,
      {
        comment_content: comment_content.trim(),
        comment_update_time: new Date()
      },
      { new: true }
    );
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: '댓글이 수정되었습니다',
      data: {
        id: updated_comment._id,
        comment_content: updated_comment.comment_content, 
        comment_update_time: updated_comment.comment_update_time,
        updated_at_display: format_korean_time(updated_comment.comment_update_time)
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

// 댓글 삭제
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const comment_id = req.params.id;
    const user_id = req.user.id;
    
    // 댓글 조회 및 작성자 권한 확인
    const existing_comment = await Comment.findById(comment_id);
    if (!existing_comment) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: '존재하지 않는 댓글입니다'
      });
    }

    // 작성자 권한 확인
    if (existing_comment.user_id.toString() !== user_id.toString()) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: '본인의 댓글만 삭제할 수 있습니다' 
      });
    }

    await Comment.findByIdAndDelete(comment_id);

    await User.findByIdAndUpdate(user_id, {
      $inc: { user_comment_count: -1 }
    });

    await Post.findByIdAndUpdate(existing_comment.post_id, {
      $inc: { post_comment_count: -1 }
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: '댓글이 삭제되었습니다',
      data: {
        deleteCommentId: comment_id
      }
    });

  } catch (error) {
    console.error('댓글 삭제 에러:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '서버 오류가 발생했습니다'
    });
  }
});

// 댓글 목록 조회
router.get('/', async (req, res) => {
  try {
    const { post_id } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // 해당 게시글의 댓글 수 조회
    const total_comments = await Comment.countDocuments({ post_id });
    const total_pages = Math.ceil(total_comments / limit);

    // 페이지네이션 적용된 댓글 조회 (오래된 순)
    const comments = await Comment.find({ post_id })
      .populate('user_id', 'nickname')
      .sort({ comment_create_at: 1 })
      .skip(skip)
      .limit(limit)
      .select('comment_content comment_create_at comment_update_time');

    // 한국시간으로 포맷해서 전송
    const formatted_comments = comments.map(comment => ({
      ...comment.toObject(),
      created_at_display: format_korean_time(comment.comment_create_at),
      updated_at_display: comment.comment_update_time ? format_korean_time(comment.comment_update_time) : null
    }));

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: '댓글 목록 조회 성공',
      data: {
        comments: formatted_comments,
        pagination: {
          currentPage: page,
          totalPages: total_pages,
          totalComments: total_comments,
          limit,
          hasNextPage: page < total_pages,
          hasPrevPage: page > 1
        }
      }
    });

  } catch (error) {
    console.error('댓글 목록 조회 에러:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '서버 오류가 발생했습니다'
    });
  }
});

export default router;