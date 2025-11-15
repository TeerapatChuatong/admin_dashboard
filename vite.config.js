import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ถ้า frontend แยกโฟลเดอร์จาก PHP แบบที่ทำอยู่ ใช้ absolute URL ในโค้ดแล้วพอ
// เลยยังไม่ต้องตั้ง proxy ก็ได้

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173
  }
});
