import './globals.css';

export const metadata = {
  title: 'POS System',
  description: 'ระบบขายหน้าร้าน',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
