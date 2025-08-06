import { verifyToken, isAccessToken } from '../utils/jwt.js';
import HTTP_STATUS from '../constants/httpStatusCodes.js';
import User from '../models/User.js';

// Access Token 검증 미들웨어 (로그인 필수)
export const authenticateToken = async (req, res, next) => {
  try {
    // 1. Authorization 헤더에서 토큰 추출
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: '로그인이 필요합니다'
      });
    }

    // 2. Bearer 토큰 형식 확인
    const token = authHeader.split(' ')[1]; //  Bearer 토큰값 이런식의 구조에서 토큰만 추출
    
    if (!token) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: '토큰이 제공되지 않았습니다'
      });
    }

    // 3. 토큰 검증
    const decoded = verifyToken(token);
    
    // 4. Access Token인지 확인
    if (!isAccessToken(token)) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Access Token이 필요합니다'
      });
    }

    // 5. 사용자 존재 여부 확인
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: '존재하지 않는 사용자입니다'
      });
    }

    // 6. 요청 객체에 사용자 정보 저장
    req.user = {
      id: user._id,
      userId: user.id,
      username: user.nickname,
      email: user.email || null
    };
    
    // 7. 원본 토큰도 저장 (로그아웃 시 필요)
    req.token = token;

    next();

  } catch (error) {
    // 토큰 관련 에러 처리
    if (error.message === '토큰이 만료되었습니다') {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: '토큰이 만료되었습니다. 다시 로그인해주세요',
        code: 'TOKEN_EXPIRED'
      });
    } else if (error.message === '유효하지 않은 토큰입니다') {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: '유효하지 않은 토큰입니다',
        code: 'INVALID_TOKEN'
      });
    } else {
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: '토큰 검증 중 오류가 발생했습니다'
      });
    }
  }
};

// Refresh Token 검증 미들웨어
export const authenticateRefreshToken = async (req, res, next) => {
  try {
    // 1. 요청 본문에서 Refresh Token 추출
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Refresh Token이 필요합니다'
      });
    }

    // 2. 토큰 검증
    const decoded = verifyToken(refreshToken);
    
    // 3. Refresh Token인지 확인
    if (decoded.type !== 'refresh') {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Refresh Token이 아닙니다'
      });
    }

    // 4. 사용자 존재 여부 확인
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: '존재하지 않는 사용자입니다'
      });
    }

    // 5. 요청 객체에 사용자 정보 저장
    req.user = {
      id: user._id,
      userId: user.id,
      username: user.nickname
    };

    next();

  } catch (error) {
    if (error.message === '토큰이 만료되었습니다') {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: 'Refresh Token이 만료되었습니다. 다시 로그인해주세요',
        code: 'REFRESH_TOKEN_EXPIRED'
      });
    } else {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        message: '유효하지 않은 Refresh Token입니다'
      });
    }
  }
};

export default {
  authenticateToken,
  authenticateRefreshToken
};