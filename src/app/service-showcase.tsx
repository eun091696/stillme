import Image from "next/image";
import Link from "next/link";

import type { PhotoService } from "./photo-services";
import styles from "./ux.module.css";

export function ServiceShowcase({ services }: { services: readonly PhotoService[] }) {
  return (
    <section className={styles.showcaseTrack} id="services" aria-label="사진 서비스">
      <div className={styles.horizontalShowcase}>
        <header className={styles.showcaseHeader}>
          <p className="eyebrow">사진 서비스</p>
          <h2>필요한 순간에 맞는<br />여섯 가지 사진</h2>
          <p>옆으로 넘겨 보세요</p>
        </header>

        <div className={styles.showcaseCarousel} data-service-carousel tabIndex={0}>
          {services.map((service, index) => (
            <article className={styles.showcaseCard} key={service.routeId}>
              <div className={styles.showcaseImageFrame}>
                {service.beforeImageSrc ? (
                  <div className={styles.showcaseBeforeAfter} aria-label={`${service.title} 원본과 실제 변환 결과 비교`}>
                    <figure>
                      <div className={styles.showcasePairImage}>
                        <Image alt={`${service.title} 원본 사진`} fill sizes="(max-width: 832px) 40vw, 30vw" src={service.beforeImageSrc} />
                      </div>
                      <figcaption>원본</figcaption>
                    </figure>
                    <figure>
                      <div className={styles.showcasePairImage}>
                        <Image alt={`${service.title} 실제 생성 결과`} fill sizes="(max-width: 832px) 40vw, 30vw" src={service.imageSrc} />
                      </div>
                      <figcaption>변환 결과</figcaption>
                    </figure>
                  </div>
                ) : (
                  <div className={styles.showcaseImageCanvas}>
                    <Image alt={`${service.title} 예시`} fill priority={index === 0} quality={100}
                      sizes="(max-width: 832px) 82vw, min(76vw, 1152px)" src={service.imageSrc} />
                  </div>
                )}
              </div>
              <div className={styles.showcaseCopy}>
                <span className={styles.showcaseNumber}>{index + 1} / {services.length}</span>
                <small>{service.englishTitle}</small>
                <h3>{service.title}</h3>
                <p>{service.description}</p>
                {service.sampleKind === "mock" ? <p className={styles.showcaseDisclosure}>사진은 스타일 예시이며 실제 생성 결과가 아닙니다.</p> : null}
                {service.beforeImageSrc && <p className={styles.showcaseDisclosure}>실제 생성 예시입니다. 사진의 조건에 따라 결과가 달라질 수 있습니다.</p>}
                <Link href={`/generate/${service.routeId}`}>이 서비스 선택 <span aria-hidden="true">→</span></Link>
              </div>
            </article>
          ))}
        </div>
        <p className={styles.showcaseScrollCue} aria-hidden="true">
          <span className={styles.showcaseScrollLine} />
          <span>좌우로 넘겨 보기</span>
        </p>
      </div>
    </section>
  );
}
