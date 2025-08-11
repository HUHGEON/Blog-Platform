import express from 'express';
import Post from '../models/Post.js';
import User from '../models/User.js';
import { authenticateToken } from '../middlewares/auth.js';
import { upload } from '../middlewares/upload.js';
import HTTP_STATUS from '../constants/httpStatusCodes.js';
import moment from 'moment-timezone';

const router = express.Router();

// 한국 시간 24시간 형식 함수
const formatKoreanTime = (date) => {
  return moment(date).tz('Asia/Seoul').format('HH시 mm분 ss초');
};

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
        post_create_at: newPost.post_create_at,
        created_at_display: formatKoreanTime(newPost.post_create_at)
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

    // 한국시간으로 포맷해서 전송
    const formattedPosts = posts.map(post => ({
      ...post.toObject(),
      created_at_display: formatKoreanTime(post.post_create_at)
    }));

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: '게시글 목록 조회 성공',
      data: {
        posts: formattedPosts,
        pagination: {
          currentPage: page,
          totalPages,
          totalPosts,
          limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        },
        sort: sortBy
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

// 🔥 테스트 라우터 추가
router.get('/test', (req, res) => {
  res.json({ message: 'TEST 성공!', timestamp: new Date() });
});

// 게시글 검색 API
router.get('/search', async (req, res) => {
  try {
    const { q: searchQuery, page = 1, limit = 10 } = req.query;

    // 검색어 검증
    if (!searchQuery || searchQuery.trim() === '') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: '검색어를 입력해주세요'
      });
    }

    // 검색어 길이 제한
    if (searchQuery.length > 50) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: '검색어는 50글자 이하로 입력해주세요'
      });
    }

    const pageNumber = parseInt(page) || 1;
    const limitNumber = parseInt(limit) || 10;
    const skip = (pageNumber - 1) * limitNumber;

    // MongoDB 텍스트 검색
    const searchFilter = {
      $text: {
        $search: searchQuery.trim()
      }
    };

    // 검색 결과 총 개수
    const totalResults = await Post.countDocuments(searchFilter);
    const totalPages = Math.ceil(totalResults / limitNumber);

    // 검색 결과 조회 (스코어 기준 정렬)
    const posts = await Post.find(searchFilter, {
      score: { $meta: 'textScore' }
    })
      .populate('user_id', 'nickname')
      .sort({ score: { $meta: 'textScore' } }) // 검색 스코어 순 정렬
      .skip(skip)
      .limit(limitNumber)
      .select('title post_like_count post_comment_count post_view_count post_create_at'); 

    // 한국시간으로 포맷해서 전송
    const formattedPosts = posts.map(post => ({
      ...post.toObject(),
      created_at_display: formatKoreanTime(post.post_create_at)
    }));

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: totalResults > 0 ? '검색 결과 조회 성공' : '검색 결과가 없습니다',
      data: {
        posts: formattedPosts,
        pagination: {
          currentPage: pageNumber,
          totalPages,
          totalResults,
          limit: limitNumber,
          hasNextPage: pageNumber < totalPages,
          hasPrevPage: pageNumber > 1
        },
        searchQuery: searchQuery.trim()
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

    // 한국시간으로 포맷해서 전송
    const formattedPost = {
      ...post.toObject(),
      created_at_display: formatKoreanTime(post.post_create_at),
      updated_at_display: post.post_update_at ? formatKoreanTime(post.post_update_at) : null
    };

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: '게시글 조회 성공',
      data: formattedPost
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
    const postId = req.params.id;
    const { title, post_content, removeImage } = req.body;
    const userId = req.user.id;

    // MongoDB ObjectId 형식 검증
    if (!postId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: '올바르지 않은 게시글 ID 형식입니다'
      });
    }

    // 게시글 존재 여부 및 작성자 확인
    const existingPost = await Post.findById(postId);
    if (!existingPost) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: '존재하지 않는 게시글입니다'
      });
    }

    // 작성자 권한 확인
    if (existingPost.user_id.toString() !== userId.toString()) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: '본인의 게시글만 수정할 수 있습니다'
      });
    }

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

    let imageUrl;

    if (req.file) {
      // 새 이미지가 업로드됨 -> 기존 이미지를 삭제하고 업로드
      imageUrl = `/uploads/${req.file.filename}`;
    } else if (removeImage === 'true') {
      // 기존 이미지만 삭제
      imageUrl = null;
    } else {
      // 기존 이미지 유지
      imageUrl = existingPost.image_url;
    }

    // 게시글 수정
    const updatedPost = await Post.findByIdAndUpdate(
      postId,
      {
        title,
        post_content,
        image_url: imageUrl,
        post_update_at: new Date() // UTC로 수정
      },
      { new: true } // 업데이트된 문서 반환
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: '게시글이 수정되었습니다',
      data: {
        id: updatedPost._id,
        title: updatedPost.title,
        post_content: updatedPost.post_content,
        image_url: updatedPost.image_url,
        post_update_at: updatedPost.post_update_at,
        updated_at_display: formatKoreanTime(updatedPost.post_update_at)
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
    const postId = req.params.id;
    const userId = req.user.id;

    // MongoDB ObjectId 형식 검증
    if (!postId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: '올바르지 않은 게시글 ID 형식입니다'
      });
    }

    // 게시글 존재 여부 및 작성자 확인
    const existingPost = await Post.findById(postId);
    if (!existingPost) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: '존재하지 않는 게시글입니다'
      });
    }

    // 작성자 권한 확인
    if (existingPost.user_id.toString() !== userId.toString()) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: '본인의 게시글만 삭제할 수 있습니다'
      });
    }

    // 게시글 삭제
    await Post.findByIdAndDelete(postId);

    // 사용자의 게시글 수 감소
    await User.findByIdAndUpdate(userId, {
      $inc: { user_post_count: -1 }
    });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: '게시글이 삭제되었습니다',
      data: {
        deletedPostId: postId
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