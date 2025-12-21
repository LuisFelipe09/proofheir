import './global.css';
import { Providers } from './providers';

export const metadata = {
  title: 'ProofHeir',
  description: 'Inheritance with EIP-7702',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
