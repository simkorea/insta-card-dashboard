import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침 | 카드뉴스",
  description: "카드뉴스 서비스의 개인정보처리방침",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-gray-800">
      <h1 className="mb-2 text-2xl font-bold">개인정보처리방침</h1>
      <p className="mb-10 text-sm text-gray-500">최종 수정일: 2026-07-24</p>

      <p className="mb-8 leading-relaxed">
        카드뉴스(이하 &quot;회사&quot;)는 인스타그램 계정(@aptshowhome) 운영 및 콘텐츠 제작을 위한
        내부 관리 도구이며, 이용자의 개인정보를 아래와 같이 처리합니다.
      </p>

      <Section title="1. 수집하는 개인정보 항목">
        <ul className="list-disc space-y-1 pl-5">
          <li>인스타그램 공개 프로필 정보(사용자명, 사용자 ID)</li>
          <li>인스타그램 댓글 및 다이렉트 메시지(DM) 내용</li>
          <li>상담 신청 폼을 통해 입력한 정보: 이름, 연락처, 이메일, 문의 내용</li>
        </ul>
      </Section>

      <Section title="2. 개인정보의 수집 방법">
        <ul className="list-disc space-y-1 pl-5">
          <li>Instagram Graph API를 통한 댓글/DM 수신(Webhook)</li>
          <li>웹사이트 내 상담 신청 폼을 통한 직접 입력</li>
        </ul>
      </Section>

      <Section title="3. 개인정보의 이용 목적">
        <ul className="list-disc space-y-1 pl-5">
          <li>인스타그램 댓글 및 DM에 대한 응답(AI가 초안을 생성하고, 담당자가 검수·승인한 뒤 발송)</li>
          <li>상담 신청에 대한 안내 및 연락</li>
          <li>서비스 운영 및 품질 개선</li>
        </ul>
      </Section>

      <Section title="4. 개인정보의 보유 및 이용 기간">
        <p className="leading-relaxed">
          수집한 개인정보는 목적 달성 후 지체 없이 파기하며, 관계 법령에 따라 보존이 필요한
          경우 해당 기간 동안 보관합니다.
        </p>
      </Section>

      <Section title="5. 개인정보의 제3자 제공">
        <p className="mb-2 leading-relaxed">
          회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만 아래의 경우
          예외로 합니다.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>이용자가 사전에 동의한 경우</li>
          <li>법령의 규정에 의거하거나 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
        </ul>
      </Section>

      <Section title="6. 개인정보 처리위탁">
        <p className="mb-2 leading-relaxed">
          서비스 운영을 위해 아래와 같이 개인정보 처리업무를 위탁하고 있습니다.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Supabase Inc. (데이터베이스 저장)</li>
          <li>Vercel Inc. (서비스 호스팅)</li>
          <li>Meta Platforms, Inc. (Instagram API 연동)</li>
        </ul>
      </Section>

      <Section title="7. 이용자의 권리">
        <p className="leading-relaxed">
          이용자는 언제든지 자신의 개인정보 열람, 정정, 삭제를 요청할 수 있으며, 아래
          연락처로 문의해 주시기 바랍니다.
        </p>
      </Section>

      <Section title="8. 개인정보 보호책임자 및 문의처">
        <p className="leading-relaxed">이메일: wnsgud86@gmail.com</p>
      </Section>

      <Section title="9. 고지의 의무">
        <p className="leading-relaxed">
          본 개인정보처리방침은 관련 법령 및 서비스 변경사항을 반영하기 위해 수정될 수
          있으며, 변경 시 본 페이지를 통해 공지합니다.
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
