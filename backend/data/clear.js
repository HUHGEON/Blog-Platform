import mongoose from 'mongoose';
import dotenv from 'dotenv';

// 모델들 import
import User from '../models/User.js';
import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import Like from '../models/Like.js';

dotenv.config();

// MongoDB 연결
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB 연결 성공');
  } catch (error) {
    console.error('❌ MongoDB 연결 실패:', error);
    process.exit(1);
  }
};

// 데이터만 삭제 (컬렉션은 유지)
const clearData = async () => {
  try {
    console.log('🗑️ 데이터를 삭제합니다 (컬렉션은 유지)...');
    
    // 각 컬렉션의 데이터만 삭제
    const userResult = await User.deleteMany({});
    console.log(`✅ 사용자 데이터 ${userResult.deletedCount}개 삭제 완료`);
    
    const postResult = await Post.deleteMany({});
    console.log(`✅ 게시글 데이터 ${postResult.deletedCount}개 삭제 완료`);
    
    const commentResult = await Comment.deleteMany({});
    console.log(`✅ 댓글 데이터 ${commentResult.deletedCount}개 삭제 완료`);
    
    const likeResult = await Like.deleteMany({});
    console.log(`✅ 좋아요 데이터 ${likeResult.deletedCount}개 삭제 완료`);
    
    console.log('🎉 모든 데이터 삭제 완료! (컬렉션은 유지됨)');
    
    // 삭제 확인
    const userCount = await User.countDocuments();
    const postCount = await Post.countDocuments();
    const commentCount = await Comment.countDocuments();
    const likeCount = await Like.countDocuments();
    
    console.log('\n📊 삭제 후 현황:');
    console.log(`- 사용자: ${userCount}명`);
    console.log(`- 게시글: ${postCount}개`);
    console.log(`- 댓글: ${commentCount}개`);
    console.log(`- 좋아요: ${likeCount}개`);
    
  } catch (error) {
    console.error('❌ 데이터 삭제 실패:', error);
  }
};

// 실행
const runClear = async () => {
  try {
    await connectDB();
    
    console.log('⚠️  주의: 모든 데이터가 삭제됩니다! (컬렉션은 유지)');
    console.log('3초 후 삭제 시작...');
    
    // 3초 대기
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    await clearData();
    
  } catch (error) {
    console.error('❌ 전체 실행 실패:', error);
  } finally {
    mongoose.disconnect();
    console.log('✅ 데이터베이스 연결 종료');
  }
};

runClear();