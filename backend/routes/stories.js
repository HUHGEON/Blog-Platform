import express from 'express';
import Story from '../models/Story.js';
import User from '../models/User.js';
import { authenticateToken } from '../middlewares/auth.js';
import { upload } from '../middlewares/upload.js'; 
import HTTP_STATUS from '../constants/httpStatusCodes.js';
import moment from 'moment-timezone';
import { formatStoryTime } from '../utils/timeFormatter.js';

const router = express.Router();

// 스토리 작성
router.post('/', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { content } = req.body; 
    const user_id = req.user.id;

    // 이미지 필수 검증
    if (!req.file) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: '스토리 이미지를 업로드해주세요'
      });
    }

    // 내용 길이 검증
    if (!content || content.trim() === '') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: '스토리 내용을 입력해주세요'
      });
    }
    if (content.length > 20) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: '스토리 내용은 20글자 이하로 입력해주세요'
      });
    }

    const image_url = `/uploads/${req.file.filename}`;

    const new_story = new Story({
      user_id: user_id,
      content: content.trim(),
      image_url: image_url
    });

    await new_story.save();

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: '스토리가 성공적으로 등록되었습니다',
      data: {
        id: new_story._id,
        content: new_story.content,
        image_url: new_story.image_url,
        createdAt: new_story.createdAt,
        created_at_display: formatStoryTime(new_story.createdAt)
      }
    });

  } catch (error) {
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

    console.error('스토리 작성 에러:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '서버 오류가 발생했습니다'
    });
  }
});

// 내 스토리 목록 조회
router.get('/my-stories', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;

    // 24시간 내의 내 스토리 조회
    const stories = await Story.find({
      user_id: user_id,
      createdAt: { $gt: moment().subtract(24, 'hours').toDate() }
    })
    .sort({ createdAt: -1 })
    .select('content image_url createdAt');

    const formatted_stories = stories.map(story => ({
      id: story._id,
      content: story.content,
      image_url: story.image_url,
      createdAt: story.createdAt,
      created_at_display: formatStoryTime(story.createdAt)
    }));

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: '내 스토리 목록 조회 성공',
      data: { my_stories: formatted_stories }
    });

  } catch (error) {
    console.error('내 스토리 조회 에러:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '서버 오류가 발생했습니다'
    });
  }
});

// 팔로우한 사용자들의 스토리 조회
router.get('/feed', authenticateToken, async (req, res) => {
  try {
    const user_id = req.user.id;

    // 현재 사용자가 팔로우하는 사용자들의 ID 조회
    const user = await User.findById(user_id).select('following');
    const following_ids = user.following;

    if (following_ids.length === 0) {
      return res.status(HTTP_STATUS.OK).json({
        success: true,
        message: '팔로우한 사용자가 없습니다',
        data: { stories: [] }
      });
    }

    // 팔로우하는 사용자들의 24시간 내 스토리 조회
    const stories = await Story.find({
      user_id: { $in: following_ids },
      createdAt: { $gt: moment().subtract(24, 'hours').toDate() } // 24시간 초과 현재까지
    })
    .sort({ createdAt: -1 })
    .populate('user_id', 'nickname profile_image_url');

    const formatted_stories = stories.map(story => ({
      id: story._id,
      content: story.content,
      image_url: story.image_url,
      createdAt: story.createdAt,
      created_at_display: formatStoryTime(story.createdAt), 
      user_info: {
        id: story.user_id._id,
        nickname: story.user_id.nickname,
        profile_image_url: story.user_id.profile_image_url
      },
      is_read: story.viewed_by.includes(user_id)
    }));

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: '팔로우 피드 스토리 조회 성공',
      data: { stories: formatted_stories }
    });

  } catch (error) {
    console.error('스토리 피드 조회 에러:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '서버 오류가 발생했습니다'
    });
  }
});

// 특정 스토리 상세 조회 및 읽음 처리
router.get('/:storyId', authenticateToken, async (req, res) => {
    try {
      const { storyId } = req.params;
      const currentUserId = req.user.id;

      // 해당 스토리 조회
      const story = await Story.findById(storyId)
        .populate('user_id', 'nickname profile_image_url');

      if (!story) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: '스토리를 찾을 수 없습니다' });
      }

      // 스토리 소유자 확인
      const isOwner = story.user_id.toString() === currentUserId.toString();

      if (!isOwner) {
          // 소유자가 아니면 팔로우 상태 확인
          const isFollowing = await User.exists({ _id: currentUserId, following: story.user_id });

          if (!isFollowing) {
              return res.status(HTTP_STATUS.FORBIDDEN).json({ success: false, message: '팔로우한 사용자만 스토리를 볼 수 있습니다' });
          }
      }

      if (!story.viewed_by.includes(currentUserId)) {
        story.viewed_by.push(currentUserId);
        await story.save();
      }

      const formatted_story = {
        id: story._id,
        content: story.content,
        image_url: story.image_url,
        createdAt: story.createdAt,
        created_at_display: formatStoryTime(story.createdAt),
        user_info: {
          id: story.user_id._id,
          nickname: story.user_id.nickname,
          profile_image_url: story.user_id.profile_image_url
        },
        viewed_by_count: story.viewed_by.length 
      };

      res.status(HTTP_STATUS.OK).json({ success: true, message: '스토리 조회 성공', data: formatted_story });
    } catch (error) {
      console.error('스토리 상세 조회 에러:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: '서버 오류가 발생했습니다' });
    }
});

export default router;