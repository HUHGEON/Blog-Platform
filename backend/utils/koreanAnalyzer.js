import pkg from 'mecab-ya';
const mecab_instance = pkg.default ? pkg.default : pkg; // mecab 객체를 직접 임포트

/**
 * 한국어 텍스트에서 명사와 영어 단어를 추출하여 공백으로 구분된 문자열로 반환합니다.
 *
 * 이 함수는 mecab-ya 라이브러리를 사용하여 한국어 명사를 추출하고,
 * 정규식을 사용하여 텍스트 내의 영어 단어를 별도로 찾아 합친 후,
 *
 * @param {string} text - 분석할 한국어 텍스트
 * @returns {Promise<string>} - 공백으로 구분된 명사 및 영어 단어 문자열
 */
export async function extractNouns(text) {
  // 입력 텍스트가 없거나 비어있으면 빈 문자열 반환
  if (!text || text.trim() === '') {
    return '';
  }

  try {
    // mecab-ya로 한국어 명사 추출
    const koreanNouns = await new Promise((resolve, reject) => {
      mecab_instance.nouns(text, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    // 정규식을 이용한 영어 단어 추출
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).map(word => word.toLowerCase());

    // 한국어 명사와 영어 단어 목록 통합
    const combinedKeywords = [...koreanNouns, ...englishWords];

    // 추출된 키워드들을 공백으로 연결하여 반환
    return combinedKeywords.join(' ');
  } catch (error) {
    console.error('명사 및 영어 단어 추출 중 에러 발생:', error);
    // 에러 발생 시 빈 문자열 반환하여 서비스 중단 방지
    return ''; 
  }
}
