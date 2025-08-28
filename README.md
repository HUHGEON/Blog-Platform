# Blog-Platform

간단한 블로그 플랫폼 백엔드 프로젝트 
사용자 인증, 게시글 관리, 댓글, 좋아요, 팔로우, 쪽지, 스토리 기능을 제공

---

##  기술 스택

- **프레임워크**: Express.js  
- **데이터베이스**: MongoDB (Mongoose)  
- **인증**: JWT (JSON Web Tokens)  
- **파일 업로드**: Multer  
- **기타**: bcryptjs(암호화), mecab-ya(형태소 분석을 위해 명사 추출), moment-timezone  

---

##  프로젝트 구조

```bash
backend/
├── app.js               # 서버의 진입점 (Express 앱 설정 및 라우터 연결)
├── .env                 # 환경 변수 (DB URI, JWT Secret 등)
├── middlewares/         # 요청 처리 전후에 실행되는 미들웨어
│   ├── auth.js          # JWT 인증 관련 미들웨어
│   └── upload.js        # Multer를 이용한 파일 업로드 미들웨어
├── models/              # MongoDB 컬렉션 스키마 정의
│   ├── User.js          # 사용자 모델
│   ├── Post.js          # 게시글 모델
│   ├── Comment.js       # 댓글 모델
│   ├── Like.js          # 좋아요 모델
│   ├── Message.js       # 쪽지 모델
│   └── Story.js         # 스토리 모델
├── routes/              # API 라우팅 정의
│   ├── auths.js         # 인증 (회원가입, 로그인, 토큰 갱신)
│   ├── posts.js         # 게시글 관련
│   ├── comments.js      # 댓글 관련
│   ├── likes.js         # 좋아요 관련
│   ├── follows.js       # 팔로우 관련
│   ├── users.js         # 사용자 정보 관련
│   ├── messages.js      # 쪽지 관련
│   └── stories.js       # 스토리 관련
├── utils/               # 유틸리티 함수
│   ├── jwt.js           # JWT 토큰 생성/검증
│   ├── koreanAnalyzer.js# 한국어 형태소 분석
│   └── timeFormatter.js # 시간 포맷팅
├── constants/           # 상수 정의
│   └── httpStatusCodes.js # HTTP 상태 코드 상수
├── data/                # 데이터 관리 스크립트
│   ├── clear.js         # 모든 데이터 삭제
│   └── mock.js          # Mock 데이터 생성
└── uploads/             # 이미지 파일 저장 디렉터리 (Git 추적 제외)

---

## 주요 API 엔드포인트

### Auth (인증)
- **회원가입 (`POST /api/auths/signup`)**  
  사용자가 이메일, 비밀번호, 닉네임을 입력하여 계정을 생성 

- **로그인 (`POST /api/auths/login`)**  
  이메일과 비밀번호를 입력하여 로그인하고, JWT 토큰을 발급

---

### 📝 Posts (게시글)
- **게시글 작성 (`POST /api/posts`)**  
  인증된 사용자가 새로운 게시글을 작성 (JWT 토큰 필요)  

- **게시글 상세 조회 (`GET /api/posts/:id`)**  
  특정 게시글의 상세 내용을 조회  

- **게시글 검색 (`GET /api/posts/search`)**  
  키워드를 이용하여 게시글을 검색 

---

### Users (사용자)
- **사용자 프로필 조회 (`GET /api/users/:userId`)**  
  특정 사용자의 프로필 정보를 조회

- **사용자의 게시글 목록 조회 (`GET /api/users/:userId/posts`)**  
  특정 사용자가 작성한 게시글 목록을 조회  

---

### 📷 Stories (스토리)
- **스토리 작성 (`POST /api/stories`)**  
  로그인한 사용자가 이미지를 업로드하여 스토리를 작성 (24시간 후 자동 삭제)  

---

### Messages (쪽지)
- **쪽지 전송 (`POST /api/messages/send`)**  
  인증된 사용자가 다른 사용자에게 쪽지를 보냅니다.  

- **받은 쪽지함 조회 (`GET /api/messages/inbox`)**  
  로그인한 사용자가 받은 쪽지 목록을 조회합니다.  

---

```
## 실행 방법
### 의존성 설치
```bash
npm install
```
### 백엔드 서버실행
```bash
npm run dev
```
### 프론트 서버실행
```bash
http-server -p 5002
```
