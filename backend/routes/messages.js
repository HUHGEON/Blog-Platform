import express from 'express';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { authenticateToken } from '../middlewares/auth.js';
import HTTP_STATUS from '../constants/httpStatusCodes.js';
import moment from 'moment-timezone';

const router = express.Router();

// 한국 시간 24시간 형식 함수
const format_korean_time = (date) => {
  return moment(date).tz('Asia/Seoul').format('YYYY년 MM월 DD일 HH시 mm분');
};

// 쪽지 전송
router.post('/send', authenticateToken, async (req, res) => {
  try {
    const { receiverId, title, content } = req.body;
    const senderId = req.user.id;

    const missing_fields = [];
    if (!receiverId) missing_fields.push('받는 사람');
    if (!title) missing_fields.push('제목');
    if (!content) missing_fields.push('내용');

    if (missing_fields.length > 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `${missing_fields.join(', ')}을(를) 입력해주세요`
      });
    }

    const receiverUser = await User.findById(receiverId);
    if (!receiverUser) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: '존재하지 않는 사용자에게는 쪽지를 보낼 수 없습니다'
      });
    }

    const newMessage = new Message({
      sender: senderId,
      receiver: receiverId,
      title,
      content
    });

    await newMessage.save();

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: '쪽지가 성공적으로 전송되었습니다',
      data: newMessage
    });
  } catch (error) {
    // Mongoose 유효성 검증 에러 처리
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: messages.join(', ')
      });
    }

    console.error('쪽지 전송 에러:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '서버 오류가 발생했습니다'
    });
  }
});

// 받은 편지함 목록 조회
router.get('/inbox', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const totalMessages = await Message.countDocuments({ receiver: currentUserId });
    const totalPages = Math.ceil(totalMessages / limit);

    const messages = await Message.find({ receiver: currentUserId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender', 'nickname')
      .select('sender title createdAt isRead');

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: '받은 편지함 조회 성공',
      data: {
        messages: messages.map(msg => ({
          ...msg.toObject(),
          createdAt_display: format_korean_time(msg.createdAt)
        })),
        pagination: {
          currentPage: page,
          totalPages,
          totalMessages,
          limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('받은 편지함 조회 에러:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '서버 오류가 발생했습니다'
    });
  }
});

// 보낸 편지함 목록 조회
router.get('/sent', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const totalMessages = await Message.countDocuments({ sender: currentUserId });
    const totalPages = Math.ceil(totalMessages / limit);

    const messages = await Message.find({ sender: currentUserId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('receiver', 'nickname')
      .select('receiver title createdAt');

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: '보낸 편지함 조회 성공',
      data: {
        messages: messages.map(msg => ({
          ...msg.toObject(),
          createdAt_display: format_korean_time(msg.createdAt)
        })),
        pagination: {
          currentPage: page,
          totalPages,
          totalMessages,
          limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    console.error('보낸 편지함 조회 에러:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '서버 오류가 발생했습니다'
    });
  }
});

// 특정 쪽지 상세 조회 및 읽음 처리
router.get('/:messageId', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const message = await Message.findById(messageId)
      .populate('sender', 'nickname profile_image_url')
      .populate('receiver', 'nickname profile_image_url');

    if (!message) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: '쪽지를 찾을 수 없습니다' });
    }

    if (message.receiver.toString() === req.user.id) {
      message.isRead = true;
      await message.save();
    }

    res.status(HTTP_STATUS.OK).json({ success: true, message: '쪽지 조회 성공', data: message });
  } catch (error) {
    console.error('쪽지 조회 에러:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: '서버 오류가 발생했습니다' });
  }
});

// 쪽지 답장
router.post('/reply/:originalMessageId', authenticateToken, async (req, res) => {
  try {
    const { originalMessageId } = req.params;
    const { title, content } = req.body;
    const senderId = req.user.id;

    const originalMessage = await Message.findById(originalMessageId)
      .populate('sender');

    if (!originalMessage) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: '답장할 원본 쪽지를 찾을 수 없습니다'
      });
    }
    
    const missing_fields = [];
    if (!title) missing_fields.push('제목');
    if (!content) missing_fields.push('내용');

    if (missing_fields.length > 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `${missing_fields.join(', ')}을(를) 입력해주세요`
      });
    }

    const receiverId = originalMessage.sender._id;

    const newReply = new Message({
      sender: senderId,
      receiver: receiverId,
      title,
      content
    });

    await newReply.save();

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: '쪽지 답장이 성공적으로 전송되었습니다',
      data: newReply
    });

  } catch (error) {
    // Mongoose 유효성 검증 에러 처리
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: messages.join(', ')
      });
    }

    console.error('쪽지 답장 에러:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '서버 오류가 발생했습니다'
    });
  }
});

export default router;