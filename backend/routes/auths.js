import express from 'express';
import User from '../models/User.js';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.js';
import { authenticateToken, authenticateRefreshToken } from '../middlewares/auth.js';
import HTTP_STATUS from '../constants/httpStatusCodes.js';

const router = express.Router();

// 회원가입
router.post('/signup', async (req, res) => {
  try {
    const { id, pw, name, nickname, birth_date: birth_date_string } = req.body;

    // 필수 필드 검증
    const missing_fields = [];
    if (!id) missing_fields.push('아이디');
    if (!pw) missing_fields.push('비밀번호');
    if (!name) missing_fields.push('이름');
    if (!nickname) missing_fields.push('닉네임');
    if (!birth_date_string) missing_fields.push('생년월일');

    if (missing_fields.length > 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `${missing_fields.join(', ')}을(를) 입력해주세요`
      });
    }

    // 생년월일 검증 (프론트에서 type="date" 사용)
    const birth_date = new Date(birth_date_string);
    
    if (isNaN(birth_date.getTime()) || birth_date > new Date()) {
      const today = new Date().toISOString().split('T')[0];
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `올바른 생년월일을 입력해주세요 (${today} 이전 날짜)`
      });
    }

    // ID 중복 확인
    const existing_user_id = await User.findOne({ id });
    if (existing_user_id) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: '이미 사용중인 아이디입니다'
      });
    }

    // 닉네임 중복 확인
    const existing_user_nickname = await User.findOne({ nickname });
    if (existing_user_nickname) {
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: '이미 사용중인 닉네임입니다'
      });
    }

    // 사용자 생성
    const new_user = new User({
      id,
      pw,
      name,
      nickname,
      birth_date: birth_date
    });

    await new_user.save();

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      message: '회원가입이 완료되었습니다',
      data: {
        id: new_user.id,
        name: new_user.name,
        nickname: new_user.nickname
      }
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

    // MongoDB 선에서 띄우는 error(동시 가입, unique 제약 어길시)
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      const field_name = field === 'id' ? '아이디' : '닉네임';
      return res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        message: `이미 사용중인 ${field_name}입니다`
      });
    }

    console.error('회원가입 에러:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '서버 오류가 발생했습니다'
    });
  }
});

// 로그인
router.post('/login', async (req, res) => {
  try {
    const { id, pw } = req.body;

    // 필수 필드 검증
    const missing_fields = [];
    if (!id) missing_fields.push('아이디');
    if (!pw) missing_fields.push('비밀번호');

    if (missing_fields.length > 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: `${missing_fields.join(', ')}을(를) 입력해주세요`
      });
    }

    // 사용자 찾기
    const user = await User.findOne({ id });
    if (!user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: '아이디 또는 비밀번호가 올바르지 않습니다'
      });
    }

    // 비밀번호 확인
    const is_password_valid = await user.comparePassword(pw);
    if (!is_password_valid) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: '아이디 또는 비밀번호가 올바르지 않습니다'
      });
    }

    // 토큰 생성
    const access_token = generateAccessToken(user);
    const refresh_token = generateRefreshToken(user);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: '로그인 성공',
      data: {
        user: {
          id: user.id,
          nickname: user.nickname,
          name: user.name
        },
        tokens: {
          accessToken: access_token,
          refreshToken: refresh_token
        }
      }
    });

  } catch (error) {
    console.error('로그인 에러:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '서버 오류가 발생했습니다'
    });
  }
});

// 토큰 갱신
router.post('/refresh', authenticateRefreshToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: '존재하지 않는 사용자입니다'
      });
    }

    // 새로운 Access Token 생성
    const access_token = generateAccessToken(user);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: '토큰 갱신 완료',
      data: {
        accessToken: access_token
      }
    });

  } catch (error) {
    console.error('토큰 갱신 에러:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '서버 오류가 발생했습니다'
    });
  }
});

// 로그아웃
router.post('/logout', authenticateToken, (req, res) => {
  try {
    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: '로그아웃되었습니다'
    });

  } catch (error) {
    console.error('로그아웃 에러:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: '서버 오류가 발생했습니다'
    });
  }
});

export default router;