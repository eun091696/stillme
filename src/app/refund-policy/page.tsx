import { PolicyPage } from "@/app/policy-page";

export const metadata = { title: "STILLME | 취소 및 환불 정책" };

export default function RefundPolicyPage() {
  return (
    <PolicyPage eyebrow="PAYMENT & REFUND" title="취소 및 환불 정책">
      <section className="policy-summary"><h2>환불 전 확인하세요</h2><ul><li>환불 가능 여부는 결제 상태와 Credit 사용 내역을 확인한 뒤 안내합니다.</li><li>구매한 Credit을 사용하지 않은 전액 환불은 해당 구매의 Credit만 회수합니다.</li><li>Credit을 이미 사용했거나 부분 환불인 경우에는 거래 내용을 개별 확인합니다.</li><li>서비스 오류로 사진 제작에 실패해 Credit이 돌아오는 것과 결제 환불은 별도로 처리됩니다.</li></ul></section>
      <section><h2>1. 상품과 가격</h2><ul><li>Starter: 4,900원 / 3 Credit</li><li>Standard: 9,900원 / 7 Credit</li><li>Pro: 19,900원 / 16 Credit</li></ul></section>
      <section><h2>2. 환불 완료 확인</h2><ul><li>환불 완료 여부는 결제 서비스와 STILLME의 거래 기록을 함께 확인해 판단합니다.</li><li>화면에 환불 완료 문구가 표시되는 것만으로 Credit이 바로 변경되지는 않습니다.</li></ul></section>
      <section><h2>3. 사용하지 않은 Credit</h2><ul><li>구매한 Credit을 사용하지 않았고 전액 환불이 확인되면, 그 구매로 받은 Credit만 한 번 회수합니다.</li><li>다른 구매의 Credit은 회수하지 않으며 잔액을 음수로 만들지 않습니다.</li></ul></section>
      <section><h2>4. 사용한 Credit 또는 부분 환불</h2><ul><li>Credit의 일부 또는 전부를 사용했거나 결제 금액의 일부만 환불되는 경우에는 Credit을 자동으로 계산하거나 회수하지 않습니다.</li><li>결제와 사용 내역을 함께 확인한 뒤 처리 결과를 안내합니다.</li></ul></section>
      <section><h2>5. 제작 실패·서비스 오류</h2><ul><li>서비스 오류로 사진 제작에 실패한 사실이 확인되면 사용 예정이던 Credit은 다시 사용할 수 있게 복구됩니다.</li><li>완성된 사진에 대한 개인적인 선호도 차이와 서비스 오류는 구분해 확인합니다.</li></ul></section>
      <section><h2>6. 중복 결제</h2><p>같은 주문에서 결제가 중복으로 확인되면 Credit을 중복 지급하지 않습니다. 추가 결제 건은 결제 기록을 확인한 뒤 환불 상태와 함께 처리합니다.</p></section>
      <section><h2>7. 환불 요청</h2><p>환불을 요청할 때에는 결제 상품, 결제 시각과 주문을 확인할 수 있는 정보를 준비해 주세요. 결제 서비스와 STILLME의 거래 상태를 확인한 뒤 결과를 안내합니다.</p></section>
    </PolicyPage>
  );
}
