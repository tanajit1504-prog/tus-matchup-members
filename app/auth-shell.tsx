'use client';

import { SyntheticEvent, useEffect, useState } from 'react';
import Image from 'next/image';
import { FirebaseError } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  CalendarDays,
  Eye,
  EyeOff,
  LogIn,
  ShieldCheck,
  Trophy,
  UserPlus,
  Users,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { firebaseAuth, firestore, studentEmail } from '@/lib/firebase';
import { MatchupApp } from '@/app/matchup-app';

type Mode = 'login' | 'register';
type Member = { username: string; studentId: string };
type ModelContext = {
  registerTool: (
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => { visibleForm: Mode };
    },
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};

async function loadMember(user: User, fallbackStudentId = ''): Promise<Member> {
  const snapshot = await getDoc(doc(firestore, 'users', user.uid));
  const data = snapshot.data() as { username?: unknown; studentId?: unknown } | undefined;
  const emailStudentId = user.email?.match(/^student-(\d{5})@/)?.[1] || '';
  return {
    username: typeof data?.username === 'string' ? data.username : user.displayName || 'นักเรียน',
    studentId: typeof data?.studentId === 'string' ? data.studentId : fallbackStudentId || emailStudentId,
  };
}

function firebaseMessage(error: unknown) {
  const code = error instanceof FirebaseError ? error.code : '';
  if (code === 'auth/email-already-in-use') return 'รหัสนักเรียนนี้สมัครสมาชิกแล้ว';
  if (['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password'].includes(code)) return 'รหัสนักเรียนหรือรหัสผ่านไม่ถูกต้อง';
  if (code === 'auth/weak-password') return 'รหัสผ่านยังไม่ปลอดภัย กรุณาใช้ตั้งแต่ 8 ตัวอักษรขึ้นไป';
  if (code === 'auth/unauthorized-domain') return 'โดเมนเว็บไซต์นี้ยังไม่ได้รับอนุญาตใน Firebase Authentication';
  if (code === 'permission-denied' || code === 'firestore/permission-denied') return 'Firestore ยังไม่อนุญาตให้บันทึกข้อมูลสมาชิก กรุณาตรวจสอบ Security Rules';
  if (code === 'auth/network-request-failed' || code === 'unavailable') return 'เชื่อมต่อ Firebase ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ต';
  return 'เกิดข้อผิดพลาดในการเชื่อมต่อ Firebase กรุณาลองใหม่';
}

export function AuthShell() {
  const [mode, setMode] = useState<Mode>('login');
  const [member, setMember] = useState<Member | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (modeToShow: Mode, name: string, title: string, description: string) => {
      void Promise.resolve(context.registerTool({
        name,
        title,
        description,
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: (input: unknown) => {
          if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length > 0) {
            throw new Error('คำสั่งนี้ไม่รับข้อมูลเพิ่มเติม');
          }
          setMode(modeToShow);
          setMessage('');
          return { visibleForm: modeToShow };
        },
      }, { signal: lifecycle.signal })).catch(() => undefined);
    };
    register('register', 'start_member_registration', 'เปิดแบบฟอร์มสมัครสมาชิก', 'แสดงแบบฟอร์มสมัครสมาชิก TUS Matchup โดยไม่กรอกหรือส่งข้อมูลส่วนตัว');
    register('login', 'start_member_login', 'เปิดแบบฟอร์มเข้าสู่ระบบ', 'แสดงแบบฟอร์มเข้าสู่ระบบ TUS Matchup โดยไม่กรอกหรือส่งข้อมูลส่วนตัว');
    return () => lifecycle.abort();
  }, []);

  useEffect(() => {
    return onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) {
        setAuthUser(null);
        setMember(null);
        setChecking(false);
        return;
      }
      try {
        setAuthUser(user);
        setMember(await loadMember(user));
      } catch (error) {
        setMessage(firebaseMessage(error));
        setMember(null);
      } finally {
        setChecking(false);
      }
    });
  }, []);

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setMessage('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  }

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    if (!/^\d{5}$/.test(studentId)) {
      setMessage('กรุณากรอกรหัสนักเรียนเป็นตัวเลข 5 หลัก');
      return;
    }
    if (password.length < 8) {
      setMessage('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
      return;
    }
    if (mode === 'register' && password !== confirmPassword) {
      setMessage('ยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        let createdUser: User | null = null;
        try {
          const credential = await createUserWithEmailAndPassword(firebaseAuth, studentEmail(studentId), password);
          createdUser = credential.user;
          await updateProfile(createdUser, { displayName: username.trim() });
          await setDoc(doc(firestore, 'users', createdUser.uid), {
            username: username.trim(),
            studentId,
            createdAt: serverTimestamp(),
          });
          setAuthUser(createdUser);
          setMember({ username: username.trim(), studentId });
        } catch (error) {
          if (createdUser) await deleteUser(createdUser).catch(() => undefined);
          throw error;
        }
      } else {
        const credential = await signInWithEmailAndPassword(firebaseAuth, studentEmail(studentId), password);
        setAuthUser(credential.user);
        setMember(await loadMember(credential.user, studentId));
      }
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      setMessage(firebaseMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    setLoading(true);
    try {
      await signOut(firebaseAuth);
      setAuthUser(null);
      setMember(null);
      setStudentId('');
      setPassword('');
      switchMode('login');
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="auth-page grid min-h-screen place-items-center">
        <Image className="h-28 w-28 animate-pulse object-contain" src="/tus-logo.png" width={112} height={112} alt="ตราสัญลักษณ์โรงเรียน" />
      </main>
    );
  }

  if (member && authUser) return <MatchupApp user={authUser} member={member} loading={loading} onLogout={logout} />;

  return (
    <main className="auth-page min-h-dvh overflow-y-auto px-3 py-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:py-8">
      <div className="mx-auto grid min-h-[calc(100dvh-1.5rem)] max-w-6xl items-center gap-10 sm:min-h-[calc(100dvh-4rem)] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden px-8 lg:block">
          <div className="mb-8 flex items-center gap-4">
            <Image className="h-24 w-24 object-contain drop-shadow-xl" src="/tus-logo.png" width={96} height={96} alt="ตราสัญลักษณ์โรงเรียน" />
            <div>
              <p className="text-xs font-bold tracking-[0.32em] text-pink-300">WELCOME TO</p>
              <h1 className="mt-1 text-5xl font-black tracking-tight text-white">TUS MATCHUP</h1>
            </div>
          </div>
          <h2 className="max-w-xl text-3xl font-bold leading-tight text-white">
            จองสนาม หาเพื่อน<br />แล้วลงเล่นไปด้วยกัน
          </h2>
          <p className="mt-4 max-w-lg text-base leading-7 text-pink-100/80">
            พื้นที่รวมทีมกีฬาของนักเรียน สมัครเพียงครั้งเดียวด้วยรหัสนักเรียน 5 หลัก แล้วกลับมาเข้าใช้งานได้อย่างรวดเร็ว
          </p>
          <div className="mt-10 grid max-w-lg grid-cols-3 gap-3">
            <Feature icon={CalendarDays} label="จองสนาม" />
            <Feature icon={Users} label="หาเพื่อน" />
            <Feature icon={Trophy} label="ต่อทีม" />
          </div>
        </section>

        <Card className="mx-auto w-full max-w-md overflow-hidden border-0 bg-white/96 py-0 shadow-[0_20px_60px_rgba(2,20,48,.3)] ring-1 ring-white/40 backdrop-blur-xl sm:rounded-2xl">
          <CardHeader className="gap-0 px-5 pt-5 sm:px-8 sm:pt-7">
            <div className="mb-3 flex items-center justify-center sm:mb-5 lg:hidden">
              <Image className="h-16 w-16 object-contain sm:h-20 sm:w-20" src="/tus-logo.png" width={80} height={80} alt="ตราสัญลักษณ์โรงเรียน" priority />
            </div>
            <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1 sm:mb-6">
              <button type="button" onClick={() => switchMode('login')} className={`min-h-11 rounded-lg px-3 py-2.5 text-sm font-bold transition ${mode === 'login' ? 'bg-white text-[#4a1230] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                เข้าสู่ระบบ
              </button>
              <button type="button" onClick={() => switchMode('register')} className={`min-h-11 rounded-lg px-3 py-2.5 text-sm font-bold transition ${mode === 'register' ? 'bg-white text-[#4a1230] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                สมัครสมาชิก
              </button>
            </div>
            <CardTitle className="text-xl font-black text-[#4a1230] sm:text-2xl">
              {mode === 'login' ? 'ยินดีต้อนรับกลับมา' : 'สร้างบัญชีนักเรียน'}
            </CardTitle>
            <CardDescription className="mt-1.5 leading-6 text-slate-500">
              {mode === 'login' ? 'ใช้รหัสนักเรียน 5 หลักและรหัสผ่านของคุณ' : 'กรอกชื่อผู้ใช้ รหัสนักเรียน และตั้งรหัสผ่าน'}
            </CardDescription>
          </CardHeader>

          <CardContent className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-8 sm:pb-8">
            <form className="space-y-3.5 sm:space-y-4" onSubmit={submit}>
              {mode === 'register' && (
                <div className="space-y-2">
                  <Label htmlFor="username">ชื่อผู้ใช้</Label>
                  <Input id="username" name="username" autoComplete="username" autoCapitalize="none" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="เช่น beam_sport" minLength={3} maxLength={24} required className="h-12 border-pink-100 bg-pink-50/40 px-3 text-base focus-visible:border-[#d51b70] focus-visible:ring-[#d51b70]/15" />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="student-id">รหัสนักเรียน 5 หลัก</Label>
                <Input id="student-id" name="studentId" inputMode="numeric" autoComplete="username" enterKeyHint="next" value={studentId} onChange={(event) => setStudentId(event.target.value.replace(/\D/g, '').slice(0, 5))} placeholder="00000" pattern="\d{5}" maxLength={5} required className="h-12 border-pink-100 bg-pink-50/40 px-3 font-mono text-base tracking-[0.3em] focus-visible:border-[#d51b70] focus-visible:ring-[#d51b70]/15" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">รหัสผ่าน</Label>
                <div className="relative">
                  <Input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} enterKeyHint={mode === 'login' ? 'go' : 'next'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="อย่างน้อย 8 ตัวอักษร" minLength={8} maxLength={128} required className="h-12 border-pink-100 bg-pink-50/40 px-3 pr-12 text-base focus-visible:border-[#d51b70] focus-visible:ring-[#d51b70]/15" />
                  <button type="button" onClick={() => setShowPassword((shown) => !shown)} className="absolute inset-y-0 right-0 grid w-12 place-items-center text-slate-400 hover:text-[#d51b70]" aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {mode === 'register' && (
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">ยืนยันรหัสผ่าน</Label>
                  <Input id="confirm-password" name="confirmPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password" enterKeyHint="done" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="กรอกรหัสผ่านอีกครั้ง" minLength={8} maxLength={128} required className="h-12 border-pink-100 bg-pink-50/40 px-3 text-base focus-visible:border-[#d51b70] focus-visible:ring-[#d51b70]/15" />
                </div>
              )}

              {message && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{message}</p>}

              <Button type="submit" disabled={loading} className="mt-2 h-12 w-full bg-[#d51b70] text-base font-bold text-white shadow-lg shadow-[#d51b70]/20 hover:bg-[#b91760]">
                {mode === 'login' ? <LogIn /> : <UserPlus />}
                {loading ? 'กำลังดำเนินการ…' : mode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
              </Button>

              <div className="flex items-center justify-center gap-2 pt-1 text-center text-xs leading-5 text-slate-500">
                <ShieldCheck size={15} className="text-emerald-600" />
                เชื่อมต่อ Firebase Auth และ Firestore
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Feature({ icon: Icon, label }: { icon: typeof Trophy; label: string }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/8 px-4 py-4 text-center text-sm font-semibold text-white backdrop-blur-sm">
      <Icon className="mx-auto mb-2 text-pink-300" size={22} />
      {label}
    </div>
  );
}
