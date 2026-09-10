import type { Metadata } from 'next';
import Image from 'next/image';
import type { ReactNode } from 'react';
import creacomLogo from '../../../material/creahormigoneralogo.png';
import plantPhoto from '../../../material/hormigon-construye.webp';

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

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[1.08fr_0.92fr]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#151515] lg:block">
        <Image
          src={plantPhoto}
          alt="Planta y camión hormigonera de CREACOM"
          fill
          priority
          sizes="54vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#151515]/85 via-[#151515]/15 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-10 xl:p-14">
          <div className="bg-primary mb-5 h-1 w-20" />
          <p className="font-heading text-xs font-bold tracking-[0.24em] text-white/70 uppercase">
            Producción · Ventas · Despacho
          </p>
          <h1 className="font-heading mt-3 max-w-xl text-4xl leading-[0.95] font-bold text-white uppercase xl:text-5xl">
            El control comercial del hormigón, en un solo lugar.
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-6 text-white/75">
            Seguimiento de clientes, obras, cotizaciones y conversaciones para
            el equipo de CREACOM Hormigonera.
          </p>
        </div>
      </section>

      <section className="relative min-h-screen bg-white">
        <div className="absolute top-6 left-6 z-10 sm:top-8 sm:left-10">
          <Image
            src={creacomLogo}
            alt="CREACOM Hormigonera"
            className="h-auto w-44 sm:w-52"
            priority
          />
          <p className="border-primary font-heading mt-2 border-l-2 pl-2 text-[10px] font-bold tracking-[0.2em] text-[#4d4d4f] uppercase">
            Sistema comercial de hormigón
          </p>
        </div>
        {children}
      </section>
    </div>
  );
}
