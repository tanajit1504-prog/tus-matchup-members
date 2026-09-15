import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://tus-matchup-members.tanajit1504.chatgpt.site'),
  title: 'TUS Matchup — จองสนาม • หาเพื่อน • ต่อทีม',
  description: 'ระบบกีฬาสีชมพูสำหรับจองสนาม หาแมตช์ และรวมทีมภายในโรงเรียน',
  openGraph: {
    title: 'TUS Matchup — จองสนาม • หาเพื่อน • ต่อทีม',
    description: 'สมัครสมาชิกด้วยรหัสนักเรียน 5 หลัก แล้วลงสนามไปด้วยกัน',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TUS Matchup — จองสนาม • หาเพื่อน • ต่อทีม',
    description: 'สมัครสมาชิกด้วยรหัสนักเรียน 5 หลัก แล้วลงสนามไปด้วยกัน',
    images: ['/og.png'],
  },
  icons: { icon: '/tus-logo.png', apple: '/tus-logo.png' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
