import express from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import Like from '../models/Like.js';
import { authenticateToken, optionalAuth } from '../middlewares/auth.js';
import HTTP_STATUS from '../constants/httpStatusCodes.js';
import moment from 'moment-timezone';

const router = express.Router();

// 한국 시간 24시간 형식 함수
const format_korean_time = (date) => {
  return moment(date).tz('Asia/Seoul').format('YYYY년 MM월 DD일 HH시 mm분');
};

// 사용자 기본 정보 + 팔로우 상태 조회
router.get('/:userId', optionalAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    // 사용자 기본 정보 조회 (profile_image_url 추가)
    const user = await User.findById(userId)
      .select('nickname user_post_count followers_count following_count profile_image_url') // profile_image_url 추가
      .lean();

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: '존재하지 않는 사용자입니다'
      });
    }

    // 현재 로그인한 사용자가 이 사용자를 팔로우하고 있는지 확인
    let isFollowing = false;
    if (req.user && req.user.id !== userId) {
      const currentUser = await User.findById(req.user.id).select('following');
      isFollowing = currentUser.following.includes(userId);
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: '사용자 정보 조회 성공',
      data: {
        user: {
          id: user._id,
          nickname: user.nickname,
          post_count: user.user_post_count,
          followers_count: user.followers_count,
          following_count: user.following_count,
          profile_image_url: user.profile_image_url, // profile_image_url 추가
          is_following: req.user && req.user.id !== userId ? isFollowing : null
        }
      }
    });

  } catch (error) {
    console.error('사용자 정보 조회 에러:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '서버 오류가 발생했습니다'
    });
  }
});

// 사용자 통계 정보 조회
router.get('/:userId/stats', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('user_post_count followers_count following_count');
    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: '존재하지 않는 사용자입니다'
      });
    }

    // 비동기 처리
    const [commentsCount, likesResult] = await Promise.all([
      Comment.countDocuments({ user_id: userId }),
      Like.aggregate([
        { $lookup: { from: 'posts', localField: 'post_id', foreignField: '_id', as: 'post' }},
        { $unwind: '$post' },
        { $match: { 'post.user_id': new mongoose.Types.ObjectId(userId) }},
        { $count: 'total' }
      ])
    ]);

    const likesCount = likesResult[0]?.total || 0;

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: {
        postCount: user.user_post_count || 0,
        followersCount: user.followers_count || 0,
        followingCount: user.following_count || 0,
        commentsCount,
        likesReceivedCount: likesCount
      }
    });

  } catch (error) {
    console.error('사용자 통계 조회 오류:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '서버 오류가 발생했습니다'
    });
  }
});

// 사용자가 작성한 게시글 목록 조회
router.get('/:userId/posts', async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sort_by = req.query.sort || 'latest';
    const skip = (page - 1) * limit;

    // 사용자 존재 확인
    const user = await User.findById(userId).select('nickname');
    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: '존재하지 않는 사용자입니다'
      });
    }

    // 해당 사용자의 게시글 총 개수
    const total_posts = await Post.countDocuments({ user_id: userId });
    const total_pages = Math.ceil(total_posts / limit);

    let posts;

    if (sort_by === 'popular') {
      posts = await Post.aggregate([
        {
          $match: { user_id: new mongoose.Types.ObjectId(userId) }
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
            'user_id.nickname': '$user_info.nickname',
            'user_id.profile_image_url': '$user_info.profile_image_url' // profile_image_url 추가
          }
        }
      ]);
    } else {
      // 최신순 정렬 
      posts = await Post.find({ user_id: userId })
        .populate('user_id', 'nickname profile_image_url') // profile_image_url 추가
        .sort({ post_create_at: -1 })
        .skip(skip)
        .limit(limit)
        .select('title post_like_count post_comment_count post_view_count post_create_at');
    }

    // 한국시간으로 포맷해서 전송
    const formatted_posts = posts.map(post => ({
      // Mongoose 쿼리 결과는 직접 post._doc으로 접근해야 할 수도 있습니다.
      // aggregate 결과는 일반 객체이므로 직접 접근합니다.
      ...(post._doc ? post._doc : post), // Mongoose 문서 또는 일반 객체 처리
      created_at_display: format_korean_time(post.post_create_at),
      // populate된 user_id 객체에서 profile_image_url을 가져오도록 수정
      user_id: {
        id: post.user_id._id || (post.user_id ? post.user_id.id : null), // aggregate 결과 처리
        nickname: post.user_id.nickname,
        profile_image_url: post.user_id.profile_image_url || (post.user_info ? post.user_info.profile_image_url : null) // aggregate 결과 처리
      }
    }));

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: '사용자 게시글 목록 조회 성공',
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
        sort: sort_by,
        user: {
          id: user._id,
          nickname: user.nickname
        }
      }
    });

  } catch (error) {
    console.error('사용자 게시글 목록 조회 에러:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '서버 오류가 발생했습니다'
    });
  }
});

// 팔로워 목록 조회
router.get('/:userId/followers', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const lastId = req.query.lastId;

    // 사용자 존재 확인
    const user = await User.findById(userId).select('nickname followers_count');
    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: '존재하지 않는 사용자입니다'
      });
    }

    // 팔로워 목록 조회 (커서 기반 페이지네이션) (profile_image_url 추가)
    let query = { _id: { $in: user.followers || [] } };
    
    if (lastId) {
      query._id = { 
        $in: user.followers || [],
        $lt: new mongoose.Types.ObjectId(lastId) 
      };
    }

    const followers = await User.find(query)
      .select('nickname profile_image_url') // 닉네임과 프로필 이미지 URL만 선택
      .sort({ _id: -1 })
      .limit(limit + 1);

    const hasMore = followers.length > limit;
    const followersToReturn = hasMore ? followers.slice(0, -1) : followers;

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: '팔로워 목록 조회 성공',
      data: {
        followers: followersToReturn.map(follower => ({
          id: follower._id,
          nickname: follower.nickname,
          profile_image_url: follower.profile_image_url // profile_image_url 추가
        })),
        hasMore: hasMore,
        lastId: followersToReturn.length > 0 ? followersToReturn[followersToReturn.length - 1]._id : null,
        totalFollowers: user.followers_count,
        user: {
          id: user._id,
          nickname: user.nickname
        }
      }
    });

  } catch (error) {
    console.error('팔로워 목록 조회 에러:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '서버 오류가 발생했습니다'
    });
  }
});

// 팔로잉 목록 조회 (무한 스크롤)
router.get('/:userId/following', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const lastId = req.query.lastId;

    // 사용자 존재 확인
    const user = await User.findById(userId).select('nickname following_count following');
    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: '존재하지 않는 사용자입니다'
      });
    }

    // 팔로잉 목록 조회 (커서 기반 페이지네이션) (profile_image_url 추가)
    let query = { _id: { $in: user.following || [] } };
    
    if (lastId) {
      query._id = { 
        $in: user.following || [],
        $lt: new mongoose.Types.ObjectId(lastId) 
      };
    }

    const following = await User.find(query)
      .select('nickname profile_image_url') // 닉네임과 프로필 이미지 URL만 선택
      .sort({ _id: -1 })
      .limit(limit + 1);

    const hasMore = following.length > limit;
    const followingToReturn = hasMore ? following.slice(0, -1) : following;

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: '팔로잉 목록 조회 성공',
      data: {
        following: followingToReturn.map(followingUser => ({
          id: followingUser._id,
          nickname: followingUser.nickname,
          profile_image_url: followingUser.profile_image_url // profile_image_url 추가
        })),
        hasMore: hasMore,
        lastId: followingToReturn.length > 0 ? followingToReturn[followingToReturn.length - 1]._id : null,
        totalFollowing: user.following_count,
        user: {
          id: user._id,
          nickname: user.nickname
        }
      }
    });

  } catch (error) {
    console.error('팔로잉 목록 조회 에러:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '서버 오류가 발생했습니다'
    });
  }
});

export default router;
