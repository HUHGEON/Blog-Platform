import express from 'express';
import Post from '../models/Post.js';
import User from '../models/User.js';
import Like from '../models/Like.js';
import { authenticateToken, optionalAuth } from '../middlewares/auth.js';
import { upload } from '../middlewares/upload.js';
import HTTP_STATUS from '../constants/httpStatusCodes.js';
import moment from 'moment-timezone';
import { extractNouns } from '../utils/koreanAnalyzer.js';
const router = express.Router();

// 한국 시간 24시간 형식 함수
const format_korean_time = (date) => {
  return moment(date).tz('Asia/Seoul').format('YYYY년 MM월 DD일 HH시 mm분');
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

    // 명사 및 영어 단어를 추출하여 analyzed_keywords_text 필드 생성
    const analyzed_title_keywords = await extractNouns(title);
    const analyzed_content_keywords = await extractNouns(post_content);

    // 제목 키워드에 더 높은 가중치를 부여 -> 3번 반복
    const analyzed_keywords_text = `${analyzed_title_keywords} ${analyzed_title_keywords} ${analyzed_title_keywords} ${analyzed_content_keywords}`;

    // 게시글 생성
    const new_post = new Post({
      user_id: user_id,
      title,
      post_content,
      image_url: image_url,
      analyzed_keywords_text: analyzed_keywords_text // 명사+영어 단어 기반 키워드 저장
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

    console.error('게시글 작성 에러:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '서버 오류가 발생했습니다'
    });
  }
});

// 팔로우한 사용자들의 피드 조회
router.get('/feed', authenticateToken, async (req, res) => {
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

    let posts;

    if (sort_by === 'popular') {
      // 인기순 정렬 - 집계함수를 이용 ( 조회수 + 좋아요 수 + 댓글수)
      posts = await Post.aggregate([
        {
          $match: {
            user_id: { $in: user.following }
          }
        },
        {
          $addFields: {
            popularity_sum: {
              $add: ['$post_view_count', '$post_comment_count', '$post_like_count']
            }
          }
        },
        {
          $sort: {
            popularity_sum: -1,
            post_create_at: -1
          }
        },
        { $skip: skip },
        { $limit: limit },
        // User 테이블과 조인 -> 집계함수 파이프 라인안에서는 populate를 사용 못함 -> lookup을 사용
        {
          $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: '_id',
            as: 'user_info'
          }
        },
        { $unwind: '$user_info' },
        // 필요한 필드만 선택 -> 1 선택 0 은 선택 x
        {
          $project: {
            title: 1,
            post_like_count: 1,
            post_comment_count: 1,
            post_view_count: 1,
            post_create_at: 1,
            popularity_sum: 1,
            user_id: '$user_info._id',
            'user_id.nickname': '$user_info.nickname'
          }
        }
      ]);
    } else {
      // 최신순 정렬
      posts = await Post.find({
        user_id: { $in: user.following }
      })
        .populate('user_id', 'nickname')
        .sort({ post_create_at: -1 })
        .skip(skip)
        .limit(limit)
        .select('title post_like_count post_comment_count post_view_count post_create_at');
    }

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

    // 전체 게시글 수 조회
    const total_posts = await Post.countDocuments();
    const total_pages = Math.ceil(total_posts / limit);

    let posts;

    if (sort_by === 'popular') {
      posts = await Post.aggregate([
        {
          $addFields: {
            popularity_sum: {
              $add: ['$post_view_count', '$post_comment_count', '$post_like_count']
            }
          }
        },
        {
          $sort: {
            popularity_sum: -1,
            post_create_at: -1
          }
        },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: '_id',
            as: 'user_info'
          }
        },
        { $unwind: '$user_info' },
        {
          $project: {
            title: 1,
            post_like_count: 1,
            post_comment_count: 1,
            post_view_count: 1,
            post_create_at: 1,
            popularity_sum: 1,
            user_id: '$user_info._id',
            'user_id.nickname': '$user_info.nickname'
          }
        }
      ]);
    } else {
      // 최신순 정렬 
      posts = await Post.find()
        .populate('user_id', 'nickname')
        .sort({ post_create_at: -1 })
        .skip(skip)
        .limit(limit)
        .select('title post_like_count post_comment_count post_view_count post_create_at');
    }

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

// 게시글 검색 API -> 한 테이블에 $text는 하나만 가능해서 $regex 사용
router.get('/search', async (req, res) => {
  try {
    const { q: search_query, page = 1, limit = 10 } = req.query;

    if (!search_query || search_query.trim() === '') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: '검색어를 입력해주세요'
      });
    }

    const page_number = parseInt(page) || 1;
    const limit_number = parseInt(limit) || 10;
    const skip = (page_number - 1) * limit_number;

    // $regex를 사용하여 title과 post_content 필드에서 검색
    const regex_query = new RegExp(search_query.trim(), 'i');  //i -> 대소문자 구분 무시

    const search_filter = {
      $or: [
        { title: { $regex: regex_query } },
        { post_content: { $regex: regex_query } }
      ]
    };

    const total_results = await Post.countDocuments(search_filter);
    const total_pages = Math.ceil(total_results / limit_number);

    const posts = await Post.find(search_filter)
      .populate('user_id', 'nickname')
      .sort({ post_create_at: -1 }) 
      .skip(skip)
      .limit(limit_number)
      .select('title post_like_count post_comment_count post_view_count post_create_at'); 

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
          hasPrevPage: page > 1
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
    .populate('user_id', 'nickname profile_image_url')
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
      is_liked_by_user: isLikedByUser,  // 좋아요 상태 추가
      user_id: {
        _id: post.user_id._id,
        nickname: post.user_id.nickname,
        profile_image_url: post.user_id.profile_image_url
      }
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

    // 명사 및 영어 단어를 추출하여 analyzed_keywords_text 필드 업데이트
    const analyzed_title_keywords = await extractNouns(title);
    const analyzed_content_keywords = await extractNouns(post_content);
    const analyzed_keywords_text = `${analyzed_title_keywords} ${analyzed_title_keywords} ${analyzed_title_keywords} ${analyzed_content_keywords}`; // 제목 가중치 부여

    const updated_post = await Post.findByIdAndUpdate(
      post_id,
      {
        title,
        post_content,
        image_url: image_url,
        post_update_at: new Date(),
        analyzed_keywords_text: analyzed_keywords_text // 명사+영어 단어 기반 키워드 업데이트
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

// 유사한 글 추천 -> 명사 기반 형태소 분석
router.get('/:id/similar', async (req, res) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 3;

    const originalPost = await Post.findById(id).select('title post_content');
    if (!originalPost) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: '원본 게시글을 찾을 수 없습니다'
      });
    }

    const analyzed_original_title_keywords = await extractNouns(originalPost.title);
    const analyzed_original_content_keywords = await extractNouns(originalPost.post_content);

    // 제목 키워드에 더 높은 가중치를 부여하는 방식으로 검색 쿼리 구성
    const search_query_text = `${analyzed_original_title_keywords} ${analyzed_original_title_keywords} ${analyzed_original_title_keywords} ${analyzed_original_content_keywords}`;

    // 정제된 검색어가 너무 짧거나 없으면 추천 불가
    if (!search_query_text.trim() || search_query_text.trim().length < 2) {
        return res.status(HTTP_STATUS.OK).json({
            success: true,
            message: '유사한 글을 추천하기 위한 충분한 키워드를 찾을 수 없습니다.',
            data: {
                similar_posts: []
            }
        });
    }

    // MongoDB 텍스트 검색을 사용하여 유사한 게시글 조회
    const similar_posts = await Post.find({
      $text: {
        $search: search_query_text // 명사+영어 단어 기반 쿼리 사용
      },
      _id: { $ne: id } // 원본 게시글은 결과에서 제외
    }, {
      score: { $meta: 'textScore' } // 텍스트 검색 유사도 점수 반환
    })
      .populate('user_id', 'nickname profile_image_url') // 작성자 정보 포함
      .sort({ score: { $meta: 'textScore' }, post_create_at: -1 })
      .limit(limit) 
      .select('title post_content post_comment_count post_view_count post_create_at');

    // 한국 시간으로 포맷해서 전송
    const formatted_similar_posts = similar_posts.map(post => ({
      ...post.toObject(),
      created_at_display: format_korean_time(post.post_create_at),
      user_id: {
        _id: post.user_id._id,
        nickname: post.user_id.nickname,
        profile_image_url: post.user_id.profile_image_url
      }
    }));

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: '유사 게시글 추천 성공',
      data: {
        similar_posts: formatted_similar_posts
      }
    });

  } catch (error) {
    console.error('유사 게시글 추천 에러:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '서버 오류가 발생했습니다'
    });
  }
});

export default router;