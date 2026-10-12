# Image Post Processing

## Table of Contents

- [Overview](#overview)
- [Goals](#goals)
- [Requirements](#requirements)
- [Implementation](#implementation)
- [Checklist](#checklist)
- [Related Documents](#related-documents)

## Overview

생성 이미지의 리사이즈, 최적화, 썸네일, 메타데이터 처리 기준을 정의합니다.

## Goals

- 팀 간 판단 기준을 통일합니다.
- 구현과 운영 상태를 문서와 일치시킵니다.

## Requirements

- 책임 Agent와 검토 Agent를 지정합니다.
- 변경은 관련 코드, 테스트, 문서와 함께 검토합니다.
- MVP publish format은 static PNG로 제한합니다.
- PNG는 structure, chunk CRC, inflate 결과, dimension과 pixel budget을 통과해야
  합니다.
- Text, EXIF, XMP 계열 metadata와 animation control은 publish 전에
  거부합니다.
- 요청 aspect ratio와 결과 ratio 편차는 2% 이하여야 합니다.

## Implementation

`src/lib/generation/image-quality.ts`의 `image-quality-v1` validator가 provider
결과를 storage 이전에 검증하고 width, height, byte size와 SHA-256 checksum을
생성합니다. 현재 MVP는 변환·resize로 원본을 수정하지 않고 조건을 만족한 PNG만
그대로 publish 후보로 전달합니다.

## Checklist

- [x] Static PNG quality contract를 구현했다.
- [x] 구현 또는 운영 상태와 일치한다.
- [x] Corruption, metadata, format과 ratio negative test를 확인했다.

## Related Documents

- [00_HOME](../00_HOME.md)
