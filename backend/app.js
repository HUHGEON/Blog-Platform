import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// 라우터 import
import authRoutes from './routes/auths.js';
import postRoutes from './routes/posts.js';
import commentRoutes from './routes/comments.js';
import likeRoutes from './routes/likes.js';
import followRoutes from './routes/follows.js';
import userRoutes from './routes/users.js';
import messageRoutes from './routes/messages.js';
import HTTP_STATUS from './constants/httpStatusCodes.js';


dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// 미들웨어 설정
app.use(helmet()); // 보안 헤더 설정
app.use(cors()); // CORS 허용
app.use(express.json()); // JSON 파싱
app.use(express.urlencoded({ extended: true })); // URL 인코딩

// 업로드 이미지 접근
app.use('/uploads', express.static('uploads'));

// MongoDB 연결
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB 연결 성공'))
  .catch(err => console.error('MongoDB 연결 실패:', err));

// 라우터 설정
app.use('/api/auths', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/likes', likeRoutes);
app.use('/api/follows', followRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);

app.get('/', (req, res) => {
  res.json({ 
    message: '블로그 플랫폼 서버가 실행중입니다!',
    port: PORT 
  });
});

app.use('*', (req, res) => {
  res.status(HTTP_STATUS.NOT_FOUND).json({
    success: false,
    message: '요청하신 경로를 찾을 수 없습니다'
  });
});

app.use((error, req, res, next) => {
  console.error('서버 에러:', error);
  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: '서버에 오류가 발생했습니다'
  });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});