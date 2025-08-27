import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { extractNouns } from '../utils/koreanAnalyzer.js';

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

// Mock 데이터 생성
const generateMockData = async () => {
  try {
    // 기존 데이터 삭제
    await User.deleteMany({});
    await Post.deleteMany({});
    await Comment.deleteMany({});
    await Like.deleteMany({});
    console.log('🗑️ 기존 데이터 삭제 완료');

    // Mock 사용자 생성
    const mockUsers = await User.create([
      {
        id: 'hong123',
        pw: 'password123',
        name: '홍길동',
        nickname: '길동이',
        birth_date: new Date('1990-01-01'),
        profile_image_url: null
      },
      {
        id: 'kim456', 
        pw: 'mypass456',
        name: '김철수',
        nickname: '철수야',
        birth_date: new Date('1995-05-15'),
        profile_image_url: null
      },
      {
        id: 'lee789',
        pw: 'secret789', 
        name: '이영희',
        nickname: '영희짱',
        birth_date: new Date('1992-12-25'),
        profile_image_url: null
      },
      {
        id: 'park012',
        pw: 'hello012',
        name: '박민수',
        nickname: '민수킹',
        birth_date: new Date('1988-08-08'),
        profile_image_url: null
      },
      {
        id: 'choi345',
        pw: 'world345',
        name: '최지현',
        nickname: '지현이',
        birth_date: new Date('1993-11-11'),
        profile_image_url: null
      }
    ]);
    console.log('👥 Mock 사용자 5명 생성 완료');

    // 팔로우 관계 설정
    await User.findByIdAndUpdate(mockUsers[0]._id, {
      $push: { 
        following: [mockUsers[1]._id, mockUsers[2]._id] 
      },
      $inc: { following_count: 2 }
    });

    await User.findByIdAndUpdate(mockUsers[1]._id, {
      $push: { 
        followers: [mockUsers[0]._id],
        following: [mockUsers[2]._id, mockUsers[3]._id]
      },
      $inc: { followers_count: 1, following_count: 2 }
    });

    await User.findByIdAndUpdate(mockUsers[2]._id, {
      $push: { 
        followers: [mockUsers[0]._id, mockUsers[1]._id] 
      },
      $inc: { followers_count: 2 }
    });

    console.log('👥 팔로우 관계 설정 완료');

    // Mock 게시글 생성
    const mockPosts = [
      // 시간표 관련 게시글 그룹
      {
        user_id: mockUsers[0]._id,
        title: '이번 학기 시간표 너무 빡빡하다',
        post_content: '월요일 오전부터 풀강이라니... 역시 공강은 없다. 다들 시간표 어떻게 짜셨나요?',
        post_view_count: 50,
        image_url: null
      },
      {
        user_id: mockUsers[1]._id,
        title: '시간표짜기 팁 공유',
        post_content: '성공적인 시간표를 짜는 나만의 팁을 공유합니다! 공강을 만드는 것이 핵심이죠.',
        post_view_count: 120,
        image_url: null
      },
      {
        user_id: mockUsers[2]._id,
        title: '대학생 시간표 추천해주세요',
        post_content: '복학 준비중인 대학생입니다. 꿀강의 위주로 시간표 추천 좀 부탁드려요.',
        post_view_count: 80,
        image_url: null
      },
      // 과자 관련 게시글 그룹
      {
        user_id: mockUsers[3]._id,
        title: '요즘 핫한 신상 과자 후기',
        post_content: '바삭한 식감이 너무 좋은 신상 과자를 발견했어요! 다들 간식으로 한번 드셔보세요.',
        post_view_count: 210,
        image_url: null
      },
      {
        user_id: mockUsers[4]._id,
        title: '맛있는 스낵 추천좀',
        post_content: '스트레스 받을 때 먹을만한 맛있는 초콜릿이나 스낵 추천 부탁드립니다. 단짠단짠한 과자 환영!',
        post_view_count: 150,
        image_url: null
      },
      {
        user_id: mockUsers[0]._id,
        title: '추억의 초콜릿 과자',
        post_content: '옛날에 먹던 추억의 과자 초콜릿 맛이 생각나네요. 단종된 건지 요즘은 안보여요 ㅠㅠ',
        post_view_count: 95,
        image_url: null
      }
    ];

    // analyzed_keywords_text 필드 생성
    for (const post of mockPosts) {
      const analyzed_title = await extractNouns(post.title);
      const analyzed_content = await extractNouns(post.post_content);
      post.analyzed_keywords_text = `${analyzed_title} ${analyzed_title} ${analyzed_content}`;
    }

    const createdPosts = await Post.create(mockPosts);
    console.log('📝 Mock 게시글 6개 생성 완료');

    // Mock 댓글 생성
    await Comment.create([
      {
        user_id: mockUsers[1]._id,
        post_id: createdPosts[0]._id, 
        comment_content: '저도 시간표 빡빡한데 힘내세요!'
      },
      {
        user_id: mockUsers[3]._id,
        post_id: createdPosts[3]._id,
        comment_content: '그 과자 저도 먹어봤는데 진짜 맛있어요!'
      }
    ]);
    console.log('💬 Mock 댓글 2개 생성 완료');

    // Mock 좋아요 생성
    const likePromises = [
      Like.toggleLike(mockUsers[2]._id, createdPosts[0]._id),
      Like.toggleLike(mockUsers[4]._id, createdPosts[0]._id),
      Like.toggleLike(mockUsers[1]._id, createdPosts[3]._id),
      Like.toggleLike(mockUsers[2]._id, createdPosts[3]._id)
    ];
    await Promise.all(likePromises);
    console.log('❤️ Mock 좋아요 4개 생성 완료');
    
    console.log('🎉 모든 Mock 데이터 생성 완료!');

  } catch (error) {
    console.error('❌ Mock 데이터 생성 실패:', error);
  }
};

// 실행 함수
const runMockData = async () => {
  await connectDB();
  await generateMockData();
  
  // Mongoose 모델의 인덱스 동기화 (텍스트 인덱스 포함)
  console.log('🛠️ 모든 모델 인덱스 동기화 시작...');
  await User.syncIndexes();
  await Post.syncIndexes();
  await Comment.syncIndexes();
  await Like.syncIndexes();
  console.log('✅ 모든 모델 인덱스 동기화 완료');
  
  // 최종 확인
  const userCount = await User.countDocuments();
  const postCount = await Post.countDocuments();
  const commentCount = await Comment.countDocuments();
  const likeCount = await Like.countDocuments();
  
  console.log('\n📊 생성된 Mock 데이터 현황:');
  console.log(`- 사용자: ${userCount}명`);
  console.log(`- 게시글: ${postCount}개`);
  console.log(`- 댓글: ${commentCount}개`);
  console.log(`- 좋아요: ${likeCount}개`);
  
  const usersWithStats = await User.find({}, 'id nickname user_post_count user_comment_count user_like_count followers_count following_count');
  const postsWithStats = await Post.find({}, 'title post_view_count post_comment_count post_like_count').populate('user_id', 'nickname');
  
  console.log('\n👥 사용자별 통계:');
  usersWithStats.forEach(user => {
    console.log(`- ${user.nickname}(${user.id}): 글 ${user.user_post_count}개, 댓글 ${user.user_comment_count}개, 받은 좋아요 ${user.user_like_count}개, 팔로워 ${user.followers_count}명, 팔로잉 ${user.following_count}명`);
  });
  
  console.log('\n📝 게시글별 통계:');
  postsWithStats.forEach(post => {
    console.log(`- "${post.title}" (${post.user_id.nickname}): 조회 ${post.post_view_count}, 댓글 ${post.post_comment_count}개, 좋아요 ${post.post_like_count}개`);
  });
  
  mongoose.disconnect();
  console.log('\n✅ 데이터베이스 연결 종료');
};

runMockData();
