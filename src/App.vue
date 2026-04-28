<script setup>
import { ref, onMounted, onUnmounted, reactive, computed, nextTick } from 'vue';
import MapMain from './components/MapMain.vue';

/* ─── État global ─────────────────────────────────────────── */
const isLoaded    = ref(false);
const showModal   = ref(false);
const scrollProgress = ref(0);
const kmCounter   = ref(0);
const activeFaq   = ref(null);
const cursorX     = ref(0);
const cursorY     = ref(0);
const cursorVisible = ref(false);
const cursorHover   = ref(false);
const hoveredPack   = ref(null);

/* ─── Navbar ──────────────────────────────────────────────── */
const navScrolled = ref(false);
const navHidden   = ref(false);
let lastScrollY   = 0;

/* ─── Parallax hero ──────────────────────────────────────── */
const heroParallax = ref(0);

/* ─── Carte interactive ───────────────────────────────────── */
const mapActiveStep   = ref(0);
const routePathLength = ref(900);   // fallback; mesuré après mount
const carPosition     = reactive({ x: 258, y: 52 });

/* ─── Vue 4L (côté / avant / arrière) ───────────────────── */
const carView = ref('side'); // 'side' | 'front' | 'rear'

/* ─── Budget ─────────────────────────────────────────────── */
const budgetObjectif = 16000;   // ← modifier si besoin
const budgetActuel   = 0;    // ← modifier au fil du temps

const budgetPourcentage = computed(() =>
  Math.min(Math.round((budgetActuel / budgetObjectif) * 100), 100)
);

/* Arc de progression (r=80, viewBox 200×200) */
const PROG_R = 80;
const PROG_C = +(2 * Math.PI * PROG_R).toFixed(4);          // ≈ 502.65
const progOffset = computed(() =>
  +(PROG_C * (1 - budgetPourcentage.value / 100)).toFixed(4)
);

/* Répartition budgétaire */
const budgetItems = [
  { label:'Achat + prépa mécanique', amount:10000, pct:37.5, color:'#FF1A2E' },
  { label:'Inscription + assurance',  amount:4200, pct:23.3, color:'#8B5CF6' },
  { label:'Péage & Essance',  amount:1300, pct:12.5, color:'#b6526d' },
  { label: "Don a l'association", amount:'No limit', pct:12.5, color:'#9edc22' },
  { label:'Équipement Obligatoire',  amount:500, pct:12.5, color:'#1A5296' },
];

/* Calcul des arcs SVG donut (cx=100, cy=100, ro=94, ri=58) */
function polarXY(cx, cy, r, deg) {
  const rad = (deg - 90) * Math.PI / 180;
  return {
    x: +(cx + r * Math.cos(rad)).toFixed(2),
    y: +(cy + r * Math.sin(rad)).toFixed(2),
  };
}
const budgetSlices = computed(() => {
  let angle = 0;
  return budgetItems.map(item => {
    const sweep = item.pct / 100 * 360;
    const end   = angle + sweep;
    const large = sweep > 180 ? 1 : 0;
    const [ro, ri, cx, cy] = [94, 58, 100, 100];
    const os = polarXY(cx, cy, ro, angle);
    const oe = polarXY(cx, cy, ro, end);
    const ie = polarXY(cx, cy, ri, end);
    const is = polarXY(cx, cy, ri, angle);
    const path =
      `M${os.x},${os.y} A${ro},${ro} 0 ${large},1 ${oe.x},${oe.y}` +
      ` L${ie.x},${ie.y} A${ri},${ri} 0 ${large},0 ${is.x},${is.y} Z`;
    angle = end;
    return { ...item, path };
  });
});

const hoveredBudget = ref(null);

/* ─── Sponsors ───────────────────────────────────────────── */
const sponsors = [
  // ── Capitaine ──
  { name: 'test',  logo: 'test', tier: 'Capitaine',  url: 'test' },

];
const sponsorTiers = ['Capitaine', 'Pilote', 'Navigateur', 'Équipier'];
const sponsorTierColor = {
  'Capitaine' : '#F5A623',
  'Pilote'    : '#FF1A2E',
  'Navigateur': '#1A3464',
  'Équipier'  : '#8B5CF6',
};
const sponsorsByTier = (tier) => sponsors.filter(s => s.tier === tier);

/* ─── Particules pré-générées ─────────────────────────────── */
const heroParticles = Array.from({ length: 30 }, () => ({
  left:            (Math.random() * 100).toFixed(2) + '%',
  top:             (Math.random() * 100).toFixed(2) + '%',
  animationDelay:  (Math.random() * 5).toFixed(2)  + 's',
  animationDuration:(5 + Math.random() * 10).toFixed(2) + 's',
}));
const sponsorParticles = Array.from({ length: 20 }, () => ({
  left:            (Math.random() * 100).toFixed(2) + '%',
  animationDelay:  (Math.random() * 5).toFixed(2)  + 's',
  animationDuration:(8 + Math.random() * 8).toFixed(2)  + 's',
}));

/* ─── Compteurs animés ────────────────────────────────────── */
const stats = reactive({ km:0, kgMateriel:0, equipages:0, jours:0, pays:0, enfants:0 });
const finalStats = { km:6000, kgMateriel:80, equipages:1400, jours:21, pays:4, enfants:20000 };

/* ─── Packs sponsoring (palette sans jaune) ───────────────── */
const packs = [
  {
    name:'Équipier', price:'250 €', color:'#8B5CF6', highlight:false,
    features:['Logo format S sur la 4L','Mention sur la landing page',
      '1 post dédié sur nos réseaux','Carte postale depuis le Maroc','Photo HD avec votre logo'],
  },
  {
    name:'Navigateur', price:'750 €', color:'#1A3464', highlight:false,
    features:['Logo format M sur la 4L','Logo sur nos combinaisons',
      '3 posts dédiés + stories','Reportage photo personnalisé',
      'Invitation à la conférence retour','Reçu fiscal (60% déductible)'],
  },
  {
    name:'Pilote', price:'1 500 €', color:'#FF1A2E', highlight:true,
    features:['Logo format L sur les portes','Logo XL sur capot + combinaisons',
      'Vidéo publicitaire tournée au Maroc','Interview vidéo de votre entreprise',
      'Reportage complet (photo + vidéo)','Conférence privée pour vos équipes',
      'Objet souvenir du raid','Reçu fiscal (60% déductible)'],
  },
  {
    name:'Capitaine', price:'3 000 € +', color:'#08030F', highlight:false,
    features:['Logo principal XXL sur la 4L','Co-branding total de l\'équipage',
      'Présence dans tous nos supports','Campagne média sur mesure',
      'Production vidéo pro au retour','Événement de restitution dédié',
      'Drapeau de votre entreprise au Sahara','Reçu fiscal (60% déductible)',
      'Contact privilégié tout au long du raid'],
  },
];

/* ─── Étapes du parcours (7 = waypoints carte) ────────────── */
const etapes = [
  { ville:'Nantes',    pays:'France',  distance:'0 km',    date:'15 fév. 2027', desc:'Départ officiel depuis notre ville natale.' },
  { ville:'Biarritz',  pays:'France',  distance:'650 km',  date:'16 fév.',      desc:'Rassemblement officiel de tous les équipages du raid.' },
  { ville:'Algeciras', pays:'Espagne', distance:'1 950 km',date:'17 fév.',      desc:'Traversée de l\'Espagne jusqu\'au détroit de Gibraltar.' },
  { ville:'Tanger',    pays:'Maroc',   distance:'2 000 km',date:'18 fév.',      desc:'Entrée sur le continent africain. L\'aventure commence vraiment.' },
  { ville:'Boulajoul', pays:'Maroc',   distance:'3 200 km',date:'20 fév.',      desc:'Première étape en altitude dans le massif de l\'Atlas.' },
  { ville:'Merzouga',  pays:'Maroc',   distance:'4 100 km',date:'22 fév.',      desc:'Portes du Sahara — les dunes mythiques de l\'Erg Chebbi.' },
  { ville:'Marrakech', pays:'Maroc',   distance:'4 800 km',date:'25 fév.',      desc:'Arrivée triomphale. Remise du matériel scolaire à Enfants du Désert.' },
];

/* Coordonnées SVG correspondantes (viewBox 0 0 480 560) */
const mapWaypoints = [
  { x:258, y: 52, name:'Nantes'    },
  { x:192, y:148, name:'Biarritz'  },
  { x:168, y:305, name:'Algeciras' },
  { x:162, y:330, name:'Tanger'    },
  { x:175, y:398, name:'Boulajoul' },
  { x:295, y:450, name:'Merzouga'  },
  { x:148, y:432, name:'Marrakech' },
];
/* Chemin SVG passant par tous les waypoints */
const ROUTE_PATH = 'M 258,52 C 228,95 200,125 192,148 C 186,195 178,265 168,305 L 162,330 C 157,354 162,376 175,398 C 210,428 260,445 295,450 C 240,448 185,438 148,432';

const routeDashOffset = computed(() => {
  const p = mapActiveStep.value / (mapWaypoints.length - 1);
  return routePathLength.value * (1 - p);
});

/* ─── Timeline (Adapté pour Phosphor Icons) ───────────────── */
const timeline = [
  { date:'Avril 2026',  title:'Lancement officiel', desc:'Création de l\'association et de l\'identité "Jack Sparroue".', icon:'ph-flag' },
  { date:'Été 2026',    title:'Phase de sponsoring', desc:'Démarchage entreprises, mairies et partenaires locaux.',       icon:'ph-handshake' },
  { date:'Oct. 2026',   title:'Acquisition de la 4L',desc:'Achat et début de la préparation mécanique complète.',        icon:'ph-car-profile' },
  { date:'Déc. 2026',   title:'Tests & équipement',  desc:'Road trip de test, validation matériel navigation/sécurité.', icon:'ph-gear' },
  { date:'Fév. 2027',   title:'Départ du raid',       desc:'Grand départ de Biarritz. 6 000 km nous attendent.',         icon:'ph-rocket' },
  { date:'Mars 2027',   title:'Retour & restitution', desc:'Conférence de restitution et remerciements partenaires.',    icon:'ph-trophy' },
];

/* ─── Pourquoi nous sponsoriser (Adapté pour Phosphor) ────── */
const arguments_pro = [
  { icon:'ph-target',          title:'Visibilité ciblée',    desc:'Plus de 1 400 équipages, 3 000 étudiants et des milliers de spectateurs suivent le raid chaque année.' },
  { icon:'ph-heart',           title:'Image solidaire',      desc:'Associez votre marque à une démarche humanitaire concrète, mesurable et médiatisée.' },
  { icon:'ph-receipt',         title:'Avantage fiscal',     desc:'60% de votre don est déductible de vos impôts grâce au statut associatif (loi Aillagon).' },
  { icon:'ph-camera',          title:'Contenus premium',     desc:'Photos et vidéos professionnelles de votre logo dans des décors spectaculaires.' },
  { icon:'ph-users',           title:'Engagement RSE',       desc:'Une action concrète à mettre en avant dans votre rapport RSE et communication interne.' },
  { icon:'ph-globe',           title:'Portée internationale',desc:'Votre marque voyage sur 6 000 km à travers 4 pays : France, Espagne, Maroc et retour.' },
];

/* ─── FAQ ─────────────────────────────────────────────────── */
const faq = [
  { q:'Comment s\'effectue le don ?',
    a:'Par virement bancaire direct à notre association ou via notre cagnotte en ligne sécurisée. Un reçu fiscal vous est envoyé dans les 15 jours.' },
  { q:'Quel est l\'avantage fiscal exactement ?',
    a:'En tant qu\'association loi 1901 d\'intérêt général, nous vous délivrons un reçu permettant de déduire 60% du montant de votre impôt sur les sociétés (dans la limite de 0,5% du CA).' },
  { q:'Quand mon logo sera-t-il visible sur la 4L ?',
    a:'Le covering sera réalisé en janvier 2027, soit un mois avant le départ. Nous vous enverrons des photos de validation avant impression.' },
  { q:'Puis-je sponsoriser en nature plutôt qu\'en cash ?',
    a:'Absolument ! Mécénat matériel, équipement, services, préparation mécanique, impression… Toute contribution est bienvenue et valorisée à sa juste valeur.' },
  { q:'Comment suivre notre partenariat pendant le raid ?',
    a:'Nous publions quotidiennement sur nos réseaux sociaux et envoyons un debrief hebdomadaire à nos partenaires. Votre logo apparaîtra dans chaque publication.' },
  { q:'Que se passe-t-il si vous n\'atteignez pas Marrakech ?',
    a:'Notre engagement solidaire reste intact : le matériel scolaire est remis à l\'association quoi qu\'il arrive. Et nous sommes entraînés pour aller au bout !' },
];
const toggleFaq = (i) => { activeFaq.value = activeFaq.value === i ? null : i; };

/* ─── Animation compteurs ─────────────────────────────────── */
const animateCounter = (key, target, duration = 2000) => {
  const start = performance.now();
  const tick  = (now) => {
    const p = Math.min((now - start) / duration, 1);
    stats[key] = Math.floor((1 - Math.pow(1 - p, 3)) * target);
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};
let countersTriggered = false;

/* ─── Lifecycle ───────────────────────────────────────────── */
const observer = ref(null);

onMounted(() => {
  setTimeout(() => { isLoaded.value = true; }, 300);

  /* IntersectionObserver principal — seuil bas + unobserve après activation */
  observer.value = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('active');
      observer.value.unobserve(entry.target); // ne déclenche qu'une seule fois
      if (entry.target.classList.contains('stats-trigger') && !countersTriggered) {
        countersTriggered = true;
        animateCounter('km',        finalStats.km,        2500);
        animateCounter('kgMateriel',finalStats.kgMateriel,2000);
        animateCounter('equipages', finalStats.equipages, 2200);
        animateCounter('jours',     finalStats.jours,     1800);
        animateCounter('pays',      finalStats.pays,      1500);
        animateCounter('enfants',   finalStats.enfants,   2800);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -5% 0px' });
  document.querySelectorAll('.reveal, .stats-trigger').forEach(el => observer.value.observe(el));

  /* IntersectionObserver carte — moins sensible, laisse le temps de lire */
  const routeObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const idx = parseInt(entry.target.dataset.stepIndex);
        if (!isNaN(idx)) mapActiveStep.value = idx;
      }
    });
  }, { threshold: 0.45, rootMargin: '0px 0px -15% 0px' });
  document.querySelectorAll('[data-step-index]').forEach(el => routeObs.observe(el));


  /* Scroll : progress bar + km flottant + position voiture + navbar + parallax */
  const handleScroll = () => {
    const scrollTop  = window.scrollY;
    const docHeight  = document.documentElement.scrollHeight - window.innerHeight;
    scrollProgress.value = (scrollTop / docHeight) * 100;
    kmCounter.value      = Math.floor((scrollTop / docHeight) * 6000);

    /* Navbar : glassmorphism après 80px, masquer en scroll down */
    navScrolled.value = scrollTop > 80;
    navHidden.value   = scrollTop > lastScrollY && scrollTop > 400;
    lastScrollY       = scrollTop;

    /* Parallax hero */
    heroParallax.value = scrollTop * 0.35;

    /* Déplace la voiture sur le chemin SVG */
    const pathEl = document.querySelector('.route-draw-path');
    if (pathEl && routePathLength.value > 0) {
      const p   = mapActiveStep.value / Math.max(1, mapWaypoints.length - 1);
      const pt  = pathEl.getPointAtLength(routePathLength.value * p);
      carPosition.x = pt.x;
      carPosition.y = pt.y;
    }
  };
  window.addEventListener('scroll', handleScroll, { passive: true });

  /* Mesure la longueur réelle du chemin SVG */
  nextTick(() => {
    const pathEl = document.querySelector('.route-draw-path');
    if (pathEl) routePathLength.value = pathEl.getTotalLength();
  });

  /* Curseur custom */
  const onMouseMove  = e => { cursorX.value = e.clientX; cursorY.value = e.clientY; cursorVisible.value = true; };
  const onMouseLeave = () => { cursorVisible.value = false; };
  window.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseleave', onMouseLeave);

  /* Boutons magnétiques */
  document.querySelectorAll('.magnetic').forEach(btn => {
    btn.addEventListener('mousemove', e => {
      const r = btn.getBoundingClientRect();
      btn.style.setProperty('--mx', (e.clientX - r.left - r.width  / 2) / r.width);
      btn.style.setProperty('--my', (e.clientY - r.top  - r.height / 2) / r.height);
      cursorHover.value = true;
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.setProperty('--mx', 0);
      btn.style.setProperty('--my', 0);
      cursorHover.value = false;
    });
  });

  /* 3D Tilt */
  document.querySelectorAll('.tilt-3d').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r  = card.getBoundingClientRect();
      const rx = ((e.clientY - r.top  - r.height/2) / r.height) * -8;
      const ry = ((e.clientX - r.left - r.width /2) / r.width ) * 8;
      card.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-10px)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0)';
    });
  });

  window._appCleanup = () => {
    window.removeEventListener('scroll', handleScroll);
    window.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseleave', onMouseLeave);
  };
});

onUnmounted(() => {
  if (observer.value) observer.value.disconnect();
  if (window._appCleanup) window._appCleanup();
});

const scrollTo  = id  => document.getElementById(id)?.scrollIntoView({ behavior:'smooth' });
const toggleModal = () => { showModal.value = !showModal.value; };
const formatNum   = n => n ? n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f') : '0';</script>

<template>
  <div class="app-container" :class="{ 'app-loaded': isLoaded }">

    <div class="custom-cursor"
         :class="{ visible: cursorVisible, hover: cursorHover }"
         :style="{ transform: `translate(${cursorX}px,${cursorY}px)` }">
      <div class="cursor-dot"></div>
      <div class="cursor-ring"></div>
    </div>

    <div class="scroll-progress" :style="{ width: scrollProgress + '%' }"></div>

    <!-- ═══ NAVBAR GLASSMORPHISM ═══ -->
    <nav class="glass-nav" :class="{ scrolled: navScrolled, hidden: navHidden }">
      <div class="nav-inner">
        <a class="nav-logo" href="#" @click.prevent="window.scrollTo({top:0,behavior:'smooth'})">
          <span class="nav-logo-jack">Jack</span>
          <span class="nav-logo-sparroue">Sparroue</span>
        </a>
        <div class="nav-links">
          <a href="#projet"    @click.prevent="scrollTo('projet')">Projet</a>
          <a href="#parcours"  @click.prevent="scrollTo('parcours')">Parcours</a>
          <a href="#packs"     @click.prevent="scrollTo('packs')">Packs</a>
          <a href="#faq"       @click.prevent="scrollTo('faq')">FAQ</a>
          <button class="nav-cta magnetic" @click="toggleModal">
            <i class="ph-fill ph-paper-plane-tilt"></i> Contact
          </button>
        </div>
      </div>
    </nav>

    <div class="floating-km" :class="{ visible: isLoaded && scrollProgress > 5 }">
      <div class="km-icon"><i class="ph-fill ph-map-pin-line"></i></div>
      <div class="km-content">
        <span class="km-value">{{ formatNum(kmCounter) }}</span>
        <span class="km-label">km parcourus</span>
      </div>
    </div>

    <div class="intro-sequencer">
      <div class="intro-bg"></div>
      <h1 class="intro-logo">
        <span class="word-1">Jack</span>
        <span class="word-2">Sparroue</span>
      </h1>
      <div class="intro-particules"></div>
      <div class="intro-line"></div>
    </div>

    <main class="main-content">

      <header class="hero">
        <div class="hero-bg-layer" :style="{ transform: `translateY(${heroParallax}px)` }"></div>
        <div class="hero-perspective-lines"></div>
        <div class="hero-grain"></div>
        <div class="hero-particles">
          <div v-for="(p,i) in heroParticles" :key="i" class="particle" :style="p"></div>
        </div>
        <div class="hero-glow hero-glow-1"></div>
        <div class="hero-glow hero-glow-2"></div>

        <div class="hero-content">
          <p class="hero-pretitle reveal fade-up">
            <span class="pretitle-line"></span>
            Équipage Professionnel &amp; Solidaire
            <span class="pretitle-line"></span>
          </p>
          <h2 class="hero-title reveal fade-up" style="transition-delay:.2s">
            <span class="title-word title-word-1">Nantes</span>
            <i class="ph-bold ph-arrow-right hero-arrow"></i>
            <span class="title-word title-word-2">Marrakech</span>
          </h2>
          <p class="hero-subtitle reveal fade-up" style="transition-delay:.4s">
            Arthur &amp; Nathaël. <strong>6 000 km</strong> d'engagement pur à bord de
            Lisan al-Carbu, notre Renault 4L de 1987. <strong>4L Trophy 2027.</strong>
          </p>

          <div class="hero-mini-stats reveal fade-up" style="transition-delay:.5s">
            <div class="mini-stat glass-chip"><strong>6 000</strong><span>kilomètres</span></div>
            <div class="mini-stat glass-chip"><strong>21</strong><span>jours de raid</span></div>
            <div class="mini-stat glass-chip"><strong>80 kg</strong><span>de dons acheminés</span></div>
          </div>

          <div class="hero-buttons reveal fade-up" style="transition-delay:.7s">
            <button class="btn btn-primary btn-glow magnetic" @click="scrollTo('projet')">
              Découvrir le Projet <i class="ph-fill ph-compass"></i>
            </button>
            <button class="btn btn-outline magnetic" @click="scrollTo('packs')">
              Devenir Partenaire <i class="ph-fill ph-handshake"></i>
            </button>
          </div>
        </div>

        <div class="scroll-indicator" @click="scrollTo('projet')">
          <span>SCROLL</span>
          <div class="mouse"><div class="wheel"></div></div>
        </div>

        <!-- Wave divider -->
        <div class="hero-wave">
          <svg viewBox="0 0 1440 120" preserveAspectRatio="none">
            <path d="M0,60 C360,120 720,0 1080,60 C1260,90 1380,80 1440,60 L1440,120 L0,120 Z" fill="var(--c-violet)"/>
            <path d="M0,80 C360,130 720,20 1080,80 C1260,105 1380,95 1440,80 L1440,120 L0,120 Z" fill="var(--c-violet)" opacity=".5"/>
          </svg>
        </div>
      </header>

      <section id="stats" class="stats-section stats-trigger reveal fade-up">
        <div class="stats-bg-pattern"></div>
        <div class="stats-container">
          <div class="stat-block">
            <div class="stat-icon"><i class="ph-fill ph-road-horizon"></i></div>
            <div class="stat-number">{{ formatNum(stats.km) }}</div>
            <div class="stat-label">Kilomètres à parcourir</div>
          </div>
          <div class="stat-block">
            <div class="stat-icon"><i class="ph-fill ph-package"></i></div>
            <div class="stat-number">{{ stats.kgMateriel }}<span class="stat-unit">kg</span></div>
            <div class="stat-label">De matériel humanitaire</div>
          </div>
          <div class="stat-block highlight-stat">
            <div class="stat-icon"><i class="ph-fill ph-users-three"></i></div>
            <div class="stat-number">{{ formatNum(stats.enfants) }}<span class="stat-unit">+</span></div>
            <div class="stat-label">Enfants bénéficiaires</div>
          </div>
          <div class="stat-block">
            <div class="stat-icon"><i class="ph-fill ph-calendar-blank"></i></div>
            <div class="stat-number">{{ stats.jours }}</div>
            <div class="stat-label">Jours d'expédition</div>
          </div>
          <div class="stat-block">
            <div class="stat-icon"><i class="ph-fill ph-flag"></i></div>
            <div class="stat-number">{{ stats.pays }}</div>
            <div class="stat-label">Pays traversés</div>
          </div>
          <div class="stat-block">
            <div class="stat-icon"><i class="ph-fill ph-car-profile"></i></div>
            <div class="stat-number">{{ formatNum(stats.equipages) }}</div>
            <div class="stat-label">Équipages au départ</div>
          </div>
        </div>
      </section>

      <!-- Wave: stats → mission -->
      <div class="wave-divider wave-dark-to-light">
        <svg viewBox="0 0 1440 100" preserveAspectRatio="none">
          <path d="M0,0 L0,60 C240,100 480,40 720,70 C960,100 1200,30 1440,50 L1440,0 Z" fill="var(--c-dark)"/>
        </svg>
      </div>

      <section id="projet" class="mission-section">
        <div class="section-header reveal fade-left">
          <span class="section-tag">L'Objectif</span>
          <h2>Une Trajectoire, <span class="highlight-red">Trois Piliers</span></h2>
          <p class="section-desc">
            Nous transformons une aventure mécanique en un levier d'impact social concret.
            Une démarche professionnelle pour une solidarité durable et mesurable.
          </p>
        </div>
        <div class="cards-container">
          <div class="card tilt-3d reveal fade-up" style="transition-delay:.1s">
            <div class="card-visual">
              <i class="ph-fill ph-handshake card-icon"></i>
              <div class="card-shape"></div>
            </div>
            <h3>Entraide</h3>
            <p>Dans le désert, la performance est collective. Pas de chrono, juste la certitude que nous n'avançons qu'ensemble. C'est notre définition du professionnalisme.</p>
            <div class="card-stat"><strong>100%</strong><span>des équipages s'entraident sur le terrain</span></div>
          </div>
          <div class="card tilt-3d reveal fade-up" style="transition-delay:.3s">
            <div class="card-visual">
              <i class="ph-fill ph-package card-icon"></i>
              <div class="card-shape shape-red"></div>
            </div>
            <h3>Solidarité</h3>
            <p>Logistique rigoureuse pour l'acheminement de 80 kg de matériel éducatif et médical pour <em>Enfants du Désert</em> et de denrées pour la <em>Croix-Rouge</em>.</p>
            <div class="card-stat"><strong>20 000+</strong><span>enfants aidés chaque année</span></div>
          </div>
          <div class="card tilt-3d reveal fade-up" style="transition-delay:.5s">
            <div class="card-visual">
              <i class="ph-fill ph-rocket card-icon"></i>
              <div class="card-shape shape-violet"></div>
            </div>
            <h3>Aventure</h3>
            <p>S'orienter à la boussole, maîtriser une mécanique trentenaire, affronter les dunes. Une gestion de projet complexe dans des conditions extrêmes.</p>
            <div class="card-stat"><strong>6 000 km</strong><span>de pur défi humain</span></div>
          </div>
        </div>
      </section>

      <section id="equipage" class="team-section">
        <div class="section-header reveal fade-left">
          <span class="section-tag">L'Équipage</span>
          <h2>Deux Étudiants, <span class="highlight-red">Une Ambition</span></h2>
          <p class="section-desc">Derrière "Jack Sparroue", deux étudiants nantais animés par la même soif d'entreprendre et de donner du sens à leur parcours.</p>
        </div>
        <div class="team-container">
          <div class="team-card reveal fade-up">
            <div class="team-photo-wrapper">
              <div class="team-photo-placeholder"><img></div>
              <div class="team-role">PILOTE</div>
            </div>
            <div class="team-info">
              <h3>Nathaël</h3>
              <p class="team-quote">"Chaque kilomètre est une décision. Chaque décision est un engagement."</p>
              <ul class="team-skills">
                <li><i class="ph-bold ph-check"></i> Mécanique &amp; conduite</li>
                <li><i class="ph-bold ph-check"></i> Gestion de projet</li>
                <li><i class="ph-bold ph-check"></i> Relations partenaires</li>
              </ul>
            </div>
          </div>
          <div class="team-card reveal fade-up" style="transition-delay:.2s">
            <div class="team-photo-wrapper">
              <div class="team-photo-placeholder"><i class="ph-fill ph-map-trifold"></i></div>
              <div class="team-role">CO-PILOTE</div>
            </div>
            <div class="team-info">
              <h3>Arthur</h3>
              <p class="team-quote">"La boussole ne ment pas. Le cap non plus."</p>
              <ul class="team-skills">
                <li><i class="ph-bold ph-check"></i> Navigation &amp; logistique</li>
                <li><i class="ph-bold ph-check"></i> Communication &amp; réseaux</li>
                <li><i class="ph-bold ph-check"></i> Coordination humanitaire</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="parcours" class="route-section">
        <div class="section-header reveal fade-left">
          <span class="section-tag">Le Trajet</span>
          <h2>Le Parcours, <span class="highlight-red">Étape par Étape</span></h2>
          <p class="section-desc">Faites défiler la page pour suivre notre route. La carte se trace en temps réel avec vous.</p>
        </div>

        <div class="route-layout">

          <div class="route-steps-list">

            <div v-for="(etape, i) in etapes" :key="i"
                 class="reveal fade-up"
                 :data-step-index="i"
                 :style="{ transitionDelay: (i * 0.08) + 's' }">

              <div class="route-step"
                   :class="{ 'step-active': mapActiveStep === i }"
                   @mouseenter="mapActiveStep = i">

                <div class="step-number">{{ String(i+1).padStart(2,'0') }}</div>
                <div class="step-content">
                  <div class="step-meta">
                    <span class="step-distance">{{ etape.distance }}</span>
                    <span class="step-date">{{ etape.date }}</span>
                  </div>
                  <h4>{{ etape.ville }}</h4>
                  <div class="step-country">
                    <i class="ph-fill ph-map-pin"></i> {{ etape.pays }}
                  </div>
                  <p>{{ etape.desc }}</p>
                </div>

              </div>
            </div>

          </div>

          <div class="route-map-sticky">
            <div class="map-label reveal fade-up">
              <i class="ph-fill ph-map-pin-line"></i>
              Carte en direct — étape {{ mapActiveStep + 1 }}/{{ etapes.length }}
            </div>

            <div class="journey-map-container">
              <MapMain :step="mapActiveStep" />
            </div>

            <Transition name="step-badge">
              <div class="map-active-badge" :key="mapActiveStep">
                <div class="badge-icon"><i class="ph-fill ph-map-pin"></i></div>
                <div>
                  <div class="badge-city">{{ etapes[mapActiveStep].ville }}</div>
                  <div class="badge-km">{{ etapes[mapActiveStep].distance }}</div>
                </div>
              </div>
            </Transition>
          </div>

        </div></section>

      <section id="pourquoi" class="why-section">
        <div class="why-bg-shape"></div>
        <div class="section-header reveal fade-left">
          <span class="section-tag">Votre Intérêt</span>
          <h2>6 Raisons de <span class="highlight-red">Nous Soutenir</span></h2>
          <p class="section-desc">Un partenariat avec nous, c'est un investissement marketing, fiscal et humain.</p>
        </div>
        <div class="why-grid">
          <div v-for="(arg,i) in arguments_pro" :key="i"
               class="why-card tilt-3d reveal fade-up"
               :style="{ transitionDelay: (i * 0.1) + 's' }">
            <div class="why-icon-wrapper"><i :class="['ph-fill', arg.icon]"></i></div>
            <h4>{{ arg.title }}</h4>
            <p>{{ arg.desc }}</p>
          </div>
        </div>
      </section>

      <section id="packs" class="packs-section">
        <div class="section-header reveal fade-left centered">
          <span class="section-tag">Partenariat</span>
          <h2>Choisissez Votre <span class="highlight-red">Niveau d'Engagement</span></h2>
          <p class="section-desc">Des formules adaptées à toutes les entreprises. 60% de votre don est déductible de vos impôts.</p>
        </div>

        <div class="sponsorship-visualizer reveal fade-up">
          <h3 class="visualizer-title">Où sera votre logo sur Lisan al-Carbu ?</h3>
          <p class="visualizer-subtitle">Survolez un pack pour visualiser vos zones de visibilité.</p>

          <div class="car-view-tabs">
            <button :class="['car-tab', { active: carView==='front' }]" @click="carView='front'">
              <i class="ph-bold ph-arrow-right"></i> Avant
            </button>
            <button :class="['car-tab', { active: carView==='side' }]" @click="carView='side'">
              <i class="ph-fill ph-car-profile"></i> Côté
            </button>
            <button :class="['car-tab', { active: carView==='rear' }]" @click="carView='rear'">
              <i class="ph-bold ph-arrow-left"></i> Arrière
            </button>
          </div>

          <div class="car-interactive-container tilt-3d" style="transform-style: preserve-3d; perspective: 1000px;">
            <svg v-if="carView==='side'" viewBox="0 0 800 340" class="car-interactive-svg">
              <ellipse cx="400" cy="310" rx="330" ry="14" fill="rgba(0,0,0,.12)"/>

              <path d="M 110,265 C 90,265 95,240 100,225 L 115,165 L 260,155 L 350,75 L 610,72 L 690,165 L 705,225 C 715,255 715,265 680,265 Z"
                    fill="#FAF3DD" stroke="#2D1E42" stroke-width="3.5" stroke-linejoin="round"/>

              <path class="car-zone" :class="{ 'zone-active': hoveredPack===0||hoveredPack===3 }"
                    d="M 570,155 L 690,165 L 705,225 C 715,255 715,265 680,265 L 570,265 Z" :fill="packs[0].color"/>

              <path class="car-zone" :class="{ 'zone-active': hoveredPack===1||hoveredPack===3 }"
                    d="M 260,155 L 260,265 L 110,265 C 90,265 95,240 100,225 L 115,165 Z" :fill="packs[1].color"/>

              <path class="car-zone" :class="{ 'zone-active': hoveredPack===2||hoveredPack===3 }"
                    d="M 260,155 L 570,155 L 570,265 L 260,265 Z" :fill="packs[2].color"/>

              <path class="car-zone" :class="{ 'zone-active': hoveredPack===3 }"
                    d="M 260,155 L 350,75 L 610,72 L 610,155 L 260,155 Z" :fill="packs[3].color"/>

              <path d="M 360,85 L 440,82 L 440,145 L 275,145 Z" fill="#1a2d3e" stroke="#2D1E42" stroke-width="3" stroke-linejoin="round"/>
              <path d="M 450,82 L 530,80 L 530,145 L 450,145 Z" fill="#1a2d3e" stroke="#2D1E42" stroke-width="3" stroke-linejoin="round"/>
              <path d="M 540,80 L 595,78 L 605,145 L 540,145 Z" fill="#1a2d3e" stroke="#2D1E42" stroke-width="3" stroke-linejoin="round"/>

              <polygon points="285,145 315,145 385,85 370,85" fill="#ffffff" opacity="0.12"/>
              <polygon points="460,145 490,145 510,80 495,80" fill="#ffffff" opacity="0.12"/>

              <line x1="260" y1="155" x2="260" y2="265" stroke="#2D1E42" stroke-width="2" opacity="0.6"/>
              <line x1="445" y1="155" x2="445" y2="265" stroke="#2D1E42" stroke-width="2" opacity="0.6"/>
              <line x1="535" y1="155" x2="535" y2="265" stroke="#2D1E42" stroke-width="2" opacity="0.6"/>

              <line x1="108" y1="230" x2="695" y2="230" stroke="#2D1E42" stroke-width="8" opacity="0.4" stroke-linecap="round"/>

              <rect x="257" y="170" width="6" height="10" rx="2" fill="#aaa" stroke="#2D1E42" stroke-width="1.5"/>
              <rect x="257" y="210" width="6" height="10" rx="2" fill="#aaa" stroke="#2D1E42" stroke-width="1.5"/>
              <rect x="442" y="170" width="6" height="10" rx="2" fill="#aaa" stroke="#2D1E42" stroke-width="1.5"/>
              <rect x="442" y="210" width="6" height="10" rx="2" fill="#aaa" stroke="#2D1E42" stroke-width="1.5"/>

              <rect x="400" y="165" width="20" height="8" rx="3" fill="#222" stroke="#2D1E42" stroke-width="1.5"/>
              <rect x="490" y="165" width="20" height="8" rx="3" fill="#222" stroke="#2D1E42" stroke-width="1.5"/>

              <circle cx="650" cy="180" r="8" fill="#FAF3DD" stroke="#2D1E42" stroke-width="2"/>
              <circle cx="650" cy="180" r="3" fill="#222" opacity="0.7"/>

              <path d="M 270,145 L 260,130 L 270,120 L 285,120 L 285,140 Z" fill="#222" stroke="#2D1E42" stroke-width="2" stroke-linejoin="round"/>

              <path d="M 115,165 C 105,170 100,185 105,195 L 110,195" fill="none" stroke="#2D1E42" stroke-width="2.5"/>
              <rect x="99" y="200" width="8" height="14" rx="2" fill="#f4a261" stroke="#2D1E42" stroke-width="1.5"/>

              <path d="M 692,168 L 702,168 L 707,205 L 698,205 Z" fill="#E63946" stroke="#2D1E42" stroke-width="2"/>
              <path d="M 692,168 L 702,168 L 703,180 L 694,180 Z" fill="#f4a261"/> <rect x="85" y="240" width="25" height="15" rx="4" fill="#aaa" stroke="#2D1E42" stroke-width="2"/>
              <rect x="90" y="235" width="10" height="25" rx="2" fill="#222" stroke="#111" stroke-width="1"/>

              <rect x="695" y="245" width="25" height="15" rx="4" fill="#aaa" stroke="#2D1E42" stroke-width="2"/>
              <rect x="705" y="240" width="10" height="25" rx="2" fill="#222" stroke="#111" stroke-width="1"/>

              <path d="M 500,265 L 530,265 C 535,265 540,270 540,275" fill="none" stroke="#555" stroke-width="5" stroke-linecap="round"/>

              <path d="M 215,260 L 245,260 L 240,305 L 210,305 Z" fill="#222" stroke="#111" stroke-width="1.5"/>
              <path d="M 605,260 L 635,260 L 630,305 L 600,305 Z" fill="#222" stroke="#111" stroke-width="1.5"/>

              <circle cx="195" cy="265" r="40" fill="#120A1C"/>
              <circle cx="195" cy="265" r="26" fill="#333" stroke="#2D1E42" stroke-width="2"/>
              <circle cx="195" cy="265" r="16" fill="#aaa"/>
              <circle cx="195" cy="265" r="5" fill="#111"/>

              <circle cx="585" cy="265" r="40" fill="#120A1C"/>
              <circle cx="585" cy="265" r="26" fill="#333" stroke="#2D1E42" stroke-width="2"/>
              <circle cx="585" cy="265" r="16" fill="#aaa"/>
              <circle cx="585" cy="265" r="5" fill="#111"/>

              <path d="M 145,265 A 50 50 0 0 1 245,265" fill="none" stroke="#2D1E42" stroke-width="3.5"/>
              <path d="M 535,265 A 50 50 0 0 1 635,265" fill="none" stroke="#2D1E42" stroke-width="3.5"/>

              <text v-if="hoveredPack===0||hoveredPack===3" x="640" y="210" text-anchor="middle" font-family="Oswald,sans-serif" font-size="14" fill="white" font-weight="700">Équipier</text>
              <text v-if="hoveredPack===1||hoveredPack===3" x="185" y="210" text-anchor="middle" font-family="Oswald,sans-serif" font-size="14" fill="white" font-weight="700">Navigateur</text>
              <text v-if="hoveredPack===2||hoveredPack===3" x="415" y="210" text-anchor="middle" font-family="Oswald,sans-serif" font-size="16" fill="white" font-weight="700">Pilote</text>
              <text v-if="hoveredPack===3" x="440" y="110" text-anchor="middle" font-family="Oswald,sans-serif" font-size="14" fill="white" font-weight="700">Capitaine</text>
            </svg>
            <svg v-if="carView==='front'" viewBox="0 0 480 340" class="car-interactive-svg">
              <ellipse cx="240" cy="305" rx="190" ry="14" fill="rgba(0,0,0,.12)"/>
              <rect x="50" y="230" width="45" height="75" rx="8" fill="#120A1C"/>
              <rect x="385" y="230" width="45" height="75" rx="8" fill="#120A1C"/>
              <rect x="60" y="240" width="20" height="50" rx="4" fill="#333"/>
              <rect x="400" y="240" width="20" height="50" rx="4" fill="#333"/>
              <path d="M 160,40 C 200,35 280,35 320,40 L 340,110 L 375,140 C 415,140 435,180 440,230 L 440,275 L 40,275 L 40,230 C 45,180 65,140 105,140 L 140,110 Z" fill="#FAF3DD" stroke="#2D1E42" stroke-width="3.5" stroke-linejoin="round"/>
              <path class="car-zone" :class="{ 'zone-active': hoveredPack===3 }" d="M 160,40 L 320,40 L 340,110 L 375,140 L 105,140 L 140,110 Z" :fill="packs[3].color"/>
              <path class="car-zone" :class="{ 'zone-active': hoveredPack===1||hoveredPack===3 }" d="M 105,140 C 65,140 45,180 40,230 L 40,275 L 110,275 Z" :fill="packs[1].color"/>
              <path class="car-zone" :class="{ 'zone-active': hoveredPack===1||hoveredPack===3 }" d="M 375,140 C 415,140 435,180 440,230 L 440,275 L 370,275 Z" :fill="packs[1].color"/>
              <path d="M 162,45 C 200,42 280,42 318,45 L 335,105 L 145,105 Z" fill="#1a2d3e" stroke="#2D1E42" stroke-width="3" stroke-linejoin="round"/>
              <polygon points="175,45 230,45 200,105 155,105" fill="#ffffff" opacity="0.12"/>
              <line x1="180" y1="105" x2="215" y2="80" stroke="#2D1E42" stroke-width="3" stroke-linecap="round"/>
              <line x1="270" y1="105" x2="305" y2="80" stroke="#2D1E42" stroke-width="3" stroke-linecap="round"/>
              <rect x="190" y="115" width="100" height="8" rx="4" fill="#2D1E42" opacity="0.8"/>
              <path d="M 140,110 L 340,110" fill="none" stroke="#2D1E42" stroke-width="2.5"/>
              <path d="M 105,140 L 375,140" fill="none" stroke="#2D1E42" stroke-width="2.5" opacity="0.6"/>
              <rect x="115" y="145" width="250" height="68" rx="8" fill="#555" stroke="#2D1E42" stroke-width="3"/>
              <rect x="120" y="150" width="240" height="58" rx="5" fill="#222"/>
              <line x1="120" y1="168" x2="360" y2="168" stroke="#111" stroke-width="3"/>
              <line x1="120" y1="187" x2="360" y2="187" stroke="#111" stroke-width="3"/>
              <circle cx="155" cy="179" r="24" fill="#e8f4f8" stroke="#2D1E42" stroke-width="3"/>
              <circle cx="155" cy="179" r="16" fill="#fff"/>
              <circle cx="162" cy="172" r="5" fill="#fff" opacity="0.8"/> <circle cx="325" cy="179" r="24" fill="#e8f4f8" stroke="#2D1E42" stroke-width="3"/>
              <circle cx="325" cy="179" r="16" fill="#fff"/>
              <circle cx="332" cy="172" r="5" fill="#fff" opacity="0.8"/> <rect x="135" y="218" width="35" height="14" rx="4" fill="#f4a261" stroke="#2D1E42" stroke-width="2"/>
              <rect x="310" y="218" width="35" height="14" rx="4" fill="#f4a261" stroke="#2D1E42" stroke-width="2"/>
              <polygon points="240,164 248,178 240,192 232,178" fill="#e8f4f8" stroke="#2D1E42" stroke-width="2"/>
              <path d="M 142,100 L 118,100 L 112,75 L 135,75 Z" fill="#FAF3DD" stroke="#2D1E42" stroke-width="2.5" stroke-linejoin="round"/>
              <path d="M 338,100 L 362,100 L 368,75 L 345,75 Z" fill="#FAF3DD" stroke="#2D1E42" stroke-width="2.5" stroke-linejoin="round"/>
              <rect x="35" y="250" width="410" height="26" rx="6" fill="#aaa" stroke="#2D1E42" stroke-width="3"/>
              <path d="M 115,235 L 135,235 L 135,285 L 115,280 Z" fill="#222" stroke="#2D1E42" stroke-width="1.5"/>
              <path d="M 345,235 L 365,235 L 365,280 L 345,285 Z" fill="#222" stroke="#2D1E42" stroke-width="1.5"/>
              <rect x="175" y="258" width="130" height="22" rx="3" fill="#fff" stroke="#2D1E42" stroke-width="2"/>
              <text x="240" y="274" text-anchor="middle" font-family="Oswald,sans-serif" font-size="11" fill="#2D1E42" font-weight="700">JACK SPARROUE</text>
              <text v-if="hoveredPack===1||hoveredPack===3" x="70" y="215" text-anchor="middle" font-family="Oswald,sans-serif" font-size="13" fill="white" font-weight="700" transform="rotate(-90,70,215)">Navigateur</text>
              <text v-if="hoveredPack===1||hoveredPack===3" x="410" y="215" text-anchor="middle" font-family="Oswald,sans-serif" font-size="13" fill="white" font-weight="700" transform="rotate(90,410,215)">Navigateur</text>
              <text v-if="hoveredPack===3" x="240" y="98" text-anchor="middle" font-family="Oswald,sans-serif" font-size="18" fill="white" font-weight="700">Capitaine</text>
            </svg>

            <svg v-if="carView==='rear'" viewBox="0 0 480 340" class="car-interactive-svg">
              <ellipse cx="240" cy="305" rx="190" ry="14" fill="rgba(0,0,0,.12)"/>
              <path d="M 45,270 L 95,270 L 90,320 L 50,320 Z" fill="#222" stroke="#111" stroke-width="2"/>
              <path d="M 435,270 L 385,270 L 390,320 L 430,320 Z" fill="#222" stroke="#111" stroke-width="2"/>
              <circle cx="70" cy="300" r="5" fill="#E63946"/>
              <circle cx="410" cy="300" r="5" fill="#E63946"/>
              <rect x="50" y="230" width="45" height="75" rx="8" fill="#120A1C"/>
              <rect x="385" y="230" width="45" height="75" rx="8" fill="#120A1C"/>
              <rect x="60" y="240" width="20" height="50" rx="4" fill="#333"/>
              <rect x="400" y="240" width="20" height="50" rx="4" fill="#333"/>
              <path d="M 160,40 C 200,35 280,35 320,40 L 330,100 C 380,105 420,150 440,230 L 440,275 L 40,275 L 40,230 C 60,150 100,105 150,100 L 160,40 Z" fill="#FAF3DD" stroke="#2D1E42" stroke-width="3.5" stroke-linejoin="round"/>
              <path class="car-zone" :class="{ 'zone-active': hoveredPack===3 }" d="M 160,40 L 320,40 L 340,240 L 140,240 Z" :fill="packs[3].color"/>
              <path class="car-zone" :class="{ 'zone-active': hoveredPack===0||hoveredPack===3 }" d="M 140,240 L 155,100 C 100,105 60,150 40,230 L 40,275 L 110,275 Z" :fill="packs[0].color"/>
              <path class="car-zone" :class="{ 'zone-active': hoveredPack===0||hoveredPack===3 }" d="M 340,240 L 325,100 C 380,105 420,150 440,230 L 440,275 L 370,275 Z" :fill="packs[0].color"/>
              <path d="M 160,40 L 320,40 L 340,240 L 140,240 Z" fill="none" stroke="#2D1E42" stroke-width="3" stroke-linejoin="round"/>
              <path d="M 165,55 L 315,55 L 325,120 L 155,120 Z" fill="#1a2d3e" stroke="#2D1E42" stroke-width="3" stroke-linejoin="round"/>
              <polygon points="180,55 240,55 210,120 160,120" fill="#ffffff" opacity="0.1"/> <line x1="163" y1="70" x2="317" y2="70" stroke="#FAF3DD" stroke-width="1.5" opacity="0.25"/>
              <line x1="161" y1="85" x2="319" y2="85" stroke="#FAF3DD" stroke-width="1.5" opacity="0.25"/>
              <line x1="158" y1="100" x2="322" y2="100" stroke="#FAF3DD" stroke-width="1.5" opacity="0.25"/>
              <rect x="180" y="38" width="16" height="10" rx="2" fill="#aaa" stroke="#2D1E42" stroke-width="2"/>
              <rect x="284" y="38" width="16" height="10" rx="2" fill="#aaa" stroke="#2D1E42" stroke-width="2"/>
              <rect x="210" y="165" width="60" height="12" rx="3" fill="#ccc" stroke="#2D1E42" stroke-width="2"/>
              <rect x="225" y="215" width="30" height="8" rx="4" fill="#333" stroke="#2D1E42" stroke-width="1.5"/>
              <line x1="145" y1="140" x2="335" y2="140" stroke="#2D1E42" stroke-width="2" opacity="0.3"/>
              <g transform="translate(60, 145)">
                <rect x="0" y="0" width="38" height="65" rx="5" fill="#E63946" stroke="#2D1E42" stroke-width="3"/>
                <rect x="0" y="0" width="38" height="22" rx="5 5 0 0" fill="#f4a261"/>
                <rect x="0" y="43" width="38" height="22" rx="0 0 5 5" fill="#fff" opacity="0.9"/>
                <line x1="0" y1="22" x2="38" y2="22" stroke="#2D1E42" stroke-width="1.5"/>
                <line x1="0" y1="43" x2="38" y2="43" stroke="#2D1E42" stroke-width="1.5"/>
              </g>
              <g transform="translate(382, 145)">
                <rect x="0" y="0" width="38" height="65" rx="5" fill="#E63946" stroke="#2D1E42" stroke-width="3"/>
                <rect x="0" y="0" width="38" height="22" rx="5 5 0 0" fill="#f4a261"/>
                <rect x="0" y="43" width="38" height="22" rx="0 0 5 5" fill="#fff" opacity="0.9"/>
                <line x1="0" y1="22" x2="38" y2="22" stroke="#2D1E42" stroke-width="1.5"/>
                <line x1="0" y1="43" x2="38" y2="43" stroke="#2D1E42" stroke-width="1.5"/>
              </g>
              <rect x="175" y="178" width="130" height="25" rx="3" fill="#fff" stroke="#2D1E42" stroke-width="2"/>
              <text x="240" y="195" text-anchor="middle" font-family="Oswald,sans-serif" font-size="12" fill="#2D1E42" font-weight="700">JACK SPARROUE</text>
              <rect x="35" y="250" width="410" height="26" rx="6" fill="#aaa" stroke="#2D1E42" stroke-width="3"/>
              <path d="M 115,240 L 135,240 L 135,280 L 115,285 Z" fill="#222" stroke="#2D1E42" stroke-width="1.5"/>
              <path d="M 345,240 L 365,240 L 365,285 L 345,280 Z" fill="#222" stroke="#2D1E42" stroke-width="1.5"/>
              <path d="M 110,275 L 110,295 C 110,300 100,305 95,305" fill="none" stroke="#444" stroke-width="6" stroke-linecap="round"/>
              <circle cx="95" cy="305" r="2" fill="#111"/> <text v-if="hoveredPack===0||hoveredPack===3" x="70" y="225" text-anchor="middle" font-family="Oswald,sans-serif" font-size="13" fill="white" font-weight="700" transform="rotate(-90,70,225)">Équipier</text>
              <text v-if="hoveredPack===0||hoveredPack===3" x="410" y="225" text-anchor="middle" font-family="Oswald,sans-serif" font-size="13" fill="white" font-weight="700" transform="rotate(90,410,225)">Équipier</text>
              <text v-if="hoveredPack===3" x="240" y="88" text-anchor="middle" font-family="Oswald,sans-serif" font-size="18" fill="white" font-weight="700">Capitaine</text>
            </svg>

          </div>
        </div>

        <div class="packs-grid">

          <div v-for="(pack,i) in packs" :key="i" class="reveal fade-up" :style="{ transitionDelay: (i * 0.15) + 's' }">

            <div
                class="pack-card"
                :class="{ 'pack-highlight': pack.highlight, 'pack-hovered': hoveredPack === i }"
                :style="{ '--pack-color': pack.color, height: '100%' }"
                @mouseenter="hoveredPack = i"
                @mouseleave="hoveredPack = null">

              <div v-if="pack.highlight" class="pack-badge">★ Recommandé</div>
              <div class="pack-header">
                <div class="pack-icon"><i class="ph-fill ph-medal"></i></div>
                <h3>{{ pack.name }}</h3>
                <div class="pack-price">{{ pack.price }}</div>
                <div class="pack-tax">Déductible à 60% — soit <strong>{{ pack.name==='Équipier'?'100 €':pack.name==='Navigateur'?'300 €':pack.name==='Pilote'?'600 €':'1 200 €' }}</strong> net</div>
              </div>
              <ul class="pack-features">
                <li v-for="(feat,j) in pack.features" :key="j">
                  <i class="ph-bold ph-check"></i> {{ feat }}
                </li>
              </ul>
              <button class="btn btn-pack magnetic" @click="toggleModal">Choisir ce pack</button>
            </div>

          </div>

        </div>
        <p class="packs-note reveal fade-up">
          * Exemple&nbsp;: un don de 1&nbsp;500&nbsp;€ ne vous coûte réellement que <strong>600&nbsp;€</strong> après déduction fiscale de 60% (loi Aillagon — entreprises).
        </p>
      </section>
      <!-- Wave: packs → budget -->
      <div class="wave-divider wave-light-to-dark">
        <svg viewBox="0 0 1440 100" preserveAspectRatio="none">
          <path d="M0,100 L0,40 C360,0 720,80 1080,30 C1260,10 1380,20 1440,40 L1440,100 Z" fill="var(--c-dark)"/>
        </svg>
      </div>

      <section class="budget-section">
        <div class="budget-inner">

          <!-- En-tête -->
          <div class="budget-header reveal fade-left">
            <span class="section-tag">Financement</span>
            <h2>Où en est <span class="highlight-red">Notre Budget ?</span></h2>
            <p class="section-desc">6 000 km de préparation. Voici comment chaque euro de votre soutien sera utilisé.</p>
          </div>

          <div class="budget-layout">

            <!-- ── COLONNE GAUCHE : progression + donut breakdown ── -->
            <div class="budget-left reveal fade-up">

              <!-- Jauge de progression -->
              <div class="prog-zone">
                <svg viewBox="0 0 200 200" class="prog-svg">
                  <defs>
                    <linearGradient id="progGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%"   stop-color="#FF1A2E"/>
                      <stop offset="100%" stop-color="#F5A623"/>
                    </linearGradient>
                    <filter id="progGlow" x="-30%" y="-30%" width="160%" height="160%">
                      <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur"/>
                      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                  </defs>

                  <!-- Piste de fond -->
                  <circle cx="100" cy="100" :r="PROG_R"
                    fill="none" stroke="rgba(255,255,255,.07)" stroke-width="18"/>

                  <!-- Arc de progression avec dégradé et glow -->
                  <circle cx="100" cy="100" :r="PROG_R"
                    fill="none" stroke="url(#progGrad)" stroke-width="18" stroke-linecap="round"
                    filter="url(#progGlow)"
                    :stroke-dasharray="PROG_C"
                    :stroke-dashoffset="progOffset"
                    class="prog-arc"/>

                  <!-- Camembert répartition budgétaire (anneau externe) -->
                  <g v-for="(s, i) in budgetSlices" :key="'bs'+i"
                    style="cursor:pointer"
                    @mouseenter="hoveredBudget = i"
                    @mouseleave="hoveredBudget = null">
                    <path :d="s.path"
                      :fill="s.color"
                      class="budget-arc-slice"
                      :class="{ 'slice-active': hoveredBudget === i, 'slice-dim': hoveredBudget !== null && hoveredBudget !== i }"/>
                  </g>

                  <!-- Texte central -->
                  <text x="100" y="90" text-anchor="middle"
                    font-family="Oswald,sans-serif" font-size="38" font-weight="700" fill="white">
                    {{ budgetPourcentage }}%
                  </text>
                  <text x="100" y="107" text-anchor="middle"
                    font-family="Montserrat,sans-serif" font-size="8.5" fill="rgba(255,255,255,.5)"
                    letter-spacing="3">FINANCÉS</text>
                  <text x="100" y="125" text-anchor="middle"
                    font-family="Montserrat,sans-serif" font-size="9.5" fill="rgba(255,255,255,.65)">
                    {{ formatNum(budgetActuel) }} € / {{ formatNum(budgetObjectif) }} €
                  </text>
                </svg>

                <!-- Tooltip slice au hover -->
                <Transition name="slice-tip">
                  <div v-if="hoveredBudget !== null" class="slice-tooltip">
                    <span class="tip-dot" :style="{ background: budgetItems[hoveredBudget].color }"></span>
                    <strong>{{ budgetItems[hoveredBudget].label }}</strong>
                    <span class="tip-sep">·</span>
                    <span class="tip-amount">{{ formatNum(budgetItems[hoveredBudget].amount) }} €</span>
                    <span class="tip-pct">({{ budgetItems[hoveredBudget].pct }}%)</span>
                  </div>
                </Transition>
              </div>

              <!-- Chiffres clés -->
              <div class="prog-stats">
                <div class="ps-item">
                  <span class="ps-val" style="color:#FF1A2E">{{ formatNum(budgetActuel) }} €</span>
                  <span class="ps-lab">Récoltés</span>
                </div>
                <div class="ps-sep"></div>
                <div class="ps-item">
                  <span class="ps-val" style="color:var(--c-or)">{{ formatNum(budgetObjectif - budgetActuel) }} €</span>
                  <span class="ps-lab">Restants</span>
                </div>
                <div class="ps-sep"></div>
                <div class="ps-item">
                  <span class="ps-val">{{ formatNum(budgetObjectif) }} €</span>
                  <span class="ps-lab">Objectif total</span>
                </div>
              </div>
            </div>

            <!-- ── COLONNE DROITE : détail répartition ── -->
            <div class="budget-right reveal fade-up" style="transition-delay:.18s">
              <h3 class="breakdown-title">Répartition du budget</h3>
              <p class="breakdown-hint">Survolez une section du graphique ou une ligne ci-dessous.</p>

              <div class="breakdown-list">
                <div v-for="(item, i) in budgetItems" :key="'bi'+i"
                  class="breakdown-row"
                  :class="{ 'row-active': hoveredBudget === i, 'row-dim': hoveredBudget !== null && hoveredBudget !== i }"
                  @mouseenter="hoveredBudget = i"
                  @mouseleave="hoveredBudget = null">

                  <div class="row-label">
                    <span class="row-dot" :style="{ background: item.color }"></span>
                    <span class="row-text">{{ item.label }}</span>
                  </div>

                  <div class="row-bar-wrap">
                    <div class="row-bar-track">
                      <div class="row-bar-fill"
                        :style="{ width: item.pct + '%', background: item.color }"></div>
                    </div>
                    <span class="row-pct">{{ item.pct }}%</span>
                  </div>

                  <span class="row-amount">{{ formatNum(item.amount) }} €</span>
                </div>
              </div>

              <div class="breakdown-total">
                <span>Total prévu</span>
                <strong>{{ formatNum(budgetObjectif) }} €</strong>
              </div>
            </div>

          </div><!-- fin budget-layout -->
        </div><!-- fin budget-inner -->
      </section>
      <section id="calendrier" class="timeline-section">
        <div class="section-header reveal fade-left">
          <span class="section-tag">Calendrier</span>
          <h2>Notre <span class="highlight-red">Feuille de Route</span></h2>
          <p class="section-desc">Un projet structuré, planifié, professionnel. Voici les grandes étapes de notre aventure.</p>
        </div>
        <div class="timeline-wrapper">
          <div class="timeline-line"></div>
          <div v-for="(item,i) in timeline" :key="i"
               class="timeline-item reveal fade-up"
               :class="{ 'timeline-right': i % 2 === 1 }"
               :style="{ transitionDelay: (i * 0.1) + 's' }">
            <div class="timeline-icon"><i :class="['ph-fill', item.icon]"></i></div>
            <div class="timeline-card">
              <div class="timeline-date">{{ item.date }}</div>
              <h4>{{ item.title }}</h4>
              <p>{{ item.desc }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══════════════ NOS SPONSORS ════════════════════════ -->
      <section id="nos-sponsors" class="nos-sponsors-section reveal fade-up">
        <div class="nos-sponsors-inner">

          <div class="nos-sponsors-header">
            <span class="section-tag">Partenaires Officiels</span>
            <h2>Nos <span class="text-gradient">Partenaires</span></h2>
            <p>Ces entreprises et particuliers croient en notre aventure et nous permettent de la vivre.</p>
          </div>

          <!-- ── Visibilité média ── -->
          <div class="media-visibility reveal fade-up">
            <p class="media-intro">
              <i class="ph-fill ph-megaphone"></i>
              Votre marque exposée à une <strong>couverture médiatique internationale</strong> grâce au plan de communication officiel du Raid 4L Trophy&trade;
            </p>
            <div class="media-stats-row">
              <div class="media-stat">
                <span class="media-stat-num">6 000<sup>+</sup></span>
                <span class="media-stat-label">articles<br>presse écrite</span>
                <i class="ph-fill ph-newspaper media-stat-icon"></i>
              </div>
              <div class="media-stat">
                <span class="media-stat-num">11h<sup>+</sup></span>
                <span class="media-stat-label">reportages<br>TV &amp; web TV</span>
                <i class="ph-fill ph-television media-stat-icon"></i>
              </div>
              <div class="media-stat">
                <span class="media-stat-num">3h</span>
                <span class="media-stat-label">de couverture<br>radio</span>
                <i class="ph-fill ph-radio media-stat-icon"></i>
              </div>
              <div class="media-stat">
                <span class="media-stat-num">9 000</span>
                <span class="media-stat-label">photos/jour<br>par des pros</span>
                <i class="ph-fill ph-camera media-stat-icon"></i>
              </div>
            </div>
            <div class="media-details-row">
              <div class="media-detail-item">
                <i class="ph-fill ph-video-camera"></i>
                <span>Journal Télévisé quotidien <strong>4L TV</strong> diffusé chaque soir sur le site officiel du Raid</span>
              </div>
              <div class="media-detail-item">
                <i class="ph-fill ph-broadcast"></i>
                <span>Société de production présente sur place — images transmises aux <strong>chaînes nationales &amp; internationales</strong></span>
              </div>
              <div class="media-detail-item">
                <i class="ph-fill ph-buildings"></i>
                <span>Salle de presse sur les bivouacs avec <strong>communiqués de presse</strong> réguliers</span>
              </div>
              <div class="media-detail-item">
                <i class="ph-fill ph-camera-slash"></i>
                <span>Photographes officiels du Dakar pour le suivi presse écrite &amp; internet</span>
              </div>
            </div>
          </div>

          <!-- ── État rempli ── -->
          <template v-if="sponsors.length > 0">
            <div v-for="tier in sponsorTiers" :key="tier" class="sponsors-tier-block">
              <template v-if="sponsorsByTier(tier).length > 0">
                <div class="tier-label">
                  <span class="tier-badge" :style="{ background: sponsorTierColor[tier] }">{{ tier }}</span>
                </div>
                <div class="sponsors-grid" :class="'tier-' + tier.toLowerCase()">
                  <a
                      v-for="(sp, i) in sponsorsByTier(tier)"
                      :key="tier + i"
                      :href="sp.url || '#'"
                      :target="sp.url ? '_blank' : '_self'"
                      class="sponsor-card magnetic"
                  >
                    <img v-if="sp.logo" :src="sp.logo" :alt="sp.name" class="sponsor-logo" />
                    <span v-else class="sponsor-name-text">{{ sp.name }}</span>
                    <span class="sponsor-tier-chip" :style="{ background: sponsorTierColor[tier] }">{{ tier }}</span>
                  </a>
                </div>
              </template>
            </div>
          </template>

          <!-- ── État vide ── -->
          <template v-else>
            <div class="sponsors-empty">
              <p class="sponsors-empty-lead">Vous pourriez être ici&nbsp;! 🚀</p>
              <p class="sponsors-empty-sub">Nos premières places partenaires sont ouvertes. Associez votre marque à l'aventure.</p>
              <div class="empty-tiers">
                <div v-for="tier in sponsorTiers" :key="tier" class="empty-tier">
                  <div class="empty-tier-label" :style="{ borderColor: sponsorTierColor[tier], color: sponsorTierColor[tier] }">
                    {{ tier }}
                  </div>
                  <div class="empty-slots-row">
                    <div
                        v-for="n in (tier === 'Capitaine' ? 2 : tier === 'Pilote' ? 3 : tier === 'Navigateur' ? 4 : 6)"
                        :key="n"
                        class="empty-slot"
                        :style="{ borderColor: sponsorTierColor[tier] + '55' }"
                    >
                      <i class="ph-bold ph-image" :style="{ color: sponsorTierColor[tier] + '88' }"></i>
                      <span>Votre logo</span>
                    </div>
                  </div>
                </div>
              </div>
              <button class="btn btn-rouge btn-lg magnetic" @click="toggleModal">
                <i class="ph-fill ph-handshake"></i> Devenir Partenaire
              </button>
            </div>
          </template>

        </div>
      </section>
      <!-- ══════════════════════════════════════════════════════ -->



      <section id="faq" class="faq-section">
        <div class="section-header reveal fade-left">
          <span class="section-tag">Questions</span>
          <h2>Vous Vous <span class="highlight-red">Demandez ?</span></h2>
          <p class="section-desc">Les réponses aux questions les plus fréquentes de nos futurs partenaires.</p>
        </div>

        <div class="faq-container">

          <div v-for="(item,i) in faq" :key="i" class="reveal fade-up" :style="{ transitionDelay: (i * 0.07) + 's' }">

            <div
                class="faq-item"
                :class="{ 'faq-open': activeFaq === i }"
                @click="toggleFaq(i)">

              <div class="faq-question">
                <span>{{ item.q }}</span>
                <span class="faq-icon"><i class="ph-bold ph-plus"></i></span>
              </div>
              <div class="faq-body">
                <p>{{ item.a }}</p>
              </div>

            </div>

          </div>

        </div>
      </section>

      <section class="sponsor-section">
        <div class="sponsor-diagonal-bg"></div>
        <div class="sponsor-particles">
          <div v-for="(p,i) in sponsorParticles" :key="'sp'+i" class="particle-violet" :style="p"></div>
        </div>
        <div class="sponsor-content reveal zoom-in">
          <span class="sponsor-tag">Appel Final</span>
          <h2>Devenez le <span class="text-gradient">Carburant</span> de notre Impact</h2>
          <p>Associez votre marque à une image d'<strong>audace</strong>, de <strong>rigueur</strong> et de <strong>solidarité</strong>. Votre logo sur notre 4L — une visibilité internationale dynamique et engagée.</p>
          <div class="sponsor-cta-group">
            <button class="btn btn-white btn-lg pulse-red-anim magnetic" @click="toggleModal">
              <i class="ph-fill ph-paper-plane-tilt"></i> Rejoindre l'Équipage
            </button>
            <button class="btn btn-outline-white btn-lg magnetic" @click="scrollTo('packs')">
              Voir les packs
            </button>
          </div>
          <div class="sponsor-trust">
            <div class="trust-item"><i class="ph-fill ph-shield-check"></i> Association loi 1901</div>
            <div class="trust-item"><i class="ph-fill ph-receipt"></i> Reçus fiscaux officiels</div>
            <div class="trust-item"><i class="ph-fill ph-handshake"></i> Engagement contractuel</div>
          </div>
        </div>
      </section>

      <footer class="footer">
        <div class="footer-content">
          <div class="footer-top">
            <div class="footer-col">
              <p class="footer-logo">Jack Sparroue</p>
              <p class="footer-tagline">L'audace de partir, la rigueur d'arriver.</p>
            </div>
            <div class="footer-col">
              <h5>Navigation</h5>
              <a href="#projet"    @click.prevent="scrollTo('projet')">Le projet</a>
              <a href="#parcours"  @click.prevent="scrollTo('parcours')">Le parcours</a>
              <a href="#packs"     @click.prevent="scrollTo('packs')">Devenir partenaire</a>
              <a href="#faq"       @click.prevent="scrollTo('faq')">FAQ</a>
            </div>
            <div class="footer-col">
              <h5>Contact</h5>
              <p><i class="ph-fill ph-envelope-simple"></i> contact@jacksparroue.fr</p>
              <p><i class="ph-fill ph-map-pin"></i> Nantes (44)</p>
              <div class="social-links">
                <a href="#" class="magnetic"><i class="ph-fill ph-instagram-logo"></i></a>
                <a href="#" class="magnetic"><i class="ph-fill ph-linkedin-logo"></i></a>
                <a href="#" class="magnetic"><i class="ph-fill ph-tiktok-logo"></i></a>
                <a href="#" class="magnetic"><i class="ph-fill ph-youtube-logo"></i></a>
              </div>
            </div>
          </div>
          <div class="footer-bottom">
            <p>© 2027 Association Jack Sparroue. Tous droits réservés. Nantes, France.</p>
          </div>
        </div>
      </footer>

    </main><Transition name="modal">
    <div v-if="showModal" class="modal-backdrop" @click.self="toggleModal">
      <div class="modal-content">
        <button class="close-btn" @click="toggleModal"><i class="ph-bold ph-x"></i></button>
        <div class="modal-header">
          <i class="ph-fill ph-headset modal-icon"></i>
          <h3>Connexion Équipage</h3>
        </div>
        <div class="separator-vibrant"></div>
        <ul class="contact-list">
          <li><i class="ph-fill ph-user-circle"></i> <strong>Arthur (Pilote) :</strong> 06.XX.XX.XX.XX</li>
          <li><i class="ph-fill ph-map-pin"></i> <strong>Nathaël (Co-pilote) :</strong> 06.XX.XX.XX.XX</li>
          <li><i class="ph-fill ph-envelope-open"></i> <strong>Email :</strong> contact@jacksparroue.fr</li>
          <li><i class="ph-fill ph-buildings"></i> <strong>Siège :</strong> Nantes (44)</li>
        </ul>
        <div class="modal-footer-block">
          <p class="modal-quote">"L'audace de partir, la rigueur d'arriver."</p>
          <a href="mailto:contact@jacksparroue.fr" class="btn btn-primary btn-full magnetic">
            <i class="ph-fill ph-paper-plane-tilt"></i> Envoyer une Proposition
          </a>
        </div>
      </div>
    </div>
  </Transition>

  </div></template>

<style>
/* ============================================================
   IMPORTS & VARIABLES
   ============================================================ */
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&family=Montserrat:wght@300;400;600;700&display=swap');

/* 👇 NOUVEAUX IMPORTS POUR PHOSPHOR ICONS 👇 */
@import url('https://unpkg.com/@phosphor-icons/web/src/regular/style.css');
@import url('https://unpkg.com/@phosphor-icons/web/src/fill/style.css');
@import url('https://unpkg.com/@phosphor-icons/web/src/bold/style.css');

:root {
  /* ── Palette impactante ───────────────────────── */
  --c-violet:  #16092B;   /* nuit profonde */
  --c-violet2: #8B5CF6;   /* violet électrique */
  --c-rouge:   #FF1A2E;   /* rouge vif / racing */
  --c-rouge2:  #FF4D5E;   /* rouge hover */
  --c-or:      #F5A623;   /* or désert (accent) */
  --c-or2:     #FFD166;   /* or clair */
  --c-creme:   #FDF6EE;   /* blanc chaud */
  --c-sable:   #D4A574;
  --c-dark:    #08030F;   /* quasi-noir */
  --font-title: 'Oswald', sans-serif;
  --font-text:  'Montserrat', sans-serif;
  --ease:       cubic-bezier(.23,1,.32,1);
}

/* ── Reset ─────────────────────────────────────────────────── */
*, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
body {
  font-family: var(--font-text);
  background: var(--c-creme);
  color: var(--c-violet);
  line-height: 1.6;
  overflow-x: hidden;
  cursor: none;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
@media (max-width:900px) { body { cursor:auto; } }
#app, body, html {
  max-width:100% !important;
  width:100vw !important;
  margin:0 !important;
  padding:0 !important;
  display:block !important;
}

/* ═══════════════════════════════════════════════════════════
   GLASSMORPHISM NAVBAR
   ═══════════════════════════════════════════════════════════ */
.glass-nav {
  position:fixed; top:0; left:0; right:0; z-index:900;
  padding:20px 5%;
  transition:all .5s var(--ease);
  transform:translateY(-100%);
  opacity:0;
}
.glass-nav.scrolled {
  transform:translateY(0);
  opacity:1;
  padding:12px 5%;
  background:rgba(8,3,15,.65);
  backdrop-filter:blur(20px) saturate(1.5);
  -webkit-backdrop-filter:blur(20px) saturate(1.5);
  border-bottom:1px solid rgba(255,255,255,.08);
  box-shadow:0 8px 32px rgba(0,0,0,.3);
}
.glass-nav.hidden { transform:translateY(-100%); opacity:0; }
.nav-inner {
  max-width:1300px; margin:0 auto;
  display:flex; align-items:center; justify-content:space-between;
}
.nav-logo {
  text-decoration:none; display:flex; gap:8px;
  font-family:var(--font-title); text-transform:uppercase;
  letter-spacing:2px;
}
.nav-logo-jack { color:var(--c-creme); font-size:1.2rem; font-weight:700; }
.nav-logo-sparroue { color:var(--c-rouge); font-size:1.2rem; font-weight:700; }
.nav-links {
  display:flex; align-items:center; gap:32px;
}
.nav-links a {
  color:rgba(250,243,221,.7); text-decoration:none;
  font-family:var(--font-title); font-size:.82rem;
  text-transform:uppercase; letter-spacing:1.5px;
  transition:all .3s; position:relative;
  padding-bottom:4px;
}
.nav-links a::after {
  content:''; position:absolute; bottom:0; left:0;
  width:0; height:2px; background:var(--c-rouge);
  transition:width .3s var(--ease);
}
.nav-links a:hover { color:#fff; }
.nav-links a:hover::after { width:100%; }
.nav-cta {
  background:var(--c-rouge); color:#fff; border:none;
  font-family:var(--font-title); font-size:.8rem;
  text-transform:uppercase; letter-spacing:1.5px;
  padding:10px 22px; border-radius:6px; cursor:pointer;
  display:flex; align-items:center; gap:8px;
  transition:all .3s var(--ease);
  box-shadow:0 4px 15px rgba(255,26,46,.3);
}
.nav-cta:hover {
  background:var(--c-rouge2);
  box-shadow:0 6px 25px rgba(255,26,46,.5);
  transform:translateY(-2px);
}
@media (max-width:768px) {
  .nav-links a:not(.nav-cta) { display:none; }
  .glass-nav.scrolled { padding:10px 4%; }
}

/* ═══════════════════════════════════════════════════════════
   WAVE DIVIDERS
   ═══════════════════════════════════════════════════════════ */
.wave-divider {
  line-height:0; margin-top:-2px; margin-bottom:-2px;
  position:relative; z-index:5;
}
.wave-divider svg { width:100%; height:80px; display:block; }
.wave-light-to-dark { background:var(--c-creme); }
.wave-dark-to-light { background:var(--c-creme); }

/* ═══════════════════════════════════════════════════════════
   GLASS CHIP (mini stats, tags)
   ═══════════════════════════════════════════════════════════ */
.glass-chip {
  background:rgba(255,255,255,.06) !important;
  backdrop-filter:blur(12px);
  -webkit-backdrop-filter:blur(12px);
  border:1px solid rgba(255,255,255,.1) !important;
  border-radius:16px !important;
  padding:18px 28px !important;
  transition:all .4s var(--ease) !important;
}
.glass-chip:hover {
  background:rgba(255,255,255,.1) !important;
  border-color:rgba(255,255,255,.2) !important;
  transform:translateY(-4px);
}

/* ═══════════════════════════════════════════════════════════
   GLOW BUTTON
   ═══════════════════════════════════════════════════════════ */
.btn-glow {
  box-shadow:0 0 20px rgba(255,26,46,.4), 0 5px 15px rgba(255,26,46,.3);
}
.btn-glow:hover {
  box-shadow:0 0 40px rgba(255,26,46,.5), 0 8px 25px rgba(255,26,46,.4);
}

/* ── Curseur custom ─────────────────────────────────────────── */
.custom-cursor {
  position:fixed; top:0; left:0;
  pointer-events:none; z-index:9999;
  opacity:0; transition:opacity .3s;
  mix-blend-mode:difference;
}
.custom-cursor.visible { opacity:1; }
.cursor-dot {
  position:absolute; top:-4px; left:-4px;
  width:8px; height:8px;
  background:var(--c-rouge); border-radius:50%;
  transition:transform .15s;
}
.cursor-ring {
  position:absolute; top:-20px; left:-20px;
  width:40px; height:40px;
  border:2px solid var(--c-creme); border-radius:50%;
  transition:transform .3s var(--ease), border-color .3s;
}
.custom-cursor.hover .cursor-ring { transform:scale(1.8); border-color:var(--c-rouge); }
.custom-cursor.hover .cursor-dot  { transform:scale(0); }
@media (max-width:900px) { .custom-cursor { display:none; } }

/* ── Scroll progress bar ────────────────────────────────────── */
.scroll-progress {
  position:fixed; top:0; left:0; height:3px; z-index:9998;
  background:linear-gradient(90deg, var(--c-rouge), var(--c-violet2), var(--c-or));
  transition:width .1s linear;
  box-shadow:0 0 20px rgba(230,57,70,.5), 0 0 6px rgba(230,57,70,.8);
  border-radius:0 2px 2px 0;
}

/* ── Compteur km flottant ───────────────────────────────────── */
.floating-km {
  position:fixed; bottom:30px; right:30px;
  background:rgba(22,9,43,.8); color:#fff;
  padding:14px 22px; border-radius:50px;
  display:flex; align-items:center; gap:10px;
  box-shadow:0 10px 30px rgba(45,30,66,.4);
  z-index:500; border:1px solid rgba(255,26,46,.3);
  opacity:0; transform:translateY(30px);
  transition:all .6s var(--ease);
  backdrop-filter:blur(16px);
  -webkit-backdrop-filter:blur(16px);
}
.journey-map-container {
  width: 100%;
  max-width: 480px;
  height: 560px;
  border-radius: 20px;
  box-shadow: 0 8px 30px rgba(45,30,66,.08), 0 20px 60px rgba(45,30,66,.15);
  overflow: hidden;
  margin-bottom: 20px;
  border:1px solid rgba(107,79,138,.08);
}

/* Assure-toi que la carte Leaflet prenne bien 100% du conteneur */
.journey-map-container .vue-leaflet-map {
  width: 100%;
  height: 100% !important;
}

/* ============================================================
   SECTION BUDGET — CAMEMBERT REFAIT
   ============================================================ */
.budget-section {
  background: linear-gradient(145deg, var(--c-dark) 0%, var(--c-violet) 60%, #1a0835 100%);
  padding: 120px 5%;
  position: relative;
  overflow: hidden;
}
.budget-section::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 20% 50%, rgba(255,26,46,.08) 0%, transparent 55%),
              radial-gradient(ellipse at 80% 30%, rgba(139,92,246,.1) 0%, transparent 50%);
  pointer-events: none;
}

.budget-inner {
  max-width: 1300px;
  margin: 0 auto;
  position: relative;
  z-index: 2;
}

.budget-header {
  margin-bottom: 70px;
  position: relative;
}
.budget-header::after {
  content: '';
  position: absolute;
  left: 0; bottom: -20px;
  height: 4px; width: 90px;
  background: var(--c-rouge);
}
.budget-header .section-tag {
  color:var(--c-or); background:rgba(245,166,35,.1);
  border-color:rgba(245,166,35,.2);
}
.budget-header h2 {
  font-family: var(--font-title);
  font-size: clamp(2rem, 5vw, 3.4rem);
  color: #fff;
  text-transform: uppercase;
  margin: 14px 0 16px;
}
.budget-header .section-desc { color: rgba(255,255,255,.6); max-width: 650px; }

/* Layout deux colonnes */
.budget-layout {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 70px;
  align-items: start;
}
@media (max-width: 960px) {
  .budget-layout { grid-template-columns: 1fr; }
}

/* ── Colonne gauche : donut ── */
.budget-left { display: flex; flex-direction: column; align-items: center; gap: 28px; }

.prog-zone { position: relative; }

.prog-svg {
  width: 320px; height: 320px;
  display: block;
  overflow: visible;
}
@media (max-width: 960px) { .prog-svg { width: 280px; height: 280px; } }

/* Arc de progression animé */
.prog-arc {
  transition: stroke-dashoffset 1.8s cubic-bezier(.25,1,.5,1);
}

/* Slices du camembert */
.budget-arc-slice {
  transition: opacity .25s ease, filter .25s ease, transform .3s var(--ease);
  transform-origin: 100px 100px;
  transform-box: fill-box;
  cursor: pointer;
}
.budget-arc-slice:hover,
.slice-active {
  filter: brightness(1.25) drop-shadow(0 0 10px rgba(255,255,255,.25));
  transform: scale(1.04);
}
.slice-dim { opacity: .35; }

/* Tooltip slice */
.slice-tooltip {
  position: absolute;
  bottom: -18px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255,255,255,.12);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,.2);
  color: #fff;
  padding: 8px 18px;
  border-radius: 30px;
  font-size: .82rem;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 8px;
}
.tip-dot {
  width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
}
.tip-sep { opacity: .4; }
.tip-amount { font-family: var(--font-title); font-size: .95rem; }
.tip-pct { opacity: .6; font-size: .76rem; }
.slice-tip-enter-active { transition: all .3s var(--ease); }
.slice-tip-leave-active { transition: all .2s ease; }
.slice-tip-enter-from, .slice-tip-leave-to { opacity: 0; transform: translateX(-50%) translateY(8px); }

/* Chiffres clés sous le donut */
.prog-stats {
  display: flex;
  align-items: center;
  gap: 0;
  background: rgba(255,255,255,.06);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 14px;
  padding: 18px 28px;
  width: 100%;
  max-width: 340px;
}
.ps-item {
  flex: 1;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ps-val {
  font-family: var(--font-title);
  font-size: 1.25rem;
  font-weight: 700;
  color: #fff;
  line-height: 1;
}
.ps-lab {
  font-size: .68rem;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: rgba(255,255,255,.45);
}
.ps-sep {
  width: 1px;
  height: 36px;
  background: rgba(255,255,255,.12);
  margin: 0 12px;
}

/* ── Colonne droite : détail barres ── */
.budget-right { padding-top: 10px; }

.breakdown-title {
  font-family: var(--font-title);
  font-size: 1.6rem;
  color: #fff;
  text-transform: uppercase;
  margin-bottom: 8px;
}
.breakdown-hint {
  font-size: .83rem;
  color: rgba(255,255,255,.4);
  margin-bottom: 36px;
}

.breakdown-list { display: flex; flex-direction: column; gap: 22px; }

.breakdown-row {
  cursor: pointer;
  transition: opacity .25s;
  padding: 4px 0;
}
.row-active .row-text { color: #fff; }
.row-dim { opacity: .35; }

.row-label {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.row-dot {
  width: 11px; height: 11px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 8px rgba(255,255,255,.2);
}
.row-text {
  font-size: .9rem;
  color: rgba(255,255,255,.75);
  transition: color .2s;
  flex: 1;
}
.row-bar-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}
.row-bar-track {
  flex: 1;
  height: 7px;
  background: rgba(255,255,255,.08);
  border-radius: 4px;
  overflow: hidden;
}
.row-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width .6s var(--ease), filter .25s;
}
.row-active .row-bar-fill {
  filter: brightness(1.3) drop-shadow(0 0 6px currentColor);
}
.row-pct {
  font-family: var(--font-title);
  font-size: .85rem;
  color: rgba(255,255,255,.55);
  min-width: 38px;
  text-align: right;
}
.row-amount {
  display: block;
  margin-top: 5px;
  font-family: var(--font-title);
  font-size: 1.05rem;
  color: rgba(255,255,255,.5);
  padding-left: 21px;
}
.row-active .row-amount { color: #fff; }

.breakdown-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 32px;
  padding-top: 20px;
  border-top: 1px solid rgba(255,255,255,.12);
  color: rgba(255,255,255,.6);
  font-size: .88rem;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.breakdown-total strong {
  font-family: var(--font-title);
  font-size: 1.4rem;
  color: #fff;
}

.floating-km.visible { opacity:1; transform:translateY(0); }
.km-icon { color:var(--c-rouge); animation:spin 10s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }
.km-content { display:flex; flex-direction:column; line-height:1; }
.km-value { font-family:var(--font-title); font-size:1.35rem; font-weight:700; }
.km-label { font-size:.7rem; text-transform:uppercase; letter-spacing:1px; opacity:.7; }

/* ── Intro cinématographique ─────────────────────────────────── */
.app-container { overflow:hidden; height:100vh; }
.app-container.app-loaded { height:auto; overflow:visible; }

.intro-sequencer {
  position:fixed; inset:0; z-index:1000;
  display:flex; align-items:center; justify-content:center;
  pointer-events:none;
  transition:transform 1.2s var(--ease), visibility 1.2s;
}
.app-loaded .intro-sequencer { transform:translateY(-100%); visibility:hidden; }
.intro-bg {
  position:absolute; inset:0;
  background:radial-gradient(circle at center, var(--c-violet), var(--c-dark));
  opacity:.95;
}
.intro-logo {
  font-family:var(--font-title); font-size:clamp(3rem,10vw,8rem);
  text-transform:uppercase; letter-spacing:10px;
  position:relative; z-index:2;
  display:flex; flex-direction:column; align-items:center;
}
.word-1, .word-2 { opacity:0; transform:translateY(30px); }
.word-1 { animation:wordIn .8s var(--ease) forwards .3s; color:var(--c-creme); }
.word-2 { animation:wordIn .8s var(--ease) forwards .6s; color:var(--c-rouge); margin-top:-10px; }
@keyframes wordIn { to { opacity:1; transform:translateY(0); } }
.intro-particules {
  position:absolute; inset:0;
  background-image:radial-gradient(white 1px, transparent 1px);
  background-size:50px 50px; opacity:0;
  animation:particleFlash 1s ease-out forwards 1s;
}
@keyframes particleFlash {
  50% { opacity:.3; transform:scale(1.1); }
  100% { opacity:0; transform:scale(1.2); }
}
.intro-line {
  position:absolute; bottom:30%; left:0;
  height:2px; width:0;
  background:var(--c-rouge);
  animation:lineExpand 1.2s var(--ease) forwards .8s;
  box-shadow:0 0 20px var(--c-rouge);
}
@keyframes lineExpand { to { width:100%; } }

.main-content { opacity:0; transition:opacity 1s ease 1s; }
.app-loaded .main-content { opacity:1; }

/* ── Boutons ─────────────────────────────────────────────────── */
.btn {
  font-family:var(--font-title); font-weight:500;
  text-transform:uppercase; letter-spacing:1.5px;
  padding:16px 36px; border-radius:12px; border:none;
  cursor:pointer; font-size:.95rem;
  transition:all .4s var(--ease);
  text-decoration:none;
  display:inline-flex; align-items:center; justify-content:center; gap:12px;
  position:relative; overflow:hidden;
}
@media (max-width:900px) { .btn { cursor:pointer; } }
.btn::before {
  content:''; position:absolute;
  top:50%; left:50%; width:0; height:0;
  background:rgba(255,255,255,.18); border-radius:50%;
  transform:translate(-50%,-50%);
  transition:width .6s, height .6s;
}
.btn:hover::before { width:400px; height:400px; }
.btn > * { position:relative; z-index:2; }
.btn i { transition:transform .4s var(--ease); }
.btn:hover i { transform:translateX(5px); }

.btn-primary  { background:var(--c-rouge); color:#fff; box-shadow:0 5px 15px rgba(230,57,70,.3); }
.btn-primary:hover { background:var(--c-rouge2); box-shadow:0 8px 25px rgba(230,57,70,.5); }
.btn-outline  { background:transparent; color:var(--c-creme); border:2px solid var(--c-rouge); }
.btn-outline:hover  { background:var(--c-rouge); color:#fff; }
.btn-outline-white  { background:transparent; color:#fff; border:2px solid #fff; }
.btn-outline-white:hover { background:#fff; color:var(--c-violet); }
.btn-white    { background:#fff; color:var(--c-violet); font-weight:700; }
.btn-white:hover { background:var(--c-creme); transform:scale(1.05); }
.btn-pack {
  background:var(--c-violet); color:#fff;
  width:100%; margin-top:25px;
  transition:background .3s;
}
.btn-pack:hover { background:var(--c-rouge); }
.btn-lg   { padding:20px 45px; font-size:1.1rem; }
.btn-full { width:100%; margin-top:20px; }
.pulse-red-anim { animation:pulseRed 2.5s infinite; }
@keyframes pulseRed {
  0%  { box-shadow:0 0 0 0   rgba(230,57,70,.8); }
  70% { box-shadow:0 0 0 22px rgba(230,57,70,0); }
  100%{ box-shadow:0 0 0 0   rgba(230,57,70,0); }
}
.magnetic { transition:transform .2s linear; }
.magnetic:hover { transform:translate(calc(var(--mx,0)*14px), calc(var(--my,0)*14px)); }

/* ── HERO ────────────────────────────────────────────────────── */
.hero {
  min-height:100vh; position:relative;
  display:flex; align-items:center; justify-content:center;
  text-align:center;
  background-color:var(--c-dark);
  overflow:hidden; padding:120px 20px 140px;
}
.hero-bg-layer {
  position:absolute; inset:-20%; z-index:0;
  background-image:url('https://images.unsplash.com/photo-1509316785289-025f5b846b35?q=80&w=2000&auto=format&fit=crop');
  background-size:cover; background-position:center;
  will-change:transform;
}
.hero::before {
  content:''; position:absolute; inset:0; z-index:1;
  background:linear-gradient(135deg, rgba(8,3,15,.92), rgba(22,9,43,.85) 50%, rgba(45,30,66,.78));
}
.hero-grain {
  position:absolute; inset:0; z-index:2;
  opacity:.035; pointer-events:none;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  background-repeat:repeat; background-size:128px;
}
.hero-glow {
  position:absolute; border-radius:50%;
  filter:blur(100px); opacity:.25; z-index:1;
  animation:glowFloat 8s ease-in-out infinite;
}
.hero-glow-1 {
  width:500px; height:500px; top:10%; left:10%;
  background:var(--c-rouge);
}
.hero-glow-2 {
  width:400px; height:400px; bottom:20%; right:15%;
  background:var(--c-violet2);
  animation-delay:-4s;
}
@keyframes glowFloat {
  0%,100% { transform:translate(0,0) scale(1); }
  50%     { transform:translate(30px,-20px) scale(1.1); }
}
.hero-perspective-lines {
  position:absolute; inset:0; z-index:2;
  background:
      linear-gradient(45deg,  rgba(230,57,70,.06) 1px, transparent 1px),
      linear-gradient(-45deg, rgba(107,79,138,.06) 1px, transparent 1px);
  background-size:60px 60px;
  mask-image:radial-gradient(ellipse at center, black 20%, transparent 70%);
  animation:gridMove 30s linear infinite;
}
@keyframes gridMove { to { background-position:60px 60px, -60px 60px; } }
.hero-wave {
  position:absolute; bottom:0; left:0; right:0; z-index:10;
  line-height:0;
}
.hero-wave svg { width:100%; height:80px; display:block; }
.hero-particles { position:absolute; inset:0; pointer-events:none; }
.particle {
  position:absolute; width:3px; height:3px;
  background:var(--c-creme); border-radius:50%; opacity:0;
  animation:floatUp 10s linear infinite;
  box-shadow:0 0 6px rgba(250,243,221,.8);
}
@keyframes floatUp {
  0%  { opacity:0; transform:translateY(100px) scale(0); }
  20% { opacity:1; transform:translateY(0) scale(1); }
  80% { opacity:1; }
  100%{ opacity:0; transform:translateY(-200px) scale(.5); }
}
.hero-content {
  position:relative; z-index:10;
  max-width:950px; padding:0 20px;
}
.title-word {
  display:inline-block;
  background-size:200% 200%;
  animation:shimmerText 4s ease-in-out infinite;
}
.title-word-1 {
  background:linear-gradient(135deg, #fff, var(--c-creme), #fff);
  -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;
}
.title-word-2 {
  background:linear-gradient(135deg, var(--c-rouge), var(--c-rouge2), var(--c-or));
  background-size:200% 200%;
  -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;
  animation:shimmerText 3s ease-in-out infinite;
}
@keyframes shimmerText {
  0%,100% { background-position:0% 50%; }
  50%     { background-position:100% 50%; }
}
.hero-pretitle {
  font-family:var(--font-title); color:var(--c-rouge);
  text-transform:uppercase; letter-spacing:3px; font-size:1rem;
  margin-bottom:15px;
  display:flex; align-items:center; justify-content:center; gap:15px;
}
.pretitle-line { display:inline-block; width:50px; height:2px; background:var(--c-rouge); }
.hero-title {
  font-family:var(--font-title);
  font-size:clamp(2.5rem,7vw,5.5rem);
  color:#fff; text-transform:uppercase;
  letter-spacing:2px; line-height:1.1;
  margin-bottom:25px;
  text-shadow:0 4px 30px rgba(0,0,0,.5);
}
.hero-arrow {
  color:var(--c-rouge); font-size:.7em; vertical-align:middle; margin:0 10px;
  animation:arrowPulse 2s ease-in-out infinite;
}
@keyframes arrowPulse {
  0%,100% { transform:translateX(0); }
  50%     { transform:translateX(14px); }
}
.hero-subtitle {
  font-size:clamp(1rem,2vw,1.3rem); color:var(--c-creme);
  font-weight:300; margin-bottom:40px;
  max-width:750px; margin-left:auto; margin-right:auto;
}
.hero-subtitle strong { color:#fff; font-weight:600; }
.hero-mini-stats {
  display:flex; gap:20px; justify-content:center;
  margin-bottom:45px; flex-wrap:wrap;
}
.mini-stat { text-align:center; color:#fff; position:relative; padding:0 20px; }
.mini-stat:not(:last-child)::after {
  content:none;
}
.mini-stat strong {
  display:block; font-family:var(--font-title);
  font-size:2.2rem; color:var(--c-rouge); line-height:1;
}
.mini-stat span { font-size:.75rem; text-transform:uppercase; letter-spacing:2px; opacity:.8; }
.hero-buttons { display:flex; gap:25px; justify-content:center; flex-wrap:wrap; }
.scroll-indicator {
  position:absolute; bottom:40px; left:50%; transform:translateX(-50%);
  cursor:pointer; z-index:10; opacity:.7; transition:opacity .3s;
  text-align:center; color:#fff;
}
.scroll-indicator:hover { opacity:1; }
.scroll-indicator span {
  display:block; font-family:var(--font-title);
  font-size:.7rem; letter-spacing:3px; margin-bottom:10px;
}
.mouse {
  width:28px; height:45px; border:2px solid #fff;
  border-radius:20px; display:flex; justify-content:center;
  padding-top:8px; margin:0 auto;
}
.wheel {
  width:4px; height:8px; background:var(--c-rouge);
  border-radius:3px; animation:scrollWheel 1.5s infinite;
}
@keyframes scrollWheel {
  0%  { opacity:1; transform:translateY(0); }
  100%{ opacity:0; transform:translateY(15px); }
}

/* ── STATS ───────────────────────────────────────────────────── */
.stats-section {
  padding:100px 5%;
  background:linear-gradient(135deg, var(--c-violet), var(--c-dark));
  color:#fff; position:relative; overflow:hidden;
}
.stats-bg-pattern {
  position:absolute; inset:0;
  background-image:
      radial-gradient(circle at 20% 50%, rgba(230,57,70,.15) 0%, transparent 40%),
      radial-gradient(circle at 80% 80%, rgba(107,79,138,.2) 0%, transparent 50%);
  animation:bgShift 15s ease-in-out infinite;
}
@keyframes bgShift {
  0%,100% { transform:scale(1); }
  50%     { transform:scale(1.08); }
}
.stats-container {
  max-width:1300px; margin:0 auto; position:relative; z-index:2;
  display:grid; grid-template-columns:repeat(auto-fit, minmax(180px,1fr)); gap:25px;
}
.stat-block {
  text-align:center; padding:34px 20px;
  border:1px solid rgba(255,255,255,.08); border-radius:16px;
  background:rgba(255,255,255,.04); backdrop-filter:blur(16px);
  -webkit-backdrop-filter:blur(16px);
  transition:all .5s var(--ease); position:relative; overflow:hidden;
}
.stat-block::before {
  content:''; position:absolute; top:0; left:-100%;
  width:100%; height:2px;
  background:linear-gradient(90deg, transparent, var(--c-rouge), var(--c-violet2), transparent);
  transition:left .8s var(--ease);
}
.stat-block:hover {
  transform:translateY(-8px);
  border-color:rgba(255,26,46,.3);
  background:rgba(255,255,255,.07);
  box-shadow:0 20px 40px rgba(0,0,0,.15);
}
.stat-block:hover::before { left:100%; }
.stat-block.highlight-stat { background:rgba(230,57,70,.1); border-color:var(--c-rouge); }
.stat-icon { font-size:2rem; color:var(--c-rouge); margin-bottom:14px; }
.stat-number {
  font-family:var(--font-title); font-size:clamp(2.2rem,4vw,3.2rem);
  font-weight:700; line-height:1; margin-bottom:10px;
  background:linear-gradient(135deg,#fff,var(--c-creme));
  -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;
  display:inline-flex; align-items:baseline;
}
.stat-unit { font-size:.5em; color:var(--c-rouge); -webkit-text-fill-color:var(--c-rouge); margin-left:4px; }
.stat-label { font-size:.8rem; text-transform:uppercase; letter-spacing:2px; color:var(--c-creme); opacity:.8; }

/* ── SECTION COMMUNE ─────────────────────────────────────────── */
.section-header { margin-bottom:70px; position:relative; }
.section-header.centered { text-align:center; }
.section-header.centered::after { left:50%; transform:translateX(-50%); }
.section-header::after {
  content:''; position:absolute; left:0; bottom:-20px;
  height:4px; width:90px; background:var(--c-rouge);
}
.section-tag {
  display:inline-block; font-family:var(--font-title); color:var(--c-rouge);
  background:rgba(255,26,46,.08); padding:6px 18px;
  text-transform:uppercase; letter-spacing:3px;
  font-size:.75rem; margin-bottom:14px; border-radius:50px;
  border:1px solid rgba(255,26,46,.15);
  backdrop-filter:blur(4px);
}
.section-header h2 {
  font-family:var(--font-title);
  font-size:clamp(2rem,5vw,3.6rem);
  color:var(--c-violet); line-height:1.1;
  margin-bottom:18px; text-transform:uppercase;
}
.highlight-red {
  color:var(--c-rouge); position:relative; display:inline-block;
}
.highlight-red::after {
  content:''; position:absolute; bottom:4px; left:-4px;
  width:calc(100% + 8px); height:8px;
  background:linear-gradient(90deg, rgba(230,57,70,.15), rgba(230,57,70,.08));
  z-index:-1; border-radius:4px;
}
.section-desc { font-size:1.1rem; color:#444; max-width:750px; }
.section-header.centered .section-desc { margin:0 auto; }

/* ── MISSION CARDS ───────────────────────────────────────────── */
.mission-section { padding:120px 5%; max-width:1300px; margin:0 auto; }
.cards-container {
  display:grid;
  grid-template-columns:repeat(auto-fit, minmax(300px,1fr));
  gap:40px;
}
.card {
  background:#fff; padding:48px 32px; border-radius:16px;
  box-shadow:0 4px 20px rgba(45,30,66,.04), 0 12px 40px rgba(45,30,66,.06);
  transition:all .5s var(--ease);
  position:relative; overflow:hidden;
  border:1px solid rgba(107,79,138,.08);
  transform-style:preserve-3d;
}
.card::before {
  content:''; position:absolute; top:0; left:0; width:100%; height:4px;
  background:linear-gradient(90deg, var(--c-rouge), var(--c-violet2), var(--c-or));
  background-size:200% 100%;
  transform:scaleX(0); transform-origin:left;
  transition:transform .5s var(--ease);
  animation:gradSlide 3s linear infinite paused;
}
.card:hover::before { transform:scaleX(1); animation-play-state:running; }
@keyframes gradSlide {
  to { background-position:-200% 0; }
}
.card:hover {
  box-shadow:0 8px 30px rgba(45,30,66,.08), 0 25px 60px rgba(45,30,66,.1);
}
.card-visual {
  position:relative; width:78px; height:78px;
  margin-bottom:28px;
  display:flex; align-items:center; justify-content:center;
}
.card-icon {
  font-size:3rem; color:var(--c-violet); position:relative; z-index:2;
  transition:all .4s;
}
.card:hover .card-icon { color:var(--c-rouge); transform:scale(1.15); }
.card-shape {
  position:absolute; inset:0; border-radius:14px;
  background:var(--c-creme); transform:rotate(-10deg);
  transition:transform .5s var(--ease); z-index:1;
}
.card:hover .card-shape { transform:rotate(5deg) scale(1.15); }
.shape-red    { background:rgba(230,57,70,.1); }
.shape-violet { background:rgba(107,79,138,.1); }
.card h3 {
  font-family:var(--font-title); font-size:1.75rem;
  margin-bottom:14px; color:var(--c-violet); text-transform:uppercase;
}
.card p { color:#555; font-size:1rem; margin-bottom:22px; }
.card-stat { padding-top:18px; border-top:1px solid rgba(107,79,138,.15); }
.card-stat strong {
  display:block; font-family:var(--font-title);
  font-size:1.75rem; color:var(--c-rouge); line-height:1;
}
.card-stat span { font-size:.78rem; color:#777; text-transform:uppercase; letter-spacing:1px; }

/* ── ÉQUIPE ──────────────────────────────────────────────────── */
.team-section { padding:120px 5%; max-width:1300px; margin:0 auto; background:#fff; }
.team-container {
  display:grid;
  grid-template-columns:repeat(auto-fit, minmax(300px,1fr));
  gap:50px; max-width:900px; margin:0 auto;
}
.team-card {
  background:var(--c-creme); border-radius:20px; overflow:hidden;
  transition:all .6s var(--ease); border:1px solid rgba(107,79,138,.06);
  box-shadow:0 4px 20px rgba(45,30,66,.04);
}
.team-card:hover {
  transform:translateY(-14px); border-color:var(--c-rouge);
  box-shadow:0 12px 30px rgba(45,30,66,.08), 0 25px 55px rgba(45,30,66,.14);
}
.team-photo-wrapper {
  position:relative; height:270px;
  background:linear-gradient(135deg, var(--c-violet), var(--c-violet2));
  display:flex; align-items:center; justify-content:center; overflow:hidden;
}
.team-photo-wrapper::before {
  content:''; position:absolute; inset:0;
  background:radial-gradient(circle at center, transparent 40%, rgba(0,0,0,.3));
}
.team-photo-placeholder {
  font-size:7.5rem; color:var(--c-creme); opacity:.25;
  transition:all .5s;
}
.team-card:hover .team-photo-placeholder { transform:scale(1.1); opacity:.45; }
.team-role {
  position:absolute; bottom:14px; left:14px;
  background:var(--c-rouge); color:#fff;
  padding:5px 14px; font-family:var(--font-title);
  font-size:.72rem; letter-spacing:2px; border-radius:3px;
}
.team-info { padding:32px 28px; }
.team-info h3 {
  font-family:var(--font-title); font-size:2rem;
  color:var(--c-violet); text-transform:uppercase; margin-bottom:14px;
}
.team-quote {
  font-style:italic; color:#666; font-size:.93rem;
  margin-bottom:18px; padding-left:14px;
  border-left:3px solid var(--c-rouge);
}
.team-skills { list-style:none; }
.team-skills li {
  padding:7px 0; color:#444; font-size:.93rem;
  display:flex; align-items:center; gap:10px;
}
.team-skills i { color:var(--c-rouge); font-size:.82rem; }

/* ════════════════════════════════════════════════════════════
   CARTE INTERACTIVE AU SCROLL
   ════════════════════════════════════════════════════════════ */
.route-section {
  padding:120px 5%;
  max-width:1400px; margin:0 auto;
}

.route-layout {
  display:grid;
  grid-template-columns:1fr 420px;
  gap:60px;
  align-items:start;
  margin-top:60px;
}
@media (max-width:1100px) { .route-layout { grid-template-columns:1fr; } }

/* ── Liste des étapes ── */
.route-steps-list { display:flex; flex-direction:column; gap:0; }

.route-step {
  display:flex; gap:20px; align-items:flex-start;
  padding:26px 30px; border-radius:16px;
  background:#fff; margin-bottom:14px;
  box-shadow:0 2px 10px rgba(45,30,66,.03), 0 4px 18px rgba(45,30,66,.05);
  border-left:4px solid transparent;
  cursor:pointer;
  border:1px solid rgba(107,79,138,.05);
  border-left:4px solid transparent;
  transition:
      border-left-color .35s ease,
      box-shadow .35s ease,
      transform .35s ease,
      background .35s ease;
}
.route-step:hover,
.route-step.step-active {
  border-left-color:var(--c-rouge);
  box-shadow:0 8px 24px rgba(230,57,70,.08), 0 16px 40px rgba(230,57,70,.12);
  transform:translateX(8px);
  background:rgba(255,26,46,.02);
}

.step-number {
  font-family:var(--font-title); font-size:1.8rem; font-weight:700;
  color:rgba(45,30,66,.18); line-height:1; min-width:38px;
  transition:color .35s;
}
.route-step.step-active .step-number { color:var(--c-rouge); }

.step-content { flex:1; }
.step-meta { display:flex; gap:14px; margin-bottom:6px; flex-wrap:wrap; }
.step-distance {
  display:inline-block; background:var(--c-violet); color:#fff;
  padding:4px 12px; font-family:var(--font-title);
  font-size:.72rem; letter-spacing:1px; border-radius:8px;
}
.step-date { font-size:.78rem; color:#888; display:flex; align-items:center; }
.step-content h4 {
  font-family:var(--font-title); font-size:1.45rem;
  color:var(--c-violet); text-transform:uppercase; margin-bottom:4px;
}
.step-country { font-size:.83rem; color:var(--c-rouge); margin-bottom:6px; font-weight:600; display:flex; align-items:center; gap: 4px; }
.step-content p { color:#555; font-size:.92rem; }

/* ── Carte SVG sticky ── */
.route-map-sticky {
  position:sticky; top:14vh;
  height:fit-content;
}

.map-label {
  font-family:var(--font-title); font-size:.8rem;
  text-transform:uppercase; letter-spacing:2px;
  color:var(--c-violet); opacity:.6;
  margin-bottom:12px; display:flex; align-items:center; gap:8px;
}

.journey-map-svg {
  width:100%; max-width:480px; height:auto;
  border-radius:16px;
  box-shadow:0 20px 60px rgba(45,30,66,.18);
  display:block;
}

/* Textes SVG */
.map-country-label {
  font-family:Oswald, sans-serif; font-size:12px;
  fill:#2D1E42; opacity:.45; text-anchor:middle;
  text-transform:uppercase; letter-spacing:2px;
  pointer-events:none;
}
.map-strait-label {
  font-family:Montserrat, sans-serif; font-size:8px;
  fill:#2D1E42; opacity:.5; text-anchor:middle;
  pointer-events:none;
}
.map-city-label {
  font-family:Oswald, sans-serif; font-size:10px;
  fill:#888; letter-spacing:.5px;
  transition:fill .4s ease; pointer-events:none;
}
.map-city-active { fill:#2D1E42; font-weight:700; }

/* Animation ping waypoint actif */
.wp-ping { animation:wpPing 1.6s ease-out infinite; }
@keyframes wpPing {
  0%  { transform:scale(1); opacity:.8; }
  100%{ transform:scale(2.6); opacity:0; }
}

/* Badge étape active */
.map-active-badge {
  margin-top:14px;
  background:var(--c-violet); color:#fff;
  padding:16px 22px; border-radius:14px;
  display:flex; align-items:center; gap:14px;
  box-shadow:0 8px 24px rgba(45,30,66,.25);
  border:1px solid rgba(139,92,246,.15);
  backdrop-filter:blur(8px);
}
.badge-icon { font-size:1.4rem; color:var(--c-rouge); }
.badge-city { font-family:var(--font-title); font-size:1.1rem; text-transform:uppercase; line-height:1; }
.badge-km   { font-size:.75rem; opacity:.7; margin-top:3px; }

/* Transition du badge */
.step-badge-enter-active { transition:all .4s var(--ease); }
.step-badge-leave-active { transition:all .25s ease; }
.step-badge-enter-from { opacity:0; transform:translateY(12px); }
.step-badge-leave-to  { opacity:0; transform:translateY(-8px); }

/* ── POURQUOI NOUS ───────────────────────────────────────────── */
.why-section {
  padding:120px 5%; background:var(--c-creme);
  position:relative; overflow:hidden;
}
.why-bg-shape {
  position:absolute; top:-200px; right:-200px;
  width:600px; height:600px; border-radius:50%;
  background:radial-gradient(circle, rgba(230,57,70,.07) 0%, transparent 70%);
  animation:bgFloat 20s ease-in-out infinite;
}
@keyframes bgFloat {
  0%,100% { transform:translate(0,0); }
  50%     { transform:translate(-50px,50px); }
}
.why-grid {
  max-width:1200px; margin:0 auto;
  display:grid; grid-template-columns:repeat(auto-fit, minmax(270px,1fr));
  gap:28px; position:relative; z-index:2;
}
.why-card {
  background:#fff; padding:38px 28px; border-radius:16px;
  transition:all .5s var(--ease);
  box-shadow:0 2px 12px rgba(45,30,66,.04), 0 8px 28px rgba(45,30,66,.06);
  position:relative; overflow:hidden; transform-style:preserve-3d;
  border:1px solid rgba(107,79,138,.06);
}
.why-card::after {
  content:''; position:absolute; bottom:0; left:0;
  width:0; height:3px;
  background:linear-gradient(90deg, var(--c-rouge), var(--c-violet2));
  transition:width .5s var(--ease);
}
.why-card:hover::after { width:100%; }
.why-card:hover {
  box-shadow:0 8px 24px rgba(45,30,66,.06), 0 24px 55px rgba(45,30,66,.1);
}
.why-icon-wrapper {
  width:62px; height:62px;
  background:linear-gradient(135deg, var(--c-rouge), var(--c-violet2));
  border-radius:16px; display:flex; align-items:center; justify-content:center;
  margin-bottom:18px;
  box-shadow:0 4px 12px rgba(230,57,70,.15), 0 7px 18px rgba(230,57,70,.22);
  transition:all .5s var(--ease);
}
.why-card:hover .why-icon-wrapper { transform:rotate(-8deg) scale(1.08); box-shadow:0 8px 24px rgba(230,57,70,.3); }
.why-icon-wrapper i { font-size:1.7rem; color:#fff; }
.why-card h4 {
  font-family:var(--font-title); font-size:1.25rem;
  color:var(--c-violet); text-transform:uppercase; margin-bottom:10px;
}
.why-card p { color:#555; font-size:.93rem; line-height:1.7; }

/* ════════════════════════════════════════════════════════════
   PACKS SPONSORING
   ════════════════════════════════════════════════════════════ */
.packs-section {
  padding:120px 5%;
  max-width:1400px; margin:0 auto;
}

/* Visualiseur 4L */
.sponsorship-visualizer {
  margin-bottom:70px; text-align:center;
}
.visualizer-title {
  font-family:var(--font-title); font-size:2rem;
  color:var(--c-violet); text-transform:uppercase; margin-bottom:10px;
}
.visualizer-subtitle { color:#666; font-size:1rem; margin-bottom:30px; }
/* Onglets de vue 4L */
.car-view-tabs {
  display:flex; gap:10px; justify-content:center; margin-bottom:20px;
}
.car-tab {
  font-family:var(--font-title); text-transform:uppercase;
  font-size:.78rem; letter-spacing:1px;
  padding:10px 22px; border-radius:10px; border:1px solid rgba(107,79,138,.15);
  background:transparent; color:var(--c-violet); cursor:pointer;
  transition:all .3s var(--ease); display:flex; align-items:center; gap:8px;
}
.car-tab:hover { border-color:var(--c-rouge); color:var(--c-rouge); }
.car-tab.active {
  background:var(--c-violet); color:#fff;
  border-color:var(--c-violet);
  box-shadow:0 4px 12px rgba(22,9,43,.25);
}

.car-interactive-container {
  max-width:780px; margin:0 auto;
  background:rgba(45,30,66,.03);
  border-radius:20px; padding:30px 20px;
  border:1px solid rgba(107,79,138,.08);
  min-height:260px;
  display:flex; align-items:center; justify-content:center;
  transition:border-color .3s ease;
}
.car-interactive-container:hover {
  border-color:rgba(107,79,138,.18);
}
.car-interactive-svg { width:100%; height:auto; display:block; }

/* Zones de couleur — UNIQUEMENT CSS, pas d'attribut opacity SVG */
.car-zone {
  opacity: 0.15;
  transition: opacity .4s ease, filter .4s ease;
}
.zone-active {
  opacity: 0.58;
  filter: drop-shadow(0 0 10px rgba(0,0,0,.25));
}

/* Grille packs */
.packs-grid {
  display:grid;
  grid-template-columns:repeat(auto-fit, minmax(255px,1fr));
  gap:28px;
}
.pack-card {
  background:#fff; padding:42px 28px; border-radius:20px;
  box-shadow:0 4px 16px rgba(45,30,66,.04), 0 12px 35px rgba(45,30,66,.07);
  transition:all .5s var(--ease);
  position:relative; border:1px solid rgba(107,79,138,.06);
  display:flex; flex-direction:column;
}
.pack-card::before {
  content:''; position:absolute; top:0; left:0;
  width:100%; height:5px;
  background:linear-gradient(90deg, var(--pack-color), var(--pack-color));
  border-radius:20px 20px 0 0;
  transition:height .4s var(--ease);
}
.pack-card:hover::before { height:6px; }
.pack-card:hover {
  transform:translateY(-14px);
  border-color:var(--pack-color);
  box-shadow:0 12px 30px rgba(45,30,66,.08), 0 28px 55px rgba(45,30,66,.14);
}
.pack-highlight {
  transform:scale(1.04);
  border-color:var(--c-rouge);
  box-shadow:0 22px 48px rgba(230,57,70,.18);
}
.pack-highlight:hover { transform:scale(1.04) translateY(-14px); }
.pack-hovered { transform:translateY(-10px); }

.pack-badge {
  position:absolute; top:-16px; left:50%; transform:translateX(-50%);
  background:linear-gradient(135deg, var(--c-rouge), var(--c-rouge2)); color:#fff;
  padding:7px 20px; font-family:var(--font-title);
  font-size:.75rem; letter-spacing:2px; border-radius:20px;
  box-shadow:0 4px 12px rgba(230,57,70,.3), 0 8px 20px rgba(230,57,70,.2);
  animation:badgeFloat 3s ease-in-out infinite;
  white-space:nowrap;
}
@keyframes badgeFloat {
  0%,100% { transform:translateX(-50%) translateY(0); }
  50%     { transform:translateX(-50%) translateY(-5px); }
}
.pack-header {
  text-align:center; margin-bottom:28px; padding-bottom:22px;
  border-bottom:1px solid rgba(107,79,138,.15);
}
.pack-icon {
  width:58px; height:58px;
  background:var(--pack-color); border-radius:50%;
  display:inline-flex; align-items:center; justify-content:center;
  margin-bottom:13px; box-shadow:0 5px 14px rgba(0,0,0,.12);
}
.pack-icon i { font-size:1.7rem; color:#fff; }
.pack-header h3 {
  font-family:var(--font-title); font-size:1.5rem;
  color:var(--c-violet); text-transform:uppercase; margin-bottom:12px;
}
.pack-price {
  font-family:var(--font-title); font-size:2.4rem;
  color:var(--c-rouge); font-weight:700; line-height:1; margin-bottom:7px;
}
.pack-tax { font-size:.75rem; color:#888; }
.pack-tax strong { color:var(--c-violet); }
.pack-features { list-style:none; flex-grow:1; margin-bottom:18px; }
.pack-features li {
  padding:9px 0; color:#555; font-size:.9rem;
  display:flex; align-items:flex-start; gap:9px;
  border-bottom:1px dashed rgba(107,79,138,.1);
}
.pack-features li:last-child { border-bottom:none; }
.pack-features i { color:var(--c-rouge); font-size:.82rem; margin-top:4px; flex-shrink:0; }
.packs-note {
  text-align:center; margin-top:44px;
  font-size:.88rem; color:#777; font-style:italic;
  max-width:700px; margin-left:auto; margin-right:auto;
}

/* ── TIMELINE ────────────────────────────────────────────────── */
.timeline-section {
  padding:120px 5%; background:#fff;
  max-width:1400px; margin:0 auto;
}
.timeline-wrapper {
  position:relative; max-width:1000px; margin:55px auto 0; padding:20px 0;
}
.timeline-line {
  position:absolute; left:50%; top:0; bottom:0; width:3px;
  background:linear-gradient(180deg, var(--c-rouge), var(--c-violet2));
  transform:translateX(-50%);
}
.timeline-item {
  position:relative; width:50%;
  padding:20px 50px 20px 0; margin-bottom:18px;
}
.timeline-item.timeline-right { margin-left:50%; padding:20px 0 20px 50px; }
.timeline-icon {
  position:absolute; right:-28px; top:28px;
  width:56px; height:56px;
  background:linear-gradient(135deg, var(--c-rouge), var(--c-rouge2)); border:4px solid #fff;
  border-radius:50%; display:flex; align-items:center; justify-content:center;
  color:#fff; font-size:1.2rem;
  box-shadow:0 4px 12px rgba(230,57,70,.2), 0 7px 18px rgba(230,57,70,.3); z-index:2;
  transition:all .5s var(--ease);
}
.timeline-item.timeline-right .timeline-icon { right:auto; left:-28px; }
.timeline-item:hover .timeline-icon { transform:scale(1.12) rotate(360deg); }
.timeline-card {
  background:#fff; padding:28px 30px; border-radius:16px;
  box-shadow:0 4px 16px rgba(45,30,66,.04), 0 8px 28px rgba(45,30,66,.06);
  transition:all .5s var(--ease);
  border:1px solid rgba(107,79,138,.05);
}
.timeline-item:hover .timeline-card {
  box-shadow:0 8px 24px rgba(45,30,66,.08), 0 20px 45px rgba(45,30,66,.12);
  transform:translateY(-4px);
  border-color:rgba(230,57,70,.15);
}
.timeline-date {
  display:inline-block; font-family:var(--font-title);
  color:var(--c-rouge); font-size:.82rem; letter-spacing:2px;
  margin-bottom:9px; text-transform:uppercase;
}
.timeline-card h4 {
  font-family:var(--font-title); font-size:1.25rem;
  color:var(--c-violet); text-transform:uppercase; margin-bottom:7px;
}
.timeline-card p { color:#555; font-size:.9rem; }

/* ════════════════════════════════════════════════════════════
   FAQ — corrigée
   ════════════════════════════════════════════════════════════ */
.faq-section {
  padding:120px 5%;
  max-width:900px; margin:0 auto;
}

.faq-container { margin-top:55px; }

.faq-item {
  background:#fff; margin-bottom:14px; border-radius:16px;
  overflow:hidden; cursor:pointer;
  border-left:4px solid transparent;
  box-shadow:0 2px 8px rgba(45,30,66,.03), 0 4px 16px rgba(45,30,66,.05);
  transition:
      border-left-color .3s ease,
      box-shadow .3s ease,
      border-radius .3s ease,
      opacity 1.1s cubic-bezier(.16,1,.3,1),
      transform 1.1s cubic-bezier(.16,1,.3,1),
      filter 1.1s cubic-bezier(.16,1,.3,1),
      visibility 1.1s;
  border:1px solid rgba(107,79,138,.05);
  border-left:4px solid transparent;
}
.faq-item:hover {
  border-left-color:rgba(230,57,70,.4);
  box-shadow:0 7px 22px rgba(45,30,66,.1);
}
.faq-item.faq-open {
  border-left-color:var(--c-rouge);
  box-shadow:0 10px 32px rgba(45,30,66,.12);
}

.faq-question {
  padding:22px 26px; cursor:pointer;
  display:flex; justify-content:space-between; align-items:center; gap:18px;
  font-family:var(--font-title); font-size:1rem;
  color:var(--c-violet); text-transform:uppercase; letter-spacing:.5px;
  line-height:1.3; user-select:none;
}
.faq-icon {
  flex-shrink:0; color:var(--c-rouge);
  font-size:.88rem;
  transition:transform .35s var(--ease);
}
.faq-item.faq-open .faq-icon { transform:rotate(45deg); }

/* Accordéon avec max-height — fiable tous navigateurs */
.faq-body {
  max-height:0; overflow:hidden;
  transition:max-height .45s cubic-bezier(.4,0,.2,1);
}
.faq-item.faq-open .faq-body { max-height:320px; }
.faq-body p {
  padding:0 26px 22px;
  color:#555; font-size:.94rem; line-height:1.75;
}

/* ── NOS SPONSORS ────────────────────────────────────────────── */
.nos-sponsors-section {
  background: var(--c-dark);
  padding: 100px 24px;
  position: relative;
  overflow: hidden;
}
.nos-sponsors-section::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 20% 50%, rgba(139,92,246,.08) 0%, transparent 60%),
              radial-gradient(ellipse at 80% 50%, rgba(255,26,46,.06) 0%, transparent 60%);
  pointer-events: none;
}
.nos-sponsors-inner {
  max-width: 1100px;
  margin: 0 auto;
  position: relative;
  z-index: 1;
}
.nos-sponsors-header {
  text-align: center;
  margin-bottom: 64px;
}
.nos-sponsors-header .section-tag {
  color:var(--c-violet2); background:rgba(139,92,246,.1);
  border-color:rgba(139,92,246,.2);
}
.nos-sponsors-header h2 {
  font-family: var(--font-title);
  font-size: clamp(2rem, 4vw, 3rem);
  color: #fff;
  margin: 12px 0 16px;
  text-transform: uppercase;
  letter-spacing: .04em;
}
.nos-sponsors-header p {
  color: rgba(255,255,255,.55);
  font-size: .95rem;
  max-width: 500px;
  margin: 0 auto;
}

/* ── Media visibility block ── */
.media-visibility {
  background: linear-gradient(135deg, rgba(255,26,46,.07) 0%, rgba(139,92,246,.07) 100%);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 24px;
  padding: 44px 48px;
  margin-bottom: 64px;
  backdrop-filter:blur(8px);
  -webkit-backdrop-filter:blur(8px);
}
.media-intro {
  text-align: center;
  color: rgba(255,255,255,.75);
  font-size: .95rem;
  margin-bottom: 36px;
  line-height: 1.7;
}
.media-intro i { color: var(--c-or); margin-right: 8px; font-size: 1.1rem; }
.media-intro strong { color: #fff; }

.media-stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 32px;
}
.media-stat {
  position: relative;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.06);
  border-radius: 16px;
  padding: 24px 16px 18px;
  text-align: center;
  overflow: hidden;
  transition: all .4s var(--ease);
}
.media-stat:hover {
  background: rgba(255,255,255,.08);
  border-color: rgba(255,255,255,.16);
  transform:translateY(-4px);
  box-shadow:0 12px 24px rgba(0,0,0,.15);
}
.media-stat-num {
  display: block;
  font-family: var(--font-title);
  font-size: clamp(1.8rem, 3vw, 2.4rem);
  font-weight: 700;
  color: #fff;
  line-height: 1;
  letter-spacing: .02em;
}
.media-stat-num sup { font-size: .55em; color: var(--c-rouge); vertical-align: super; }
.media-stat-label {
  display: block;
  font-size: .72rem;
  color: rgba(255,255,255,.45);
  letter-spacing: .06em;
  text-transform: uppercase;
  margin-top: 8px;
  line-height: 1.5;
}
.media-stat-icon {
  position: absolute;
  bottom: 10px; right: 12px;
  font-size: 1.6rem;
  color: rgba(255,255,255,.06);
}

.media-details-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.media-detail-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: rgba(255,255,255,.03);
  border-radius: 10px;
  padding: 14px 16px;
  color: rgba(255,255,255,.6);
  font-size: .82rem;
  line-height: 1.6;
  border: 1px solid rgba(255,255,255,.05);
}
.media-detail-item i { color: var(--c-or); font-size: 1.1rem; flex-shrink: 0; margin-top: 2px; }
.media-detail-item strong { color: rgba(255,255,255,.9); }

@media (max-width: 768px) {
  .media-stats-row { grid-template-columns: repeat(2, 1fr); }
  .media-details-row { grid-template-columns: 1fr; }
  .media-visibility { padding: 28px 20px; }
}
@media (max-width: 480px) {
  .media-stats-row { grid-template-columns: repeat(2, 1fr); }
}

/* ── Filled state ── */
.sponsors-tier-block { margin-bottom: 48px; }
.tier-label { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.tier-badge {
  font-family: var(--font-title);
  font-size: .75rem;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: #fff;
  padding: 4px 14px;
  border-radius: 20px;
}
.sponsors-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.tier-capitaine  .sponsor-card { min-width: 220px; min-height: 110px; }
.tier-pilote     .sponsor-card { min-width: 180px; min-height: 90px; }
.tier-navigateur .sponsor-card { min-width: 150px; min-height: 80px; }
.tier-équipier   .sponsor-card { min-width: 120px; min-height: 70px; }

.sponsor-card {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 12px;
  padding: 20px;
  position: relative;
  text-decoration: none;
  transition: background .3s, border-color .3s, transform .3s var(--ease);
  cursor: pointer;
}
.sponsor-card:hover {
  background: rgba(255,255,255,.08);
  border-color: rgba(255,255,255,.25);
  transform: translateY(-4px);
}
.sponsor-logo { max-height: 56px; max-width: 160px; object-fit: contain; filter: brightness(0) invert(1); opacity:.8; }
.sponsor-name-text { color: #fff; font-weight: 700; font-size: .9rem; text-align: center; }
.sponsor-tier-chip {
  position: absolute;
  top: -8px; right: 10px;
  font-size: .62rem;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: #fff;
  padding: 2px 8px;
  border-radius: 10px;
  font-family: var(--font-title);
}

/* ── Empty state ── */
.sponsors-empty {
  text-align: center;
  padding: 16px 0 48px;
}
.sponsors-empty-lead {
  font-family: var(--font-title);
  font-size: clamp(1.3rem, 3vw, 1.8rem);
  color: #fff;
  text-transform: uppercase;
  letter-spacing: .06em;
  margin-bottom: 12px;
}
.sponsors-empty-sub {
  color: rgba(255,255,255,.5);
  font-size: .9rem;
  max-width: 480px;
  margin: 0 auto 48px;
}
.empty-tiers {
  display: flex;
  flex-direction: column;
  gap: 32px;
  margin-bottom: 52px;
}
.empty-tier { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
.empty-tier-label {
  font-family: var(--font-title);
  font-size: .8rem;
  letter-spacing: .1em;
  text-transform: uppercase;
  padding: 5px 14px;
  border: 1px solid;
  border-radius: 20px;
  white-space: nowrap;
  min-width: 100px;
  text-align: center;
}
.empty-slots-row { display: flex; flex-wrap: wrap; gap: 12px; }
.empty-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1.5px dashed;
  border-radius: 10px;
  padding: 16px 20px;
  min-width: 100px;
  min-height: 70px;
  transition: border-color .3s, background .3s;
}
.empty-slot i { font-size: 1.4rem; }
.empty-slot span { font-size: .65rem; letter-spacing: .08em; color: rgba(255,255,255,.3); text-transform: uppercase; }
.empty-slot:hover { background: rgba(255,255,255,.04); }

@media (max-width: 640px) {
  .empty-tier { flex-direction: column; align-items: flex-start; }
  .nos-sponsors-section { padding: 64px 20px; }
}

/* ── CTA FINAL ───────────────────────────────────────────────── */
.sponsor-section {
  background:var(--c-violet); color:#fff;
  padding:140px 5%; text-align:center;
  position:relative; overflow:hidden;
}
.sponsor-diagonal-bg {
  position:absolute; inset:-50px;
  background:linear-gradient(160deg, var(--c-dark) 0%, var(--c-violet) 50%, #3d295a 100%);
  transform:skewY(-3deg); z-index:1;
}
.sponsor-particles { position:absolute; inset:0; z-index:2; pointer-events:none; }
.particle-violet {
  position:absolute; bottom:-20px; width:4px; height:4px;
  background:var(--c-violet2); border-radius:50%;
  animation:violetFloat 12s linear infinite;
  box-shadow:0 0 10px rgba(107,79,138,.6);
}
@keyframes violetFloat {
  0%  { transform:translateY(0);    opacity:0; }
  10% { opacity:1; }
  90% { opacity:1; }
  100%{ transform:translateY(-100vh); opacity:0; }
}
.sponsor-content {
  position:relative; z-index:3;
  max-width:880px; margin:0 auto;
}
.sponsor-tag {
  display:inline-block; font-family:var(--font-title); color:var(--c-violet);
  background:var(--c-creme); padding:6px 18px;
  text-transform:uppercase; letter-spacing:2px; margin-bottom:20px; border-radius:3px;
}
.sponsor-content h2 {
  font-family:var(--font-title); color:#fff;
  font-size:clamp(2.4rem,6vw,4rem); margin-bottom:28px;
  text-transform:uppercase; line-height:1.1;
}
.text-gradient {
  background:linear-gradient(135deg, var(--c-rouge), var(--c-violet2));
  -webkit-background-clip:text; background-clip:text;
  -webkit-text-fill-color:transparent; display:inline-block;
  animation:gradShift 3s ease-in-out infinite;
}
@keyframes gradShift {
  0%,100% { filter:brightness(1); }
  50%     { filter:brightness(1.3); }
}
.sponsor-content p {
  font-size:1.2rem; color:var(--c-creme); opacity:.9;
  margin-bottom:48px; font-weight:300; line-height:1.8;
}
.sponsor-cta-group {
  display:flex; gap:20px; justify-content:center; flex-wrap:wrap; margin-bottom:48px;
}
.sponsor-trust {
  display:flex; gap:40px; justify-content:center; flex-wrap:wrap;
  padding-top:38px; border-top:1px solid rgba(255,255,255,.15);
}
.trust-item {
  display:flex; align-items:center; gap:10px;
  color:var(--c-creme); font-size:.88rem; opacity:.8;
}
.trust-item i { color:var(--c-rouge); font-size:1.1rem; }

/* ── FOOTER ──────────────────────────────────────────────────── */
.footer {
  background:var(--c-dark);
  color:rgba(250,243,221,.6);
  padding:80px 5% 32px;
  border-top:1px solid rgba(255,255,255,.04);
}
.footer-content { max-width:1300px; margin:0 auto; }
.footer-top {
  display:grid; grid-template-columns:2fr 1fr 1fr; gap:50px;
  margin-bottom:45px; padding-bottom:45px;
  border-bottom:1px solid rgba(250,243,221,.1);
}
@media (max-width:700px) { .footer-top { grid-template-columns:1fr; } }
.footer-col h5 {
  font-family:var(--font-title); color:#fff;
  font-size:.95rem; text-transform:uppercase; letter-spacing:2px; margin-bottom:18px;
}
.footer-col a {
  display:block; color:rgba(250,243,221,.6);
  text-decoration:none; padding:5px 0;
  transition:all .3s; font-size:.9rem;
}
.footer-col a:hover { color:var(--c-rouge); padding-left:8px; }
.footer-col p { font-size:.9rem; padding:5px 0; display:flex; align-items:center; gap:9px; }
.footer-col p i { color:var(--c-rouge); }
.footer-logo { font-family:var(--font-title); font-size:2.1rem; color:var(--c-creme); text-transform:uppercase; letter-spacing:3px; margin-bottom:9px; }
.footer-tagline { font-style:italic; font-size:.93rem; color:var(--c-rouge); }
.social-links { display:flex; gap:18px; margin-top:18px; }
.social-links a {
  color:var(--c-creme) !important; font-size:1.5rem;
  opacity:.65; transition:all .3s; padding:0 !important;
}
.social-links a:hover { opacity:1; color:var(--c-rouge) !important; transform:scale(1.2) translateY(-3px); padding-left:0 !important; }
.footer-bottom { text-align:center; font-size:.82rem; opacity:.5; }

/* ── MODAL ───────────────────────────────────────────────────── */
.modal-backdrop {
  position:fixed; inset:0;
  background:rgba(18,10,28,.9); backdrop-filter:blur(8px);
  display:flex; align-items:center; justify-content:center;
  z-index:2000; padding:20px;
}
.modal-content {
  background:var(--c-creme); padding:48px; border-radius:24px;
  width:100%; max-width:540px; position:relative;
  box-shadow:0 30px 65px rgba(0,0,0,.5), 0 0 0 1px rgba(230,57,70,.1);
  color:var(--c-violet);
}
.close-btn {
  position:absolute; top:18px; right:18px;
  background:none; border:none; font-size:1.8rem;
  color:var(--c-violet); cursor:pointer; opacity:.65; transition:all .3s;
}
.close-btn:hover { opacity:1; color:var(--c-rouge); transform:rotate(90deg); }
.modal-header { display:flex; align-items:center; gap:14px; margin-bottom:14px; }
.modal-icon { font-size:2rem; color:var(--c-rouge); }
.modal-content h3 { font-family:var(--font-title); font-size:2rem; text-transform:uppercase; }
.separator-vibrant {
  height:3px; width:100%;
  background:linear-gradient(to right, var(--c-rouge), var(--c-violet2));
  margin-bottom:28px; border-radius:2px;
}
.contact-list { list-style:none; margin-bottom:22px; }
.contact-list li { margin-bottom:16px; font-size:1.03rem; display:flex; align-items:center; gap:14px; }
.contact-list i { color:var(--c-violet2); font-size:1.15rem; width:24px; text-align:center; }
.modal-footer-block { text-align:center; }
.modal-quote { font-style:italic; font-weight:300; color:#666; margin-bottom:18px; }
.modal-enter-active, .modal-leave-active { transition:opacity .5s var(--ease); }
.modal-enter-from, .modal-leave-to { opacity:0; }
.modal-enter-active .modal-content, .modal-leave-active .modal-content { transition:transform .5s var(--ease); }
.modal-enter-from .modal-content, .modal-leave-to .modal-content { transform:scale(.9) translateY(28px); }

/* ════════════════════════════════════════════════════════════
   ANIMATIONS AU SCROLL — propriétés spécifiques, pas "all"
   ════════════════════════════════════════════════════════════ */
.reveal {
  opacity:0; visibility:hidden;
  transition:
      opacity  1.1s cubic-bezier(.16,1,.3,1),
      visibility 1.1s,
      transform 1.1s cubic-bezier(.16,1,.3,1),
      filter 1.1s cubic-bezier(.16,1,.3,1);
  filter:blur(4px);
}
.reveal.active { opacity:1; visibility:visible; filter:blur(0); }
.fade-up   { transform:translateY(60px);  }
.fade-up.active   { transform:translateY(0); }
.fade-left { transform:translateX(-60px); }
.fade-left.active { transform:translateX(0); }
.zoom-in   { transform:scale(.88);         }
.zoom-in.active   { transform:scale(1); }

/* Fade-right for variety */
.fade-right { transform:translateX(60px); }
.fade-right.active { transform:translateX(0); }

/* ── Responsive ──────────────────────────────────────────────── */
@media (max-width:768px) {
  .hero-mini-stats { gap:18px; }
  .mini-stat:not(:last-child)::after { display:none; }
  .mission-section, .team-section, .route-section,
  .why-section, .packs-section, .timeline-section, .faq-section { padding:80px 5%; }
  .timeline-line { left:28px; }
  .timeline-item, .timeline-item.timeline-right { width:100%; margin-left:0; padding:20px 0 20px 68px; }
  .timeline-icon, .timeline-item.timeline-right .timeline-icon { right:auto; left:0; }
  .stats-container { gap:14px; }
  .pack-highlight { transform:none; }
  .pack-highlight:hover { transform:translateY(-14px); }
}

@media (prefers-reduced-motion:reduce) {
  *, *::before, *::after {
    animation-duration:.01ms !important;
    transition-duration:.01ms !important;
  }
}
</style>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               