import type { Metadata } from "next";
import "./globals.css";
import "./mobile-map-controls.css";
import "./news-admin.css";
import { NewsPortal } from "@/components/NewsPortal";

export const metadata: Metadata = {
  title: "Маршрут № 2 Намцы — расписание автобуса",
  description: "Остановки, расписание и расчётное движение автобуса маршрута № 2 по селу Намцы.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>
        {children}
        <NewsPortal />
      </body>
    </html>
  );
}
