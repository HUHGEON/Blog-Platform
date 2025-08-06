import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// Access Token 생성
export const generateAccessToken = (user) => {
  const payload = {
    id: user._id,
    userId: user.id,
    username: user.nickname,
    type: 'access'
  };
  
  return jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '1h',
      issuer: 'blog-platform'
    }
  );
};

// Refresh Token 생성
export const generateRefreshToken = (user) => {
  const payload = {
    id: user._id,
    userId: user.id,
    type: 'refresh'
  };
  
  return jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      issuer: 'blog-platform'
    }
  );
};

// 토큰 검증
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('토큰이 만료되었습니다');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('유효하지 않은 토큰입니다');
    } else {
      throw new Error('토큰 검증에 실패했습니다');
    }
  }
};

// 토큰에서 사용자 정보 추출
export const extractUserFromToken = (token) => {
  try {
    const decoded = verifyToken(token);
    return {
      id: decoded.id,
      userId: decoded.userId,
      username: decoded.username,
      type: decoded.type
    };
  } catch (error) {
    throw error;
  }
};

// 토큰 만료 시간 확인
export const getTokenExpiry = (token) => {
  try {
    const decoded = jwt.decode(token);
    return new Date(decoded.exp * 1000); // exp는 초 단위이므로 1000을 곱해 밀리초로 변환
  } catch (error) {
    throw new Error('토큰 디코딩에 실패했습니다');
  }
};

// Access Token인지 확인
export const isAccessToken = (token) => {
  try {
    const decoded = verifyToken(token);
    return decoded.type === 'access';
  } catch (error) {
    return false;
  }
};

// Refresh Token인지 확인
export const isRefreshToken = (token) => {
  try {
    const decoded = verifyToken(token);
    return decoded.type === 'refresh';
  } catch (error) {
    return false;
  }
};

export default {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  extractUserFromToken,
  getTokenExpiry,
  isAccessToken,
  isRefreshToken
};