# TUS Matchup Membership

ระบบสมาชิกสำหรับ TUS Matchup รองรับ:

- สมัครด้วยชื่อผู้ใช้ รหัสนักเรียน 5 หลัก และรหัสผ่าน
- เข้าสู่ระบบด้วยรหัสนักเรียน 5 หลักและรหัสผ่าน
- ใช้ Firebase Authentication จัดการรหัสผ่านและ session
- เก็บชื่อผู้ใช้และรหัสนักเรียนใน Firestore collection `users`

## Development

```bash
pnpm install
pnpm dev
```

Firebase Authentication ต้องเปิด Email/Password provider และ Firestore ต้องอนุญาตให้ผู้ใช้เขียนเอกสารของตนเองใน `users/{uid}`.

## Firebase setup

1. เปิด Authentication > Sign-in method > Email/Password
2. สร้าง Firestore Database ในโปรเจกต์ `tusmatchup`
3. นำ `firestore.rules` ไปใช้ใน Firestore Rules (หากมี rules เดิม ให้รวมเฉพาะ block `users/{userId}`)
4. เพิ่ม `tus-matchup-members.tanajit1504.chatgpt.site` ใน Authentication > Settings > Authorized domains
