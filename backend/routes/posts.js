import express from 'express';
import Post from '../models/Post.js';
import User from '../models/User.js';
import Like from '../models/Like.js';
import { authenticateToken, optionalAuth } from '../middlewares/auth.js';
import { upload } from '../middlewares/upload.js';
import HTTP_STATUS from '../constants/httpStatusCodes.js';
import moment from 'moment-timezone';

const router = express.Router();

// 한국 시간 24시간 형식 함수
const format_korean_time = (date) => {
  return moment(date).tz('Asia/Seoul').format('HH시 mm분 ss초');
};

// 게시글 작성
router.post('/', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { title, post_content } = req.body;
    const user_id = req.user.id;

    // 필수 필드 검증
    const missing_fields = [];
    if (!title) missing_fields.push('제목');
    if (!post_content) missing_fields.push('내용');

    if (missing_fields.length > 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `${missing_fields.join(', ')}을(를) 입력해주세요`
      });
    }

    // 이미지 업로드
    let image_url = null;
    if (req.file) {
      image_url = `/uploads/${req.file.filename}`;
    }

    // 게시글 생성
    const new_post = new Post({
      user_id: user_id,
      title,
      post_content,
      image_url: image_url
    });

    await new_post.save();

    // 사용자의 게시글 수 증가
    await User.findByIdAndUpdate(user_id, {
      $inc: { user_post_count: 1 }
    });

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: '게시글이 등록되었습니다',
      data: {
        id: new_post._id,
        title: new_post.title,
        post_content: new_post.post_content,
        image_url: new_post.image_url,
        post_create_at: new_post.post_create_at,
        created_at_display: format_korean_time(new_post.post_create_at)
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

// 팔로우한 사용자들의 피드 조회
router.get('/following', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sort_by = req.query.sort || 'latest';
    const skip = (page - 1) * limit;
    const user_id = req.user.id;

    // 현재 사용자가 팔로우하는 사용자들의 ID 조회
    const user = await User.findById(user_id).select('following');

    // 팔로우한 사용자가 없는 경우
    if (!user.following || user.following.length === 0) {
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: '팔로우한 사용자가 없습니다',
        data: {
          posts: [],
          pagination: {
            currentPage: page,
            totalPages: 0,
            totalPosts: 0,
            limit,
            hasNextPage: false,
            hasPrevPage: false
          }
        }
      });
    }

    // 팔로우한 사용자들의 게시글 총 개수 조회
    const total_posts = await Post.countDocuments({
      user_id: { $in: user.following }
    });
    const total_pages = Math.ceil(total_posts / limit);

    // 정렬 옵션
    const sort_options = {
      latest: { post_create_at: -1 },
      views: { post_view_count: -1, post_create_at: -1 },
      likes: { post_like_count: -1, post_create_at: -1 },
      comments: { post_comment_count: -1, post_create_at: -1 }
    };

    // 유효하지 않은 정렬 옵션 처리
    const sort_option = sort_options[sort_by] || sort_options.latest;

    // 팔로우한 사용자들의 게시글 조회
    const posts = await Post.find({
      user_id: { $in: user.following }
    })
      .populate('user_id', 'nickname')
      .sort(sort_option)
      .skip(skip)
      .limit(limit)
      .select('title post_like_count post_comment_count post_view_count post_create_at image_url');

    // 한국시간으로 포맷해서 전송
    const formatted_posts = posts.map(post => ({
      ...post.toObject(),
      created_at_display: format_korean_time(post.post_create_at)
    }));

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: '팔로우 피드 조회 성공',
      data: {
        posts: formatted_posts,
        pagination: {
          currentPage: page,
          totalPages: total_pages,
          totalPosts: total_posts,
          limit,
          hasNextPage: page < total_pages,
          hasPrevPage: page > 1
        },
        sort: sort_by
      }
    });

  } catch (error) {
    console.error('팔로우 피드 조회 에러:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '서버 오류가 발생했습니다'
    });
  }
});

// 게시글 목록 조회
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sort_by = req.query.sort || 'latest';
    const skip = (page - 1) * limit;

    // 정렬 옵션
    const sort_options = {
      latest: { post_create_at: -1 },
      views: { post_view_count: -1, post_create_at: -1 },
      likes: { post_like_count: -1, post_create_at: -1 },
      comments: { post_comment_count: -1, post_create_at: -1 }
    };

    // 유효하지 않은 정렬 옵션 처리
    const sort_option = sort_options[sort_by] || sort_options.latest;

    // 전체 게시글 수 조회
    const total_posts = await Post.countDocuments();
    const total_pages = Math.ceil(total_posts / limit);

    // 페이지네이션 + 정렬 적용된 게시글 조회
    const posts = await Post.find()
      .populate('user_id', 'nickname')
      .sort(sort_option)
      .skip(skip)
      .limit(limit)
      .select('title post_like_count post_comment_count post_view_count post_create_at image_url');

    // 한국시간으로 포맷해서 전송
    const formatted_posts = posts.map(post => ({
      ...post.toObject(),
      created_at_display: format_korean_time(post.post_create_at)
    }));

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: '게시글 목록 조회 성공',
      data: {
        posts: formatted_posts,
        pagination: {
          currentPage: page,
          totalPages: total_pages,
          totalPosts: total_posts,
          limit,
          hasNextPage: page < total_pages,
          hasPrevPage: page > 1
        },
        sort: sort_by
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

// 게시글 검색 API
router.get('/search', async (req, res) => {
  try {
    const { q: search_query, page = 1, limit = 10 } = req.query;

    // 검색어 검증
    if (!search_query || search_query.trim() === '') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: '검색어를 입력해주세요'
      });
    }

    const page_number = parseInt(page) || 1;
    const limit_number = parseInt(limit) || 10;
    const skip = (page_number - 1) * limit_number;

    // MongoDB 텍스트 검색
    const search_filter = {
      $text: {
        $search: search_query.trim()
      }
    };

    // 검색 결과 총 개수
    const total_results = await Post.countDocuments(search_filter);
    const total_pages = Math.ceil(total_results / limit_number);

    // 검색 결과 조회 (스코어 기준 정렬)
    const posts = await Post.find(search_filter, {
      score: { $meta: 'textScore' }
    })
      .populate('user_id', 'nickname')
      .sort({ score: { $meta: 'textScore' } })
      .skip(skip)
      .limit(limit_number)
      .select('title post_like_count post_comment_count post_view_count post_create_at'); 

    // 한국시간으로 포맷해서 전송
    const formatted_posts = posts.map(post => ({
      ...post.toObject(),
      created_at_display: format_korean_time(post.post_create_at)
    }));

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: total_results > 0 ? '검색 결과 조회 성공' : '검색 결과가 없습니다',
      data: {
        posts: formatted_posts,
        pagination: {
          currentPage: page_number,
          totalPages: total_pages,
          totalResults: total_results,
          limit: limit_number,
          hasNextPage: page_number < total_pages,
          hasPrevPage: page_number > 1
        },
        searchQuery: search_query.trim()
      }
    });

  } catch (error) {
    console.error('게시글 검색 에러:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '서버 오류가 발생했습니다'
    });
  }
});

// 게시글 상세 조회
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // 게시글 조회 및 조회수 증가
    const post = await Post.findByIdAndUpdate(
      id,
      { $inc: { post_view_count: 1 } },
      { new: true }
    )
    .populate('user_id', 'nickname')
    .select('title post_content post_like_count post_comment_count post_view_count post_create_at post_update_at image_url');

    if (!post) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: '존재하지 않는 게시글입니다'
      });
    }

    // 사용자가 좋아요를 했는지 확인
    let isLikedByUser = null;
    if (req.user) {  // 로그인한 경우만
      isLikedByUser = await Like.isLikedByUser(req.user.id, id);
    }

    // 한국시간으로 포맷해서 전송
    const formatted_post = {
      ...post.toObject(),
      created_at_display: format_korean_time(post.post_create_at),
      updated_at_display: post.post_update_at ? format_korean_time(post.post_update_at) : null,
      is_liked_by_user: isLikedByUser  // 좋아요 상태 추가
    };

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: '게시글 조회 성공',
      data: formatted_post
    });

  } catch (error) {
    console.error('게시글 상세 조회 에러:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '서버 오류가 발생했습니다'
    });
  }
});

// 게시글 수정
router.put('/:id', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const post_id = req.params.id;
    const { title, post_content, removeImage } = req.body;
    const user_id = req.user.id;

    // 게시글 존재 여부 및 작성자 확인
    const existing_post = await Post.findById(post_id);
    if (!existing_post) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: '존재하지 않는 게시글입니다'
      });
    }

    // 작성자 권한 확인
    if (existing_post.user_id.toString() !== user_id.toString()) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: '본인의 게시글만 수정할 수 있습니다'
      });
    }

    // 필수 필드 검증
    const missing_fields = [];
    if (!title) missing_fields.push('제목');
    if (!post_content) missing_fields.push('내용');

    if (missing_fields.length > 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `${missing_fields.join(', ')}을(를) 입력해주세요`
      });
    }

    let image_url;

    if (req.file) {
      // 새 이미지가 업로드됨 -> 기존 이미지를 삭제하고 업로드
      image_url = `/uploads/${req.file.filename}`;
    } else if (removeImage === 'true') {
      // 기존 이미지만 삭제
      image_url = null;
    } else {
      // 기존 이미지 유지
      image_url = existing_post.image_url;
    }

    // 게시글 수정
    const updated_post = await Post.findByIdAndUpdate(
      post_id,
      {
        title,
        post_content,
        image_url: image_url,
        post_update_at: new Date()
      },
      { new: true }
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: '게시글이 수정되었습니다',
      data: {
        id: updated_post._id,
        title: updated_post.title,
        post_content: updated_post.post_content,
        image_url: updated_post.image_url,
        post_update_at: updated_post.post_update_at,
        updated_at_display: format_korean_time(updated_post.post_update_at)
      }
    });

  } catch (error) {
    // multer 에러 처리
    if (error.message === '이미지 파일만 업로드 가능합니다') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: '이미지 파일만 업로드 가능합니다 (jpg, jpeg, png)'
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

    console.error('게시글 수정 에러:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '서버 오류가 발생했습니다'
    });
  }
});

// 게시글 삭제
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const post_id = req.params.id;
    const user_id = req.user.id;

    // 게시글 존재 여부 및 작성자 확인
    const existing_post = await Post.findById(post_id);
    if (!existing_post) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: '존재하지 않는 게시글입니다'
      });
    }

    // 작성자 권한 확인
    if (existing_post.user_id.toString() !== user_id.toString()) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: '본인의 게시글만 삭제할 수 있습니다'
      });
    }

    // 게시글 삭제
    await Post.findByIdAndDelete(post_id);

    // 사용자의 게시글 수 감소
    await User.findByIdAndUpdate(user_id, {
      $inc: { user_post_count: -1 }
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: '게시글이 삭제되었습니다',
      data: {
        deletedPostId: post_id
      }
    });

  } catch (error) {
    console.error('게시글 삭제 에러:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '서버 오류가 발생했습니다'
    });
  }
});

export default router;