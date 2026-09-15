'use client';

import { SyntheticEvent, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import type { User } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore';
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  Edit3,
  LogOut,
  MapPin,
  Menu,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Trophy,
  UserRound,
  Users,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { firestore } from '@/lib/firebase';

const SPORTS = [
  { name: 'ทั้งหมด', icon: '✨', courts: 11 },
  { name: 'ฟุตบอล', icon: '⚽', courts: 2 },
  { name: 'ฟุตซอล', icon: '🥅', courts: 2 },
  { name: 'บาสเกตบอล', icon: '🏀', courts: 2 },
  { name: 'วอลเลย์บอล', icon: '🏐', courts: 1 },
  { name: 'แบดมินตัน', icon: '🏸', courts: 4 },
] as const;

const COURTS: Record<string, string[]> = {
  ฟุตบอล: ['สนามฟุตบอล 1', 'สนามฟุตบอล 2'],
  ฟุตซอล: ['สนามฟุตซอล 1', 'สนามฟุตซอล 2'],
  บาสเกตบอล: ['สนามบาส 1', 'สนามบาส 2'],
  วอลเลย์บอล: ['สนามวอลเลย์บอล 1'],
  แบดมินตัน: ['คอร์ตแบด 1', 'คอร์ตแบด 2', 'คอร์ตแบด 3', 'คอร์ตแบด 4'],
};

const LEVELS = ['เล่นสนุก', 'มือใหม่', 'ปานกลาง', 'จริงจัง'] as const;

type MatchupMember = { username: string; studentId: string };
type Booking = {
  id: string;
  teamName: string;
  sport: string;
  court: string;
  date: string;
  startTime: string;
  endTime: string;
  currentPlayers: number;
  maxPlayers: number;
  level: string;
  recruiting: boolean;
  note: string;
  owner: string;
  ownerUid: string;
  ownerStudentId: string;
  memberUids: string[];
  createdAt?: Timestamp | null;
};

type BookingForm = Omit<Booking, 'id' | 'ownerUid' | 'ownerStudentId' | 'memberUids' | 'createdAt'>;

const EMPTY_FORM: BookingForm = {
  teamName: '',
  sport: 'ฟุตซอล',
  court: 'สนามฟุตซอล 1',
  date: '',
  startTime: '',
  endTime: '',
  currentPlayers: 1,
  maxPlayers: 10,
  level: 'เล่นสนุก',
  recruiting: true,
  note: '',
  owner: '',
};

function todayInput() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function thaiDate(value: string) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

function dateTile(value: string) {
  if (!value) return { day: '-', month: '-' };
  const date = new Date(`${value}T12:00:00`);
  return {
    day: new Intl.DateTimeFormat('th-TH', { day: '2-digit' }).format(date),
    month: new Intl.DateTimeFormat('th-TH', { month: 'short' }).format(date),
  };
}

function errorMessage(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  if (code.includes('permission-denied')) return 'Firestore ยังไม่อนุญาตรายการจอง กรุณาอัปเดต Security Rules';
  if (error instanceof Error && error.message) return error.message;
  return 'ทำรายการไม่สำเร็จ กรุณาลองใหม่';
}

export function MatchupApp({ user, member, loading, onLogout }: { user: User; member: MatchupMember; loading: boolean; onLogout: () => void }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [syncing, setSyncing] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [queryText, setQueryText] = useState('');
  const [sportFilter, setSportFilter] = useState('ทั้งหมด');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BookingForm>({ ...EMPTY_FORM, owner: member.username });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(firestore, 'bookings'),
      (snapshot) => {
        const next = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Booking));
        next.sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
        setBookings(next);
        setSyncing(false);
      },
      (error) => {
        setNotice(errorMessage(error));
        setSyncing(false);
      },
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const recruitingMatches = useMemo(() => bookings.filter((booking) => {
    const text = queryText.trim().toLocaleLowerCase('th');
    const inSport = sportFilter === 'ทั้งหมด' || booking.sport === sportFilter;
    const inSearch = !text || `${booking.sport} ${booking.teamName} ${booking.owner}`.toLocaleLowerCase('th').includes(text);
    return booking.recruiting && booking.currentPlayers < booking.maxPlayers && inSport && inSearch;
  }), [bookings, queryText, sportFilter]);

  const myBookings = useMemo(
    () => bookings.filter((booking) => booking.ownerUid === user.uid || booking.memberUids?.includes(user.uid)),
    [bookings, user.uid],
  );

  const matchesToday = bookings.filter((booking) => booking.date === todayInput()).length;

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, date: todayInput(), owner: member.username });
    setModalOpen(true);
  }

  function openEdit(booking: Booking) {
    setEditingId(booking.id);
    setForm({
      teamName: booking.teamName,
      sport: booking.sport,
      court: booking.court,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      currentPlayers: booking.currentPlayers,
      maxPlayers: booking.maxPlayers,
      level: booking.level,
      recruiting: booking.recruiting,
      note: booking.note || '',
      owner: booking.owner,
    });
    setModalOpen(true);
  }

  function changeSport(sport: string) {
    setForm((current) => ({ ...current, sport, court: COURTS[sport][0] }));
  }

  async function saveBooking(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const teamName = form.teamName.trim();
    if (teamName.length < 3) return setNotice('ชื่อทีมต้องมีอย่างน้อย 3 ตัวอักษร');
    if (form.date < todayInput()) return setNotice('กรุณาเลือกวันที่ตั้งแต่วันนี้เป็นต้นไป');
    if (!form.startTime || !form.endTime || form.endTime <= form.startTime) return setNotice('เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม');
    if (form.maxPlayers < 2 || form.currentPlayers < 1 || form.currentPlayers > form.maxPlayers) return setNotice('กรุณาตรวจสอบจำนวนผู้เล่น');

    const overlap = bookings.some((booking) => booking.id !== editingId && booking.court === form.court && booking.date === form.date && form.startTime < booking.endTime && form.endTime > booking.startTime);
    if (overlap) return setNotice('สนามนี้มีการจองทับซ้อนในช่วงเวลาที่เลือก');

    setSaving(true);
    try {
      const payload = { ...form, teamName, owner: member.username, updatedAt: serverTimestamp() };
      if (editingId) {
        await updateDoc(doc(firestore, 'bookings', editingId), payload);
        setNotice('แก้ไขการจองเรียบร้อยแล้ว');
      } else {
        await addDoc(collection(firestore, 'bookings'), {
          ...payload,
          ownerUid: user.uid,
          ownerStudentId: member.studentId,
          memberUids: [user.uid],
          createdAt: serverTimestamp(),
        });
        setNotice('จองสนามสำเร็จ! แมตช์ของคุณถูกเพิ่มแล้ว');
      }
      setModalOpen(false);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function joinMatch(booking: Booking) {
    if (booking.ownerUid === user.uid || booking.memberUids?.includes(user.uid)) return;
    setSaving(true);
    try {
      const bookingRef = doc(firestore, 'bookings', booking.id);
      await runTransaction(firestore, async (transaction) => {
        const snapshot = await transaction.get(bookingRef);
        if (!snapshot.exists()) throw new Error('ไม่พบแมตช์นี้แล้ว');
        const current = snapshot.data() as Booking;
        const members = Array.isArray(current.memberUids) ? current.memberUids : [current.ownerUid];
        if (members.includes(user.uid)) return;
        if (current.currentPlayers >= current.maxPlayers) throw new Error('ทีมนี้มีผู้เล่นครบแล้ว');
        const count = current.currentPlayers + 1;
        transaction.update(bookingRef, {
          memberUids: [...members, user.uid],
          currentPlayers: count,
          recruiting: count < current.maxPlayers && current.recruiting,
          updatedAt: serverTimestamp(),
        });
      });
      setNotice(`เข้าร่วมทีม ${booking.teamName} แล้ว`);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function removeBooking(booking: Booking) {
    if (booking.ownerUid !== user.uid || !window.confirm(`ยกเลิกการจอง “${booking.teamName}” ใช่ไหม?`)) return;
    setSaving(true);
    try {
      await deleteDoc(doc(firestore, 'bookings', booking.id));
      setNotice('ยกเลิกรายการจองแล้ว');
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMobileOpen(false);
  }

  return (
    <main className="matchup-page min-h-dvh overflow-x-clip bg-[#fff4f9] text-[#4a1230]">
      <header className="sticky top-0 z-40 border-b border-[#f5d5e5] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-3 sm:h-20 sm:px-6">
          <button type="button" onClick={() => scrollTo('home')} className="flex min-h-11 min-w-0 items-center gap-2 text-left sm:gap-3">
            <Image src="/tus-logo.png" width={48} height={48} alt="ตราสัญลักษณ์โรงเรียน" className="h-10 w-10 shrink-0 object-contain sm:h-12 sm:w-12" priority />
            <div className="leading-none">
              <p className="text-base font-black tracking-tight text-[#4a1230] sm:text-lg">TUS<span className="text-[#d51b70]">MATCHUP</span></p>
              <p className="mt-1 hidden text-[10px] font-bold tracking-[0.17em] text-[#a86a88] min-[360px]:block">SPORTS COMMUNITY</p>
            </div>
          </button>

          <nav className="hidden items-center gap-7 lg:flex">
            <NavButton onClick={() => scrollTo('home')}>หน้าหลัก</NavButton>
            <NavButton onClick={() => scrollTo('sports')}>สนามกีฬา</NavButton>
            <NavButton onClick={() => scrollTo('matches')}>หาแมตช์</NavButton>
            <NavButton onClick={() => scrollTo('my-bookings')}>การจองของฉัน</NavButton>
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <div className="rounded-xl bg-[#fff0f7] px-3 py-2 text-right">
              <p className="text-xs font-bold text-[#4a1230]">{member.username}</p>
              <p className="text-[10px] text-[#a86a88]">รหัส {member.studentId}</p>
            </div>
            <Button onClick={openCreate} className="h-10 rounded-xl bg-[#d51b70] font-bold text-white shadow-lg shadow-[#d51b70]/20 hover:bg-[#b91760]"><Plus /> จองสนาม</Button>
            <Button variant="ghost" size="icon" onClick={onLogout} disabled={loading} className="text-[#8c536f] hover:bg-[#fff0f7] hover:text-[#d51b70]" aria-label="ออกจากระบบ"><LogOut /></Button>
          </div>

          <button type="button" onClick={() => setMobileOpen((value) => !value)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#fff0f7] text-[#d51b70] md:hidden" aria-label={mobileOpen ? 'ปิดเมนู' : 'เปิดเมนู'} aria-expanded={mobileOpen} aria-controls="mobile-navigation">
            {mobileOpen ? <X /> : <Menu />}
          </button>
        </div>
        {mobileOpen && (
          <div id="mobile-navigation" className="border-t border-[#f5d5e5] bg-white px-3 py-3 shadow-lg md:hidden">
            <div className="grid gap-1">
              <NavButton onClick={() => scrollTo('home')}>หน้าหลัก</NavButton>
              <NavButton onClick={() => scrollTo('sports')}>สนามกีฬา</NavButton>
              <NavButton onClick={() => scrollTo('matches')}>หาแมตช์</NavButton>
              <NavButton onClick={() => scrollTo('my-bookings')}>การจองของฉัน</NavButton>
              <div className="mt-3 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
                <Button onClick={openCreate} className="h-11 bg-[#d51b70] text-white"><Plus /> จองสนาม</Button>
                <Button variant="outline" onClick={onLogout} className="h-11"><LogOut /> ออกจากระบบ</Button>
              </div>
            </div>
          </div>
        )}
      </header>

      <section id="home" className="scroll-mt-20 px-3 pt-3 sm:scroll-mt-24 sm:px-6 sm:pt-10">
        <div className="hero-pattern mx-auto grid max-w-7xl overflow-hidden rounded-3xl bg-[#4a1230] text-white shadow-[0_20px_55px_rgba(74,18,48,.22)] sm:rounded-[2rem] lg:grid-cols-[1.25fr_.75fr]">
          <div className="p-5 sm:p-11 lg:p-14">
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-[#ffd0e5] sm:px-4"><Sparkles size={16} className="shrink-0" /> <span className="truncate">สวัสดี {member.username}</span></div>
            <h1 className="mt-5 text-3xl font-black leading-[1.16] tracking-tight min-[380px]:text-4xl sm:mt-6 sm:text-6xl">นัดเพื่อนให้พร้อม<br /><span className="text-[#ff78b4]">แล้วลงสนาม.</span></h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-white/75 sm:mt-5 sm:text-lg sm:leading-8">เช็กสนามว่าง จองเวลา และหาคนมาเติมทีมให้ครบ — ทุกกีฬาในโรงเรียน รวมไว้ที่เดียว</p>
            <Button onClick={openCreate} className="mt-6 h-12 w-full rounded-xl bg-[#d51b70] px-5 text-base font-bold text-white shadow-xl shadow-black/15 hover:bg-[#ef3388] min-[380px]:w-auto sm:mt-7 sm:px-6">สร้างแมตช์ใหม่ <ChevronRight /></Button>
          </div>
          <div className="relative hidden items-center justify-center overflow-hidden border-l border-white/10 lg:flex">
            <div className="absolute h-72 w-72 rounded-full bg-[#d51b70]/25 blur-3xl" />
            <div className="relative grid h-64 w-64 place-items-center rounded-full border border-white/15 bg-white/8">
              <Trophy size={110} strokeWidth={1.15} className="text-[#ff78b4]" />
            </div>
          </div>
          <div className="col-span-full grid grid-cols-3 border-t border-white/10">
            <HeroStat value="11" label="สนามทั้งหมด" />
            <HeroStat value={String(matchesToday)} label="แมตช์วันนี้" />
            <HeroStat value={syncing ? 'กำลังเชื่อมต่อ' : 'Firebase Sync'} label="ข้อมูลอัปเดตแบบเรียลไทม์" small />
          </div>
        </div>
      </section>

      <section id="sports" className="scroll-mt-20 px-3 py-10 sm:scroll-mt-24 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-black tracking-[0.22em] text-[#d51b70]">เลือกกีฬาที่ชอบ</p>
          <h2 className="mt-2 text-2xl font-black sm:text-3xl">สนามกีฬาในโรงเรียน</h2>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {SPORTS.map((sport) => (
              <button key={sport.name} type="button" onClick={() => { setSportFilter(sport.name); scrollTo('matches'); }} className={`min-h-28 rounded-2xl border p-3 text-left transition active:scale-[.98] sm:p-4 sm:hover:-translate-y-1 sm:hover:shadow-lg ${sportFilter === sport.name ? 'border-[#d51b70] bg-[#d51b70] text-white shadow-lg shadow-[#d51b70]/15' : 'border-[#f2cfdf] bg-white hover:border-[#ed94bd]'}`}>
                <span className="text-2xl">{sport.icon}</span>
                <p className="mt-3 font-bold">{sport.name}</p>
                <p className={`mt-1 text-xs ${sportFilter === sport.name ? 'text-white/70' : 'text-[#a86a88]'}`}>{sport.courts} สนาม</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section id="matches" className="scroll-mt-20 bg-white px-3 py-10 sm:scroll-mt-24 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-black tracking-[0.22em] text-[#d51b70]">ทีมยังไม่ครบ</p>
              <h2 className="mt-2 text-2xl font-black sm:text-3xl">แมตช์ที่กำลังหาคน</h2>
            </div>
            <div className="relative w-full lg:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#b8819b]" size={18} />
              <Input value={queryText} onChange={(event) => setQueryText(event.target.value)} enterKeyHint="search" placeholder="ค้นหากีฬา หรือชื่อทีม" className="h-12 rounded-xl border-[#efd0df] bg-[#fff8fb] pl-10 text-base focus-visible:border-[#d51b70] focus-visible:ring-[#d51b70]/15" />
            </div>
          </div>

          {recruitingMatches.length ? (
            <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {recruitingMatches.map((booking) => <MatchCard key={booking.id} booking={booking} userId={user.uid} saving={saving} onJoin={() => joinMatch(booking)} />)}
            </div>
          ) : (
            <EmptyState title="ยังไม่พบแมตช์ที่ค้นหา" text="ลองเลือกกีฬาอื่น หรือตั้งแมตช์ใหม่ของคุณเอง" action="สร้างแมตช์" onAction={openCreate} />
          )}
        </div>
      </section>

      <section id="my-bookings" className="scroll-mt-20 px-3 py-10 sm:scroll-mt-24 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-black tracking-[0.22em] text-[#d51b70]">จัดการได้ทุกเมื่อ</p>
              <h2 className="mt-2 text-2xl font-black sm:text-3xl">การจองของฉัน</h2>
            </div>
            <Button onClick={openCreate} className="h-11 w-full rounded-xl bg-[#4a1230] text-white hover:bg-[#6b2148] sm:w-auto"><Plus /> เพิ่มการจอง</Button>
          </div>

          {myBookings.length ? (
            <div className="mt-7 space-y-3">
              {myBookings.map((booking) => (
                <BookingRow key={booking.id} booking={booking} isOwner={booking.ownerUid === user.uid} onEdit={() => openEdit(booking)} onDelete={() => removeBooking(booking)} />
              ))}
            </div>
          ) : (
            <EmptyState title="ยังไม่มีการจอง" text="สร้างแมตช์ใหม่หรือเข้าร่วมทีม แล้วรายการจะปรากฏที่นี่" action="จองสนาม" onAction={openCreate} />
          )}
        </div>
      </section>

      <footer className="border-t border-[#f0ccdd] bg-[#4a1230] px-4 py-8 text-center text-sm text-white/60">
        <p className="font-black text-white">TUS<span className="text-[#ff78b4]">MATCHUP</span></p>
        <p className="mt-2">จองสนาม • หาเพื่อน • ต่อทีม</p>
      </footer>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent showCloseButton={false} className="top-auto bottom-0 max-h-[calc(100dvh-env(safe-area-inset-top))] max-w-none translate-y-0 overflow-y-auto rounded-b-none border-0 p-0 sm:top-1/2 sm:bottom-auto sm:max-h-[92vh] sm:max-w-2xl sm:-translate-y-1/2 sm:rounded-xl">
          <DialogHeader className="relative bg-[#4a1230] px-5 py-5 pr-16 text-white sm:px-6">
            <DialogTitle className="text-xl font-black">{editingId ? 'แก้ไขการจอง' : 'สร้างแมตช์ใหม่'}</DialogTitle>
            <DialogDescription className="text-white/65">กรอกรายละเอียดสนาม เวลา และจำนวนผู้เล่น</DialogDescription>
            <DialogClose className="absolute top-3 right-3 grid h-11 w-11 place-items-center rounded-xl text-white/75 transition hover:bg-white/10 hover:text-white" aria-label="ปิดหน้าต่าง"><X /></DialogClose>
          </DialogHeader>
          <form onSubmit={saveBooking}>
            <div className="grid gap-5 px-5 py-5 sm:grid-cols-2 sm:px-6">
              <Field className="sm:col-span-2" label="ชื่อทีม" htmlFor="team-name"><Input id="team-name" value={form.teamName} onChange={(event) => setForm({ ...form, teamName: event.target.value })} placeholder="เช่น TUS All Stars" minLength={3} maxLength={40} required className="h-11 text-base" /></Field>
              <Field label="กีฬา" htmlFor="sport"><NativeSelect id="sport" value={form.sport} onChange={(event) => changeSport(event.target.value)}>{Object.keys(COURTS).map((sport) => <option key={sport}>{sport}</option>)}</NativeSelect></Field>
              <Field label="สนาม" htmlFor="court"><NativeSelect id="court" value={form.court} onChange={(event) => setForm({ ...form, court: event.target.value })}>{COURTS[form.sport].map((court) => <option key={court}>{court}</option>)}</NativeSelect></Field>
              <Field label="วันที่" htmlFor="date"><Input id="date" type="date" min={todayInput()} value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required /></Field>
              <Field label="ระดับการเล่น" htmlFor="level"><NativeSelect id="level" value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value })}>{LEVELS.map((level) => <option key={level}>{level}</option>)}</NativeSelect></Field>
              <Field label="เวลาเริ่ม" htmlFor="start"><Input id="start" type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} required /></Field>
              <Field label="เวลาสิ้นสุด" htmlFor="end"><Input id="end" type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} required /></Field>
              <Field label="ผู้เล่นตอนนี้" htmlFor="current"><Input id="current" type="number" min={1} max={form.maxPlayers} value={form.currentPlayers} onChange={(event) => setForm({ ...form, currentPlayers: Number(event.target.value) })} required /></Field>
              <Field label="จำนวนผู้เล่นสูงสุด" htmlFor="maximum"><Input id="maximum" type="number" min={2} max={50} value={form.maxPlayers} onChange={(event) => setForm({ ...form, maxPlayers: Number(event.target.value) })} required /></Field>
              <Field className="sm:col-span-2" label="หมายเหตุ (ถ้ามี)" htmlFor="note"><Textarea id="note" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="รายละเอียดเพิ่มเติม เช่น เตรียมรองเท้ามาเอง" maxLength={180} /></Field>
              <div className="flex items-center justify-between rounded-xl border border-[#f0d0df] bg-[#fff7fb] p-4 sm:col-span-2">
                <div><p className="font-bold">เปิดรับสมาชิกเพิ่ม</p><p className="mt-1 text-xs text-[#9c617d]">แสดงแมตช์นี้ในหน้าหาเพื่อน</p></div>
                <Switch checked={form.recruiting} onCheckedChange={(checked) => setForm({ ...form, recruiting: checked })} />
              </div>
            </div>
            <DialogFooter className="mx-0 mb-0 border-[#efd0df] bg-[#fff8fb] px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="h-11 w-full sm:w-auto">ยกเลิก</Button>
              <Button type="submit" disabled={saving} className="h-11 w-full bg-[#d51b70] text-white hover:bg-[#b91760] sm:w-auto">{saving ? 'กำลังบันทึก…' : editingId ? 'บันทึกการแก้ไข' : 'ยืนยันการจอง'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {notice && <output className="fixed bottom-5 left-1/2 z-[70] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl bg-[#4a1230] px-5 py-3 text-center text-sm font-semibold text-white shadow-2xl">{notice}</output>}
    </main>
  );
}

function NavButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="min-h-11 rounded-lg px-3 py-2 text-left text-sm font-bold text-[#6e3652] transition hover:bg-[#fff0f7] hover:text-[#d51b70] lg:min-h-0 lg:px-2 lg:text-center">{children}</button>;
}

function HeroStat({ value, label, small = false }: { value: string; label: string; small?: boolean }) {
  return <div className="min-w-0 border-r border-white/10 px-2 py-4 text-center last:border-r-0 sm:px-7 sm:py-5 sm:text-left"><p className={`${small ? 'text-[11px] leading-4 sm:text-base' : 'text-2xl sm:text-3xl'} break-words font-black text-[#ff78b4]`}>{value}</p><p className="mt-1 text-[10px] leading-4 text-white/60 sm:text-xs">{label}</p></div>;
}

function MatchCard({ booking, userId, saving, onJoin }: { booking: Booking; userId: string; saving: boolean; onJoin: () => void }) {
  const isOwner = booking.ownerUid === userId;
  const joined = booking.memberUids?.includes(userId);
  const remaining = Math.max(booking.maxPlayers - booking.currentPlayers, 0);
  const percentage = Math.min((booking.currentPlayers / booking.maxPlayers) * 100, 100);
  return (
    <article className="group rounded-3xl border border-[#f0d1e0] bg-white p-5 shadow-[0_12px_35px_rgba(96,22,61,.07)] transition hover:-translate-y-1 hover:border-[#e79aba] hover:shadow-[0_18px_42px_rgba(96,22,61,.12)]">
      <div className="flex items-start justify-between gap-3"><span className="rounded-full bg-[#fff0f7] px-3 py-1.5 text-xs font-black text-[#d51b70]">{booking.sport}</span><span className="text-xs font-bold text-[#d51b70]">เปิดรับอีก {remaining} คน</span></div>
      <h3 className="mt-4 text-xl font-black text-[#4a1230]">{booking.teamName}</h3>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-[#9c617d]"><UserRound size={14} /> โดย {booking.owner}</p>
      <div className="mt-5 space-y-2.5 text-sm text-[#74415a]">
        <p className="flex items-start gap-2"><CalendarDays size={16} className="mt-0.5 shrink-0 text-[#d51b70]" /> <span>{thaiDate(booking.date)} • {booking.startTime}–{booking.endTime}</span></p>
        <p className="flex items-start gap-2"><MapPin size={16} className="mt-0.5 shrink-0 text-[#d51b70]" /> <span className="min-w-0 break-words">{booking.court}</span></p>
        <p className="flex items-start gap-2"><Trophy size={16} className="mt-0.5 shrink-0 text-[#d51b70]" /> <span>ระดับ {booking.level}</span></p>
      </div>
      {booking.note && <p className="mt-4 rounded-xl bg-[#fff8fb] px-3 py-2.5 text-xs leading-5 text-[#8b536e]">{booking.note}</p>}
      <div className="mt-5 flex items-center justify-between text-xs font-bold"><span>ผู้เล่น {booking.currentPlayers}/{booking.maxPlayers}</span><span>{Math.round(percentage)}%</span></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#f6dce8]"><div className="h-full rounded-full bg-gradient-to-r from-[#d51b70] to-[#ff78b4]" style={{ width: `${percentage}%` }} /></div>
      <Button onClick={onJoin} disabled={saving || isOwner || joined} className={`mt-5 h-11 w-full rounded-xl font-bold ${isOwner || joined ? 'bg-[#f8e3ed] text-[#9c617d]' : 'bg-[#4a1230] text-white hover:bg-[#d51b70]'}`}>{isOwner ? 'ห้องของคุณ' : joined ? 'เข้าร่วมแล้ว' : 'เข้าร่วมทีม'}</Button>
    </article>
  );
}

function BookingRow({ booking, isOwner, onEdit, onDelete }: { booking: Booking; isOwner: boolean; onEdit: () => void; onDelete: () => void }) {
  const tile = dateTile(booking.date);
  return (
    <article className="grid grid-cols-[4.25rem_minmax(0,1fr)] gap-3 rounded-2xl border border-[#efd0df] bg-white p-3 shadow-sm sm:flex sm:items-center sm:gap-4 sm:p-4">
      <div className="grid h-[4.25rem] w-[4.25rem] shrink-0 place-items-center rounded-2xl bg-[#4a1230] text-center text-white sm:h-20 sm:w-20"><div><p className="text-2xl font-black leading-none text-[#ff78b4]">{tile.day}</p><p className="mt-1 text-xs">{tile.month}</p></div></div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-lg font-black">{booking.teamName}</h3><span className="rounded-full bg-[#fff0f7] px-2.5 py-1 text-[10px] font-black text-[#d51b70]">{booking.sport}</span><span className="rounded-full bg-[#f2edf0] px-2.5 py-1 text-[10px] font-bold text-[#704158]">{isOwner ? 'ห้องที่คุณสร้าง' : 'เข้าร่วมแล้ว'}</span></div>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-[#87546d]"><span className="flex items-center gap-1.5"><Clock3 size={15} /> {booking.startTime}–{booking.endTime}</span><span className="flex items-center gap-1.5"><MapPin size={15} /> {booking.court}</span><span className="flex items-center gap-1.5"><Users size={15} /> {booking.currentPlayers}/{booking.maxPlayers}</span></div>
      </div>
      {isOwner && <div className="col-span-2 flex gap-2 sm:col-span-1"><Button variant="outline" size="sm" onClick={onEdit} className="h-10 flex-1 border-[#e8bfd2] text-[#7c405e] hover:bg-[#fff0f7] sm:h-7 sm:flex-none"><Edit3 /> แก้ไข</Button><Button variant="outline" size="icon-sm" onClick={onDelete} className="h-10 w-10 border-red-200 text-red-600 hover:bg-red-50 sm:h-7 sm:w-7" aria-label="ยกเลิกการจอง"><Trash2 /></Button></div>}
    </article>
  );
}

function EmptyState({ title, text, action, onAction }: { title: string; text: string; action: string; onAction: () => void }) {
  return <div className="mt-7 rounded-3xl border border-dashed border-[#e6adc7] bg-[#fff8fb] px-5 py-10 text-center sm:px-6 sm:py-14"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#ffe6f1] text-[#d51b70]"><Users /></div><h3 className="mt-4 text-lg font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-[#96617b]">{text}</p><Button onClick={onAction} className="mt-5 h-11 bg-[#d51b70] px-4 text-white hover:bg-[#b91760]"><Plus /> {action}</Button></div>;
}

function Field({ label, htmlFor, className = '', children }: { label: string; htmlFor: string; className?: string; children: React.ReactNode }) {
  return <div className={`space-y-2 [&_input]:h-11 [&_input]:text-base [&_textarea]:text-base ${className}`}><Label htmlFor={htmlFor}>{label}</Label>{children}</div>;
}

function NativeSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none focus:border-[#d51b70] focus:ring-3 focus:ring-[#d51b70]/15" />;
}
