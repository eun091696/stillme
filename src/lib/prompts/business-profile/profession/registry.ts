import type { ProfessionCategory } from "./types";

type ProfessionClassificationEntry = Readonly<{
  category: Exclude<ProfessionCategory, "general-professional">;
  aliases: readonly string[];
}>;

// 구체적인 업종을 일반 직무보다 먼저 검사해 중첩 키워드의 결과를 결정적으로 유지한다.
export const PROFESSION_CLASSIFICATION_REGISTRY: readonly ProfessionClassificationEntry[] = [
  {
    category: "medical",
    aliases: [
      "피부과 의사", "성형외과 의사", "치과의사", "간호사", "의사", "약사",
      "doctor", "physician", "dentist", "nurse", "pharmacist", "surgeon",
    ],
  },
  {
    category: "legal",
    aliases: ["변호사", "법무사", "검사", "attorney", "lawyer", "legal counsel", "solicitor"],
  },
  {
    category: "finance",
    aliases: [
      "세무사", "회계사", "재무설계사", "금융 전문가", "accountant", "tax accountant",
      "financial advisor", "financial analyst", "banker",
    ],
  },
  {
    category: "real-estate",
    aliases: ["부동산 중개사", "공인중개사", "부동산 컨설턴트", "realtor", "real estate agent", "real estate broker"],
  },
  {
    category: "beauty",
    aliases: [
      "헤어디자이너", "미용사", "바버", "메이크업 아티스트", "네일 아티스트",
      "hair designer", "hair stylist", "hairstylist", "barber", "makeup artist", "beautician",
    ],
  },
  {
    category: "fitness",
    aliases: [
      "헬스 트레이너", "퍼스널 트레이너", "피트니스 트레이너", "운동 코치", "pt 트레이너",
      "fitness trainer", "personal trainer", "fitness coach", "gym trainer",
    ],
  },
  {
    category: "technology",
    aliases: [
      "ai 엔지니어", "데이터 엔지니어", "소프트웨어 엔지니어", "개발자", "프로그래머",
      "software engineer", "ai engineer", "data engineer", "developer", "programmer",
    ],
  },
  {
    category: "education",
    aliases: ["교수", "강사", "교사", "선생님", "교육자", "professor", "lecturer", "teacher", "educator", "instructor"],
  },
  {
    category: "therapy-wellness",
    aliases: [
      "심리상담사", "상담심리사", "치료사", "웰니스 코치",
      "therapist", "counselor", "counsellor", "wellness coach",
    ],
  },
  {
    category: "sports-coaching",
    aliases: [
      "축구 코치", "야구 코치", "농구 코치", "테니스 코치", "스포츠 코치",
      "soccer coach", "baseball coach", "basketball coach", "tennis coach", "sports coach",
    ],
  },
  {
    category: "sales-consulting",
    aliases: ["보험설계사", "컨설턴트", "영업", "상담사", "consultant", "sales", "advisor"],
  },
  {
    category: "culinary",
    aliases: [
      "셰프", "요리사", "파티시에", "제과사", "제빵사",
      "chef", "cook", "pastry chef", "pastry cook", "baker",
    ],
  },
  {
    category: "hospitality-service",
    aliases: ["호텔리어", "승무원", "서비스 매니저", "hospitality", "flight attendant", "concierge", "service manager"],
  },
  {
    category: "public-service",
    aliases: [
      "공무원", "사회복지사", "소방관", "경찰관",
      "civil servant", "public servant", "social worker", "firefighter", "police officer",
    ],
  },
  {
    category: "research-science",
    aliases: [
      "연구원", "과학자", "연구 과학자",
      "researcher", "scientist", "research scientist", "laboratory researcher",
    ],
  },
  {
    category: "entrepreneur",
    aliases: ["대표이사", "창업가", "기업가", "스타트업 대표", "ceo", "founder", "entrepreneur", "business owner"],
  },
  {
    category: "architecture-interiors",
    aliases: [
      "건축가", "건축 디자이너", "인테리어 디자이너", "공간 디자이너",
      "architect", "architectural designer", "interior designer", "interior architect", "spatial designer",
    ],
  },
  {
    category: "arts-performance",
    aliases: [
      "배우", "무용가", "뮤지션", "가수", "공연 예술가",
      "actor", "actress", "dancer", "musician", "singer", "performer",
    ],
  },
  {
    category: "media-broadcast",
    aliases: [
      "기자", "아나운서", "방송인", "pd", "프로듀서",
      "journalist", "reporter", "news anchor", "broadcaster", "producer", "podcast host",
    ],
  },
  {
    category: "creative",
    aliases: [
      "그래픽 디자이너", "사진작가", "영상 제작자", "작가", "디자이너",
      "graphic designer", "photographer", "writer", "artist", "creative director", "content creator",
    ],
  },
  {
    category: "corporate",
    aliases: ["회사원", "직장인", "임원", "인사 담당자", "매니저", "office worker", "executive", "manager", "human resources"],
  },
] as const;
