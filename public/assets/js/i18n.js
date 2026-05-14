// ============================================================
// PureSpec — i18n (FR / EN)
// Auto-détection de la langue navigateur, switcher manuel,
// stockage en cookie 1an pour persistance.
// ============================================================

(function () {
  const STORAGE_KEY = 'ps_lang';
  const SUPPORTED = ['fr', 'en'];
  const DEFAULT_LANG = 'fr';

  // Détection : 1) cookie 2) navigator.language 3) fallback FR
  function detectLang() {
    try {
      const cookieMatch = document.cookie.match(/(?:^|; )ps_lang=([^;]+)/);
      if (cookieMatch && SUPPORTED.includes(cookieMatch[1])) return cookieMatch[1];
    } catch {}
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED.includes(stored)) return stored;
    } catch {}
    try {
      const nav = (navigator.language || navigator.userLanguage || '').toLowerCase().slice(0, 2);
      // FR : France, Belgique francophone, Suisse francophone, Luxembourg, Monaco
      if (nav === 'fr') return 'fr';
      // Tout le reste de l'Europe (DE, IT, ES, NL, PT, EN-GB...) → anglais
      return 'en';
    } catch {}
    return DEFAULT_LANG;
  }

  function setLang(lang) {
    if (!SUPPORTED.includes(lang)) lang = DEFAULT_LANG;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch {}
    try {
      const exp = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
      document.cookie = `ps_lang=${lang}; expires=${exp}; path=/; SameSite=Lax`;
    } catch {}
    window.PS_LANG = lang;
    document.documentElement.setAttribute('lang', lang);
    apply();
    // Met à jour le bouton switcher
    const btn = document.getElementById('langSwitchLabel');
    if (btn) btn.textContent = lang.toUpperCase();
    const btnMobile = document.getElementById('langSwitchLabelMobile');
    if (btnMobile) btnMobile.textContent = lang.toUpperCase();
  }

  // ============ DICTIONNAIRES ============
  const DICT = {
    fr: {
      // NAVIGATION & CTAs
      'nav.atelier': 'Atelier',
      'nav.philosophy': 'Philosophie',
      'nav.registry': 'Registry',
      'nav.contact': 'Contact',
      'nav.cta': 'Concevoir',
      'nav.account': 'Mon compte',
      'nav.signin': 'Se connecter',
      'nav.menu': 'Menu',

      // 3 CARDS FEATURES (sous le hero — Figma)
      'feat.s1.title': 'Personnalisations infinies',
      'feat.s1.text': "De la nuance exacte de votre carrosserie aux détails techniques les plus pointus, configurez un sticker qui n'appartient qu'à vous. Aucun build ne se ressemble, votre signature non plus.",
      'feat.s2.title': 'Des Milliers de Configurations.',
      'feat.s2.text': "Chaque véhicule a une âme, chaque propriétaire a une vision. Explorez un univers de possibilités où les codes couleurs historiques rencontrent vos spécifications les plus pointues. Plus qu'un sticker, une archive physique de votre passion.",
      'feat.s3.title': 'Connectez votre passion',
      'feat.s3.text': "En intégrant votre handle Instagram directement sur votre fiche technique, transformez chaque rencontre en une nouvelle connexion. Votre sticker devient le lien physique entre votre voiture et votre communauté.",

      // FOOTER
      'footer.product': 'Produit',
      'footer.account': 'Compte',
      'footer.help': 'Aide',
      'footer.legal': 'Légal',
      'footer.signin': 'Se connecter',
      'footer.signup': 'Créer un compte',
      'footer.orders': 'Mes commandes',
      'footer.contact.us': 'Nous contacter',
      'footer.verify': 'Vérifier un sticker',
      'footer.legal.mentions': 'Mentions légales',
      'footer.legal.cgv': 'CGV',
      'footer.legal.cookies': 'Gérer les cookies',
      'footer.rights': 'Tous droits réservés.',
      'footer.tagline': 'Conçu en France · Imprimé avec précision',

      // HERO INDEX
      'hero.eyebrow': 'PureSpec — Édition 2026',
      'hero.title.l1': 'La signature',
      'hero.title.l2': 'de votre build.',
      'hero.title.em': 'Discrète. Vérifiée.',
      'hero.lead': "Un film électrostatique haute définition conçu pour se fondre dans votre pare-brise. Pas pour le couvrir.",
      'hero.cta.primary': 'Concevoir le mien',
      'hero.cta.secondary': 'Découvrir la philosophie',
      'hero.spec.format': 'Format',
      'hero.spec.pose': 'Pose',
      'hero.spec.pose.value': 'Électrostatique',
      'hero.spec.ref': 'Référence',
      'hero.spec.ref.value': 'Gravée sur la tranche',
      'hero.spec.warranty': 'Garantie',
      'hero.spec.warranty.value': 'Registry à vie',

      // ATELIER
      'atelier.eyebrow': "L'EXPÉRIENCE",
      'atelier.title': "L'Atelier.",
      'atelier.sub': "L'échantillonnage de précision. En temps réel.",

      // STORY
      'story.eyebrow': 'PHILOSOPHIE',

      // ORDER MODAL
      'order.step1.title': 'Votre commande',
      'order.step1.eyebrow': 'Étape 1 / 3',
      'order.step1.recap': 'Récapitulatif de configuration',
      'order.step1.qty': 'Quantité',
      'order.step1.total': 'Total',
      'order.step1.continue': 'Continuer',
      'order.auth.eyebrow': 'Étape 2 / 3',
      'order.auth.title': 'Connexion',
      'order.auth.lead': 'Connectez-vous pour finaliser votre commande. Vos infos seront pré-remplies à chaque achat.',
      'order.ship.eyebrow': 'Étape 3 / 3',
      'order.ship.title': 'Livraison',
      'order.ship.first': 'Prénom',
      'order.ship.last': 'Nom',
      'order.ship.email': 'Email',
      'order.ship.phone': 'Téléphone',
      'order.ship.addr': 'Adresse',
      'order.ship.zip': 'Code postal',
      'order.ship.city': 'Ville',
      'order.ship.country': 'Pays',
      'order.ship.subtotal': 'Sous-total',
      'order.ship.shipping': 'Livraison',
      'order.ship.total': 'Total TTC',
      'order.ship.submit': 'Passer la commande',
      'order.ship.note': 'Paiement sécurisé · Livraison sous 5 à 7 jours ouvrés',

      // CONFIRMATION POPUP
      'confirm.eyebrow': 'Dernière vérification',
      'confirm.title': 'Tout est bon&nbsp;?',
      'confirm.lead': "Votre sticker sera produit <strong>exactement</strong> selon ces informations. Une fois la commande validée, aucune modification n'est possible — chaque sticker est gravé à la commande.",
      'confirm.row.vehicle': 'Véhicule',
      'confirm.row.engine': 'Moteur',
      'confirm.row.color': 'Couleur',
      'confirm.row.ref': 'Référence',
      'confirm.row.qty': 'Quantité',
      'confirm.row.total': 'Total TTC',
      'confirm.btn.review': 'Vérifier',
      'confirm.btn.confirm': 'Oui, valider',
      'confirm.btn.loading': 'Redirection…',

      // SUCCESS POPUP
      'success.eyebrow': 'PAIEMENT CONFIRMÉ',
      'success.title': 'Merci.',
      'success.label.order': 'N° de commande',
      'success.label.ref': 'Référence sticker',
      'success.label.delivery': 'Livraison estimée',
      'success.email': 'Un récapitulatif a été envoyé à',
      'success.email.fallback': 'votre email',
      'success.cta': "C'est parfait",
      'success.help': 'Une question&nbsp;?',
      'success.help.link': 'Contactez-nous',

      // CONTACT
      'contact.tints.title': 'À propos des teintes',
      'contact.tints.body': 'La fidélité de la teinte sur le sticker dépend de la qualité de la photo soumise. Pour un résultat optimal, prélevez votre couleur à la lumière du jour, sans reflets prononcés.',
      'contact.form.consent': 'En envoyant ce formulaire, vous acceptez que vos informations soient utilisées pour traiter votre demande.',
      'contact.form.consent.link': 'En savoir plus',

      // REGISTRY
      'registry.title': 'Le PureSpec<br>Registry.',
      'registry.lead': "Chaque création reçoit un numéro de série unique gravé sur sa tranche. Une archive vérifiable à vie pour confirmer l'authenticité de votre configuration.",

      // LEGAL / CGV
      'legal.title': 'Mentions légales',
      'legal.lead': "Informations légales relatives à l'édition et à l'exploitation du site PureSpec.",
      'legal.editor': 'Éditeur du site',
      'legal.hq': 'Siège social',
      'legal.siren': 'SIREN',
      'legal.vat': 'TVA',
      'legal.vat.note': 'non applicable, art. 293 B du CGI',
      'legal.vat.shortnote': 'TVA non applicable, art. 293 B du CGI',
      'legal.contact': 'Contact',
      'legal.editor.body': "Le responsable de la publication est Zayed AHABRI, en sa qualité d'entrepreneur individuel exploitant l'activité commerciale sous l'enseigne PureSpec.",
      'legal.hosting': 'Hébergement',
      'legal.hosting.body': 'Le site est hébergé par Vercel Inc. (440 N Barranca Avenue #4133, Covina, CA 91723, USA — <a href="https://vercel.com" target="_blank" rel="noopener">vercel.com</a>) et utilise Supabase pour le stockage des données.',
      'legal.ip': 'Propriété intellectuelle',
      'legal.ip.body': "L'ensemble des éléments du site (textes, illustrations, photographies, identité visuelle PureSpec) est protégé par le droit d'auteur. Toute reproduction sans autorisation préalable est interdite. Les marques, modèles, codes moteur et codes couleur cités sont la propriété de leurs constructeurs respectifs. PureSpec n'est affilié à aucune marque automobile.",
      'legal.gdpr': 'Données personnelles (RGPD)',
      'legal.gdpr.body': 'Les informations recueillies via les formulaires (compte, commande, contact) sont nécessaires au traitement de votre demande ou de votre commande. Elles sont conservées pour la durée nécessaire à la finalité du traitement et aux obligations légales (notamment comptables). Vous disposez d\'un droit d\'accès, de rectification, de portabilité et de suppression sur ces données, à exercer par email à <a href="mailto:contact@purespec.fr">contact@purespec.fr</a>.',
      'legal.cookies': 'Cookies',
      'legal.cookies.body': 'Le site utilise uniquement des cookies strictement nécessaires à son fonctionnement (session de connexion, préférence de langue, acceptation des présentes). Aucun cookie publicitaire ou de tracking tiers n\'est déposé. Pour gérer votre consentement, cliquez sur «&nbsp;Gérer les cookies&nbsp;» en bas de page.',

      'cgv.title': 'Conditions Générales de Vente',
      'cgv.lead': 'Conditions applicables à toute commande passée sur le site PureSpec.',
      'cgv.1.title': '1. Produit',
      'cgv.1.body': "PureSpec commercialise des stickers électrostatiques sur mesure, conçus à partir des spécifications saisies par le client lors de la configuration (marque, modèle, version, code moteur, code couleur, identifiant Instagram). Chaque sticker reçoit une référence unique enregistrée au Registry, gravée verticalement sur la tranche.",
      'cgv.2.title': '2. Précision des teintes',
      'cgv.2.body': "L'algorithme de pipette interprète la zone d'image sélectionnée par le client. La fidélité de la teinte rendue dépend des conditions de prise de vue (lumière, reflets, qualité de l'image). Aucune réclamation ne pourra être recevable au titre d'une teinte estimée non conforme dès lors que la couleur appliquée correspond à la valeur enregistrée lors de la commande.",
      'cgv.3.title': '3. Commande & paiement',
      'cgv.3.body': "Les commandes sont passées via le site, le paiement étant assuré par Stripe (carte bancaire). Une étape de confirmation explicite est requise avant la validation : le client confirme l'exactitude des informations saisies. La commande est ferme dès validation du paiement. Une confirmation est envoyée par email. Les prix sont indiqués en euros, TVA non applicable, art. 293 B du CGI.",
      'cgv.4.title': '4. Production & expédition',
      'cgv.4.body': "Chaque sticker est produit à la commande. Le délai de production est généralement de 2 à 4 jours ouvrés, auxquels s'ajoute le délai de livraison (Colissimo ou Chronopost selon le pays). Les délais sont indicatifs. Les frais de livraison varient selon le pays de destination ; le montant exact est indiqué à l'étape de récapitulatif avant paiement.",
      'cgv.5.title': '5. Droit de rétractation',
      'cgv.5.body': "Les stickers PureSpec étant des biens confectionnés selon les spécifications du consommateur ou nettement personnalisés, ils sont exclus du droit de rétractation conformément à l'article L221-28 du Code de la consommation. Cette exclusion est confirmée et acceptée par le client au moment de la commande, via l'étape de confirmation explicite.",
      'cgv.6.title': '6. Conformité & garantie',
      'cgv.6.body': "En cas de défaut de fabrication avéré (impression défectueuse, erreur sur les informations saisies par PureSpec, sticker abîmé à réception), le client est invité à nous contacter sous 14 jours après réception avec photos à l'appui. Nous procéderons au remplacement ou au remboursement après examen du dossier.",
      'cgv.7.title': '7. Responsabilité',
      'cgv.7.body': "PureSpec n'est en aucun cas affilié, sponsorisé ou cautionné par les constructeurs automobiles dont les marques, modèles ou codes moteur sont mentionnés à titre purement descriptif sur le produit. L'apposition du sticker sur un véhicule relève de la seule responsabilité du client.",
      'cgv.8.title': '8. Litiges',
      'cgv.8.body': 'Les présentes CGV sont soumises au droit français. En cas de litige non résolu à l\'amiable, le client peut recourir à la plateforme européenne de règlement en ligne des litiges (<a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener">ec.europa.eu/consumers/odr</a>) ou saisir les tribunaux compétents.',

      // COOKIE BANNER
      'cookie.title': 'Cookies',
      'cookie.body': 'Nous utilisons uniquement des cookies strictement nécessaires au fonctionnement du site (session, préférence de langue). Aucun cookie publicitaire ni de tracking.',
      'cookie.accept': 'J\'ai compris',
      'cookie.learn': 'En savoir plus',
    },

    en: {
      // NAVIGATION & CTAs
      'nav.atelier': 'Atelier',
      'nav.philosophy': 'Philosophy',
      'nav.registry': 'Registry',
      'nav.contact': 'Contact',
      'nav.cta': 'Design',
      'nav.account': 'My account',
      'nav.signin': 'Sign in',
      'nav.menu': 'Menu',

      // 3 CARDS FEATURES
      'feat.s1.title': 'Infinite personalisation',
      'feat.s1.text': "From the exact shade of your bodywork to the finest technical details, design a sticker that belongs to no one but you. No two builds are alike — your signature shouldn't be either.",
      'feat.s2.title': 'Thousands of configurations.',
      'feat.s2.text': 'Every vehicle has a soul, every owner a vision. Explore a universe of possibilities where historical colour codes meet your most precise specifications. More than a sticker — a physical archive of your passion.',
      'feat.s3.title': 'Connect your passion',
      'feat.s3.text': 'By featuring your Instagram handle directly on your spec sheet, turn every encounter into a new connection. Your sticker becomes the physical bridge between your car and your community.',

      // FOOTER
      'footer.product': 'Product',
      'footer.account': 'Account',
      'footer.help': 'Help',
      'footer.legal': 'Legal',
      'footer.signin': 'Sign in',
      'footer.signup': 'Create an account',
      'footer.orders': 'My orders',
      'footer.contact.us': 'Contact us',
      'footer.verify': 'Verify a sticker',
      'footer.legal.mentions': 'Legal notice',
      'footer.legal.cgv': 'Terms & Conditions',
      'footer.legal.cookies': 'Cookie settings',
      'footer.rights': 'All rights reserved.',
      'footer.tagline': 'Designed in France · Printed with precision',

      // HERO
      'hero.eyebrow': 'PureSpec — 2026 Edition',
      'hero.title.l1': 'The signature',
      'hero.title.l2': 'of your build.',
      'hero.title.em': 'Discreet. Verified.',
      'hero.lead': 'A high-definition electrostatic film designed to blend into your windshield. Not to cover it.',
      'hero.cta.primary': 'Design mine',
      'hero.cta.secondary': 'Discover the philosophy',
      'hero.spec.format': 'Format',
      'hero.spec.pose': 'Fitting',
      'hero.spec.pose.value': 'Electrostatic',
      'hero.spec.ref': 'Reference',
      'hero.spec.ref.value': 'Engraved on the edge',
      'hero.spec.warranty': 'Warranty',
      'hero.spec.warranty.value': 'Lifetime Registry',

      // ATELIER
      'atelier.eyebrow': 'THE EXPERIENCE',
      'atelier.title': 'The Atelier.',
      'atelier.sub': 'Precision sampling. In real time.',

      'story.eyebrow': 'PHILOSOPHY',

      // ORDER MODAL
      'order.step1.title': 'Your order',
      'order.step1.eyebrow': 'Step 1 / 3',
      'order.step1.recap': 'Configuration summary',
      'order.step1.qty': 'Quantity',
      'order.step1.total': 'Total',
      'order.step1.continue': 'Continue',
      'order.auth.eyebrow': 'Step 2 / 3',
      'order.auth.title': 'Sign in',
      'order.auth.lead': 'Sign in to complete your order. Your details will be pre-filled for every future purchase.',
      'order.ship.eyebrow': 'Step 3 / 3',
      'order.ship.title': 'Shipping',
      'order.ship.first': 'First name',
      'order.ship.last': 'Last name',
      'order.ship.email': 'Email',
      'order.ship.phone': 'Phone',
      'order.ship.addr': 'Address',
      'order.ship.zip': 'Postcode',
      'order.ship.city': 'City',
      'order.ship.country': 'Country',
      'order.ship.subtotal': 'Subtotal',
      'order.ship.shipping': 'Shipping',
      'order.ship.total': 'Total',
      'order.ship.submit': 'Place order',
      'order.ship.note': 'Secure payment · Delivery in 5 to 7 business days',

      // CONFIRMATION POPUP
      'confirm.eyebrow': 'Final check',
      'confirm.title': 'Everything correct?',
      'confirm.lead': "Your sticker will be produced <strong>exactly</strong> from these details. Once the order is confirmed, no changes are possible — each sticker is made to order.",
      'confirm.row.vehicle': 'Vehicle',
      'confirm.row.engine': 'Engine',
      'confirm.row.color': 'Colour',
      'confirm.row.ref': 'Reference',
      'confirm.row.qty': 'Quantity',
      'confirm.row.total': 'Total',
      'confirm.btn.review': 'Review',
      'confirm.btn.confirm': 'Yes, confirm',
      'confirm.btn.loading': 'Redirecting…',

      // SUCCESS POPUP
      'success.eyebrow': 'PAYMENT CONFIRMED',
      'success.title': 'Thank you.',
      'success.label.order': 'Order number',
      'success.label.ref': 'Sticker reference',
      'success.label.delivery': 'Estimated delivery',
      'success.email': 'A receipt has been sent to',
      'success.email.fallback': 'your email',
      'success.cta': "All good",
      'success.help': 'Any question?',
      'success.help.link': 'Contact us',

      // CONTACT
      'contact.tints.title': 'About colour accuracy',
      'contact.tints.body': 'The colour fidelity of the sticker depends on the quality of the photo submitted. For the best result, sample your colour in daylight, without strong reflections.',
      'contact.form.consent': 'By submitting this form you agree that your information will be used to process your request.',
      'contact.form.consent.link': 'Learn more',

      // REGISTRY
      'registry.title': 'The PureSpec<br>Registry.',
      'registry.lead': 'Each piece receives a unique serial number engraved on its edge. A lifetime-verifiable record to confirm the authenticity of your configuration.',

      // LEGAL / CGV
      'legal.title': 'Legal Notice',
      'legal.lead': 'Legal information related to the publishing and operation of the PureSpec website.',
      'legal.editor': 'Publisher',
      'legal.hq': 'Registered office',
      'legal.siren': 'Company ID (SIREN)',
      'legal.vat': 'VAT',
      'legal.vat.note': 'not applicable, art. 293 B of the French Tax Code',
      'legal.vat.shortnote': 'VAT not applicable, art. 293 B French Tax Code',
      'legal.contact': 'Contact',
      'legal.editor.body': 'The publication manager is Zayed AHABRI, sole trader operating under the trade name PureSpec.',
      'legal.hosting': 'Hosting',
      'legal.hosting.body': 'The site is hosted by Vercel Inc. (440 N Barranca Avenue #4133, Covina, CA 91723, USA — <a href="https://vercel.com" target="_blank" rel="noopener">vercel.com</a>) and uses Supabase for data storage.',
      'legal.ip': 'Intellectual property',
      'legal.ip.body': "All elements on the site (text, illustrations, photographs, PureSpec visual identity) are protected by copyright. Any reproduction without prior authorisation is forbidden. The makes, models, engine codes and colour codes referenced are the property of their respective manufacturers. PureSpec is not affiliated with any car brand.",
      'legal.gdpr': 'Personal data (GDPR)',
      'legal.gdpr.body': 'Information collected via forms (account, order, contact) is necessary to process your request or order. It is kept for the time strictly necessary and to comply with legal obligations (notably accounting). You have a right of access, rectification, portability and deletion of this data, exercised by email at <a href="mailto:contact@purespec.fr">contact@purespec.fr</a>.',
      'legal.cookies': 'Cookies',
      'legal.cookies.body': 'The site only uses cookies strictly necessary for its operation (login session, language preference, acceptance of this notice). No advertising or third-party tracking cookies are set. To manage your consent, click "Cookie settings" at the bottom of the page.',

      'cgv.title': 'Terms & Conditions of Sale',
      'cgv.lead': 'Conditions applicable to any order placed on the PureSpec website.',
      'cgv.1.title': '1. Product',
      'cgv.1.body': 'PureSpec sells made-to-order electrostatic stickers, produced from the specifications entered by the customer during configuration (make, model, trim, engine code, colour code, Instagram handle). Each sticker receives a unique reference recorded in the Registry, engraved vertically on the edge.',
      'cgv.2.title': '2. Colour accuracy',
      'cgv.2.body': "The eyedropper algorithm interprets the image area selected by the customer. The fidelity of the rendered colour depends on shooting conditions (light, reflections, image quality). No claim will be accepted regarding an estimated non-conforming colour as long as the colour applied matches the value recorded at the time of order.",
      'cgv.3.title': '3. Order & payment',
      'cgv.3.body': "Orders are placed via the website, with payment processed by Stripe (credit/debit card). An explicit confirmation step is required before validation: the customer confirms the accuracy of the entered information. The order is firm upon payment validation. A confirmation is sent by email. Prices are shown in euros, VAT not applicable per art. 293 B French Tax Code.",
      'cgv.4.title': '4. Production & shipping',
      'cgv.4.body': "Each sticker is made to order. Production lead time is typically 2 to 4 business days, plus delivery time (Colissimo or Chronopost depending on country). Lead times are indicative. Shipping fees vary by destination country; the exact amount is shown at the summary step before payment.",
      'cgv.5.title': '5. Right of withdrawal',
      'cgv.5.body': "Because PureSpec stickers are goods made to the consumer's specifications or clearly personalised, they are excluded from the right of withdrawal under article L221-28 of the French Consumer Code. This exclusion is confirmed and accepted by the customer at order time, via the explicit confirmation step.",
      'cgv.6.title': '6. Compliance & warranty',
      'cgv.6.body': 'In the event of a proven manufacturing defect (faulty printing, error on information entered by PureSpec, sticker damaged on arrival), the customer is invited to contact us within 14 days of receipt with photos. We will proceed to replacement or refund after review.',
      'cgv.7.title': '7. Liability',
      'cgv.7.body': "PureSpec is in no way affiliated with, sponsored by, or endorsed by the car manufacturers whose makes, models or engine codes are mentioned purely descriptively on the product. Applying the sticker on a vehicle is solely the customer's responsibility.",
      'cgv.8.title': '8. Disputes',
      'cgv.8.body': 'These terms are governed by French law. In the event of a dispute not resolved amicably, the customer may use the European online dispute resolution platform (<a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener">ec.europa.eu/consumers/odr</a>) or refer the matter to the competent courts.',

      // COOKIE BANNER
      'cookie.title': 'Cookies',
      'cookie.body': 'We only use strictly necessary cookies (login session, language preference). No advertising or tracking cookies.',
      'cookie.accept': 'Got it',
      'cookie.learn': 'Learn more',
    }
  };

  function t(key) {
    const lang = window.PS_LANG || DEFAULT_LANG;
    const v = (DICT[lang] && DICT[lang][key]) || (DICT.fr && DICT.fr[key]);
    return v != null ? v : key;
  }

  function apply() {
    const lang = window.PS_LANG || DEFAULT_LANG;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const val = t(key);
      if (val == null) return;
      // Si le texte contient du HTML (entités, balises), utilise innerHTML
      if (/<[a-z][\s\S]*>|&[a-z]+;/i.test(val)) el.innerHTML = val;
      else el.textContent = val;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria-label')));
    });
  }

  // Bind du bouton switcher (créé inline dans chaque page)
  function bindSwitch() {
    const btn = document.getElementById('langSwitchBtn');
    if (btn) {
      btn.addEventListener('click', () => {
        const cur = window.PS_LANG || DEFAULT_LANG;
        setLang(cur === 'fr' ? 'en' : 'fr');
      });
    }
    const btnMobile = document.getElementById('langSwitchBtnMobile');
    if (btnMobile) {
      btnMobile.addEventListener('click', () => {
        const cur = window.PS_LANG || DEFAULT_LANG;
        setLang(cur === 'fr' ? 'en' : 'fr');
      });
    }
    const lbl = document.getElementById('langSwitchLabel');
    if (lbl) lbl.textContent = (window.PS_LANG || DEFAULT_LANG).toUpperCase();
    const lblMobile = document.getElementById('langSwitchLabelMobile');
    if (lblMobile) lblMobile.textContent = (window.PS_LANG || DEFAULT_LANG).toUpperCase();
  }

  // Expose globalement
  window._t = t;
  window.PS_SET_LANG = setLang;
  window.PS_LANG = detectLang();
  document.documentElement.setAttribute('lang', window.PS_LANG);

  // Auto-apply au DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { apply(); bindSwitch(); });
  } else {
    apply();
    bindSwitch();
  }
})();
