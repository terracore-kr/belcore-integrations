export const metadata = { title: "Belcore chat example" }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f6f6f7", color: "#18181b" }}>
        {children}
      </body>
    </html>
  )
}
