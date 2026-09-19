import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Eye,
  Heart,
  Layers3,
  MessageCircle,
  Repeat2,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Una comunidad con contexto",
    body: "Publica ideas, sigue a jugadores y conversa sobre partidas, formatos y metajuego.",
  },
  {
    icon: Layers3,
    title: "Decklists que forman parte del post",
    body: "Adjunta una versión del mazo, compárala y permite que otros la dupliquen sin perder el original.",
  },
  {
    icon: Eye,
    title: "Cada carta, a un gesto",
    body: "Consulta imagen y texto Oracle desde la web. Nadie tiene que buscar ni subir archivos de cartas.",
  },
];

export default function HomePage() {
  return (
    <main>
      <section className="page-shell hero">
        <div>
          <p className="eyebrow"><Sparkles size={14} /> La conversación continúa después de la partida</p>
          <h1>Comparte ideas.<br />Construye <em>mejores mazos.</em></h1>
          <p className="hero-copy">
            Una red social creada alrededor de Magic: publicaciones breves, conversaciones y decklists vivas con todas las cartas a mano.
          </p>
          <div className="hero-actions">
            <Link className="button" href="/auth">Reservar mi nombre <ArrowRight size={17} /></Link>
            <Link className="button button-secondary" href="/decks/new">Probar el editor</Link>
          </div>
          <p className="microcopy">Alpha local · Sin anuncios · Tus mazos siguen siendo tuyos</p>
        </div>

        <div className="hero-card" aria-label="Ejemplo de publicación con una decklist">
          <article className="sample-post">
            <div className="sample-author">
              <span className="avatar">LV</span>
              <div><div className="author-name">Lina Voss</div><div className="author-handle">@linavoss · hace 12 min</div></div>
            </div>
            <p className="sample-text">He ajustado la base de maná y ahora el turno cuatro es mucho más consistente. ¿Qué cortaríais para meter una respuesta más?</p>
            <div className="deck-attachment">
              <div className="deck-meta"><span>COMMANDER · EDH</span><span>100 cartas</span></div>
              <h3>Atraxa, voces del jardín</h3>
              <div className="mana-row" aria-label="Colores blanco, azul, negro y verde">
                <span className="mana w">W</span><span className="mana u">U</span><span className="mana b">B</span><span className="mana g">G</span>
              </div>
            </div>
            <div className="post-actions">
              <span><MessageCircle size={15} /> 18</span><span><Repeat2 size={15} /> 7</span><span><Heart size={15} /> 42</span><span><BarChart3 size={15} /> 1,2k</span>
            </div>
          </article>
          <div className="floating-note"><strong>Vista rápida de cartas</strong><span>Pasa el cursor o toca un nombre. La imagen llega desde Scryfall.</span></div>
        </div>
      </section>

      <section className="page-shell section">
        <div className="section-heading">
          <h2>Diseñado para jugar,<br />no para perseguir métricas.</h2>
          <p>La primera versión prioriza conversaciones cronológicas, mazos legibles y herramientas que ahorran tiempo a la comunidad.</p>
        </div>
        <div className="feature-grid">
          {features.map(({ icon: Icon, title, body }) => (
            <article className="feature-card" key={title}>
              <span className="feature-icon"><Icon size={20} /></span>
              <h3>{title}</h3><p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="page-shell section">
        <div className="feature-card" style={{ minHeight: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
          <div><p className="eyebrow"><ShieldCheck size={14} /> Construido con cuidado</p><h2 className="page-title">Una base real para iterar.</h2></div>
          <Link className="button" href="/feed">Abrir el feed <ArrowRight size={17} /></Link>
        </div>
      </section>
    </main>
  );
}
