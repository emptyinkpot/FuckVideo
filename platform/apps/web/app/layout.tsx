import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'huasheng-clone | AI 视频创作智能体',
  description: '写好文稿，剩下的交给我们',
  keywords: ['AI 视频', '自动分镜', 'TTS', '语音合成', 'Remotion'],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
