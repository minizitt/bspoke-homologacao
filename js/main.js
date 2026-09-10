/* ============================================
   BSPOKE — main.js
   ============================================ */

/* Defesa mínima (PROMPT 15): gsap/ScrollTrigger vêm de CDN (ver
   partials/scripts.html). Sem o guard abaixo, uma falha de rede no CDN
   faria essa linha lançar uma exceção incondicional logo no carregamento
   do script — o que impediria até o listener de DOMContentLoaded no fim
   do arquivo de ser registrado, derrubando nav/menu/form/ano junto com as
   animações. O guard não muda nada quando as libs carregam normalmente. */
const GSAP_AVAILABLE = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
if (GSAP_AVAILABLE) {
  gsap.registerPlugin(ScrollTrigger);
} else {
  // A classe .js (adicionada no <head> antes do primeiro paint, ver
  // build.py) só existe pra pré-esconder elementos que uma animação de
  // entrada vai revelar (.hero__l, .rv/.rv-l/.rv-r — ver style.css). Sem
  // GSAP essa animação nunca roda, então removê-la aqui garante que esses
  // elementos voltem a nascer visíveis (mesmo estado de "sem JS"), em vez
  // de ficarem presos em opacity:0/translateY esperando um reveal que
  // nunca acontece. Nav, menu mobile, formulário e ano não dependem desta
  // classe — continuam funcionando normalmente.
  document.documentElement.classList.remove('js');
}

/* Respeita prefers-reduced-motion: animações de scroll/entrada são puladas
   (o CSS correspondente em .rv/.rv-l/.rv-r já garante que o conteúdo fica
   visível por padrão nesse caso — ver style.css). */
const REDUCE_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── ENTRADA DA PÁGINA ─────────────────────── */
/* Sem preloader: a Hero (ou o pg-hero das páginas internas) fica visível
   de imediato; só a animação de entrada roda, curta e não-bloqueante. */
function initEntry() {
  if (document.querySelector('.hero')) { initHeroAnim(); }
  else { initPageEntry(); }
}

/* ── HERO ANIMATION ────────────────────────── */
function initHeroAnim() {
  const lines = document.querySelectorAll('.hero__l');
  if (!lines.length) return;
  if (REDUCE_MOTION) { gsap.set(lines, { y: '0%' }); return; }
  gsap.to(lines, { y: '0%', duration: 1, stagger: .15, ease: 'power4.out', delay: .1 });
  /* PREMIUMIZATION: hero__ticker e hero__scroll foram removidos do
     Ato 01 (classificados NOISE) — reveals correspondentes removidos
     junto. Restam só headline + subtítulo entrando. */
  gsap.from('.hero__sub', { opacity: 0, y: 28, duration: .8, ease: 'power3.out', delay: .6 });
}

/* ── PAGE ENTRY (interior pages) ───────────── */
function initPageEntry() {
  if (REDUCE_MOTION) return;
  const title = document.querySelector('.pg-hero__title');
  const sub   = document.querySelector('.pg-hero__sub');
  const lbl   = document.querySelector('.pg-hero .label');
  if (title) gsap.from(title, { opacity: 0, y: 60, duration: 1, ease: 'power4.out', delay: .15 });
  if (sub)   gsap.from(sub,   { opacity: 0, y: 30, duration: .8, ease: 'power3.out', delay: .4 });
  if (lbl)   gsap.from(lbl,   { opacity: 0, x: -20, duration: .6, ease: 'power3.out', delay: .2 });
}

/* ── NAV ───────────────────────────────────── */
function initNav() {
  const nav     = document.getElementById('nav');
  const burger  = document.getElementById('burger');
  const mobMenu = document.getElementById('mobMenu');

  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });

  if (burger && mobMenu) {
    /* Focus trap real, sem lib externa: enquanto o menu está aberto,
       (1) tudo no <body> exceto #nav e #mobMenu vira inert — some da
       árvore de acessibilidade e para de responder a clique/touch — e
       (2) Tab/Shift+Tab ciclam manualmente entre o primeiro e o último
       item focável do menu. #nav fica de fora do inert de propósito: o
       burger e a logo continuam acima do overlay (z-index maior), então
       nunca ficam "atrás" do modal — mas o ciclo de Tab abaixo já
       garante que o foco nunca escapa do menu por ali mesmo assim. */
    const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const getInertTargets = () => [...document.body.children]
      .filter(el => el !== nav && el !== mobMenu && el.tagName !== 'SCRIPT');

    const closeMenu = () => {
      burger.classList.remove('open');
      mobMenu.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      getInertTargets().forEach(el => el.removeAttribute('inert'));
    };
    const openMenu = () => {
      burger.classList.add('open');
      mobMenu.classList.add('open');
      burger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      getInertTargets().forEach(el => el.setAttribute('inert', ''));
      const firstItem = mobMenu.querySelector(FOCUSABLE);
      if (firstItem) firstItem.focus();
    };

    burger.addEventListener('click', () => {
      if (mobMenu.classList.contains('open')) closeMenu(); else openMenu();
    });
    mobMenu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', closeMenu);
    });
    document.addEventListener('keydown', e => {
      if (!mobMenu.classList.contains('open')) return;

      if (e.key === 'Escape') {
        closeMenu();
        burger.focus();
        return;
      }

      if (e.key === 'Tab') {
        const items = [...mobMenu.querySelectorAll(FOCUSABLE)];
        if (!items.length) return;
        const first = items[0];
        const last  = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
  }

  /* Active state por filename: compara o href de cada link (relativo à
     própria página) com o filename atual. Nas páginas de raiz isso é uma
     comparação direta ("cases.html" === "cases.html"). Dentro de /cases/
     (PROMPT 14) os links do nav levam um prefixo "../" (ex.: "../cases.html")
     e o filename atual é o do case (ex.: "militec-ecommerce.html"), então a
     comparação direta nunca bateria — daí o caso extra abaixo: se a página
     está dentro de /cases/, o link cujo alvo (sem o "../") é "cases.html"
     também é marcado ativo. Páginas de raiz não são afetadas. */
  const cur = location.pathname.split('/').pop() || 'index.html';
  const inCasesDetail = /\/cases\//.test(location.pathname);
  document.querySelectorAll('.nav__link').forEach(a => {
    const hrefFile = a.getAttribute('href').split('/').pop();
    if (hrefFile === cur || (inCasesDetail && hrefFile === 'cases.html')) {
      a.classList.add('active');
    }
  });
}

/* ── SCROLL REVEALS ────────────────────────── */
function initReveals() {
  /* Reduced motion: a visibilidade final de .rv/.rv-l/.rv-r já é garantida
     por CSS puro (opacity:1 !important dentro do media query de
     prefers-reduced-motion — ver fim do style.css), então nem o
     IntersectionObserver nem os ScrollTriggers abaixo têm motivo pra
     existir aqui: não criam nenhum efeito visual a mais, só trabalho e
     listeners rodando à toa. */
  if (REDUCE_MOTION) return;

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const d = parseInt(e.target.dataset.delay || 0);
        setTimeout(() => e.target.classList.add('in'), d);
        io.unobserve(e.target);
      }
    });
  }, { threshold: .1, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.rv, .rv-l, .rv-r').forEach(el => io.observe(el));

  gsap.utils.toArray('.sec-header').forEach(el => {
    gsap.from(el, {
      scrollTrigger: { trigger: el, start: 'top 88%' },
      opacity: 0, y: 24, duration: .8, ease: 'power3.out'
    });
  });

  /* PROMPT 12: Cases troca o grid de cards pelo mesmo princípio de "case
     como unidade" já usado em Especialidades (.cap-chapter) — cada
     .case-item recebe seu próprio fade-up. */
  gsap.utils.toArray('.case-item').forEach(ci => {
    gsap.from(ci, { scrollTrigger: { trigger: ci, start: 'top 85%' }, opacity: 0, y: 30, duration: .9, ease: 'power3.out' });
  });

  gsap.utils.toArray('.pillar').forEach((p, i) => {
    gsap.from(p, {
      scrollTrigger: { trigger: p, start: 'top 88%' },
      opacity: 0, x: -28, duration: .8, delay: i * .12, ease: 'power3.out'
    });
  });

  /* Equipe (reconstrução editorial): cada .eq-leader (Chris/Andressa/
     Redson) recebe seu próprio fade-up, mesmo princípio já usado em
     .pillar/.leadership__person — sem animar bio/território/frase
     individualmente. Substitui o antigo .team-member (removido). */
  gsap.utils.toArray('.eq-leader').forEach((l, i) => {
    gsap.from(l, {
      scrollTrigger: { trigger: l, start: 'top 88%' },
      opacity: 0, y: 36, duration: .8, delay: i * .08, ease: 'power3.out'
    });
  });

  const manifestoHl = document.querySelector('.manifesto__hl');
  if (manifestoHl) {
    gsap.from(manifestoHl, {
      scrollTrigger: { trigger: manifestoHl, start: 'top 82%' },
      opacity: 0, y: 36, duration: 1, ease: 'power3.out'
    });
  }

  const ctaHl = document.querySelector('.cta-band__hl');
  if (ctaHl) {
    gsap.from(ctaHl, {
      scrollTrigger: { trigger: ctaHl, start: 'top 82%' },
      opacity: 0, y: 50, duration: 1, ease: 'power4.out'
    });
  }

  /* PROMPT 10: as 5 especialidades viraram capítulos de um único sistema
     (.cap-system > .cap-chapter), por isso cada capítulo recebe seu próprio
     fade-up (não a section inteira) — reveal segue a repetição disciplinada
     do sistema, igual ao tratamento de esp-intro/esp-model. */
  gsap.utils.toArray('.esp-intro, .esp-model').forEach(s => {
    const inner = s.querySelector('.container');
    if (inner) gsap.from(inner, { scrollTrigger: { trigger: s, start: 'top 82%' }, opacity: 0, y: 40, duration: 1, ease: 'power3.out' });
  });
  gsap.utils.toArray('.cap-chapter').forEach(ch => {
    gsap.from(ch, { scrollTrigger: { trigger: ch, start: 'top 85%' }, opacity: 0, y: 30, duration: .9, ease: 'power3.out' });
  });

  /* PROMPT 14: Case Detail — cada bloco narrativo (.cd-block), momento de
     evidência (.cd-evidence — ROUND 4, ex-.cd-visual) e a conclusão
     (.cd-outcome) recebem seu próprio fade-up, seguindo o mesmo princípio
     de "unidade narrativa como unidade de reveal" já usado em
     .cap-chapter/.case-item. Motion deliberadamente contido: só fade+y,
     sem stagger por palavra/linha, sem pin/scrub (ROUND 4, item 37: nada
     de parallax/scroll-jacking/scroll horizontal/cinematic transitions). */
  gsap.utils.toArray('.cd-block, .cd-evidence, .cd-outcome').forEach(el => {
    gsap.from(el, { scrollTrigger: { trigger: el, start: 'top 88%' }, opacity: 0, y: 28, duration: .8, ease: 'power3.out' });
  });

  /* ── seções novas da Home ── */
  /* CAPABILITIES COMPACT: antes cada .home-capabilities__item tinha seu
     próprio ScrollTrigger (6 reveals independentes) — fazia sentido
     quando a seção era 5 faixas full-width espalhadas por ~800px+ de
     scroll. Na matriz compacta as 6 células cabem numa área bem menor,
     então revelar uma por uma criaria uma sequência de "tremeliques"
     percebida quase simultaneamente, não uma entrada coesa. Trocado
     para reveal único do bloco inteiro — mesmo princípio já usado em
     .esp-intro/.esp-model (container como unidade de reveal, não item
     por item). Não é motion novo, é o mesmo padrão do sistema aplicado
     de forma mais coerente com a nova composição. */
  const capMatrix = document.querySelector('.home-capabilities__matrix');
  if (capMatrix) {
    gsap.from(capMatrix, {
      scrollTrigger: { trigger: capMatrix, start: 'top 85%' },
      opacity: 0, y: 40, duration: .9, ease: 'power3.out'
    });
  }

  const specLead = document.querySelector('.spec-lead');
  if (specLead) {
    gsap.from(specLead, {
      scrollTrigger: { trigger: specLead, start: 'top 88%' },
      opacity: 0, x: -24, duration: .8, ease: 'power3.out'
    });
  }

  gsap.utils.toArray('.spec-card').forEach((c, i) => {
    gsap.from(c, {
      scrollTrigger: { trigger: c, start: 'top 90%' },
      opacity: 0, y: 30, duration: .7, delay: (i % 4) * .07, ease: 'power3.out'
    });
  });

  gsap.utils.toArray('.method-step').forEach((s, i) => {
    gsap.from(s, {
      scrollTrigger: { trigger: s, start: 'top 90%' },
      opacity: 0, y: 30, duration: .7, delay: (i % 5) * .07, ease: 'power3.out'
    });
  });

  gsap.utils.toArray('.process__step').forEach((s, i) => {
    gsap.from(s, {
      scrollTrigger: { trigger: '.process', start: 'top 85%' },
      opacity: 0, y: 20, duration: .6, delay: i * .1, ease: 'power3.out'
    });
  });

  gsap.utils.toArray('.leadership__person').forEach((c, i) => {
    gsap.from(c, {
      scrollTrigger: { trigger: c, start: 'top 88%' },
      opacity: 0, y: 24, duration: .7, delay: i * .1, ease: 'power3.out'
    });
  });
}

/* ── COPYRIGHT ─────────────────────────────── */
function initYear() {
  const el = document.getElementById('year');
  if (el) el.textContent = new Date().getFullYear();
}

/* ── FORM ──────────────────────────────────── */
/* Envia via FormSubmit.co (sem backend próprio, sem necessidade de conta —
   só requer 1 confirmação por e-mail em contato@bspoke.com.br na primeira
   submissão). Ver form action em contato.html. */
function initForm() {
  const form = document.querySelector('.c-form');
  if (!form) return;

  const btn  = form.querySelector('.form-sub .btn');
  const orig = btn.textContent;

  let msg = form.querySelector('.form-msg');
  if (!msg) {
    msg = document.createElement('p');
    msg.className = 'form-msg';
    // role="status" + aria-live="polite": leitores de tela anunciam o
    // resultado do envio (sucesso/erro) sem precisar que o foco se mova —
    // não muda nenhum comportamento de envio, só o anúncio.
    msg.setAttribute('role', 'status');
    msg.setAttribute('aria-live', 'polite');
    form.querySelector('.form-sub').appendChild(msg);
  }

  function setMsg(text, type) {
    msg.textContent = text;
    msg.classList.remove('is-ok', 'is-error');
    if (type) msg.classList.add(type);
    msg.classList.add('show');
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();

    // honeypot anti-spam — se preenchido, é bot: finge sucesso e não envia
    const honey = form.querySelector('input[name="_honey"]');
    if (honey && honey.value) {
      setMsg('Mensagem enviada com sucesso.', 'is-ok');
      form.reset();
      return;
    }

    btn.textContent = 'Enviando...';
    btn.disabled = true;
    msg.classList.remove('show');

    const endpoint = form.action.replace('formsubmit.co/', 'formsubmit.co/ajax/');

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: new FormData(form)
      });
      if (!res.ok) throw new Error('Falha no envio');

      // Estado de sucesso/erro fica só no texto do botão + na .form-msg
      // (que já é colorida por token — is-ok/is-error, ver style.css).
      // Nenhuma cor nova é introduzida no botão: ele continua dentro do
      // Button System existente (.btn.btn--primary), sem variante própria
      // de formulário.
      btn.textContent = 'Mensagem Enviada ✓';
      setMsg('Desafio recebido. Obrigado por compartilhar o contexto — entraremos em contato em breve.', 'is-ok');
      form.reset();
    } catch (err) {
      btn.textContent = 'Erro no envio';
      setMsg('Não conseguimos enviar agora. Tente novamente ou escreva para contato@bspoke.com.br.', 'is-error');
    } finally {
      setTimeout(() => {
        btn.textContent = orig;
        btn.disabled = false;
      }, 3500);
    }
  });
}

/* ── INIT ──────────────────────────────────── */
/* Ordem (PROMPT 15/15.1, defesa mínima): nav/form/ano primeiro, sempre.
   initEntry()/initReveals() usam gsap diretamente por dentro (não é o
   escopo deste hardening reestruturar a animação em si) — por isso só
   rodam quando GSAP_AVAILABLE é true. Assim, se o CDN falhar, a página
   simplesmente não anima (conteúdo já nasce visível via html.js/.rv, ver
   style.css) em vez de lançar uma exceção que impediria menu mobile,
   formulário e ano de inicializar. Zero mudança de comportamento quando
   as libs carregam normalmente. */
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initForm();
  initYear();
  if (GSAP_AVAILABLE) {
    initEntry();
    initReveals();
  }
});
