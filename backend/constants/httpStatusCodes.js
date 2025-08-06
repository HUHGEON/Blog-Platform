// HTTP 상태 코드 상수 정의
export const HTTP_STATUS = {
  // 2xx Success - 요청이 성공적으로 처리됨
  OK: 200,                    // 일반적인 성공 응답 (조회, 수정, 로그인 등)
  CREATED: 201,               // 새로운 리소스 생성 성공 (회원가입, 게시글 작성 등)
  NO_CONTENT: 204,            // 요청처리 완료, 반환할 데이터 없음 (삭제 성공 등)
  
  // 4xx Client Error - 클라이언트 요청에 오류가 있음
  BAD_REQUEST: 400,           // 잘못된 요청 형식 (필수 필드 누락, 잘못된 데이터 등)
  UNAUTHORIZED: 401,          // 인증 실패 (로그인 필요, 토큰 만료/무효 등)
  FORBIDDEN: 403,             // 인증은 되었지만 권한 없음 (타인 게시글 수정 시도 등)
  NOT_FOUND: 404,             // 요청한 리소스를 찾을 수 없음 (존재하지 않는 게시글 등)
  CONFLICT: 409,              // 리소스 충돌 (ID/닉네임 중복, 이미 좋아요 누른 게시글 등)
  UNPROCESSABLE_ENTITY: 422,  // 문법은 맞지만 처리할 수 없는 요청 (유효성 검증 실패 등)
  
  // 5xx Server Error - 서버에 오류가 발생함
  INTERNAL_SERVER_ERROR: 500, // 서버 내부 오류 (DB 연결 실패, 예상치 못한 에러 등)
  SERVICE_UNAVAILABLE: 503    // 서비스 일시적 이용 불가 (서버 과부하, 점검 중 등)
};

export default HTTP_STATUS;