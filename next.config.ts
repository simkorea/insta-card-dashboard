import type { NextConfig } from "next";

// 개발 환경에서 기업 프록시의 SSL 인증서 검증 오류 우회
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
