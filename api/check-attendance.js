const { Client } = require('@notionhq/client');

// Vercel 환경 변수에서 값 가져오기
const notion = new Client({ auth: process.env.NOTION_API_KEY });
// ⭐️ Vercel 환경 변수에 방금 캡처해서 보여주신 이 '출석체크' 데이터베이스의 ID를 넣으셔야 합니다.
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: '잘못된 요청 방식입니다.' });
  }

  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: '이름을 입력해 주세요.' });
  }

  try {
    // 1. 노션 데이터베이스에서 이름 검색
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        property: '이름', // 캡처 화면의 'Aa 이름' 열과 완벽 일치
        title: {
          equals: name,
        },
      },
    });

    if (response.results.length === 0) {
      return res.status(404).json({ success: false, message: '명단에 존재하지 않습니다.' });
    }

    const page = response.results[0];
    const pageId = page.id;
    
    // 2. 팀 번호 가져오기
    let teamNumber = "미배정";
    try {
        const teamProp = page.properties['팀번호']; // 캡처 화면의 '팀번호' 텍스트 열
        // 텍스트 속성이므로 rich_text로 값을 가져옵니다.
        if (teamProp.type === 'rich_text' && teamProp.rich_text.length > 0) {
            teamNumber = teamProp.rich_text[0].plain_text;
        } 
    } catch (e) {
        console.log("팀 번호를 읽어오지 못했습니다. 값이 비어있을 수 있습니다.");
    }

    // 3. 출석 체크박스 업데이트
    await notion.pages.update({
      page_id: pageId,
      properties: {
        '출석': { // 캡처 화면의 '출석' 체크박스 열과 완벽 일치
          checkbox: true,
        },
      },
    });

    // 4. 성공 응답
    return res.status(200).json({ 
        success: true, 
        team: teamNumber 
    });

  } catch (error) {
    console.error('Notion API 에러:', error);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}
