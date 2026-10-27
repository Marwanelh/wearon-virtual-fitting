import './globals.css';

export const metadata = { title: 'WearOn — Find your next look', description: 'A privacy-conscious virtual fitting studio with a replaceable inference backend.', robots: { index: true, follow: true } };

export default function Layout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
