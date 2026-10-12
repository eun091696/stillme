import { PolicyPage } from "@/app/policy-page";

export const metadata = { title: "STILLME | 서비스 이용안내" };

export default function ServiceGuidePage() {
  return (
    <PolicyPage eyebrow="SERVICE GUIDE" title="서비스 이용안내">
      <section><h2>1. 시작하기</h2><ul><li>회원가입과 필수 정책 동의를 완료한 뒤 로그인합니다.</li><li>신규 가입자는 사진 제작 2회에 해당하는 프로모션 Credit 2개를 한 번 받습니다.</li><li>추가 Credit이 필요하면 구매 화면에서 상품을 선택하고 Groble 결제창에서 결제를 진행합니다.</li><li>결제 완료가 확인된 뒤 Credit이 반영되므로 잠시 시간이 걸릴 수 있습니다.</li></ul></section>
      <section><h2>2. Credit</h2><ul className="policy-facts"><li><strong>Starter</strong><span>3 Credit · 4,900원</span></li><li><strong>Standard</strong><span>7 Credit · 9,900원</span></li><li><strong>Pro</strong><span>16 Credit · 19,900원</span></li></ul><p>모든 사진 서비스는 한 번의 제작에 1 Credit을 사용합니다. 기본 후보 3장과 같은 제작 건의 무료 후보 2장을 제공합니다. 신규 가입 프로모션은 상품 가격 할인이나 쿠폰이 아니며 별도로 적용됩니다.</p></section>
      <section><h2>3. 사진 업로드</h2><ul><li>JPG, PNG 또는 WebP 형식의 본인 사진을 사용해 주세요.</li><li>얼굴이 선명하고 가림이 적은 사진이 적합합니다.</li><li>올린 원본 사진은 영구 보관하지 않고 제작 요청을 처리하는 동안에만 사용합니다.</li></ul></section>
      <section><h2>4. 이미지 제작</h2><ul><li>서비스와 옵션을 고르면 Google Gemini가 사진을 만들고, 증명사진·프로필 사진은 AWS Rekognition으로 원본과 같은 사람으로 보이는지 확인한 뒤 제공합니다.</li><li>처리 시간과 결과는 요청 및 연결된 서비스의 상태에 따라 달라질 수 있습니다.</li><li>제작에 실패하면 사용 예정이던 Credit은 다시 사용할 수 있게 복구됩니다.</li></ul></section>
      <section><h2>5. 결과·다운로드·삭제</h2><ul><li>결과는 사진 보관함에서 확인하고 다운로드할 수 있습니다.</li><li>완성된 사진은 7일간 보관되며 이후 자동 삭제됩니다.</li><li>보관기간 전에도 이미지별 삭제 버튼으로 즉시 삭제할 수 있습니다.</li></ul></section>
      <section><h2>6. 개인정보 핵심 안내</h2><p>올린 원본 사진은 Google Gemini로 전송되며, 완성된 사진은 외부에 공개되지 않는 별도의 저장공간에 일정 기간 보관됩니다. 자세한 사항은 개인정보처리방침에서 확인할 수 있습니다.</p></section>
      <section><h2>7. 문의</h2><p>계정·결제·환불·사진 제작 오류 문의는 페이지 아래쪽에 고객문의 채널이 표시된 경우 해당 채널을 이용해 주세요.</p></section>
    </PolicyPage>
  );
}
