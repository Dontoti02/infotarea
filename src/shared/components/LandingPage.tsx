"use client";

import { useState, useEffect } from "react";
import { BookOpen, ArrowRight, Bell, Calendar, User, ChevronDown, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeCategory, setActiveCategory] = useState("todos");
  const [expandedNoticeId, setExpandedNoticeId] = useState<string | number | null>(null);
  
  const [dynamicNotices, setDynamicNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fallbackNotices = [
    {
      id: "fallback-1",
      title: "Cambio de Aula: Laboratorio Central",
      description: "A partir de mañana, todas las clases de computación y proyectos de robótica se llevarán a cabo en el laboratorio central del segundo nivel. Favor de tomar previsiones y acudir a tiempo.",
      category: "academico",
      date: "31 Mayo, 2026",
      author: "Coordinación Académica"
    },
    {
      id: "fallback-2",
      title: "Simulacro Nacional de Sismo Escolar",
      description: "Recordamos a toda la comunidad estudiantil que el día de mañana se realizará el simulacro nacional a las 10:00 AM. Es obligatorio seguir las vías de evacuación señaladas y mantener el orden.",
      category: "urgente",
      date: "30 Mayo, 2026",
      author: "Comité de Seguridad"
    },
    {
      id: "fallback-3",
      title: "Entrega de Materiales y Libros MINEDU",
      description: "Se iniciará la distribución de los nuevos cuadernos de trabajo del Ministerio de Educación en las respectivas aulas durante las primeras horas de clase del viernes.",
      category: "academico",
      date: "29 Mayo, 2026",
      author: "Administración"
    }
  ];

  const displayedNotices = dynamicNotices.length > 0 ? dynamicNotices : fallbackNotices;

  const filteredNotices = activeCategory === "todos" 
    ? displayedNotices 
    : displayedNotices.filter((n: any) => n.category === activeCategory);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const supabase = createClient();

    const fetchDynamicNotices = async () => {
      try {
        const { data, error } = await supabase
          .from("notices")
          .select("*, profiles(full_name)")
          .order("created_at", { ascending: false })
          .limit(6);

        if (!error && data) {
          const mapped = data.map((item: any) => ({
            id: item.id,
            title: item.title,
            description: item.content,
            category: item.category === "urgent" 
              ? "urgente" 
              : item.category === "academic"
              ? "academico"
              : "eventos",
            date: new Date(item.created_at).toLocaleDateString("es-ES", {
              day: "2-digit",
              month: "short",
              year: "numeric"
            }),
            author: item.profiles?.full_name ?? "Sistema"
          }));
          setDynamicNotices(mapped);
        }
      } catch (err) {
        console.error("Error fetching notices:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDynamicNotices();

    // Set up Real-time subscription to auto-update on notice creation/deletion
    const channel = supabase
      .channel("landing-notices-realtime")
      .on(
        "postgres_changes", 
        { event: "*", schema: "public", table: "notices" }, 
        () => {
          fetchDynamicNotices();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="bg-background text-on-background font-sans antialiased min-h-screen flex flex-col overflow-x-hidden">
      {/* Dynamic Keyframes for float animation & scrollbar-hide */}
      <style>{`
        html {
            scroll-behavior: smooth;
        }
        @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }
        .hide-scrollbar::-webkit-scrollbar {
            display: none;
        }
        .hide-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
      `}</style>

      {/* TopNavBar */}
      <header 
        className={`w-full top-0 sticky bg-surface-container-lowest z-50 transition-shadow duration-300 ${
          isScrolled ? "shadow-md border-b border-outline-variant" : "border-b border-outline-variant/30"
        }`} 
        id="main-header"
      >
        <div className="flex justify-between items-center px-4 md:px-16 py-4 max-w-[1280px] mx-auto">
          {/* Brand */}
          <Link className="flex items-center gap-2 group" href="/">
            <img src="/assets/logo.png" alt="Logo" className="h-16 w-auto object-contain transition-transform duration-300 group-hover:scale-105" />
          </Link>
          {/* Navigation & Actions */}
          <nav className="flex items-center gap-6">
            {/* Desktop Links */}
            <div className="hidden md:flex items-center gap-6">
              <a className="text-on-surface-variant font-body-md hover:text-primary transition-colors duration-200" href="#avisos">
                Avisos
              </a>
              <a className="text-on-surface-variant font-body-md hover:text-primary transition-colors duration-200" href="#">
                Soporte
              </a>
            </div>
            {/* Trailing Primary Action */}
            <a className="hidden md:inline-flex items-center justify-center px-6 py-2.5 rounded-full border border-primary text-primary font-label-md hover:bg-primary/5 transition-colors" href="#">
              Soporte
            </a>
          </nav>
        </div>
      </header>

      {/* Main Content Canvas */}
      <main className="flex-grow flex flex-col justify-center relative pb-16">
        {/* Minimalist Background Decoration */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl opacity-50 mix-blend-multiply"></div>
          <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-secondary-container/30 rounded-full blur-3xl opacity-50 mix-blend-multiply"></div>
        </div>

        <div className="max-w-[1280px] mx-auto w-full px-4 md:px-16 py-20 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-16 items-center relative z-10">
          {/* Left Column: Copy & CTA */}
          <div className="flex flex-col items-start gap-8 lg:pr-8">
            {/* Headline */}
            <h1 className="font-display text-display-lg text-on-background leading-tight">
              Organiza tareas, avisos y seguimiento académico en <br className="hidden lg:block"/>
              <span className="text-primary relative inline-block">
                un solo lugar.
                <svg className="absolute w-full h-3 -bottom-1 left-0 text-primary-container/30 z-[-1]" preserveAspectRatio="none" viewBox="0 0 100 10">
                  <path d="M0 5 Q 50 10 100 5 L 100 10 L 0 10 Z" fill="currentColor"></path>
                </svg>
              </span>
            </h1>
            {/* Subtext */}
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-[576px] leading-relaxed">
              La plataforma centralizada para una comunicación escolar eficiente y moderna en la IE Teniente Miguel Cortés del Castillo. Diseñada para instituciones que buscan claridad, ritmo y productividad.
            </p>
            {/* CTA */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-4 w-full sm:w-auto">
              <Link 
                className="inline-flex items-center justify-center px-8 py-4 rounded-full bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 w-full sm:w-auto gap-2 group" 
                href="/login"
              >
                Acceder al Sistema
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Right Column: Visual Bento Grid */}
          <div className="relative w-full h-full min-h-[400px] lg:min-h-[600px] flex items-center justify-center mt-12 lg:mt-0">
            {/* Main Image Container */}
            <div className="relative w-full max-w-[448px] lg:max-w-none aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl shadow-primary/10 border border-outline-variant/30 group">
              {/* Base Image (Entrance) */}
              <img 
                alt="Vista Educativa Principal" 
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuD4ysTS8OOfsDnUE6HImZLe9_TPdKOY0yhW7Qa6QTZYB7Bl-a4VscWsX14cFPEU8juhd2c68u9kv9uC6KbKavXywCiKoJTgVxJPV9d-NubHrqbTg0W-mrVDoXs8B3yURVOCRxj8EK8qKnocyZsLBvroH-pAsVJ-HH_fpd3M5iyvj7UEnZ4DfYNySc0pG0yGAWVPxOI_1DNMhLJ-s-E8soVwSch-Q0mvchB3b0DQqW_Fbqv-quSeJ915Diw-Iv0dNm8XrneTGSC92wM1"
              />
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
              {/* Grid Overlay (Collage feel) */}
              <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-2 p-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 backdrop-blur-sm bg-black/20">
                <div className="w-full h-full rounded-2xl overflow-hidden border-2 border-white/20 shadow-lg translate-y-4 group-hover:translate-y-0 transition-transform duration-500 delay-100">
                  <img 
                    alt="Bento Collage 1" 
                    className="w-full h-full object-cover" 
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBbi7YYdljQtb6Gica3znhzn3GnDHWrHzaz2IWgvpUKVdTh1gfacWn_ynK1-d9MFl5X6uXRHBGC65iN2PFOzMB48v5mA9os0Oszku5zqWxRTPvaT-eGa5b8ZVa8SYqwC0RK_hFxRPLvPzG748IXGYcMuqYJkfq0DXXujv0UtEp0V9nkdBg5zpktcyojWQLtXQHA3OGLAq7HQstHt6cv5W_F2ODQ2cxJq5ZYFD4-9TLMEiRQdt5fPKlBABPlZdWAmwSa2Yyjz6vtPab3"
                  />
                </div>
                <div className="w-full h-full rounded-2xl overflow-hidden border-2 border-white/20 shadow-lg translate-y-4 group-hover:translate-y-0 transition-transform duration-500 delay-200">
                  <img 
                    alt="Bento Collage 2" 
                    className="w-full h-full object-cover" 
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAdUm-4y_BkxNKlqiORpDucDgIq7VDTtctXpGaXRcsSQ_gT7vmjbczGdi5q3spHsMOvfvk69klTOB3bxIupUES3JdRml4Yigdp200VWORhhU6JrtFE3TT0JoNHfc8DNVRaMUCZoKPtYNv-_o5c1NizCiE0fnojQyMiYx3wgRpUJbtOKbW46mHfug15ETzct7HleHQhbhwbBIOU0bUreNtiKg_4ZQL4Skpaujg1GkLIloPGGjPW5OEBSlkdvhyc5di8gwtrtLM-Eyrjq"
                  />
                </div>
                <div className="w-full h-full rounded-2xl overflow-hidden border-2 border-white/20 shadow-lg translate-y-4 group-hover:translate-y-0 transition-transform duration-500 delay-300 col-span-2">
                  <img 
                    alt="Bento Collage 3" 
                    className="w-full h-full object-cover object-top" 
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuD4ysTS8OOfsDnUE6HImZLe9_TPdKOY0yhW7Qa6QTZYB7Bl-a4VscWsX14cFPEU8juhd2c68u9kv9uC6KbKavXywCiKoJTgVxJPV9d-NubHrqbTg0W-mrVDoXs8B3yURVOCRxj8EK8qKnocyZsLBvroH-pAsVJ-HH_fpd3M5iyvj7UEnZ4DfYNySc0pG0yGAWVPxOI_1DNMhLJ-s-E8soVwSch-Q0mvchB3b0DQqW_Fbqv-quSeJ915Diw-Iv0dNm8XrneTGSC92wM1"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Image Carousel Section */}
        <section className="max-w-[1280px] mx-auto w-full px-4 md:px-16 py-8 relative z-10">
          <div className="flex gap-4 sm:gap-6 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-4">
            <div className="snap-center shrink-0 w-[85%] md:w-[45%] lg:w-[32%] aspect-video rounded-2xl overflow-hidden shadow-md border border-outline-variant/20 relative group cursor-pointer">
              <img 
                alt="Galería 1" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuC7NrNhBgmGQbN7ieDFIZtng0VmgupLe9gTgI5XgPogCJKM7u94AvuBLrYQmX8z7XcDbec5yL-H9ZTutIdo-8CedI2AGT2GdxkW3-pNd9m9qnBZorAzxzEBxXil8e1BLFW4-JVhveZDx-GKuzC6c_TQBQ93bXbNsTxyy1jIId778POlo2thrkp0ghDtufP7AUbBcg2ET1NYnatCEVLS-AbXUU7ABSA9TRMHyEzP4XIHYHXdnQcZ8pn6lVO8KAApPuncdMgI89A5SQOY"
              />
            </div>
            <div className="snap-center shrink-0 w-[85%] md:w-[45%] lg:w-[32%] aspect-video rounded-2xl overflow-hidden shadow-md border border-outline-variant/20 relative group cursor-pointer">
              <img 
                alt="Galería 2" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBuLZM8SZZZV7spT8lLYrViLElJ_vfnelpTqhW0juudbM5UGjcwH90ehNa6x66X71euiC0aT86g6ddRdzdOYmrD8YjsG_AxXXSXmlCMLWQLgMVWRWIrV9A3jY-xgBBNXLqdbDGgIvG_c-6TESjlEoZQelc83LJiaSrBtTVjZfDhGnnoLQkka2IB6TPpbXVKpLSi4lVuSWKGHLayXCnJb0PCaT0k9uey22bNCD-0ahF0UQacPtXToGvDhis8u9dfQ-1THdbnl_3UNp8O"
              />
            </div>
            <div className="snap-center shrink-0 w-[85%] md:w-[45%] lg:w-[32%] aspect-video rounded-2xl overflow-hidden shadow-md border border-outline-variant/20 relative group cursor-pointer">
              <img 
                alt="Galería 3" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuChu3-bsvqG2gDG8zQHVTRZ_n4cPk5o6h55JrNDin6Q42kzcucyVovohPzuiKPmMcwGh1Gk6PQTZP6W8v68gP5_vps6z_HbDL_R0wQh-zHm2eBeQ1I7b6-oIyJq2DD_jWWKTb8iqif_BvOK0AIy4jg7oj7HtqI1IsgOflH2R76fRbJ13vt60f-vI6zqPwhLySzyzX-PeQoub_kDqWDHiXJ3cD_sbIpQIR4rK8NID4EKL6PYO_4RLga24fXXXkKynzREE1fi6lC_QB24"
              />
            </div>
          </div>
        </section>

        {/* Avisos Section */}
        <section id="avisos" className="max-w-[1280px] mx-auto w-full px-4 md:px-16 py-16 relative z-10 border-t border-outline-variant/20 mt-8">
          <div className="text-center max-w-[600px] mx-auto mb-12">
            <h2 className="font-display text-display-lg text-on-background leading-tight text-3xl md:text-4xl font-extrabold tracking-tight">
              Avisos y Comunicados
            </h2>
            <p className="font-body-md text-on-surface-variant text-[15px] mt-3 leading-relaxed">
              Mantente al día con las últimas novedades, cambios de horario y comunicados oficiales de nuestra institución educativa.
            </p>
          </div>

          {/* Category Filters */}
          <div className="flex flex-wrap gap-2 justify-center mb-8">
            {["todos", "urgente", "academico", "eventos"].map((category) => (
              <button
                key={category}
                onClick={() => {
                  setActiveCategory(category);
                  setExpandedNoticeId(null);
                }}
                className={`px-5 py-2 rounded-full font-label-md text-xs tracking-wider uppercase border transition-all duration-300 ${
                  activeCategory === category
                    ? "bg-primary text-on-primary border-primary shadow-lg shadow-primary/20 scale-105"
                    : "bg-surface-container-lowest text-on-surface-variant border-outline-variant/30 hover:border-primary/50 hover:bg-surface-container-low"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Notices List */}
          <div className="max-w-[800px] mx-auto flex flex-col gap-4">
            {filteredNotices.length > 0 ? (
              filteredNotices.map((notice) => (
                <div
                  key={notice.id}
                  onClick={() => setExpandedNoticeId(expandedNoticeId === notice.id ? null : notice.id)}
                  className={`w-full text-left p-6 rounded-2xl border transition-all duration-300 cursor-pointer ${
                    expandedNoticeId === notice.id
                      ? "bg-surface-container-high/60 border-primary/60 shadow-lg shadow-primary/5"
                      : "bg-surface-container-lowest/60 border-outline-variant/20 hover:border-primary/40 hover:bg-surface-container-low/40 hover:shadow-md"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase ${
                        notice.category === "urgente"
                          ? "bg-error-container/20 text-error border border-error-container/30"
                          : notice.category === "academico"
                          ? "bg-primary-container/20 text-primary border border-primary-container/30"
                          : "bg-secondary-container/20 text-secondary border border-secondary-container/30"
                      }`}
                    >
                      {notice.category === "urgente" && <ShieldAlert className="w-3.5 h-3.5" />}
                      {notice.category === "academico" && <BookOpen className="w-3.5 h-3.5" />}
                      {notice.category === "eventos" && <Calendar className="w-3.5 h-3.5 text-secondary" />}
                      {notice.category}
                    </span>

                    <div className="flex items-center gap-4 text-xs text-on-surface-variant font-medium">
                      <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 opacity-60" />
                        {notice.author}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 opacity-60" />
                        {notice.date}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center mt-4 gap-4">
                    <h3 className="font-headline-md text-base md:text-lg font-bold text-on-background tracking-tight">
                      {notice.title}
                    </h3>
                    <div className={`p-1 rounded-full bg-surface-container-high transition-transform duration-300 shrink-0 ${
                      expandedNoticeId === notice.id ? "rotate-180 text-primary bg-primary/10" : "text-outline"
                    }`}>
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Expandable description card */}
                  <div
                    className={`grid transition-all duration-300 ease-in-out ${
                      expandedNoticeId === notice.id ? "grid-rows-[1fr] opacity-100 mt-4" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="font-body-md text-on-surface-variant leading-relaxed text-[14px] pt-3 border-t border-outline-variant/30">
                        {notice.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-on-surface-variant font-body-md bg-surface-container-low/20 rounded-2xl border border-outline-variant/15">
                No hay comunicados disponibles en esta categoría.
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full mt-auto bg-surface-container-low border-t border-outline-variant">
        <div className="flex flex-col md:flex-row justify-between items-center px-4 md:px-16 py-8 max-w-[1280px] mx-auto gap-4">
          <div className="flex items-center gap-2">
            <img src="/assets/logo.png" alt="Logo" className="w-12 h-12 object-contain" />
            <span className="font-headline-lg text-headline-lg-mobile text-primary">InfoTarea</span>
          </div>
          <p className="font-label-md text-label-md text-on-surface-variant text-center md:text-left">
            © 2026 IE Teniente Miguel Cortés del Castillo. Todos los derechos reservados.
          </p>
          <nav className="flex gap-6">
            <a className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors opacity-100 hover:opacity-80" href="#">Soporte</a>
            <a className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors opacity-100 hover:opacity-80" href="#">Políticas de Privacidad</a>
            <a className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors opacity-100 hover:opacity-80" href="#">Términos de Servicio</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
