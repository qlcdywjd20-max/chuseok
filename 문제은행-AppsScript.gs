/** 온마을 문제은행: Google Sheets > 확장 프로그램 > Apps Script에 붙여 넣으세요. */
const SHEET_NAME = '문제은행';
const HEADERS = ['칸번호','유형','제목','문제','보기1','보기2','보기3','보기4','정답','미션내용','제한시간','사용여부'];
function doGet() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('문제은행 시트를 먼저 만들어 주세요.');
    const values = sheet.getDataRange().getValues();
    const header = values.shift().map(String);
    HEADERS.forEach(name => { if (!header.includes(name)) throw new Error('필수 열이 없습니다: '+name); });
    const rows = values.filter(row => row[header.indexOf('칸번호')] !== '').map(row => {
      const item = {};
      HEADERS.forEach(name => { item[name] = row[header.indexOf(name)]; });
      return item;
    });
    return jsonOutput({rows: rows, updatedAt: new Date().toISOString()});
  } catch (error) { return jsonOutput({error: error.message}); }
}
function jsonOutput(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
// setupQuestionBank를 편집기에서 한 번 실행하면 기본 29개 문제·미션이 생성됩니다.
// 기존 데이터가 있는 시트에는 쓰지 않도록 보호합니다.
function setupQuestionBank() {
  const book=SpreadsheetApp.getActiveSpreadsheet();
  let sheet=book.getSheetByName(SHEET_NAME);
  if(sheet && sheet.getLastRow()>0)throw new Error('기존 문제은행이 있습니다. 내용을 직접 수정하세요.');
  if(!sheet)sheet=book.insertSheet(SHEET_NAME);
  sheet.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);
  sheet.getRange(2,1,SEED_ROWS.length,HEADERS.length).setValues(SEED_ROWS);
  sheet.setFrozenRows(1);
  sheet.getRange(1,1,1,HEADERS.length).setBackground('#e7ba68').setFontWeight('bold');
  sheet.getDataRange().setFontSize(12).setWrap(true);
  sheet.setColumnWidth(1,80);sheet.setColumnWidth(2,120);sheet.setColumnWidth(3,190);
  sheet.setColumnWidth(4,350);sheet.setColumnWidths(5,4,140);sheet.setColumnWidth(10,370);
  sheet.getRange(2,12,SEED_ROWS.length,1).insertCheckboxes();
  sheet.getRange(2,12,SEED_ROWS.length,1).setValues(SEED_ROWS.map(row=>[row[11]]));
}
const SEED_ROWS = [
  [
    1,
    "추석퀴즈",
    "풍성한 한가위",
    "추석에 먹는 대표적인 음식은?",
    "떡국",
    "팥빙수",
    "붕어빵",
    "송편",
    4,
    "",
    30,
    true
  ],
  [
    2,
    "우리동네퀴즈",
    "정겨운 우리동네",
    "우리 동네에서 책을 빌려 읽는 곳은?",
    "목욕탕",
    "정류장",
    "도서관",
    "우체국",
    3,
    "",
    30,
    true
  ],
  [
    3,
    "추억퀴즈",
    "그때 그 시절",
    "옛날에 옷감을 두드려 펴던 도구는?",
    "체",
    "다듬이방망이",
    "주걱",
    "국자",
    2,
    "",
    30,
    true
  ],
  [
    4,
    "노래",
    "노래 한 소절",
    "",
    "",
    "",
    "",
    "",
    "",
    "♪ 「고향의 봄」 첫 소절을\n다 함께 불러주세요!",
    30,
    true
  ],
  [
    5,
    "팀미션",
    "사랑을 모아 하트!",
    "",
    "",
    "",
    "",
    "",
    "",
    "우리 팀 모두 머리 위로\n커다란 하트를 만들어주세요!",
    30,
    true
  ],
  [
    6,
    "복주머니찬스",
    "복주머니가 열렸어요!",
    "",
    "",
    "",
    "",
    "",
    "",
    "옆 사람에게 따뜻한 덕담 한마디!\n“올 추석도 행복하세요!”",
    30,
    true
  ],
  [
    7,
    "특별찬스",
    "관장님이 쏜다!",
    "",
    "",
    "",
    "",
    "",
    "",
    "[점수:2] 관장님이 쏜다!",
    30,
    true
  ],
  [
    8,
    "우리동네퀴즈",
    "정겨운 우리동네",
    "편지나 소포를 보내는 곳은?",
    "우체국",
    "미용실",
    "빵집",
    "도서관",
    1,
    "",
    30,
    true
  ],
  [
    9,
    "노래",
    "흥겨운 노래 한 소절",
    "",
    "",
    "",
    "",
    "",
    "",
    "♪ 「아리랑」 한 소절을\n박수에 맞춰 함께 불러주세요!",
    30,
    true
  ],
  [
    10,
    "추억퀴즈",
    "그때 그 시절",
    "종이와 대나무 살로 만들어 하늘에 날리는 것은?",
    "제기",
    "공기돌",
    "연",
    "팽이",
    3,
    "",
    30,
    true
  ],
  [
    11,
    "추석퀴즈",
    "풍성한 한가위",
    "추석의 다른 이름은 무엇일까요?",
    "설날",
    "한가위",
    "단오",
    "동지",
    2,
    "",
    30,
    true
  ],
  [
    12,
    "응원전",
    "다 함께 응원타임!",
    "",
    "",
    "",
    "",
    "",
    "",
    "우리 팀도, 옆 팀도 힘내세요!\n다 함께 박수 치며 응원해요!",
    30,
    true
  ],
  [
    13,
    "추억퀴즈",
    "그때 그 시절",
    "밥알이 동동 떠 있는 달콤한 전통 음료는?",
    "커피",
    "탄산수",
    "레몬차",
    "식혜",
    4,
    "",
    30,
    true
  ],
  [
    14,
    "복주머니찬스",
    "웃음꽃이 피었습니다!",
    "",
    "",
    "",
    "",
    "",
    "",
    "옆 사람과 눈을 맞추고\n활짝 웃으며 인사해주세요!",
    30,
    true
  ],
  [
    15,
    "팀미션",
    "우리 팀의 멋진 구호!",
    "",
    "",
    "",
    "",
    "",
    "",
    "우리 팀 이름을 함께 외치고\n“파이팅!”으로 마무리해주세요!",
    30,
    true
  ],
  [
    16,
    "추석퀴즈",
    "풍성한 한가위",
    "추석 밤하늘에 뜨는 둥근 달은?",
    "보름달",
    "초승달",
    "반달",
    "그믐달",
    1,
    "",
    30,
    true
  ],
  [
    17,
    "우리동네퀴즈",
    "정겨운 우리동네",
    "우리 동네에서 버스를 기다리는 곳은?",
    "횡단보도",
    "주방",
    "운동장",
    "버스 정류장",
    4,
    "",
    30,
    true
  ],
  [
    18,
    "추억퀴즈",
    "그때 그 시절",
    "발로 톡톡 차며 즐기던 전통놀이는?",
    "공기놀이",
    "씨름",
    "제기차기",
    "윷놀이",
    3,
    "",
    30,
    true
  ],
  [
    19,
    "특별찬스",
    "구청장님이 쏜다!",
    "",
    "",
    "",
    "",
    "",
    "",
    "[한번더] 구청장님이 쏜다!",
    30,
    true
  ],
  [
    20,
    "팀미션",
    "추석맞이 단체 노래!",
    "",
    "",
    "",
    "",
    "",
    "",
    "진행자가 준비한 추석맞이 노래를\n모두 함께 신나게 불러주세요!",
    30,
    true
  ],
  [
    21,
    "추석퀴즈",
    "풍성한 한가위",
    "송편을 찔 때 밑에 깔아 향을 내는 것은?",
    "상추",
    "김",
    "배추",
    "솔잎",
    4,
    "",
    30,
    true
  ],
  [
    22,
    "우리동네퀴즈",
    "정겨운 우리동네",
    "우리 동네에서 여러 가게가 모여 물건을 파는 곳은?",
    "우체국",
    "소방서",
    "시장",
    "수영장",
    3,
    "",
    30,
    true
  ],
  [
    23,
    "추억퀴즈",
    "그때 그 시절",
    "손을 잡고 둥글게 돌며 즐기는 전통놀이는?",
    "투호",
    "강강술래",
    "줄다리기",
    "널뛰기",
    2,
    "",
    30,
    true
  ],
  [
    24,
    "노래",
    "고향을 떠올리는 시간",
    "",
    "",
    "",
    "",
    "",
    "",
    "좋아하는 고향 노래 한 소절을\n우리 팀 대표가 들려주세요!",
    30,
    true
  ],
  [
    25,
    "복주머니찬스",
    "칭찬 복주머니!",
    "",
    "",
    "",
    "",
    "",
    "",
    "우리 팀의 좋은 점을\n다 함께 한 가지씩 말해주세요!",
    30,
    true
  ],
  [
    26,
    "특별찬스",
    "지회장님이 쏜다!",
    "",
    "",
    "",
    "",
    "",
    "",
    "[선물] 지회장님이 쏜다!",
    30,
    true
  ],
  [
    27,
    "골든미션",
    "50개 경로당, 하나의 마음!",
    "",
    "",
    "",
    "",
    "",
    "",
    "모두 머리 위로 큰 하트를 만들고\n“풍성한 한가위 되세요!”를 외쳐주세요!",
    30,
    true
  ],
  [
    28,
    "팀미션",
    "박수로 마음을 모아요!",
    "",
    "",
    "",
    "",
    "",
    "",
    "진행자의 박수 리듬을 듣고\n우리 팀 모두 똑같이 따라 해주세요!",
    30,
    true
  ],
  [
    29,
    "복주머니찬스",
    "행운의 추석 인사!",
    "",
    "",
    "",
    "",
    "",
    "",
    "다른 팀을 향해 손을 흔들며\n“건강하고 행복하세요!”라고 인사해주세요!",
    30,
    true
  ]
];
