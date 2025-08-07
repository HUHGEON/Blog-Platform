import express from 'express';
import Post from '../models/Post.js';
import User from '../models/User.js';
import { authenticateToken } from '../middlewares/auth.js';
import { upload } from '../middlewares/upload.js';
import HTTP_STATUS from '../constants/httpStatusCodes.js';

const router = express.Router();

// 게시글 작성
router.post('/', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { title, post_content } = req.body;
    const userId = req.user.id; // 로그인한 사용자 ID

    // 필수 필드 검증
    const missingFields = [];
    if (!title) missingFields.push('제목');
    if (!post_content) missingFields.push('내용');

    if (missingFields.length > 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `${missingFields.join(', ')}을(를) 입력해주세요`
      });
    }

    // 이미지 업로드
    let imageUrl = null;
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    }

    // 게시글 생성
    const newPost = new Post({
      user_id: userId,
      title,
      post_content,
      image_url: imageUrl
    });

    await newPost.save();

    // 사용자의 게시글 수 증가
    await User.findByIdAndUpdate(userId, {
      $inc: { user_post_count: 1 }
    });

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: '게시글이 작성되었습니다',
      data: {
        id: newPost._id,
        title: newPost.title,
        post_content: newPost.post_content,
        image_url: newPost.image_url,
        post_create_at: newPost.post_create_at
      }
    });

  } catch (error) {
    // multer 에러 처리
    if (error.message === '이미지 파일만 업로드 가능합니다') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: '이미지 파일만 업로드 가능합니다 (jpg, jpeg, png, gif)'
      });
    }

    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: '이미지 크기는 5MB 이하여야 합니다'
      });
    }

    // Mongoose 유효성 검증 에러 처리
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: messages.join(', ')
      });
    }

    console.error('게시글 작성 에러:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '서버 오류가 발생했습니다'
    });
  }
});

// 게시글 목록 조회
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // 기본값: 1페이지
    const limit = parseInt(req.query.limit) || 10; // 기본값: 10개씩
    const sortBy = req.query.sort || 'latest'; // 기본값: 최신순
    const skip = (page - 1) * limit;

    // 정렬 옵션
    const sortOptions = {
      latest: { post_create_at: -1 },
      views: { post_view_count: -1, post_create_at: -1 },
      likes: { post_like_count: -1, post_create_at: -1 },
      comments: { post_comment_count: -1, post_create_at: -1 }
    };

    // 유효하지 않은 정렬 옵션 처리
    const sortOption = sortOptions[sortBy] || sortOptions.latest;

    // 전체 게시글 수 조회
    const totalPosts = await Post.countDocuments();
    const totalPages = Math.ceil(totalPosts / limit);

    // 페이지네이션 + 정렬 적용된 게시글 조회
    const posts = await Post.find()
      .populate('user_id', 'nickname') // 닉네임만 포함 (공개 정보)
      .sort(sortOption) // 선택된 정렬 방식 적용
      .skip(skip) // 건너뛸 개수
      .limit(limit) // 가져올 개수
      .select('title post_like_count post_comment_count post_view_count post_create_at image_url'); // 목록에 필요한 필드만

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: '게시글 목록 조회 성공',
      data: {
        posts,
        pagination: {
          currentPage: page,
          totalPages,
          totalPosts,
          limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        },
        sort: sortBy // 현재 정렬 방식 정보 포함
      }
    });

  } catch (error) {
    console.error('게시글 목록 조회 에러:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '서버 오류가 발생했습니다'
    });
  }
});

// 3. 게시글 상세 조회 (조회수 증가) - 공개
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // MongoDB ObjectId 형식 검증
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: '올바르지 않은 게시글 ID 형식입니다'
      });
    }

    // 게시글 조회 및 조회수 증가
    const post = await Post.findByIdAndUpdate(
      id,
      { $inc: { post_view_count: 1 } }, // 조회수 1 증가
      { new: true } // 업데이트된 문서 반환
    )
    .populate('user_id', 'nickname') // 닉네임만 포함
    .select('title post_content post_like_count post_comment_count post_view_count post_create_at post_update_at image_url');

    if (!post) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: '존재하지 않는 게시글입니다'
      });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: '게시글 조회 성공',
      data: post
    });

  } catch (error) {
    console.error('게시글 상세 조회 에러:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '서버 오류가 발생했습니다'
    });
  }
});

export default router;