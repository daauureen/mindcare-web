import React, { useState, useEffect, useRef } from 'react';
import { uid, nowISO, code6, CATEGORIES } from '../lib/utils.js';
import { sendEmailCode } from '../lib/email.js';
import { Field, Area, Top } from '../components/common.jsx';
import { DocUploader } from '../components/documents.jsx';
import { Item, Stagger, Btn, EASE } from '../components/motion.jsx';
import { motion } from 'framer-motion';
import { GraduationCap, HeartHandshake, ArrowRight, ShieldCheck, Mail } from 'lucide-react';

export function VerifyEmail({ me, db, commit, logout, notify }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [tries, setTries] = useState(0);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const didSend = useRef(false);
  
  useEffect(() => {
    if (!didSend.current) {
      didSend.current = true;
      sendEmailCode(me.email, me.emailCode);
      setSent(true);
    }
  }, []);

  const confirm = () => {
    if (code.trim() !== me.emailCode) {
      setTries(tries + 1);
      return setErr(tries >= 3 ? "Код не совпадает. Запросите новый." : "Код не совпадает");
    }
    commit({
      ...db,
      users: db.users.map((u) =>
        u.id === me.id ? { ...u, emailVerifiedAt: nowISO(), emailCode: null } : u
      ),
    });
    notify("Email подтверждён");
  };

  const resend = async () => {
    setSending(true);
    const c = code6();
    commit({
      ...db,
      users: db.users.map((u) => (u.id === me.id ? { ...u, emailCode: c } : u)),
    });
    await sendEmailCode(me.email, c);
    setSending(false);
    setErr("");
    setTries(0);
    notify("Новый код отправлен на почту");
  };

  return (
    <div className="body stack" style={{ display: "flex", flexDirection: "column", justifyContent: "center", minHeight: "100vh" }}>
      <div className="eyebrow">Шаг подтверждения</div>
      <h1>Подтвердите почту</h1>
      <p className="muted">
        {sent 
          ? `Мы отправили шестизначный код на ${me.email}. Введите его, чтобы продолжить.`
          : `Код будет отправлен на ${me.email}`}
      </p>

      

      <Field
        label="Код из письма"
        value={code}
        inputMode="numeric"
        maxLength={6}
        onChange={(e) => { setCode(e.target.value); setErr(""); }}
       
      />
      {err && <p className="tiny" style={{ color: "var(--ochre)" }}>{err}</p>}
      <button className="btn" disabled={code.trim().length !== 6} onClick={confirm}>
        Подтвердить
      </button>
      <button className="link" style={{ width: "100%" }} onClick={resend} disabled={sending}>
        {sending ? "Отправляю..." : "Отправить код заново"}
      </button>
      <div className="divider" />
      <button className="btn quiet" onClick={logout}>Выйти</button>
    </div>
  );
}

export function Auth({ db, commit, route, go, login, notify }) {
  const [err, setErr] = useState("");

  if (route.n === "welcome")
    return (
      <div className="body" style={{ display: "flex", flexDirection: "column", justifyContent: "center", minHeight: "100dvh" }}>
        <Stagger gap={0.09}>
          <Item>
            <motion.div
              initial={{ scale: 0.7, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 18 }}
              style={{
                width: 66, height: 66, borderRadius: 22, marginBottom: 26,
                background: "linear-gradient(135deg,#A99BFB,#6D5CE0)",
                display: "grid", placeItems: "center", boxShadow: "var(--sh-lav)",
              }}
            >
              <HeartHandshake size={31} color="#fff" strokeWidth={2} />
            </motion.div>
          </Item>

          <Item><div className="eyebrow">Психологическая поддержка студентов</div></Item>
          <Item><h1 style={{ marginTop: 10, fontSize: 38, letterSpacing: "-0.035em" }}>MINDCARE</h1></Item>
          <Item>
            <p className="muted" style={{ marginTop: 14 }}>
              Тесты, которые составили практикующие психологи. Результат остаётся у вас —
              вы сами решаете, показывать ли его специалисту.
            </p>
          </Item>

          <Item style={{ marginTop: 32 }}>
            <Btn className="btn" onClick={() => go("reg-student")}>
              <GraduationCap size={19} /> Я студент <ArrowRight size={17} />
            </Btn>
          </Item>
          <Item style={{ marginTop: 12 }}>
            <Btn className="btn ghost" onClick={() => go("reg-psy")}>
              <HeartHandshake size={19} /> Я психолог
            </Btn>
          </Item>
          <Item style={{ marginTop: 6 }}>
            <button className="link" style={{ width: "100%" }} onClick={() => go("login")}>
              У меня уже есть аккаунт
            </button>
          </Item>

          <Item style={{ marginTop: 30 }}>
            <div className="row" style={{ gap: 9, alignItems: "flex-start" }}>
              <ShieldCheck size={15} color="var(--soft)" style={{ marginTop: 2, flexShrink: 0 }} />
              <p className="tiny">
                Приложение не оказывает медицинскую помощь и не ставит диагнозы. При угрозе жизни звоните 112.
              </p>
            </div>
          </Item>
        </Stagger>
      </div>
    );

  if (route.n === "login")
    return <LoginScreen go={go} login={login} err={err} setErr={setErr} />;

  if (route.n === "reg-student")
    return <RegStudent db={db} commit={commit} go={go} login={login} notify={notify} />;

  if (route.n === "reg-psy")
    return <RegPsych db={db} commit={commit} go={go} login={login} notify={notify} />;

  return null;
}

export function LoginScreen({ go, login, err, setErr }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  return (
    <>
      <Top title="Вход" onBack={() => go("welcome")} />
      <div className="body stack">
        <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Пароль" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
        {err && <p className="tiny" style={{ color: "var(--ochre)" }}>{err}</p>}
        <button className="btn" onClick={async () => setErr((await login(email, pw)) || "")}>Войти</button>
        <div className="divider" />
        {/* <div className="card tinted">
          <div className="eyebrow">Демо-доступы</div>
          <p className="tiny" style={{ marginTop: 8 }}>
            Администратор — admin@mindcare.kz / admin123<br />
            Психолог (подтверждён) — aigerim@mindcare.kz / demo1234
          </p>
        </div> */}
      </div>
    </>
  );
}

export function RegStudent({ db, commit, go, login, notify }) {
  const [f, setF] = useState({ fullName: "", email: "", password: "" });
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const ok = f.fullName.trim().length > 2 && /\S+@\S+\.\S+/.test(f.email) && f.password.length >= 8 && agree;

  const submit = async () => {
    if (db.users.some((u) => u.email.toLowerCase() === f.email.trim().toLowerCase()))
      return setErr("Такой email уже зарегистрирован");
    setLoading(true);
    const user = {
      id: uid(), role: "STUDENT", ...f, email: f.email.trim(), status: "ACTIVE",
      emailVerifiedAt: null, emailCode: code6(), createdAt: nowISO(),
    };
    commit({ ...db, users: [...db.users, user] });
    await sendEmailCode(user.email, user.emailCode);
    await login(f.email, f.password);
    notify(`📧 Код подтверждения отправлен на ${f.email}`);
    setLoading(false);
  };

  return (
    <>
      <Top title="Регистрация студента" onBack={() => go("welcome")} />
      <div className="body stack">
        <Field label="ФИО" value={f.fullName} onChange={set("fullName")} />
        <Field label="Email" type="email" value={f.email} onChange={set("email")} />
        <Field label="Пароль (от 8 символов)" type="password" value={f.password} onChange={set("password")} />
        <button className="opt" onClick={() => setAgree(!agree)} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ fontSize: 16 }}>{agree ? "◼" : "◻"}</span>
          <span className="tiny">Согласен(на) с политикой конфиденциальности и обработкой данных о моём состоянии</span>
        </button>
        {err && <p className="tiny" style={{ color: "var(--ochre)" }}>{err}</p>}
        <button className="btn" disabled={!ok || loading} onClick={submit}>
          {loading ? "Отправляю..." : "Создать аккаунт"}
        </button>
      </div>
    </>
  );
}

export function RegPsych({ db, commit, go, login, notify }) {
  const [step, setStep] = useState(1);
  const [f, setF] = useState({ fullName: "", email: "", phone: "", password: "", education: "", experienceYears: "", about: "" });
  const [specs, setSpecs] = useState([]);
  const [docs, setDocs] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const step1ok = f.fullName.trim().length > 2 && /\S+@\S+\.\S+/.test(f.email) && f.password.length >= 8;
  const step2ok = f.education.trim() && specs.length && String(f.experienceYears).length;
  const step3ok = docs.some((d) => d.type === "DIPLOMA");

  const submit = async () => {
    if (db.users.some((u) => u.email.toLowerCase() === f.email.trim().toLowerCase()))
      return setErr("Такой email уже зарегистрирован");
    setLoading(true);
    const user = {
      id: uid(), role: "PSYCHOLOGIST", fullName: f.fullName, email: f.email.trim(), phone: f.phone,
      password: f.password, status: "ACTIVE", emailVerifiedAt: null, emailCode: code6(), createdAt: nowISO(),
      profile: {
        education: f.education, specializations: specs, experienceYears: Number(f.experienceYears) || 0,
        about: f.about, verificationStatus: "PENDING", submittedAt: nowISO(), documents: docs, rejectionReason: null,
      },
    };
    commit({ ...db, users: [...db.users, user] });
    await sendEmailCode(user.email, user.emailCode);
    await login(f.email, f.password);
    notify(`📧 Код отправлен на ${f.email}. Заявка на проверку отправлена.`);
    setLoading(false);
  };

  return (
    <>
      <Top title="Регистрация психолога" onBack={() => (step === 1 ? go("welcome") : setStep(step - 1))} />
      <div className="body stack">
        <div className="progress"><i style={{ width: `${step * 33.3}%` }} /></div>
        {step === 1 && (
          <>
            <div className="eyebrow">Шаг 1 из 3 · контакты</div>
            <Field label="ФИО" value={f.fullName} onChange={set("fullName")} />
            <Field label="Email" type="email" value={f.email} onChange={set("email")} />
            <Field label="Телефон" value={f.phone} onChange={set("phone")} />
            <Field label="Пароль (от 8 символов)" type="password" value={f.password} onChange={set("password")} />
            <button className="btn" disabled={!step1ok} onClick={() => setStep(2)}>Дальше</button>
          </>
        )}
        {step === 2 && (
          <>
            <div className="eyebrow">Шаг 2 из 3 · квалификация</div>
            <Area label="Образование" value={f.education} onChange={set("education")} />
            <div>
              <span className="tiny">Специализация</span>
              <div className="row" style={{ flexWrap: "wrap", marginTop: 8, gap: 6 }}>
                {CATEGORIES.map((c) => (
                  <button key={c} className={"chip" + (specs.includes(c) ? " on" : "")}
                    onClick={() => setSpecs(specs.includes(c) ? specs.filter((x) => x !== c) : [...specs, c])}>{c}</button>
                ))}
              </div>
            </div>
            <Field label="Опыт работы, лет" type="number" value={f.experienceYears} onChange={set("experienceYears")} />
            <Area label="О себе (увидят студенты)" value={f.about} onChange={set("about")} />
            <button className="btn" disabled={!step2ok} onClick={() => setStep(3)}>Дальше</button>
          </>
        )}
        {step === 3 && (
          <>
            <div className="eyebrow">Шаг 3 из 3 · документы</div>
            <p className="tiny">Загрузите диплом — без него заявку не примут. Сертификаты и другие подтверждения добавьте, если они есть.</p>
            <DocUploader docs={docs} setDocs={setDocs} />
            {!step3ok && docs.length > 0 && <p className="tiny" style={{ color: "var(--ochre)" }}>Нужен хотя бы один документ с типом «Диплом».</p>}
            {err && <p className="tiny" style={{ color: "var(--ochre)" }}>{err}</p>}
            <button className="btn" disabled={!step3ok || loading} onClick={submit}>
              {loading ? "Отправляю..." : "Отправить заявку"}
            </button>
          </>
        )}
      </div>
    </>
  );
}
