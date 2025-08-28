import express from 'express';
import User from '../models/User.js';
import { authenticateToken } from '../middlewares/auth.js';
import HTTP_STATUS from '../constants/httpStatusCodes.js';

const router = express.Router();

// 팔로우/언팔로우 토글
router.post('/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId: follow_user_id } = req.params;
    const user_id = req.user.id;

    // 현재 사용자 조회
    const user = await User.findById(user_id);

    // 이미 팔로우하고 있는지 확인
    const isFollowing = user.following.includes(follow_user_id);

    if (isFollowing) {

      // 팔로우 취소
      await User.findByIdAndUpdate(user_id, {
        $pull: { following: follow_user_id },
        $inc: { following_count: -1 }
      });

      await User.findByIdAndUpdate(follow_user_id, {
        $pull: { followers: user_id },
        $inc: { followers_count: -1 }
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: '팔로우를 취소했습니다',
        data: {
          follow_user_id: follow_user_id,
          action: 'unfollowed',
          is_following: false
        }
      });

    } else {
      // 팔로우
      await User.findByIdAndUpdate(user_id, {
        $push: { following: follow_user_id },
        $inc: { following_count: 1 }
      });

      await User.findByIdAndUpdate(follow_user_id, {
        $push: { followers: user_id },
        $inc: { followers_count: 1 }
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: '팔로우했습니다',
        data: {
          follow_user_id: follow_user_id,
          action: 'followed',
          is_following: true
        }
      });
    }

  } catch (error) {
    console.error('팔로우 에러:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '서버 오류가 발생했습니다'
    });
  }
});

// 팔로워 목록 조회
router.get('/followers/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // 사용자 존재 여부 확인
    const user = await User.findById(userId);
    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: '존재하지 않는 사용자입니다'
      });
    }

    // 팔로워 목록 조회 (페이지네이션 적용)
    const followers = await User.findById(userId)
      .populate({
        path: 'followers',
        select: 'id nickname',
        options: {
          skip: skip,
          limit: limit
        }
      })
      .select('followers followers_count');

    const total_pages = Math.ceil(user.followers_count / limit);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: '팔로워 목록 조회 성공',
      data: {
        followers: followers.followers,
        pagination: {
          currentPage: page,
          totalPages: total_pages,
          totalFollowers: user.followers_count,
          limit,
          hasNextPage: page < total_pages,
          hasPrevPage: page > 1
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

// 팔로우 상태 확인
router.get('/status/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const current_user_id = req.user.id;

    // 팔로우 상태 확인
    const user = await User.findById(current_user_id).select('following');
    const isFollowing = user.following.includes(userId);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: '팔로우 상태 조회 성공',
      data: {
        follow_user_id: userId,
        is_following: isFollowing
      }
    });

  } catch (error) {
    console.error('팔로우 상태 조회 에러:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '서버 오류가 발생했습니다'
    });
  }
});

export default router;