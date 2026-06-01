export const metadata = {
  title: 'PirateXPlay API',
  description: 'Unofficial PirateXPlay REST API',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
