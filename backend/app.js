import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

import './models/User.js';
import './models/Post.js';
import './models/Comment.js';
import './models/Like.js';
import authRoutes from './routes/auths.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// 미들웨어 설정
app.use(helmet()); // 보안 헤더 설정
app.use(cors()); // CORS 허용
app.use(express.json()); // JSON 파싱
app.use(express.urlencoded({ extended: true })); // URL 인코딩

// MongoDB 연결
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB 연결 성공'))
  .catch(err => console.error('MongoDB 연결 실패:', err));

// 기본 라우트
app.get('/', (req, res) => {
  res.json({ 
    message: '블로그 플랫폼 서버가 실행중입니다!',
    port: PORT 
  });
});

app.use('/api/auth', authRoutes);

// 서버 시작
app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});