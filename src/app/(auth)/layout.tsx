import type { Metadata } from 'next';
import Image from 'next/image';
import type { ReactNode } from 'react';
import {
  ChartNoAxesCombined,
  FileText,
  HardHat,
  MessageSquareText,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import creacomLogo from '../../../material/creahormigoneralogo.png';
import mixerPhoto from '../../../material/imagen-mixer.png';

// Shared metadata for auth pages (login / signup / forgot-password).
// None of these should be indexed — they'd compete with the marketing
// landing in SERPs and offer nothing to a searcher who hasn't already
// signed up. Each page still gets its own <title> via its own
// metadata.title override below the route group layout.
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

const heroBenefits = [
  { icon: UsersRound, title: 'Clientes', detail: 'Siempre cerca' },
  { icon: HardHat, title: 'Obras', detail: 'En control' },
  { icon: FileText, title: 'Cotizaciones', detail: 'Más rápidas' },
  {
    icon: MessageSquareText,
    title: 'Conversaciones',
    detail: 'En un solo lugar',
  },
];

const trustSignals = [
  { icon: ShieldCheck, label: 'Acceso seguro' },
  {
    icon: ChartNoAxesCombined,
    label: 'Tu información siempre protegida',
  },
  { icon: UsersRound, label: 'Un equipo más conectado' },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-white lg:grid lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden min-h-[720px] overflow-hidden bg-[#151515] lg:block">
        <Image
          src={mixerPhoto}
          alt="Planta y camión hormigonera de CREACOM"
          fill
          priority
          sizes="55vw"
          className="object-cover object-[56%_center]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#111214]/95 via-[#111214]/28 to-white/5" />
        <div className="absolute inset-x-0 top-0 h-52 bg-gradient-to-b from-white/35 to-transparent" />

        <div className="absolute top-10 left-10 xl:top-14 xl:left-16">
          <Image
            src={creacomLogo}
            alt="CREACOM Hormigonera"
            className="h-auto w-64 drop-shadow-[0_2px_10px_rgba(255,255,255,0.32)] xl:w-72"
            priority
          />
          <p className="font-heading mt-4 border-l-4 border-[#ed3237] pl-4 text-[12px] font-bold tracking-[0.28em] text-[#22252a] uppercase">
            Sistema comercial de hormigón
          </p>
        </div>

        <div className="absolute top-12 right-10 max-w-44 xl:top-16 xl:right-14">
          <p className="font-heading text-[10px] leading-[1.55] font-bold tracking-[0.34em] text-white uppercase text-shadow-sm">
            Construyendo relaciones que hacen grandes obras
          </p>
          <div className="mt-3 h-[3px] w-12 bg-[#ed3237]" />
        </div>

        <div className="absolute inset-x-0 bottom-0 px-10 pb-11 xl:px-16 xl:pb-14">
          <h2 className="font-heading max-w-[680px] text-[clamp(2.45rem,4vw,4.5rem)] leading-[0.91] font-extrabold tracking-[-0.035em] text-balance text-white uppercase drop-shadow-lg">
            El control comercial del hormigón, en un solo lugar.
          </h2>
          <div className="mt-5 h-[5px] w-16 bg-[#ed3237]" />
          <p className="mt-5 max-w-[540px] text-base leading-7 text-pretty text-white/88 xl:text-lg">
            Seguimiento de clientes, obras, cotizaciones y conversaciones para
            el equipo de CREACOM Hormigonera.
          </p>

          <div className="mt-7 grid max-w-[760px] grid-cols-4 gap-0 border-y border-white/20 py-4">
            {heroBenefits.map(({ icon: Icon, title, detail }, index) => (
              <div
                key={title}
                className={`flex min-w-0 items-center gap-3 px-3 first:pl-0 ${
                  index === heroBenefits.length - 1
                    ? ''
                    : 'border-r border-white/25'
                }`}
              >
                <Icon
                  aria-hidden="true"
                  strokeWidth={1.8}
                  className="size-8 shrink-0 text-[#ff3138]"
                />
                <div className="min-w-0">
                  <p className="font-heading truncate text-[10px] font-bold tracking-[0.08em] text-white uppercase">
                    {title}
                  </p>
                  <p className="mt-0.5 text-[9px] leading-3 font-semibold text-white/75 uppercase">
                    {detail}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-5">
            <span className="h-px w-20 bg-white/45" />
            <p className="font-heading text-[10px] font-semibold tracking-[0.42em] text-white/65 uppercase">
              Hormigón que impulsa tu proyecto
            </p>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="absolute right-[-7%] bottom-[-9%] h-44 w-[42%] bg-[#bfc1c2]/80 [clip-path:polygon(30%_0,100%_0,100%_100%,0_100%)]"
        />
        <div
          aria-hidden="true"
          className="absolute right-0 bottom-0 h-6 w-44 origin-bottom-right rotate-[-32deg] bg-[#ed3237]"
        />
        <div
          aria-hidden="true"
          className="absolute right-0 bottom-8 h-3 w-36 origin-bottom-right rotate-[-32deg] bg-[#ed3237]"
        />
      </section>

      <section className="relative min-h-screen overflow-hidden bg-[#f7f8fa]">
        <div className="absolute top-7 left-6 z-20 lg:hidden">
          <Image
            src={creacomLogo}
            alt="CREACOM Hormigonera"
            className="h-auto w-48 sm:w-56"
            priority
          />
          <p className="font-heading mt-2 border-l-2 border-[#ed3237] pl-2 text-[9px] font-bold tracking-[0.2em] text-[#4d4d4f] uppercase">
            Sistema comercial de hormigón
          </p>
        </div>

        <div className="absolute top-10 right-10 z-10 hidden max-w-32 lg:block xl:right-16">
          <p className="font-heading text-[9px] leading-[1.65] font-bold tracking-[0.34em] text-[#4d4d4f] uppercase">
            Calidad servicio confianza desarrollo
          </p>
          <div className="mt-3 h-[3px] w-12 bg-[#ed3237]" />
        </div>

        <HardHat
          aria-hidden="true"
          strokeWidth={0.65}
          className="absolute top-[24%] right-[-12%] hidden size-72 rotate-[-12deg] text-[#dfe1e4]/65 xl:block"
        />

        {children}

        <div className="absolute inset-x-8 bottom-7 z-10 hidden grid-cols-3 items-center text-[#2f3540] sm:grid lg:inset-x-10 xl:inset-x-16">
          {trustSignals.map(({ icon: Icon, label }, index) => (
            <div
              key={label}
              className={`flex min-w-0 items-center justify-center gap-3 px-4 ${
                index === trustSignals.length - 1
                  ? ''
                  : 'border-r border-[#c8ccd1]'
              }`}
            >
              <Icon
                aria-hidden="true"
                strokeWidth={1.8}
                className="size-7 shrink-0"
              />
              <span className="font-heading max-w-28 text-[9px] leading-[1.35] font-bold tracking-[0.06em] uppercase">
                {label}
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
