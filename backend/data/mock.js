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
        birth_date: new Date('1990-01-01')
      },
      {
        id: 'kim456', 
        pw: 'mypass456',
        name: '김철수',
        nickname: '철수야',
        birth_date: new Date('1995-05-15')
      },
      {
        id: 'lee789',
        pw: 'secret789', 
        name: '이영희',
        nickname: '영희짱',
        birth_date: new Date('1992-12-25')
      },
      {
        id: 'park012',
        pw: 'hello012',
        name: '박민수',
        nickname: '민수킹',
        birth_date: new Date('1988-08-08')
      },
      {
        id: 'choi345',
        pw: 'world345',
        name: '최지현',
        nickname: '지현이',
        birth_date: new Date('1993-11-11')
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
    const mockPosts = await Post.create([
      {
        user_id: mockUsers[0]._id,
        title: 'JavaScript 기초부터 고급까지',
        post_content: `JavaScript의 기본 문법부터 고급 개념까지 차근차근 알아보겠습니다.

변수 선언, 함수 정의, 객체와 배열 다루기 등 기초적인 내용부터 시작해서 비동기 처리, 클로저, 프로토타입 등 고급 개념까지 다룰 예정입니다.

프론트엔드 개발을 시작하시는 분들에게 도움이 되길 바랍니다!`,
        post_view_count: 245,
        image_url: null
      },
      {
        user_id: mockUsers[1]._id,
        title: 'React 컴포넌트 설계 패턴',
        post_content: `React에서 재사용 가능한 컴포넌트를 만드는 방법을 설명합니다.

useState, useEffect 등의 훅부터 시작해서 커스텀 훅 만들기, 컴포넌트 합성 패턴, 렌더 프롭 패턴 등을 다룰 예정입니다.

실제 프로젝트에서 사용할 수 있는 실용적인 예제들을 포함했습니다.`,
        post_view_count: 189,
        image_url: 'http://localhost:5001/uploads/react-components.jpg'
      },
      {
        user_id: mockUsers[0]._id,
        title: 'Node.js와 Express로 REST API 만들기',
        post_content: `Node.js 환경에서 Express 프레임워크를 사용해 REST API를 구축하는 전체 과정을 설명합니다.

라우팅, 미들웨어 사용법, 데이터베이스 연동, 인증/인가, 에러 핸들링까지 실무에서 필요한 모든 내용을 다룹니다.

MongoDB와 Mongoose를 사용한 데이터 관리도 함께 설명합니다.`,
        post_view_count: 312,
        image_url: null
      },
      {
        user_id: mockUsers[2]._id,
        title: 'MongoDB 스키마 설계 팁과 노하우',
        post_content: `MongoDB에서 효율적이고 확장 가능한 스키마를 설계하는 방법을 공유합니다.

관계형 데이터베이스와의 차이점, NoSQL의 장단점, 임베딩 vs 참조 방식의 선택 기준 등을 실제 예제와 함께 설명합니다.

성능 최적화를 위한 인덱싱 전략도 포함되어 있습니다.`,
        post_view_count: 156,
        image_url: null
      },
      {
        user_id: mockUsers[3]._id,
        title: '웹 개발자를 위한 Git 완벽 가이드',
        post_content: `Git의 기본 개념부터 고급 기능까지 웹 개발자가 알아야 할 모든 것을 정리했습니다.

브랜치 전략, 커밋 메시지 작성법, 충돌 해결, 리베이스와 머지의 차이 등 실무에서 자주 마주치는 상황들을 다룹니다.

GitHub를 활용한 협업 방법도 함께 설명합니다.`,
        post_view_count: 98,
        image_url: null
      },
      {
        user_id: mockUsers[4]._id,
        title: 'CSS Grid와 Flexbox 마스터하기',
        post_content: `모던 CSS 레이아웃의 핵심인 Grid와 Flexbox를 완전히 마스터해보겠습니다.

언제 Grid를 사용하고 언제 Flexbox를 사용해야 하는지, 각각의 장단점과 사용 사례를 실제 예제와 함께 설명합니다.

반응형 웹 디자인을 위한 실용적인 패턴들도 포함되어 있습니다.`,
        post_view_count: 234,
        image_url: 'http://localhost:5001/uploads/css-grid-flexbox.png'
      }
    ]);
    console.log('📝 Mock 게시글 6개 생성 완료');

    // Mock 댓글 생성
    const mockComments = await Comment.create([
      {
        user_id: mockUsers[1]._id,
        post_id: mockPosts[0]._id,
        comment_content: '정말 자세하고 유용한 강의네요! JavaScript 공부에 많은 도움이 됐습니다. 감사합니다 👍'
      },
      {
        user_id: mockUsers[2]._id,
        post_id: mockPosts[0]._id,
        comment_content: '초보자도 이해하기 쉽게 설명해주셨어요. 다음 편도 기대됩니다!'
      },
      {
        user_id: mockUsers[3]._id,
        post_id: mockPosts[0]._id,
        comment_content: '클로저 부분이 특히 도움 됐어요. 더 자세한 예제가 있다면 좋겠네요.'
      },
      {
        user_id: mockUsers[0]._id,
        post_id: mockPosts[1]._id,
        comment_content: 'React 컴포넌트 패턴 정말 유용하네요! 실제 프로젝트에 바로 적용해봤습니다.'
      },
      {
        user_id: mockUsers[2]._id,
        post_id: mockPosts[1]._id,
        comment_content: '커스텀 훅 만드는 방법이 인상적이었어요. 코드 재사용성이 정말 좋아지겠네요.'
      },
      {
        user_id: mockUsers[4]._id,
        post_id: mockPosts[1]._id,
        comment_content: '렌더 프롭 패턴은 처음 알았는데, 정말 강력한 패턴이네요!'
      },
      {
        user_id: mockUsers[1]._id,
        post_id: mockPosts[2]._id,
        comment_content: 'Express 미들웨어 설명이 정말 명확해요. 헷갈렸던 부분이 해결됐습니다.'
      },
      {
        user_id: mockUsers[3]._id,
        post_id: mockPosts[2]._id,
        comment_content: 'REST API 설계 부분이 특히 도움됐어요. 실무에서 바로 써먹을게요!'
      },
      {
        user_id: mockUsers[0]._id,
        post_id: mockPosts[3]._id,
        comment_content: 'MongoDB 스키마 설계할 때 항상 고민이었는데, 좋은 가이드라인 감사해요.'
      },
      {
        user_id: mockUsers[4]._id,
        post_id: mockPosts[3]._id,
        comment_content: '임베딩 vs 참조 방식 선택 기준이 명확해졌어요. 큰 도움 됐습니다!'
      },
      {
        user_id: mockUsers[2]._id,
        post_id: mockPosts[4]._id,
        comment_content: 'Git 브랜치 전략 부분이 정말 유용했어요. 팀 프로젝트에 적용해보겠습니다.'
      },
      {
        user_id: mockUsers[0]._id,
        post_id: mockPosts[5]._id,
        comment_content: 'Grid와 Flexbox 차이점을 이렇게 명확하게 설명해주시니 이해가 쏙쏙 들어요!'
      }
    ]);
    console.log('💬 Mock 댓글 12개 생성 완료');

    // Mock 좋아요 생성 (토글 기능 사용)
    const likePromises = [
      Like.toggleLike(mockUsers[1]._id, mockPosts[0]._id), // JS 기초 글
      Like.toggleLike(mockUsers[2]._id, mockPosts[0]._id),
      Like.toggleLike(mockUsers[3]._id, mockPosts[0]._id),
      Like.toggleLike(mockUsers[4]._id, mockPosts[0]._id),
      
      Like.toggleLike(mockUsers[0]._id, mockPosts[1]._id), // React 컴포넌트 글
      Like.toggleLike(mockUsers[2]._id, mockPosts[1]._id),
      Like.toggleLike(mockUsers[4]._id, mockPosts[1]._id),
      
      Like.toggleLike(mockUsers[1]._id, mockPosts[2]._id), // Node.js API 글
      Like.toggleLike(mockUsers[3]._id, mockPosts[2]._id),
      Like.toggleLike(mockUsers[4]._id, mockPosts[2]._id),
      
      Like.toggleLike(mockUsers[0]._id, mockPosts[3]._id), // MongoDB 스키마 글
      Like.toggleLike(mockUsers[4]._id, mockPosts[3]._id),
      
      Like.toggleLike(mockUsers[2]._id, mockPosts[4]._id), // Git 가이드 글
      
      Like.toggleLike(mockUsers[0]._id, mockPosts[5]._id), // CSS Grid 글
      Like.toggleLike(mockUsers[1]._id, mockPosts[5]._id),
      Like.toggleLike(mockUsers[3]._id, mockPosts[5]._id)
    ];

    await Promise.all(likePromises);
    console.log('❤️ Mock 좋아요 16개 생성 완료');

    console.log('🎉 모든 Mock 데이터 생성 완료!');

  } catch (error) {
    console.error('❌ Mock 데이터 생성 실패:', error);
  }
};

// 실행 함수
const runMockData = async () => {
  await connectDB();
  await generateMockData();
  
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