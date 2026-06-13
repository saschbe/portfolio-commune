import Link from "next/link";
import NavBar from "@/components/navigation/NavBar";

const SECTIONS = [
  {
    num: "01",
    title: "Qui sommes-nous",
    items: [
      "Plombières en Images est un projet porté par un collectif de bénévoles passionnés de photographie et attachés à la commune de Plombières.",
      "Notre seul objectif est de préserver, archiver et partager le patrimoine photographique de notre entité communale et de ses villages (Gemmenich, Hombourg, Montzen, Moresnet, Plombières, Sippenaeken).",
      "Le projet est entièrement bénévole : aucune personne impliquée dans la gestion, la modération ou le développement du site ne perçoit de rémunération.",
      "Le site ne diffuse aucune publicité et ne poursuit aucun but commercial.",
    ],
  },

  {
    num: "02",
    title: "Conditions d'utilisation",
    items: [
      "Le site est destiné à la préservation du patrimoine photographique des villages de la commune de Plombières.",
      "Les photos soumises doivent concerner la commune de Plombières et ses villages.",
      "En soumettant une photo, l'utilisateur confirme en être l'auteur ou avoir les droits de diffusion.",
      "Les photos sont soumises à validation avant publication.",
      "L'administration se réserve le droit de refuser toute photo non conforme.",
    ],
  },
  {
    num: "03",
    title: "Protection des personnes",
    items: [
      "Toute photo représentant des personnes identifiables doit avoir été prise avec leur consentement ou celui de leurs ayants droit.",
      "Les personnes photographiées peuvent demander le retrait de leur image en contactant l'administration.",
    ],
  },
  {
    num: "04",
    title: "Disclaimer",
    items: [
      "Les photos anciennes peuvent provenir de collections privées ou publiques.",
      "Malgré nos efforts, certaines informations historiques peuvent être incomplètes.",
      "Le site décline toute responsabilité quant à l'exactitude des données historiques fournies par les utilisateurs.",
      "Les droits d'auteur des photos restent la propriété de leurs auteurs respectifs.",
    ],
  },
];

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <NavBar />

      {/* ── Contenu ──────────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-6 pt-36 pb-24">
        {/* Titre */}
        <div className="mb-16">
          <p className="text-cyan-300 text-[10px] uppercase tracking-[0.45em] mb-4">
            Informations légales
          </p>
          <h1 className="text-3xl md:text-5xl font-light uppercase tracking-[0.15em] leading-[1.2]">
            Mentions
            <br className="md:hidden" /> légales
          </h1>
          <p className="mt-5 text-white/30 text-sm leading-relaxed max-w-md">
            Règles d'utilisation et informations légales relatives au site
            Plombières en Images.
          </p>
        </div>

        {/* Sections 01–03 */}
        <div className="space-y-6">
          {SECTIONS.map((section) => (
            <div
              key={section.num}
              className="bg-white/2 border border-white/10 backdrop-blur-md rounded-3xl p-8 md:p-10"
            >
              <div className="flex items-start gap-6 mb-6">
                <span className="text-cyan-300 text-[11px] uppercase tracking-[0.35em] tabular-nums shrink-0 mt-1">
                  {section.num}
                </span>
                <h2 className="text-base md:text-lg font-light uppercase tracking-[0.2em] text-white">
                  {section.title}
                </h2>
              </div>
              <ul className="space-y-4 pl-0">
                {section.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-4">
                    <span className="mt-2 shrink-0 w-1 h-1 rounded-full bg-cyan-300/40" />
                    <p className="text-white/55 text-sm leading-relaxed">
                      {item}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Section RGPD & contact */}
          <div className="bg-white/2 border border-cyan-300/20 backdrop-blur-md rounded-3xl p-8 md:p-10">
            <div className="flex items-start gap-6 mb-6">
              <span className="text-cyan-300 text-[11px] uppercase tracking-[0.35em] tabular-nums shrink-0 mt-1">
                04
              </span>
              <h2 className="text-base md:text-lg font-light uppercase tracking-[0.2em] text-white">
                RGPD &amp; contact plaintes
              </h2>
            </div>
            <div className="flex items-start gap-4 mb-8">
              <span className="mt-2 shrink-0 w-1 h-1 rounded-full bg-cyan-300/40" />
              <p className="text-white/55 text-sm leading-relaxed">
                Pour toute demande de retrait d'image, exercice de vos droits
                (accès, rectification, suppression) ou signalement d'un contenu
                non conforme, contactez notre équipe à l'adresse suivante&nbsp;:
              </p>
            </div>
            <a
              href="mailto:plaintes@photoplombieres.eu"
              className="inline-flex items-center gap-3 px-6 py-3 rounded-full border border-cyan-300/40 bg-cyan-300/10 text-cyan-300 text-xs uppercase tracking-[0.3em] hover:bg-cyan-300/20 hover:border-cyan-300/70 transition-all duration-300"
            >
              plaintes@photoplombieres.eu
            </a>
          </div>
        </div>

        {/* Pied */}
        <div className="mt-16 pt-8 border-t border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <p className="text-white/20 text-[10px] uppercase tracking-[0.25em]">
            © {new Date().getFullYear()} Plombières en Images
          </p>
          <Link
            href="/"
            className="text-white/30 hover:text-cyan-300 text-[10px] uppercase tracking-[0.25em] transition-colors duration-300"
          >
            ← Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
