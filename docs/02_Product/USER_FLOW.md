# User Flow

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

가입부터 결제, 생성, 다운로드까지의 사용자 흐름을 정의합니다.

## Goals

- 안정성과 유지보수성을 우선합니다.
- 팀 간 계약과 책임을 명확히 합니다.

## Requirements

- 기존 기능과 문서 내용을 보존합니다.
- 변경 시 관련 문서와 검증 결과를 함께 갱신합니다.

## Implementation

메인은 연출 사진 Hero, 네 개의 서비스 그룹 카드, 여섯 개의 인기 사진 Grid를 보여 주는 사진 스튜디오 화면입니다. Home·생성·결과 보관함·Credit·계정·인증·정책 화면은 같은 헤더를 사용합니다. 헤더의 `프로필 사진`은 개별 생성 폼이 아니라 `/generate/profile` 카테고리 허브로 연결됩니다. 허브는 `photo-services.ts`의 프로필 카테고리 metadata에서 사진 카드 목록을 렌더링하며 Hair Designer, CEO/임원, 취업·이력서, 변호사, 개발자, 크리에이터, 일반 프로필로 진입합니다. Home 인기 카테고리는 허브를 거치지 않고 각 `/generate/[service]`에 직접 연결됩니다. 헤더에는 직업별 카테고리를 추가하지 않습니다.

로그인한 사용자의 헤더에는 `credit_balances.available_balance` 기준 사용 가능 Credit을 표시하고, 비로그인 상태에는 임의의 잔액을 표시하지 않습니다. 연출·스타일 예시 사진은 실제 생성 결과가 아님을 밝힙니다. 각 카테고리 화면은 하나의 폼에서 단계를 전환해 선택 상태와 업로드 파일을 유지하고, 생성 직전에 기존 Action에 한 번만 제출합니다. 데스크톱 커스터마이징은 큰 사진 미리보기와 좁은 시각 옵션, 업로드는 좌측 약 65%와 우측 선택 요약 약 35%를 사용합니다. 결과는 원본을 작게 두고 완성 사진을 같은 크기의 Gallery로 보여 주며, 한 장을 선택한 뒤 기존 다운로드 경로로 저장합니다. 보관함도 사진을 우선합니다.

- 헤어 디자이너: 네 가지 Look 사진 카드 → 선택 Look 미리보기와 Hair·Outfit 사진 카드 → 업로드·선택 요약 → 생성 → 결과. Background·Lighting·Pose·Composition은 Look이 결정합니다. Hair 선택은 기존 공통 추가 요청으로 전달하지만 원본 헤어 보존 규칙이 우선하므로 결과 반영을 보장하지 않습니다.
- 증명·취업사진: 업로드 → 흰색/연회색 배경, 원본/정장/셔츠 의상, 정장일 때 선택적
  넥타이 카드 → 생성 → 결과. 공식 여권 규격 보장을 의미하지 않습니다.
- 수중 보정: 업로드(인물 없어도 됨) → 보정 → 원본과 보정 후보 비교·다운로드.
  수중 장면과 피사체를 보존하며 얼굴 검사 없이 장면 충실도를 검증합니다.
- 캐릭터: 블록 피규어/픽셀/클레이 스타일 이미지 카드 → 선택적 의상·배경 카드 → 전신 사진 업로드 → 생성 → 결과. 스타일 카드와 전신 예시의 머리·발이 잘리지 않도록 표시합니다. 각 스타일에 맞는 원본 특징 검증을 적용합니다.
- 일반 프로필: 사진 중심 Style → 공통 최소 옵션과 추가 요청 하나 → 업로드 → 생성 → 결과. 후보 1/2/3별 배경·프롬프트 입력은 표시하지 않으며 같은 선택 스타일로 세 후보를 생성합니다.

결과 3장, 기존 Credit·저장·다운로드 흐름은
공통입니다. Look·스타일 선택 이미지는 `mock`으로 명시하며 실제 STILLME 결과처럼
표시하지 않습니다. `/dev/image-generation`은 사용자 경로에 포함하지 않습니다.

사용자는 서비스 유형을 한 번만 선택합니다. 비즈니스 프로필의 직업은 사용자
생성 맥락으로 검증해 전달합니다. Prompt Engine의 raw prompt, preset과
version, provider model과 resolution, job 상태명, R2 key와 signed URL은 서버 내부에
남습니다.

## Checklist

- [ ] 책임 Agent가 내용을 검토했다.
- [x] 구현 또는 운영 상태와 문서가 일치한다.
- [ ] 관련 변경 시 이 문서를 함께 갱신한다.

## Related Documents

- [Documentation Home](../00_HOME.md)
- [Feature Stories](FEATURES.md)
- [MVP Scope](../08_Release/MVP.md)
