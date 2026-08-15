import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Điều hành SXKD',
  description: 'Dashboard điều hành SXKD – dữ liệu Google Sheets, frontend Vercel',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
