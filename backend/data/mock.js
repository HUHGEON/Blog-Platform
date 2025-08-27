import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { extractNouns } from '../utils/koreanAnalyzer.js'; // 형태소 분석기 임포트

// 모델들 import
import User from '../models/User.js';
import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import Like from '../models/Like.js';
// import Story from '../models/Story.js'; // Story 모델 임포트 제거

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
    // await Story.deleteMany({}); // Story 데이터 삭제 코드 제거
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
    // 유사한 글 추천을 위한 그룹 1 (리액트)
    const post_react_1 = {
      user_id: mockUsers[0]._id,
      title: '리액트 컴포넌트 설계에 대한 고찰',
      post_content: '재사용 가능한 리액트 컴포넌트를 만드는 방법에 대해 깊이있게 논의합니다. 상태 관리를 효율적으로 하는 방법과 커스텀 훅의 활용.',
      post_view_count: 245,
      image_url: null
    };

    const post_react_2 = {
      user_id: mockUsers[1]._id,
      title: 'React와 상태 관리의 모든 것',
      post_content: 'React에서 복잡한 애플리케이션의 상태를 효과적으로 관리하는 다양한 기법들을 살펴봅니다. Redux, Context API, Zustand 등의 라이브러리 비교.',
      post_view_count: 189,
      image_url: null
    };
    
    // 유사한 글 추천을 위한 그룹 2 (MongoDB)
    const post_mongodb_1 = {
      user_id: mockUsers[2]._id,
      title: 'MongoDB 스키마 설계 팁과 노하우',
      post_content: 'MongoDB에서 효율적이고 확장 가능한 스키마를 설계하는 방법을 공유합니다. 관계형 데이터베이스와의 차이점, NoSQL의 장단점, 임베딩 vs 참조 방식의 선택 기준 등을 실제 예제와 함께 설명합니다.',
      post_view_count: 156,
      image_url: null
    };
    
    const post_mongodb_2 = {
      user_id: mockUsers[3]._id,
      title: '노드JS와 MongoDB 연동하기',
      post_content: 'Node.js 환경에서 MongoDB 데이터베이스를 연동하는 방법을 단계별로 설명합니다. Mongoose를 사용한 데이터 모델링과 CRUD 연산 구현.',
      post_view_count: 98,
      image_url: null
    };

    const mockPosts = [
        post_react_1,
        post_react_2,
        post_mongodb_1,
        post_mongodb_2,
      {
        user_id: mockUsers[4]._id,
        title: 'CSS Grid와 Flexbox 마스터하기',
        post_content: '모던 CSS 레이아웃의 핵심인 Grid와 Flexbox를 완전히 마스터해보겠습니다. 언제 Grid를 사용하고 언제 Flexbox를 사용해야 하는지, 각각의 장단점과 사용 사례를 실제 예제와 함께 설명합니다. 반응형 웹 디자인을 위한 실용적인 패턴들도 포함되어 있습니다.',
        post_view_count: 234,
        image_url: 'http://localhost:5001/uploads/css-grid-flexbox.png'
      }
    ];

    // analyzed_keywords_text 필드 생성
    for (const post of mockPosts) {
      const analyzed_title = await extractNouns(post.title);
      const analyzed_content = await extractNouns(post.post_content);
      post.analyzed_keywords_text = `${analyzed_title} ${analyzed_title} ${analyzed_title} ${analyzed_content}`;
    }

    await Post.create(mockPosts);
    console.log('📝 Mock 게시글 5개 생성 완료');

    // Mock 댓글 생성
    const mockComments = await Comment.create([
      {
        user_id: mockUsers[1]._id,
        post_id: mockPosts[0]._id, // 리액트 게시글에 댓글
        comment_content: '리액트 컴포넌트 구조화에 많은 도움이 됐습니다.'
      },
      {
        user_id: mockUsers[0]._id,
        post_id: mockPosts[2]._id, // MongoDB 게시글에 댓글
        comment_content: 'MongoDB 스키마 설계 팁이 유용하네요.'
      }
    ]);
    console.log('💬 Mock 댓글 2개 생성 완료');

    // Mock 좋아요 생성 (토글 기능 사용)
    const likePromises = [
      Like.toggleLike(mockUsers[1]._id, mockPosts[0]._id),
      Like.toggleLike(mockUsers[2]._id, mockPosts[0]._id),
      Like.toggleLike(mockUsers[0]._id, mockPosts[1]._id)
    ];
    await Promise.all(likePromises);
    console.log('❤️ Mock 좋아요 3개 생성 완료');
    
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
  
  // 통계 확인
  const usersWithStats = await User.find({}, 'id nickname user_post_count user_comment_count user_like_count followers_count following_count');
  const postsWithStats = await Post.find({}, 'title post_view_count post_comment_count post_like_count').populate('user_id', 'nickname');
  
  console.log('\n📊 생성된 Mock 데이터 현황:');
  console.log(`- 사용자: ${userCount}명`);
  console.log(`- 게시글: ${postCount}개`);
  console.log(`- 댓글: ${commentCount}개`);
  console.log(`- 좋아요: ${likeCount}개`);
  
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