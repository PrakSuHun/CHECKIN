const { Client } = require('@notionhq/client');

// Vercel 환경 변수에서 Notion 설정 불러오기
const notion = new Client({ auth: process.env.NOTION_API_KEY });
// 새로 만든 '현장 출석용 데이터베이스'의 ID를 Vercel에 넣으시면 됩니다.
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

export default async function handler(req, res) {
  // POST 요청만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: '잘못된 요청 방식입니다.' });
  }

  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: '이름을 입력해 주세요.' });
  }

  try {
    // 1. 노션 데이터베이스에서 이름 검색
    // 🚨 주의: 노션 데이터베이스의 이름 열(기본 속성) 이름이 정확히 '이름'이어야 합니다.
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        property: '이름',
        title: {
          equals: name,
        },
      },
    });

    // 2. 명단에 없을 경우
    if (response.results.length === 0) {
      return res.status(404).json({ success: false, message: '명단에 존재하지 않습니다.' });
    }

    const page = response.results[0];
    const pageId = page.id;
    
    // 3. 팀 번호 가져오기
    // 🚨 주의: 노션 열 이름이 정확히 '팀번호' 이어야 합니다. 
    let teamNumber = "미배정";
    try {
        const teamProp = page.properties['팀번호'];
        // 속성 타입에 따라 다르게 값을 가져옵니다.
        if (teamProp.type === 'rich_text' && teamProp.rich_text.length > 0) {
            teamNumber = teamProp.rich_text[0].plain_text;
        } else if (teamProp.type === 'select' && teamProp.select) {
            teamNumber = teamProp.select.name;
        } else if (teamProp.type === 'number' && teamProp.number !== null) {
            teamNumber = teamProp.number;
        }
    } catch (e) {
        console.log("팀 번호를 읽어오지 못했습니다. 속성 이름을 확인하세요.");
    }

    // 4. 출석 체크 업데이트
    // 🚨 주의: 노션 체크박스 열 이름이 정확히 '출석' 이어야 합니다.
    await notion.pages.update({
      page_id: pageId,
      properties: {
        '출석': {
          checkbox: true,
        },
      },
    });

    // 5. 프론트엔드로 성공 메시지와 팀 번호 반환
    return res.status(200).json({ 
        success: true, 
        team: teamNumber 
    });

  } catch (error) {
    console.error('Notion API 에러:', error);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}
